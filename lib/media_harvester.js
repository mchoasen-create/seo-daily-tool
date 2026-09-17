/**
 * Media Harvester & Staging Manager với Lá Chắn AI Vision Chống Logo Đối Thủ
 * Rà soát kỹ lưỡng 100% hình ảnh trước khi cho phép cào về kho
 * Tự động phát hiện nhãn dán sticker, logo (VP, Việt Phát, Kenwa, Wepar, Karofi...) trên cột lọc / thân máy
 * Tự động loại bỏ (Auto-Reject) ảnh dính logo đối thủ, chỉ lưu giữ ảnh sạch chuẩn kỹ thuật
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
let sharp = null;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('⚠️ [Media Harvester] Thư viện sharp chưa sẵn sàng hoặc thiếu binary. Tính năng xử lý ảnh nâng cao sẽ dùng chế độ an toàn.');
}
const { GoogleGenerativeAI } = require('@google/generative-ai');

const BASE_DIR = process.pkg ? process.cwd() : path.join(__dirname, '..');
const STAGING_FILE = path.join(BASE_DIR, 'data/staging_media.json');
const UPLOADS_DIR = path.join(BASE_DIR, 'public/uploads');
const GEMINI_FILE = path.join(BASE_DIR, 'data/gemini.json');
const SOURCES_FILE = path.join(BASE_DIR, 'data/harvester_sources.json');
const GOOGLE_CONFIG_FILE = path.join(BASE_DIR, 'data/google_config.json');
const BRAND_LOGO_CONFIG_FILE = path.join(BASE_DIR, 'data/brand_logo_config.json');
const BRAND_LOGO_FILE = path.join(UPLOADS_DIR, 'custom_brand_logo.png');

const KHO_FILES = {
  kho_1: path.join(BASE_DIR, 'data/kho_1_sinh_hoat.json'),
  kho_2: path.join(BASE_DIR, 'data/kho_2_cong_nghiep.json'),
  kho_3: path.join(BASE_DIR, 'data/kho_3_tinh_khiet_ro.json')
};

const KHO_NAMES = {
  kho_1: 'Kho 1: Lọc Nước Sinh Hoạt / Giếng Khoan / Phèn',
  kho_2: 'Kho 2: Lọc Nước Công Nghiệp & Lò Hơi',
  kho_3: 'Kho 3: Lọc Nước Mặn & Lọc Nước Tinh Khiết RO'
};

function getGeminiKey() {
  try {
    const cfg = JSON.parse(fs.readFileSync(GEMINI_FILE, 'utf-8'));
    return cfg.apiKey || '';
  } catch (e) { return ''; }
}

function initStaging() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(STAGING_FILE)) {
    fs.writeFileSync(STAGING_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function getStagingMedia() {
  initStaging();
  try {
    return JSON.parse(fs.readFileSync(STAGING_FILE, 'utf8') || '[]');
  } catch (e) {
    return [];
  }
}

function saveStagingMedia(list) {
  initStaging();
  fs.writeFileSync(STAGING_FILE, JSON.stringify(list, null, 2), 'utf8');
}

/**
 * Tẩy sạch triệt để mọi tên thương hiệu đối thủ trong tiêu đề, alt text, tag keyword
 */
function sanitizeCompetitorText(text = '') {
  if (!text) return '';
  const competitorRegex = /(?:kensi|wepar|kenwa|vietphat|vi[eệ]t\s*ph[aá]t|doctorhouses?|daichi|karofi|kangaroo|s[oơ]n\s*h[aà]|sonha|t[aâ]n\s*[aá](?:\s*đ[aạ]i\s*th[aà]nh)?|t[aâ]n\s*m[yỹ]|tanmy|to[aà]n\s*[aá]|an\s*ph[aá]t|haohsing|tekcom|geyser|a\.?o\.?\s*smith|sunhouse|daikio)/gi;
  return text
    .replace(competitorRegex, 'Hoa Sen')
    .replace(/\s*\|\s*Hoa\s*Sen/gi, ' | Lọc Nước Hoa Sen')
    .replace(/\s*-\s*Hoa\s*Sen\s*-\s*Hoa\s*Sen/gi, ' - Hoa Sen')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Rà soát logo, nhãn dán thương hiệu đối thủ bằng AI Gemini Vision
 * Phát hiện sticker trên cột lọc composite, cột inox, khung RO, watermark chìm
 * @param {Buffer} imageBuffer Buffer ảnh
 * @returns {Promise<{ hasCompetitorLogo: boolean, detectedBrands: string[], details: string, recommendation: string }>}
 */
async function inspectCompetitorLogo(imageBuffer, { sourceUrl = '', contextText = '' } = {}) {
  const apiKey = getGeminiKey();
  const competitorRegex = /kensi|wepar|kenwa|vietphat|vi[eệ]t\s*ph[aá]t|karofi|kangaroo|s[oơ]n\s*h[aà]|t[aâ]n\s*[aá]|t[aâ]n\s*m[yỹ]|to[aà]n\s*[aá]|an\s*ph[aá]t|locnuocro/i;
  const isCompetitorSource = competitorRegex.test(sourceUrl) || competitorRegex.test(contextText);

  if (!apiKey) {
    if (isCompetitorSource) {
      return {
        hasCompetitorLogo: true,
        detectedBrands: ['Đối thủ'],
        details: `Nguồn đối thủ (${sourceUrl}) nhưng chưa có Gemini API Key để thẩm định. Tự động loại bỏ để bảo vệ Hoa Sen!`,
        recommendation: 'REJECT'
      };
    }
    return { hasCompetitorLogo: false, detectedBrands: [], details: 'Chưa cấu hình Gemini API Key', recommendation: 'CLEAN' };
  }

  // Danh sách model ưu tiên thử nghiệm: Gemini 3.8 theo yêu cầu của Tris, fallback 3.6 và Flash-Lite
  const modelsToTry = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-lite-latest'];

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    // Resize ảnh xuống tối đa 800px để gửi API nhanh và tiết kiệm token
    const resizedBuffer = await sharp(imageBuffer)
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const base64Data = resizedBuffer.toString('base64');
    const prompt = `Bạn là chuyên gia thị giác AI phân tích & bóc tách bản quyền hình ảnh cho công ty Lọc Nước Hoa Sen (hoasenwater.vn).
Nhiệm vụ: SOI TỪNG MILIMÉT VÀ RÀ SOÁT CỰC KỲ NGHIÊM NGẶT MỌI CHI TIẾT TRONG ẢNH xem có xuất hiện:
1. Logo thương hiệu hoặc nhãn dán sticker (hình tròn, oval, chữ nhật, giọt nước, tem kỹ thuật) dán trực tiếp trên:
   - Thân các cột lọc composite (màu xanh ngọc, xanh dương, xám trắng, tự nhiên)
   - Thân cột lọc inox, vỏ màng lọc RO inox/composite
   - Bồn chứa nước inox (ví dụ nhãn chữ lớn: TÂN MỸ, TANMY, SƠN HÀ, SONHA, TÂN Á ĐẠI THÀNH,...)
   - Tủ điều khiển, khung máy, hoặc in trên áo đồng phục/mũ bảo hộ kỹ thuật viên.
   (ĐẶC BIỆT CÁC NHÃN: KENSI, Kensi, VP, Việt Phát, Kenwa, Wepar, Karofi, Kangaroo, Toàn Á, Haohsing, A.O. Smith, Sunhouse, Daikio...)
2. Bất kỳ khung banner, dải màu viền ở đáy ảnh hoặc ở các góc ảnh chứa logo, số hotline, địa chỉ website hoặc dòng chữ tiêu đề (ví dụ: khung màu xanh góc trái có logo KENSI, thanh banner xanh đáy ảnh có chữ "LỌC NƯỚC DOANH TRẠI...", "HỆ THỐNG LỌC NƯỚC CÔNG NGHIỆP...").
3. Bất kỳ watermark chìm hoặc nổi, chữ viết địa chỉ, số hotline đè lên bề mặt bức ảnh.

QUY TẮC:
- Cung cấp chính xác tọa độ box_2d: [ymin, xmin, ymax, xmax] (chuẩn hóa từ 0 đến 1000) của từng vùng logo / nhãn dán sticker trên cột lọc / banner đáy để hệ thống tiến hành XÓA BỎ.
- Nếu có banner đáy: Đặt "hasBottomBanner": true và "bottomBannerYmin": <tọa độ ymin bắt đầu của dải banner>.
- HOA SEN / HOA SEN WATER là THƯƠNG HIỆU CỦA CHÚNG TA (không reject). Các phụ kiện quốc tế không in tên đối thủ VN (như màng Filmtec, van Runxin, Autotrol) được phép.
- Chỉ trả về "CLEAN" khi bức ảnh là thiết bị hoàn toàn sạch tem nhãn đối thủ và KHÔNG CÓ banner/watermark.

Trả về duy nhất định dạng JSON:
{
  "hasCompetitorLogo": true hoặc false,
  "detectedBrands": ["tên thương hiệu đối thủ"],
  "details": "mô tả chi tiết vị trí vi phạm (ví dụ: nhãn dán oval Kensi trên thân cột composite, banner màu xanh ở đáy ảnh)",
  "hasBottomBanner": true hoặc false,
  "bottomBannerYmin": 760,
  "regions": [
    {
      "type": "column_sticker" hoặc "corner_logo" hoặc "bottom_banner" hoặc "tank_brand" hoặc "watermark",
      "box_2d": [ymin, xmin, ymax, xmax],
      "description": "tem dán trên cột lọc"
    }
  ],
  "recommendation": "REJECT" hoặc "CLEAN"
}`;

    let parsedResult = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const res = await model.generateContent([
          { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
          prompt
        ]);

        const text = res.response.text().trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const brands = (parsed.detectedBrands || []).filter(b => !/hoa\s*sen/i.test(b));
          const isReject = brands.length > 0 || parsed.hasCompetitorLogo === true || parsed.recommendation === 'REJECT';

          parsedResult = {
            hasCompetitorLogo: isReject,
            detectedBrands: brands,
            details: isReject ? (parsed.details || 'Phát hiện dấu vết đối thủ') : (parsed.details ? `(Chính chủ / An toàn): ${parsed.details}` : 'Ảnh sạch an toàn'),
            hasBottomBanner: parsed.hasBottomBanner === true,
            bottomBannerYmin: parsed.bottomBannerYmin || 780,
            regions: Array.isArray(parsed.regions) ? parsed.regions : [],
            recommendation: isReject ? 'REJECT' : 'CLEAN'
          };
          break; // Thành công
        }
      } catch (callErr) {
        if (callErr.message && callErr.message.includes('429')) {
          console.warn(`[BrandShield 3.8] Model ${modelName} bị 429 quota. Đợi 1.5s và thử model tiếp theo...`);
          await new Promise(r => setTimeout(r, 1500));
        } else {
          console.warn(`[BrandShield Vision] Lỗi model ${modelName}:`, callErr.message);
        }
      }
    }

    if (parsedResult) return parsedResult;
  } catch (err) {
    console.warn('[BrandShield Vision] Lỗi tổng thể rà soát logo đối thủ:', err.message);
  }

  // LÁ CHẮN CUỐI CÙNG (FAIL-SAFE): Nếu ảnh đến từ website đối thủ mà AI gặp lỗi quota/mạng
  // TUYỆT ĐỐI KHÔNG CHO QUA! Chặn ngay lập tức để bảo vệ thương hiệu!
  if (isCompetitorSource) {
    console.log(`[BrandShield] 🛡️ AUTO-REJECT: Ảnh từ website đối thủ (${sourceUrl}) chưa thể thẩm định an toàn do API quá tải. Loại bỏ ngay!`);
    return {
      hasCompetitorLogo: true,
      detectedBrands: ['Đối thủ'],
      details: `Ảnh từ nguồn đối thủ (${sourceUrl}) chưa qua thẩm định AI do giới hạn API (Tự động loại bỏ để bảo vệ an toàn)`,
      recommendation: 'REJECT'
    };
  }

  return { hasCompetitorLogo: false, detectedBrands: [], details: 'Ảnh sạch an toàn', recommendation: 'CLEAN' };
}

/**
 * Phân tích ngữ cảnh hình ảnh để gợi ý Kho chính xác
 */
function analyzeImageContext(textToAnalyze = '') {
  const t = (textToAnalyze || '').toLowerCase();

  // Kho 3: Tinh khiết RO, đóng bình, đóng chai, chiết rót, mặn
  const kho3Terms = [
    'vỏ bình', 'bình 20l', 'đóng bình', 'đóng chai', 'chiết rót', 'tinh khiết', 'ro',
    'nước uống', 'uống trực tiếp', 'nước mặn', 'khử mặn', 'nước lợ', 'edi', 'khử khoáng',
    'màng ro', 'filmtec', 'dow', 'toray', 'vosteen', 'bình lọc ro', 'tủ ro'
  ];

  // Kho 2: Công nghiệp, lò hơi, nhà máy, công suất lớn
  const kho2Terms = [
    'công nghiệp', 'lò hơi', 'nồi hơi', 'nhà xưởng', 'nhà máy', 'xí nghiệp', 'khu công nghiệp',
    'tháp giải nhiệt', 'nước cấp lò hơi', '10m3', '20m3', '30m3', '50m3', '100m3',
    'composite 3672', 'composite 4272', 'cột lọc to', 'bồn công nghiệp', 'manhole'
  ];

  // Kho 1: Sinh hoạt, gia đình, phèn, giếng khoan
  const kho1Terms = [
    'sinh hoạt', 'gia đình', 'giếng khoan', 'nhiễm phèn', 'khử sắt', 'kim loại nặng',
    'bột khử phèn', 'cột 1054', 'composite 1054', 'cột inox 304', 'biệt thự', 'chung cư',
    'nhà phố', 'sân thượng', 'đầu nguồn', 'lọc tổng'
  ];

  let k3Score = 0;
  let k2Score = 0;
  let k1Score = 0;

  kho3Terms.forEach(term => { if (t.includes(term)) k3Score += 2; });
  kho2Terms.forEach(term => { if (t.includes(term)) k2Score += 2; });
  kho1Terms.forEach(term => { if (t.includes(term)) k1Score += 2; });

  if (k3Score > k2Score && k3Score > k1Score) {
    return {
      suggestedKho: 'kho_3',
      suggestedKhoName: KHO_NAMES.kho_3,
      reason: `Phát hiện ngữ cảnh tinh khiết / đóng bình / RO (${k3Score} điểm)`
    };
  }
  if (k2Score > k1Score) {
    return {
      suggestedKho: 'kho_2',
      suggestedKhoName: KHO_NAMES.kho_2,
      reason: `Phát hiện ngữ cảnh công nghiệp / lò hơi (${k2Score} điểm)`
    };
  }

  return {
    suggestedKho: 'kho_1',
    suggestedKhoName: KHO_NAMES.kho_1,
    reason: `Phù hợp lọc nước sinh hoạt / giếng khoan / khử phèn (${k1Score || 1} điểm)`
  };
}

/**
 * Đóng dấu huy hiệu Lọc Nước Hoa Sen chất lượng cao đè lên ảnh
 */
async function stampHoaSenBrandBadge(imageBuffer, position = 'bottom-right') {
  const badgeSvg = `
    <svg width="240" height="66" viewBox="0 0 240 66" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="badgeBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="#1e293b" stop-opacity="0.95"/>
        </linearGradient>
        <filter id="badgeShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.5"/>
        </filter>
      </defs>
      <rect x="3" y="3" width="234" height="60" rx="30" fill="url(#badgeBg)" stroke="#38bdf8" stroke-width="2" filter="url(#badgeShadow)"/>
      <circle cx="33" cy="33" r="20" fill="#0284c7"/>
      <path d="M 33 20 C 33 20 25 32 25 36 C 25 41 29 44 33 44 C 37 44 41 41 41 36 C 41 32 33 20 33 20 Z" fill="#ffffff"/>
      <text x="62" y="31" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="900" fill="#ffffff" letter-spacing="0.5">LỌC NƯỚC HOA SEN</text>
      <text x="62" y="47" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#38bdf8">0938 880 492 • CHÍNH HÃNG</text>
    </svg>
  `;

  const meta = await sharp(imageBuffer).metadata();
  const w = meta.width || 800;
  const h = meta.height || 600;

  let left = w - 260;
  let top = h - 86;
  if (position === 'top-left') { left = 20; top = 20; }
  else if (position === 'top-right') { left = w - 260; top = 20; }
  else if (position === 'bottom-left') { left = 20; top = h - 86; }

  return await sharp(imageBuffer)
    .composite([{ input: Buffer.from(badgeSvg), top: Math.max(10, top), left: Math.max(10, left) }])
    .webp({ quality: 90 })
    .toBuffer();
}

/**
 * Lấy cấu hình logo thương hiệu chính chủ của Tris
 */
function getBrandLogoConfig() {
  try {
    const hasCustomLogo = fs.existsSync(BRAND_LOGO_FILE);
    let cfg = {};
    if (fs.existsSync(BRAND_LOGO_CONFIG_FILE)) {
      cfg = JSON.parse(fs.readFileSync(BRAND_LOGO_CONFIG_FILE, 'utf8') || '{}');
    }
    return {
      enabled: cfg.enabled !== false,
      hasCustomLogo,
      logoUrl: hasCustomLogo ? `/uploads/custom_brand_logo.png?v=${cfg.updatedAt || Date.now()}` : '',
      position: cfg.position || 'replace-competitor', // 'replace-competitor', 'bottom-right', 'bottom-left', 'top-right'
      scalePercent: Number(cfg.scalePercent) || 18, // 10% đến 35% chiều rộng ảnh
      opacity: Number(cfg.opacity) || 100,
      updatedAt: cfg.updatedAt || Date.now()
    };
  } catch (e) {
    const hasCustomLogo = fs.existsSync(BRAND_LOGO_FILE);
    return {
      enabled: true,
      hasCustomLogo,
      logoUrl: hasCustomLogo ? `/uploads/custom_brand_logo.png?v=${Date.now()}` : '',
      position: 'replace-competitor',
      scalePercent: 18,
      opacity: 100,
      updatedAt: Date.now()
    };
  }
}

/**
 * Lưu cấu hình cài đặt ghép logo
 */
function saveBrandLogoConfig(updates = {}) {
  try {
    const current = getBrandLogoConfig();
    const updated = {
      ...current,
      ...updates,
      updatedAt: Date.now()
    };
    if (!fs.existsSync(path.dirname(BRAND_LOGO_CONFIG_FILE))) {
      fs.mkdirSync(path.dirname(BRAND_LOGO_CONFIG_FILE), { recursive: true });
    }
    fs.writeFileSync(BRAND_LOGO_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
    return getBrandLogoConfig();
  } catch (e) {
    console.warn('[BrandLogo] Lỗi khi lưu config:', e.message);
    return getBrandLogoConfig();
  }
}

/**
 * Lưu file logo tải lên của Tris (PNG trong suốt/JPG/WebP)
 */
async function saveCustomBrandLogoFile(dataUrlOrBase64) {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    let buffer;
    if (typeof dataUrlOrBase64 === 'string') {
      const match = dataUrlOrBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      const base64Str = match ? match[2] : dataUrlOrBase64;
      buffer = Buffer.from(base64Str, 'base64');
    } else if (Buffer.isBuffer(dataUrlOrBase64)) {
      buffer = dataUrlOrBase64;
    } else {
      throw new Error('Định dạng dữ liệu ảnh logo không hợp lệ!');
    }

    // Chuẩn hóa ảnh sang PNG giữ nguyên nền trong suốt (alpha channel)
    const normalizedBuffer = await sharp(buffer)
      .png({ compressionLevel: 9 })
      .toBuffer();

    fs.writeFileSync(BRAND_LOGO_FILE, normalizedBuffer);
    const updatedCfg = saveBrandLogoConfig({ enabled: true, updatedAt: Date.now() });

    console.log(`[BrandLogo] 💎 Đã lưu logo chính chủ của Tris thành công (${normalizedBuffer.length} bytes)!`);
    return { success: true, config: updatedCfg };
  } catch (e) {
    console.error('[BrandLogo] Lỗi khi lưu file logo:', e.message);
    throw e;
  }
}

/**
 * Xóa file logo thương hiệu
 */
function deleteCustomBrandLogoFile() {
  try {
    if (fs.existsSync(BRAND_LOGO_FILE)) {
      fs.unlinkSync(BRAND_LOGO_FILE);
    }
    const cfg = saveBrandLogoConfig({ enabled: false, updatedAt: Date.now() });
    return { success: true, config: cfg };
  } catch (e) {
    console.warn('[BrandLogo] Lỗi khi xóa file logo:', e.message);
    return { success: false, message: e.message };
  }
}

/**
 * TỰ ĐỘNG GHÉP LOGO THƯƠNG HIỆU CỦA TRIS ĐÈ LÊN ẢNH ĐÃ XỬ LÝ
 * @param {Buffer} imageBuffer Buffer ảnh nguồn
 * @param {Object} options { brandCheck, force }
 * @returns {Promise<{ buffer: Buffer, stamped: boolean, position: string }>}
 */
async function overlayCustomBrandLogo(imageBuffer, { brandCheck = {}, force = false } = {}) {
  try {
    const cfg = getBrandLogoConfig();
    if (!force && !cfg.enabled) {
      return { buffer: imageBuffer, stamped: false };
    }

    // Kiểm tra xem đã có file logo chính chủ của Tris chưa
    if (!fs.existsSync(BRAND_LOGO_FILE)) {
      return { buffer: imageBuffer, stamped: false };
    }

    const baseMeta = await sharp(imageBuffer).metadata();
    const W = baseMeta.width;
    const H = baseMeta.height;
    if (!W || !H || W < 140 || H < 90) {
      return { buffer: imageBuffer, stamped: false };
    }

    const logoRaw = fs.readFileSync(BRAND_LOGO_FILE);
    const lMeta = await sharp(logoRaw).metadata();
    if (!lMeta.width || !lMeta.height) {
      return { buffer: imageBuffer, stamped: false };
    }

    // Tính kích thước logo theo tỉ lệ chiều rộng ảnh (% scalePercent: 10% - 35%)
    const scale = Math.max(0.10, Math.min(0.35, (cfg.scalePercent || 18) / 100));
    let targetW = Math.round(W * scale);
    let targetH = Math.round(lMeta.height * (targetW / lMeta.width));

    // Không để logo cao quá 26% chiều cao ảnh
    if (targetH > Math.round(H * 0.26)) {
      targetH = Math.round(H * 0.26);
      targetW = Math.round(lMeta.width * (targetH / lMeta.height));
    }

    targetW = Math.max(48, Math.min(W - 20, targetW));
    targetH = Math.max(20, Math.min(H - 20, targetH));

    // Resize logo và giữ nguyên độ trong suốt (alpha)
    const resizedLogoBuffer = await sharp(logoRaw)
      .resize(targetW, targetH, { fit: 'inside' })
      .png()
      .toBuffer();

    const marginX = Math.max(12, Math.round(W * 0.025));
    const marginY = Math.max(12, Math.round(H * 0.025));

    let left = W - targetW - marginX;
    let top = H - targetH - marginY;
    let resolvedPos = cfg.position || 'replace-competitor';

    if (resolvedPos === 'replace-competitor') {
      // Ưu tiên thay thế đè lên vị trí logo/tem dán đối thủ cũ vừa bị xóa
      let foundSpot = false;
      const regions = (brandCheck.regions || []).filter(r => r.box_2d && r.box_2d.length === 4);
      const cornerOrTank = regions.find(r => r.type === 'corner_logo' || r.type === 'tank_brand');

      if (cornerOrTank) {
        const [ymin, xmin, ymax, xmax] = cornerOrTank.box_2d;
        const regLeft = Math.round((xmin / 1000) * W);
        const regTop = Math.round((ymin / 1000) * H);
        left = Math.max(marginX, Math.min(W - targetW - marginX, regLeft));
        top = Math.max(marginY, Math.min(H - targetH - marginY, regTop));
        foundSpot = true;
      } else if (brandCheck.hasBottomBanner) {
        // Nếu có banner đáy: Đặt ở góc dưới bên phải
        left = W - targetW - marginX;
        top = H - targetH - marginY;
        foundSpot = true;
      }

      if (!foundSpot) {
        // Mặc định góc dưới bên phải (an toàn, đẹp nhất cho ảnh công trình)
        left = W - targetW - marginX;
        top = H - targetH - marginY;
      }
    } else if (resolvedPos === 'bottom-left') {
      left = marginX;
      top = H - targetH - marginY;
    } else if (resolvedPos === 'top-right') {
      left = W - targetW - marginX;
      top = marginY;
    } else if (resolvedPos === 'top-left') {
      left = marginX;
      top = marginY;
    } else {
      // bottom-right
      left = W - targetW - marginX;
      top = H - targetH - marginY;
    }

    // Bảo đảm không tràn khung ảnh
    left = Math.max(0, Math.min(W - targetW, left));
    top = Math.max(0, Math.min(H - targetH, top));

    const finalBuffer = await sharp(imageBuffer)
      .composite([{
        input: resizedLogoBuffer,
        left,
        top
      }])
      .webp({ quality: 90 })
      .toBuffer();

    return {
      buffer: finalBuffer,
      stamped: true,
      position: resolvedPos,
      coords: { left, top, width: targetW, height: targetH }
    };
  } catch (err) {
    console.warn('[BrandLogo] Lỗi khi tự động ghép logo thương hiệu:', err.message);
    return { buffer: imageBuffer, stamped: false };
  }
}


/**
 * TỰ ĐỘNG BÓC TÁCH & XÓA SẠCH MỌI VẾT TÍCH ĐỐI THỦ:
 * 1. Xén bỏ dải banner đáy (chứa logo + chữ quảng cáo đáy ảnh)
 * 2. Hòa tan / làm mờ sâu tem nhãn sticker trên thân cột composite/inox
 * 3. Tẩy chữ thương hiệu trên bồn inox & watermark
 * 4. Trả về buffer ảnh sạch 100% để đưa vào Hộp Thư Xét Duyệt cho Tris duyệt
 */
async function autoEraseCompetitorBranding(imageBuffer, brandCheck = {}) {
  try {
    const meta = await sharp(imageBuffer).metadata();
    const W = meta.width;
    const H = meta.height;

    let currentBuffer = imageBuffer;
    let currentH = H;

    // 1. XỬ LÝ BANNER ĐÁY & LOGO KHUNG GÓC ĐÁY
    const hasBottomBanner = brandCheck.hasBottomBanner === true || 
      (brandCheck.details && /banner.*đáy|đáy.*banner|thanh.*xanh.*đáy|khung.*xanh.*đáy|tiêu đề.*banner/i.test(brandCheck.details)) ||
      (brandCheck.regions || []).some(r => r.type === 'bottom_banner' || (r.box_2d && r.box_2d[0] >= 650));

    if (hasBottomBanner) {
      let bannerY = 800;
      if (brandCheck.bottomBannerYmin && brandCheck.bottomBannerYmin > 550 && brandCheck.bottomBannerYmin < 920) {
        bannerY = brandCheck.bottomBannerYmin;
      } else {
        const bRegion = (brandCheck.regions || []).find(r => r.type === 'bottom_banner');
        if (bRegion && bRegion.box_2d) bannerY = bRegion.box_2d[0];
      }
      
      // Xén cao hơn mép banner một chút (trừ 15 đơn vị trên thang 1000) để cắt đứt hoàn toàn banner đáy & logo góc
      const safeRatio = Math.max(0.65, Math.min(0.86, (bannerY - 15) / 1000));
      const cropH = Math.round(H * safeRatio);

      if (cropH >= 180 && cropH < H) {
        currentBuffer = await sharp(currentBuffer)
          .extract({ left: 0, top: 0, width: W, height: cropH })
          .toBuffer();
        currentH = cropH;
        console.log(`[BrandShield 3.8] ✂️ Đã xén bỏ dải banner đáy đối thủ (từ ${H}px -> ${currentH}px)`);
      }
    }

    // 2. XỬ LÝ TEM NHÃN STICKER TRÊN THÂN CỘT & BỒN NƯỚC:
    const regions = (brandCheck.regions || []).filter(r => r.box_2d && r.box_2d.length === 4);
    const stickerRegions = regions.filter(r => r.type === 'column_sticker' || r.type === 'tank_brand' || r.type === 'corner_logo');

    if (stickerRegions.length > 0) {
      const overlays = [];

      for (const reg of stickerRegions) {
        const [ymin, xmin, ymax, xmax] = reg.box_2d;
        // Quy đổi tọa độ theo kích thước gốc
        const origTop = Math.round((ymin / 1000) * H);
        const origLeft = Math.round((xmin / 1000) * W);
        const origW = Math.round(((xmax - xmin) / 1000) * W);
        const origH = Math.round(((ymax - ymin) / 1000) * H);

        // Nếu vùng này đã bị xén mất cùng banner đáy thì bỏ qua
        if (origTop >= currentH) continue;

        const pad = 6;
        const patchLeft = Math.max(0, origLeft - pad);
        const patchTop = Math.max(0, origTop - pad);
        const patchW = Math.min(W - patchLeft, origW + pad * 2);
        const patchH = Math.min(currentH - patchTop, origH + pad * 2);

        if (patchW <= 6 || patchH <= 6) continue;

        try {
          // Trích xuất vùng tem dán và làm mờ sâu (blur sigma 22) để hòa tan hoàn toàn logo vào màu thân cột composite
          const patchBuffer = await sharp(currentBuffer)
            .extract({ left: patchLeft, top: patchTop, width: patchW, height: patchH })
            .blur(22)
            .toBuffer();

          overlays.push({
            input: patchBuffer,
            left: patchLeft,
            top: patchTop
          });
        } catch (e) {
          console.warn('[BrandShield 3.8] Lỗi patch vùng tem:', e.message);
        }
      }

      if (overlays.length > 0) {
        currentBuffer = await sharp(currentBuffer)
          .composite(overlays)
          .toBuffer();
        console.log(`[BrandShield 3.8] 🧼 Đã tẩy xóa thành công ${overlays.length} tem nhãn dán trên cột lọc/bồn nước!`);
      }
    }

    // 3. XÉN NHẸ SMART CROP 1.5% VIỀN NGOÀI
    const finalMeta = await sharp(currentBuffer).metadata();
    const cropX = Math.round(finalMeta.width * 0.015);
    const cropY = Math.round(finalMeta.height * 0.015);
    const cropW = Math.round(finalMeta.width * 0.97);
    const cropH = Math.round(finalMeta.height * 0.97);

    const finalBuffer = await sharp(currentBuffer)
      .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
      .webp({ quality: 88, effort: 4 })
      .toBuffer();

    return {
      buffer: finalBuffer,
      width: cropW,
      height: cropH,
      wasCleaned: true
    };
  } catch (err) {
    console.warn('[BrandShield 3.8] Lỗi khi tự động xóa logo:', err.message);
    const fallbackBuffer = await sharp(imageBuffer)
      .webp({ quality: 85 })
      .toBuffer();
    return { buffer: fallbackBuffer, width: 800, height: 600, wasCleaned: false };
  }
}

/**
 * Tải ảnh và rà soát AI Vision + Chống bản quyền 4 lớp
 * TỰ ĐỘNG SOI & XÓA SẠCH LOGO ĐỐI THỦ THAY VÌ BỎ HẲN
 * @param {string} imgUrl URL ảnh nguồn
 * @param {string} referrerUrl URL trang web gốc
 * @param {Object} options
 */
async function downloadAndCleanImage(imgUrl, referrerUrl = '', { strictBrandShield = true, contextText = '' } = {}) {
  try {
    // 0. LỌC NHANH: Chỉ loại bỏ các file icon nhỏ, favicon hoặc avatar
    try {
      const uObj = new URL(imgUrl);
      const pathOnly = uObj.pathname.toLowerCase();
      if (/favicon|avatar|tracking|recaptcha/i.test(pathOnly) || pathOnly.endsWith('.svg') || pathOnly.endsWith('.gif')) {
        return null;
      }
    } catch (e) {}

    const res = await fetch(imgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referrerUrl || imgUrl
      }
    });

    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);
    const meta = await sharp(rawBuffer).metadata();

    // 1. Lọc kích thước tối thiểu (loại bỏ icon, avatar, tracking pixel - giữ lại ảnh sản phẩm từ 220x180 trở lên)
    if (!meta.width || !meta.height || meta.width < 220 || meta.height < 180) {
      return null;
    }

    // 2. RÀ SOÁT AI VISION GEMINI 3.8: Soi từng chi tiết logo, nhãn dán, banner
    const brandCheck = await inspectCompetitorLogo(rawBuffer, { sourceUrl: referrerUrl || imgUrl, contextText });

    let finalBuffer;
    let finalW;
    let finalH;
    let wasAutoCleaned = false;
    let cleanSummary = '';

    if (brandCheck.hasCompetitorLogo) {
      console.log(`[BrandShield 3.8] 🚨 PHÁT HIỆN DẤU VẾT: ${brandCheck.detectedBrands.join(', ')} - ${brandCheck.details}`);
      console.log(`[BrandShield 3.8] 🛠️ BẮT ĐẦU TỰ ĐỘNG SOI & XÓA SẠCH VẾT TÍCH ĐỐI THỦ ĐỂ ĐƯA VÀO HỘP THƯ CHO TRIS DUYỆT!`);

      // TỰ ĐỘNG XÓA LOGO, GỠ TEM CỘT LỌC, CẮT BANNER ĐÁY THEO YÊU CẦU CỦA TRIS:
      const cleanRes = await autoEraseCompetitorBranding(rawBuffer, brandCheck);
      finalBuffer = cleanRes.buffer;
      finalW = cleanRes.width;
      finalH = cleanRes.height;
      wasAutoCleaned = true;
      cleanSummary = `Đã AI 3.8 xóa sạch vết tích ${brandCheck.detectedBrands.join(', ')} (tẩy tem cột lọc & xén banner đáy)`;
    } else {
      // Ảnh sạch sẵn: Xén mép viền nhẹ 2%
      const cropX = Math.round(meta.width * 0.02);
      const cropY = Math.round(meta.height * 0.02);
      finalW = Math.round(meta.width * 0.96);
      finalH = Math.round(meta.height * 0.96);

      finalBuffer = await sharp(rawBuffer)
        .extract({ left: cropX, top: cropY, width: finalW, height: finalH })
        .webp({ quality: 88, effort: 4 })
        .toBuffer();
    }

    // 3. TỰ ĐỘNG LẤY & GHÉP LOGO THƯƠNG HIỆU CỦA ANH THEO CẤU HÌNH:
    let wasLogoStamped = false;
    const logoOverlayRes = await overlayCustomBrandLogo(finalBuffer, { brandCheck });
    if (logoOverlayRes.stamped) {
      finalBuffer = logoOverlayRes.buffer;
      wasLogoStamped = true;
      cleanSummary = cleanSummary ? `${cleanSummary} + 💎 Đã ghép Logo của anh` : '💎 Đã tự động ghép Logo của anh';
      console.log(`[BrandLogo] ✨ Đã tự động ghép logo của Tris vào ảnh (${logoOverlayRes.position})!`);
    }

    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(2, 7);
    const filename = `crawled_${timestamp}_${rand}.webp`;
    const destPath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(destPath, finalBuffer);

    return {
      filename,
      url: `/uploads/${filename}`,
      width: finalW,
      height: finalH,
      sizeBytes: fs.statSync(destPath).size,
      brandCheck,
      wasAutoCleaned,
      wasLogoStamped,
      cleanSummary
    };
  } catch (err) {
    return null;
  }
}

// Trích xuất toàn bộ ảnh hợp lệ từ chuỗi HTML
function extractImagesFromHtml(html, pageUrl, pageTitle = '', metaDesc = '') {
  const candidates = [];
  const seenSrc = new Set();
  const u = new URL(pageUrl);

  const imgRegex = /<img[^>]+>/gi;
  let imgTag;
  while ((imgTag = imgRegex.exec(html)) !== null) {
    const tag = imgTag[0];
    const srcMatch = tag.match(/(?:data-src|data-lazy-src|data-original|src)=[\"']([^\"']+)[\"']/i);
    if (!srcMatch) continue;

    let src = srcMatch[1].trim();
    if (src.includes(',')) {
      src = src.split(',')[0].trim().split(' ')[0];
    }

    let fullUrl = '';
    try {
      fullUrl = new URL(src, pageUrl).href;
    } catch (e) {
      continue;
    }

    if (seenSrc.has(fullUrl)) continue;
    seenSrc.add(fullUrl);

    const lower = fullUrl.toLowerCase();
    if (
      lower.includes('logo') || 
      lower.includes('icon') || 
      lower.includes('avatar') ||
      lower.includes('favicon') ||
      lower.endsWith('.svg') || 
      lower.endsWith('.gif') ||
      lower.includes('tracking') ||
      lower.includes('badge')
    ) {
      continue;
    }

    let alt = '';
    const altMatch = tag.match(/alt=[\"']([^\"']*)[\"']/i);
    if (altMatch) alt = altMatch[1].trim();

    candidates.push({
      imgUrl: fullUrl,
      alt,
      contextText: `${pageTitle} ${metaDesc} ${alt} ${src}`
    });
  }

  return candidates;
}

// Trích xuất các link bài viết chi tiết / sản phẩm con và link phân trang từ trang danh mục
function extractMediaSubLinks(html, currentUrl) {
  const subLinks = [];
  const pageLinks = [];
  const seen = new Set();
  seen.add(currentUrl);

  const u = new URL(currentUrl);
  const origin = u.origin;
  const currentPath = u.pathname.replace(/\/+$/, '');

  const aRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  const blacklistPatterns = [
    '/gioi-thieu', '/lien-he', '/chinh-sach', '/dieu-khoan', '/cart', '/gio-hang',
    '/checkout', '/thanh-toan', '/login', '/dang-nhap', '/register', '/tai-khoan',
    'zalo.me', 'facebook.com', 'youtube.com', 'tel:', 'mailto:', 'javascript:', '#'
  ];

  while ((match = aRegex.exec(html)) !== null) {
    let href = match[1].trim();
    if (!href) continue;

    if (href.startsWith('//')) href = `${u.protocol}${href}`;
    else if (href.startsWith('/')) href = `${origin}${href}`;
    else if (!href.startsWith('http')) {
      href = new URL(href, currentUrl).href;
    }

    try {
      const parsed = new URL(href);
      if (parsed.hostname !== u.hostname) continue;
      const lowerHref = href.toLowerCase();

      if (blacklistPatterns.some(p => lowerHref.includes(p))) continue;

      // Phân trang: Hỗ trợ đa dạng format tiếng Việt, WP, custom CMS
      const isPagination = 
        /\/(?:page|trang|paged)[/-]\d+/i.test(lowerHref) || 
        /\/(?:page|trang)\/\d+/i.test(lowerHref) || 
        /[?&](?:page|paged|p|trang)=\d+/i.test(lowerHref);

      if (isPagination) {
        if (!seen.has(href)) {
          seen.add(href);
          pageLinks.push(href);
        }
        continue;
      }

      // Link bài viết hoặc sản phẩm con
      const itemPath = parsed.pathname.replace(/\/+$/, '');
      if (itemPath === currentPath) continue;

      const title = match[2].replace(/<[^>]+>/g, '').trim();
      if (title.length >= 10 && !seen.has(href)) {
        seen.add(href);
        subLinks.push(href);
      }
    } catch (e) {}
  }

  return { subLinks, pageLinks };
}

/**
 * Cào ảnh sâu đa tầng: Hỗ trợ quét cả ảnh trên trang chính, ảnh từ các bài viết/sản phẩm con và qua các trang phân trang
 * @param {string} targetUrl URL cần cào
 * @param {Object} [options]
 * @param {boolean} [options.strictBrandShield=true] Tự động chặn ảnh dính logo đối thủ
 * @param {boolean} [options.deepCrawl=true] Tự động quét sâu vào các bài viết con / trang phân trang
 * @param {number} [options.maxImages=40] Số lượng ảnh tối đa cần thu thập
 * @param {number} [options.maxSubPages=15] Số trang con tối đa cần đào sâu
 * @param {number} [options.maxPaginationPages=5] Số trang phân trang tối đa cần đào sâu
 */
async function harvestImagesFromUrl(targetUrl, { strictBrandShield = true, deepCrawl = true, maxImages = 40, maxSubPages = 15, maxPaginationPages = 5 } = {}) {
  initStaging();
  if (!targetUrl || !targetUrl.startsWith('http')) {
    throw new Error('URL không hợp lệ');
  }

  console.log(`[MediaHarvester] 🔍 Bắt đầu cào ảnh: ${targetUrl} (DeepCrawl: ${deepCrawl}, MaxImages: ${maxImages}, MaxSubPages: ${maxSubPages})`);

  const res = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  if (!res.ok) {
    throw new Error(`Không thể kết nối tới URL (Status: ${res.status})`);
  }

  const html = await res.text();

  let rawPageTitle = '';
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) rawPageTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();

  let metaDesc = '';
  const descMatch = html.match(/<meta[^>]+name=[\"']description[\"'][^>]+content=[\"']([^\"']+)[\"']/i) ||
                    html.match(/<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+name=[\"']description[\"']/i);
  if (descMatch) metaDesc = descMatch[1].trim();

  const pageTitle = sanitizeCompetitorText(rawPageTitle);

  // 1. Trích xuất ảnh ngay trên trang hiện tại
  const candidates = extractImagesFromHtml(html, targetUrl, pageTitle, metaDesc);
  const seenCandidateUrls = new Set(candidates.map(c => c.imgUrl));
  let subPagesScanned = 0;

  // 2. Nếu bật Deep Crawl: quét thêm ảnh từ các bài viết/sản phẩm con và phân trang
  if (deepCrawl) {
    const { subLinks: initialSubLinks, pageLinks: initialPageLinks } = extractMediaSubLinks(html, targetUrl);
    
    // Thu thập thêm bài viết con từ các trang phân trang
    const allSubLinks = [...initialSubLinks];
    const seenSubLinks = new Set(initialSubLinks);
    const pagesToScan = initialPageLinks.slice(0, maxPaginationPages);

    console.log(`[MediaHarvester] 📂 Phát hiện ${initialSubLinks.length} bài viết con & ${initialPageLinks.length} trang phân trang.`);

    // Quét phân trang để gom thêm bài viết con
    for (const pageUrl of pagesToScan) {
      if (allSubLinks.length >= maxSubPages * 2) break;
      try {
        const pRes = await fetch(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          signal: AbortSignal.timeout(10000)
        });
        if (pRes.ok) {
          const pHtml = await pRes.text();
          const pSub = extractMediaSubLinks(pHtml, pageUrl);
          pSub.subLinks.forEach(sl => {
            if (!seenSubLinks.has(sl)) {
              seenSubLinks.add(sl);
              allSubLinks.push(sl);
            }
          });
          // Đồng thời gom ảnh trên trang phân trang này
          const pageImages = extractImagesFromHtml(pHtml, pageUrl, pageTitle, metaDesc);
          pageImages.forEach(img => {
            if (!seenCandidateUrls.has(img.imgUrl)) {
              seenCandidateUrls.add(img.imgUrl);
              candidates.push(img);
            }
          });
          subPagesScanned++;
        }
      } catch (e) {
        console.warn(`[MediaHarvester] Bỏ qua phân trang lỗi ${pageUrl}:`, e.message);
      }
    }

    const targetSubLinks = allSubLinks.slice(0, maxSubPages);
    console.log(`[MediaHarvester] 🚀 Đang đào sâu vào ${targetSubLinks.length} bài viết/sản phẩm chi tiết để lấy ảnh nét...`);

    // Quét sâu vào từng bài viết theo batch 3
    for (let i = 0; i < targetSubLinks.length; i += 3) {
      if (candidates.length >= maxImages * 3) break; // Đã gom thừa mứa ảnh dự phòng
      const batch = targetSubLinks.slice(i, i + 3);
      await Promise.all(batch.map(async (subUrl) => {
        try {
          const subRes = await fetch(subUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(10000)
          });
          if (subRes.ok) {
            const subHtml = await subRes.text();
            let subTitle = '';
            const stm = subHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            if (stm) subTitle = sanitizeCompetitorText(stm[1].replace(/<[^>]+>/g, '').trim());

            const subImages = extractImagesFromHtml(subHtml, subUrl, subTitle || pageTitle, metaDesc);
            subImages.forEach(img => {
              if (!seenCandidateUrls.has(img.imgUrl)) {
                seenCandidateUrls.add(img.imgUrl);
                candidates.push(img);
              }
            });
            subPagesScanned++;
          }
        } catch (e) {
          console.warn(`[MediaHarvester] Bỏ qua bài viết con lỗi ${subUrl}:`, e.message);
        }
      }));
    }
  }

  console.log(`[MediaHarvester] 🎯 Tìm thấy tổng cộng ${candidates.length} ảnh ứng viên. Đang rà soát AI Vision nghiêm ngặt...`);

  const stagingList = getStagingMedia();
  const existingUrls = new Set(stagingList.map(s => s.originalUrl));
  const newlyHarvested = [];
  const rejectedByLogo = [];
  let autoCleanedCount = 0;

  // 3. Tải và xử lý ảnh (Lấy tối đa maxImages ảnh sạch)
  for (const item of candidates) {
    if (newlyHarvested.length >= maxImages) break;
    if (existingUrls.has(item.imgUrl)) continue; // Tránh cào trùng

    // Throttling: Delay 1.2s giữa mỗi ảnh để tránh chạm trần Rate Limit
    await new Promise(r => setTimeout(r, 1200));

    const result = await downloadAndCleanImage(item.imgUrl, targetUrl, { 
      strictBrandShield,
      contextText: item.contextText || ''
    });
    if (!result) continue;

    if (result.rejected) {
      rejectedByLogo.push({
        url: item.imgUrl,
        reason: result.reason,
        detectedBrands: result.detectedBrands
      });
      continue;
    }

    if (result.wasAutoCleaned) {
      autoCleanedCount++;
    }

    const cleanAlt = sanitizeCompetitorText(item.alt || pageTitle);
    const cleanPageTitle = sanitizeCompetitorText(pageTitle);
    const analysis = analyzeImageContext(item.contextText);

    const stagingItem = {
      id: `stage_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      url: result.url,
      originalUrl: item.imgUrl,
      sourcePageUrl: targetUrl,
      pageTitle: cleanPageTitle.slice(0, 120),
      alt: cleanAlt.slice(0, 80) || 'Hệ thống lọc nước Hoa Sen',
      suggestedKho: analysis.suggestedKho,
      suggestedKhoName: analysis.suggestedKhoName,
      reason: analysis.reason,
      hasCompetitorLogo: false, // Đã được AI Vision xóa sạch vết tích
      wasAutoCleaned: result.wasAutoCleaned || false,
      wasLogoStamped: result.wasLogoStamped || false,
      cleanSummary: result.cleanSummary || '',
      brandCheckDetails: result.cleanSummary || (result.brandCheck ? result.brandCheck.details : 'Ảnh sạch an toàn'),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    stagingList.unshift(stagingItem);
    newlyHarvested.push(stagingItem);
    existingUrls.add(item.imgUrl);
  }

  saveStagingMedia(stagingList);
  console.log(`[MediaHarvester] ✅ Đã nạp thành công ${newlyHarvested.length} ảnh vào Hộp Thư Xét Duyệt (Trong đó ${autoCleanedCount} ảnh đã được AI 3.8 xóa sạch logo/tem dán)`);

  return {
    totalFound: candidates.length,
    pagesScanned: 1 + subPagesScanned,
    harvestedCount: newlyHarvested.length,
    autoCleanedCount,
    rejectedByLogoCount: rejectedByLogo.length,
    rejectedByLogo,
    items: newlyHarvested
  };
}

/**
 * Xét duyệt ảnh vào Kho chỉ định
 */
function approveImageToKho(stagingId, targetKho = null) {
  const stagingList = getStagingMedia();
  const item = stagingList.find(x => x.id === stagingId);
  if (!item) throw new Error('Không tìm thấy ảnh xét duyệt');

  const chosenKho = targetKho || item.suggestedKho || 'kho_1';
  const khoFile = KHO_FILES[chosenKho];
  if (!khoFile || !fs.existsSync(khoFile)) {
    throw new Error(`Kho ${chosenKho} không tồn tại`);
  }

  const khoList = JSON.parse(fs.readFileSync(khoFile, 'utf8') || '[]');

  const newMedia = {
    id: `media_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    url: item.url,
    tagKeyword: sanitizeCompetitorText(item.alt || item.pageTitle || 'Lọc Nước Hoa Sen'),
    filename: path.basename(item.url),
    createdAt: new Date().toISOString(),
    kho: chosenKho,
    categoryName: KHO_NAMES[chosenKho]
  };

  khoList.unshift(newMedia);
  fs.writeFileSync(khoFile, JSON.stringify(khoList, null, 2), 'utf8');

  item.status = 'approved';
  item.approvedKho = chosenKho;
  item.approvedAt = new Date().toISOString();

  saveStagingMedia(stagingList);

  return { success: true, media: newMedia, khoName: KHO_NAMES[chosenKho] };
}

/**
 * Xóa sạch toàn bộ hoặc một phần danh sách Hộp Thư Xét Duyệt
 */
function clearStagingMedia(type = 'all') {
  initStaging();
  if (type === 'all') {
    fs.writeFileSync(STAGING_FILE, JSON.stringify([], null, 2), 'utf8');
    return { success: true, message: 'Đã dọn sạch toàn bộ Hộp Thư Xét Duyệt!' };
  }
  let stagingList = getStagingMedia();
  if (type === 'approved') {
    stagingList = stagingList.filter(x => x.status !== 'approved');
  } else if (type === 'pending') {
    stagingList = stagingList.filter(x => x.status !== 'pending');
  }
  saveStagingMedia(stagingList);
  return { success: true, remainingCount: stagingList.length };
}

/**
 * Từ chối / Xóa ảnh khỏi staging
 */
function rejectStagingImage(stagingId) {
  let stagingList = getStagingMedia();
  const item = stagingList.find(x => x.id === stagingId);
  if (!item) return { success: false };

  try {
    const abs = path.join(BASE_DIR, 'public', item.url.replace(/^\//, ''));
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) {}

  stagingList = stagingList.filter(x => x.id !== stagingId);
  saveStagingMedia(stagingList);

  return { success: true };
}

/**
 * Duyệt tất cả ảnh pending theo đúng gợi ý thông minh của AI
 */
function approveAllPendingImages() {
  const stagingList = getStagingMedia();
  const pending = stagingList.filter(x => x.status === 'pending');
  let approvedCount = 0;

  pending.forEach(item => {
    try {
      approveImageToKho(item.id, item.suggestedKho);
      approvedCount++;
    } catch (e) {}
  });

  return { approvedCount, remainingCount: stagingList.filter(x => x.status === 'pending').length };
}

/**
 * Quét rà soát toàn bộ một Kho ảnh cụ thể để phát hiện ảnh dính logo đối thủ
 * @param {string} khoId 'kho_1' | 'kho_2' | 'kho_3'
 * @param {number} limit Số ảnh quét tối đa mỗi lần
 * @param {boolean} purgeFlagged Có tự động loại bỏ các ảnh vi phạm khỏi kho hay không
 */
async function auditWarehouseLogos(khoId = 'kho_1', limit = 20, purgeFlagged = false) {
  const targetFile = KHO_FILES[khoId];
  if (!targetFile || !fs.existsSync(targetFile)) {
    throw new Error(`Không tìm thấy ${khoId}`);
  }

  const list = JSON.parse(fs.readFileSync(targetFile, 'utf8') || '[]');
  const flagged = [];
  const flaggedIds = new Set();

  for (const item of list.slice(0, limit)) {
    const absPath = path.join(BASE_DIR, 'public', item.url.replace(/^\//, ''));
    if (!fs.existsSync(absPath)) continue;

    const buffer = fs.readFileSync(absPath);
    const check = await inspectCompetitorLogo(buffer, { contextText: item.tagKeyword || '' });

    if (check.hasCompetitorLogo) {
      flagged.push({
        id: item.id,
        url: item.url,
        tagKeyword: item.tagKeyword,
        detectedBrands: check.detectedBrands,
        details: check.details
      });
      flaggedIds.add(item.id);
    }

    // Delay 1.2s giữa mỗi ảnh để tránh chạm trần Rate Limit
    await new Promise(r => setTimeout(r, 1200));
  }

  if (purgeFlagged && flaggedIds.size > 0) {
    const remaining = list.filter(item => !flaggedIds.has(item.id));
    fs.writeFileSync(targetFile, JSON.stringify(remaining, null, 2), 'utf8');
    console.log(`[BrandShield Audit] 🗑️ Đã tự động loại bỏ ${flaggedIds.size} ảnh vi phạm logo đối thủ khỏi ${khoId}!`);
  }

  return {
    kho: khoId,
    totalScanned: Math.min(list.length, limit),
    flaggedCount: flagged.length,
    purgedCount: purgeFlagged ? flaggedIds.size : 0,
    flaggedItems: flagged
  };
}

function getSerperApiKey() {
  try {
    if (fs.existsSync(GOOGLE_CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(GOOGLE_CONFIG_FILE, 'utf8') || '{}');
      return cfg.serperApiKey || (cfg.googleApiKey && cfg.googleApiKey.length === 40 ? cfg.googleApiKey : '');
    }
  } catch (e) {}
  return '';
}

function getHarvesterSources() {
  try {
    if (!fs.existsSync(SOURCES_FILE)) {
      return [];
    }
    return JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8') || '[]');
  } catch (e) {
    return [];
  }
}

function saveHarvesterSources(sources) {
  try {
    fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2), 'utf8');
  } catch (e) {
    console.error('Lỗi lưu harvester_sources:', e);
  }
}

function toggleHarvesterSource(id, active) {
  const list = getHarvesterSources();
  const idx = list.findIndex(s => s.id === id);
  if (idx !== -1) {
    list[idx].active = active !== undefined ? active : !list[idx].active;
    saveHarvesterSources(list);
    return list[idx];
  }
  throw new Error(`Không tìm thấy nguồn ${id}`);
}

function addHarvesterSource({ name, domain, urls, khoBias = 'kho_1' }) {
  const list = getHarvesterSources();
  const id = 'src_' + Date.now().toString(36);
  const cleanUrls = (Array.isArray(urls) ? urls : [urls]).map(u => u.trim()).filter(Boolean);

  const newSource = {
    id,
    name: name || domain,
    domain: domain || (cleanUrls[0] ? new URL(cleanUrls[0]).hostname : 'competitor'),
    active: true,
    urls: cleanUrls,
    khoBias,
    lastHarvestedAt: null,
    stats: { totalHarvested: 0, rejectedLogos: 0 }
  };

  list.push(newSource);
  saveHarvesterSources(list);
  return newSource;
}

/**
 * Tìm kiếm ảnh ngành lọc nước trực tiếp trên Google Serper Images API
 */
function querySerperImages(query, limit = 8) {
  const apiKey = getSerperApiKey();
  if (!apiKey) return Promise.resolve([]);

  return new Promise((resolve) => {
    const payload = JSON.stringify({ q: query, gl: 'vn', hl: 'vi', num: limit });
    const req = https.request({
      hostname: 'google.serper.dev',
      path: '/images',
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json.images || []);
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on('error', (err) => {
      console.warn('[Serper Images] Request error:', err.message);
      resolve([]);
    });
    req.on('timeout', () => { req.destroy(); resolve([]); });
    req.write(payload);
    req.end();
  });
}

/**
 * TỰ ĐỘNG TÌM KIẾM & CÀO ẢNH THEO TỪ KHÓA KỸ THUẬT
 * @param {string|string[]} keywords Từ khóa tìm kiếm
 * @param {Object} options
 */
async function searchAndHarvestByKeywords(keywords, { maxImages = 6, strictBrandShield = true } = {}) {
  initStaging();
  const searchTerms = Array.isArray(keywords) ? keywords : [keywords];
  const stagingList = getStagingMedia();
  const newlyHarvested = [];
  const rejectedByLogo = [];

  for (const rawTerm of searchTerms) {
    if (newlyHarvested.length >= maxImages) break;
    const term = rawTerm.trim();
    if (!term) continue;

    const query = term.toLowerCase().includes('lọc nước') ? `${term} thực tế lắp đặt` : `lọc nước ${term} thực tế lắp đặt`;
    console.log(`[AutoSearch] 🔍 Đang quét Google Images cho: "${query}"...`);
    const serperImages = await querySerperImages(query, 10);

    for (const item of serperImages) {
      if (newlyHarvested.length >= maxImages) break;
      if (!item.imageUrl || !item.imageUrl.startsWith('http')) continue;

      const lower = item.imageUrl.toLowerCase();
      if (lower.includes('logo') || lower.includes('icon') || lower.endsWith('.svg') || lower.endsWith('.gif')) {
        continue;
      }

      // Tránh cào trùng ảnh đã có trong staging
      if (stagingList.some(s => s.originalUrl === item.imageUrl)) continue;

      const contextText = `${item.title || ''} ${term} ${item.source || ''}`;
      const result = await downloadAndCleanImage(item.imageUrl, item.link || '', { strictBrandShield, contextText });
      if (!result) continue;

      if (result.rejected) {
        rejectedByLogo.push({
          url: item.imageUrl,
          reason: result.reason,
          detectedBrands: result.detectedBrands
        });
        continue;
      }

      const context = analyzeImageContext(`${item.title || ''} ${term} ${item.source || ''}`);
      const stagingItem = {
        id: `stage_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        url: result.url,
        originalUrl: item.imageUrl,
        sourcePageUrl: item.link || '',
        pageTitle: item.title || term,
        alt: item.title || term,
        suggestedKho: context.suggestedKho,
        suggestedKhoName: context.suggestedKhoName,
        reason: context.reason,
        hasCompetitorLogo: false,
        wasAutoCleaned: result.wasAutoCleaned || false,
        wasLogoStamped: result.wasLogoStamped || false,
        cleanSummary: result.cleanSummary || '',
        brandCheckDetails: result.cleanSummary || result.brandCheckDetails || 'Đã kiểm tra sạch logo đối thủ qua AI Vision',
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      stagingList.unshift(stagingItem);
      newlyHarvested.push(stagingItem);
    }
  }

  saveStagingMedia(stagingList);
  return {
    success: true,
    harvestedCount: newlyHarvested.length,
    rejectedByLogoCount: rejectedByLogo.length,
    harvested: newlyHarvested,
    rejectedByLogo
  };
}

/**
 * TỰ ĐỘNG RÀ SOÁT TẤT CẢ NGUỒN ĐỐI THỦ TRONG DANH MỤC
 * Tris chỉ cần bấm 1 nút hoặc để hệ thống tự động chạy ngầm!
 */
async function runAutonomousIndustryHarvest({ sourceId = null, maxPerSource = 3, strictBrandShield = true } = {}) {
  const sources = getHarvesterSources();
  const targetSources = sourceId 
    ? sources.filter(s => s.id === sourceId) 
    : sources.filter(s => s.active !== false);

  let totalHarvested = 0;
  let totalRejectedByLogo = 0;
  const reports = [];

  for (const src of targetSources) {
    let srcHarvested = 0;
    let srcRejected = 0;

    console.log(`[AutonomousHarvester] 🚀 Đang rà soát nguồn: ${src.name} (${src.domain})...`);
    for (const pageUrl of (src.urls || []).slice(0, 2)) {
      if (srcHarvested >= maxPerSource) break;
      try {
        const res = await harvestImagesFromUrl(pageUrl, { strictBrandShield });
        srcHarvested += res.harvestedCount || 0;
        srcRejected += res.rejectedByLogoCount || 0;
      } catch (err) {
        console.warn(`[AutonomousHarvester] Bỏ qua trang lỗi ${pageUrl}:`, err.message);
      }
    }

    src.lastHarvestedAt = new Date().toISOString();
    src.stats = src.stats || { totalHarvested: 0, rejectedLogos: 0 };
    src.stats.totalHarvested = (src.stats.totalHarvested || 0) + srcHarvested;
    src.stats.rejectedLogos = (src.stats.rejectedLogos || 0) + srcRejected;

    totalHarvested += srcHarvested;
    totalRejectedByLogo += srcRejected;

    reports.push({
      sourceId: src.id,
      sourceName: src.name,
      domain: src.domain,
      harvested: srcHarvested,
      rejected: srcRejected
    });
  }

  saveHarvesterSources(sources);

  return {
    success: true,
    totalSourcesScanned: targetSources.length,
    totalHarvested,
    totalRejectedByLogo,
    reports
  };
}

module.exports = {
  harvestImagesFromUrl,
  getStagingMedia,
  approveImageToKho,
  rejectStagingImage,
  approveAllPendingImages,
  analyzeImageContext,
  inspectCompetitorLogo,
  stampHoaSenBrandBadge,
  auditWarehouseLogos,
  clearStagingMedia,
  sanitizeCompetitorText,
  getHarvesterSources,
  saveHarvesterSources,
  toggleHarvesterSource,
  addHarvesterSource,
  searchAndHarvestByKeywords,
  runAutonomousIndustryHarvest,
  getBrandLogoConfig,
  saveBrandLogoConfig,
  saveCustomBrandLogoFile,
  deleteCustomBrandLogoFile,
  overlayCustomBrandLogo,
  downloadAndCleanImage
};
