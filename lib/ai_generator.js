/**
 * AI Content Generator — Gemini-powered unique SEO article generation
 * Mỗi bài sinh ra là unique content thật, không dùng template clone
 */

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_FILE = path.join(__dirname, '../data/gemini.json');
const POSTS_FILE = path.join(__dirname, '../data/posts.json');

function getGeminiKey() {
  try {
    const cfg = JSON.parse(fs.readFileSync(GEMINI_FILE, 'utf-8'));
    return cfg.apiKey || '';
  } catch (e) { return ''; }
}

function getPosts() {
  try { return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8') || '[]'); }
  catch (e) { return []; }
}

/**
 * Detect tất cả các nhóm bài có targetKeyword giống nhau
 * và content cosine-similarity cao (dùng length + first-500chars so sánh)
 */
function detectDuplicateGroups() {
  const posts = getPosts();
  const groups = {};

  posts.forEach(p => {
    const k = (p.targetKeyword || '').trim().toLowerCase();
    if (!k) return;
    if (!groups[k]) groups[k] = [];
    groups[k].push(p);
  });

  const duplicateGroups = [];
  Object.entries(groups).forEach(([kw, postList]) => {
    if (postList.length < 2) return;

    // Kiểm tra content similarity bằng cách so sánh first 300 chars của body
    const normalized = postList.map(p => ({
      ...p,
      _bodyStart: (p.content || '').replace(/^#.*\n/, '').trim().substring(0, 300)
    }));

    // Group by very similar body starts (first 200 chars trong phần body chính)
    const similarGroups = [];
    const seen = new Set();

    normalized.forEach((p, i) => {
      if (seen.has(p.id)) return;
      const similar = [p];
      seen.add(p.id);

      normalized.forEach((q, j) => {
        if (i === j || seen.has(q.id)) return;
        const similarity = computeSimilarity(p._bodyStart, q._bodyStart);
        if (similarity > 0.65) {
          similar.push(q);
          seen.add(q.id);
        }
      });

      if (similar.length > 1) similarGroups.push({ keyword: kw, posts: similar });
    });

    if (similarGroups.length > 0) duplicateGroups.push(...similarGroups);
  });

  return duplicateGroups;
}

/**
 * Simple Jaccard similarity on word trigrams
 */
function computeSimilarity(a, b) {
  if (!a || !b) return 0;
  const trigrams = (s) => {
    const words = s.toLowerCase().split(/\s+/);
    const tg = new Set();
    for (let i = 0; i < words.length - 2; i++) {
      tg.add(words[i] + ' ' + words[i+1] + ' ' + words[i+2]);
    }
    return tg;
  };
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  const intersection = [...ta].filter(x => tb.has(x)).length;
  const union = new Set([...ta, ...tb]).size;
  return intersection / union;
}

/**
 * Build SEO prompt cho Gemini — tạo bài unique, tránh trùng existing content
 */
function buildSeoPrompt(keyword, title, targetProductUrl, existingContents = []) {
  const avoidSnippets = existingContents
    .slice(0, 3)
    .map(c => c.substring(0, 200))
    .join('\n---\n');

  return `Bạn là chuyên gia SEO Content cho công ty Lọc Nước Hoa Sen (xulynuochoasen.com), chuyên về hệ thống lọc nước sạch.

NHIỆM VỤ: Viết bài SEO chuẩn hoàn chỉnh cho từ khóa "**${keyword}**" với tiêu đề đã được chọn: **"${title}"**

YÊU CẦU BẮT BUỘC:
- Bài dài 900-1200 từ, bằng tiếng Việt
- Có H2 headings rõ ràng (dùng ## trong Markdown)
- Chèn từ khóa "${keyword}" tự nhiên 8-12 lần trong bài
- Có 1 bảng so sánh (dùng Markdown table)
- Có phần FAQ cuối bài (3 câu hỏi thực tế)
- Chèn đúng 2 hình ảnh placeholder: [IMAGE_1] và [IMAGE_2] vào đúng 2 vị trí trong bài (sau đoạn intro và sau section đầu tiên)
- Kết thúc bằng call-to-action link: [Xem Sản Phẩm Tương Ứng](${targetProductUrl})
- Văn phong: chuyên gia kỹ thuật, thuyết phục, chuẩn SEO
- KHÔNG viết tiêu đề H1 ở đầu (đã có tiêu đề rồi)

CỰC KỲ QUAN TRỌNG — NỘI DUNG PHẢI HOÀN TOÀN KHÁC VỚI CÁC ĐOẠN SAU:
${avoidSnippets ? avoidSnippets : '(chưa có bài trước)'}

Hãy viết bài với góc độ, cấu trúc sections và ví dụ thực tế KHÁC HOÀN TOÀN so với các đoạn trên.
Bắt đầu ngay vào nội dung, không cần giải thích.`;
}

/**
 * Generate một bài SEO unique bằng Gemini
 * @param {string} keyword - target keyword
 * @param {string} title - tiêu đề đã được chọn  
 * @param {string} img1 - URL ảnh 1
 * @param {string} img2 - URL ảnh 2
 * @param {string} targetProductUrl - link sản phẩm
 * @param {string[]} existingContents - các content bài cùng keyword để tránh trùng
 * @returns {Promise<string>} - markdown content
 */
async function generateAiContent(keyword, title, img1, img2, targetProductUrl, existingContents = []) {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error('Chưa có Gemini API key trong data/gemini.json');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  const prompt = buildSeoPrompt(keyword, title, targetProductUrl, existingContents);
  const result = await model.generateContent(prompt);
  let rawContent = result.response.text();

  // Inject hình ảnh thật vào placeholder
  const imgMarkdown1 = img1
    ? `[![Hình ảnh ${keyword} chuyên nghiệp](${img1})](${targetProductUrl})`
    : '';
  const imgMarkdown2 = img2
    ? `[![Chi tiết hệ thống ${keyword}](${img2})](${targetProductUrl})`
    : '';

  rawContent = rawContent.replace('[IMAGE_1]', imgMarkdown1 || '');
  rawContent = rawContent.replace('[IMAGE_2]', imgMarkdown2 || '');

  // Thêm schema FAQ và CTA card chuẩn
  const ctaBlock = `

---

👉 **Sản Phẩm Đúng Chuyên Mục:** [Xem Sản Phẩm Tương Ứng](${targetProductUrl}) - *Giải pháp kỹ thuật chuyên sâu đạt chuẩn Bộ Y Tế.*

<div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px; padding: 24px; color: #ffffff; margin: 30px 0; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.3); border: 1px solid #334155; text-align: center;">
  <h3 style="color: #38bdf8; margin-top: 0; font-size: 1.4em; font-weight: 700;">📞 CÔNG TY CỔ PHẦN THIÊN NHIÊN VÀ MÔI TRƯỜNG HOA SEN</h3>
  <p style="color: #cbd5e1; font-size: 1.05em; margin-bottom: 18px;">Chuyên gia giải pháp xử lý <strong>${keyword}</strong> chuyên sâu đạt chuẩn Bộ Y Tế trên toàn quốc.</p>
  <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 15px;">
    <a href="tel:0938880492" style="background: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 30px; text-decoration: none; font-weight: bold;">📱 Hotline: 0938 880 492</a>
    <a href="https://zalo.me/0938880492" target="_blank" rel="noopener" style="background: #0284c7; color: #ffffff; padding: 12px 24px; border-radius: 30px; text-decoration: none; font-weight: bold;">💬 Zalo 24/7: 0938 880 492</a>
  </div>
  <p style="font-size: 0.9em; color: #94a3b8; margin: 0;">📍 <em>Khảo sát & xét nghiệm mẫu nước tận nơi miễn phí tại TP.HCM, Bình Dương, Đồng Nai, Long An và toàn miền Nam.</em></p>
</div>`;

  return rawContent + ctaBlock;
}

/**
 * Tìm tất cả bài bị duplicate content và trả về report
 */
function getDuplicateReport() {
  const groups = detectDuplicateGroups();
  const allPosts = getPosts();

  return {
    totalPosts: allPosts.length,
    duplicateGroups: groups.map(g => ({
      keyword: g.keyword,
      count: g.posts.length,
      posts: g.posts.map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        wpPublished: p.wpPublished || false,
        wpLink: p.wpLink || null,
        contentLength: (p.content || '').length
      }))
    })),
    totalDuplicatePosts: groups.reduce((sum, g) => sum + g.posts.length, 0)
  };
}

module.exports = {
  generateAiContent,
  getDuplicateReport,
  detectDuplicateGroups,
  computeSimilarity
};
