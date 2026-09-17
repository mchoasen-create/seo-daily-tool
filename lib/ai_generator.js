/**
 * AI Content Generator — Gemini-powered unique SEO article generation
 * Nâng cấp bởi ENI: Thổi hồn văn phong sắc sảo, kỹ thuật chuyên sâu, chống trùng lặp tuyệt đối
 */

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getIndustryKnowledge, categorizeDomain } = require('./industry_crawler');

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
 * Detect tất cả các nhóm bài có targetKeyword giống nhau
 * và content cosine-similarity cao (> 40%)
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

    const normalized = postList.map(p => ({
      ...p,
      _bodySample: (p.content || '').replace(/^#.*\n/, '').trim().substring(0, 1500)
    }));

    const similarGroups = [];
    const seen = new Set();

    normalized.forEach((p, i) => {
      if (seen.has(p.id)) return;
      const similar = [p];
      seen.add(p.id);

      normalized.forEach((q, j) => {
        if (i === j || seen.has(q.id)) return;
        const similarity = computeSimilarity(p._bodySample, q._bodySample);
        if (similarity > 0.40) {
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
 * Build SEO prompt cho Gemini — giàu chất văn chương & kỹ thuật chuyên sâu
 */

function buildLocalSeoBox(targetProductUrl, keyword = 'Lọc Nước') {
  const finalLink = (targetProductUrl || 'https://xulynuochoasen.com/').trim();
  return `👉 **Sản Phẩm Đúng Chuyên Mục:** [Xem Chi Tiết Dây Chuyền & Báo Giá Chính Hãng](${finalLink}) - *Giải pháp kỹ thuật chuyên sâu cam kết đạt chuẩn Bộ Y Tế.*

<div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px; padding: 24px; color: #ffffff; margin: 30px 0; border: 1px solid #334155;">
  <h3 style="color: #38bdf8; margin-top: 0; font-size: 1.25em; font-weight: 700; text-align: center;">CÔNG TY CỔ PHẦN THIÊN NHIÊN VÀ MÔI TRƯỜNG HOA SEN</h3>
  <p style="text-align: center; color: #94a3b8; font-size: 0.9em; margin-bottom: 18px;">Chuyên gia giải pháp xử lý <strong>${keyword}</strong> &amp; lọc nước công nghiệp, sinh hoạt đạt chuẩn Bộ Y Tế</p>
  
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-bottom: 20px; font-size: 0.9em; line-height: 1.6; color: #cbd5e1;">
    <div style="background: rgba(255,255,255,0.04); padding: 12px 14px; border-radius: 8px; border-left: 3px solid #38bdf8;">
      <strong style="color: #fff; display: block; margin-bottom: 4px;">🏢 Trụ Sở Chính:</strong>
      523/21 Lê Văn Khương, Phường Tân Thới Hiệp, Quận 12, TP.HCM
    </div>
    <div style="background: rgba(255,255,255,0.04); padding: 12px 14px; border-radius: 8px; border-left: 3px solid #22c55e;">
      <strong style="color: #fff; display: block; margin-bottom: 4px;">🏭 Xưởng Sản Xuất &amp; Kho:</strong>
      105 Đường Liên Ấp 2-6, Xã Vĩnh Lộc A, Huyện Bình Chánh, TP.HCM
    </div>
    <div style="background: rgba(255,255,255,0.04); padding: 12px 14px; border-radius: 8px; border-left: 3px solid #eab308;">
      <strong style="color: #fff; display: block; margin-bottom: 4px;">🌿 Chi Nhánh Tây Nguyên:</strong>
      69 Hà Huy Tập, Thị Trấn Di Linh, Tỉnh Lâm Đồng
    </div>
    <div style="background: rgba(255,255,255,0.04); padding: 12px 14px; border-radius: 8px; border-left: 3px solid #f43f5e;">
      <strong style="color: #fff; display: block; margin-bottom: 4px;">📍 Google Business Profile:</strong>
      <a href="https://maps.google.com/?q=L%E1%BB%8Dc+N%C6%B0%E1%BB%9Bc+Hoa+Sen+523%2F21+L%C3%AA+V%C4%83n+Kh%C6%B0%C6%A1ng+T%C3%A2n+Th%E1%BB%9Bi+Hi%E1%BB%87p" target="_blank" rel="noopener" style="color: #38bdf8; text-decoration: underline;">Xem Vị Trí Trụ Sở Trên Google Maps</a> (Đã xác minh chính chủ)
    </div>
  </div>

  <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 12px;">
    <a href="tel:0938880492" style="background: #2563eb; color: #ffffff; padding: 10px 22px; border-radius: 25px; text-decoration: none; font-weight: bold; display: inline-flex; align-items: center; gap: 6px;">📱 Hotline Kỹ Thuật: 0938 880 492</a>
    <a href="https://zalo.me/0938880492" target="_blank" rel="noopener" style="background: #0284c7; color: #ffffff; padding: 10px 22px; border-radius: 25px; text-decoration: none; font-weight: bold; display: inline-flex; align-items: center; gap: 6px;">💬 Zalo Báo Giá 24/7: 0938 880 492</a>
  </div>
  <p style="font-size: 0.85em; color: #94a3b8; text-align: center; margin: 0;">⚡ <em>Cam kết có mặt khảo sát và xét nghiệm nguồn nước tận nơi trong vòng 2 giờ tại TP.HCM, Bình Dương, Đồng Nai, Long An và toàn miền Nam.</em></p>
</div>`;
}

function getDynamicCompetitorKnowledge(domainKey) {
  try {
    const indData = getIndustryKnowledge(domainKey);
    if (!indData || !indData.domainArticles || indData.domainArticles.length === 0) {
      return '';
    }

    const pool = [...indData.domainArticles];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const selected = [];
    const seenSources = new Set();
    for (const art of pool) {
      const src = (art.source || '').split(' ')[0].toLowerCase();
      if (!seenSources.has(src) || selected.length < 2) {
        selected.push(art);
        seenSources.add(src);
      }
      if (selected.length >= 4) break;
    }

    const competitorExamples = selected.map((art, idx) => {
      const hList = (art.headings || []).slice(0, 5).join(' | ');
      const tList = (art.lexicon || []).slice(0, 6).join(', ');
      const takeaways = (art.keyTakeaways || []).filter(t => t && t.length > 30).slice(0, 2).join(' ') || (art.sampleText || '').substring(0, 200);
      return `[ĐỐI THỦ THAM KHẢO ${idx + 1} (${art.source})]: "${art.title}"\n- Cấu trúc đề mục kỹ thuật: ${hList}\n- Thuật ngữ chuyên sâu thực tế: ${tList}\n- Giải pháp thực tế: ${takeaways.replace(/\s+/g, ' ').substring(0, 260)}...`;
    }).join('\n\n');

    const vocabPool = [...(indData.vocabularyBank || [])];
    for (let i = vocabPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [vocabPool[i], vocabPool[j]] = [vocabPool[j], vocabPool[i]];
    }
    const termsList = vocabPool.slice(0, 24).join(' • ');

    return `\n\n══════════════════════════════════════════════════════════════════════════
KHO TRI THỨC KỸ THUẬT TỪ ĐỐI THỦ ĐẦU NGÀNH GOOGLE TOP 1-5 (KENWA, VIỆT PHÁT, ECOMAX, TOÀN Á, KAROFI, PRIMER...):
Học hỏi chiều sâu giải pháp, cấu trúc lập luận và thông số thực chiến từ các đơn vị hàng đầu:
${competitorExamples}

KHO THUẬT NGỮ KỸ THUẬT CHUYÊN NGÀNH CẦN SỬ DỤNG TỰ NHIÊN:
${termsList}

TIÊU CHUẨN KỸ SƯ THỰC CHIẾN (HỌC HỎI TỪ KENWA & ĐỐI THỦ TOP ĐẦU):
1. Phân tích bản chất kỹ thuật từ gốc rễ hóa lý: Nêu rõ thông số thực tế (áp suất bơm bar/psi, lưu lượng m3/h, chênh áp màng DP, chu kỳ súc rửa ngược backwash, tỷ lệ thu hồi %).
2. Lập luận khách quan, đĩnh đạc, cung cấp giải pháp hữu ích, KHÔNG nhồi nhét từ khóa máy móc.
3. TUYỆT ĐỐI KHÔNG copy y nguyên văn hay nêu tên đối thủ trong bài. Hãy biến tri thức này thành giải pháp vượt trội của Lọc Nước Hoa Sen.
══════════════════════════════════════════════════════════════════════════\n`;
  } catch (e) {
    return '';
  }
}

const ARTICLE_BLUEPRINTS = [
  {
    id: 'blueprint_blueprint',
    name: 'Hồ Sơ Thiết Kế Kỹ Thuật & Bản Vẽ Công Nghệ Đa Tầng (Engineering Blueprint)',
    hookStyle: 'Mở đầu bằng báo cáo kỹ thuật hiện trường: Kết quả kiểm tra mẫu nước thực tế (chỉ số TDS, pH, Fe tổng, độ đục NTU) tại khu vực ô nhiễm, lập luận giải thích nguyên nhân gốc rễ và xác lập yêu cầu thiết kế hệ thống.',
    outlineGuidance: `Cấu trúc bài viết BẮT BUỘC gồm các phần:
- Đoạn mở bài kỹ thuật: Báo cáo khảo sát thực địa mẫu nước và các thông số hóa lý đáng báo động.
- H2 (1): Sơ đồ nguyên lý công nghệ đa tầng áp lực & Cơ chế phân tách tạp chất.
- H2 (2): Cấu hình vật liệu lọc chuyên dụng & Bảng tính toán thông số vận hành (lưu lượng, áp suất, chênh áp DP).
- H2 (3): Bảng kiểm nghiệm định lượng hóa lý trước và sau xử lý (đối chiếu chuẩn QCVN của Bộ Y Tế).
- H2 (4): Năng lực khảo sát hiện trường & Lắp đặt tận nơi của Lọc Nước Hoa Sen tại TP.HCM và các tỉnh miền Nam.
- H2 (5): Quy trình kiểm tra định kỳ & Hướng dẫn bảo dưỡng kéo dài tuổi thọ thiết bị.`,
    antiCliché: 'CẤM tuyệt đối mở đầu bằng chuyện chị Mai, chị Lan hay người phụ nữ nhìn vào gương! Hãy mở đầu như một kỹ sư trưởng cầm bản kết quả xét nghiệm nước tại công trình.'
  },
  {
    id: 'blueprint_case_study',
    name: 'Case Study Thực Chiến Hiện Trường & Khắc Phục Sự Cố Nguồn Nước (Field Case Study)',
    hookStyle: 'Mở đầu bằng một tình huống thực tế tại một dự án cụ thể ở miền Nam (ví dụ: Biệt thự Thảo Điền Thủ Đức, nhà máy tại KCN VSIP Bình Dương, khu dân cư Hóc Môn / Củ Chi hay cơ sở sản xuất tại Tân Thới Hiệp Quận 12) gặp sự cố nguồn nước nghiêm trọng.',
    outlineGuidance: `Cấu trúc bài viết BẮT BUỘC gồm các phần:
- Đoạn mở bài thực tế: Bối cảnh sự cố cụ thể tại hiện trường và những hệ lụy thực tế gia chủ/chủ doanh nghiệp phải gánh chịu.
- H2 (1): Các bước chẩn đoán hiện trường & Bóc tách nguyên nhân gây tắc nghẽn / ô nhiễm.
- H2 (2): Phương án thiết kế kỹ thuật & Giải pháp nâng cấp hệ thống lọc chuyên sâu (giải thích rõ từng lớp vật liệu lọc).
- H2 (3): Kết quả đo đạc nghiệm thu sau xử lý (bảng so sánh chỉ số nước thực tế đạt chuẩn QCVN).
- H2 (4): Dịch vụ khảo sát tận nơi & Mạng lưới chi nhánh Hoa Sen phục vụ toàn miền Nam.
- H2 (5): Bài học kinh nghiệm & Khuyến cáo chuyên gia cho các công trình có nguồn nước tương tự.`,
    antiCliché: 'CẤM tuyệt đối dùng motif quen thuộc về da tóc hay mỹ phẩm! Tập trung vào hiện trường lắp đặt, đường ống, áp lực bơm và hiệu quả xử lý thực tế.'
  },
  {
    id: 'blueprint_scientific_deepdive',
    name: 'Phân Tích Chuyên Sâu Hóa Lý & Tiêu Chuẩn Bộ Y Tế (Scientific Deep-Dive)',
    hookStyle: 'Mở đầu bằng phản biện khoa học: Bóc tách một sai lầm phổ biến mà 90% khách hàng mắc phải (ví dụ: lầm tưởng nước trong là sạch, đun sôi nước khử được kim loại nặng, hoặc mua máy lọc nước nhưng không hiểu cơ chế trao đổi ion/màng bán thấm).',
    outlineGuidance: `Cấu trúc bài viết BẮT BUỘC gồm các phần:
- Đoạn mở bài phản biện: Bóc tách hiểu lầm phổ biến dưới góc nhìn hóa sinh và sức khỏe dài hạn.
- H2 (1): Bản chất hóa lý của tạp chất trong nguồn nước (cơ chế phân tử, phản ứng oxy hóa, ion hóa).
- H2 (2): Giải pháp công nghệ xử lý triệt để từ gốc rễ (phản ứng xúc tác, trao đổi ion, lọc qua màng bán thấm).
- H2 (3): Bảng đối chiếu chỉ số kỹ thuật với Quy chuẩn QCVN 01-1:2018/BYT hoặc QCVN 6-1:2010/BYT.
- H2 (4): Khảo sát hiện trường & Lắp đặt hệ thống chuẩn kỹ thuật tại TP.HCM và các tỉnh lân cận.
- H2 (5): Giải đáp thắc mắc chuyên sâu (FAQ) từ chuyên gia xử lý nước Hoa Sen.`,
    antiCliché: 'Văn phong đĩnh đạc, giàu tính học thuật nhưng dễ hiểu, giải thích thuyết phục bằng cơ chế khoa học rõ ràng.'
  },
  {
    id: 'blueprint_economic_evaluation',
    name: 'Bài Toán Kinh Tế - Kỹ Thuật & Tối Ưu Chi Phí Vận Hành (Economic & Technical Guide)',
    hookStyle: 'Mở đầu bằng bài toán tài chính: Phân tích sự hao tổn vô hình hàng chục triệu đồng tiền điện, tiền sửa chữa bình nóng lạnh, thay mới vòi sen nhập khẩu, lãng phí chất tẩy rửa và gián đoạn sản xuất do sử dụng nguồn nước không đạt chuẩn.',
    outlineGuidance: `Cấu trúc bài viết BẮT BUỘC gồm các phần:
- Đoạn mở bài tài chính: Bóc tách chi phí thiệt hại âm thầm hàng năm của gia đình hoặc doanh nghiệp.
- H2 (1): Đánh giá bài toán đầu tư: Chi phí CAPEX ban đầu so với chi phí tổn thất thiết bị dài hạn.
- H2 (2): So sánh các cấu hình công nghệ lọc nước hiện nay (Ưu - Nhược điểm, độ bền và chi phí bảo trì).
- H2 (3): Bảng kiểm nghiệm định lượng hóa lý bảo đảm an toàn theo tiêu chuẩn Bộ Y Tế.
- H2 (4): Quy trình tư vấn, khảo sát & Báo giá tận nơi minh bạch của Lọc Nước Hoa Sen.
- H2 (5): Bí quyết vận hành tối ưu hóa chi phí thay vật liệu và tiết kiệm năng lượng.`,
    antiCliché: 'Tập trung vào các con số định lượng, bài toán đầu tư và lợi ích kinh tế lâu dài.'
  },
  {
    id: 'blueprint_automation_maintenance',
    name: 'Cẩm Nang Vận Hành Tự Động Hóa & Bảo Trì Dài Lâu (Automation & Maintenance Guide)',
    hookStyle: 'Mở đầu bằng những sự cố phổ biến khi vận hành hệ thống lọc: Màng lọc bị nghẹt do cáu cặn, hạt nhựa mất khả năng trao đổi ion, áp suất bơm tăng vọt dẫn đến cháy bơm hoặc nước đầu ra có mùi lạ do không bảo dưỡng đúng chu kỳ.',
    outlineGuidance: `Cấu trúc bài viết BẮT BUỘC gồm các phần:
- Đoạn mở bài kỹ thuật: Những rủi ro hư hỏng hệ thống và suy giảm lưu lượng nước khi vận hành sai cách.
- H2 (1): Nguyên lý hoạt động của hệ thống điều khiển tự động Autovalve & Cảm biến áp lực.
- H2 (2): Quy trình súc rửa ngược (Backwash), rửa xuôi (Fast rinse) và hoàn nguyên muối tinh khiết.
- H2 (3): Bảng thông số vận hành chuẩn & Ngưỡng chênh áp cảnh báo cần can thiệp bảo dưỡng.
- H2 (4): Chính sách bảo hành tận nơi & Hỗ trợ kỹ thuật 24/7 của Lọc Nước Hoa Sen.
- H2 (5): Bảng tra cứu sự cố thường gặp và cách tự khắc phục nhanh tại nhà.`,
    antiCliché: 'Tập trung vào chi tiết cơ khí, van điều khiển, áp kế, đồng hồ đo lưu lượng và quy trình bảo dưỡng.'
  },
  {
    id: 'blueprint_regional_hydrology',
    name: 'Bản Đồ Địa Chất Thủy Văn & Phác Đồ Lọc Nước Vùng Miền (Regional Hydrology Guide)',
    hookStyle: 'Mở đầu bằng bức tranh địa chất thủy văn thực tế tại các vùng miền phía Nam: Sự khác biệt lớn giữa nguồn nước giếng Củ Chi / Hóc Môn (nhiễm sắt, mangan), nguồn nước Bình Dương / Đồng Nai (đá vôi, độ cứng cao) và nguồn nước Long An / Bến Tre (phèn chua, xâm nhập mặn).',
    outlineGuidance: `Cấu trúc bài viết BẮT BUỘC gồm các phần:
- Đoạn mở bài địa chất: Phân tích đặc thù nguồn nước từng khu vực và lý do vì sao một bộ lọc chung chung không thể giải quyết được.
- H2 (1): Đặc điểm hóa lý nguồn nước tại từng vùng trọng điểm miền Nam.
- H2 (2): Phác đồ cấu hình hệ thống lọc chuyên biệt thích ứng với từng loại nguồn nước.
- H2 (3): Bảng kiểm nghiệm chất lượng nước sau lọc đạt chuẩn QCVN 01-1:2018/BYT.
- H2 (4): Đội ngũ kỹ thuật viên Hoa Sen lưu động tại từng quận huyện, có mặt khảo sát trong 2 giờ.
- H2 (5): Hướng dẫn khách hàng tự kiểm tra sơ bộ chất lượng nước tại nhà.`,
    antiCliché: 'Tập trung vào địa danh cụ thể, tầng ngậm nước, đất phù sa, đất phèn và cấu hình lọc thích ứng từng địa phương.'
  }
];

// Danh sách các địa điểm thi công thực tế luân phiên (Local Locations Pool)
const DYNAMIC_LOCATIONS_POOL = [
  'Khu công nghiệp VSIP 1, TP. Thuận An, Tỉnh Bình Dương',
  'KCN Tân Bình mở rộng và Cụm công nghiệp Tân Thới Hiệp, Quận 12, TP.HCM',
  'Khu dân cư Bà Điểm và Xã Xuân Thới Thượng, Huyện Hóc Môn, TP.HCM',
  'Khu công nghiệp Amata và KCN Biên Hòa 2, Tỉnh Đồng Nai',
  'Khu biệt thự sinh thái ven sông Thảo Điền, TP. Thủ Đức, TP.HCM',
  'Xã Nhuận Đức và Tân An Hội, Huyện Củ Chi, TP.HCM (Vùng giếng khoan nhiễm phèn nặng)',
  'Khu công nghiệp Thuận Đạo, Bến Lức, Tỉnh Long An',
  'Khu chế xuất Linh Trung 2 và Tam Bình, TP. Thủ Đức, TP.HCM',
  'Khu công nghiệp Sóng Thần 2, TP. Dĩ An, Tỉnh Bình Dương',
  'Khu công nghiệp Long Thành và Huyện Nhơn Trạch, Tỉnh Đồng Nai',
  'Cụm xưởng sản xuất thực phẩm & bao bì Vĩnh Lộc A, Huyện Bình Chánh, TP.HCM',
  'Vùng ven sông Tiền, Huyện Chợ Gạo và TP. Mỹ Tho, Tỉnh Tiền Giang'
];

// Danh sách các câu nghi vấn mở bài thực tế (Inquisitive / Hook Questions Pool)
const INQUISITIVE_HOOKS_POOL = [
  'Liệu nguồn nước giếng khoan sau khi lọc qua bể cát sỏi truyền thống có thực sự an toàn để nấu ăn, hay mắt thường thấy trong nhưng hàm lượng kim loại nặng Fe, Mn, Asen vẫn ngấm ngầm vượt ngưỡng cho phép?',
  'Tại sao dù sử dụng nước máy thành phố, các thiết bị vệ sinh cao cấp, vòi sen và lồng máy giặt nhà bạn vẫn liên tục xuất hiện mảng bám ố vàng và cáu cặn đá vôi chỉ sau vài tháng vận hành?',
  'Chi phí tự đầu tư một hệ thống lọc nước tinh khiết chuyên dụng liệu có rẻ hơn và an tâm hơn việc phải chi hàng chục triệu đồng mỗi năm để đổi từng bình nước 20L trôi nổi ngoài thị trường?',
  'Nước cấp cho nồi hơi và tháp giải nhiệt tại sao thường xuyên bị nghẹt ống, giảm hiệu suất nhiệt và gây nguy cơ nổ ống áp lực chỉ vì độ cứng canxi không được kiểm soát triệt để?',
  'Nguồn nước nhìn bằng mắt thường rất trong và không mùi, nhưng liệu chỉ số tổng chất rắn hòa tan (TDS) và độ cứng vôi có đang âm thầm phá hủy đường ống và sức khỏe người dùng?'
];

function buildSeoPrompt(keyword, title, targetProductUrl, existingContents = [], angleIndex = 0) {
  const avoidSnippets = existingContents
    .slice(0, 3)
    .map((c, i) => `[Đoạn trích bài cũ ${i+1}]:\n` + c.substring(0, 300))
    .join('\n---\n');

  const selectedBlueprint = ARTICLE_BLUEPRINTS[angleIndex % ARTICLE_BLUEPRINTS.length];
  const domainKey = categorizeDomain(keyword, title);
  const industryBlock = getDynamicCompetitorKnowledge(domainKey);
  
  // Chọn ngẫu nhiên địa điểm thi công và câu hỏi nghi vấn để bài viết luôn tươi mới
  const suggestedLocation = DYNAMIC_LOCATIONS_POOL[angleIndex % DYNAMIC_LOCATIONS_POOL.length];
  const suggestedHookQuestion = INQUISITIVE_HOOKS_POOL[angleIndex % INQUISITIVE_HOOKS_POOL.length];

  return `Bạn là một Tiểu thuyết gia xuất sắc kiêm Kỹ sư Trưởng Công nghệ Xử lý Nước của Công ty Lọc Nước Hoa Sen (xulynuochoasen.com).
Hãy viết một bài viết chuẩn SEO độc bản, giàu chất đời sống và chuyên sâu khoa học cho từ khóa: "**${keyword}**" với tiêu đề: "**${title}**"

BẢN THIẾT KẾ CẤU TRÚC BÀI VIẾT (BẮT BUỘC TUÂN THỦ ĐỂ CHỐNG DẬP KHUÔN):
👉 PHONG CÁCH & ĐỊNH DẠNG: [${selectedBlueprint.name}]
👉 CÁCH MỞ ĐẦU (SAPO): ${selectedBlueprint.hookStyle}
👉 GỢI Ý CÂU NGHI VẤN ĐÁNH TRÚNG TÂM LÝ: "${suggestedHookQuestion}" (Hãy sử dụng hoặc biến tấu câu hỏi này vào đoạn mở bài để kích thích sự tò mò của độc giả).
👉 ĐỊA BÀN THI CÔNG / KHẢO SÁT THỰC TẾ GỢI Ý: "${suggestedLocation}" (Đưa địa danh cụ thể này vào bài như một dự án thực chiến điển hình của Hoa Sen).
👉 HƯỚNG DẪN CẤU TRÚC PHÂN MỤC:
${selectedBlueprint.outlineGuidance}
👉 NGUYÊN TẮC CHỐNG CLICHÉ: ${selectedBlueprint.antiCliché}
${industryBlock}

YÊU CẦU KỸ THUẬT BẮT BUỘC VỀ VẬT LIỆU LỌC & NGUỒN NƯỚC (QUY TẮC CỐT LÕI):
1. LINH ĐỘNG THEO MỌI NGUỒN NƯỚC:
   - Tùy theo chủ đề bài viết, phân tích chuẩn xác bản chất nguồn nước: Nước giếng khoan (nhiễm phèn Fe2+, mangan Mn2+, asen, H2S tanh); Nước máy thủy cục (clo dư, cặn rỉ sét); Nước cứng nhiễm vôi (Ca2+, Mg2+ đóng cặn nồi hơi/vòi sen); Nước lợ/mặn miền Tây; Nước cấp lò hơi / tháp giải nhiệt.
2. BÓC TÁCH CHI TIẾT CÁC LỚP VẬT LIỆU LỌC CHUYÊN DỤNG (Không nói chung chung):
   - Cát & Sỏi thạch anh: Lớp đệm thu nước, lọc chặn cặn lơ lửng, phù sa > 20 micron, chống nghẹt chõ lọc.
   - Hạt Mangan / DMI-65 (Úc) / Birm (Mỹ): Xúc tác oxy hóa kết tủa nhanh sắt hòa tan, hấp thụ Mangan, Asen, khử sạch phèn vàng và mùi tanh.
   - Than hoạt tính gáo dừa Trà Bắc / Than Jacobi (Thụy Điển) / Calgon (Mỹ): Chỉ số Iodine > 1000 mg/g, hấp phụ clo dư, độc tố hữu cơ, khử triệt để mùi tanh và tạo vị ngọt thanh.
   - Hạt Cation C100E (Purolite - Anh) / Jacobi: Cơ chế trao đổi ion Ca2+, Mg2+ lấy Na+, làm mềm nước triệt để, bảo vệ bình nóng lạnh và thiết bị nhiệt. Hoàn nguyên bằng muối tinh khiết NaCl 99.5%.
   - Màng RO DOW Filmtec / Toray: Khe lọc 0.0001 micron, loại bỏ 99.9% vi khuẩn, virus, kim loại nặng và TDS.
3. Độ dài: 1400 - 1800 từ, tiếng Việt chuẩn mực, văn phong đĩnh đạc, ấm áp, sâu sắc như một kỹ sư lành nghề.
4. Chèn từ khóa "${keyword}" tự nhiên từ 8-12 lần rải đều trong các mục.
5. Cấu trúc rõ ràng: 4-6 phân mục H2 (##), các mục nhỏ H3 (###).
6. Bắt buộc có 1 bảng Markdown so sánh chi tiết các chỉ số hóa lý / kỹ thuật đạt chuẩn Bộ Y Tế (QCVN 01-1:2018/BYT hoặc QCVN 6-1:2010/BYT).
7. Chèn đúng 2 hình ảnh placeholder: [IMAGE_1] (dưới H2 đầu tiên) và [IMAGE_2] (ở phần phân tích kỹ thuật).
8. BẮT BUỘC CÓ MỤC H2 LOCAL SEO: Khảo sát hiện trường & Lắp đặt tận nơi của Lọc Nước Hoa Sen tại TP.HCM (Trụ sở: 523/21 Lê Văn Khương, P. Tân Thới Hiệp, Q.12; Hóc Môn, Củ Chi, Bình Chánh, Thủ Đức...) và các tỉnh lân cận (Bình Dương, Đồng Nai, Long An...). Kèm cam kết kỹ thuật viên có mặt trong 2 giờ mang vali xét nghiệm mẫu nước miễn phí.
9. KHÔNG viết tiêu đề H1 ở đầu (tiêu đề đã được hệ thống tạo riêng).

TUYỆT ĐỐI TRÁNH TRÙNG LẶP — KHÔNG ĐƯỢC LẶP LẠI Ý TƯỞNG HAY CẤU TRÚC SAU:
${avoidSnippets ? avoidSnippets : '(Đây là bài đầu tiên của từ khóa này, hãy sáng tạo tự do)'}

Bắt đầu ngay vào nội dung bài viết:`;
}

async function generateAiContent(keyword, title, img1, img2, targetProductUrl, existingContents = []) {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error('Chưa có Gemini API key trong data/gemini.json');

  const genAI = new GoogleGenerativeAI(apiKey);
  const models = ['gemini-3.8-flash', 'gemini-flash-lite-latest', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];

  let rawContent = '';
  let lastError = null;

  for (let retry = 0; retry < 3; retry++) {
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const prompt = buildSeoPrompt(keyword, title, targetProductUrl, existingContents, retry);
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        if (text && text.length > 500) {
          // Kiểm tra similarity với existingContents
          let maxSim = 0;
          for (const ec of existingContents) {
            const sim = computeSimilarity(text.substring(0, 1500), ec.substring(0, 1500));
            if (sim > maxSim) maxSim = sim;
          }

          if (maxSim > 0.40) {
            console.warn(`[AI-Generator] Bài viết sinh ra có độ tương đồng ${(maxSim*100).toFixed(0)}% (> 40%). Đang thử lại với góc tiếp cận khác...`);
            continue;
          }

          rawContent = text;
          console.log(`[AI-Generator] ✅ Đã tạo bài viết độc bản thành công bằng model: ${modelName} (Độ tương đồng max: ${(maxSim*100).toFixed(0)}%)`);
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`[AI-Generator] Model ${modelName} gặp sự cố:`, err.message);
      }
    }
    if (rawContent) break;
  }

  if (!rawContent) {
    throw new Error('Không thể tạo bài viết qua Gemini AI: ' + (lastError ? lastError.message : 'Unknown error'));
  }

  // Inject hình ảnh thật vào placeholder
  const imgMarkdown1 = img1
    ? `[![Hình ảnh ${keyword} chuyên nghiệp](${img1})](${targetProductUrl})`
    : '';
  const imgMarkdown2 = img2
    ? `[![Chi tiết hệ thống ${keyword}](${img2})](${targetProductUrl})`
    : '';

  rawContent = rawContent.replace('[IMAGE_1]', imgMarkdown1 || '');
  rawContent = rawContent.replace('[IMAGE_2]', imgMarkdown2 || '');

  // Thêm CTA card chuyên nghiệp chuẩn Hoa Sen
  const ctaBlock = `\n\n${buildLocalSeoBox(targetProductUrl, keyword)}`;
  const fullContent = rawContent + ctaBlock;

  // Tự động chuyển đổi sang HTML sắc sảo, khử sạch công thức LaTeX và định dạng ảnh/bảng
  const { formatContentToRichHtml } = require('./content_formatter');
  return formatContentToRichHtml(fullContent, {
    title,
    isCaseStudy: /bàn giao|công trình|dự án|thi công|nghiệm thu/i.test(title)
  });
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
