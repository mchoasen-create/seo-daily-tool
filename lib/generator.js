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

function generateSmartSeoTemplate(topic, keyword, tone = 'Thuyết phục & Chuẩn SEO', customTargetUrl = '') {
  const cleanKw = (keyword || topic || '').trim();
  const cleanTopic = (topic || keyword || '').trim();

  // Pick 2 non-overlapping rotated images
  const recentImages = getRecentUsedImages();
  const { img1, img2 } = getTwoDistinctRotatedImages(cleanKw, recentImages);

  let kwHash = 0;
  for (let i = 0; i < cleanKw.length; i++) {
    kwHash = (kwHash << 5) - kwHash + cleanKw.charCodeAt(i);
    kwHash |= 0;
  }

  const domain = detectDomain(cleanKw);
  const title = generateUniqueTitle(cleanKw, domain, kwHash);
  const metaDescription = generateUniqueMeta(cleanKw, domain, kwHash);

  // Determine target link
  const LINK_PHEN = 'https://xulynuochoasen.com/san-pham/12529/';
  const LINK_RO = 'https://xulynuochoasen.com/san-pham/he-thong-loc-nuoc-tinh-khiet-r-o-1000-lit-1-gio/';
  const LINK_CN = 'https://xulynuochoasen.com/san-pham/he-thong-loc-nuoc-cong-nghiep-cong-suat-2000-lit-1-gio/';
  const LINK_MAN = 'https://xulynuochoasen.com/san-pham/he-thong-loc-nuoc-nhiem-man-cong-suat-800-lit-1-gio/';

  let targetProductUrl = customTargetUrl;
  if (!targetProductUrl) {
    if (domain === 'cong_nghiep') targetProductUrl = LINK_CN;
    else if (domain === 'man') targetProductUrl = LINK_MAN;
    else if (domain === 'tinh_khiet') targetProductUrl = LINK_RO;
    else targetProductUrl = LINK_PHEN;
  }

  let content = '';

  // -------------------------------------------------------------------------
  // DOMAIN 1: PHÈN / SẮT
  // -------------------------------------------------------------------------
  if (domain === 'phen') {
    content = `# ${title}

Nhu cầu trang bị hệ thống **${cleanKw}** đang trở thành ưu tiên cấp bách tại nhiều hộ gia đình và nông trại khi nguồn nước giếng ngầm bị ô nhiễm nghiêm trọng. Nước nhiễm phèn sắt và phèn nhôm không chỉ phát sinh mùi tanh hôi nồng nặc mà còn làm hoen ố các thiết bị vệ sinh men sứ cao cấp. Bài viết này chia sẻ kinh nghiệm kỹ thuật chuyên sâu về công nghệ xử lý nước phèn đạt chuẩn Bộ Y Tế, giúp quý khách hàng đưa ra quyết định đầu tư chính xác và tiết kiệm chi phí lâu dài.

<div style="background: #fffbebfb; border: 1px solid #fef08a; border-left: 4px solid #eab308; padding: 16px 20px; border-radius: 8px; margin: 22px 0;">
  <strong style="font-size: 1.1em; color: #854d0e;">⚠️ Nhận biết tác hại nguy hiểm khi chưa xử lý nguồn nước nhiễm phèn:</strong>
  <ul style="margin-top: 8px; margin-bottom: 0; padding-left: 20px; color: #451a03; line-height: 1.7;">
    <li>Nước xả ra ban đầu trong suốt nhưng tiếp xúc không khí từ 15 đến 30 phút liền kết tủa màu vàng sẫm.</li>
    <li>Mùi tanh nồng bốc lên gây buồn nôn khi rửa mặt, giặt đồ bị ố vàng loang lổ không thể giặt sạch.</li>
    <li>Lớp kết tủa bám dày đặc làm nghẹt đường ống dẫn, cháy thanh nhiệt bình nước nóng và rỉ sét van vòi.</li>
  </ul>
</div>

[![Hệ thống ${cleanKw} chất lượng cao](${img1})](${targetProductUrl})

---

## 1. Cơ Chế Hóa Học Của Hiện Tượng Nhiễm Phèn Sắt Trong Nước Ngầm

Trong lòng đất thiếu oxy, sắt hòa tan chủ yếu tồn tại ở trạng thái hóa trị hai ($Fe^{2+}$) liên kết với gốc bicarbonat $Fe(HCO_3)_2$. Khi được bơm lên mặt đất và tiếp xúc với oxy tự do, phản ứng oxy hóa thủy phân diễn ra tức thì:

$$4Fe(HCO_3)_2 + O_2 + 2H_2O \\rightarrow 4Fe(OH)_3\\downarrow + 8CO_2\\uparrow$$

Hợp chất $Fe(OH)_3$ chính là chất kết tủa màu vàng đỏ lơ lửng trong nước mà dân gian quen gọi là váng phèn. Nếu không sử dụng phương pháp **${cleanKw}** chuyên sâu, các hạt bông cặn này sẽ len lỏi vào từng kẽ vải quần áo, bám chặt vào chân lông gây khô da ngứa ngáy và làm tắc nghẽn toàn bộ hệ thống vòi xịt vệ sinh.

### Phân Biệt Phèn Sắt, Phèn Nhôm Và Phèn Đen Hữu Cơ
Nhiều vùng đất ngập mặn hoặc đất phèn trũng miền Tây còn xuất hiện hiện tượng phèn nhôm sunfat kép $Al_2(SO_4)_3$ khiến nước có vị chua gắt chát lưỡi, làm mục nát quần áo sợi bông chỉ sau vài lần giặt. Bên cạnh đó, phèn đen hữu cơ tạo bởi sự kết hợp giữa axit humic và sắt hòa tan thường tạo thành các phức chất rất bền vững, đòi hỏi tháp sục khí Ejector áp lực cao để bẻ gãy liên kết hữu cơ trước khi đưa vào các tầng vật liệu lọc chuyên sâu.

---

## 2. Cấu Tạo Vật Liệu Lọc Đa Tầng Chuyên Dụng Khử Phèn

Hệ thống xử lý phèn sắt hiện đại của Lọc Nước Hoa Sen được phối trộn từ 5 lớp vật liệu nhập khẩu cao cấp:

1. **Sỏi Thạch Anh Khử Đáy**: Tạo độ thoáng cho lưới lọc lược và thu gom nước sạch đồng đều về đường ống trung tâm.
2. **Cát Thạch Anh Lọc Cặn**: Giữ lại toàn bộ cặn lơ lửng, bùn đất hữu cơ và bông cặn sau quá trình oxy hóa.
3. **Quặng Mangan & Hạt Birm Clack**: Đóng vai trò chất xúc tác bền vững, kích thích ion sắt kết tủa cực nhanh mà không cần châm hóa chất tím độc hại.
4. **Than Hoạt Tính Gáo Dừa Jacobi**: Hấp phụ triệt để độc tố kim loại nặng, khử sạch mùi tanh phèn và trả lại độ ngọt thanh tự nhiên cho nguồn nước sau khi **${cleanKw}**.
5. **Hạt Nâng Độ Cân Bằng pH Flomag**: Ổn định chỉ số pH trong dải an toàn 6.8 đến 7.5, giúp phản ứng khử phèn đạt hiệu suất 100%.

[![Vật liệu lọc chuyên dụng trong cột ${cleanKw}](${img2})](${targetProductUrl})

---

## 3. Bảng Phân Tích Chỉ Số Nước Đạt Chuẩn Sau Lọc

| Chỉ số phân tích | Nước giếng nhiễm phèn thô | Sau khi qua bộ cột xử lý | Quy chuẩn QCVN 01-1:2018/BYT |
| :--- | :--- | :--- | :--- |
| **Hàm lượng Sắt tổng (Fe)** | 3.5 - 8.0 mg/L (Vượt ngưỡng) | **< 0.1 mg/L (Trong suốt)** | < 0.3 mg/L |
| **Hàm lượng Mangan (Mn)** | 0.8 - 1.5 mg/L (Ố đen van vòi) | **< 0.05 mg/L (Tuyệt đối sạch)** | < 0.1 mg/L |
| **Độ đục cảm quan (NTU)** | 12 - 25 NTU (Đục vàng, váng nổi) | **< 0.2 NTU (Trong vắt)** | < 2.0 NTU |
| **Chỉ số pH nguồn nước** | 4.8 - 5.5 (Chua, ăn mòn da) | **7.0 - 7.6 (Cân bằng trung tính)** | 6.5 - 8.5 |
| **Mùi vị cảm quan** | Tanh nồng, hôi mùi rỉ sét | **Không mùi, thanh mát dễ chịu** | Không có mùi lạ |

Hàng nghìn công trình lắp đặt bộ cột xử lý nước phèn do đội ngũ kỹ sư Lọc Nước Hoa Sen thi công đã được kiểm định chất lượng tại Viện Pasteur và Trung tâm Y tế dự phòng, bảo đảm an tâm trọn đời cho người tiêu dùng.

---

## 4. Hướng Dẫn Vận Hành Van 3 Cửa Sục Rửa Định Kỳ Đúng Cách

Để thiết bị duy trì hiệu suất lọc bền bỉ từ 3 đến 5 năm, thao tác sục rửa định kỳ là vô cùng đơn giản:

* **Bước 1 - Backwash (Rửa ngược)**: Gạt tay van sang nấc Backwash từ 10 đến 15 phút. Dòng nước áp lực đẩy từ dưới lên sẽ làm xáo tung các lớp cát và quặng Birm, đẩy toàn bộ bùn phèn đen kịt ra đường thoát nước thải.
* **Bước 2 - Fast Rinse (Rửa xuôi)**: Chuyển van sang nấc Fast Rinse trong khoảng 5 phút để nén chặt các tầng hạt lọc về vị trí ban đầu và xả sạch những cặn phèn li ti còn đọng lại ở đáy cột.
* **Bước 3 - Service (Lọc nước)**: Đưa van về nấc Service để bắt đầu chu trình cấp nước sạch mát lành vào bồn chứa phục vụ sinh hoạt.

---

## 5. Quy Trình Khảo Sát Thi Công Của Lọc Nước Hoa Sen

Lọc Nước Hoa Sen cam kết tiêu chuẩn thi công chuyên nghiệp hàng đầu khu vực miền Nam:
* Khảo sát nguồn nước và mang bộ kit test mẫu nước tận nhà miễn phí 100%.
* Thiết kế phương án kỹ thuật phù hợp với công suất sử dụng thực tế của gia đình từ 1 đến 3 khối nước mỗi ngày.
* Lắp đặt trọn gói trong ngày bằng đường ống hàn nhiệt chịu áp lực cao, thẩm mỹ và gọn gàng.
* Cam kết bàn giao nước trong sạch đạt chuẩn mới thanh toán chi phí, bảo hành kỹ thuật 36 tháng tận nơi.

---

## 6. Những Câu Hỏi Thường Gặp Về Xử Lý Nước Phèn (FAQ)

### Q1: Cột lọc xử lý phèn có tốn nhiều điện năng và diện tích không?
> **Trả lời**: Hệ thống hoạt động theo nguyên lý lọc áp lực cơ học tận dụng máy bơm gia đình có sẵn, hoàn toàn không tiêu hao điện năng phụ trợ. Diện tích sàn chiếm chỗ chỉ khoảng 0.5 đến 1 mét vuông góc sân.

### Q2: Bao lâu thì cần thay thế vật liệu lọc bên trong cột?
> **Trả lời**: Nếu định kỳ sục rửa ngược 1 đến 2 tuần một lần, tuổi thọ của cát thạch anh, quặng Mangan và than hoạt tính kéo dài từ 3 đến 4 năm mới cần thay mới.`;
  }

  // -------------------------------------------------------------------------
  // DOMAIN 2: SINH HOẠT / ĐẦU NGUỒN
  // -------------------------------------------------------------------------
  else if (domain === 'sinh_hoat') {
    content = `# ${title}

Việc trang bị một hệ thống **${cleanKw}** đầu nguồn cho toàn bộ ngôi nhà đang trở thành tiêu chuẩn sống tất yếu của các gia đình hiện đại. Nguồn nước máy thủy cục đô thị dù đã được xử lý thô tại nhà máy nhưng trong quá trình vận chuyển qua hàng chục km đường ống cũ kỹ vẫn tồn đọng clo dư nồng nặc, rỉ sét và cặn vôi cứng. Lắp đặt trạm xử lý tổng thể giúp bảo vệ toàn diện làn da, mái tóc và tuổi thọ cho mọi thiết bị trong gia đình.

<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; padding: 16px 20px; border-radius: 8px; margin: 22px 0;">
  <strong style="font-size: 1.1em; color: #15803d;">💡 3 Lợi ích vàng khi bảo vệ ngôi nhà bằng giải pháp lọc tổng:</strong>
  <ul style="margin-top: 8px; margin-bottom: 0; padding-left: 20px; color: #14532d; line-height: 1.7;">
    <li>Khử sạch 100% mùi hóa chất Clo dư thừa, không còn cảm giác cay mắt, khô ráp da và rụng tóc khi tắm gội.</li>
    <li>Triệt tiêu cặn vôi Canxi và Magie, chấm dứt vệt ố trắng đóng trên vách kính phòng tắm và vòi sen inox cao cấp.</li>
    <li>Bảo vệ quần áo mềm mại tươi màu, kéo dài tuổi thọ gấp đôi cho máy giặt, máy rửa bát và bình nước nóng năng lượng mặt trời.</li>
  </ul>
</div>

[![Giải pháp ${cleanKw} đầu nguồn](${img1})](${targetProductUrl})

---

## 1. Tại Sao Nước Máy Thành Phố Vẫn Cần Đến Thiết Bị Lọc Đầu Nguồn?

Nhiều hộ gia đình lầm tưởng rằng nước máy đô thị đã tuyệt đối an toàn và không cần lắp đặt thêm thiết bị xử lý. Tuy nhiên, thực tế kiểm nghiệm cho thấy:

* **Tồn dư lượng Clo khử trùng quá mức cho phép**: Clo phản ứng với các hợp chất hữu cơ tạo thành Trihalomethanes (THMs) - một tác nhân gây hại cho da và đường hô hấp khi hít phải hơi nước nóng lúc tắm. Lắp đặt trạm lọc chuyên dụng sẽ loại bỏ hoàn toàn gốc clo độc hại này.
* **Ô nhiễm thứ cấp qua đường ống ngầm**: Mạng lưới đường ống cấp nước đô thị qua hàng chục năm sử dụng thường bị rỉ sét, nứt rò rỉ dẫn tới bùn đất, phù sa và chì thâm nhập vào bồn chứa gia đình.
* **Độ cứng của nước cao (Nước nhiễm vôi)**: Các ion Canxi ($Ca^{2+}$) và Magie ($Mg^{2+}$) khi đun sôi tạo thành cặn vôi $CaCO_3$ bám chặt đáy ấm, gây tắc nghẽn van sen vòi và lãng phí điện năng đốt nóng. Chỉ có hệ thống làm mềm trong cụm **${cleanKw}** mới xử lý dứt điểm tình trạng này.

---

## 2. Cấu Trúc 3 Cột Lọc Chuẩn Châu Âu Của Bộ Thiết Bị

Hệ thống xử lý cao cấp do Lọc Nước Hoa Sen thiết kế bao gồm 3 module chuyên biệt liên hoàn:

### Cột 1: Cột Lọc Đa Tầng Khử Kim Loại & Cặn Thô
Sử dụng vỏ cột Inox 304 bóng bẩy sang trọng, chứa hỗn hợp sỏi đỡ thạch anh, cát lọc thô và hạt lọc đa năng ODM giúp giữ lại toàn bộ cặn lơ lửng kích thước lớn, rỉ sét đường ống và bùn đất phù sa.

### Cột 2: Cột Hấp Phụ Khử Mùi Clo & Hóa Chất Độc Hại
Chứa 100% Than hoạt tính gáo dừa Jacobi nhập khẩu Thụy Điển với chỉ số I-ốt cực cao (> 1050 mg/g). Tầng than này có nhiệm vụ hấp thụ toàn bộ Clo dư, thuốc trừ sâu, dung môi công nghiệp và trả lại nguồn nước trong vắt không mùi cho ngôi nhà.

### Cột 3: Cột Làm Mềm Nước Cứng Trao Đổi Ion
Chứa các hạt nhựa Cation Purolite (Anh Quốc) hoặc Thermax (Ấn Độ). Khi dòng nước chảy qua, các ion Canxi và Magie gây cứng nước sẽ bị giữ lại trên bề mặt hạt nhựa và thế chỗ bằng ion Natri an toàn, biến nước cứng thành dòng nước mềm êm dịu cho làn da. Cột được tích hợp thùng muối hoàn nguyên tinh khiết tự động.

[![Chi tiết module lắp đặt ${cleanKw}](${img2})](${targetProductUrl})

---

## 3. Bảng So Sánh Hiệu Quả Trước & Sau Khi Lắp Đặt

| Tiêu chuẩn đánh giá | Nước cấp thủy cục thông thường | Sau khi qua cụm xử lý đầu nguồn |
| :--- | :--- | :--- |
| **Nồng độ Clo tự do** | 0.5 - 1.2 mg/L (Nồng nặc mùi clo) | **0.0 mg/L (Tuyệt đối không mùi hóa chất)** |
| **Độ cứng tổng (CaCO3)** | 220 - 350 mg/L (Đóng cặn dày) | **< 50 mg/L (Nước mềm mịn màng)** |
| **Độ đục và cặn lơ lửng** | Có cặn lắng đáy bồn chứa | **Nước trong suốt tinh khôi** |
| **Tác động lên thiết bị** | Hoen ố kính tắm, nghẹt vòi sen | **Thiết bị luôn sáng bóng như mới** |
| **Tác động lên cơ thể** | Da khô, rụng tóc, viêm nang lông | **Da dẻ mịn màng, tóc mượt mà óng ả** |

Đầu tư giải pháp **${cleanKw}** chính là khoản đầu tư thông minh nhất để nâng tầm chất lượng cuộc sống cho cả gia đình.

---

## 4. Công Nghệ Van Tự Động Autovalve Thông Minh

Điểm vượt trội của các dòng máy tại Lọc Nước Hoa Sen là trang bị cụm van điều khiển tự động Autovalve Runxin:
* **Tự động đo lưu lượng nước**: Van vi xử lý điện tử tự tính toán số mét khối nước đã sử dụng và kích hoạt chu trình sục rửa vật liệu vào ban đêm khi gia đình đang ngủ.
* **Tự động hút muối hoàn nguyên**: Cột làm mềm tự động hút nước muối bão hòa từ thùng muối chuyên dụng để tái sinh hạt nhựa trao đổi ion, người dùng không cần chạm tay vận hành thủ công.
* **Màn hình hiển thị LCD sắc nét**: Thể hiện trực quan công suất lọc hiện tại, thời gian sục rửa còn lại và cảnh báo chu kỳ bảo trì.

---

## 5. Dịch Vụ Khảo Sát & Lắp Đặt Tận Tâm Của Hoa Sen

Với hơn 10 năm kinh nghiệm thi công hàng nghìn biệt thự, nhà phố và căn hộ cao cấp, Lọc Nước Hoa Sen cam kết:
1. Mang thiết bị đo chỉ số nước đến tận nhà test trực tiếp cho quý khách xem miễn phí.
2. Tư vấn cấu hình chuẩn xác nhất theo diện tích ban công, sân thượng hoặc phòng kỹ thuật.
3. Sử dụng 100% đường ống hàn nhiệt PPR Tiền Phong hoặc Bình Minh chịu áp suất cao, không rò rỉ nước.
4. Bảo hành toàn diện 36 tháng tận nơi, định kỳ gọi điện nhắc nhở kiểm tra chất lượng nguồn nước.

---

## 6. Câu Hỏi Thường Gặp Về Hệ Thống (FAQ)

### Q1: Nước sau khi qua hệ thống có thể uống trực tiếp tại vòi được không?
> **Trả lời**: Hệ thống lọc tổng đầu nguồn cung cấp nước đạt chuẩn QCVN 01-1:2018/BYT cho mọi nhu cầu tắm giặt, nấu ăn, rửa rau củ. Để uống trực tiếp không cần đun sôi, quý khách nên kết hợp thêm máy lọc nước tinh khiết RO nhỏ đặt dưới bồn rửa bếp.

### Q2: Chi phí duy trì thùng muối của cột làm mềm mỗi tháng là bao nhiêu?
> **Trả lời**: Mỗi tháng một gia đình 4 đến 6 người chỉ tiêu hao khoảng 1 bao muối hoàn nguyên tinh khiết (chi phí khoảng 100.000đ đến 150.000đ/tháng), cực kỳ tiết kiệm so với những lợi ích bảo vệ thiết bị mang lại.`;
  }

  // -------------------------------------------------------------------------
  // DOMAIN 3: GIẾNG KHOAN
  // -------------------------------------------------------------------------
  else if (domain === 'gieng_khoan') {
    content = `# ${title}

Nguồn nước ngầm tại Việt Nam đang đối mặt với nguy cơ suy thoái và ô nhiễm hóa chất nghiêm trọng, khiến việc đầu tư trạm **${cleanKw}** trở thành nhu cầu cấp bách của bà con nông thôn và các doanh nghiệp sản xuất. Khác với nước bề mặt, nước ngầm nằm sâu trong các tầng trầm tích chứa nhiều khí độc hòa tan, độc tố Asen và kim loại nặng. Bài viết này hướng dẫn phương pháp xử lý chuyên sâu triệt để, không cần xây bể lắng truyền thống cồng kềnh.

<div style="background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; padding: 16px 20px; border-radius: 8px; margin: 22px 0;">
  <strong style="font-size: 1.1em; color: #b91c1c;">⚠️ Mối nguy hiểm tiềm ẩn trong nguồn nước giếng chưa qua xử lý:</strong>
  <ul style="margin-top: 8px; margin-bottom: 0; padding-left: 20px; color: #7f1d1d; line-height: 1.7;">
    <li>Khí Hydro Sunfua ($H_2S$) gây mùi trứng thối nồng nặc và khí Metan dễ cháy tích tụ trong bể ngầm.</li>
    <li>Độc tố Asen (thạch tín) - sát thủ thầm lặng gây ung thư da, tổn thương gan thận mà mắt thường không thể phát hiện.</li>
    <li>Hàm lượng Amoni ($NH_4^+$) và Nitrit cao do ngấm phân bón hóa học và nước thải sinh hoạt nông nghiệp.</li>
  </ul>
</div>

[![Công trình thi công ${cleanKw} áp lực cao](${img1})](${targetProductUrl})

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

[![Hệ thống sục khí và lọc áp lực ${cleanKw}](${img2})](${targetProductUrl})

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

Kết quả xét nghiệm mẫu nước sau khi qua hệ thống lọc áp lực tại Hoa Sen luôn cam kết đạt 100% chỉ tiêu của Quy chuẩn kỹ thuật quốc gia QCVN 01-1:2018/BYT.

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
> **Trả lời**: Giá lắp đặt trọn gói dao động từ 4 triệu đến 15 triệu tùy thuộc vào chất liệu cột (Composite hay Inox 304), công suất lọc và mức độ ô nhiễm thực tế của mẫu nước.`;
  }

  // -------------------------------------------------------------------------
  // DOMAIN 4: TINH KHIẾT / RO
  // -------------------------------------------------------------------------
  else if (domain === 'tinh_khiet') {
    content = `# ${title}

Sở hữu một hệ thống **${cleanKw}** đạt tiêu chuẩn nước uống đóng chai trực tiếp QCVN 6-1:2010/BYT là mục tiêu quan trọng của các trường học, bệnh viện, nhà xưởng và các cơ sở sản xuất nước đóng bình. Ứng dụng công nghệ màng thẩm thấu ngược RO tiên tiến nhất thế giới, dây chuyền phân tách ở cấp độ phân tử có khả năng loại bỏ tới 99.9% tạp chất độc hại, vi rút và kim loại nặng hòa tan. Bài viết này trình bày toàn bộ quy trình thiết kế, lắp đặt và vận hành dây chuyền công suất từ 250L/h đến 5.000L/h.

<div style="background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #3b82f6; padding: 16px 20px; border-radius: 8px; margin: 22px 0;">
  <strong style="font-size: 1.1em; color: #1d4ed8;">💧 Điểm nhấn công nghệ vượt trội của dây chuyền thẩm thấu ngược:</strong>
  <ul style="margin-top: 8px; margin-bottom: 0; padding-left: 20px; color: #1e3a8a; line-height: 1.7;">
    <li>Màng thẩm thấu ngược RO Dow Filmtec (USA) hoặc Toray (Nhật Bản) với khe hở siêu vi chỉ 0.0001 micromet.</li>
    <li>Khử trùng kép bằng máy phát Ozone công nghiệp kết hợp đèn cực tím UV chống tái nhiễm khuẩn tuyệt đối.</li>
    <li>Chỉ số tổng chất rắn hòa tan TDS đầu ra luôn duy trì ổn định dưới 10 ppm, vị nước thanh ngọt tự nhiên.</li>
  </ul>
</div>

[![Dây chuyền ${cleanKw} màng RO hiện đại](${img1})](${targetProductUrl})

---

## 1. Nguyên Lý Vận Hành Của Màng Lọc Thẩm Thấu Ngược RO

Công nghệ thẩm thấu ngược RO (Reverse Osmosis) là bước đột phá vĩ đại của ngành xử lý nước hiện đại:

Dưới áp lực cực lớn tạo ra từ máy bơm cao áp trục đứng Inox (áp lực từ 150 đến 220 PSI), các phân tử nước tinh khiết $H_2O$ sẽ bị ép xuyên qua các lớp màng lọc cuộn xoắn polyamide với kích thước lỗ lọc chỉ 0.1 nanomet (nhỏ hơn 5000 lần đường kính sợi tóc). Trong khi đó, toàn bộ các ion kim loại nặng, muối khoáng hòa tan, hóa chất thuốc trừ sâu, vi khuẩn và vi rút có kích thước lớn hơn sẽ bị giữ lại và cuốn trôi theo đường nước thải ra ngoài. Kết quả thu được là nguồn nước hoàn toàn trong sạch, an toàn tuyệt đối khi uống trực tiếp vào cơ thể mà không cần đun nấu.

### So Sánh Cơ Chế Lọc RO Với Công Nghệ Lọc Nano Và Ultrafiltration (UF)
Nhiều khách hàng phân vân giữa việc lựa chọn lắp đặt hệ thống lọc UF (màng siêu lọc khe hở 0.01 micron), màng lọc Nano (khe hở 0.001 micron) và công nghệ màng RO (khe hở siêu vi 0.0001 micron). Trong khi công nghệ UF và Nano chỉ loại bỏ được bùn đất thô và vi khuẩn kích thước lớn mà vẫn để lọt toàn bộ các ion kim loại nặng hòa tan như Chì, Thủy Ngân, Asen, Nitrit độc hại, thì công nghệ màng RO của Lọc Nước Hoa Sen là giải pháp duy nhất có khả năng phân tách ở cấp độ ion và nguyên tử. Dưới áp suất thẩm thấu cao, chỉ có các phân tử nước tinh khiết mới đủ điều kiện xuyên qua màng, giúp giảm triệt để chỉ số tổng chất rắn hòa tan TDS từ 300 - 500 ppm xuống còn dưới 10 ppm. Đây là tiêu chuẩn vàng được Tổ Chức Y Tế Thế Giới (WHO) và Bộ Y Tế Việt Nam khuyến nghị áp dụng cho mọi cơ sở sản xuất nước uống trực tiếp và phòng mổ bệnh viện hiện đại.

---

## 2. Sơ Đồ Công Nghệ 5 Cấp Lọc Của Dây Chuyền Hoa Sen

Một dây chuyền sản xuất nước đóng bình chuẩn mực đòi hỏi hệ thống tiền xử lý bảo vệ màng RO vô cùng khắt khe:

### Cấp 1: Tiền Xử Lý Đa Tầng Lọc Thô
Loại bỏ các cặn bẩn kích thước > 10 micron, phù sa, phèn sắt và huyền phù lơ lửng, giúp nước đầu vào đạt chỉ số SDI (Silt Density Index) < 5 trước khi tiếp xúc màng lọc chính.

### Cấp 2: Cột Hấp Phụ Khử Mùi & Hóa Chất Bằng Than Jacobi
Clo dư trong nước máy là kẻ thù số một có thể phá hủy cấu trúc màng RO chỉ sau vài tuần. Cột than hoạt tính gáo dừa có nhiệm vụ bẻ gãy và triệt tiêu hoàn toàn lượng Clo dư thừa này.

### Cấp 3: Cột Làm Mềm Trao Đổi Ion Chống Tắc Màng RO
Cặn vôi Canxi và Magie nếu không được làm mềm sẽ nhanh chóng kết tinh đóng cáu cặn trên bề mặt màng RO. Cột làm mềm hạt nhựa Purolite giúp đưa độ cứng về 0 ppm, bảo vệ màng hoạt động bền bỉ suốt 3 đến 5 năm.

### Cấp 4: Cụm Lọc Tinh Chặn Cặn 5 Micron (Micro Filtration)
Các lõi lọc bông nén PP 5 micron đóng vai trò người gác cổng cuối cùng, chặn đứng những hạt bụi mịn thoát ra từ các cột lọc trước khi nước đi vào bơm tăng áp.

### Cấp 5: Module Màng RO Chính Hãng & Khử Trùng Kép
Trái tim của hệ thống **${cleanKw}** - nơi phân tách dòng nước sạch tinh khôi. Nước sau màng RO tiếp tục được sục khí Ozone khử trùng bình chứa và chiếu đèn tia cực tím UV diệt khuẩn đường ống trước khi chiết rót vào bình.

[![Bảng điều khiển và màng lọc ${cleanKw}](${img2})](${targetProductUrl})

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

Hệ thống do Lọc Nước Hoa Sen sản xuất được cấp chứng nhận kiểm định độc lập, đủ điều kiện pháp lý để các doanh nghiệp xin giấy phép sản xuất nước uống đóng bình, đóng chai theo quy định của Chi cục An toàn Vệ sinh Thực phẩm.

### Công Nghệ Tự Động Rửa Màng Auto-Flushing & Bù Khoáng Tự Nhiên
Trong quá trình tách lọc phân tử, các khoáng chất kết tủa có thể bám dính nhẹ trên bề mặt màng RO. Để khắc phục triệt để hiện tượng này, dây chuyền của Hoa Sen tích hợp van xả tự động Auto-Flushing:
* Mỗi khi khởi động hoặc ngắt bơm, hệ thống tự động mở van xả lưu lượng cao trong 60 giây để cuốn trôi toàn bộ mảng bám cặn ra đường xả thải.
* Đối với nguồn nước uống trực tiếp, hệ thống bổ sung thêm module tạo khoáng Alkaline và đá Maifan Hàn Quốc giúp bù đắp các vi khoáng có lợi như Canxi, Magie, Kẽm ở dạng ion dễ hấp thụ, đồng thời nâng nhẹ độ pH kiềm tính lên mức 7.5 - 8.5 rất tốt cho đường tiêu hóa.
* Cụm đèn cực tím UV Aquapro công suất 29W kết hợp máy tạo Ozone 3g/h giúp tiêu diệt 100% bào tử vi nấm, đảm bảo nước đóng bình lưu trữ suốt 12 tháng không bị tái nhiễm khuẩn hay nhớt bình.

---

## 4. Ứng Dụng Đa Dạng Của Nguồn Nước Tinh Khiết Trong Đời Sống

Nguồn nước sạch thanh khiết từ dây chuyền lọc đóng vai trò thiết yếu trong nhiều lĩnh vực:
* **Cung cấp nước uống công nhân**: Phục vụ hàng nghìn công nhân tại các khu chế xuất, giảm thiểu chi phí mua nước bình bên ngoài tới 80%.
* **Sản xuất dược phẩm, mỹ phẩm**: Đòi hỏi nguồn nước tinh khiết không chứa ion dẫn điện để pha chế dung dịch tiêm truyền và kem dưỡng.
* **Ngành chế biến thực phẩm & đồ uống**: Làm nguyên liệu sản xuất bia, nước giải khát, bánh kẹo cao cấp nhằm giữ trọn hương vị nguyên bản.
* **Cơ sở rửa mạch điện tử**: Các xưởng vi mạch bán dẫn cần nước siêu sạch để tẩy rửa linh kiện mà không để lại bất kỳ vệt khoáng nào.

### Quy Trình Vận Hành & Giám Sát Chất Lượng Nước Trực Tuyến
Để đảm bảo chất lượng nước luôn ổn định 24/7, hệ thống được tích hợp các thiết bị kiểm soát thông minh:
* **Đồng hồ đo lưu lượng điện tử**: Theo dõi chính xác lượng nước tinh khiết thu hồi và lưu lượng nước thải xả bỏ theo thời gian thực.
* **Bút đo chỉ số dẫn điện Online**: Cảnh báo tức thì khi màng lọc có dấu hiệu suy giảm hiệu suất hoặc chỉ số TDS vượt quá ngưỡng cho phép.
* **Rơ le áp suất kép chống cạn và quá áp**: Tự động ngắt toàn bộ hệ thống khi nguồn nước cấp đầu vào bị hụt hoặc áp suất đường ống tăng đột biến.

---

## 5. Dịch Vụ Bảo Trì & Nâng Cấp Dây Chuyền Hoa Sen

Chúng tôi hiểu rằng sự gián đoạn nguồn nước sẽ ảnh hưởng trực tiếp đến chuỗi sản xuất của doanh nghiệp. Vì vậy, Lọc Nước Hoa Sen cung cấp:
1. Đội phản ứng nhanh kỹ thuật hỗ trợ 24/7, có mặt trong vòng 2 giờ tại khu vực Đông Nam Bộ.
2. Dịch vụ sục rửa màng lọc CIP (Cleaning In Place) định kỳ bằng hóa chất chuyên dụng, phục hồi 95% lưu lượng lọc màng cũ.
3. Cung cấp linh kiện màng RO, bơm trục đứng, đèn UV thay thế chính hãng với giá chiết khấu đại lý cấp 1.

---

## 6. Các Câu Hỏi Thường Gặp Về Dây Chuyền (FAQ)

### Q1: Dây chuyền công suất 1.000 lít/giờ cần diện tích nhà xưởng bao nhiêu?
> **Trả lời**: Khung dàn máy Inox công suất 1.000L/h được thiết kế module hóa gọn gàng, chỉ chiếm diện tích mặt sàn khoảng 8 đến 12 mét vuông (bao gồm cả bồn chứa trung gian và bồn thành phẩm).

### Q2: Tỷ lệ thu hồi nước sạch của hệ thống màng RO là bao nhiêu?
> **Trả lời**: Với thiết kế van tuần hoàn nước thải công nghệ mới của Hoa Sen, tỷ lệ thu hồi nước sạch đạt từ 50% đến 65%, giúp doanh nghiệp tiết kiệm hàng trăm triệu đồng chi phí nước cấp mỗi năm.`;
  }

  // -------------------------------------------------------------------------
  // DOMAIN 5: NƯỚC MẶN / KHỬ MUỐI
  // -------------------------------------------------------------------------
  else if (domain === 'man') {
    content = `# ${title}

Biến đổi khí hậu và hiện tượng xâm nhập mặn ngày càng diễn biến khốc liệt tại các tỉnh đồng bằng sông Cửu Long và dải ven biển miền Trung, khiến hệ thống **${cleanKw}** trở thành phao cứu sinh thiết yếu. Khi độ mặn trong kênh rạch và giếng khoan vượt ngưỡng 1‰ đến 10‰, nguồn nước không thể dùng để ăn uống hay tưới tiêu cho các loại cây ăn trái giá trị cao như sầu riêng, bưởi da xanh. Giải pháp khử muối bằng công nghệ SWRO thế hệ mới giúp chuyển hóa dòng nước biển mặn chát thành dòng nước ngọt mát lành.

<div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-left: 4px solid #10b981; padding: 16px 20px; border-radius: 8px; margin: 22px 0;">
  <strong style="font-size: 1.1em; color: #065f46;">🌴 Ứng dụng thực tế cấp bách của máy lọc khử mặn:</strong>
  <ul style="margin-top: 8px; margin-bottom: 0; padding-left: 20px; color: #064e3b; line-height: 1.7;">
    <li>Cứu sống hàng nghìn hecta vườn sầu riêng, chôm chôm, hoa kiểng vào mùa khô hạn mặn lịch sử.</li>
    <li>Cung cấp nước ngọt sinh hoạt, nấu ăn đạt chuẩn Bộ Y Tế cho cư dân hải đảo, nhà giàn và tàu thuyền đánh bắt xa bờ.</li>
    <li>Khử muối triệt để từ độ mặn 15.000 ppm xuống dưới 100 ppm, vị nước ngọt lịm như nước mưa tự nhiên.</li>
  </ul>
</div>

[![Hệ thống máy ${cleanKw} khử muối chuyên sâu](${img1})](${targetProductUrl})

---

## 1. Bản Chất Nước Nhiễm Mặn Và Thách Thức Trong Kỹ Thuật Tách Muối

Nước mặn chứa hàm lượng muối hòa tan cực lớn, chủ yếu là Natri Clorua ($NaCl$), Canxi Clorua ($CaCl_2$) và Magie Sunfat ($MgSO_4$). Áp suất thẩm thấu tự nhiên của nước mặn tỷ lệ thuận với nồng độ muối:

* Nước lợ (Độ mặn 1‰ - 3‰ hay 1.000 - 3.000 mg/L TDS): Áp suất thẩm thấu cần thắng khoảng 50 đến 100 PSI.
* Nước mặn nặng (Độ mặn 5‰ - 15‰ hay 5.000 - 15.000 mg/L TDS): Áp suất thẩm thấu lên tới 250 đến 450 PSI.
* Nước biển đại dương (Độ mặn 30‰ - 35‰ hay 35.000 mg/L TDS): Đòi hỏi áp lực cực hạn 800 đến 1000 PSI.

Để thực hiện quá trình khử muối hiệu quả, máy phải trang bị bơm trục đứng siêu áp lực chế tạo hoàn toàn bằng Inox 316 hoặc đồng thau mạ crôm chống ăn mòn điện hóa, kết hợp màng lọc mặn chuyên dụng SWRO (Sea Water Reverse Osmosis).

---

## 2. Điểm Khác Biệt Giữa Màng RO Thông Thường Và Màng Lọc Nước Mặn

Nhiều người dùng mắc sai lầm nghiêm trọng khi dùng máy lọc nước RO gia đình thông thường để lọc nước nhiễm mặn, dẫn đến màng lọc bị rách thủng và cháy bơm chỉ sau vài ngày hoạt động:

* **Vật liệu chế tạo màng SWRO**: Lớp màng lọc của tập đoàn Dow Filmtec (Mỹ) hoặc Nitto Denko (Nhật Bản) được gia cường bằng sợi polyeste chịu lực kéo cực hạn, chịu được áp suất nén lên tới 60 bar mà không bị biến dạng khe lọc.
* **Khả năng đào thải muối ($NaCl$)**: Tỷ lệ khử muối của màng đạt tới 99.6%, trong khi màng lọc thông thường chỉ loại bỏ được các khoáng nhẹ.
* **Bơm cao áp trục đứng Inox 316**: Chống chịu sự ăn mòn của clo và muối biển nồng độ cao, vận hành êm ái liên tục suốt mùa hạn mặn 24/24.

[![Module màng lọc áp lực cao ${cleanKw}](${img2})](${targetProductUrl})

---

## 3. Bảng Phân Tích Chỉ Số Khử Muối Của Máy Hoa Sen

| Thông số đo lường | Nước sông ngòi nhiễm mặn | Sau khi qua máy xử lý mặn | Tiêu chuẩn tưới sầu riêng / ăn uống |
| :--- | :--- | :--- | :--- |
| **Độ mặn (Đo bằng khúc xạ kế)** | 4.5‰ - 8.0‰ (Mặn chát) | **0.0‰ (Ngọt hoàn toàn)** | < 0.5‰ (Cực kỳ an toàn cho sầu riêng) |
| **Tổng lượng muối TDS** | 4.500 - 8.000 ppm | **< 80 ppm** | < 250 ppm |
| **Hàm lượng ion Natri ($Na^+$)** | 1.800 mg/L (Gây ngộ độc rễ) | **< 15 mg/L** | < 50 mg/L |
| **Hàm lượng ion Clo ($Cl^-$)** | 2.600 mg/L (Làm cháy lá rụng trái) | **< 20 mg/L** | < 100 mg/L |
| **Cảm quan hương vị** | Mặn đắng, không thể nuốt | **Ngọt thanh, mát lành như nước cất** | Thanh khiết |

Hàng trăm nhà vườn tại Bến Tre, Tiền Giang, Sóc Trăng, Cà Mau đã cứu vãn được cả gia tài vườn sầu riêng tiền tỷ nhờ trang bị máy khử muối kịp thời trong các đợt đỉnh mặn mùa khô.

---

## 4. Cấu Hình Thiết Bị Phục Vụ Tưới Tiêu Nông Nghiệp & Gia Đình

Lọc Nước Hoa Sen cung cấp các phiên bản máy khử mặn đa dạng công suất:
1. **Máy lọc mặn mini gia đình (250L/h - 500L/h)**: Thiết kế dạng khung bánh xe di động, phục vụ nhu cầu ăn uống, tắm giặt và xịt thuốc bảo vệ thực vật.
2. **Dây chuyền lọc mặn tưới vườn (1.000L/h - 3.000L/h)**: Trang bị hệ thống tự động sục rửa màng, bơm trực tiếp vào hồ chứa bạt để tưới nhỏ giọt cho 1 đến 3 hecta cây trồng.
3. **Trạm lọc nước mặn công nghiệp (> 5.000L/h)**: Phục vụ các nhà máy chế biến thủy hải sản, resort ven biển Phú Quốc, Côn Đảo, Phan Thiết.

---

## 5. Hướng Dẫn Kéo Dài Tuổi Thọ Màng Lọc Chống Tắc Nghẽn

Do nước sông nhiễm mặn thường đi kèm phù sa và bùn hữu cơ, việc bảo dưỡng hệ thống **${cleanKw}** cần tuân thủ 3 nguyên tắc:
* **Luôn có cụm lọc thô đầu nguồn**: Lắp đặt lọc đĩa hoặc lọc túi kích thước 25 đến 50 micron trước máy để chặn rác thải và rong rêu trôi nổi.
* **Xả màng bằng nước ngọt sau mỗi ca làm việc (Flushing)**: Khi tắt máy, hệ thống tự động bơm 5 phút nước ngọt tinh khiết để tráng rửa sạch muối bám trên bề mặt màng, ngăn ngừa muối đóng cứng làm rách màng.
* **Bảo quản màng khi hết mùa mặn**: Ngâm màng trong dung dịch bảo quản chuyên dụng nếu không sử dụng trong mùa mưa để tránh nấm mốc phát triển.

---

## 6. Câu Hỏi Thường Gặp Về Thiết Bị Khử Mặn (FAQ)

### Q1: Thiết bị có thể chạy bằng nguồn điện máy phát hoặc điện mặt trời không?
> **Trả lời**: Hoàn toàn được. Các dòng máy công suất 500L/h đến 1000L/h sử dụng động cơ tiết kiệm điện biến tần Inverter, có thể vận hành trơn tru với máy phát điện 3kW hoặc hệ thống điện mặt trời lưu trữ tại các vùng hẻo lánh chưa có điện lưới.

### Q2: Chi phí sản xuất 1 khối nước ngọt từ máy là bao nhiêu tiền điện?
> **Trả lời**: Trung bình máy tiêu hao khoảng 2 đến 3.5 kWh điện cho một mét khối nước ngọt thành phẩm (tương đương khoảng 6.000đ đến 9.000đ/m3), rẻ hơn rất nhiều so với việc mua sà lan nước ngọt chở từ thượng nguồn về với giá 80.000đ đến 150.000đ/m3.`;
  }

  // -------------------------------------------------------------------------
  // DOMAIN 6: CÔNG NGHIỆP / NHÀ MÁY
  // -------------------------------------------------------------------------
  else if (domain === 'cong_nghiep') {
    content = `# ${title}

Trong kỷ nguyên chuyển đổi số và tự động hóa sản xuất, việc trang bị hệ thống **${cleanKw}** đạt chuẩn quốc tế là điều kiện tiên quyết giúp các doanh nghiệp nâng cao năng lực cạnh tranh và đáp ứng các tiêu chuẩn xuất khẩu khắt khe như ISO 22000, HACCP hay GMP. Từ các ngành chế biến thực phẩm, dệt nhuộm, xi mạ đến các nhà máy điện tử bán dẫn và lò hơi áp lực cao, nguồn nước tinh khiết đóng vai trò quyết định đến chất lượng sản phẩm cuối cùng. Bài viết này phân tích giải pháp thiết kế dây chuyền công suất từ 1.000L/h đến 50.000L/h tối ưu chi phí vận hành.

<div style="background: #faf5ff; border: 1px solid #e9d5ff; border-left: 4px solid #a855f7; padding: 16px 20px; border-radius: 8px; margin: 22px 0;">
  <strong style="font-size: 1.1em; color: #7e22ce;">🏭 4 Tiêu chuẩn kỹ thuật khắt khe của hệ thống xử lý công suất lớn:</strong>
  <ul style="margin-top: 8px; margin-bottom: 0; padding-left: 20px; color: #581c87; line-height: 1.7;">
    <li>Khung giàn chịu lực đúc bằng Inox 304 / Inox 316 chống rung lắc, chịu tải trọng lớn và chống gỉ sét môi trường hóa chất.</li>
    <li>Tủ điện điều khiển lập trình tự động bằng biến tần PLC Siemens hoặc Mitsubishi kèm màn hình cảm ứng HMI thông minh.</li>
    <li>Tích hợp cảm biến đo độ dẫn điện dẫn lưu trực tuyến Online Conductivity Monitor và đồng hồ đo lưu lượng tức thời.</li>
    <li>Khả năng mở rộng công suất module linh hoạt khi nhà máy tăng quy mô dây chuyền sản xuất trong tương lai.</li>
  </ul>
</div>

[![Dây chuyền ${cleanKw} quy mô lớn tại nhà máy](${img1})](${targetProductUrl})

---

## 1. Tầm Quan Trọng Của Nguồn Nước Tiêu Chuẩn Trong Quy Trình Sản Xuất

Nguồn nước cấp chưa đạt chuẩn có thể gây ra những thiệt hại kinh tế khổng lồ cho các nhà xưởng:
* **Đóng cáu cặn lò hơi (Boiler)**: Khoáng Canxi và Magie trong nước cấp lò hơi khi bị đun sôi sẽ đóng thành lớp cáu cặn cứng dày trên thành ống sinh hơi, làm giảm 40% hiệu suất truyền nhiệt, gây hao tốn hàng trăm triệu tiền dầu đốt và tiềm ẩn rủi ro nổ lò hơi nguy hiểm. Hệ thống khử khoáng làm mềm là giải pháp bắt buộc.
* **Lỗi bo mạch điện tử**: Trong ngành sản xuất vi mạch, chỉ một hạt bụi ion khoáng nhỏ li ti cũng có thể gây đoản mạch chập cháy chip điện tử.
* **Biến đổi chất lượng thực phẩm**: Clo dư và tạp chất hữu cơ làm thay đổi mùi vị của nước mắm, bia, sữa và tương cà, khiến lô hàng bị đối tác quốc tế từ chối nhập khẩu.

---

## 2. Các Phân Hệ Cốt Lõi Trong Dây Chuyền Hiện Đại

Một tổ hợp trạm xử lý tiêu chuẩn cao bao gồm 4 khối module chính:

### Phân Hệ 1: Tiền Xử Lý Cơ Học & Khử Kim Loại Nặng
Bao gồm các bồn lọc cát thạch anh cỡ lớn bằng Composite 1865, 2472 hoặc Inox 304 dày 3mm, có nhiệm vụ lọc sạch cặn bùn, phèn sắt và huyền phù lơ lửng, đảm bảo độ đục nước cấp < 1 NTU.

### Phân Hệ 2: Khử Khoáng Khí & Làm Mềm Trao Đổi Ion
Các cột trao đổi ion công nghiệp nạp hạt nhựa Cation Purolite C100E (Anh Quốc) có dung lượng trao đổi cao, liên kết với hệ thống bồn pha muối tự động để hoàn nguyên hạt nhựa liên tục 24/7.

### Phân Hệ 3: Module Lọc Màng RO Đa Cấp (Multi-Stage RO)
Tùy theo yêu cầu độ sạch, hệ thống có thể cấu hình dạng 1 Pass (thu hồi 70% nước sạch) hoặc 2 Pass (nước thành phẩm của Pass 1 tiếp tục đi vào Pass 2) để đạt chỉ số dẫn điện siêu thấp < 2 $\\mu S/cm$.

### Phân Hệ 4: Khử Ion Sâu EDI (Electrodeionization) Hoặc Cột DI Hỗn Hợp
Đối với ngành dược phẩm và vi mạch, công nghệ điện khử ion EDI liên tục loại bỏ các vết ion khoáng cuối cùng mà không cần dùng axit hay xút ăn da để tái sinh, đưa điện trở kháng của nước lên mức siêu tinh khiết 15 đến 18.2 $M\\Omega\\cdot cm$.

[![Tủ điện điều khiển tự động PLC cho hệ thống ${cleanKw}](${img2})](${targetProductUrl})

---

## 3. Bảng Tiêu Chuẩn Nước Cấp Công Nghiệp Tương Ứng Từng Ngành Hàng

| Ngành sản xuất | Tiêu chuẩn chất lượng yêu cầu | Cấu hình đề xuất khuyên dùng |
| :--- | :--- | :--- |
| **Nước cấp lò hơi áp lực cao** | Độ cứng = 0 mg/L, Silica < 0.02 mg/L | Cột làm mềm 2 cấp + Lọc tinh RO |
| **Sản xuất thực phẩm & đồ uống** | Chuẩn QCVN 6-1:2010/BYT, không mùi clo | Lọc đa tầng + Than Jacobi + Màng RO 1 Pass |
| **Sản xuất dược phẩm & dịch truyền** | Chuẩn Dược điển Dược Quốc Gia, nội độc tố < 0.25 EU/ml | Hệ RO 2 Pass + Khử ion EDI + Đèn UV sát khuẩn |
| **Xi mạ & tẩy rửa bề mặt kim loại** | Độ dẫn điện < 5 $\\mu S/cm$, không để lại vệt ố | Dây chuyền khử khoáng sâu |
| **Gia công linh kiện bán dẫn điện tử** | Điện trở kháng > 15 $M\\Omega\\cdot cm$ (Nước siêu sạch UPW) | Hệ thống tiền lọc + RO 2 Pass + EDI + Hạt Mixbed |

Mỗi giải pháp của Hoa Sen đều được thiết kế đo ni đóng giày riêng biệt theo đúng tính chất nguồn nước và đặc thù sản xuất của từng nhà xưởng.

---

## 4. Tự Động Hóa Giám Sát Scada & Quản Lý Vận Hành Từ Xa

Hệ thống **${cleanKw}** thế hệ 2026 của Lọc Nước Hoa Sen được tích hợp giải pháp điều khiển công nghiệp 4.0:
* **Giám sát thông số thời gian thực**: Cảm biến đo áp lực đầu vào, áp lực màng RO, lưu lượng nước sạch và nước thải hiển thị trực tiếp trên màn hình cảm ứng HMI.
* **Kết nối đám mây IoT**: Giám đốc nhà máy và kỹ sư vận hành có thể theo dõi chỉ số TDS và tình trạng máy thông qua ứng dụng trên điện thoại di động mọi lúc mọi nơi.
* **Cơ chế tự bảo vệ thông minh**: Tự động ngắt bơm khi mất nước nguồn cấp, tự động dừng khi bồn chứa đầy và phát còi báo động khi áp suất màng vượt ngưỡng an toàn.

---

## 5. Năng Lực Triển Khai Nhà Thầu Của Lọc Nước Hoa Sen

Với đội ngũ kỹ sư môi trường và chuyên gia tự động hóa hơn 10 năm kinh nghiệm, Lọc Nước Hoa Sen là đối tác tin cậy của hàng trăm tập đoàn lớn tại các KCN VSIP, Amata, Long Đức, Tân Tạo, Hiệp Phước:
1. Cam kết bàn giao công trình đúng tiến độ hợp đồng, đầy đủ hồ sơ thẩm định và bản vẽ hoàn công.
2. Cung cấp đầy đủ chứng chỉ nguồn gốc xuất xứ CO/CQ của từng linh kiện bơm màng vật liệu lọc.
3. Chế độ bảo hành 24 đến 36 tháng, dịch vụ bảo trì trọn đời hỗ trợ kỹ thuật tận nhà máy 24/7.

---

## 6. Câu Hỏi Thường Gặp Về Dự Án (FAQ)

### Q1: Thời gian thi công một dây chuyền công suất 5.000L/h mất bao lâu?
> **Trả lời**: Thời gian gia công lắp ráp khung bồn tại xưởng sản xuất của Hoa Sen mất khoảng 7 đến 10 ngày, thời gian lắp đặt và chạy thử nghiệm thu tại nhà máy khách hàng chỉ mất từ 2 đến 3 ngày làm việc.

### Q2: Hoa Sen có hỗ trợ xét nghiệm mẫu nước định kỳ cho nhà máy không?
> **Trả lời**: Có. Chúng tôi cung cấp gói dịch vụ lấy mẫu nước định kỳ mỗi quý và gửi xét nghiệm tại các trung tâm kiểm định độc lập uy tín, hỗ trợ doanh nghiệp hoàn thiện hồ sơ báo cáo môi trường hàng năm.`;
  }

  // -------------------------------------------------------------------------
  // DOMAIN 7: CHUNG / MẶC ĐỊNH
  // -------------------------------------------------------------------------
  else {
    content = `# ${title}

Nhu cầu trang bị giải pháp **${cleanKw}** chuyên nghiệp đang trở thành xu hướng tất yếu của các gia đình, tòa nhà và cơ sở sản xuất nhằm đảm bảo an toàn tuyệt đối cho sức khỏe. Nguồn nước ô nhiễm tạp chất, bùn cát, phèn kim loại và clo dư là nguyên nhân hàng đầu tàn phá các thiết bị vệ sinh, gây khô ráp da tóc và tiềm ẩn nhiều rủi ro bệnh tật. Bài viết này cung cấp cẩm nang kỹ thuật toàn diện giúp bạn hiểu rõ cấu tạo, nguyên lý vận hành và bảng báo giá trọn gói giải pháp đạt chuẩn Bộ Y Tế.

<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; padding: 16px 20px; border-radius: 8px; margin: 22px 0;">
  <strong style="font-size: 1.1em; color: #15803d;">💡 3 Lợi ích vàng khi ứng dụng giải pháp ${cleanKw}:</strong>
  <ul style="margin-top: 8px; margin-bottom: 0; padding-left: 20px; color: #14532d; line-height: 1.7;">
    <li>Loại bỏ 100% bùn đất, rỉ sét, cặn lơ lửng và mùi tanh hôi khó chịu ngay tại nguồn cấp.</li>
    <li>Khử sạch kim loại nặng hòa tan và hóa chất độc hại, đưa nguồn nước về chuẩn an toàn QCVN.</li>
    <li>Bảo vệ độ bền thiết bị gia dụng gấp đôi, tiết kiệm hàng triệu đồng chi phí thay lõi lọc phụ trợ.</li>
  </ul>
</div>

[![Giải pháp ${cleanKw} chuyên nghiệp](${img1})](${targetProductUrl})

---

## 1. Phân Tích Thực Trạng Nguồn Nước Và Lý Do Cần Trang Bị Hệ Thống

Dù sử dụng nguồn nước máy đô thị hay nước ngầm nông thôn, người tiêu dùng vẫn phải đối mặt với các nguy cơ ô nhiễm tiềm ẩn:
* **Hóa chất Clo dư nồng nặc**: Clo khử trùng ở nồng độ cao gây kích ứng niêm mạc mắt, khô rát da và xơ rối tóc khi tắm gội mỗi ngày.
* **Cặn vôi Canxi và Magie**: Hiện tượng nước cứng đóng cặn trắng làm hoen ố vách kính tắm, tắc nghẽn van sen vòi và gây tốn điện bình nóng lạnh.
* **Tạp chất lơ lửng và vi sinh vật**: Các đường ống cấp nước cũ nát sau nhiều năm vận hành thường tích tụ bùn cặn và rỉ sét kim loại nguy hại. Giải pháp **${cleanKw}** là bước khiên chắn bảo vệ kiên cố nhất.

---

## 2. Cấu Tạo Vật Liệu Lọc Đa Tầng Chuẩn Y Tế

Một hệ thống hoàn chỉnh do Lọc Nước Hoa Sen cung cấp được thiết kế theo cấu trúc phân tầng khoa học:
1. **Sỏi Đỡ Thạch Anh**: Lớp lót đáy thu gom nước sạch đồng đều và ngăn ngừa xả trôi hạt lọc mịn.
2. **Cát Thạch Anh Lọc Cặn**: Giữ lại các hạt huyền phù và cặn lơ lửng kích thước nhỏ.
3. **Than Hoạt Tính Gáo Dừa Cao Cấp**: Hấp thụ độc tố clo dư, mùi tanh hôi và màu đục hữu cơ.
4. **Hạt Nhựa Trao Đổi Ion Làm Mềm**: Triệt tiêu cặn vôi, mang lại dòng nước mềm mại thanh khiết cho sinh hoạt.
5. **Hạt Nâng Cân Bằng Độ pH**: Giữ độ pH nguồn nước luôn trong dải trung tính an toàn 6.8 đến 7.6.

[![Chi tiết cấu tạo cột lọc ${cleanKw}](${img2})](${targetProductUrl})

---

## 3. Bảng Kiểm Định Chỉ Số Chất Lượng Nước Sau Lọc

| Chỉ số kiểm tra | Nước nguồn chưa qua xử lý | Sau khi qua hệ thống lọc | Quy chuẩn Bộ Y Tế |
| :--- | :--- | :--- | :--- |
| **Độ đục cảm quan (NTU)** | > 5.0 NTU (Đục mờ) | **< 0.2 NTU (Trong suốt tinh khôi)** | < 2.0 NTU |
| **Clo tự do tồn dư** | 0.8 - 1.5 mg/L | **0.0 mg/L (Sạch mùi clo hoàn toàn)** | < 0.5 mg/L |
| **Độ cứng tổng ($CaCO_3$)** | 280 - 400 mg/L | **< 60 mg/L (Nước mềm mịn màng)** | < 300 mg/L |
| **Hàm lượng kim loại nặng** | Có tạp chất kim loại | **Không phát hiện tạp chất độc** | Chuẩn QCVN |
| **Mùi vị cảm quan** | Tanh hôi, nồng mùi hóa chất | **Thanh mát, ngọt tự nhiên** | Không có mùi lạ |

---

## 4. Hướng Dẫn Vận Hành & Bảo Trì Hệ Thống Bền Lâu

Người dùng có thể dễ dàng vận hành thông qua van cơ 3 cửa hoặc cụm van tự động điện tử thông minh:
* **Định kỳ sục rửa ngược (Backwash)**: Thực hiện mỗi tuần một lần trong 10 đến 15 phút để tống khứ lớp cặn bẩn tích tụ ra ngoài.
* **Rửa xuôi nén hạt (Fast Rinse)**: Rửa xuôi trong 5 phút để nén chặt các tầng vật liệu lọc về vị trí làm việc ổn định.
* **Chuyển về nấc cấp nước (Service)**: Vận hành cấp nước tinh sạch liên tục vào bồn chứa gia đình.

---

## 5. Quy Trình Khảo Sát & Lắp Đặt Tận Nơi Của Hoa Sen

Đội ngũ kỹ thuật viên giàu kinh nghiệm cam kết mang đến dịch vụ hoàn hảo:
* Test mẫu nước tận nhà miễn phí bằng thiết bị đo chuyên dụng.
* Tư vấn cấu hình và vị trí lắp đặt gọn gàng, phù hợp mỹ quan ngôi nhà.
* Thi công nhanh chóng trong ngày, đường ống hàn nhiệt chịu áp lực cao chống rò rỉ.
* Bảo hành toàn diện 36 tháng tận nơi, hỗ trợ kỹ thuật trọn đời 24/7.

---

## 6. Câu Hỏi Thường Gặp Về Dịch Vụ (FAQ)

### Q1: Chi phí bảo dưỡng hệ thống mỗi năm có tốn kém không?
> **Trả lời**: Chi phí cực kỳ tiết kiệm, chỉ cần sục rửa xả cặn định kỳ bằng nước mà không cần hóa chất phức tạp.

### Q2: Hoa Sen có hỗ trợ lắp đặt tại các tỉnh lân cận không?
> **Trả lời**: Chúng tôi hỗ trợ khảo sát và lắp đặt tận nơi tại TP.HCM, Bình Dương, Đồng Nai, Long An, Tây Ninh, Tiền Giang và toàn miền Nam.`;
  }

  // Common closing & CTA
  content += `\n\n---\n\n## Lời Kết\n\nĐầu tư giải pháp **${cleanKw}** chính là quyết định sáng suốt nhất để bảo vệ sức khỏe lâu dài cho gia đình và nâng tầm giá trị cuộc sống. Hãy liên hệ ngay với [Lọc Nước Hoa Sen](https://xulynuochoasen.com) để được các chuyên gia kỹ thuật hàng đầu phục vụ tận tình!\n\n👉 **Sản Phẩm Đúng Chuyên Mục:** [Xem Sản Phẩm Tương Ứng](${targetProductUrl}) - *Giải pháp kỹ thuật chuyên sâu đạt chuẩn Bộ Y Tế.*\n\n<div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px; padding: 24px; color: #ffffff; margin: 30px 0; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.3); border: 1px solid #334155; text-align: center;">\n  <h3 style="color: #38bdf8; margin-top: 0; font-size: 1.4em; font-weight: 700;">📞 CÔNG TY CỔ PHẦN THIÊN NHIÊN VÀ MÔI TRƯỜNG HOA SEN</h3>\n  <p style="color: #cbd5e1; font-size: 1.05em; margin-bottom: 18px;">Chuyên gia giải pháp xử lý <strong>${cleanKw}</strong> chuyên sâu đạt chuẩn Bộ Y Tế trên toàn quốc.</p>\n  <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 15px;">\n    <a href="tel:0938880492" style="background: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 30px; text-decoration: none; font-weight: bold; display: inline-flex; align-items: center; gap: 8px;">\n      📱 Hotline Tư Vấn: 0938 880 492\n    </a>\n    <a href="https://zalo.me/0938880492" target="_blank" rel="noopener" style="background: #0284c7; color: #ffffff; padding: 12px 24px; border-radius: 30px; text-decoration: none; font-weight: bold; display: inline-flex; align-items: center; gap: 8px;">\n      💬 Zalo Báo Giá 24/7: 0938 880 492\n    </a>\n  </div>\n  <p style="font-size: 0.9em; color: #94a3b8; margin: 0;">📍 <em>Khảo sát &amp; xét nghiệm mẫu nước tận nơi miễn phí tại TP.HCM, Bình Dương, Đồng Nai, Long An và toàn miền Nam.</em></p>\n</div>\n\n<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [\n    {\n      "@type": "Question",\n      "name": "Hệ thống ${cleanKw} có tốn nhiều điện năng và diện tích không?",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "Hệ thống tận dụng áp lực nước có sẵn hoặc bơm gia đình, chiếm diện tích chỉ từ 0.5 đến 1 mét vuông."\n      }\n    },\n    {\n      "@type": "Question",\n      "name": "Bao lâu thì cần thay thế vật liệu lọc bên trong cột ${cleanKw}?",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "Định kỳ sục rửa hàng tuần, tuổi thọ vật liệu lọc kéo dài từ 3 đến 5 năm mới cần thay mới."\n      }\n    }\n  ]\n}\n</script>`;

  return {
    title,
    metaDescription,
    content,
    imageUrl: img1,
    secondaryImageUrl: img2,
    targetProductUrl
  };
}

module.exports = {
  generateSmartSeoTemplate,
  getRecentUsedImages
};
