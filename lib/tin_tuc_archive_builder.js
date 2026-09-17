/**
 * lib/tin_tuc_archive_builder.js
 * Quản lý & Tự động đồng bộ Trang Tin Tức (Page 3906) & Chân Trang Doanh Nghiệp trên WordPress
 * - Khối Cam Kết Uy Tín 4 Trụ Cột
 * - Bài Viết Tiêu Điểm Spotlight (Banner 16:9 sắc nét, không bị xén chữ)
 * - Lưới Bài Viết 2 Cột Card Ngang / Dọc tỉ lệ 16:9 nguyên bản
 * - Phân Trang Thông Minh (12 bài / trang, chuyển trang 0ms mượt mà)
 * - Chân Trang Masterpiece Luxury Dark Footer (Đẳng Cấp Tập Đoàn Lớn)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

function getWPConfig() {
  try {
    const configPath = path.join(__dirname, '../data/wordpress.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error('Lỗi đọc wordpress.json:', e.message);
  }
  return {};
}

function getAuthHeader(wpConfig) {
  const username = wpConfig.username || '';
  const appPassword = (wpConfig.appPassword || '').replace(/\s+/g, '');
  return 'Basic ' + Buffer.from(`${username}:${appPassword}`).toString('base64');
}

function fetchPosts(wpConfig, auth, limit = 60) {
  return new Promise((resolve, reject) => {
    const siteUrl = (wpConfig.siteUrl || 'https://xulynuochoasen.com').replace(/\/$/, '');
    const url = `${siteUrl}/wp-json/wp/v2/posts?_embed=1&per_page=${limit}&page=1&status=publish&orderby=date&order=desc`;

    https.get(url, {
      headers: {
        'Authorization': auth,
        'User-Agent': 'HoaSen-Enterprise-Builder/2.0'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            resolve(parsed);
          } else {
            resolve([]);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function updateSettings(wpConfig, auth, payload) {
  return new Promise((resolve, reject) => {
    const siteUrl = (wpConfig.siteUrl || 'https://xulynuochoasen.com').replace(/\/$/, '');
    const bodyStr = JSON.stringify(payload);
    const req = https.request(`${siteUrl}/wp-json/wp/v2/settings`, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'User-Agent': 'HoaSen-Enterprise-Builder/2.0'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function updatePage(wpConfig, auth, pageId, payload) {
  return new Promise((resolve, reject) => {
    const siteUrl = (wpConfig.siteUrl || 'https://xulynuochoasen.com').replace(/\/$/, '');
    const bodyStr = JSON.stringify(payload);
    const req = https.request(`${siteUrl}/wp-json/wp/v2/pages/${pageId}`, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'User-Agent': 'HoaSen-Enterprise-Builder/2.0'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8230;/g, '...')
    .replace(/&amp;/g, '&')
    .replace(/&#038;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function formatDate(dateStr) {
  if (!dateStr) return '17/09/2026';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '17/09/2026';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

const DEFAULT_BANNER = 'https://xulynuochoasen.com/wp-content/uploads/2026/09/banner_wave_curve_1789526976627_h2n4.webp';
const POSTS_PER_PAGE = 12; // 6 hàng x 2 cột = 12 bài / trang

function detectCategory(title) {
  const t = title.toLowerCase();
  if (t.includes('công nghiệp') || t.includes('nhà máy') || t.includes('vsip') || t.includes('kcn')) return 'Dự Án Công Nghiệp';
  if (t.includes('giếng') || t.includes('khoan')) return 'Lọc Nước Giếng Khoan';
  if (t.includes('phèn')) return 'Xử Lý Nước Phèn';
  if (t.includes('tinh khiết') || t.includes('ro') || t.includes('đóng bình')) return 'Lọc Nước Tinh Khiết RO';
  if (t.includes('sinh hoạt') || t.includes('gia đình') || t.includes('biệt thự')) return 'Lọc Nước Sinh Hoạt';
  return 'Cẩm Nang Kỹ Thuật';
}

function buildEnterpriseArchiveHtml(posts) {
  if (!posts || posts.length === 0) return '';

  // 1. Featured Spotlight Post (Top 1 post)
  const feat = posts[0];
  const featMedia = feat._embedded && feat._embedded['wp:featuredmedia'] && feat._embedded['wp:featuredmedia'][0];
  const featImg = (featMedia && featMedia.source_url) ? featMedia.source_url : DEFAULT_BANNER;
  const featTitle = decodeHtmlEntities(feat.title ? feat.title.rendered : 'Bài viết tiêu điểm');
  const featLink = feat.link || '#';
  const featDate = formatDate(feat.date);
  const featCat = detectCategory(featTitle);

  const featuredHtml = `
    <div class="hs-spotlight-card">
      <div class="hs-spotlight-badge-corner">🔥 BÀI VIẾT TIÊU ĐIỂM MỚI NHẤT</div>
      <div class="hs-spotlight-grid">
        <div class="hs-spotlight-thumb">
          <a href="${featLink}" title="${featTitle}">
            <img src="${featImg}" alt="${featTitle}" loading="eager" class="hs-spotlight-img" />
          </a>
        </div>
        <div class="hs-spotlight-content">
          <div class="hs-spotlight-meta">
            <span class="hs-cat-tag">${featCat}</span>
            <span class="hs-date-tag">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${featDate}
            </span>
            <span class="hs-author-tag">Lọc Nước Hoa Sen</span>
          </div>
          <h2 class="hs-spotlight-title">
            <a href="${featLink}" title="${featTitle}">${featTitle}</a>
          </h2>
          <p class="hs-spotlight-desc">Giải pháp thi công xử lý nước chuyên sâu, ứng dụng công nghệ lọc đa tầng đạt chuẩn kỹ thuật QCVN Bộ Y Tế. Khảo sát hiện trường và tư vấn kỹ thuật tận nơi.</p>
          <div class="hs-spotlight-action">
            <a href="${featLink}" class="hs-btn-primary">Đọc Báo Cáo Kỹ Thuật →</a>
          </div>
        </div>
      </div>
    </div>
  `.trim();

  // 2. Remaining Posts for Paginated Grid (Posts 1 to N)
  const gridPosts = posts.slice(1);
  const totalPages = Math.ceil(gridPosts.length / POSTS_PER_PAGE);

  let pagesHtml = '';
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const startIdx = (pageNum - 1) * POSTS_PER_PAGE;
    const endIdx = startIdx + POSTS_PER_PAGE;
    const pageItems = gridPosts.slice(startIdx, endIdx);

    let cardsHtml = '';
    pageItems.forEach(p => {
      const media = p._embedded && p._embedded['wp:featuredmedia'] && p._embedded['wp:featuredmedia'][0];
      const imgSrc = (media && media.source_url) ? media.source_url : DEFAULT_BANNER;
      const title = decodeHtmlEntities(p.title ? p.title.rendered : 'Bài viết xử lý nước');
      const link = p.link || '#';
      const dateFormatted = formatDate(p.date);
      const catName = detectCategory(title);

      cardsHtml += `
        <article class="hs-card-item">
          <div class="hs-card-media">
            <a href="${link}" title="${title}">
              <img src="${imgSrc}" alt="${title}" loading="lazy" class="hs-card-img" />
            </a>
            <span class="hs-media-badge">${catName}</span>
          </div>
          <div class="hs-card-info">
            <div class="hs-card-meta">
              <span class="hs-card-date">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                ${dateFormatted}
              </span>
              <span class="hs-card-author">Hoa Sen</span>
            </div>
            <h3 class="hs-card-heading">
              <a href="${link}" title="${title}">${title}</a>
            </h3>
            <div class="hs-card-footer">
              <a href="${link}" class="hs-card-readmore">Xem chi tiết <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>
            </div>
          </div>
        </article>
      `.trim();
    });

    const isVisible = pageNum === 1;
    pagesHtml += `<div class="hs-page-view ${isVisible ? 'hs-active' : ''}" id="hs-page-view-${pageNum}" style="${isVisible ? 'display:grid;' : 'display:none;'}">${cardsHtml}</div>`;
  }

  // 3. Pagination Controls
  let pageButtons = '';
  for (let i = 1; i <= totalPages; i++) {
    pageButtons += `<button type="button" class="hs-p-btn ${i === 1 ? 'hs-p-active' : ''}" data-page="${i}" onclick="window.hsGoToPage(${i})">${i}</button>`;
  }

  const paginationBar = `<div class="hs-pagination-bar"><div class="hs-nav-btn-wrap hs-prev-wrap"><button type="button" class="hs-nav-arrow hs-prev" id="hs-prev-btn" onclick="window.hsGoPrev()" disabled>« Trang trước</button></div><div class="hs-pages-list">${pageButtons}</div><div class="hs-nav-btn-wrap hs-next-wrap"><button type="button" class="hs-nav-arrow hs-next" id="hs-next-btn" onclick="window.hsGoNext()">Trang sau »</button></div></div>`;

  // 4. Trust & Authority Strip (Khối Cam Kết Uy Tín Chuẩn Doanh Nghiệp Lớn)
  const trustStripHtml = `
    <div class="hs-trust-strip">
      <div class="hs-trust-col">
        <div class="hs-trust-icon">🛡️</div>
        <div class="hs-trust-text">
          <strong>Chuẩn QCVN Bộ Y Tế</strong>
          <span>Đạt QCVN 6-1:2010/BYT & 01-1:2018/BYT</span>
        </div>
      </div>
      <div class="hs-trust-col">
        <div class="hs-trust-icon">⚡</div>
        <div class="hs-trust-text">
          <strong>Khảo Sát Tận Nơi 2H</strong>
          <span>Kỹ thuật viên lấy mẫu test nước miễn phí</span>
        </div>
      </div>
      <div class="hs-trust-col">
        <div class="hs-trust-icon">⚙️</div>
        <div class="hs-trust-text">
          <strong>Công Nghệ Đa Tầng</strong>
          <span>Linh kiện nhập khẩu Mỹ, Nhật, Ý, Đài Loan</span>
        </div>
      </div>
      <div class="hs-trust-col">
        <div class="hs-trust-icon">📞</div>
        <div class="hs-trust-text">
          <strong>Hotline Kỹ Sư 24/7</strong>
          <span>0938 880 492 – 0906 782 956</span>
        </div>
      </div>
    </div>
  `.trim();

  // 5. Enterprise CTA Banner (Chốt Sale Uy Tín Trước Footer)
  const ctaBannerHtml = `
    <div class="hs-cta-banner">
      <div class="hs-cta-content">
        <span class="hs-cta-pill">TƯ VẤN KỸ THUẬT MIỄN PHÍ</span>
        <h3 class="hs-cta-title">Nguồn Nước Của Bạn Đang Bị Nhiễm Phèn, Cáu Cặn Hay Cần Nâng Cấp Công Nghiệp?</h3>
        <p class="hs-cta-sub">Đội ngũ kỹ sư Lọc Nước Hoa Sen trực tiếp khảo sát hiện trường, kiểm tra mẫu nước tại chỗ và lên phác đồ xử lý tối ưu chi phí nhất.</p>
        <div class="hs-cta-actions">
          <a href="tel:0938880492" class="hs-cta-btn-call">📞 Gọi Kỹ Sư: 0938 880 492</a>
          <a href="https://zalo.me/0938880492" target="_blank" rel="noopener" class="hs-cta-btn-zalo">💬 Chat Zalo Khảo Sát</a>
        </div>
      </div>
    </div>
  `.trim();

  // 6. Masterpiece Footer HTML
  const footerHtml = `
<div class="hs-footer-master">
  <div class="hs-footer-top">
    <div class="hs-footer-brand">
      <span class="hs-logo-badge">HOA SEN WATER GROUP</span>
      <h2 class="hs-company-title">CÔNG TY CỔ PHẦN THIÊN NHIÊN MÔI TRƯỜNG HOA SEN</h2>
      <p class="hs-company-slogan">Thương hiệu giải pháp xử lý nước giếng khoan, lọc phèn, khử sắt, lọc nước sinh hoạt và RO công nghiệp hàng đầu Miền Nam.</p>
    </div>
    <div class="hs-footer-badges">
      <div class="hs-badge-pill"><span class="hs-badge-icon">🛡️</span><div class="hs-badge-info"><strong>QCVN 6-1 & 01-1</strong><span>Bộ Y Tế Chứng Nhận</span></div></div>
      <div class="hs-badge-pill"><span class="hs-badge-icon">🏆</span><div class="hs-badge-info"><strong>Top 1 Xử Lý Nước</strong><span>10+ Năm Kinh Nghiệm</span></div></div>
      <div class="hs-badge-pill"><span class="hs-badge-icon">⚡</span><div class="hs-badge-info"><strong>Khảo Sát 2H</strong><span>Lấy Mẫu Miễn Phí</span></div></div>
    </div>
  </div>
  <div class="hs-footer-grid">
    <div class="hs-col hs-col-main">
      <h3 class="hs-col-title"><span class="hs-dot"></span> TRỤ SỞ CHÍNH & VĂN PHÒNG</h3>
      <div class="hs-hq-card">
        <div class="hs-card-label">TRỤ SỞ CHÍNH TP.HCM</div>
        <div class="hs-item"><span class="hs-icon">📍</span><p>124 Khu Dân Cư Phú Nhuận, Đ. Lê Thị Riêng, P. Thới An, Q.12, TP.HCM</p></div>
        <div class="hs-item"><span class="hs-icon">☎️</span><p>Điện thoại bàn: <strong>(028) 6270 2383</strong></p></div>
      </div>
      <div class="hs-hotline-box">
        <div class="hs-hotline-label">ĐƯỜNG DÂY NÓNG KỸ SƯ 24/7 (BẤM GỌI TRỰC TIẾP)</div>
        <div class="hs-hotline-btns">
          <a href="tel:0938880492" class="hs-hotline-btn">
            <span class="hs-hl-icon-wrap"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg></span>
            <span class="hs-hl-text">
              <span class="hs-hl-tag">Kỹ Thuật Trưởng (24/7):</span>
              <span class="hs-hl-num">0938 880 492</span>
            </span>
          </a>
          <a href="tel:0906782956" class="hs-hotline-btn">
            <span class="hs-hl-icon-wrap"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg></span>
            <span class="hs-hl-text">
              <span class="hs-hl-tag">Tư Vấn Kỹ Thuật 2:</span>
              <span class="hs-hl-num">0906 782 956</span>
            </span>
          </a>
        </div>
      </div>
      <div class="hs-sub-office">
        <div class="hs-item"><span class="hs-icon">🏢</span><p><strong>Văn phòng Hà Nội:</strong> 133 Nguyễn Chánh, Trung Hoà, Cầu Giấy, Hà Nội</p></div>
        <div class="hs-item"><span class="hs-icon">✉️</span><p>Email: <a href="mailto:xulynuochoasen@gmail.com">xulynuochoasen@gmail.com</a></p></div>
        <div class="hs-item"><span class="hs-icon">🌐</span><p>Website: <a href="https://xulynuochoasen.com">www.xulynuochoasen.com</a></p></div>
      </div>
    </div>
    <div class="hs-col hs-col-branches">
      <h3 class="hs-col-title"><span class="hs-dot"></span> HỆ THỐNG 17 CHI NHÁNH & TRẠM KỸ THUẬT</h3>
      <p class="hs-branch-sub">Kỹ thuật viên thường trực tại các trạm sẵn sàng có mặt khảo sát trong 2 giờ:</p>
      <div class="hs-regions-grid">
        <div class="hs-region-block">
          <div class="hs-region-header">📍 KHU VỰC TP. HỒ CHÍ MINH</div>
          <ul class="hs-branch-list">
            <li><strong>Q. Bình Thạnh:</strong> Số 1/38 Trần Bình Trọng, P.5</li>
            <li><strong>TP. Thủ Đức:</strong> 23/5 Phú Châu, Tam Bình</li>
            <li><strong>Quận 7:</strong> 26 Đường Số 16, Khu An Phú Hưng</li>
            <li><strong>Hóc Môn:</strong> 123 Đông Thạnh, Ấp 1, Đông Thạnh</li>
            <li><strong>Tân Phú:</strong> 153/21 Lê Thiệt, Phú Thọ Hòa</li>
            <li><strong>Bình Chánh:</strong> 105 Đường Liên Ấp 2-6, Vĩnh Lộc A</li>
          </ul>
        </div>
        <div class="hs-region-block">
          <div class="hs-region-header">📍 BÌNH DƯƠNG & BÌNH PHƯỚC</div>
          <ul class="hs-branch-list">
            <li><strong>Thủ Dầu Một:</strong> 499 Hồ Văn Cống, TP. TDM</li>
            <li><strong>Bến Cát:</strong> D5, KCN Đồng An 2, Hòa Lợi</li>
            <li><strong>Bình Phước:</strong> 138 Trường Chinh, TP. Đồng Xoài</li>
          </ul>
        </div>
        <div class="hs-region-block">
          <div class="hs-region-header">📍 ĐỒNG NAI & BÀ RỊA VŨNG TÀU</div>
          <ul class="hs-branch-list">
            <li><strong>Biên Hòa 1:</strong> 1229 Bùi Văn Hòa, Long Bình Tân</li>
            <li><strong>Biên Hòa 2:</strong> 45 Nguyễn Tường Tộ, Tân Hòa</li>
            <li><strong>Long Khánh:</strong> 91 Bảo Vinh, TP. Long Khánh</li>
            <li><strong>Nhơn Trạch:</strong> 138 Hùng Vương, Ấp 3 Hiệp Phước</li>
            <li><strong>Vũng Tàu:</strong> 935/17 Bình Giã, Phường 10, TP. Vũng Tàu</li>
          </ul>
        </div>
        <div class="hs-region-block">
          <div class="hs-region-header">📍 LONG AN, LÂM ĐỒNG & ĐÀ NẴNG</div>
          <ul class="hs-branch-list">
            <li><strong>Long An:</strong> Số 9 Đường số 9, Đức Hòa Hạ</li>
            <li><strong>Lâm Đồng:</strong> 69 Hà Huy Tập, TT. Di Linh</li>
            <li><strong>Đà Nẵng:</strong> 15/2 Nguyễn Giản Thanh, Q. Thanh Khê</li>
          </ul>
        </div>
      </div>
    </div>
    <div class="hs-col hs-col-map">
      <h3 class="hs-col-title"><span class="hs-dot"></span> BẢN ĐỒ TRỤ SỞ & SHOWROOM</h3>
      <div class="hs-map-wrapper">
        <iframe src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d31346.37003015678!2d106.659131!3d10.865057!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x317529a997e8dd5b%3A0x48a489170ab7c403!2zS2h1IGTDom4gY8awIFRoxqHMgWkgQW4!5e0!3m2!1svi!2sus!4v1700033224575!5m2!1svi!2sus" width="100%" height="200" style="border:0;" allowfullscreen="" loading="lazy"></iframe>
        <a href="https://maps.google.com/?cid=5234383186252932099" target="_blank" rel="noopener" class="hs-map-btn">📍 Mở Chỉ Đường Showroom Trên Google Maps →</a>
      </div>
      <div class="hs-work-hours">
        <div class="hs-wh-header">⏰ THỜI GIAN PHỤC VỤ</div>
        <div class="hs-wh-content">
          <p><strong>Thứ 2 – Chủ Nhật:</strong> 07:30 – 20:30</p>
          <p><em>(Đội ngũ kỹ thuật viên ứng trực sự cố 24/7 toàn Miền Nam)</em></p>
        </div>
      </div>
    </div>
  </div>
  <div class="hs-footer-payments">
    <div class="hs-pay-label">PHƯƠNG THỨC THANH TOÁN & BẢO ĐẢM AN TOÀN GIAO DỊCH</div>
    <div class="hs-pay-logos">
      <img src="https://xulynuochoasen.com/wp-content/uploads/2022/11/footer_2020_v3-1.png" alt="Phương thức thanh toán an toàn Hoa Sen" loading="lazy" />
    </div>
  </div>
  <div class="hs-footer-bottom">
    <div class="hs-bottom-container">
      <div class="hs-copy">
        <p>© 2026 <strong>CÔNG TY CỔ PHẦN THIÊN NHIÊN MÔI TRƯỜNG HOA SEN</strong>. Tất cả quyền được bảo hộ.</p>
        <p class="hs-cert-text">Quy chuẩn kỹ thuật quốc gia: QCVN 6-1:2010/BYT (Nước uống đóng chai/tinh khiết) & QCVN 01-1:2018/BYT (Nước sinh hoạt).</p>
      </div>
      <div class="hs-legal-links">
        <a href="/gioi-thieu/">Giới Thiệu</a>
        <span class="hs-sep">|</span>
        <a href="/tin-tuc/">Dự Án Thi Công</a>
        <span class="hs-sep">|</span>
        <a href="/lien-he/">Liên Hệ Trực Tiếp</a>
      </div>
    </div>
  </div>
</div>
  `.replace(/\s+/g, ' ').trim();

  // 7. Full Comprehensive CSS (Both Portal and Master Footer)
  const rawCss = `
.hs-news-portal { max-width: 1560px !important; width: 100% !important; margin: 0 auto 50px auto !important; padding: 10px 15px 40px 15px !important; box-sizing: border-box !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; }
.hs-portal-header { text-align: center; margin-bottom: 30px; }
.hs-portal-tagline { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #0284c7; background: #e0f2fe; padding: 5px 16px; border-radius: 20px; margin-bottom: 14px; }
.hs-portal-h1 { font-size: 34px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; letter-spacing: -0.5px; line-height: 1.25; }
.hs-portal-h1 span { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hs-portal-sub { font-size: 16px; color: #64748b; margin: 0 auto; max-width: 860px; line-height: 1.6; }
.hs-trust-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px 24px; margin-bottom: 38px; }
.hs-trust-col { display: flex; align-items: center; gap: 14px; }
.hs-trust-icon { font-size: 26px; flex-shrink: 0; line-height: 1; }
.hs-trust-text { display: flex; flex-direction: column; }
.hs-trust-text strong { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
.hs-trust-text span { font-size: 12.5px; color: #64748b; line-height: 1.35; }
.hs-spotlight-card { position: relative; background: #ffffff; border-radius: 16px; border: 1px solid #cbd5e1; box-shadow: 0 10px 30px -5px rgba(2, 132, 199, 0.1); overflow: hidden; margin-bottom: 42px; transition: all 0.3s ease; }
.hs-spotlight-card:hover { border-color: #38bdf8; box-shadow: 0 15px 35px -5px rgba(2, 132, 199, 0.18); }
.hs-spotlight-badge-corner { position: absolute; top: 16px; left: 16px; z-index: 5; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; font-size: 11.5px; font-weight: 800; padding: 5px 12px; border-radius: 6px; letter-spacing: 0.5px; box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3); }
.hs-spotlight-grid { display: grid; grid-template-columns: 1.2fr 1fr; align-items: stretch; }
.hs-spotlight-thumb { width: 100%; aspect-ratio: 16 / 9; overflow: hidden; position: relative; background-color: #f1f5f9; }
.hs-spotlight-thumb a { display: block; width: 100%; height: 100%; }
.hs-spotlight-img { width: 100% !important; height: 100% !important; object-fit: cover !important; object-position: center !important; display: block; transition: transform 0.4s ease; }
.hs-spotlight-card:hover .hs-spotlight-img { transform: scale(1.02); }
.hs-spotlight-content { padding: 36px 32px; display: flex; flex-direction: column; justify-content: center; }
.hs-spotlight-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.hs-cat-tag { background: #0284c7; color: #ffffff; font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 5px; text-transform: uppercase; }
.hs-date-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600; color: #0284c7; }
.hs-author-tag { font-size: 12.5px; color: #94a3b8; }
.hs-spotlight-title { font-size: 26px; font-weight: 800; line-height: 1.35; margin: 0 0 14px 0; }
.hs-spotlight-title a { color: #0f172a !important; text-decoration: none !important; transition: color 0.2s; }
.hs-spotlight-title a:hover { color: #0284c7 !important; }
.hs-spotlight-desc { font-size: 15px; color: #475569; line-height: 1.65; margin: 0 0 22px 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.hs-btn-primary { display: inline-flex; align-items: center; gap: 8px; background: #0284c7; color: #ffffff !important; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 8px; text-decoration: none !important; transition: all 0.2s ease; width: fit-content; }
.hs-btn-primary:hover { background: #0369a1; transform: translateX(3px); }
.hs-section-label { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; }
.hs-section-title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.3px; display: flex; align-items: center; gap: 10px; }
.hs-section-title::before { content: ""; display: inline-block; width: 5px; height: 20px; background: #0284c7; border-radius: 3px; }
.hs-page-view { display: grid; grid-template-columns: repeat(2, 1fr); gap: 32px 28px; }
.hs-card-item { display: flex; flex-direction: column; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 3px 10px rgba(0,0,0,0.04); transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); margin: 0 !important; }
.hs-card-item:hover { border-color: #38bdf8; box-shadow: 0 12px 30px rgba(2, 132, 199, 0.14); transform: translateY(-4px); }
.hs-card-media { width: 100%; aspect-ratio: 16 / 9; overflow: hidden; position: relative; background-color: #f1f5f9; }
.hs-card-media a { display: block; width: 100%; height: 100%; }
.hs-card-img { width: 100% !important; height: 100% !important; object-fit: cover !important; object-position: center !important; display: block; transition: transform 0.4s ease; }
.hs-card-item:hover .hs-card-img { transform: scale(1.03); }
.hs-media-badge { position: absolute; top: 12px; right: 12px; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(6px); color: #38bdf8; font-size: 12px; font-weight: 800; padding: 4px 12px; border-radius: 6px; letter-spacing: 0.3px; }
.hs-card-info { padding: 22px 24px 24px 24px; display: flex; flex-direction: column; flex: 1; justify-content: space-between; }
.hs-card-meta { display: flex; align-items: center; gap: 10px; font-size: 13px; margin-bottom: 10px; }
.hs-card-date { display: inline-flex; align-items: center; gap: 5px; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 4px 10px; border-radius: 6px; }
.hs-card-author { color: #94a3b8; font-size: 13px; }
.hs-card-heading { font-size: 20px !important; font-weight: 800 !important; line-height: 1.4 !important; margin: 0 0 14px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; word-break: break-word; }
.hs-card-heading a { color: #0f172a !important; text-decoration: none !important; transition: color 0.2s ease; }
.hs-card-heading a:hover { color: #0284c7 !important; }
.hs-card-footer { margin-top: auto; padding-top: 14px; border-top: 1px solid #f1f5f9; }
.hs-card-readmore { display: inline-flex; align-items: center; gap: 6px; font-size: 14.5px; font-weight: 700; color: #0284c7 !important; text-decoration: none !important; transition: all 0.2s ease; }
.hs-card-readmore:hover { gap: 10px; color: #0369a1 !important; }
.hs-pagination-bar { display: flex !important; align-items: center !important; justify-content: center !important; gap: 10px !important; margin: 50px auto !important; padding: 0 !important; width: 100% !important; clear: both !important; }
.hs-pagination-bar p { margin: 0 !important; padding: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.hs-pagination-bar br { display: none !important; }
.hs-nav-btn-wrap { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; }
.hs-nav-arrow { display: inline-flex !important; align-items: center !important; justify-content: center !important; height: 42px !important; min-height: 42px !important; max-height: 42px !important; line-height: 1 !important; vertical-align: middle !important; box-sizing: border-box !important; margin: 0 !important; background: #ffffff !important; border: 1.5px solid #cbd5e1 !important; color: #0284c7 !important; font-weight: 700 !important; font-size: 14.5px !important; padding: 0 20px !important; border-radius: 8px !important; cursor: pointer !important; transition: all 0.2s ease !important; }
.hs-nav-arrow:hover:not(:disabled) { background: #0284c7 !important; color: #ffffff !important; border-color: #0284c7 !important; }
.hs-nav-arrow:disabled { opacity: 0.4 !important; cursor: not-allowed !important; }
.hs-pages-list { display: inline-flex !important; gap: 8px !important; align-items: center !important; margin: 0 !important; padding: 0 !important; }
.hs-p-btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; height: 42px !important; min-height: 42px !important; max-height: 42px !important; min-width: 42px !important; line-height: 1 !important; vertical-align: middle !important; box-sizing: border-box !important; margin: 0 !important; border-radius: 8px !important; border: 1.5px solid #cbd5e1 !important; background: #ffffff !important; color: #334155 !important; font-size: 15px !important; font-weight: 700 !important; cursor: pointer !important; transition: all 0.2s ease !important; padding: 0 10px !important; }
.hs-p-btn:hover { border-color: #0284c7 !important; color: #0284c7 !important; background: #f0f9ff !important; }
.hs-p-btn.hs-p-active { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%) !important; color: #ffffff !important; border-color: #0284c7 !important; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35) !important; }
.hs-cta-banner { background: linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%); border-radius: 16px; padding: 36px 32px; color: #ffffff; text-align: center; box-shadow: 0 10px 25px rgba(2, 132, 199, 0.2); margin-bottom: 20px; }
.hs-cta-pill { display: inline-block; background: rgba(255, 255, 255, 0.18); backdrop-filter: blur(4px); font-size: 11.5px; font-weight: 800; letter-spacing: 1px; padding: 4px 14px; border-radius: 20px; margin-bottom: 12px; }
.hs-cta-title { font-size: 24px; font-weight: 800; color: #ffffff; margin: 0 0 10px 0; line-height: 1.35; max-width: 860px; margin-left: auto; margin-right: auto; }
.hs-cta-sub { font-size: 14.5px; color: #e0f2fe; margin: 0 auto 22px auto; max-width: 760px; line-height: 1.55; }
.hs-cta-actions { display: flex; justify-content: center; gap: 14px; flex-wrap: wrap; }
.hs-cta-btn-call { background: #ffffff; color: #0369a1 !important; font-size: 14px; font-weight: 800; padding: 12px 24px; border-radius: 8px; text-decoration: none !important; box-shadow: 0 4px 12px rgba(0,0,0,0.1); transition: all 0.2s ease; }
.hs-cta-btn-call:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.15); }
.hs-cta-btn-zalo { background: #0068ff; color: #ffffff !important; font-size: 14px; font-weight: 800; padding: 12px 24px; border-radius: 8px; text-decoration: none !important; transition: all 0.2s ease; }
.hs-cta-btn-zalo:hover { background: #0052cc; transform: translateY(-2px); }

/* Ẩn hoàn toàn sidebar và widget bài viết mới của theme OceanWP */
#right-sidebar, aside.sidebar-container, .widget-oceanwp-recent-posts, #ocean_recent_posts-3, #sidebar {
  display: none !important;
  visibility: hidden !important;
  width: 0 !important;
  height: 0 !important;
  max-height: 0 !important;
  overflow: hidden !important;
  opacity: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
}
#primary, .content-area, #content-wrap {
  width: 100% !important;
  max-width: 100% !important;
  float: none !important;
  margin: 0 auto !important;
  padding: 0 !important;
}

/* Masterpiece Luxury Dark Footer */
#footer, footer#footer, .site-footer, #footer-widgets, .elementor-85 { display: none !important; visibility: hidden !important; height: 0 !important; max-height: 0 !important; overflow: hidden !important; opacity: 0 !important; margin: 0 !important; padding: 0 !important; }
.hs-standalone-footer-wrap { width: 100vw !important; position: relative !important; left: 50% !important; right: 50% !important; margin-left: -50vw !important; margin-right: -50vw !important; background: #070f1e !important; border-top: 3px solid #0284c7 !important; box-shadow: 0 -15px 40px rgba(0,0,0,0.4) !important; box-sizing: border-box !important; clear: both !important; }
.hs-footer-master { max-width: 1260px; margin: 0 auto; padding: 50px 20px 25px 20px; color: #cbd5e1; box-sizing: border-box; }
.hs-footer-top { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 26px; margin-bottom: 35px; gap: 24px; flex-wrap: wrap; }
.hs-logo-badge { display: inline-block; background: linear-gradient(135deg, #0284c7 0%, #38bdf8 100%); color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; padding: 3px 10px; border-radius: 4px; margin-bottom: 8px; }
.hs-company-title { font-size: 18.5px; font-weight: 800; color: #ffffff !important; margin: 0 0 6px 0; letter-spacing: 0.3px; line-height: 1.35; }
.hs-company-slogan { font-size: 13.5px; color: #94a3b8; margin: 0; max-width: 650px; line-height: 1.5; }
.hs-footer-badges { display: flex; gap: 14px; flex-wrap: wrap; }
.hs-badge-pill { display: flex; align-items: center; gap: 10px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); padding: 8px 14px; border-radius: 8px; }
.hs-badge-icon { font-size: 20px; }
.hs-badge-info strong { display: block; font-size: 12.5px; color: #ffffff; }
.hs-badge-info span { font-size: 11px; color: #38bdf8; }
.hs-footer-grid { display: grid; grid-template-columns: 1.15fr 1.4fr 1fr; gap: 36px; margin-bottom: 35px; }
.hs-col-title { font-size: 14.5px; font-weight: 800; color: #ffffff !important; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 10px; }
.hs-dot { width: 6px; height: 6px; background: #38bdf8; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #38bdf8; }
.hs-hq-card { background: rgba(2, 132, 199, 0.08); border: 1px solid rgba(2, 132, 199, 0.25); border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
.hs-card-label { font-size: 11px; font-weight: 800; color: #38bdf8; letter-spacing: 1px; margin-bottom: 8px; }
.hs-item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; font-size: 13px; line-height: 1.45; color: #cbd5e1; }
.hs-item:last-child { margin-bottom: 0; }
.hs-item .hs-icon { font-size: 14px; line-height: 1.3; flex-shrink: 0; }
.hs-item p { margin: 0; }
.hs-item a { color: #38bdf8 !important; text-decoration: none !important; }
.hs-item a:hover { color: #ffffff !important; text-decoration: underline !important; }
.hs-hotline-box { margin-bottom: 16px; }
.hs-hotline-label { font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 8px; }
.hs-hotline-btns { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
.hs-hotline-btn {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%) !important;
  color: #ffffff !important;
  text-decoration: none !important;
  padding: 10px 12px !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35) !important;
  border: 1px solid rgba(56, 189, 248, 0.35) !important;
  box-sizing: border-box !important;
  transition: all 0.2s ease !important;
}
.hs-hotline-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 6px 16px rgba(2, 132, 199, 0.55) !important; }
.hs-hl-icon-wrap {
  width: 32px !important;
  height: 32px !important;
  background: rgba(255, 255, 255, 0.2) !important;
  border-radius: 50% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex-shrink: 0 !important;
}
.hs-hl-icon-wrap svg { width: 16px !important; height: 16px !important; fill: #ffffff !important; display: block !important; }
.hs-hl-text {
  display: flex !important;
  flex-direction: column !important;
  line-height: 1.25 !important;
  align-items: flex-start !important;
  text-align: left !important;
}
.hs-hl-tag {
  font-size: 10px !important;
  text-transform: uppercase !important;
  color: #bae6fd !important;
  font-weight: 700 !important;
  letter-spacing: 0.3px !important;
  margin-bottom: 2px !important;
  display: block !important;
}
.hs-hl-num {
  font-size: 13.5px !important;
  font-weight: 800 !important;
  color: #ffffff !important;
  letter-spacing: 0.3px !important;
  white-space: nowrap !important;
  display: block !important;
}
.hs-sub-office { font-size: 12.5px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 12px; }
.hs-branch-sub { font-size: 12px; color: #94a3b8; margin: -10px 0 14px 0; line-height: 1.4; }
.hs-regions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.hs-region-block { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 8px; padding: 10px 12px; }
.hs-region-header { font-size: 11px; font-weight: 800; color: #38bdf8; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: 6px; margin-bottom: 6px; }
.hs-branch-list { list-style: none; margin: 0; padding: 0; }
.hs-branch-list li { font-size: 11.5px; line-height: 1.42; color: #cbd5e1; margin-bottom: 5px; border-bottom: 1px dashed rgba(255, 255, 255, 0.04); padding-bottom: 4px; }
.hs-branch-list li:last-child { margin-bottom: 0; border-bottom: none; }
.hs-branch-list li strong { color: #f8fafc; font-weight: 600; }
.hs-map-wrapper { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow: hidden; padding: 6px; margin-bottom: 14px; }
.hs-map-wrapper iframe { border-radius: 6px; display: block; width: 100%; }
.hs-map-btn { display: block; text-align: center; background: rgba(255, 255, 255, 0.06); color: #38bdf8 !important; font-size: 12px; font-weight: 700; padding: 7px 10px; margin-top: 6px; border-radius: 6px; text-decoration: none !important; transition: all 0.2s ease; }
.hs-map-btn:hover { background: #0284c7; color: #ffffff !important; }
.hs-work-hours { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 8px; padding: 10px 14px; }
.hs-wh-header { font-size: 11.5px; font-weight: 800; color: #f59e0b; letter-spacing: 0.5px; margin-bottom: 4px; }
.hs-wh-content p { margin: 0 0 3px 0; font-size: 12px; color: #cbd5e1; }
.hs-wh-content em { font-size: 11px; color: #94a3b8; }
.hs-footer-payments { background: rgba(255, 255, 255, 0.025); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 10px; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 14px; }
.hs-pay-label { font-size: 12px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; text-transform: uppercase; }
.hs-pay-logos img { max-height: 28px; width: auto; filter: brightness(0.95); display: block; }
.hs-footer-bottom { border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 20px; }
.hs-bottom-container { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; }
.hs-copy p { margin: 0 0 4px 0; font-size: 12.5px; color: #64748b; }
.hs-copy strong { color: #94a3b8; }
.hs-cert-text { font-size: 11.5px; color: #475569 !important; }
.hs-legal-links { display: flex; align-items: center; gap: 10px; }
.hs-legal-links a { color: #64748b !important; font-size: 12.5px; text-decoration: none !important; transition: color 0.2s; }
.hs-legal-links a:hover { color: #38bdf8 !important; }
.hs-sep { color: #334155; font-size: 12px; }
@media (max-width: 1024px) { .hs-trust-strip { grid-template-columns: repeat(2, 1fr); gap: 14px; } .hs-spotlight-grid { grid-template-columns: 1fr; } .hs-spotlight-content { padding: 24px; } .hs-footer-grid { grid-template-columns: 1fr; gap: 28px; } .hs-footer-top { flex-direction: column; align-items: flex-start; } }
@media (max-width: 768px) {
  .hs-trust-strip { display: none !important; }
  .hs-portal-header { margin-bottom: 16px !important; }
  .hs-portal-h1 { font-size: 22px !important; }
  .hs-portal-sub { font-size: 13.5px !important; }
  .hs-spotlight-card { margin-bottom: 24px !important; }
  .hs-spotlight-title { font-size: 17px !important; }
  .hs-page-view { grid-template-columns: 1fr !important; gap: 18px !important; }
  .hs-regions-grid { grid-template-columns: 1fr !important; }
  .hs-hotline-btns { grid-template-columns: 1fr !important; }
  .hs-bottom-container { flex-direction: column !important; align-items: flex-start !important; }
  .hs-company-title { font-size: 16px !important; }
}
@media (max-width: 480px) { .hs-cta-actions { flex-direction: column; } .hs-p-btn { min-width: 32px; height: 32px; font-size: 13px; } .hs-nav-arrow { padding: 6px 10px; font-size: 12px; } }
  `.replace(/\s+/g, ' ').trim();

  // 8. Dynamic Client-side JavaScript
  const footerContentEscaped = JSON.stringify(footerHtml);
  const rawJs = `
(function(){
  var curP = 1;
  var maxP = ${totalPages};
  window.hsGoToPage = function(p) {
    if (p < 1 || p > maxP) return;
    curP = p;
    for (var i = 1; i <= maxP; i++) {
      var el = document.getElementById('hs-page-view-' + i);
      if (el) el.style.display = (i === curP) ? 'grid' : 'none';
    }
    var btns = document.querySelectorAll('.hs-p-btn');
    btns.forEach(function(b){
      var bp = parseInt(b.getAttribute('data-page'), 10);
      if (bp === curP) { b.classList.add('hs-p-active'); } else { b.classList.remove('hs-p-active'); }
    });
    var pBtn = document.getElementById('hs-prev-btn');
    var nBtn = document.getElementById('hs-next-btn');
    if (pBtn) pBtn.disabled = (curP === 1);
    if (nBtn) nBtn.disabled = (curP === maxP);
    var targetSec = document.querySelector('.hs-section-label');
    if (targetSec) {
      targetSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  window.hsGoPrev = function() { window.hsGoToPage(curP - 1); };
  window.hsGoNext = function() { window.hsGoToPage(curP + 1); };

  function renderEnterpriseFooter() {
    var footer = document.getElementById('footer');
    if (!footer) return;
    var inner = document.getElementById('footer-inner') || footer;
    inner.innerHTML = ${footerContentEscaped};
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderEnterpriseFooter);
  } else {
    renderEnterpriseFooter();
  }
})();
  `.replace(/\s+/g, ' ').trim();

  return `
<style id="hs-news-min-css">${rawCss}</style>
<div class="hs-news-portal">
  <div class="hs-portal-header">
    <div class="hs-portal-tagline">🏆 TRUNG TÂM TIN TỨC & DỰ ÁN THỰC TẾ</div>
    <h1 class="hs-portal-h1">CÔNG NGHỆ NƯỚC SẠCH & <span>TIẾN ĐỘ THI CÔNG</span></h1>
    <p class="hs-portal-sub">Cập nhật liên tục các công trình lắp đặt hệ thống lọc nước công nghiệp, lọc nước giếng khoan và giải pháp sinh hoạt chuẩn QCVN Bộ Y Tế từ Lọc Nước Hoa Sen.</p>
  </div>
  ${trustStripHtml}
  ${featuredHtml}
  <div class="hs-section-label">
    <div class="hs-section-title">Danh Sách Báo Cáo Thi Công & Cẩm Nang Chuyên Sâu</div>
  </div>
  <div class="hs-views-container">
    ${pagesHtml}
  </div>
  ${paginationBar}
  ${ctaBannerHtml}
</div>
<script id="hs-news-min-js">${rawJs}</script>
  `.trim();
}

/**
 * Tự động đồng bộ toàn diện trang Tin Tức & Chân Trang Doanh Nghiệp trên WordPress
 * @param {number} limit Số lượng bài viết mới nhất hiển thị trên trang tin tức (mặc định 60)
 * @returns {Promise<{success: boolean, message: string, totalPosts: number}>}
 */
async function syncTinTucArchivePage({ limit = 60 } = {}) {
  try {
    const wpConfig = getWPConfig();
    if (!wpConfig.siteUrl || !wpConfig.username || !wpConfig.appPassword) {
      return { success: false, message: 'Chưa cấu hình WordPress credentials' };
    }
    const auth = getAuthHeader(wpConfig);

    // 1. Lấy 60 bài viết mới nhất kèm thumbnail
    const posts = await fetchPosts(wpConfig, auth, limit);
    if (!posts || posts.length === 0) {
      return { success: false, message: 'Không lấy được danh sách bài viết từ WordPress' };
    }

    // 2. Sinh mã HTML/CSS chuẩn tạp chí tập đoàn lớn kèm Luxury Footer
    const htmlContent = buildEnterpriseArchiveHtml(posts);

    // 3. Cập nhật nội dung cho Page 3906 (Tin Tức)
    const pageId = 3906;
    await updatePage(wpConfig, auth, pageId, {
      title: 'Tin Tức',
      content: htmlContent
    });

    // 4. Đảm bảo page_for_posts = 0 để WordPress load trực tiếp Page content
    await updateSettings(wpConfig, auth, { page_for_posts: 0 });

    console.log(`[TinTucArchive] ✅ Đã đồng bộ thành công trang Tin Tức & Chân Trang Luxury (${posts.length} bài viết)!`);
    return {
      success: true,
      message: `Đồng bộ thành công ${posts.length} bài viết và chân trang chuẩn tập đoàn`,
      totalPosts: posts.length
    };
  } catch (err) {
    console.error('[TinTucArchive] ❌ Lỗi khi đồng bộ trang Tin Tức:', err.message);
    return {
      success: false,
      message: err.message
    };
  }
}

module.exports = {
  syncTinTucArchivePage,
  buildEnterpriseArchiveHtml,
  formatDate
};
