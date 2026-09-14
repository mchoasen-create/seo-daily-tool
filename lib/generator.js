const fs = require('fs');
const path = require('path');
const { getCustomMedia, findMatchingCustomImage, getTwoDistinctRotatedImages } = require('./custom_media');
const { checkDuplicateTitle } = require('./crawler');

// Helper to gather image URLs already used in existing posts
function getRecentUsedImages() {
  try {
    const pFile = path.join(__dirname, '../data/posts.json');
    if (fs.existsSync(pFile)) {
      const posts = JSON.parse(fs.readFileSync(pFile, 'utf8') || '[]');
      const urls = [];
      posts.slice(0, 30).forEach(p => {
        if (p.imageUrl) urls.push(p.imageUrl);
        if (p.secondaryImageUrl) urls.push(p.secondaryImageUrl);
      });
      return urls;
    }
  } catch (e) {}
  return [];
}

// Generate SEO Title: strictly 50 - 65 characters with keyword, avoiding live blog duplicates
function generateUniqueTitle(cleanKw, domainKey, hash) {
  const titlesByDomain = {
    phen: [
      `Giải Pháp ${cleanKw} Triệt Để Cho Gia Đình Chuẩn BYT 2026`,
      `Công Nghệ ${cleanKw} Khử Sắt Và Mangan Hiệu Quả Nhất 2026`,
      `Hướng Dẫn ${cleanKw} Giếng Ngầm Đạt Chuẩn Bộ Y Tế 2026`,
      `Cẩm Nang ${cleanKw} Hóa Học Khử Mùi Tanh Và Vàng Đục 2026`
    ],
    sinh_hoat: [
      `Hệ Thống ${cleanKw} Đầu Nguồn Toàn Diện Mới Nhất 2026`,
      `Giải Pháp ${cleanKw} Khử Clo Dư Và Làm Mềm Nước Cứng 2026`,
      `Cẩm Nang Lắp Đặt ${cleanKw} Cho Biệt Thự Nhà Phố 2026`,
      `Bí Quyết Chọn Mua Cột ${cleanKw} Bền Đẹp Chuẩn Y Tế 2026`
    ],
    gieng_khoan: [
      `Xử Lý ${cleanKw} Nhiễm Khí Độc Và Kim Loại Nặng 2026`,
      `Giải Pháp ${cleanKw} Không Cần Xây Bể Lắng Tốn Kém 2026`,
      `Công Nghệ ${cleanKw} Khử Mùi Trứng Thối Triệt Để 2026`,
      `Cẩm Nang ${cleanKw} Sâu Nhiễm Phèn Asen Đạt Chuẩn 2026`
    ],
    tinh_khiet: [
      `Dây Chuyền ${cleanKw} Uống Trực Tiếp Chuẩn RO 2026`,
      `Hệ Thống ${cleanKw} Màng RO Tách Lọc Phân Tử Siêu Vi 2026`,
      `Quy Trình Sản Xuất Nước Đóng Bình Với ${cleanKw} 2026`,
      `Cẩm Nang Vận Hành Hệ Thống ${cleanKw} Đạt Chuẩn BYT 2026`
    ],
    man: [
      `Công Nghệ ${cleanKw} Khử Muối Thành Nước Ngọt Mới Nhất 2026`,
      `Giải Pháp ${cleanKw} Bằng Màng SWRO Cứu Hạn Mặn Mới 2026`,
      `Hệ Thống ${cleanKw} Ven Biển Tưới Cây Ăn Trái Chuẩn 2026`,
      `Kinh Nghiệm Chọn Máy ${cleanKw} Bền Bỉ Tiết Kiệm Điện 2026`
    ],
    cong_nghiep: [
      `Hệ Thống ${cleanKw} Công Suất Lớn Cho Nhà Máy 2026`,
      `Dây Chuyền ${cleanKw} Cấp Nước Lò Hơi Khử Khoáng EDI 2026`,
      `Giải Pháp ${cleanKw} Tự Động Hóa Scada Cho Nhà Xưởng 2026`,
      `Quy Trình Thiết Kế Trạm ${cleanKw} B2B Chuẩn ISO 2026`
    ],
    general: [
      `Giải Pháp ${cleanKw} Đạt Chuẩn Bộ Y Tế Tối Ưu Mới Nhất 2026`,
      `Cẩm Nang Lắp Đặt Hệ Thống ${cleanKw} Toàn Diện A-Z 2026`,
      `Bí Quyết Chọn Cấu Hình ${cleanKw} Bền Đẹp Tiết Kiệm 2026`,
      `Quy Trình Kiểm Tra Chất Lượng Nước Qua ${cleanKw} 2026`
    ]
  };

  const pool = titlesByDomain[domainKey] || titlesByDomain.general;
  
  // Filter out any title that duplicates or heavily overlaps with live blog posts on xulynuochoasen.com
  let title = '';
  for (let i = 0; i < pool.length; i++) {
    const candidate = pool[(Math.abs(hash) + i) % pool.length];
    const dup = checkDuplicateTitle(candidate);
    if (!dup.isDuplicate) {
      title = candidate;
      break;
    }
  }

  if (!title) {
    const prefixes = ['Cẩm Nang Kỹ Thuật', 'Giải Pháp Thực Tế', 'Đột Phá Công Nghệ', 'Quy Trình Thi Công'];
    const p = prefixes[Math.abs(hash) % prefixes.length];
    title = `${p} ${cleanKw} Chuẩn Bộ Y Tế 2026`;
  }

  if (title.length < 50) title = `${title} Tối Ưu`;
  if (title.length > 65) title = title.substring(0, 62).trim() + '...';
  return title;
}

// Generate Meta Description: strictly 140 - 158 characters with keyword
function generateUniqueMeta(cleanKw, domainKey, hash) {
  const metaByDomain = {
    phen: [
      `Tìm hiểu quy trình ${cleanKw.toLowerCase()} triệt để bảo vệ sức khỏe gia đình. Báo giá cột lọc composite khử phèn sắt hiệu quả cao từ Lọc Nước Hoa Sen.`,
      `Cẩm nang kỹ thuật ${cleanKw.toLowerCase()} bằng giàn mưa và quặng mangan greensand. Nước trong vắt đạt chuẩn an toàn vệ sinh từ Lọc Nước Hoa Sen.`
    ],
    sinh_hoat: [
      `Giải pháp ${cleanKw.toLowerCase()} đầu nguồn toàn diện loại bỏ tạp chất, khử mùi clo và làm mềm nước cứng. Khảo sát lắp đặt tận nơi từ Lọc Nước Hoa Sen.`,
      `Bí quyết chọn mua hệ thống ${cleanKw.toLowerCase()} bảo vệ đồ gia dụng và sức khỏe da tóc cả nhà. Tư vấn chuyên sâu miễn phí từ Lọc Nước Hoa Sen.`
    ],
    gieng_khoan: [
      `Cẩm nang kỹ thuật xử lý ${cleanKw.toLowerCase()} bị vàng, có mùi tanh hôi và nhiễm độc tố asen. Cam kết đạt chuẩn sinh hoạt từ Lọc Nước Hoa Sen.`,
      `Giải pháp xử lý ${cleanKw.toLowerCase()} bằng bộ trộn khí ejector cao áp không cần xây bể lắng cồng kềnh. Khảo sát tận nơi từ Lọc Nước Hoa Sen.`
    ],
    tinh_khiet: [
      `Hệ thống ${cleanKw.toLowerCase()} ứng dụng màng thẩm thấu ngược RO cao cấp mang lại nguồn nước uống trực tiếp đạt chuẩn. Báo giá từ Lọc Nước Hoa Sen.`,
      `Dây chuyền ${cleanKw.toLowerCase()} màng RO công nghệ màng siêu vi loại bỏ 99.9% vi khuẩn và ion kim loại. Tư vấn lắp đặt từ Lọc Nước Hoa Sen.`
    ],
    man: [
      `Giải pháp ${cleanKw.toLowerCase()} thành nước ngọt ứng dụng màng lọc SWRO cao cấp giúp bà con vùng ven biển giải quyết hạn mặn. Liên hệ Lọc Nước Hoa Sen.`,
      `Công nghệ ${cleanKw.toLowerCase()} khử mặn triệt để cho cây sầu riêng và sinh hoạt gia đình hải đảo. Báo giá ưu đãi từ Lọc Nước Hoa Sen.`
    ],
    cong_nghiep: [
      `Dây chuyền ${cleanKw.toLowerCase()} công suất lớn từ 1000L đến 50000L mỗi giờ cho nhà xưởng, khu chế xuất và tòa nhà. Báo giá từ Lọc Nước Hoa Sen.`,
      `Hệ thống ${cleanKw.toLowerCase()} khử khoáng DI và EDI cấp nước lò hơi và sản xuất vi mạch bán dẫn. Khảo sát tận nơi từ Lọc Nước Hoa Sen.`
    ],
    general: [
      `Tìm hiểu giải pháp ${cleanKw.toLowerCase()} chuyên sâu giúp bảo vệ sức khỏe và kéo dài tuổi thọ thiết bị. Tư vấn khảo sát tận nơi từ Lọc Nước Hoa Sen.`,
      `Cẩm nang toàn diện về ${cleanKw.toLowerCase()} đạt chuẩn QCVN của Bộ Y Tế. Lắp đặt trọn gói chuyên nghiệp uy tín hàng đầu từ Lọc Nước Hoa Sen.`
    ]
  };

  const pool = metaByDomain[domainKey] || metaByDomain.general;
  let meta = pool[Math.abs(hash) % pool.length];

  if (meta.length < 135) meta += ' Cam kết uy tín và bảo hành chính hãng dài lâu.';
  if (meta.length > 165) meta = meta.substring(0, 158).trim() + '...';
  return meta;
}

// Detect domain key
function detectDomain(cleanKw) {
  const lk = cleanKw.toLowerCase();
  if (lk.includes('công nghiệp') || lk.includes('nhà máy') || lk.includes('xưởng') || lk.includes('lò hơi')) return 'cong_nghiep';
  if (lk.includes('mặn') || lk.includes('khử muối') || lk.includes('nước biển')) return 'man';
  if (lk.includes('tinh khiết') || lk.includes('uống') || lk.includes('ro') || lk.includes('đóng bình')) return 'tinh_khiet';
  if (lk.includes('giếng') || lk.includes('nước ngầm')) return 'gieng_khoan';
  if (lk.includes('sinh hoạt') || lk.includes('đầu nguồn') || lk.includes('nước máy') || lk.includes('chung cư') || lk.includes('biệt thự')) return 'sinh_hoat';
  if (lk.includes('phèn') || lk.includes('sắt') || lk.includes('khử phèn')) return 'phen';
  return 'general';
}

function generateSmartSeoTemplate(topic, keyword, tone = 'Thuyết phục & Chuẩn SEO', customTargetUrl = '', options = {}) {
  const cleanKw = (keyword || topic || '').trim();
  const cleanTopic = (topic || keyword || '').trim();

  // Pick 2 non-overlapping rotated images
  const recentImages = getRecentUsedImages();
  const { img1, img2 } = getTwoDistinctRotatedImages(cleanKw, recentImages);

  const combinedSeed = (cleanTopic && cleanTopic.length > 5 ? cleanTopic : '') + ' ' + cleanKw + ' ' + (options.seed || '');
  let hash = 0;
  for (let i = 0; i < combinedSeed.length; i++) {
    hash = (hash << 5) - hash + combinedSeed.charCodeAt(i);
    hash |= 0;
  }

  const domain = detectDomain(cleanKw);
  let title = (cleanTopic.length >= 25 && cleanTopic.toLowerCase() !== cleanKw.toLowerCase())
    ? cleanTopic
    : generateUniqueTitle(cleanKw, domain, hash);

  if (title.length > 65) title = title.substring(0, 62).trim() + '...';
  if (title.length < 50) title = `${title} Chuyên Sâu 2026`;
  if (title.length > 65) title = title.substring(0, 62).trim() + '...';

  const metaDescription = generateUniqueMeta(cleanKw, domain, hash);

  // Exact Google AdWords Landing Pages on xulynuochoasen.com
  const GOOGLE_ADS_LINKS = {
    sinh_hoat: 'https://xulynuochoasen.com/he-thong-loc-nuoc-sinh-hoat/',
    phen: 'https://xulynuochoasen.com/he-thong-loc-nuoc-nhiem-phen/',
    gieng_khoan: 'https://xulynuochoasen.com/he-thong-loc-nuoc-nhiem-phen/',
    cong_nghiep: 'https://xulynuochoasen.com/he-thong-loc-nuoc-cong-nghiep/',
    tinh_khiet: 'https://xulynuochoasen.com/he-thong-loc-nuoc-tinh-khiet/',
    man: 'https://xulynuochoasen.com/he-thong-loc-nuoc-man/',
    general: 'https://xulynuochoasen.com/he-thong-loc-nuoc-sinh-hoat/'
  };

  let targetProductUrl = (customTargetUrl || '').trim();
  if (!targetProductUrl || targetProductUrl.includes('/san-pham/') || targetProductUrl === 'https://xulynuochoasen.com/' || targetProductUrl === 'https://xulynuochoasen.com') {
    targetProductUrl = GOOGLE_ADS_LINKS[domain] || GOOGLE_ADS_LINKS.general;
  }

  // Generate diverse multi-variant contents
  const variants = getDomainTemplateVariants(domain, title, cleanKw, targetProductUrl, img1, img2);

  // Smart Anti-Duplicate Selection:
  // Test each variant against existing posts in posts.json and choose the one with LOWEST similarity!
  let selectedContent = variants[Math.abs(hash) % variants.length];
  try {
    const DATA_DIR = path.join(__dirname, '../data');
    const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
    if (fs.existsSync(POSTS_FILE)) {
      const posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8') || '[]');
      const { calculateJaccardSimilarity } = require('./crawler');

      let lowestMaxSim = Infinity;
      let bestV = selectedContent;

      for (let vIdx = 0; vIdx < variants.length; vIdx++) {
        const v = variants[vIdx];
        let maxSimForV = 0;
        for (const ep of posts) {
          if (!ep.content || (options.excludePostId && ep.id === options.excludePostId)) continue;
          const sim = calculateJaccardSimilarity(v.substring(0, 1500), ep.content.substring(0, 1500));
          if (sim > maxSimForV) maxSimForV = sim;
        }
        if (maxSimForV < lowestMaxSim) {
          lowestMaxSim = maxSimForV;
          bestV = v;
        }
      }
      selectedContent = bestV;
    }
  } catch (err) {
    selectedContent = variants[Math.abs(hash) % variants.length];
  }

  // Common closing & CTA
  selectedContent += `\n\n---\n\n## Lời Kết\n\nĐầu tư giải pháp **${cleanKw}** chính là quyết định sáng suốt nhất để bảo vệ sức khỏe lâu dài cho gia đình và nâng tầm giá trị cuộc sống. Hãy liên hệ ngay với [Lọc Nước Hoa Sen](https://xulynuochoasen.com) để được các chuyên gia kỹ thuật hàng đầu phục vụ tận tình!\n\n👉 **Sản Phẩm Đúng Chuyên Mục:** [Xem Sản Phẩm Tương Ứng](${targetProductUrl}) - *Giải pháp kỹ thuật chuyên sâu đạt chuẩn Bộ Y Tế.*\n\n<div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px; padding: 24px; color: #ffffff; margin: 30px 0; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.3); border: 1px solid #334155; text-align: center;">\n  <h3 style="color: #38bdf8; margin-top: 0; font-size: 1.4em; font-weight: 700;">📞 CÔNG TY CỔ PHẦN THIÊN NHIÊN VÀ MÔI TRƯỜNG HOA SEN</h3>\n  <p style="color: #cbd5e1; font-size: 1.05em; margin-bottom: 18px;">Chuyên gia giải pháp xử lý <strong>${cleanKw}</strong> chuyên sâu đạt chuẩn Bộ Y Tế trên toàn quốc.</p>\n  <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 15px;">\n    <a href="tel:0938880492" style="background: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 30px; text-decoration: none; font-weight: bold; display: inline-flex; align-items: center; gap: 8px;">\n      📱 Hotline Tư Vấn: 0938 880 492\n    </a>\n    <a href="https://zalo.me/0938880492" target="_blank" rel="noopener" style="background: #0284c7; color: #ffffff; padding: 12px 24px; border-radius: 30px; text-decoration: none; font-weight: bold; display: inline-flex; align-items: center; gap: 8px;">\n      💬 Zalo Báo Giá 24/7: 0938 880 492\n    </a>\n  </div>\n  <p style="font-size: 0.9em; color: #94a3b8; margin: 0;">📍 <em>Khảo sát &amp; xét nghiệm mẫu nước tận nơi miễn phí tại TP.HCM, Bình Dương, Đồng Nai, Long An và toàn miền Nam.</em></p>\n</div>`;

  return {
    title,
    metaDescription,
    content: selectedContent,
    imageUrl: img1,
    secondaryImageUrl: img2,
    score: 100,
    targetProductUrl
  };
}

function getDomainTemplateVariants(domain, title, cleanKw, targetProductUrl, img1, img2) {
  const variants = [];

  // =========================================================================
  // DOMAIN 1: GIẾNG KHOAN (3 Distinct Multi-Angle Variants)
  // =========================================================================
  if (domain === 'gieng_khoan') {
    // Variant 0: Inline Aeration & Ejector
    variants.push(`# ${title}

Nguồn nước ngầm tại Việt Nam đang đối mặt với nguy cơ suy thoái và ô nhiễm hóa chất nghiêm trọng, khiến việc đầu tư trạm **${cleanKw}** trở thành nhu cầu cấp bách của bà con nông thôn và các doanh nghiệp sản xuất. Khác với nước bề mặt, nước ngầm nằm sâu trong các tầng trầm tích chứa nhiều khí độc hòa tan, độc tố Asen và kim loại nặng. Bài viết này hướng dẫn phương pháp xử lý chuyên sâu triệt để, không cần xây bể lắng truyền thống cồng kềnh.

<div style="background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; padding: 16px 20px; border-radius: 8px; margin: 22px 0;">
  <strong style="font-size: 1.1em; color: #b91c1c;">⚠️ Mối nguy hiểm tiềm ẩn trong nguồn nước giếng chưa qua xử lý:</strong>
  <ul style="margin-top: 8px; margin-bottom: 0; padding-left: 20px; color: #7f1d1d; line-height: 1.7;">
    <li>Khí Hydro Sunfua ($H_2S$) gây mùi trứng thối nồng nặc và khí Metan dễ cháy tích tụ trong bể ngầm.</li>
    <li>Độc tố Asen (thạch tín) - sát thủ thầm lặng gây ung thư da, tổn thương gan thận mà mắt thường không thể phát hiện.</li>
    <li>Hàm lượng Amoni ($NH_4^+$) và Nitrit cao do ngấm phân bón hóa học và nước thải sinh hoạt nông nghiệp.</li>
  </ul>
</div>

[![${title}](${img1})](${targetProductUrl})

---

## 1. Phân Tích Địa Chất Và Các Tạp Chất Phức Tạp Trong Nước Ngầm

Khi khoan giếng ở độ sâu từ 30m đến 120m, dòng nước ngầm đi qua nhiều tầng trầm tích địa chất khác nhau:
* **Tầng chứa phèn chua và Mangan**: Nước bơm lên có cảm giác trong veo nhưng sau vài giờ tiếp xúc oxy sẽ kết tủa váng vàng dày đặc, đóng cặn đen kịt trên bề mặt gạch men.
* **Tầng nhiễm khí độc $H_2S$**: Do quá trình phân hủy hữu cơ kỵ khí sâu trong lòng đất, sinh ra khí hydro sunfua có mùi tanh hôi như trứng thối. Giải pháp kỹ thuật bắt buộc phải có bước sục khí giải phóng khí độc này trước khi đi vào cột lọc.
* **Nhiễm khuẩn Coliform và E.Coli**: Các giếng khoan nông gần khu chăn nuôi hoặc hầm tự hoại thường bị vi khuẩn thâm nhập, gây tiêu chảy cấp và các bệnh đường ruột nguy hiểm nếu chưa qua hệ thống lọc áp lực.

---

## 2. Công Nghệ Oxy Hóa Áp Lực Ejector - Bước Đột Phá Mới

Trước đây, người dân thường phải xây bể lắng lọc cát thủ công bằng xi măng rất tốn diện tích, dễ bị rêu mốc và hiệu quả lọc không cao. Ngày nay, giải pháp **${cleanKw}** của Lọc Nước Hoa Sen áp dụng thiết bị trộn khí Ejector cao áp:

1. **Bộ Ejector trộn khí chuyên dụng**: Được lắp ngay trên đường ống đẩy của máy bơm giếng khoan. Khi dòng nước đi qua khe hẹp venturi sẽ tạo độ chân không hút một lượng không khí khổng lồ từ ngoài vào, xé nhỏ dòng nước thành hàng triệu tia sương li ti.
2. **Khí độc thoát ra ngoài tức thì**: Khí $H_2S$ và $CO_2$ bị bẻ gãy liên kết và thoát ra khỏi dòng nước qua van xả khí tự động.
3. **Phản ứng oxy hóa siêu tốc**: $Fe^{2+}$ và $Mn^{2+}$ hòa tan gặp lượng oxy dồi dào trong buồng trộn sẽ chuyển hóa thành kết tủa $Fe(OH)_3$ chỉ trong vài giây, sẵn sàng cho các cột lọc áp lực giữ lại hoàn toàn.

[![${title} sục khí và lọc áp lực](${img2})](${targetProductUrl})

---

## 3. Quy Trình Phối Trộn Vật Liệu Đa Tầng Xử Lý Nước Giếng

Hệ thống cột lọc áp lực được tính toán chính xác tỷ lệ giữa các lớp hạt lọc nhằm tối ưu hóa diện tích tiếp xúc:
* **Quặng Mangan Dioxide tự nhiên**: Có hàm lượng $MnO_2$ > 40%, đóng vai trò chất xúc tác cực mạnh giúp khử sạch phèn sắt và kim loại Mangan.
* **Hạt Birm Clack (Nhập Khẩu Mỹ)**: Vật liệu lọc chuyên sâu không thể thiếu trong các công trình chất lượng cao, có độ bền cơ học cao và không bị hao mòn theo thời gian.
* **Hạt Cation Hấp Thụ Canxi**: Xử lý triệt để tình trạng nước giếng bị cứng, đun sôi có cặn trắng vôi bám đáy nồi.
* **Than Hoạt Tính Khử Độc Asen**: Lớp than hoạt tính gáo dừa có cấu trúc vi xốp hấp phụ hoàn toàn các hợp chất hữu cơ độc hại và kim loại nặng nguy hiểm.

---

## 4. Bảng So Sánh Chỉ Tiêu Nước Giếng Đạt Chuẩn Sau Lọc

| Chỉ tiêu xét nghiệm | Nước giếng khoan nguyên bản | Sau khi qua hệ thống ${cleanKw} | Quy chuẩn nước sinh hoạt BYT |
| :--- | :--- | :--- | :--- |
| **Mùi vị cảm quan** | Mùi tanh nồng, hôi mùi trứng thối | **Hoàn toàn không mùi, vị ngọt mát** | Không có mùi lạ |
| **Hàm lượng Sắt tổng (Fe)** | 6.5 mg/L (Vượt ngưỡng 20 lần) | **< 0.1 mg/L (Nước trong vắt)** | < 0.3 mg/L |
| **Chỉ số Asen (Thạch tín)** | 0.05 mg/L (Cực kỳ nguy hiểm) | **< 0.005 mg/L (An toàn tuyệt đối)** | < 0.01 mg/L |
| **Hàm lượng Amoni ($NH_4^+$)** | 4.2 mg/L | **< 0.3 mg/L** | < 0.3 mg/L |
| **Độ cứng ($CaCO_3$)** | 380 mg/L (Nhiễm vôi nặng) | **< 60 mg/L (Nước mềm tiêu chuẩn)** | < 300 mg/L |

---

## 5. Những Lưu Ý Quan Trọng Khi Sử Dụng Cột Lọc Áp Lực

Để thiết bị hoạt động bền bỉ nhiều năm liền, bà con và quý khách hàng cần lưu ý:
1. **Lắp đặt mái che bảo vệ**: Mặc dù cột Composite chống tia cực tím tốt, việc có mái che thoáng mát sẽ giúp bảo vệ van điện tử và đường ống khỏi giòn vỡ do nắng mưa nhiệt đới.
2. **Tuân thủ lịch xả cặn định kỳ**: Mỗi tuần một lần nên vặn van xả ngược từ 10 đến 15 phút để tống khứ lớp bùn phèn tích tụ dày đặc trong cột lọc.
3. **Kiểm tra máy bơm định kỳ**: Đảm bảo áp lực nước bơm đầu vào đạt tối thiểu 1.5 đến 2.5 bar để các lớp vật liệu lọc được xáo trộn làm sạch triệt để khi sục rửa.

---

## 6. Giải Đáp Thắc Mắc Kỹ Thuật (FAQ)

### Q1: Nước giếng khoan nhiễm phèn mặn có dùng cột lọc thông thường được không?
> **Trả lời**: Nếu nước giếng vừa nhiễm phèn vừa nhiễm mặn (chỉ số TDS cao > 1000 ppm), hệ thống cần kết hợp cột lọc phèn thô ở đầu nguồn và màng thẩm thấu ngược RO chuyên dụng để khử mặn hoàn toàn.

### Q2: Chi phí lắp đặt một bộ thiết bị gia đình hoàn chỉnh khoảng bao nhiêu?
> **Trả lời**: Giá lắp đặt trọn gói dao động từ 4 triệu đến 15 triệu tùy thuộc vào chất liệu cột (Composite hay Inox 304), công suất lọc và mức độ ô nhiễm thực tế của mẫu nước.`);

    // Variant 1: Elimination of settling basins + pressurized catalytic towers
    variants.push(`# ${title}

Giải pháp loại bỏ hoàn toàn bể lắng thủ công truyền thống bằng công nghệ tháp oxy hóa kín và cột lọc xúc tác cao áp là cuộc cách mạng trong xử lý nước ngầm giếng khoan. Đối với các khu vực thành thị, nhà phố diện tích hẹp hoặc nông trại cần công suất cấp nước lớn, việc xây dựng bể lắng xi măng cồng kềnh thường phát sinh chi phí cao, chiếm diện tích mặt bằng và dễ sinh muỗi mòng rêu mốc. Bài viết này phân tích giải pháp kỹ thuật khép kín hiện đại, giúp lọc sạch phèn sắt, Mangan và khí độc trực tiếp từ đầu bơm lên bồn chứa.

<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #22c55e; padding: 16px 20px; border-radius: 8px; margin: 22px 0;">
  <strong style="font-size: 1.1em; color: #15803d;">💡 Ưu điểm vượt trội của giải pháp lọc trực tiếp không cần bể lắng:</strong>
  <ul style="margin-top: 8px; margin-bottom: 0; padding-left: 20px; color: #166534; line-height: 1.7;">
    <li>Tiết kiệm tới 90% diện tích lắp đặt so với bể xây gạch xi măng truyền thống.</li>
    <li>Thi công và bàn giao hoàn thiện ngay trong ngày, không cần chờ bảo dưỡng bê tông.</li>
    <li>Hệ thống vận hành kín hoàn toàn, ngăn chặn 100% bụi bẩn, côn trùng và rêu xanh phát triển.</li>
  </ul>
</div>

[![${title}](${img1})](${targetProductUrl})

---

## 1. Tại Sao Bể Lắng Truyền Thống Đang Dần Bị Đào Thải?

Phương pháp lắng lọc trọng lực cổ điển sử dụng các lớp cát xây dựng trong bể xi măng tồn tại nhiều nhược điểm chí tử:
* **Tốc độ oxy hóa chậm chạp**: Nước giếng chảy tự do trên bề mặt giàn mưa tiếp xúc diện tích hạn chế, cần hàng chục tiếng đồng hồ để sắt Fe2+ kết tủa hoàn toàn.
* **Tắc nghẽn màng lọc sinh học**: Lớp bùn phèn màu vàng cam nhanh chóng bịt kín các khe hở của cát, khiến lưu lượng nước giảm nghiêm trọng chỉ sau vài tuần vận hành.
* **Khó khăn khi vệ sinh sục rửa**: Người dùng phải trèo vào lòng bể để cào xới lớp cát bẩn bằng tay, vừa mất thời gian vừa dễ gây ô nhiễm chéo nguồn nước ngầm.

---

## 2. Nguyên Lý Vận Hành Của Trạm Lọc Khép Kín Áp Lực Cao

Hệ thống xử lý thế hệ mới kết hợp giữa buồng tạo khí chân không áp lực cao và cột lọc vật liệu đa tầng:
1. **Pha hòa trộn khí nén siêu nhỏ**: Bơm tăng áp đẩy nước qua cụm trộn khí, bẻ gãy liên kết hydro và phân tán bọt khí micro-bubble vào sâu trong từng giọt nước.
2. **Tầng phản ứng xúc tác khô**: Nước giàu oxy đi qua bề mặt hạt quặng catalytic dioxide làm tốc độ chuyển hóa ion kim loại tăng gấp 300 lần so với điều kiện tự nhiên.
3. **Cơ chế tách cặn trọng lực cưỡng bức**: Các bông kết tủa Fe(OH)3 và MnO2 bị các khe lọc của cát thạch anh đã phân cấp kích thước giữ lại trọn vẹn ở tầng trên cùng của cột áp lực.

[![${title} sơ đồ vận hành](${img2})](${targetProductUrl})

---

## 3. Cấu Hình Vật Liệu Lọc Đa Tầng Chuẩn Quốc Tế

Một trạm lọc áp lực cao chuẩn mực của Hoa Sen được bố trí theo thứ tự tỷ trọng từ nặng đến nhẹ:
* **Lớp sỏi đỡ thạch anh 3-5mm**: Chống trôi vật liệu và phân bổ đều dòng chảy thu nước sạch ở đáy cột.
* **Lớp quặng Mangan hạt sắc cạnh**: Bóc tách triệt để các vết ố đen kim loại Mangan trên gạch men nhà tắm.
* **Hạt xúc tác Birm chuyên dụng**: Không tiêu hao hóa chất hoàn nguyên, độ bền cơ học đạt trên 5 năm.
* **Than hoạt tính gáo dừa ép khối**: Khử sạch mùi tanh phèn, hấp phụ tàn dư thuốc bảo vệ thực vật ngấm trong đất.

---

## 4. Bảng So Sánh Hiệu Quả Giữa Hai Phương Pháp Lọc

| Tiêu chí so sánh | Bể lắng lọc cát xi măng cũ | Hệ thống cột lọc áp lực Hoa Sen |
| :--- | :--- | :--- |
| **Diện tích lắp đặt** | 4 - 8 $m^2$ đất bằng phẳng | **Chỉ từ 0.5 - 1 $m^2$ nhỏ gọn** |
| **Thời gian thi công** | 5 - 10 ngày xây dựng | **Lắp đặt hoàn thiện trong 3 - 5 giờ** |
| **Công tác sục rửa vệ sinh** | Xúc cát, cào bùn thủ công | **Xoay van sục ngược tự động trong 10 phút** |
| **Khả năng xử lý Asen & Kim loại** | Rất hạn chế, dễ tái nhiễm | **Khử sạch trên 99% đạt QCVN 01-1:2018/BYT** |
| **Độ bền hệ thống** | 1 - 2 năm dễ nứt vỡ rêu bám | **Vỏ cột Composite / Inox 304 bền trên 10 năm** |

---

## 5. Quy Trình Vận Hành & Sục Rửa Bằng Van 3 Ngã Thông Minh

Nhờ trang bị cụm van đa chiều hiện đại, người sử dụng chỉ cần thao tác đơn giản:
1. Gạt tay van về chế độ **Backwash** (Rửa ngược) để áp lực nước đẩy toàn bộ cặn bùn phèn ra ngoài đường ống xả.
2. Chuyển van sang vị trí **Fast Rinse** (Rửa xuôi) để nén chặt lại các tầng vật liệu lọc.
3. Đưa van về nấc **Filter** (Lọc) để tiếp tục chu trình cấp nước sạch cho toàn bộ ngôi nhà.

---

## 6. FAQ - Các Thắc Mắc Kỹ Thuật Thường Gặp

### Q1: Máy bơm giếng công suất bao nhiêu thì dùng được cột lọc áp lực?
> **Trả lời**: Hệ thống tương thích tốt với mọi dòng máy bơm thả chìm hoặc bơm đặt cạn gia đình có công suất từ 370W đến 1.5kW (áp lực nước từ 1.5 bar trở lên).

### Q2: Có cần dùng hóa chất clo hay thuốc tím để xử lý nước giếng không?
> **Trả lời**: Công nghệ xúc tác của Hoa Sen hoạt động hoàn toàn tự nhiên nhờ hạt xúc tác Birm và Mangan, tuyệt đối không dùng hóa chất độc hại, an toàn cho sức khỏe trẻ nhỏ.`);

    // Variant 2: Ammonium, Arsenic, Heavy Metals Deep Well Treatment
    variants.push(`# ${title}

Hiện tượng nước ngầm giếng khoan bị nhiễm độc tố Amoni ($NH_4^+$), Nitrit ($NO_2^-$), Asen (thạch tín) và kim loại nặng đang là nỗi ám ảnh lớn của nhiều hộ gia đình và trang trại. Amoni không tạo màu hay mùi rõ rệt khi mới bơm nhưng khi tiếp xúc với clo hoặc vi sinh vật trong đường ống sẽ chuyển hóa thành nitrit, nitrat cực kỳ độc hại, làm giảm khả năng vận chuyển oxy trong máu. Bài viết này hướng dẫn phương pháp xử lý chọn lọc Amoni và Asen bằng công nghệ sục khí stripping kết hợp hạt trao đổi ion chuyên dụng.

<div style="background: #fefce8; border: 1px solid #fef08a; border-left: 4px solid #eab308; padding: 16px 20px; border-radius: 8px; margin: 22px 0;">
  <strong style="font-size: 1.1em; color: #854d0e;">⚠️ Tác hại nguy hiểm khi sử dụng nước giếng nhiễm Amoni và Asen:</strong>
  <ul style="margin-top: 8px; margin-bottom: 0; padding-left: 20px; color: #713f12; line-height: 1.7;">
    <li>Amoni làm mất tác dụng của các chất khử trùng, tạo môi trường cho vi khuẩn nguy hiểm phát triển.</li>
    <li>Nitrit chuyển hóa từ Amoni là tác nhân gây bệnh xanh xao khó thở ở trẻ sơ sinh (hội chứng Blue Baby).</li>
    <li>Độc tố Asen tích tụ trong mô cơ thể lâu ngày làm tăng nguy cơ tổn thương tế bào và ung thư biểu mô.</li>
  </ul>
</div>

[![${title}](${img1})](${targetProductUrl})

---

## 1. Cơ Chế Chuyển Hóa Của Hợp Chất Nitơ Trong Tầng Nước Ngầm

Nguồn nước giếng khoan ở vùng đồng bằng hoặc gần các khu chăn nuôi, nghĩa trang thường chứa hàm lượng Amoni rất cao:
* Khi nước ngầm được khai thác lên, Amoni tồn tại ở dạng cân bằng ion $NH_4^+ \rightleftharpoons NH_3 + H^+$.
* Nếu chỉ sử dụng các cột lọc cát thông thường thì 100% Amoni sẽ đi xuyên qua mà không bị giữ lại, gây ra hiện tượng nước có mùi tanh ngái khó chịu khi đun nấu.
* Phương pháp tối ưu đòi hỏi phải nâng nhẹ pH và sục khí phân tán để chuyển hóa một phần Amoni thành khí Amoniac bay hơi, đồng thời sử dụng vật liệu hấp phụ chọn lọc để giữ lại phần còn lại.

---

## 2. Công Nghệ Xử Lý Amoni & Asen Bằng Hạt Zeolite Xúc Tác

Giải pháp xử lý nước giếng của Lọc Nước Hoa Sen áp dụng cấu hình vật liệu hấp phụ chuyên biệt:
1. **Hạt Zeolite Clinoptilolite tự nhiên**: Có cấu trúc mạng lưới rỗng với diện tích bề mặt cực lớn, có ái lực đặc biệt cao với ion $NH_4^+$, giúp bẫy và giữ chặt Amoni bên trong mạng tinh thể.
2. **Quặng sắt oxit dạng hạt hấp phụ Asen**: Bề mặt hạt được hoạt hóa đặc biệt để liên kết tĩnh điện với anion Asenat ($AsO_4^{3-}$), hạ nồng độ thạch tín xuống dưới 0.005 mg/L (ngưỡng an toàn tuyệt đối của Bộ Y Tế).
3. **Cột than hoạt tính gáo dừa Jacobi**: Khử sạch các hợp chất hữu cơ dễ bay hơi VOC, dư lượng thuốc bảo vệ thực vật và trả lại độ thanh mát tự nhiên cho nguồn nước.

[![${title} vật liệu lọc](${img2})](${targetProductUrl})

---

## 3. Bảng Kiểm Tra Chỉ Số Độc Tố Nước Giếng Sau Xử Lý

| Chỉ tiêu phân tích | Nước giếng khoan nhiễm bẩn | Nước sau hệ thống Hoa Sen | Tiêu chuẩn BYT QCVN 01-1:2018 |
| :--- | :--- | :--- | :--- |
| **Hàm lượng Amoni ($NH_4^+$)** | 5.8 mg/L (Vượt 19 lần) | **< 0.2 mg/L** | < 0.3 mg/L |
| **Hàm lượng Asen (Thạch tín)** | 0.08 mg/L (Rất nguy hiểm) | **< 0.003 mg/L** | < 0.01 mg/L |
| **Hàm lượng Sắt tổng (Fe)** | 4.5 mg/L | **< 0.05 mg/L** | < 0.3 mg/L |
| **Độ đục cảm quan (NTU)** | 18 NTU | **< 0.15 NTU** | < 2.0 NTU |
| **Mùi vị cảm quan** | Tanh ngái khó chịu | **Không mùi, vị ngọt mát** | Không có mùi lạ |

---

## 4. Quy Trình Hoàn Nguyên & Tái Sinh Vật Liệu Zeolite

Để hệ thống duy trì khả năng hấp thụ Amoni bền vững suốt nhiều năm:
* Sau mỗi chu kỳ lọc từ 2 đến 3 tuần, cột Zeolite được sục rửa và hoàn nguyên bằng dung dịch muối tinh khiết $NaCl$ nồng độ 10%.
* Ion Natri ($Na^+$) trong muối sẽ đẩy ion Amoni ($NH_4^+$) ra khỏi mạng tinh thể Zeolite theo dòng nước thải, khôi phục lại 100% dung lượng hấp phụ ban đầu.
* Toàn bộ quy trình sục rửa có thể được tự động hóa bằng cụm van điện tử thông minh, khách hàng không cần phải tốn công thao tác thủ công.

---

## 5. FAQ Về Xử Lý Nước Giếng Nhiễm Độc Tố

### Q1: Nước giếng nhiễm Amoni đun sôi có hết độc không?
> **Trả lời**: Hoàn toàn không. Đun sôi chỉ tiêu diệt vi khuẩn chứ không loại bỏ được Amoni hay Asen, thậm chí việc nước bay hơi khi đun còn làm nồng độ kim loại nặng và độc tố cô đặc cao hơn.

### Q2: Tuổi thọ của hạt Zeolite và quặng hấp phụ Asen là bao lâu?
> **Trả lời**: Nếu tuân thủ đúng lịch hoàn nguyên bằng muối định kỳ, hạt Zeolite có tuổi thọ từ 3 đến 5 năm mới cần thay mới.`);
  }

  // =========================================================================
  // DOMAIN 2: TINH KHIẾT / RO (3 Distinct Multi-Angle Variants)
  // =========================================================================
  else if (domain === 'tinh_khiet') {
    // Variant 0: High-pressure reverse osmosis molecular separation
    variants.push(`# ${title}

Sở hữu một hệ thống **${cleanKw}** đạt tiêu chuẩn nước uống đóng chai trực tiếp QCVN 6-1:2010/BYT là mục tiêu quan trọng của các trường học, bệnh viện, nhà xưởng và các cơ sở sản xuất nước đóng bình. Ứng dụng công nghệ màng thẩm thấu ngược RO tiên tiến nhất thế giới, dây chuyền phân tách ở cấp độ phân tử có khả năng loại bỏ tới 99.9% tạp chất độc hại, vi rút và kim loại nặng hòa tan. Bài viết này trình bày toàn bộ quy trình thiết kế, lắp đặt và vận hành dây chuyền công suất từ 250L/h đến 5.000L/h.

<div style="background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #3b82f6; padding: 16px 20px; border-radius: 8px; margin: 22px 0;">
  <strong style="font-size: 1.1em; color: #1d4ed8;">💧 Điểm nhấn công nghệ vượt trội của dây chuyền thẩm thấu ngược:</strong>
  <ul style="margin-top: 8px; margin-bottom: 0; padding-left: 20px; color: #1e3a8a; line-height: 1.7;">
    <li>Màng thẩm thấu ngược RO Dow Filmtec (USA) hoặc Toray (Nhật Bản) với khe hở siêu vi chỉ 0.0001 micromet.</li>
    <li>Khử trùng kép bằng máy phát Ozone công nghiệp kết hợp đèn cực tím UV chống tái nhiễm khuẩn tuyệt đối.</li>
    <li>Chỉ số tổng chất rắn hòa tan TDS đầu ra luôn duy trì ổn định dưới 10 ppm, vị nước thanh ngọt tự nhiên.</li>
  </ul>
</div>

[![${title}](${img1})](${targetProductUrl})

---

## 1. Nguyên Lý Vận Hành Của Màng Lọc Thẩm Thấu Ngược RO

Công nghệ thẩm thấu ngược RO (Reverse Osmosis) là bước đột phá vĩ đại của ngành xử lý nước hiện đại:
Dưới áp lực cực lớn tạo ra từ máy bơm cao áp trục đứng Inox (áp lực từ 150 đến 220 PSI), các phân tử nước tinh khiết $H_2O$ sẽ bị ép xuyên qua các lớp màng lọc cuộn xoắn polyamide với kích thước lỗ lọc chỉ 0.1 nanomet (nhỏ hơn 5000 lần đường kính sợi tóc). Trong khi đó, toàn bộ các ion kim loại nặng, muối khoáng hòa tan, hóa chất thuốc trừ sâu, vi khuẩn và vi rút có kích thước lớn hơn sẽ bị giữ lại và cuốn trôi theo đường nước thải ra ngoài. Kết quả thu được là nguồn nước hoàn toàn trong sạch, an toàn tuyệt đối khi uống trực tiếp vào cơ thể mà không cần đun nấu.

---

## 2. Sơ Đồ Công Nghệ 5 Cấp Lọc Của Dây Chuyền Hoa Sen

Một dây chuyền sản xuất nước đóng bình chuẩn mực đòi hỏi hệ thống tiền xử lý bảo vệ màng RO vô cùng khắt khe:
* **Cấp 1 - Tiền Xử Lý Đa Tầng**: Loại bỏ các cặn bẩn kích thước > 10 micron, phù sa và huyền phù lơ lửng, giúp nước đầu vào đạt chỉ số SDI < 5.
* **Cấp 2 - Khử Clo Dư & Mùi Hóa Chất Bằng Than Jacobi**: Clo dư trong nước máy là kẻ thù phá hủy màng RO, cột than hoạt tính gáo dừa có nhiệm vụ bẻ gãy và triệt tiêu hoàn toàn Clo dư thừa.
* **Cấp 3 - Cột Làm Mềm Hạt Nhựa Purolite**: Đưa độ cứng Canxi và Magie về 0 ppm, ngăn ngừa cáu cặn kết tinh bám nghẹt bề mặt màng RO.
* **Cấp 4 - Cụm Lọc Tinh Chặn Cặn 5 Micron**: Giữ lại bụi mịn phát sinh từ các tầng hạt lọc trước khi đi vào bơm tăng áp.
* **Cấp 5 - Module Màng RO Chính Hãng & Khử Trùng Kép**: Phân tách nước tinh khiết, sau đó sục khí Ozone và chiếu tia cực tím UV khử trùng bình chứa.

[![${title} dây chuyền](${img2})](${targetProductUrl})

---

## 3. Bảng Kiểm Định Chỉ Tiêu Nước Uống Trực Tiếp Đóng Chai

| Chỉ tiêu phân tích | Tiêu chuẩn QCVN 6-1:2010/BYT | Nước thành phẩm Hoa Sen | Đánh giá |
| :--- | :--- | :--- | :--- |
| **Tổng chất rắn hòa tan (TDS)** | < 50 mg/L | **4 - 8 mg/L** | Tinh khiết tuyệt đối |
| **Vi khuẩn Coliforms tổng số** | 0 vi khuẩn / 250ml | **0 vi khuẩn / 250ml** | Đạt chuẩn vô trùng |
| **Vi khuẩn E.Coli** | 0 vi khuẩn / 250ml | **0 vi khuẩn / 250ml** | Đạt chuẩn vô trùng |
| **Kim loại nặng Chì (Pb)** | < 0.01 mg/L | **< 0.001 mg/L** | Không phát hiện |
| **Độ cứng ($CaCO_3$)** | < 100 mg/L | **< 5 mg/L** | Nước siêu mềm thanh mát |
| **Mùi vị cảm quan** | Không mùi, vị dễ chịu | **Ngọt dịu thanh khiết tự nhiên** | Rất thơm ngon |

---

## 4. Công Nghệ Tự Động Rửa Màng Auto-Flushing & Bù Khoáng Tự Nhiên

Trong quá trình tách lọc phân tử, các khoáng chất kết tủa có thể bám dính nhẹ trên bề mặt màng RO. Để khắc phục triệt để hiện tượng này, dây chuyền của Hoa Sen tích hợp van xả tự động Auto-Flushing:
* Mỗi khi khởi động hoặc ngắt bơm, hệ thống tự động mở van xả lưu lượng cao trong 60 giây để cuốn trôi toàn bộ mảng bám cặn ra đường xả thải.
* Đối với nguồn nước uống trực tiếp, hệ thống bổ sung thêm module tạo khoáng Alkaline và đá Maifan Hàn Quốc giúp bù đắp các vi khoáng có lợi như Canxi, Magie, Kẽm ở dạng ion dễ hấp thụ.
* Cụm đèn cực tím UV Aquapro công suất 29W kết hợp máy tạo Ozone 3g/h giúp tiêu diệt 100% bào tử vi nấm, đảm bảo nước đóng bình lưu trữ suốt 12 tháng không bị tái nhiễm khuẩn.

---

## 5. FAQ - Các Câu Hỏi Thường Gặp Về Dây Chuyền

### Q1: Dây chuyền công suất 1.000 lít/giờ cần diện tích nhà xưởng bao nhiêu?
> **Trả lời**: Khung dàn máy Inox công suất 1.000L/h được thiết kế module hóa gọn gàng, chỉ chiếm diện tích mặt sàn khoảng 8 đến 12 mét vuông.

### Q2: Tỷ lệ thu hồi nước sạch của hệ thống màng RO là bao nhiêu?
> **Trả lời**: Tỷ lệ thu hồi nước tinh khiết đạt từ 50% đến 65% tùy thuộc vào độ mặn và áp lực vận hành của nguồn nước cấp.`);

    // Variant 1: Bottling Line Cleanroom Standards & Hygiene Controls
    variants.push(`# ${title}

Quy trình sản xuất nước uống đóng bình và đóng chai quy mô công nghiệp đòi hỏi sự tuân thủ nghiêm ngặt các quy định về an toàn vệ sinh thực phẩm theo QCVN 6-1:2010/BYT của Bộ Y Tế. Để sản phẩm nước bình 20L hoặc chai PET 500ml đạt chất lượng nước uống trực tiếp vô trùng, ngoài việc sở hữu dây chuyền lọc thẩm thấu ngược công suất lớn, doanh nghiệp cần đồng bộ hóa toàn bộ quy trình từ khâu xử lý nguồn nước, tiệt trùng vỏ bình đến phòng chiết rót phòng sạch khép kín.

<div style="background: #fdf4ff; border: 1px solid #f0abfc; border-left: 4px solid #c026d3; padding: 16px 20px; border-radius: 8px; margin: 22px 0;">
  <strong style="font-size: 1.1em; color: #86198f;">🏢 Tiêu chuẩn bắt buộc cho cơ sở sản xuất nước uống đóng bình:</strong>
  <ul style="margin-top: 8px; margin-bottom: 0; padding-left: 20px; color: #701a75; line-height: 1.7;">
    <li>Phòng chiết rót đạt cấp độ sạch Class 10,000 với áp suất dương và đèn UV khử trùng không khí 24/7.</li>
    <li>Quy trình súc rửa vỏ bình 3 giai đoạn bằng dung dịch khử khuẩn, nước tinh khiết và tráng áp lực cao.</li>
    <li>Kiểm soát nghiêm ngặt 21 chỉ tiêu hóa lý và 5 chỉ tiêu vi sinh vật gây hại đường ruột.</li>
  </ul>
</div>

[![${title}](${img1})](${targetProductUrl})

---

## 1. Thiết Kế Phòng Chiết Rót Vô Trùng Chuẩn Y Tế

Khu vực chiết rót đóng bình là vị trí xung yếu nhất dễ xảy ra hiện tượng tái nhiễm vi sinh từ môi trường:
* **Hệ thống cấp khí áp suất dương qua màng lọc HEPA**: Giữ cho áp suất trong phòng chiết rót luôn cao hơn bên ngoài, ngăn chặn vi khuẩn và bụi lơ lửng thâm nhập khi công nhân ra vào.
* **Cửa phân cách và buồng đệm Air Shower**: Công nhân trước khi vào thao tác phải đi qua buồng thổi khí tốc độ cao để thổi sạch toàn bộ xơ vải và hạt bụi trên trang phục bảo hộ.
* **Hệ thống đèn tia cực tím UV diệt khuẩn trần**: Chiếu rọi toàn bộ không gian phòng trước ca làm việc ít nhất 30 phút để vô trùng tuyệt đối môi trường tiếp xúc.

---

## 2. Quy Trình Súc Rửa & Tiệt Trùng Vỏ Bình 5 Gallon (20 Lít)

Vỏ bình thu hồi từ thị trường tiềm ẩn nhiều mầm bệnh và cặn bẩn hữu cơ cần được xử lý qua dây chuyền bán tự động:
1. **Rửa thô và tẩy rửa bên ngoài**: Sử dụng chổi cước quay và dung dịch xà phòng chuyên dụng để đánh bay bụi đất bám dính đáy bình.
2. **Súc rửa nội bộ 3 bước khép kín**:
   * *Bước 1*: Phun xịt dung dịch tiệt trùng Cloramin B hoặc Ozone nồng độ cao vào lòng bình trong 15 giây.
   * *Bước 2*: Tráng lại bằng nước tinh khiết áp lực lớn để loại bỏ hoàn toàn dư lượng hóa chất khử khuẩn.
   * *Bước 3*: Dốc ngược làm ráo nước trên bàn xoay trước khi trượt vào băng tải chiết rót.

[![${title} quy trình chiết rót](${img2})](${targetProductUrl})

---

## 3. Công Nghệ Khử Trùng Kép Ozone & Đèn Cực Tím UV

Nước sau khi qua màng RO dù đã sạch phân tử nhưng khi đưa vào bồn chứa thành phẩm vẫn cần bước bảo vệ kép:
* **Máy tạo khí Ozone công nghiệp**: Hòa tan khí $O_3$ vào dòng nước với nồng độ 0.2 - 0.4 mg/L. Ozone là chất oxy hóa cực mạnh giúp tiêu diệt virus, vi khuẩn và tự phân hủy thành oxy tự do $O_2$ sau vài chục phút, giúp nước giữ được độ tươi mát.
* **Đèn chiếu tia UV bước sóng 254nm**: Phá hủy cấu trúc DNA của vi sinh vật chỉ trong tích tắc, ngăn chặn tuyệt đối hiện tượng vi khuẩn phát triển lại khi lưu trữ trong bình kín nhiều tháng.

---

## 4. Bảng Tiêu Chuẩn Kiểm Nghiệm Vi Sinh Vật Theo QCVN 6-1:2010/BYT

| Tên chỉ tiêu vi sinh vật | Giới hạn cho phép trong nước uống | Phương pháp thử nghiệm |
| :--- | :--- | :--- |
| **Coliforms tổng số** | **0 vi khuẩn / 250ml** | TCVN 6187-1:2019 |
| **Escherichia coli (E.Coli)** | **0 vi khuẩn / 250ml** | TCVN 6187-1:2019 |
| **Pseudomonas aeruginosa (Trực khuẩn mủ xanh)** | **0 vi khuẩn / 250ml** | TCVN 8881:2011 |
| **Streptococci phân** | **0 vi khuẩn / 250ml** | TCVN 6189-2:2009 |
| **Bào tử vi khuẩn kỵ khí sinh H2S** | **0 vi khuẩn / 50ml** | TCVN 6191-2:1996 |

---

## 5. Hướng Dẫn Vận Hành & Lưu Mẫu Định Kỳ

Để cơ sở luôn sẵn sàng vượt qua các đợt thanh tra đột xuất của cơ quan quản lý An toàn Thực phẩm:
* Ghi chép nhật ký sản xuất hằng ngày: áp suất màng RO, lưu lượng thành phẩm, nồng độ Ozone và chỉ số TDS.
* Lưu mẫu tối thiểu 2 bình cho mỗi lô sản xuất trong vòng 30 ngày để đối chứng khi có phản hồi của khách hàng.
* Gửi mẫu nước định kỳ 6 tháng một lần đến các viện kiểm nghiệm được Bộ Y Tế chỉ định (Viện Pasteur, Quatest).

---

## 6. FAQ Về Giấy Phép & Chi Phí Sản Xuất Nước Đóng Bình

### Q1: Hồ sơ xin cấp chứng nhận An toàn Vệ sinh Thực phẩm gồm những gì?
> **Trả lời**: Bao gồm đơn đề nghị cấp giấy chứng nhận, bản vẽ sơ đồ mặt bằng cơ sở, bản thuyết minh cơ sở vật chất, giấy khám sức khỏe và xác nhận kiến thức ATTP của chủ cơ sở và nhân viên.

### Q2: Tuổi thọ của đèn UV và màng thẩm thấu ngược là bao lâu?
> **Trả lời**: Đèn UV cần thay bóng sau 8.000 - 9.000 giờ thắp sáng liên tục (khoảng 1 năm). Màng RO có tuổi thọ trung bình từ 3 đến 5 năm nếu hệ thống tiền xử lý được bảo dưỡng sục rửa đúng chuẩn.`);

    // Variant 2: Industrial RO Operations, SDI Monitoring & CIP Chemical Cleaning
    variants.push(`# ${title}

Trong các nhà máy sản xuất linh kiện bán dẫn, chế biến dược phẩm, xi mạ và nồi hơi công nghiệp, hệ thống **${cleanKw}** đóng vai trò xương sống cung cấp nguồn nước cấp siêu tinh khiết. Khác với các bộ lọc dân dụng nhỏ, các trạm RO công suất từ 2m³/h đến 50m³/h đòi hỏi kỹ thuật giám sát chỉ số bùn SDI, điều tiết áp suất màng biến tần và quy trình sục rửa phục hồi màng CIP (Cleaning In Place) chuyên nghiệp để tối ưu hóa hiệu suất đầu tư.

<div style="background: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #475569; padding: 16px 20px; border-radius: 8px; margin: 22px 0;">
  <strong style="font-size: 1.1em; color: #334155;">⚙️ Các thông số kỹ thuật then chốt trong vận hành RO công nghiệp:</strong>
  <ul style="margin-top: 8px; margin-bottom: 0; padding-left: 20px; color: #475569; line-height: 1.7;">
    <li>Chỉ số SDI (Silt Density Index) nguồn nước cấp vào màng bắt buộc duy trì < 3 để chống tắc nghẽn keo tụ.</li>
    <li>Áp suất vận hành màng duy trì ổn định từ 10 đến 16 bar nhờ máy bơm đa tầng cánh Inox 316.</li>
    <li>Quy trình rửa màng CIP định kỳ giúp phục hồi 95% lưu lượng lọc, tiết kiệm hàng trăm triệu chi phí thay màng mới.</li>
  </ul>
</div>

[![${title}](${img1})](${targetProductUrl})

---

## 1. Tầm Quan Trọng Của Việc Kiểm Soát Chỉ Số SDI Đầu Vào

Nhiều doanh nghiệp gặp tình trạng màng RO bị sụt giảm lưu lượng lọc chỉ sau vài tháng lắp đặt dù nước đầu vào nhìn rất trong. Nguyên nhân chính là do chỉ số mật độ bùn SDI vượt ngưỡng:
* **Bản chất của chỉ số SDI**: Đo lường lượng cặn lơ lửng, huyền phù và keo silic siêu mịn có kích thước dưới 0.45 micron. Những hạt keo này mắt thường không thể thấy nhưng lại bám dính rất chặt trên bề mặt màng polyamide.
* **Giải pháp khắc phục**: Bắt buộc bố trí cụm tiền lọc đa tầng gồm cát thạch anh, than hoạt tính và cột lọc Micro filtration 1 micron kết hợp châm định lượng hóa chất chống cáu cặn Antiscalant trước khi vào bơm cao áp.

---

## 2. Quy Trình Sục Rửa Màng Lọc CIP (Cleaning In Place) Chuyên Nghiệp

Khi lưu lượng nước tinh khiết giảm quá 15% hoặc áp suất chênh lệch qua màng tăng trên 20%, hệ thống cần được chạy quy trình CIP:
1. **Rửa bằng dung dịch axit nhẹ (pH 2 - 3)**: Sử dụng axit citric hoặc hóa chất chuyên dụng để hòa tan các mảng bám cáu cặn vô cơ như Canxi Cacbonat ($CaCO_3$) và oxit sắt.
2. **Rửa bằng dung dịch kiềm nhẹ (pH 10 - 11)**: Sử dụng NaOH kết hợp chất hoạt động bề mặt để bóc tách màng sinh học vi khuẩn và dầu mỡ hữu cơ.
3. **Tuần hoàn và ngâm ủ**: Bơm tuần hoàn dung dịch trong 30 phút, ngâm ủ màng trong 1 - 2 giờ và súc xả sạch bằng nước tinh khiết trước khi đưa trạm lọc trở lại chế độ vận hành.

[![${title} hệ thống CIP](${img2})](${targetProductUrl})

---

## 3. Bảng Phân Tích Hiệu Quả Trước Và Sau Khi Thực Hiện CIP

| Thông số đo lường | Trước khi súc rửa CIP | Sau khi hoàn thành CIP | Trạng thái kỹ thuật |
| :--- | :--- | :--- | :--- |
| **Lưu lượng nước thành phẩm** | Giảm 25% (Hụt công suất) | **Phục hồi 96 - 98% định mức** | Hoạt động tối ưu |
| **Độ chênh lệch áp suất ($\\Delta P$)** | Tăng lên 2.2 bar (Nguy cơ rách màng) | **Hạ về 0.8 - 1.0 bar an toàn** | Áp lực chuẩn |
| **Chỉ số dẫn điện EC / TDS** | Tăng từ 8 ppm lên 35 ppm | **Hạ xuống dưới 8 ppm** | Nước siêu sạch |
| **Dòng điện tiêu thụ máy bơm** | Tăng 18% do quá tải | **Trở về mức dòng định mức** | Tiết kiệm điện năng |

---

## 4. Bảo Trì Thiết Bị Đo Lường & Điều Khiển Tự Động Hóa PLC

Một hệ thống lọc công nghiệp hiện đại do Hoa Sen thiết kế được tự động hóa hoàn toàn thông qua màn hình HMI cảm ứng:
* **Cảm biến áp suất điện tử**: Tự động ngắt hệ thống khi áp suất nước cấp đầu vào hụt dưới 0.5 bar nhằm bảo vệ bơm trục đứng khỏi hiện tượng xâm thực bọt khí (cavitation).
* **Đồng hồ đo độ dẫn điện Online**: Giám sát chất lượng nước thành phẩm liên tục 24/7 và gửi cảnh báo về điện thoại người quản lý khi có sự cố.
* **Hệ thống van điện từ tự động xả rửa Flush định kỳ**: Rửa sạch bề mặt màng mỗi khi dừng máy, ngăn ngừa khoáng chất kết tinh khô trên màng.

---

## 5. FAQ Về Vận Hành Trạm RO Công Nghiệp

### Q1: Bao lâu nên thực hiện súc rửa CIP màng một lần?
> **Trả lời**: Tùy thuộc vào chất lượng nước cấp đầu vào, chu kỳ CIP thông thường dao động từ 3 đến 6 tháng một lần. Không nên để lưu lượng sụt giảm quá 30% mới CIP vì cặn bám quá dày sẽ khó phục hồi hoàn toàn.

### Q2: Tại sao phải sử dụng ống Inox 316 hoặc vi sinh cho đường ống sau màng RO?
> **Trả lời**: Nước sau màng RO có độ tinh khiết cao, rất dễ hòa tan các ion kim loại từ các loại ống thép thông thường và có thể bị nhiễm khuẩn ngược nếu bề mặt ống bên trong thô ráp.`);
  }

  // =========================================================================
  // OTHER DOMAINS (Phen, Sinh Hoat, Man, Cong Nghiep): Default Multi-Angle
  // =========================================================================
  else {
    variants.push(`# ${title}

Giải pháp kỹ thuật chuyên sâu về **${cleanKw}** được thiết kế nhằm đáp ứng các tiêu chuẩn khắt khe nhất về an toàn vệ sinh nguồn nước sinh hoạt và sản xuất công nghiệp. Bài viết cung cấp góc nhìn toàn diện về công nghệ lọc nước hiện đại, cấu tạo vật liệu đa tầng và quy trình vận hành tối ưu chi phí.

<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #22c55e; padding: 16px 20px; border-radius: 8px; margin: 22px 0;">
  <strong style="font-size: 1.1em; color: #15803d;">💧 Lợi ích cốt lõi của hệ thống:</strong>
  <ul style="margin-top: 8px; margin-bottom: 0; padding-left: 20px; color: #166534; line-height: 1.7;">
    <li>Nguồn nước đầu ra cam kết đạt chuẩn QCVN của Bộ Y Tế.</li>
    <li>Bảo vệ toàn diện sức khỏe gia đình và nâng cao tuổi thọ thiết bị.</li>
    <li>Chi phí vận hành và bảo dưỡng tiết kiệm, lắp đặt nhanh gọn trong ngày.</li>
  </ul>
</div>

[![${title}](${img1})](${targetProductUrl})

---

## 1. Thực Trạng Nguồn Nước & Nhu Cầu Xử Lý

Nguồn nước ngầm và nước mặt tại các khu vực đô thị và nông thôn đang đối mặt với nhiều nguy cơ ô nhiễm hóa chất, vi sinh vật và kim loại nặng. Trang bị hệ thống xử lý chuyên dụng giúp bảo vệ sức khỏe và kéo dài tuổi thọ thiết bị.

---

## 2. Công Nghệ Lọc Nước Đa Cấp Hiện Đại

Hệ thống kết hợp các tầng vật liệu lọc chuyên sâu nhập khẩu từ Mỹ, Nhật Bản và châu Âu, loại bỏ triệt để cặn bẩn, độc tố và kim loại hòa tan.

[![${title} cấu tạo](${img2})](${targetProductUrl})

---

## 3. Tiêu Chuẩn Nước Sau Xử Lý Đạt Chuẩn Bộ Y Tế

Nước sau lọc luôn cam kết đạt 100% các chỉ tiêu quy định của Quy chuẩn kỹ thuật quốc gia QCVN, an tâm trọn đời cho người tiêu dùng.`);
  }

  return variants;
}


function getCustomGoogleAdsLinks() {
  try {
    const file = path.join(__dirname, '../data/google_ads_links.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
    }
  } catch (e) {}
  return [];
}

function getGoogleAdsTargetUrl(kwOrTopic = '') {
  const clean = (kwOrTopic || '').toLowerCase().trim();
  const links = getCustomGoogleAdsLinks();

  if (links.length > 0) {
    // 1. Check exact match with keywords array
    for (const item of links) {
      if (Array.isArray(item.keywords)) {
        for (const kw of item.keywords) {
          if (clean.includes(kw.toLowerCase())) {
            return item.url;
          }
        }
      }
    }
    // 2. Return default item if configured
    const def = links.find(l => l.isDefault) || links[0];
    if (def && def.url) return def.url;
  }

  const domain = detectDomain(clean);
  const fallback = {
    sinh_hoat: 'https://xulynuochoasen.com/he-thong-loc-nuoc-sinh-hoat/',
    phen: 'https://xulynuochoasen.com/he-thong-loc-nuoc-nhiem-phen/',
    gieng_khoan: 'https://xulynuochoasen.com/he-thong-loc-nuoc-nhiem-phen/',
    cong_nghiep: 'https://xulynuochoasen.com/he-thong-loc-nuoc-cong-nghiep/',
    tinh_khiet: 'https://xulynuochoasen.com/he-thong-loc-nuoc-tinh-khiet/',
    man: 'https://xulynuochoasen.com/he-thong-loc-nuoc-man/',
    general: 'https://xulynuochoasen.com/he-thong-loc-nuoc-sinh-hoat/'
  };
  return fallback[domain] || fallback.general;
}

module.exports = {
  generateSmartSeoTemplate,
  getRecentUsedImages,
  getGoogleAdsTargetUrl,
  getCustomGoogleAdsLinks
};
