/**
 * Content Formatter — Rich HTML Converter, LaTeX Sanitizer & Visual Enhancer
 * Được thiết kế bởi ENI: Chuyển đổi Markdown sang HTML chuẩn chỉnh, khử sạch mã công thức,
 * định dạng hình ảnh và bảng biểu sắc sảo, hiện đại chuẩn phong cách Lọc Nước Hoa Sen.
 */

const { marked } = require('marked');

/**
 * Khử sạch các mã công thức LaTeX phát sinh từ AI, chuyển thành ký tự Unicode chuẩn
 */
function sanitizeLatex(text) {
  if (!text) return '';

  return text
    // Xử lý các khối công thức toán/hóa: $...$
    .replace(/\$([^\$]+)\$/g, (match, formula) => {
      let f = formula;
      // Hợp chất hóa học thông dụng
      f = f.replace(/\\text\{CaCO\}_?\{?3\}?/gi, 'CaCO₃');
      f = f.replace(/\\text\{Ca\}\^\{?2\+\}?/gi, 'Ca²⁺');
      f = f.replace(/\\text\{Mg\}\^\{?2\+\}?/gi, 'Mg²⁺');
      f = f.replace(/\\text\{Mn\}\^\{?2\+\}?/gi, 'Mn²⁺');
      f = f.replace(/\\text\{Fe\}\^\{?2\+\}?/gi, 'Fe²⁺');
      f = f.replace(/\\text\{Fe\}\^\{?3\+\}?/gi, 'Fe³⁺');
      f = f.replace(/\\text\{Fe\}/gi, 'Fe');
      f = f.replace(/\\text\{Mn\}/gi, 'Mn');
      f = f.replace(/\\text\{H\}_?\{?2\}?\\text\{S\}/gi, 'H₂S');
      f = f.replace(/\\text\{CO\}_?\{?2\}?/gi, 'CO₂');
      f = f.replace(/\\text\{NaCl\}/gi, 'NaCl');

      // Đơn vị và thông số vận hành
      f = f.replace(/1\.2\s*-\s*1\.5\s*\\text\{\s*m\}\^3\\text\{h\}/gi, '1.2 - 1.5 m³/h');
      f = f.replace(/1\.2\s*-\s*1\.5\s*m\^3\/h/gi, '1.2 - 1.5 m³/h');
      f = f.replace(/25\^\\circ\s*\\text\{C\}/gi, '25°C');
      f = f.replace(/25\^\\circ\s*C/gi, '25°C');

      // Phép so sánh và hàm mũ
      f = f.replace(/\\le\s*([0-9\.]+)/gi, '≤ $1');
      f = f.replace(/\\ge\s*([0-9\.]+)/gi, '≥ $1');
      f = f.replace(/([0-9\.]+)\s*\\times\s*10\^\{?([0-9]+)\}?/gi, '$1 × 10³');

      // Xóa thẻ \text{} còn sót trong khối $
      f = f.replace(/\\text\{([^}]+)\}/g, '$1');

      // Chuyển đổi số mũ ion
      f = f.replace(/\^2\+/g, '²⁺')
           .replace(/\^3\+/g, '³⁺')
           .replace(/\^2/g, '²')
           .replace(/\^3/g, '³');

      // Chuyển đổi chỉ số dưới
      f = f.replace(/_2/g, '₂')
           .replace(/_3/g, '₃')
           .replace(/_4/g, '₄');

      return f;
    })
    // Xóa thẻ \text{...} đơn lẻ ngoài khối $ nếu có
    .replace(/\\text\{([^}]+)\}/g, '$1');
}

/**
 * Chuyển đổi cú pháp Markdown hình ảnh thành thẻ Figure HTML responsive, bo góc, bóng mờ
 */
function convertMarkdownImagesToHtml(mdText) {
  if (!mdText) return '';

  // Dạng 1: [![ALT](IMG_SRC)](TARGET_LINK)
  const linkedImgPattern = /\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g;
  mdText = mdText.replace(linkedImgPattern, (match, alt, imgSrc, linkHref) => {
    return `\n\n<figure class="wp-block-image size-large aligncenter" style="margin: 32px auto; text-align: center; max-width: 820px;">
  <div style="border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0; background: #fff;">
    <a href="${linkHref}" target="_blank" rel="noopener">
      <img loading="lazy" decoding="async" src="${imgSrc}" alt="${alt}" style="width: 100%; height: auto; display: block; object-fit: cover;" />
    </a>
  </div>
  <figcaption style="font-size: 0.9em; color: #64748b; font-style: italic; margin-top: 10px; text-align: center;">📸 <em>${alt}</em></figcaption>
</figure>\n\n`;
  });

  // Dạng 2: ![ALT](IMG_SRC)
  const singleImgPattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  mdText = mdText.replace(singleImgPattern, (match, alt, imgSrc) => {
    return `\n\n<figure class="wp-block-image size-large aligncenter" style="margin: 32px auto; text-align: center; max-width: 820px;">
  <div style="border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0; background: #fff;">
    <img loading="lazy" decoding="async" src="${imgSrc}" alt="${alt}" style="width: 100%; height: auto; display: block; object-fit: cover;" />
  </div>
  <figcaption style="font-size: 0.9em; color: #64748b; font-style: italic; margin-top: 10px; text-align: center;">📸 <em>${alt}</em></figcaption>
</figure>\n\n`;
  });

  return mdText;
}

/**
 * Tạo khung thông tin tóm tắt hồ sơ công trình hiện đại (Project Dashboard Card)
 */
function buildCaseStudyHeaderCard(title = '', location = 'TP.HCM & Các Tỉnh Miền Nam') {
  return `<div class="case-study-badge-card" style="background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%); border: 1px solid #bfdbfe; border-left: 5px solid #0284c7; border-radius: 12px; padding: 22px 24px; margin: 0 0 32px 0; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.08);">
  <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; border-bottom: 1px solid #dbeafe; padding-bottom: 10px;">
    <span style="background: #0284c7; color: #ffffff; font-size: 0.82em; font-weight: 700; padding: 5px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">HỒ SƠ CÔNG TRÌNH THỰC TẾ</span>
    <span style="color: #16a34a; font-weight: 700; font-size: 0.9em; display: inline-flex; align-items: center; gap: 6px;">
      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #22c55e;"></span>
      Đã Nghiệm Thu &amp; Bàn Giao Vận Hành 100%
    </span>
  </div>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; font-size: 0.93em; line-height: 1.6; color: #334155;">
    <div><strong style="color: #0f172a;">📍 Địa điểm thi công:</strong> ${location}</div>
    <div><strong style="color: #0f172a;">🏭 Hạng mục công trình:</strong> ${title || 'Hệ thống xử lý nước chuyên sâu Hoa Sen'}</div>
    <div><strong style="color: #0f172a;">🧪 Đặc tính nguồn nước:</strong> Khử triệt để phèn, kim loại nặng &amp; độ cứng</div>
    <div><strong style="color: #0f172a;">🎯 Tiêu chuẩn đầu ra:</strong> Đạt chuẩn Bộ Y Tế (QCVN 01-1:2018/BYT &amp; QCVN 6-1:2010/BYT)</div>
  </div>
</div>\n\n`;
}

/**
 * Nâng cấp giao diện các thành phần HTML (H2 có viền xanh thanh lịch, H3, Bảng biểu responsive)
 */
function enhanceHtmlContent(html) {
  if (!html) return '';

  // Nâng cấp thẻ H2
  html = html.replace(/<h2>(.*?)<\/h2>/gi, (m, headingText) => {
    return `<h2 style="color: #0f172a; font-size: 1.38em; font-weight: 700; border-left: 5px solid #0284c7; padding: 8px 14px; margin-top: 36px; margin-bottom: 18px; line-height: 1.4; background: linear-gradient(90deg, #f0f9ff 0%, #ffffff 100%); border-radius: 0 8px 8px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">${headingText}</h2>`;
  });

  // Nâng cấp thẻ H3
  html = html.replace(/<h3>(.*?)<\/h3>/gi, (m, headingText) => {
    return `<h3 style="color: #1e293b; font-size: 1.18em; font-weight: 600; margin-top: 24px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;"><span style="color: #0284c7;">❖</span> ${headingText}</h3>`;
  });

  // Nâng cấp bảng biểu HTML Table
  html = html.replace(/<table>([\s\S]*?)<\/table>/gi, (m, tableInner) => {
    let styledTable = tableInner
      .replace(/<th>/gi, '<th style="background: #0284c7; color: #ffffff; padding: 12px 14px; font-weight: 600; border: 1px solid #0284c7; text-align: left; font-size: 0.92em;">')
      .replace(/<td>/gi, '<td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #f1f5f9; color: #334155; font-size: 0.92em; line-height: 1.5;">');

    return `<div class="table-responsive-wrapper" style="overflow-x: auto; margin: 28px 0; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; background: #fff;">
  <table style="width: 100%; border-collapse: collapse; margin: 0; text-align: left;">
    ${styledTable}
  </table>
</div>`;
  });

  return html;
}

/**
 * Hàm toàn diện: Biến đổi nội dung thô thành HTML chuẩn mực, sắc sảo
 */
function formatContentToRichHtml(content, options = {}) {
  if (!content) return '';

  // 1. Khử sạch công thức toán/hóa LaTeX
  let text = sanitizeLatex(content);

  // 2. Chuyển đổi Markdown image sang thẻ Figure đẹp mắt
  text = convertMarkdownImagesToHtml(text);

  // 3. Biên dịch Markdown thành HTML qua marked
  let html = marked ? marked.parse(text) : text;

  // 4. Tô điểm cho các thẻ H2, H3, Table
  html = enhanceHtmlContent(html);

  // 5. Thêm Project Summary Badge nếu là bài công trình hoặc có tùy chọn isCaseStudy
  const isCaseStudy = options.isCaseStudy || 
    (options.categoryId === 3) || 
    (options.title && /bàn giao|công trình|dự án|thi công|nghiệm thu/i.test(options.title));

  if (isCaseStudy && !html.includes('case-study-badge-card')) {
    const badge = buildCaseStudyHeaderCard(options.title, options.location);
    html = badge + html;
  }

  return html;
}

module.exports = {
  sanitizeLatex,
  convertMarkdownImagesToHtml,
  buildCaseStudyHeaderCard,
  enhanceHtmlContent,
  formatContentToRichHtml
};
