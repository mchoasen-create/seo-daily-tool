/**
 * Banner Composer for SEO Daily Tool
 * Ghép ảnh từ 3 Kho (Kho 1, Kho 2, Kho 3) tạo Featured Image / Banner đỉnh cao
 * Mẫu thiết kế chuyên nghiệp 1200 x 675 (16:9) chuẩn Google Discover & Featured Snippet
 * Lá chắn chống bản quyền: Strip Exif, Smart Crop mép ảnh, ghi đè tác quyền Hoa Sen
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { getCustomMedia, getKeywordKho, categorizeImage } = require('./custom_media');

const BASE_DIR = process.pkg ? process.cwd() : path.join(__dirname, '..');
const UPLOADS_DIR = path.join(BASE_DIR, 'public/uploads');
const BRAND_LOGO_PATH = path.join(UPLOADS_DIR, 'custom_brand_logo.png');

const BANNER_WIDTH = 1200;
const BANNER_HEIGHT = 675;

// Tải Logo Hoa Sen dạng Base64 để nhúng thẳng vào SVG
async function getBrandLogoBase64() {
  try {
    if (fs.existsSync(BRAND_LOGO_PATH)) {
      const buf = await sharp(BRAND_LOGO_PATH)
        .resize(180, 150, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer();
      return `data:image/png;base64,${buf.toString('base64')}`;
    }
  } catch (err) {
    console.error('Lỗi đọc logo thương hiệu:', err);
  }
  return '';
}

// Helper cắt dòng cho SVG
function wrapText(text, maxChars = 22) {
  if (!text) return ['HỆ THỐNG LỌC NƯỚC'];
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= maxChars) {
      cur = (cur + ' ' + w).trim();
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

// Helper phân tách tiêu đề danh mục và tiêu đề bài viết cho dải chân trang Lower-Third
function splitTitleForLowerThird(title = '') {
  const cleanTitle = (title || '').trim();
  const lower = cleanTitle.toLowerCase();
  
  let mainCategory = 'HỆ THỐNG XỬ LÝ NƯỚC CHUYÊN NGHIỆP';
  if (lower.includes('ro') || lower.includes('tinh khiết') || lower.includes('đóng bình') || lower.includes('đóng chai')) {
    mainCategory = 'HỆ THỐNG LỌC NƯỚC TINH KHIẾT RO';
  } else if (lower.includes('công nghiệp') || lower.includes('nhà máy') || lower.includes('nhà xưởng') || lower.includes('bệnh viện') || lower.includes('nồi hơi') || lower.includes('lò hơi')) {
    mainCategory = 'HỆ THỐNG LỌC NƯỚC CÔNG NGHIỆP';
  } else if (lower.includes('phèn') || lower.includes('giếng') || lower.includes('sắt') || lower.includes('kim loại') || lower.includes('nhiễm phèn')) {
    mainCategory = 'XỬ LÝ NƯỚC NHIỄM PHÈN & GIẾNG KHOAN';
  } else if (lower.includes('sinh hoạt') || lower.includes('đầu nguồn') || lower.includes('biệt thự') || lower.includes('gia đình') || lower.includes('chung cư')) {
    mainCategory = 'HỆ THỐNG LỌC NƯỚC ĐẦU NGUỒN SINH HOẠT';
  } else if (lower.includes('mặn') || lower.includes('lợ') || lower.includes('nhiễm mặn') || lower.includes('khử mặn')) {
    mainCategory = 'HỆ THỐNG LỌC NƯỚC NHIỄM MẶN SWRO';
  }

  let subtitle = cleanTitle;
  if (subtitle.length > 58) {
    subtitle = subtitle.substring(0, 55) + '...';
  }

  return { mainCategory, subtitle };
}

// Xử lý ảnh: Bóc Exif, phóng nhẹ 5% và xén mép để xoá sạch watermark cũ
async function processAndEncodeImage(absPath) {
  try {
    if (!fs.existsSync(absPath)) {
      throw new Error(`File không tồn tại: ${absPath}`);
    }
    const meta = await sharp(absPath).metadata();
    const w = meta.width || 800;
    const h = meta.height || 600;

    // Zoom nhẹ 5% để xén bỏ viền mép và watermark góc (nếu có từ đối thủ)
    const cropX = Math.round(w * 0.025);
    const cropY = Math.round(h * 0.025);
    const cropW = Math.round(w * 0.95);
    const cropH = Math.round(h * 0.95);

    const cleanBuffer = await sharp(absPath)
      .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
      .jpeg({ quality: 88 })
      .toBuffer();

    return `data:image/jpeg;base64,${cleanBuffer.toString('base64')}`;
  } catch (err) {
    console.error('Lỗi processAndEncodeImage:', err);
    // Fallback nếu lỗi đọc ảnh
    const placeholder = await sharp({
      create: {
        width: 600,
        height: 600,
        channels: 4,
        background: { r: 2, g: 132, b: 199, alpha: 1 }
      }
    }).jpeg().toBuffer();
    return `data:image/jpeg;base64,${placeholder.toString('base64')}`;
  }
}

// ==========================================
// HỆ THỐNG CAM KẾT & HUY HIỆU ĐỘNG (DYNAMIC BADGES ENGINE)
// Đa dạng hình dáng: Tròn (Pill), Vuông (Square), Chèn khung (Frame), Mũi tên (Chevron), 2 tầng (Dualtone)
// Đa dạng màu sắc & Vector icon sắc sảo, tự động đổi nội dung theo chủ đề bài viết
// ==========================================
const BADGE_POOLS = {
  ro_cong_nghiep: [
    "Tiết Kiệm 80% Chi Phí Vận Hành",
    "Màng RO LG Korea & Dupont USA",
    "Màng RO 8040 Dupont USA Cao Cấp",
    "Màng RO LG Chem Korea Chính Hãng",
    "Nước Tinh Khiết Đạt Chuẩn QCVN 6-1",
    "Hệ Thống CIP Rửa Màng Tự Động 100%",
    "Bơm Cao Áp Trục Đứng Inox 304",
    "Lưu Lượng Chuẩn 500L/h - 50.000L/h",
    "Đồng Hồ Đo Lưu Lượng & TDS Điện Tử",
    "Bảo Hành Tận Nơi Lên Đến 24 Tháng",
    "Khảo Sát & Kiểm Tra Mẫu Nước 2H",
    "Đội Ngũ Kỹ Sư Lắp Đặt Chuyên Nghiệp"
  ],
  gieng_khoan_phen: [
    "Khử 100% Phèn, Sắt, Kim Loại Nặng",
    "Nước Trong Vắt Hết Cáu Cặn Ố Vàng",
    "Khử Triệt Để Mùi Tanh & Trứng Thối",
    "Cột Lọc Composite 817 - 1465 Bền Bỉ",
    "Vật Liệu Cation & Mangan Nhập Khẩu",
    "Van 3 Ngã Súc Rửa Vận Hành Dễ Dàng",
    "Bảo Vệ Toàn Bộ Thiết Bị Vệ Sinh",
    "Lắp Đặt Nhanh Gọn Trong Ngày",
    "Nước Sinh Hoạt Đạt QCVN 01-1:2018",
    "Test Nước Trực Tiếp Trước Khi Bàn Giao"
  ],
  sinh_hoat_tong: [
    "Bảo Vệ Tế Bào Da, Tóc & Sức Khỏe",
    "Khử 100% Clo Dư, Hóa Chất & Vi Khuẩn",
    "Nước Sinh Hoạt Đạt Chuẩn QCVN 01",
    "Than Hoạt Tính Calgon Nhập Khẩu Mỹ",
    "Van Tự Động Súc Rửa Thông Minh",
    "Thiết Kế Tinh Tế, Sang Trọng Mọi Nhà",
    "Chống Cáu Cặn Bình Nóng Lạnh & Sen Vòi",
    "Bảo Hành Toàn Diện 24 Tháng Tận Nơi",
    "Vật Liệu Lọc Đạt Chứng Nhận NSF Quốc Tế",
    "Tư Vấn & Khảo Sát Miễn Phí Tại Chỗ"
  ],
  nhiem_man: [
    "Công Nghệ Tách Muối SWRO Chuyên Sâu",
    "Nước Uống Ngọt Lành Trực Tiếp Tại Vòi",
    "Chống Ăn Mòn Nước Mặn Tuyệt Đối",
    "Tiết Kiệm Điện Năng Vận Hành Tối Đa",
    "Giải Pháp Chống Hạn Mặn Bền Vững",
    "Khảo Sát Độ Mặn Tận Nơi Bằng Máy Đo"
  ],
  general: [
    "Vật Liệu Nhập Khẩu Mỹ, Nhật, Ý",
    "Hệ Thống Vận Hành Tự Động 100%",
    "Khảo Sát & Lấy Mẫu Nước Miễn Phí",
    "Bảo Hành Chính Hãng 24 Tháng",
    "Chuẩn Kỹ Thuật Nước Sạch QCVN",
    "Hotline Kỹ Sư Hỗ Trợ 24/7"
  ]
};

const COLOR_SCHEMES = {
  ocean: { start: '#0284c7', end: '#0369a1', border: '#38bdf8', textDark: '#0f172a' },
  emerald: { start: '#059669', end: '#047857', border: '#34d399', textDark: '#064e3b' },
  navy: { start: '#1e3a8a', end: '#2563eb', border: '#60a5fa', textDark: '#0f172a' },
  amber: { start: '#d97706', end: '#b45309', border: '#fbbf24', textDark: '#451a03' },
  cyan: { start: '#0891b2', end: '#0e7490', border: '#67e8f9', textDark: '#164e63' }
};

function pickDynamicBadges(title, customBadges = []) {
  if (customBadges && customBadges.length >= 4) return customBadges.slice(0, 4);
  const lower = (title || '').toLowerCase();
  let pool = BADGE_POOLS.general;
  if (lower.includes('ro') || lower.includes('công nghiệp') || lower.includes('nhà xưởng') || lower.includes('thực phẩm') || lower.includes('y tế') || lower.includes('dược')) {
    pool = BADGE_POOLS.ro_cong_nghiep;
  } else if (lower.includes('phèn') || lower.includes('giếng') || lower.includes('sắt') || lower.includes('chì') || lower.includes('kim loại') || lower.includes('tanh') || lower.includes('mùi')) {
    pool = BADGE_POOLS.gieng_khoan_phen;
  } else if (lower.includes('sinh hoạt') || lower.includes('đầu nguồn') || lower.includes('biệt thự') || lower.includes('chung cư') || lower.includes('da') || lower.includes('tóc') || lower.includes('gia đình')) {
    pool = BADGE_POOLS.sinh_hoat_tong;
  } else if (lower.includes('mặn') || lower.includes('lợ') || lower.includes('nhiễm mặn') || lower.includes('cù lao')) {
    pool = BADGE_POOLS.nhiem_man;
  }
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 4);
}

function getBadgeIconSvg(iconType = 'check', color = '#ffffff') {
  switch (iconType) {
    case 'shield':
      return `<path d="M 22 13 L 29 16 V 22 C 29 26 22 29 22 29 C 22 29 15 26 15 22 V 16 Z" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'star':
      return `<path d="M 22 13 L 24 18 L 29 18.5 L 25 22 L 26.5 27 L 22 24 L 17.5 27 L 19 22 L 15 18.5 L 20 18 Z" fill="${color}" fill-opacity="0.9"/>`;
    case 'bolt':
      return `<path d="M 23 13 L 17 22 H 22 L 21 29 L 27 20 H 22 Z" fill="${color}"/>`;
    case 'water':
      return `<path d="M 22 13 C 22 13 16 19 16 23 A 6 6 0 0 0 28 23 C 28 19 22 13 22 13 Z" fill="${color}"/>`;
    case 'check':
    default:
      return `<path d="M 16 22 L 20 26 L 28 17" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
}

function renderDynamicBadge(text, index, shapeStyle = 'pill', colorKey = 'ocean') {
  const scheme = COLOR_SCHEMES[colorKey] || COLOR_SCHEMES.ocean;
  const icons = ['shield', 'check', 'bolt', 'star'];
  const iconType = icons[index % icons.length];
  const yOffset = index * 58;
  const escaped = escapeXml(text);

  if (shapeStyle === 'frame') {
    // Kiểu 1: Chèn chữ trong khung viền kính (Glassmorphism Frame)
    return `
      <g transform="translate(0, ${yOffset})">
        <rect x="0" y="0" width="375" height="44" rx="8" fill="#ffffff" fill-opacity="0.92" stroke="${scheme.start}" stroke-width="2" filter="url(#shadow)"/>
        <rect x="7" y="7" width="30" height="30" rx="6" fill="${scheme.start}"/>
        <g transform="translate(-7, -3)">
          ${getBadgeIconSvg(iconType, '#ffffff')}
        </g>
        <text x="48" y="28" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="800" fill="${scheme.textDark}">${escaped}</text>
      </g>
    `;
  }

  if (shapeStyle === 'square') {
    // Kiểu 2: Vuông vắn bo góc nhẹ chuẩn thiết bị công nghiệp
    return `
      <g transform="translate(0, ${yOffset})">
        <rect x="0" y="0" width="370" height="44" rx="4" fill="url(#badgeGrad)" filter="url(#shadow)"/>
        <rect x="0" y="0" width="6" height="44" rx="2" fill="${scheme.border}"/>
        <rect x="14" y="10" width="24" height="24" rx="4" fill="#ffffff" fill-opacity="0.25"/>
        <g transform="translate(4, 0)">
          ${getBadgeIconSvg(iconType, '#ffffff')}
        </g>
        <text x="48" y="28" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="700" fill="#ffffff">${escaped}</text>
      </g>
    `;
  }

  if (shapeStyle === 'dualtone') {
    // Kiểu 3: Khối 2 tầng tương phản (Icon màu đậm, thân màu trắng nổi)
    return `
      <g transform="translate(0, ${yOffset})">
        <rect x="0" y="0" width="44" height="44" rx="8" fill="${scheme.start}" filter="url(#shadow)"/>
        <g transform="translate(0, 0)">
          ${getBadgeIconSvg(iconType, '#ffffff')}
        </g>
        <rect x="48" y="0" width="322" height="44" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" filter="url(#shadow)"/>
        <text x="60" y="28" font-family="'Segoe UI', Roboto, sans-serif" font-size="14.5" font-weight="800" fill="#0f172a">${escaped}</text>
      </g>
    `;
  }

  if (shapeStyle === 'chevron') {
    // Kiểu 4: Mũi tên Chevron hiện đại vát nhọn
    return `
      <g transform="translate(0, ${yOffset})">
        <path d="M 0 0 L 335 0 L 368 22 L 335 44 L 0 44 Z" fill="url(#badgeGrad)" filter="url(#shadow)"/>
        <circle cx="22" cy="22" r="12" fill="#ffffff" fill-opacity="0.25"/>
        <g transform="translate(0, 0)">
          ${getBadgeIconSvg(iconType, '#ffffff')}
        </g>
        <text x="42" y="28" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="700" fill="#ffffff">${escaped}</text>
      </g>
    `;
  }

  // Kiểu 5 mặc định: Tròn viên thuốc (Pill Capsule) mượt mà sang trọng
  return `
    <g transform="translate(0, ${yOffset})">
      <rect x="0" y="0" width="365" height="44" rx="22" fill="url(#badgeGrad)" filter="url(#shadow)"/>
      <circle cx="22" cy="22" r="13" fill="#ffffff" fill-opacity="0.25"/>
      <g transform="translate(0, 0)">
        ${getBadgeIconSvg(iconType, '#ffffff')}
      </g>
      <text x="44" y="28" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="700" fill="#ffffff">${escaped}</text>
    </g>
  `;
}

// ==========================================
// STYLE 1: WAVE CURVE (Sóng Nước Chuyên Nghiệp)
// ==========================================
function getWaveSvg(title, b1Base64, badges = [], shapeStyle = 'auto', colorKey = 'auto') {
  const lines = wrapText(title, 22);

  // Chọn hình dáng badge linh hoạt
  const availableShapes = ['pill', 'frame', 'square', 'chevron', 'dualtone'];
  const chosenShape = (shapeStyle && shapeStyle !== 'auto') 
    ? shapeStyle 
    : availableShapes[Math.floor(Math.random() * availableShapes.length)];

  // Chọn bộ màu linh hoạt
  let chosenColor = colorKey;
  if (!chosenColor || chosenColor === 'auto') {
    const lower = (title || '').toLowerCase();
    if (lower.includes('phèn') || lower.includes('giếng')) chosenColor = 'amber';
    else if (lower.includes('sinh hoạt') || lower.includes('đầu nguồn')) chosenColor = 'emerald';
    else if (lower.includes('mặn') || lower.includes('lợ')) chosenColor = 'navy';
    else chosenColor = Math.random() > 0.5 ? 'ocean' : 'cyan';
  }
  const scheme = COLOR_SCHEMES[chosenColor] || COLOR_SCHEMES.ocean;

  // Lấy danh sách badge phong phú theo chủ đề
  const activeBadges = pickDynamicBadges(title, badges);
  const badgesSvg = activeBadges.map((b, i) => renderDynamicBadge(b, i, chosenShape, chosenColor)).join('');

  return `
<svg width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" viewBox="0 0 ${BANNER_WIDTH} ${BANNER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="60%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#f0f9ff"/>
    </linearGradient>
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${scheme.start}"/>
      <stop offset="100%" stop-color="${scheme.end}"/>
    </linearGradient>
    <linearGradient id="waveBorder" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${scheme.border}"/>
      <stop offset="50%" stop-color="${scheme.start}"/>
      <stop offset="100%" stop-color="${scheme.end}"/>
    </linearGradient>
    <clipPath id="photoClip">
      <path d="M 580 0 Q 480 337.5 580 675 L 1200 675 L 1200 0 Z" />
    </clipPath>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="2" dy="4" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.14"/>
    </filter>
  </defs>

  <rect width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" fill="url(#bgGrad)"/>
  <circle cx="100" cy="90" r="45" fill="${scheme.border}" fill-opacity="0.08"/>
  <circle cx="480" cy="120" r="22" fill="${scheme.start}" fill-opacity="0.06"/>
  <circle cx="70" cy="530" r="60" fill="${scheme.start}" fill-opacity="0.05"/>

  <!-- Ảnh bên phải cắt cong hình sóng -->
  <g clip-path="url(#photoClip)">
    <image href="${b1Base64}" x="480" y="0" width="720" height="675" preserveAspectRatio="xMidYMid slice"/>
  </g>
  <path d="M 580 0 Q 480 337.5 580 675" fill="none" stroke="url(#waveBorder)" stroke-width="8" filter="url(#shadow)"/>

  <!-- Logo Brand Hoa Sen -->
  <g transform="translate(50, 46)">
    <circle cx="18" cy="18" r="18" fill="${scheme.start}"/>
    <path d="M 18 7 C 18 7 10 18 10 22 C 10 27 14 30 18 30 C 22 30 26 27 26 22 C 26 18 18 7 18 7 Z" fill="#ffffff"/>
    <text x="46" y="21" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="900" fill="${scheme.start}" letter-spacing="1.2">LỌC NƯỚC HOA SEN</text>
    <text x="46" y="38" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#64748b">XULYNUOCHOASEN.COM • HOTLINE: 0938 880 492</text>
  </g>

  <!-- Tiêu đề to đậm -->
  <g transform="translate(50, 142)">
    ${lines.map((l, i) => `
      <text x="0" y="${i * 44}" font-family="'Segoe UI', Roboto, sans-serif" font-size="32" font-weight="900" fill="#0f172a" filter="url(#shadow)">
        ${escapeXml(l)}
      </text>
    `).join('')}
  </g>

  <!-- Danh sách cam kết / Tiêu chí động theo hình dáng -->
  <g transform="translate(50, 310)">
    ${badgesSvg}
  </g>

  <g transform="translate(1010, 625)">
    <rect x="0" y="0" width="150" height="28" rx="14" fill="#0f172a" fill-opacity="0.75"/>
    <text x="75" y="19" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">LỌC NƯỚC HOA SEN</text>
  </g>
</svg>
`;
}

// ==========================================
// STYLE 2: CIRCLE CUTOUTS (2 Khung Tròn B2B)
// ==========================================
function getCircleCutoutsSvg(title, b1Base64, b2Base64) {
  const lines = wrapText(title, 20);
  return `
<svg width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" viewBox="0 0 ${BANNER_WIDTH} ${BANNER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
    <linearGradient id="btnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <clipPath id="circleBig">
      <circle cx="880" cy="280" r="230" />
    </clipPath>
    <clipPath id="circleSmall">
      <circle cx="680" cy="460" r="160" />
    </clipPath>
    <filter id="cShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="4" dy="8" stdDeviation="10" flood-color="#0f172a" flood-opacity="0.2"/>
    </filter>
  </defs>

  <rect width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" fill="url(#cbg)"/>
  <circle cx="80" cy="100" r="120" fill="#0284c7" fill-opacity="0.04"/>
  <circle cx="480" cy="300" r="90" fill="#38bdf8" fill-opacity="0.05"/>

  <!-- Khung tròn lớn (Ảnh 1) -->
  <g filter="url(#cShadow)">
    <circle cx="880" cy="280" r="236" fill="#ffffff"/>
    <g clip-path="url(#circleBig)">
      <image href="${b1Base64}" x="650" y="50" width="460" height="460" preserveAspectRatio="xMidYMid slice"/>
    </g>
    <circle cx="880" cy="280" r="230" fill="none" stroke="#0284c7" stroke-width="4" stroke-opacity="0.3"/>
  </g>

  <!-- Khung tròn nhỏ (Ảnh 2) -->
  <g filter="url(#cShadow)">
    <circle cx="680" cy="460" r="166" fill="#ffffff"/>
    <g clip-path="url(#circleSmall)">
      <image href="${b2Base64}" x="520" y="300" width="320" height="320" preserveAspectRatio="xMidYMid slice"/>
    </g>
    <circle cx="680" cy="460" r="160" fill="none" stroke="#38bdf8" stroke-width="4" stroke-opacity="0.5"/>
  </g>

  <!-- Cột nội dung bên trái -->
  <g transform="translate(70, 70)">
    <text x="0" y="24" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="900" fill="#0284c7" letter-spacing="2">LỌC NƯỚC HOA SEN</text>
    <text x="0" y="44" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#94a3b8">HỆ THỐNG XỬ LÝ NƯỚC CHUYÊN NGHIỆP</text>

    <g transform="translate(0, 110)">
      ${lines.map((l, i) => `
        <text x="0" y="${i * 48}" font-family="'Segoe UI', Roboto, sans-serif" font-size="36" font-weight="900" fill="#1e3a8a">
          ${escapeXml(l.toUpperCase())}
        </text>
      `).join('')}
    </g>

    <g transform="translate(0, 270)">
      <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#475569" letter-spacing="1">CAM KẾT CHẤT LƯỢNG:</text>
      
      <g transform="translate(0, 20)">
        <rect x="0" y="0" width="320" height="42" rx="8" fill="#1e293b"/>
        <circle cx="24" cy="21" r="12" fill="#2563eb"/>
        <path d="M 19 21 L 23 25 L 30 17" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
        <text x="46" y="27" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#ffffff">THIẾT BỊ &amp; MÀNG LỌC CHÍNH HÃNG</text>
      </g>

      <g transform="translate(0, 72)">
        <rect x="0" y="0" width="320" height="42" rx="8" fill="#1e293b"/>
        <circle cx="24" cy="21" r="12" fill="#2563eb"/>
        <path d="M 19 21 L 23 25 L 30 17" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
        <text x="46" y="27" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#ffffff">LẮP ĐẶT CHUẨN KỸ THUẬT CHUYÊN GIA</text>
      </g>
    </g>

    <g transform="translate(0, 420)">
      <rect x="0" y="0" width="220" height="48" rx="24" fill="url(#btnGrad)" filter="url(#cShadow)"/>
      <text x="110" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#ffffff" text-anchor="middle">LIÊN HỆ: 0938 880 492</text>
      <text x="240" y="31" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#64748b">🌐 xulynuochoasen.com</text>
    </g>
  </g>
</svg>
`;
}

// ==========================================
// STYLE 3: VS SPLIT SCREEN (So Sánh 2 Nửa)
// ==========================================
function getVsSplitSvg(title, b1Base64, b2Base64, labelLeft = 'HỆ THỐNG LỌC TỔNG', labelRight = 'HỆ THỐNG RO TINH KHIẾT') {
  return `
<svg width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" viewBox="0 0 ${BANNER_WIDTH} ${BANNER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="splitLeft">
      <path d="M 0 0 L 610 0 L 550 675 L 0 675 Z" />
    </clipPath>
    <clipPath id="splitRight">
      <path d="M 610 0 L 1200 0 L 1200 675 L 550 675 Z" />
    </clipPath>
    <linearGradient id="vsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
    <filter id="vsShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <g clip-path="url(#splitLeft)">
    <image href="${b1Base64}" x="0" y="0" width="650" height="675" preserveAspectRatio="xMidYMid slice"/>
    <rect width="650" height="675" fill="#000000" fill-opacity="0.2"/>
  </g>

  <g clip-path="url(#splitRight)">
    <image href="${b2Base64}" x="550" y="0" width="650" height="675" preserveAspectRatio="xMidYMid slice"/>
    <rect x="550" width="650" height="675" fill="#000000" fill-opacity="0.2"/>
  </g>

  <line x1="610" y1="0" x2="550" y2="675" stroke="#ffffff" stroke-width="8" filter="url(#vsShadow)"/>

  <rect x="40" y="30" width="1120" height="90" rx="14" fill="#0f172a" fill-opacity="0.88" filter="url(#vsShadow)"/>
  <text x="600" y="70" font-family="'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#ffffff" text-anchor="middle">
    ${escapeXml(title.toUpperCase())}
  </text>
  <text x="600" y="98" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#38bdf8" text-anchor="middle" letter-spacing="1">
    CÔNG TY CỔ PHẦN THIÊN NHIÊN VÀ MÔI TRƯỜNG HOA SEN • HOTLINE: 0938 880 492
  </text>

  <g transform="translate(580, 350)" filter="url(#vsShadow)">
    <circle cx="0" cy="0" r="54" fill="#ffffff"/>
    <circle cx="0" cy="0" r="46" fill="url(#vsGrad)"/>
    <text x="0" y="16" font-family="'Impact', 'Arial Black', sans-serif" font-size="44" font-weight="900" fill="#ffffff" text-anchor="middle" font-style="italic" letter-spacing="1">
      VS
    </text>
  </g>

  <g transform="translate(100, 560)">
    <rect x="0" y="0" width="280" height="46" rx="23" fill="#0284c7" fill-opacity="0.95" filter="url(#vsShadow)"/>
    <text x="140" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#ffffff" text-anchor="middle">
      ${escapeXml(labelLeft)}
    </text>
  </g>

  <g transform="translate(820, 560)">
    <rect x="0" y="0" width="280" height="46" rx="23" fill="#2563eb" fill-opacity="0.95" filter="url(#vsShadow)"/>
    <text x="140" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#ffffff" text-anchor="middle">
      ${escapeXml(labelRight)}
    </text>
  </g>
</svg>
`;
}

// ==========================================
// LOWER-THIRD STYLES: DẢI CHÂN TRANG LINH HOẠT & BỘ TÍNH NĂNG ĐỐI THỦ
// 1. Con dấu mộc đỏ kiểm định BYT
// 2. Định vị công trình thực tế (Geotag Pin)
// 3. Đo lường TDS thông minh (Live TDS Telemetry)
// 4. Khung thông số kỹ thuật Màng RO LG Korea & Dupont USA
// ==========================================

function detectLocationFromText(text = '') {
  const lower = (text || '').toLowerCase();
  const PROVINCES = [
    { key: 'bình dương', name: 'BÌNH DƯƠNG' },
    { key: 'đồng nai', name: 'ĐỒNG NAI' },
    { key: 'long an', name: 'LONG AN' },
    { key: 'tây ninh', name: 'TÂY NINH' },
    { key: 'bến tre', name: 'BẾN TRE' },
    { key: 'tiền giang', name: 'TIỀN GIANG' },
    { key: 'cần thơ', name: 'CẦN THƠ' },
    { key: 'củ chi', name: 'CỦ CHI (TP.HCM)' },
    { key: 'hóc môn', name: 'HÓC MÔN (TP.HCM)' },
    { key: 'bình chánh', name: 'BÌNH CHÁNH (TP.HCM)' },
    { key: 'nhà bè', name: 'NHÀ BÈ (TP.HCM)' },
    { key: 'thủ đức', name: 'TP. THỦ ĐỨC' },
    { key: 'hồ chí minh', name: 'TP. HỒ CHÍ MINH' },
    { key: 'tphcm', name: 'TP. HỒ CHÍ MINH' },
    { key: 'sài gòn', name: 'TP. HỒ CHÍ MINH' },
    { key: 'vũng tàu', name: 'BÀ RỊA - VŨNG TÀU' },
    { key: 'bà rịa', name: 'BÀ RỊA - VŨNG TÀU' },
    { key: 'bình phước', name: 'BÌNH PHƯỚC' },
    { key: 'lâm đồng', name: 'LÂM ĐỒNG' },
    { key: 'đà lạt', name: 'ĐÀ LẠT' },
    { key: 'nha trang', name: 'NHA TRANG' },
    { key: 'khánh hòa', name: 'KHÁNH HÒA' },
    { key: 'hà nội', name: 'HÀ NỘI' }
  ];
  for (const p of PROVINCES) {
    if (lower.includes(p.key)) return p.name;
  }
  return 'BÌNH DƯƠNG & MIỀN NAM';
}

// 1. Con dấu mộc cam kết chất lượng & bảo hành Hoa Sen (100% hợp pháp, không dùng tên cơ quan nhà nước)
function getInspectionSealSvg(x = 1030, y = 24) {
  return `
  <g transform="translate(${x}, ${y}) rotate(-6)" filter="url(#shadow)">
    <circle cx="65" cy="65" r="62" fill="#ffffff" fill-opacity="0.95" stroke="#0284c7" stroke-width="3.5" />
    <circle cx="65" cy="65" r="55" fill="none" stroke="#0284c7" stroke-width="1.5" stroke-dasharray="4,2" />
    <text x="65" y="32" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="900" fill="#0369a1" text-anchor="middle" letter-spacing="0.5">LỌC NƯỚC HOA SEN</text>
    <text x="65" y="49" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="800" fill="#0284c7" text-anchor="middle">★ CAM KẾT CHẤT LƯỢNG ★</text>
    <text x="65" y="67" font-family="'Segoe UI', Roboto, sans-serif" font-size="13.5" font-weight="900" fill="#0f172a" text-anchor="middle">BẢO HÀNH 24T</text>
    <text x="65" y="82" font-family="'Segoe UI', Roboto, sans-serif" font-size="9.5" font-weight="800" fill="#0369a1" text-anchor="middle">100% LINH KIỆN NHẬP</text>
    <text x="65" y="96" font-family="'Segoe UI', Roboto, sans-serif" font-size="8.5" font-weight="800" fill="#059669" text-anchor="middle">ĐÃ NGHIỆM THU</text>
    <circle cx="65" cy="110" r="3" fill="#0284c7"/>
  </g>
  `;
}

// 2. Định vị địa phương thực tế (Geotag Pin)
function getGeotagPinSvg(locationName, x = 35, y = 28) {
  const label = `📍 ĐÃ THI CÔNG: ${locationName}`;
  const width = Math.max(220, label.length * 8.5 + 40);
  return `
  <g transform="translate(${x}, ${y})" filter="url(#shadow)">
    <rect x="0" y="0" width="${width}" height="38" rx="19" fill="#0f172a" fill-opacity="0.9" stroke="#38bdf8" stroke-width="1.8"/>
    <circle cx="20" cy="19" r="6" fill="#ef4444"/>
    <circle cx="20" cy="19" r="2.5" fill="#ffffff"/>
    <text x="36" y="24" font-family="'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="800" fill="#ffffff" letter-spacing="0.5">${escapeXml(label)}</text>
  </g>
  `;
}

// 3. Huy hiệu đo lường TDS thông minh
function getTdsTelemetrySvg(tdsValue = '005', x = 950, y = 30) {
  return `
  <g transform="translate(${x}, ${y})" filter="url(#shadow)">
    <rect x="0" y="0" width="215" height="42" rx="21" fill="#020617" fill-opacity="0.92" stroke="#22c55e" stroke-width="2"/>
    <circle cx="22" cy="21" r="5" fill="#22c55e" />
    <text x="36" y="19" font-family="'Segoe UI', Roboto, sans-serif" font-size="9.5" font-weight="800" fill="#94a3b8" letter-spacing="0.5">CHỈ SỐ TINH KHIẾT</text>
    <text x="36" y="34" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="900" fill="#22c55e">TDS: ${escapeXml(tdsValue)} PPM (UỐNG NGAY)</text>
  </g>
  `;
}

// 4. Khung thông số kỹ thuật đa tầng (LG Korea, Dupont USA)
function getMiniSpecSheetSvg(x = 875, y = 24) {
  return `
  <g transform="translate(${x}, ${y})" filter="url(#shadow)">
    <rect x="0" y="0" width="295" height="76" rx="10" fill="#0f172a" fill-opacity="0.94" stroke="#38bdf8" stroke-width="1.5"/>
    <rect x="0" y="0" width="295" height="22" rx="10" fill="#0284c7"/>
    <text x="147" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">TIÊU CHUẨN KỸ THUẬT HOA SEN</text>
    <text x="14" y="38" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#38bdf8">⚡ MÀNG RO:</text>
    <text x="86" y="38" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="900" fill="#ffffff">LG Korea, Dupont USA</text>
    <text x="14" y="55" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#38bdf8">⚡ BƠM ÁP:</text>
    <text x="86" y="55" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#ffffff">Trục đứng Inox 304 (CNP/Ebara)</text>
    <text x="14" y="70" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#94a3b8">⚡ VẬN HÀNH: Tự động PLC &amp; Rửa CIP</text>
  </g>
  `;
}

// Style 4: Floating Glass Capsule (Viên nang kính nổi)
function getLowerThirdCapsuleSvg(title, subtitle, b1Base64, logoBase64, options = {}) {
  const hotline = options.hotline || '0938 880 492';
  const locationName = options.locationName || detectLocationFromText(title + ' ' + subtitle);
  const tagText = options.tagText || '★ MÀNG RO LG & DUPONT USA';
  const escapedMain = escapeXml(title);
  const escapedSub = escapeXml(subtitle);

  return `
<svg width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" viewBox="0 0 ${BANNER_WIDTH} ${BANNER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="barGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#06b6d4" />
      <stop offset="60%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-20%" width="130%" height="150%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.45" />
    </filter>
    <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.35" />
    </filter>
  </defs>

  <image href="${b1Base64}" x="0" y="0" width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" preserveAspectRatio="xMidYMid slice"/>

  <!-- Geotag Pin góc trên trái -->
  ${getGeotagPinSvg(locationName, 35, 28)}

  <!-- Con dấu cam kết chất lượng Hoa Sen góc trên phải -->
  ${getInspectionSealSvg(BANNER_WIDTH - 170, 24)}

  <!-- Dải chân trang dạng viên nang lơ lửng -->
  <g filter="url(#shadow)">
    <rect x="24" y="${BANNER_HEIGHT - 150}" width="${BANNER_WIDTH - 48}" height="126" rx="28" fill="url(#barGrad)" />
    <rect x="25" y="${BANNER_HEIGHT - 149}" width="${BANNER_WIDTH - 50}" height="124" rx="27" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-opacity="0.5" />
  </g>

  <!-- Huy hiệu Logo nổi (Floating Squircle) -->
  <g filter="url(#badgeShadow)">
    <rect x="44" y="${BANNER_HEIGHT - 180}" width="140" height="140" rx="30" fill="#00e5ff" />
    <circle cx="114" cy="${BANNER_HEIGHT - 110}" r="58" fill="#ffffff" />
    ${logoBase64 ? `<image href="${logoBase64}" x="69" y="${BANNER_HEIGHT - 148}" width="90" height="76" preserveAspectRatio="xMidYMid meet" />` : ''}
  </g>

  <!-- Nội dung Text -->
  <g transform="translate(204, ${BANNER_HEIGHT - 122})">
    <rect x="0" y="-18" width="230" height="22" rx="11" fill="#ffffff" fill-opacity="0.25" />
    <text x="115" y="-3" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.8">${escapeXml(tagText)}</text>
    <text x="0" y="24" font-family="'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#ffffff" letter-spacing="0.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))">${escapedMain}</text>
    <text x="0" y="55" font-family="'Segoe UI', Roboto, sans-serif" font-size="18.5" font-weight="600" font-style="italic" fill="#e0f2fe">${escapedSub}</text>
  </g>

  <!-- TDS Telemetry Meter góc phải dải đáy -->
  <g transform="translate(${BANNER_WIDTH - 245}, ${BANNER_HEIGHT - 112})">
    <rect x="0" y="0" width="200" height="48" rx="24" fill="#020617" filter="url(#badgeShadow)" stroke="#22c55e" stroke-width="1.8" />
    <circle cx="24" cy="24" r="5" fill="#22c55e" />
    <text x="38" y="20" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="800" fill="#94a3b8">CHỈ SỐ NƯỚC UỐNG</text>
    <text x="38" y="36" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="900" fill="#22c55e">TDS: 005 PPM (UỐNG NGAY)</text>
  </g>
</svg>
`;
}

// Style 5: Asymmetric Industrial Slanted Cut (Vát góc cơ khí công nghiệp)
function getLowerThirdSlantedSvg(title, subtitle, b1Base64, logoBase64, options = {}) {
  const warrantyText = options.warrantyText || 'MÀNG RO LG KOREA, DUPONT USA';
  const escapedMain = escapeXml(title);
  const escapedSub = escapeXml(subtitle);

  return `
<svg width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" viewBox="0 0 ${BANNER_WIDTH} ${BANNER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="amberGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#b45309" />
      <stop offset="40%" stop-color="#d97706" />
      <stop offset="100%" stop-color="#f59e0b" />
    </linearGradient>
    <filter id="shadow" x="-5%" y="-20%" width="120%" height="150%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.5" />
    </filter>
  </defs>

  <image href="${b1Base64}" x="0" y="0" width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" preserveAspectRatio="xMidYMid slice"/>

  <!-- Khung Spec Màng RO LG Korea & Dupont USA góc trên phải -->
  ${getMiniSpecSheetSvg(BANNER_WIDTH - 330, 24)}

  <g filter="url(#shadow)">
    <polygon points="0,${BANNER_HEIGHT - 146} ${BANNER_WIDTH - 120},${BANNER_HEIGHT - 146} ${BANNER_WIDTH},${BANNER_HEIGHT - 106} ${BANNER_WIDTH},${BANNER_HEIGHT} 0,${BANNER_HEIGHT}" fill="#fef08a" />
    <polygon points="0,${BANNER_HEIGHT - 140} ${BANNER_WIDTH - 125},${BANNER_HEIGHT - 140} ${BANNER_WIDTH},${BANNER_HEIGHT - 100} ${BANNER_WIDTH},${BANNER_HEIGHT} 0,${BANNER_HEIGHT}" fill="url(#amberGrad)" />
  </g>

  <g filter="url(#shadow)" transform="translate(30, ${BANNER_HEIGHT - 170})">
    <polygon points="70,0 140,40 140,120 70,160 0,120 0,40" fill="#ffffff" stroke="#f59e0b" stroke-width="4" />
    ${logoBase64 ? `<image href="${logoBase64}" x="25" y="42" width="90" height="76" preserveAspectRatio="xMidYMid meet" />` : ''}
  </g>

  <g transform="translate(195, ${BANNER_HEIGHT - 105})">
    <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#ffffff" letter-spacing="0.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.4))">${escapedMain}</text>
    <text x="0" y="32" font-family="'Segoe UI', Roboto, sans-serif" font-size="19" font-weight="700" fill="#fef3c7">${escapedSub}</text>
  </g>

  <g transform="translate(${BANNER_WIDTH - 270}, ${BANNER_HEIGHT - 75})">
    <rect x="0" y="0" width="240" height="34" rx="6" fill="#78350f" fill-opacity="0.75" />
    <text x="120" y="22" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#fef08a" text-anchor="middle">${escapeXml(warrantyText)}</text>
  </g>
</svg>
`;
}

// Style 6: Dual-Tier Ribbon (Dải 2 tầng tương phản)
function getLowerThirdDualTierSvg(title, subtitle, b1Base64, logoBase64, options = {}) {
  const locationName = options.locationName || detectLocationFromText(title + ' ' + subtitle);
  const topTag = options.topTag || `DỰ ÁN: ${locationName} • MÀNG RO LG KOREA & DUPONT USA • CHUẨN QCVN 6-1:2010`;
  const escapedMain = escapeXml(title);
  const escapedSub = escapeXml(subtitle);

  return `
<svg width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" viewBox="0 0 ${BANNER_WIDTH} ${BANNER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tier2Grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#064e3b" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <filter id="shadow" x="-5%" y="-20%" width="120%" height="150%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.45" />
    </filter>
  </defs>

  <image href="${b1Base64}" x="0" y="0" width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" preserveAspectRatio="xMidYMid slice"/>

  <!-- Con dấu cam kết chất lượng & bảo hành Hoa Sen góc trên phải -->
  ${getInspectionSealSvg(BANNER_WIDTH - 170, 24)}

  <g filter="url(#shadow)">
    <rect x="180" y="${BANNER_HEIGHT - 156}" width="${BANNER_WIDTH - 180}" height="38" fill="#10b981" />
    <text x="210" y="${BANNER_HEIGHT - 132}" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="900" fill="#ffffff" letter-spacing="0.8">${escapeXml(topTag)}</text>
  </g>

  <g filter="url(#shadow)">
    <rect x="0" y="${BANNER_HEIGHT - 120}" width="${BANNER_WIDTH}" height="120" fill="url(#tier2Grad)" />
    <rect x="0" y="${BANNER_HEIGHT - 6}" width="${BANNER_WIDTH}" height="6" fill="#34d399" />
  </g>

  <g filter="url(#shadow)" transform="translate(30, ${BANNER_HEIGHT - 170})">
    <circle cx="70" cy="70" r="68" fill="#10b981" />
    <circle cx="70" cy="70" r="58" fill="#ffffff" />
    ${logoBase64 ? `<image href="${logoBase64}" x="25" y="32" width="90" height="76" preserveAspectRatio="xMidYMid meet" />` : ''}
  </g>

  <g transform="translate(180, ${BANNER_HEIGHT - 78})">
    <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#ffffff" letter-spacing="0.5">${escapedMain}</text>
    <text x="0" y="32" font-family="'Segoe UI', Roboto, sans-serif" font-size="18.5" font-weight="600" fill="#a7f3d0">${escapedSub}</text>
  </g>
</svg>
`;
}

// Style 7: Cinematic Slate Smoke & Cyan Neon (Khói đêm sang trọng & Viền Neon)
function getLowerThirdCinematicSvg(title, subtitle, b1Base64, logoBase64, options = {}) {
  const escapedMain = escapeXml(title);
  const escapedSub = escapeXml(subtitle);

  return `
<svg width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" viewBox="0 0 ${BANNER_WIDTH} ${BANNER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="darkSmokeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" stop-opacity="0" />
      <stop offset="35%" stop-color="#0f172a" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#020617" stop-opacity="0.98" />
    </linearGradient>
    <linearGradient id="neonGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#38bdf8" />
    </linearGradient>
    <filter id="neonBlur" x="-10%" y="-100%" width="120%" height="300%">
      <feGaussianBlur stdDeviation="3" />
    </filter>
  </defs>

  <image href="${b1Base64}" x="0" y="0" width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" preserveAspectRatio="xMidYMid slice"/>

  <!-- TDS Telemetry Meter góc trên phải -->
  ${getTdsTelemetrySvg('005', BANNER_WIDTH - 250, 30)}

  <rect x="0" y="${BANNER_HEIGHT - 220}" width="${BANNER_WIDTH}" height="220" fill="url(#darkSmokeGrad)" />

  <line x1="0" y1="${BANNER_HEIGHT - 120}" x2="${BANNER_WIDTH}" y2="${BANNER_HEIGHT - 120}" stroke="url(#neonGlow)" stroke-width="6" opacity="0.6" filter="url(#neonBlur)" />
  <line x1="0" y1="${BANNER_HEIGHT - 120}" x2="${BANNER_WIDTH}" y2="${BANNER_HEIGHT - 120}" stroke="#ffffff" stroke-width="1.8" />

  <g transform="translate(40, ${BANNER_HEIGHT - 100})">
    <rect x="0" y="0" width="110" height="80" rx="12" fill="#ffffff" fill-opacity="0.95" />
    ${logoBase64 ? `<image href="${logoBase64}" x="10" y="5" width="90" height="70" preserveAspectRatio="xMidYMid meet" />` : ''}
    <line x1="130" y1="10" x2="130" y2="70" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" />
  </g>

  <g transform="translate(195, ${BANNER_HEIGHT - 72})">
    <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#ffffff" letter-spacing="1">${escapedMain}</text>
    <text x="0" y="32" font-family="'Segoe UI', Roboto, sans-serif" font-size="18.5" font-weight="500" fill="#94a3b8">${escapedSub}</text>
  </g>

  <g transform="translate(${BANNER_WIDTH - 260}, ${BANNER_HEIGHT - 90})">
    <text x="0" y="16" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#38bdf8" letter-spacing="1">MÀNG RO LG &amp; DUPONT USA</text>
    <text x="0" y="40" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="900" fill="#ffffff">ISO 9001:2015</text>
  </g>
</svg>
`;
}

// Master Router cho Lower-Third
function getLowerThirdSvg(style, title, subtitle, b1Base64, logoBase64, options = {}) {
  const opts = {
    ...options,
    locationName: options.locationName || detectLocationFromText(title + ' ' + subtitle)
  };

  switch (style) {
    case 'lower_third_slanted':
      return getLowerThirdSlantedSvg(title, subtitle, b1Base64, logoBase64, opts);
    case 'lower_third_dualtier':
      return getLowerThirdDualTierSvg(title, subtitle, b1Base64, logoBase64, opts);
    case 'lower_third_cinematic':
      return getLowerThirdCinematicSvg(title, subtitle, b1Base64, logoBase64, opts);
    case 'lower_third_capsule':
    default:
      return getLowerThirdCapsuleSvg(title, subtitle, b1Base64, logoBase64, opts);
  }
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

// Bốc ảnh từ Kho theo chủ đề
function pickWarehouseImages(targetKho = 'kho_1', count = 2) {
  const allMedia = getCustomMedia();
  const khoImages = allMedia.filter(m => categorizeImage(m) === targetKho);
  const pool = khoImages.length >= count ? khoImages : allMedia;

  if (pool.length === 0) return [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Tạo Banner hoàn chỉnh từ Kho ảnh
 * Hỗ trợ cả Banner ghép nhiều ảnh (Split / Wave / Circle) và Banner dải chân trang (Lower-Third)
 * @param {Object} options
 * @param {string} options.title Tiêu đề bài viết
 * @param {string} [options.targetKho] 'kho_1' | 'kho_2' | 'kho_3'
 * @param {string} [options.style] 'wave_curve' | 'circle_cutouts' | 'vs_split' | 'lower_third_capsule' | 'lower_third_slanted' | 'lower_third_dualtier' | 'lower_third_cinematic' | 'lower_third_auto' | 'auto'
 * @param {string} [options.img1Path] Đường dẫn ảnh 1
 * @param {string} [options.img2Path] Đường dẫn ảnh 2
 * @returns {Promise<{ url: string, absPath: string, style: string }>}
 */
async function generateBanner({
  title = 'Hệ Thống Lọc Nước Hoa Sen',
  targetKho = null,
  style = 'auto',
  img1Path = null,
  img2Path = null,
  badges = [],
  badgeStyle = 'auto',
  badgeColor = 'auto'
} = {}) {
  const chosenKho = targetKho || getKeywordKho(title);

  // Danh sách các phong cách dải đáy Lower-Third
  const lowerThirdStyles = [
    'lower_third_capsule',
    'lower_third_slanted',
    'lower_third_dualtier',
    'lower_third_cinematic'
  ];

  // Chọn style nếu auto hoặc lower_third_auto
  let selectedStyle = style;
  if (!selectedStyle || selectedStyle === 'auto') {
    const lower = title.toLowerCase();
    if (lower.includes('so sánh') || lower.includes('vs') || lower.includes('hay') || lower.includes('khác biệt')) {
      selectedStyle = 'vs_split';
    } else {
      // 50% chọn phong cách Lower-Third dải đáy chân trang, 50% chọn phong cách ghép nhiều ảnh
      const useLowerThird = Math.random() < 0.5;
      if (useLowerThird) {
        selectedStyle = lowerThirdStyles[Math.floor(Math.random() * lowerThirdStyles.length)];
      } else {
        selectedStyle = (lower.includes('công nghiệp') || lower.includes('nhà xưởng') || lower.includes('ro'))
          ? 'circle_cutouts'
          : 'wave_curve';
      }
    }
  } else if (selectedStyle === 'lower_third_auto') {
    selectedStyle = lowerThirdStyles[Math.floor(Math.random() * lowerThirdStyles.length)];
  }

  const isLowerThird = selectedStyle.startsWith('lower_third');

  // Lấy ảnh nguồn
  let p1 = img1Path;
  let p2 = img2Path;

  if (!p1 || (!isLowerThird && !p2)) {
    const neededCount = isLowerThird ? 1 : 2;
    const picked = pickWarehouseImages(chosenKho, neededCount);
    if (!p1 && picked[0]) {
      p1 = path.join(BASE_DIR, 'public', picked[0].url.replace(/^\//, ''));
    }
    if (!isLowerThird && !p2 && picked[1]) {
      p2 = path.join(BASE_DIR, 'public', picked[1].url.replace(/^\//, ''));
    }
  }

  const b1 = await processAndEncodeImage(p1);

  // Sinh SVG theo style
  let svgContent = '';
  if (isLowerThird) {
    const logoBase64 = await getBrandLogoBase64();
    const { mainCategory, subtitle } = splitTitleForLowerThird(title);
    svgContent = getLowerThirdSvg(selectedStyle, mainCategory, subtitle, b1, logoBase64);
  } else if (selectedStyle === 'circle_cutouts') {
    const b2 = await processAndEncodeImage(p2 || p1);
    svgContent = getCircleCutoutsSvg(title, b1, b2);
  } else if (selectedStyle === 'vs_split') {
    const b2 = await processAndEncodeImage(p2 || p1);
    svgContent = getVsSplitSvg(title, b1, b2);
  } else {
    selectedStyle = 'wave_curve';
    svgContent = getWaveSvg(title, b1, badges, badgeStyle, badgeColor);
  }

  // Tên file xuất bản
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 6);
  const filename = `banner_${selectedStyle}_${timestamp}_${rand}.webp`;
  const outAbsPath = path.join(UPLOADS_DIR, filename);

  // Render SVG sang WebP chất lượng cao
  await sharp(Buffer.from(svgContent))
    .webp({ quality: 90 })
    .toFile(outAbsPath);

  return {
    url: `/uploads/${filename}`,
    absPath: outAbsPath,
    style: selectedStyle,
    filename
  };
}

/**
 * Tự động tạo banner và gán vào bài viết
 */
async function generateBannerForPost(post, style = 'auto', badgeStyle = 'auto', badgeColor = 'auto') {
  if (!post || !post.title) return null;
  const targetKho = post.targetKho || getKeywordKho(post.title || post.keyword);
  const result = await generateBanner({
    title: post.title,
    targetKho,
    style,
    badges: post.badges || [],
    badgeStyle: post.badgeStyle || badgeStyle,
    badgeColor: post.badgeColor || badgeColor
  });

  if (result && result.url) {
    post.featured_image = result.url;
    post.imageUrl = result.url;
    post.banner_style = result.style;
  }
  return result;
}

module.exports = {
  generateBanner,
  generateBannerForPost,
  getLowerThirdSvg,
  splitTitleForLowerThird,
  detectLocationFromText,
  getInspectionSealSvg,
  getGeotagPinSvg,
  getTdsTelemetrySvg,
  getMiniSpecSheetSvg,
  pickWarehouseImages,
  pickDynamicBadges,
  renderDynamicBadge,
  COLOR_SCHEMES,
  BADGE_POOLS,
  BANNER_WIDTH,
  BANNER_HEIGHT
};
