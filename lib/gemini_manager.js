/**
 * lib/gemini_manager.js
 * Quản lý đa khóa API Gemini (Multi-Key Rotation) & Thác ghép đa Model (Multi-Model Cascading)
 * - Tự động xoay vòng danh sách khóa API (apiKeys)
 * - Tự động cách ly tạm thời (cooldown 5 phút) các khóa gặp lỗi 429 (Hết quota / Quá tải)
 * - Thác ghép tự động qua các model khả dụng:
 *   gemini-3.8-flash -> gemini-flash-lite-latest -> gemini-3.7-flash -> gemini-3.6-flash -> gemini-3.5-flash -> gemini-3.5-flash-lite -> gemini-flash-latest
 * - Chống nghẽn 100%, bảo vệ hệ thống vận hành 24/7 không bị gián đoạn.
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = process.pkg ? process.cwd() : path.join(__dirname, '..');
const GEMINI_FILE = path.join(BASE_DIR, 'data/gemini.json');

// Danh sách các model Gemini ưu tiên theo thứ tự
const CANDIDATE_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest'
];

// Bộ nhớ đệm trạng thái Cooldown của các khóa API
// Key: apiKey -> { cooldownUntil: timestamp, errorCount: number }
const keyHealthState = new Map();

/**
 * Đọc tất cả các API key đã được cấu hình
 * Hỗ trợ cả định dạng cũ { apiKey: "..." } lẫn mới { apiKeys: ["...", "..."] }
 */
function getAllGeminiKeys() {
  try {
    if (fs.existsSync(GEMINI_FILE)) {
      const data = JSON.parse(fs.readFileSync(GEMINI_FILE, 'utf8') || '{}');
      let keys = [];
      if (Array.isArray(data.apiKeys) && data.apiKeys.length > 0) {
        keys = data.apiKeys.map(k => String(k).trim()).filter(Boolean);
      }
      if (data.apiKey && typeof data.apiKey === 'string') {
        const single = data.apiKey.trim();
        if (single && !keys.includes(single)) {
          keys.unshift(single);
        }
      }
      if (keys.length > 0) return keys;
    }
  } catch (e) {
    console.error('[GeminiManager] Lỗi đọc gemini.json:', e.message);
  }

  // Fallback sang biến môi trường nếu có
  const envKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || '';
  if (envKey) return [envKey.trim()];

  return [];
}

/**
 * Lưu danh sách API keys vào file
 */
function saveGeminiKeys(keyList) {
  const cleanKeys = (Array.isArray(keyList) ? keyList : [keyList])
    .map(k => String(k).trim())
    .filter(Boolean);

  const primaryKey = cleanKeys.length > 0 ? cleanKeys[0] : '';
  const payload = {
    apiKey: primaryKey,
    apiKeys: cleanKeys
  };

  fs.writeFileSync(GEMINI_FILE, JSON.stringify(payload, null, 2), 'utf8');
  return cleanKeys;
}

/**
 * Lấy một key đang sẵn sàng (chưa bị cooldown)
 */
function getActiveKeyPool() {
  const allKeys = getAllGeminiKeys();
  if (allKeys.length === 0) return [];

  const now = Date.now();
  // Lọc ra các key chưa bị cooldown hoặc đã hết thời gian cooldown
  const available = allKeys.filter(key => {
    const health = keyHealthState.get(key);
    if (!health) return true;
    return health.cooldownUntil < now;
  });

  // Nếu tất cả các key đều bị cooldown, reset key có thời gian chờ ngắn nhất
  if (available.length === 0) {
    console.warn('[GeminiManager] ⚠️ Toàn bộ các API key đang trong thời gian giãn cách. Tự động giải phóng key sớm nhất.');
    let earliestKey = allKeys[0];
    let minTime = Infinity;
    for (const k of allKeys) {
      const h = keyHealthState.get(k);
      if (h && h.cooldownUntil < minTime) {
        minTime = h.cooldownUntil;
        earliestKey = k;
      }
    }
    keyHealthState.delete(earliestKey);
    return [earliestKey];
  }

  return available;
}

/**
 * Đánh dấu một key gặp lỗi 429 hoặc 403 để tạm thời cách ly 5 phút
 */
function markKeyRateLimited(key, reason = '429 Quota Limit') {
  const now = Date.now();
  const current = keyHealthState.get(key) || { errorCount: 0 };
  const errorCount = current.errorCount + 1;
  const cooldownMinutes = Math.min(errorCount * 3, 15); // 3m, 6m, max 15m
  const cooldownUntil = now + (cooldownMinutes * 60 * 1000);

  keyHealthState.set(key, {
    cooldownUntil,
    errorCount,
    lastReason: reason
  });

  const maskedKey = key.length > 10 ? `${key.substring(0, 6)}...${key.substring(key.length - 4)}` : 'KEY';
  console.warn(`[GeminiManager] ⏳ Khóa [${maskedKey}] bị giới hạn (${reason}). Tạm ngưng sử dụng trong ${cooldownMinutes} phút. Tự động xoay sang khóa tiếp theo.`);
}

/**
 * Đánh dấu key hoạt động thành công
 */
function markKeySuccess(key) {
  const current = keyHealthState.get(key);
  if (current) {
    keyHealthState.set(key, {
      cooldownUntil: 0,
      errorCount: 0,
      lastSuccess: Date.now()
    });
  }
}

/**
 * Gọi sinh nội dung với cơ chế xoay vòng Key + Thác ghép Model
 * @param {string} prompt - Prompt gửi cho Gemini
 * @param {object} options - Cấu hình phụ trợ (temperature, maxOutputTokens, responseMimeType)
 * @returns {Promise<{ text: string, model: string, keyUsed: string }>}
 */
async function generateWithFailover(prompt, options = {}) {
  const keys = getActiveKeyPool();
  if (keys.length === 0) {
    throw new Error('Chưa có Gemini API key nào được cấu hình trong hệ thống.');
  }

  let fetchFn = globalThis.fetch;
  try { fetchFn = (await import('node-fetch')).default || globalThis.fetch; } catch(e) {}

  let lastError = null;

  // Vòng lặp qua từng API key đang sẵn sàng
  for (const key of keys) {
    // Vòng lặp qua từng model trong danh sách ưu tiên
    for (const model of CANDIDATE_MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
          const bodyPayload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: options.responseMimeType || 'application/json',
              maxOutputTokens: options.maxOutputTokens || 8192,
              temperature: options.temperature !== undefined ? options.temperature : 0.85
            }
          };

          const res = await fetchFn(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload)
          });

          if (res.ok) {
            const data = await res.json();
            const textPart = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (textPart && textPart.length > 50) {
              markKeySuccess(key);
              console.log(`[GeminiManager] ✅ Thành công với model [${model}]!`);
              return {
                text: textPart,
                model,
                keyUsed: key
              };
            }
          }

          // Xử lý lỗi 429 (Hết quota / Rate limit)
          if (res.status === 429) {
            markKeyRateLimited(key, '429 Quota Exceeded');
            // Nhảy sang key khác ngay lập tức
            break; 
          }

          // Xử lý lỗi 503 (Model quá tải tạm thời)
          if (res.status === 503) {
            if (attempt === 1) {
              await new Promise(r => setTimeout(r, 1500));
              continue;
            }
            // Thử model tiếp theo
            break;
          }

          // Xử lý lỗi 403 (Key sai hoặc bị block)
          if (res.status === 403) {
            markKeyRateLimited(key, '403 Invalid / Blocked Key');
            break;
          }

          const errText = await res.text().catch(() => '');
          lastError = new Error(`HTTP ${res.status} [${model}]: ${errText.substring(0, 150)}`);
          break;
        } catch (callErr) {
          lastError = callErr;
          break;
        }
      }
    }
  }

  throw new Error(`Toàn bộ cụm model và khóa Gemini đều không thể hoàn tất: ${lastError ? lastError.message : 'Unknown error'}`);
}

/**
 * Trả về trạng thái chi tiết của tất cả các khóa để hiển thị lên Dashboard UI
 */
function getKeysStatusReport() {
  const allKeys = getAllGeminiKeys();
  const now = Date.now();

  return allKeys.map((key, index) => {
    const health = keyHealthState.get(key) || { cooldownUntil: 0, errorCount: 0 };
    const isCoolingDown = health.cooldownUntil > now;
    const remainingSec = isCoolingDown ? Math.round((health.cooldownUntil - now) / 1000) : 0;
    const masked = key.length > 12 ? `${key.substring(0, 6)}...${key.substring(key.length - 4)}` : key;

    return {
      index: index + 1,
      maskedKey: masked,
      fullKey: key,
      isPrimary: index === 0,
      status: isCoolingDown ? 'cooling_down' : 'ready',
      remainingSec,
      lastReason: health.lastReason || 'Hoạt động tốt',
      errorCount: health.errorCount || 0
    };
  });
}

module.exports = {
  CANDIDATE_MODELS,
  getAllGeminiKeys,
  saveGeminiKeys,
  getActiveKeyPool,
  markKeyRateLimited,
  markKeySuccess,
  generateWithFailover,
  getKeysStatusReport
};
