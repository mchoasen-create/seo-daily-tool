const fs = require('fs');
const path = require('path');

const KNOWLEDGE_FILE = path.join(__dirname, '../data/industry_knowledge.json');

/**
 * DANH MỤC 60+ ĐỊA PHƯƠNG, QUẬN, HUYỆN, THỊ XÃ, KCN, XÃ PHƯỜNG TRỌNG ĐIỂM MIỀN NAM
 * Phủ khắp TP.HCM, Bình Dương, Đồng Nai, Long An, Tây Ninh, Bà Rịa - Vũng Tàu, Tiền Giang, Bến Tre, ĐBSCL & Tây Nguyên
 */
const SOUTHERN_REGIONS = [
  // --- TP. HỒ CHÍ MINH (Đô thị, ven đô, nông thôn) ---
  { name: 'Quận 12, TP.HCM', shortName: 'Quận 12, HCM', waterFeature: 'Nước máy thủy cục áp lực không đều, còn tồn đọng Clo dư và rỉ sét từ đường ống cũ; vùng ven còn dùng giếng nhiễm kim loại nhẹ.' },
  { name: 'Hóc Môn, TP.HCM', shortName: 'Hóc Môn, HCM', waterFeature: 'Nước giếng khoan nhiễm phèn sắt nặng, độ cứng canxi magiê ở mức trung bình đến cao.' },
  { name: 'Củ Chi, TP.HCM', shortName: 'Củ Chi, HCM', waterFeature: 'Nhiễm sắt hòa tan Fe2+, mangan và có mùi bùn tanh đặc trưng vùng chuyển tiếp đất bazan phù sa cổ.' },
  { name: 'Bình Chánh, TP.HCM', shortName: 'Bình Chánh, HCM', waterFeature: 'Nguồn nước ngầm và nước giếng nhiễm phèn sắt nặng, độ đục cao, nhiễm hữu cơ và pH thấp < 5.5.' },
  { name: 'Nhà Bè, TP.HCM', shortName: 'Nhà Bè, HCM', waterFeature: 'Khu vực hạ lưu sông ngòi dễ nhiễm lợ, phèn chua và có nồng độ chất hữu cơ hòa tan cao.' },
  { name: 'Cần Giờ, TP.HCM', shortName: 'Cần Giờ, HCM', waterFeature: 'Nguồn nước giếng và nước mặt nhiễm mặn nặng quanh năm, bắt buộc phải dùng màng RO khử mặn chuyên sâu.' },
  { name: 'TP. Thủ Đức, TP.HCM', shortName: 'TP. Thủ Đức', waterFeature: 'Nhiều khu đô thị mới nguồn nước máy chứa cặn rỉ sét đường ống cũ, biệt thự cần hệ lọc tổng làm mềm nước cao cấp.' },
  { name: 'Thảo Điền, TP. Thủ Đức', shortName: 'Thảo Điền', waterFeature: 'Khu biệt thự cao cấp ven sông Sài Gòn, nhu cầu lọc nước sinh hoạt siêu sạch, làm mềm chống ố vòi sen cao cấp.' },
  { name: 'Quận 7, TP.HCM', shortName: 'Quận 7, HCM', waterFeature: 'Nước máy đô thị có dư lượng clo khử trùng nồng nặc và cặn kim loại, căn hộ và biệt thự chuộng lọc đầu nguồn.' },
  { name: 'Phú Mỹ Hưng, Quận 7', shortName: 'Phú Mỹ Hưng', waterFeature: 'Khu đô thị chuẩn quốc tế, yêu cầu nguồn nước sinh hoạt đạt chuẩn uống tại vòi và bảo vệ hệ thống thiết bị nhập khẩu.' },
  { name: 'Quận 6, TP.HCM', shortName: 'Quận 6, HCM', waterFeature: 'Nhiều trường học, cơ sở sản xuất và xưởng gia công cần nước tinh khiết phục vụ công nhân và học sinh.' },
  { name: 'Quận 10, TP.HCM', shortName: 'Quận 10, HCM', waterFeature: 'Mật độ nhà hàng, khách sạn và xưởng thực phẩm đồ uống cao, cần nguồn nước lọc RO ổn định 24/7.' },
  { name: 'Bình Tân, TP.HCM', shortName: 'Bình Tân, HCM', waterFeature: 'Mật độ dân cư và phòng trọ, xưởng may mặc đông đúc, nguồn nước ngầm có độ đục và phèn sắt.' },
  { name: 'Tân Phú, TP.HCM', shortName: 'Tân Phú, HCM', waterFeature: 'Nước máy thủy cục chứa cặn vôi và clo, xưởng dệt nhuộm và chế biến thực phẩm cần nước mềm.' },
  { name: 'Gò Vấp, TP.HCM', shortName: 'Gò Vấp, HCM', waterFeature: 'Khu dân cư đông đúc, nhu cầu lọc nước đầu nguồn cho nhà phố và phòng khám y tế lớn.' },

  // --- BÌNH DƯƠNG (Thủ phủ công nghiệp & đô thị vệ tinh) ---
  { name: 'Thủ Dầu Một, Bình Dương', shortName: 'Thủ Dầu Một', waterFeature: 'Nguồn nước ngầm nhiễm sắt và có độ cứng vừa phải, các cơ sở kinh doanh dịch vụ ăn uống phát triển mạnh.' },
  { name: 'Dĩ An, Bình Dương', shortName: 'Dĩ An', waterFeature: 'Nguồn nước đá vôi có độ cứng cao vượt 250 mg/L gây đóng cặn xoong nồi, thiết bị gia nhiệt và tháp giải nhiệt.' },
  { name: 'Thuận An, Bình Dương', shortName: 'Thuận An', waterFeature: 'Tập trung nhiều nhà máy dược phẩm, thực phẩm và khu dân cư sầm uất, yêu cầu nước chuẩn vi sinh.' },
  { name: 'Lái Thiêu, Thuận An', shortName: 'Lái Thiêu', waterFeature: 'Vùng ven sông nhiều biệt thự vườn, nguồn nước ngầm có nồng độ sắt và chất hữu cơ tự nhiên cao.' },
  { name: 'Tân Uyên, Bình Dương', shortName: 'Tân Uyên', waterFeature: 'Nhiều xưởng gỗ, xưởng cơ khí chế tạo và nhà máy sản xuất, nước giếng có hàm lượng sắt và mangan cao.' },
  { name: 'Bến Cát, Bình Dương', shortName: 'Bến Cát', waterFeature: 'Nước giếng ngầm phục vụ nhà xưởng có hàm lượng silica và khoáng hòa tan cao, cần tiền lọc trước khi qua RO.' },
  { name: 'Bàu Bàng, Bình Dương', shortName: 'Bàu Bàng', waterFeature: 'Khu công nghiệp phát triển nhanh, tầng ngậm nước sâu chứa sắt và có tính axit nhẹ.' },
  { name: 'KCN VSIP, Bình Dương', shortName: 'VSIP Bình Dương', waterFeature: 'Nhà máy FDI yêu cầu khắt khe về độ dẫn điện EC, chỉ số SDI < 3 và tiêu chuẩn nước cấp lò hơi.' },
  { name: 'KCN Sóng Thần, Bình Dương', shortName: 'Sóng Thần Bình Dương', waterFeature: 'Khu công nghiệp trọng điểm với nhu cầu làm mềm nước lò hơi và lọc RO công suất lớn.' },
  { name: 'KCN Mỹ Phước, Bến Cát', shortName: 'Mỹ Phước Bình Dương', waterFeature: 'Hệ thống nhà xưởng quy mô lớn, cần các cụm lọc nước công nghiệp 2000L/h đến 5000L/h vận hành liên tục.' },
  { name: 'KCN Nam Tân Uyên, Bình Dương', shortName: 'Nam Tân Uyên', waterFeature: 'Nguồn nước cấp nhà máy cần hệ thống lọc áp lực khử sắt và clo để bảo vệ màng RO công nghiệp.' },

  // --- ĐỒNG NAI (Khu công nghiệp trọng điểm & đô thị sân bay) ---
  { name: 'Biên Hòa, Đồng Nai', shortName: 'Biên Hòa', waterFeature: 'Nguồn nước có độ cứng canxi cao và lẫn tạp chất phù sa lơ lửng, nhiều KCN quy mô lớn.' },
  { name: 'Long Thành, Đồng Nai', shortName: 'Long Thành', waterFeature: 'Vùng đất sân bay quốc tế đang đô thị hóa cực nhanh, nước ngầm nhiễm phèn kết hợp độ cứng.' },
  { name: 'Nhơn Trạch, Đồng Nai', shortName: 'Nhơn Trạch', waterFeature: 'Tập trung 6 cụm KCN lớn, nước ngầm chịu ảnh hưởng mặn nhẹ mùa khô, cần hệ thống RO công nghiệp khử mặn.' },
  { name: 'Trảng Bom, Đồng Nai', shortName: 'Trảng Bom', waterFeature: 'Nhiều trang trại chăn nuôi quy mô lớn và cụm công nghiệp Sông Mây, Hố Nai cần nước sạch khử mùi.' },
  { name: 'Long Khánh, Đồng Nai', shortName: 'Long Khánh', waterFeature: 'Vùng đồi đất đỏ bazan nồng độ oxit sắt cao, cơ sở chế biến nông sản và trái cây cần lọc RO.' },
  { name: 'Vĩnh Cửu, Đồng Nai', shortName: 'Vĩnh Cửu', waterFeature: 'Nguồn nước ven hồ Trị An nhiều vi sinh vật lơ lửng, cần màng lọc UF và hệ thống tiệt trùng Ozone.' },
  { name: 'KCN Amata, Đồng Nai', shortName: 'KCN Amata', waterFeature: 'Tập đoàn đa quốc gia yêu cầu chuẩn nước tinh khiết vi sinh và kiểm soát độ dẫn điện EC khắt khe.' },
  { name: 'KCN Nhơn Trạch, Đồng Nai', shortName: 'KCN Nhơn Trạch', waterFeature: 'Các nhà máy dệt sợi, nhuộm và hóa chất cần nguồn nước cấp lò hơi đã qua khử khoáng triệt để.' },

  // --- LONG AN (Cửa ngõ miền Tây & KCN vệ tinh) ---
  { name: 'Bến Lức, Long An', shortName: 'Bến Lức', waterFeature: 'Nước ngầm gần KCN có nguy cơ nhiễm chất hữu cơ vi lượng và phèn chua mùa khô, độ đục cao.' },
  { name: 'Đức Hòa, Long An', shortName: 'Đức Hòa', waterFeature: 'Điểm nóng ô nhiễm phèn sắt, nồng độ sắt tổng Fe có thể lên tới 6 - 15 mg/L và pH < 5.2.' },
  { name: 'Cần Giuộc, Long An', shortName: 'Cần Giuộc', waterFeature: 'Khu vực ven sông Soài Rạp chịu xâm nhập mặn mùa khô, khu công nghiệp Long Hậu cần nước RO lớn.' },
  { name: 'Cần Đước, Long An', shortName: 'Cần Đước', waterFeature: 'Nước ngầm phèn mặn nặng, người dân và trang trại thủy sản cần hệ thống lọc mặn RO 2 tầng.' },
  { name: 'TP. Tân An, Long An', shortName: 'Tân An Long An', waterFeature: 'Trung tâm hành chính tỉnh, nước máy đô thị nhiều clo và cặn đường ống, khu dân cư chuộng lọc tổng.' },
  { name: 'KCN Long Hậu, Cần Giuộc', shortName: 'KCN Long Hậu', waterFeature: 'Các nhà máy chế biến thực phẩm, logistics cần nguồn nước sạch đạt chuẩn đóng chai trực tiếp.' },
  { name: 'KCN Tân Đức, Đức Hòa', shortName: 'KCN Tân Đức', waterFeature: 'Nhu cầu nước mềm chống bám cặn nồi hơi và nước tinh khiết phục vụ công nhân quy mô lớn.' },
  { name: 'KCN Thuận Đạo, Bến Lức', shortName: 'KCN Thuận Đạo', waterFeature: 'Nhà máy sản xuất phụ tùng và may mặc cần hệ thống lọc nước công nghiệp tự động súc rửa.' },

  // --- TÂY NINH (Vùng biên & KCN lớn) ---
  { name: 'Trảng Bàng, Tây Ninh', shortName: 'Trảng Bàng', waterFeature: 'Nhiều KCN Phước Đông, Linh Trung 3; nước ngầm có độ pH thấp và chứa nhiều khí H2S mùi trứng thối.' },
  { name: 'Gò Dầu, Tây Ninh', shortName: 'Gò Dầu', waterFeature: 'Nước ngầm vùng trũng nhiễm phèn sắt và mangan, cần tháp oxy hóa venturi trước khi qua cát lọc.' },
  { name: 'TP. Tây Ninh', shortName: 'Tây Ninh', waterFeature: 'Nguồn nước đô thị chân núi Bà Đen có độ cứng cao, gia đình chuộng hệ lọc tổng composite.' },
  { name: 'KCN Phước Đông, Tây Ninh', shortName: 'KCN Phước Đông', waterFeature: 'KCN lớn nhất Tây Ninh, nhu cầu cấp nước làm mát và nước uống công nhân hàng chục m³/ngày.' },

  // --- BÀ RỊA - VŨNG TÀU (Cảng biển, dầu khí & du lịch) ---
  { name: 'TX. Phú Mỹ, Bà Rịa - Vũng Tàu', shortName: 'Phú Mỹ', waterFeature: 'Cụm cảng nước sâu Cái Mép và KCN nặng, nhu cầu xử lý nước lò hơi và nước làm mát nhà máy rất lớn.' },
  { name: 'TP. Bà Rịa', shortName: 'Bà Rịa', waterFeature: 'Nguồn nước ngầm và nước máy có hàm lượng khoáng cao, cần làm mềm khử canxi.' },
  { name: 'TP. Vũng Tàu', shortName: 'Vũng Tàu', waterFeature: 'Khu du lịch, khách sạn resort cao cấp cần nước mềm chống ăn mòn thiết bị vệ sinh do hơi muối biển.' },
  { name: 'KCN Cái Mép, Phú Mỹ', shortName: 'Cái Mép Vũng Tàu', waterFeature: 'Khu logistics và đóng tàu cảng biển, nước máy cấp tàu biển cần kiểm định hóa lý nghiêm ngặt.' },

  // --- BẾN TRE & TIỀN GIANG (Vùng đặc thù nước phèn & hạn mặn) ---
  { name: 'Ba Tri, Bến Tre', shortName: 'Ba Tri Bến Tre', waterFeature: 'Tâm điểm xâm nhập mặn mùa khô tại đồng bằng sông Cửu Long, độ mặn 2 - 8‰, bắt buộc dùng máy lọc RO nước mặn.' },
  { name: 'Bình Đại, Bến Tre', shortName: 'Bình Đại Bến Tre', waterFeature: 'Vùng ven biển nước mặn lợ quanh năm, các trại nuôi tôm giống và sinh hoạt cần hệ RO lọc mặn chuyên dụng.' },
  { name: 'Thạnh Phú, Bến Tre', shortName: 'Thạnh Phú Bến Tre', waterFeature: 'Nguồn nước mặt và nước ngầm nhiễm phèn mặn kết hợp, cần cụm tiền lọc màng SWRO.' },
  { name: 'TP. Bến Tre', shortName: 'Bến Tre', waterFeature: 'Nước máy đô thị vào mùa khô bị nhiễm mặn theo triều cường sông Tiền, hộ gia đình cần lắp lọc RO dự phòng.' },
  { name: 'Châu Thành, Bến Tre', shortName: 'Châu Thành Bến Tre', waterFeature: 'Vùng cây ăn trái sầu riêng, bưởi da xanh cần nước ngọt khử mặn bảo vệ vườn cây mùa khô hạn.' },
  { name: 'TP. Mỹ Tho, Tiền Giang', shortName: 'Mỹ Tho', waterFeature: 'Khu đô thị ven sông Tiền, nước máy thủy cục nhiễm phù sa và phèn, nhà hàng khách sạn cần nước tinh khiết.' },
  { name: 'TX. Gò Công, Tiền Giang', shortName: 'Gò Công Tiền Giang', waterFeature: 'Vùng hạ lưu sông Vàm Cỏ nhiễm mặn sâu, nước sinh hoạt khan hiếm vào cao điểm mùa khô.' },
  { name: 'Cai Lậy, Tiền Giang', shortName: 'Cai Lậy', waterFeature: 'Thủ phủ sầu riêng miền Tây, nhu cầu lọc nước nhiễm mặn cứu vườn sầu riêng cực kỳ cấp bách.' },

  // --- ĐỒNG BẰNG SÔNG CỬU LONG & TÂY NGUYÊN ---
  { name: 'Cần Thơ', shortName: 'Cần Thơ', waterFeature: 'Nước mặt sông Hậu nhiều phù sa lơ lửng, độ đục cao cần màng siêu lọc UF bảo vệ trước màng RO.' },
  { name: 'KCN Trà Nóc, Cần Thơ', shortName: 'KCN Trà Nóc', waterFeature: 'Khu chế biến thủy sản xuất khẩu cá tra, tôm đông lạnh đòi hỏi nước đạt chuẩn quốc tế HACCP/FDA.' },
  { name: 'Đồng Tháp', shortName: 'Đồng Tháp', waterFeature: 'Vùng trũng phù sa sông Tiền, cơ sở chế biến bột gạo Sa Đéc và thủy sản cần nước tinh khiết không mùi.' },
  { name: 'Vĩnh Long', shortName: 'Vĩnh Long', waterFeature: 'Nước ngầm nhiễm phèn và sắt hữu cơ dạng phức, cần oxy hóa xúc tác bằng hạt quặng mangan cao cấp.' },
  { name: 'Di Linh, Lâm Đồng', shortName: 'Di Linh Lâm Đồng', waterFeature: 'Nguồn nước đồi núi đất đỏ bazan Tây Nguyên có hàm lượng sắt và mangan đặc trưng, chi nhánh Hoa Sen hỗ trợ 24/7.' },
  { name: 'Bảo Lộc, Lâm Đồng', shortName: 'Bảo Lộc', waterFeature: 'Nhà máy chè, cà phê và tơ tằm cần nước mềm khử khoáng để giữ nguyên hương vị tự nhiên của nông sản.' }
];

// Các dải công suất tiêu chuẩn
const CAPACITY_SPECS = [
  {
    cap: '250L/h',
    shortCap: '250L/h',
    users: 'Xưởng sản xuất nhỏ, phòng khám, văn phòng dưới 80 người, biệt thự lớn',
    specs: '1 màng RO 4040 Dow Filmtec/Toray, bơm cao áp trục đứng 1.1kW (áp suất 8-10 bar), tỷ lệ thu hồi nước 55-65%',
    colSpecs: 'Cột lọc Composite 1054 van 3 cửa tự động'
  },
  {
    cap: '500L/h',
    shortCap: '500L/h',
    users: 'Nhà máy từ 100 - 300 công nhân, trường học, cơ sở sản xuất nước uống đóng bình',
    specs: '2 màng RO 4040, bơm cao áp trục đứng 1.5kW (áp suất 9-11 bar), tỷ lệ thu hồi nước 60-70%',
    colSpecs: 'Cột lọc Composite 1252 kết hợp van súc rửa tự động'
  },
  {
    cap: '1000L/h',
    shortCap: '1000L/h',
    users: 'Cơ sở sản xuất nước đóng chai đóng bình 20L, nhà máy 400 - 1000 công nhân',
    specs: '4 màng RO 4040 hoặc 1 màng RO 8040, bơm cao áp 2.2kW (áp suất 10-12 bar), tỷ lệ thu hồi nước 65-75%',
    colSpecs: 'Cột lọc Composite 1465 hoặc Inox 304 vi sinh'
  },
  {
    cap: '1500L/h',
    shortCap: '1500L/h',
    users: 'Dây chuyền chiết rót tự động, xưởng chế biến thực phẩm & đồ uống',
    specs: '6 màng RO 4040, bơm cao áp 3.0kW, biến tần Inverter điều khiển lưu lượng',
    colSpecs: 'Cột lọc Composite 1665 hoặc Inox 304 chuẩn y tế'
  },
  {
    cap: '2000L/h',
    shortCap: '2000L/h',
    users: 'Bệnh viện, nhà máy dệt nhuộm, xưởng sản xuất điện tử, nhà xưởng công nghiệp lớn',
    specs: '2 màng RO 8040 Toray/Dow, bơm cao áp 4.0kW (áp suất 12-14 bar)',
    colSpecs: 'Cụm cột lọc công nghiệp tự động Scada'
  },
  {
    cap: '5000L/h',
    shortCap: '5m³/h',
    users: 'Nhà máy sản xuất quy mô lớn, cấp nước lò hơi và tháp giải nhiệt tuần hoàn',
    specs: '5 màng RO 8040, bơm Ebara/CNP đa tầng cánh 7.5kW (áp suất 12-15 bar)',
    colSpecs: 'Khung giàn Inox 304, hệ thống rửa màng CIP tự động'
  }
];

function capitalizeWords(str) {
  if (!str) return '';
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function cleanKeyword(kw) {
  if (!kw) return '';
  return capitalizeWords(kw.trim());
}

function getBaseKw(kw) {
  let clean = cleanKeyword(kw);
  clean = clean.replace(/^(hệ\s*thống|he\s*thong)\s+/iu, '').trim();
  return clean;
}

function getFullKw(kw) {
  const base = getBaseKw(kw);
  return `Hệ Thống ${base}`;
}

// Đối tượng ứng dụng thực tế phong phú (Tránh lặp lại motip)
const TARGET_APPLICATIONS = [
  'Hộ Gia Đình & Nhà Phố',
  'Biệt Thự & Villa Cao Cấp',
  'Nhà Máy Dược & Mỹ Phẩm',
  'Xưởng Chế Biến Thực Phẩm – Đồ Uống',
  'Trường Học & Cơ Sở Y Tế',
  'Cơ Sở Nước Đóng Bình 20L',
  'Nhà Hàng & Khách Sạn',
  'Doanh Nghiệp & Xưởng May Mặc',
  'Trang Trại & Vườn Cây Ăn Trái',
  'Khu Phòng Trọ & Tòa Nhà Văn Phòng'
];

/**
 * 9 CỤM CHỦ ĐỀ VÀ PHONG CÁCH TIÊU ĐỀ SINH ĐỘNG, ĐA DẠNG
 * Phân chia rõ ràng giữa nhóm ĐỊA PHƯƠNG (Local SEO) và nhóm CHUYÊN MÔN (General)
 * để xen kẽ nhịp nhàng, chống dập khuôn địa phương gây nhàm chán
 */
const TOPIC_CLUSTERS = [
  // ==========================================
  // NHÓM 1: CÁC CỤM ĐỊA PHƯƠNG HÓA (LOCAL SEO - Chiếm ~35%)
  // ==========================================
  {
    clusterId: 'local_application',
    clusterName: 'Thi Công Thực Tế Cho Cơ Sở, Nhà Máy & Biệt Thự Địa Phương',
    type: 'local',
    titleGenerator: (kw, cap, loc, seed = 0) => {
      const baseKw = getBaseKw(kw);
      const fullKw = getFullKw(kw);
      return [
        `Lắp Đặt ${fullKw} Cho Trường Học ${loc.shortName} – Chuẩn Sạch`,
        `Hệ Thống ${baseKw} Cho Xưởng Thực Phẩm Tại ${loc.shortName}`,
        `Giải Pháp ${baseKw} Cho Biệt Thự ${loc.shortName} – Nước Sạch 100%`,
        `Lắp Đặt ${baseKw} Cho Nhà Máy Tại ${loc.shortName} – Đạt Chuẩn QCVN`,
        `Hệ Thống ${baseKw} Công Suất Lớn Cho Nhà Xưởng Tại ${loc.shortName}`
      ];
    },
    technicalDepth: (cap, loc) => `
- Khảo sát thực địa và giải pháp thi công cụ thể tại ${loc.name} (${loc.waterFeature}).
- Cấu hình thiết bị tối ưu hóa công năng cho cơ sở, công suất ${cap.cap} dành cho ${cap.users}.
- Cam kết chất lượng nước thành phẩm đạt chuẩn QCVN 6-1:2010/BYT hoặc QCVN 01-1:2018/BYT.`
  },
  {
    clusterId: 'local_water_features',
    clusterName: 'Xử Lý Nước Nhiễm Phèn Sắt, Nhiễm Mặn, Đá Vôi Theo Thổ Nhưỡng',
    type: 'local',
    titleGenerator: (kw, cap, loc, seed = 0) => {
      const baseKw = getBaseKw(kw);
      const fullKw = getFullKw(kw);
      return [
        `Hệ Thống ${baseKw} Khử Phèn Sắt Triệt Để Tại ${loc.shortName}`,
        `Giải Pháp ${baseKw} Nhiễm Mặn Mùa Khô Tại ${loc.shortName}`,
        `Xử Lý Nước Đá Vôi Và Làm Mềm Nước Cứng Tại ${loc.shortName}`,
        `Khử Sắt Và Mangan Cho Nguồn Nước Giếng Tại ${loc.shortName}`,
        `Giải Pháp Xử Lý Nước Nhiễm Mặn Bằng Màng RO Tại ${loc.shortName}`
      ];
    },
    technicalDepth: (cap, loc) => `
- Phân tích hiện trạng hóa lý nguồn nước thực tế tại ${loc.name}: ${loc.waterFeature}
- Cơ chế phản ứng oxy hóa khử: Fe2+ hòa tan chuyển hóa thành Fe(OH)3 kết tủa nhờ hạt xúc tác Birm/Mangan Greensand.
- Ứng dụng màng thẩm thấu ngược BWRO/SWRO chuyên dụng nếu là vùng nước lợ mặn ven biển.`
  },
  {
    clusterId: 'local_industrial',
    clusterName: 'Lọc Nước Công Nghiệp, Khu Công Nghiệp & Tinh Khiết Doanh Nghiệp',
    type: 'local',
    titleGenerator: (kw, cap, loc, seed = 0) => {
      const baseKw = getBaseKw(kw);
      const fullKw = getFullKw(kw);
      return [
        `Lắp Đặt ${fullKw} Cho Nhà Máy Tại ${loc.shortName}`,
        `Hệ Thống RO Công Suất Lớn Cho Nhà Xưởng Tại ${loc.shortName}`,
        `Lắp Đặt ${baseKw} Cho Doanh Nghiệp Sản Xuất Tại ${loc.shortName}`,
        `Dây Chuyền ${fullKw} Cho Nhà Máy Dược Tại ${loc.shortName}`,
        `Giải Pháp ${baseKw} Tinh Khiết Cho Doanh Nghiệp Tại ${loc.shortName}`
      ];
    },
    technicalDepth: (cap, loc) => `
- Giải pháp nước cấp lò hơi và tháp giải nhiệt: Kiểm soát độ dẫn điện EC, tổng chất rắn hòa tan TDS, triệt tiêu ion Canxi/Magie gây đóng cặn cách nhiệt.
- Sơ đồ công nghệ Scada tự động: Van tự động Autovalve, biến tần Inverter điều khiển bơm cao áp tiết kiệm 35% điện năng.`
  },

  // ==========================================
  // NHÓM 2: CÁC CỤM CHUYÊN MÔN TOÀN QUỐC (GENERAL - KHÔNG GẮN ĐỊA DANH)
  // ==========================================
  {
    clusterId: 'comparison_buying_guide',
    clusterName: 'So Sánh Giải Pháp & Tư Vấn Lựa Chọn Chuyên Sâu',
    type: 'general',
    titleGenerator: (kw, cap, loc, seed = 0) => {
      const baseKw = getBaseKw(kw);
      const fullKw = getFullKw(kw);
      return [
        `So Sánh Máy Ion Kiềm & ${fullKw} – Nên Chọn Gì?`,
        `So Sánh Cột Composite Và Inox 304 Trong ${fullKw}`,
        `Lợi Ích Khi Tự Đầu Tư ${fullKw} Thay Vì Mua Nước Bình`,
        `Tư Vấn Chọn Công Suất ${fullKw} Phù Hợp Nhất`,
        `So Sánh Màng RO Dow Filmtec Và Các Dòng Màng Lọc Khác`
      ];
    },
    technicalDepth: `
- Bảng toán so sánh tài chính thực tế: Chi phí mua nước đóng bình 20L (15.000đ - 25.000đ/bình) so với chi phí tự lọc (chỉ 1.800đ - 2.500đ/bình bao gồm điện, nước, vật liệu và khấu hao).
- Điểm hòa vốn (Break-even point) chỉ sau 8 đến 12 tháng vận hành.
- Phân tích vật liệu: Cột Composite Pentair chống ăn mòn hóa chất cực tốt; Cột Inox 304 độ bền cơ học cao, sang trọng.`
  },
  {
    clusterId: 'technical_principles',
    clusterName: 'Cấu Tạo Chi Tiết & Nguyên Lý Kỹ Thuật Đa Tầng',
    type: 'general',
    titleGenerator: (kw, cap, loc, seed = 0) => {
      const baseKw = getBaseKw(kw);
      const fullKw = getFullKw(kw);
      return [
        `Cấu Tạo Chi Tiết & Nguyên Lý Vận Hành Của ${fullKw}`,
        `Cơ Chế Khử Kim Loại Nặng Bằng Hạt Xúc Tác Trong ${fullKw}`,
        `Tìm Hiểu Các Tầng Vật Liệu Lọc Chuyên Dụng Trong ${fullKw}`,
        `Sơ Đồ Lọc Đa Tầng Áp Lực & Van Điều Khiển Autovalve Tự Động`,
        `Nguyên Lý Thẩm Thấu Ngược Màng RO Khử Khoáng Triệt Để`
      ];
    },
    technicalDepth: `
- Sơ đồ nguyên lý công nghệ đa tầng áp lực: Tầng 1 lọc thô sỏi cát thạch anh; Tầng 2 khử sắt mangan bằng quặng xúc tác; Tầng 3 khử mùi độc tố bằng than hoạt tính gáo dừa; Tầng 4 làm mềm trao đổi ion Cation.
- Cụm màng RO Dow Filmtec khe hở 0.0001 micron loại bỏ 99.9% vi khuẩn, virus và kim loại nặng.`
  },
  {
    clusterId: 'standards_compliance',
    clusterName: 'Tiêu Chuẩn Nước Ăn Uống QCVN & Hồ Sơ Pháp Lý',
    type: 'general',
    titleGenerator: (kw, cap, loc, seed = 0) => {
      const baseKw = getBaseKw(kw);
      const fullKw = getFullKw(kw);
      return [
        `Tiêu Chuẩn Nước Ăn Uống QCVN 6-1:2010 Cho Doanh Nghiệp`,
        `Quy Chuẩn Nước Sinh Hoạt QCVN 01-1:2018 Cần Lưu Ý Gì?`,
        `Cách Đọc & Đánh Giá Phiếu Xét Nghiệm Nước Đạt Chuẩn QCVN`,
        `Quy Định Vệ Sinh An Toàn Nước Cấp Cho Xưởng Thực Phẩm`,
        `Tiêu Chuẩn Nước Uống Trực Tiếp Tại Vòi Cho Trường Học & Y Tế`
      ];
    },
    technicalDepth: `
- Đối chiếu bảng chỉ tiêu hóa lý và vi sinh theo quy chuẩn quốc gia QCVN: TDS < 500 mg/L, Coliforms = 0, E.coli = 0, hàm lượng Asen, Chì, Thủy ngân dưới ngưỡng phát hiện.
- Hồ sơ kiểm định chất lượng nước định kỳ 6 tháng/lần theo quy định kiểm tra liên ngành vệ sinh an toàn thực phẩm.`
  },
  {
    clusterId: 'practical_handbook',
    clusterName: 'Cẩm Nang Kỹ Thuật & 5 Tiêu Chí Vàng Lắp Đặt',
    type: 'general',
    titleGenerator: (kw, cap, loc, seed = 0) => {
      const baseKw = getBaseKw(kw);
      const fullKw = getFullKw(kw);
      return [
        `5 Tiêu Chí Vàng Lựa Chọn ${fullKw} Đạt Chuẩn Kỹ Thuật`,
        `Kinh Nghiệm Đầu Tư Dây Chuyền ${baseKw} Đóng Bình 20L`,
        `Quy Trình Khảo Sát & Nghiệm Thu ${fullKw} Chuẩn Kỹ Sư`,
        `Những Sai Lầm Thường Gặp Khi Lắp Đặt ${fullKw} Cần Tránh`,
        `Cẩm Nang Lựa Chọn Đúng Công Suất ${fullKw} Tránh Quá Tải`
      ];
    },
    technicalDepth: `
- Các bước khảo sát hóa lý nguồn nước tại chỗ bằng vali phân tích nước cầm tay (TDS, pH, Fe, độ cứng).
- Lựa chọn đúng công suất định mức: từ 250L/h đến 2000L/h tránh lãng phí vốn CAPEX hoặc quá tải lưu lượng.
- Quy chuẩn bố trí đường ống PPR, bồn chứa trung gian và vị trí xả nước thải súc rửa.`
  },
  {
    clusterId: 'maintenance_troubleshooting',
    clusterName: 'Quy Trình Bảo Dưỡng, Thay Lõi & Khắc Phục Sự Cố',
    type: 'general',
    titleGenerator: (kw, cap, loc, seed = 0) => {
      const baseKw = getBaseKw(kw);
      const fullKw = getFullKw(kw);
      return [
        `Quy Trình Súc Rửa Màng Cho ${fullKw} Bằng Hóa Chất CIP`,
        `Khi Nào Cần Bảo Dưỡng ${fullKw}? 4 Dấu Hiệu Cần Biết`,
        `Các Lỗi Thường Gặp Khi Vận Hành ${fullKw} Và Cách Khắc Phục`,
        `Khi Nào Cần Thay Vật Liệu Lọc & Lõi Lọc Trong ${fullKw}?`,
        `Hướng Dẫn Tự Kiểm Tra & Vận Hành ${fullKw} Bền Bỉ`
      ];
    },
    technicalDepth: `
- 4 dấu hiệu kỹ thuật báo động: Chênh áp DP qua màng > 2.5 bar; Lưu lượng nước tinh khiết giảm trên 20%; TDS nước thành phẩm tăng; Bơm cao áp chạy gằn nhiệt độ cao.
- Quy trình tẩy rửa màng CIP: Pha 1 tẩy cặn vô cơ Canxi/Magie bằng axit Citric pH 2-3; Pha 2 tẩy màng sinh học bằng dung dịch kiềm nhẹ NaOH/EDTA pH 10-11.`
  },
  {
    clusterId: 'economic_roi',
    clusterName: 'Bài Toán Kinh Tế, Hoàn Vốn & Tiết Kiệm Chi Phí Vận Hành',
    type: 'general',
    titleGenerator: (kw, cap, loc, seed = 0) => {
      const baseKw = getBaseKw(kw);
      const fullKw = getFullKw(kw);
      return [
        `Bài Toán Tiết Kiệm 70% Chi Phí Khi Tự Đầu Tư ${fullKw}`,
        `Đánh Giá Hiệu Quả Kinh Tế & Thời Gian Hoàn Vốn Khi Lắp ${fullKw}`,
        `Giải Pháp Cắt Giảm Chi Phí Nước Uống Cho Cán Bộ Công Nhân Viên`,
        `Hạch Toán Chi Phí Đầu Tư Ban Đầu & Khấu Hao Thiết Bị ${fullKw}`,
        `Cách Tối Ưu Lượng Nước Thải & Điện Năng Khi Vận Hành ${fullKw}`
      ];
    },
    technicalDepth: `
- Phân tích chi phí vận hành TCO: So sánh chi phí mua nước bình 15.000đ - 25.000đ/bình với chi phí điện năng 1.5 - 2.5 kWh/m³ và chi phí khấu hao vật tư lọc.
- Bài toán hoàn vốn chỉ sau 6 đến 10 tháng đối với doanh nghiệp có từ 50 cán bộ công nhân viên trở lên.`
  }
];

/**
 * Lấy danh sách tiêu đề thực tế từ đối thủ trong cùng Domain để làm tư liệu tham khảo
 */
function getCompetitorExemplars(domainKey, limit = 6) {
  try {
    if (!fs.existsSync(KNOWLEDGE_FILE)) return [];
    const ind = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf8') || '{}');
    const articles = (ind.articlesByDomain && ind.articlesByDomain[domainKey]) || [];
    return articles.slice(0, limit).map(a => ({
      title: a.title,
      source: a.source
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Tinh chỉnh tiêu đề nằm gọn gàng trong dải 48 - 65 ký tự, KHÔNG DẬP KHUÔN "2026", KHÔNG CẮT CỤT TỪ
 */
function fitTitleLength(title, keyword) {
  let res = title.replace(/\s+/g, ' ').trim();

  // Loại bỏ các trường hợp lặp từ như "Hệ Thống Hệ Thống"
  res = res.replace(/(Hệ\s*Thống\s*)+/gi, 'Hệ Thống ');

  // 1. Rút gọn các cụm từ đệm dài dòng trước
  if (res.length > 65) {
    res = res.replace(/Quy Trình Súc Rửa Màng Cho Hệ Thống/i, 'Quy Trình Súc Rửa Màng');
    res = res.replace(/Bảo Dưỡng Toàn Diện Cho Hệ Thống/i, 'Bảo Dưỡng Hệ Thống');
    res = res.replace(/Hệ Thống Lọc Đầu Nguồn Khử Phèn Sắt Triệt Để/i, 'Lọc Đầu Nguồn Khử Phèn Sắt');
    res = res.replace(/Hệ Thống Lọc Nước/i, 'Lọc Nước');
    res = res.replace(/Đạt Chuẩn Nước Uống Trực Tiếp/i, 'Chuẩn Nước Uống');
    res = res.replace(/\s*–\s*Chuẩn Sạch.*$/i, '');
    res = res.replace(/\s*–\s*Nước Sạch 100%.*$/i, '');
    res = res.replace(/\s*–\s*Đạt Chuẩn QCVN.*$/i, '');
    res = res.replace(/\s*–\s*Khảo Sát Tận Nơi.*$/i, '');
    res = res.replace(/\s*–\s*Hướng Dẫn Chi Tiết.*$/i, '');
    res = res.replace(/\s*Trọn Gói Chi Tiết.*$/i, 'Trọn Gói');
    res = res.replace(/\s*Mới Nhất.*$/i, '');
    res = res.replace(/Tiết Kiệm Chi Phí/i, 'Tiết Kiệm');
  }

  // 2. Nếu vẫn > 65 ký tự, tỉa từ cẩn thận và tránh cụm từ cụt
  if (res.length > 65) {
    const words = res.split(' ');
    let trimmed = '';
    for (const w of words) {
      if ((trimmed + ' ' + w).trim().length <= 65) {
        trimmed = (trimmed + ' ' + w).trim();
      } else {
        break;
      }
    }
    // Xóa từ nối lửng lơ ở cuối như: Tại, Cho, Ở, Và, Của, -, –
    trimmed = trimmed.replace(/\s+(Tại|Cho|Ở|Và|Của|Về|Với|Chi|[–\-])\s*$/i, '').trim();
    res = trimmed;
  }

  // 3. Nếu tiêu đề hơi ngắn (< 48 ký tự), bổ sung hậu tố tự nhiên (không dập khuôn 2026)
  if (res.length < 48) {
    if (!res.includes('Chuẩn') && res.length + 15 <= 65) {
      res += ' – Chuẩn Kỹ Thuật';
    } else if (!res.includes('Uy Tín') && res.length + 12 <= 65) {
      res += ' – Uy Tín 100%';
    } else if (!res.includes('Trọn Gói') && res.length + 10 <= 65) {
      res += ' Trọn Gói';
    }
  }

  res = res.replace(/(Hệ\s*Thống\s*)+/gi, 'Hệ Thống ').replace(/\s+/g, ' ').trim();
  return res;
}

/**
 * Tính toán độ tương đồng từ vựng để chống trùng lặp tuyệt đối
 */
function computeTitleSimilarity(titleA, titleB) {
  if (!titleA || !titleB) return 0;
  const normalize = (t) => t.toLowerCase()
    .replace(/[–\-:,.\/\\()\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length > 1);

  const tokensA = new Set(normalize(titleA));
  const tokensB = new Set(normalize(titleB));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  tokensA.forEach(t => { if (tokensB.has(t)) intersection++; });
  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union;
}

/**
 * Kiểm tra xem một tiêu đề có chứa địa danh địa phương hay không
 */
function isTitleLocal(title) {
  if (!title) return false;
  const lt = title.toLowerCase();
  if (lt.includes('tại ') || lt.includes(' ở ') || lt.includes('kcn ') || lt.includes('vsip') || lt.includes('amata') || lt.includes('hcm')) return true;
  for (const reg of SOUTHERN_REGIONS) {
    if (lt.includes(reg.shortName.toLowerCase()) || lt.includes(reg.name.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Chọn chiến lược Cụm Chủ Đề & Tiêu Đề Độc Bản Thông Minh
 * XEN KẼ TỰ NHIÊN: Cứ sau 1 bài Local SEO bắt buộc phải có bài Chuyên môn/Kỹ thuật/So sánh/Cẩm nang
 * Chống trùng lặp tuyệt đối với toàn bộ bài live trên WP và bài đang chờ
 */
function selectDynamicTopicStrategy(keyword, domainKey, existingTitles = [], seed = Date.now()) {
  let hash = 0;
  const s = keyword + '_' + seed;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  const posHash = Math.abs(hash);

  // Lấy toàn bộ tiêu đề hiện có để làm bộ lọc chống trùng lặp
  const allExisting = Array.isArray(existingTitles) ? existingTitles.map(t => (t || '').trim()) : [];
  const allExistingLower = allExisting.map(t => t.toLowerCase());

  // KIỂM TRA LỊCH SỬ ĐỂ XEN KẼ TỰ NHIÊN (Tránh 1 dàn địa phương gây nhức đầu theo góp ý của Tris)
  let lastWasLocal = false;
  let recentLocalCount = 0;
  if (allExisting.length > 0) {
    const last1 = allExisting[allExisting.length - 1];
    const last2 = allExisting.length > 1 ? allExisting[allExisting.length - 2] : '';
    if (isTitleLocal(last1)) {
      lastWasLocal = true;
      recentLocalCount++;
    }
    if (isTitleLocal(last2)) {
      recentLocalCount++;
    }
  }

  // QUY TẮC XEN KẼ:
  // 1. Nếu bài gần nhất LÀ bài địa phương (lastWasLocal) -> BẮT BUỘC bài tiếp theo là 'general' (Chuyên môn, so sánh, kỹ thuật, cẩm nang)
  // 2. Nếu đã có 2 bài general liên tiếp (recentLocalCount === 0) -> Có thể chọn 'local' (tỷ lệ 65% local, 35% general)
  // 3. Nếu mới có 1 bài general sau 1 bài local -> Tiếp tục ưu tiên 'general' (tỷ lệ 70% general, 30% local) để giữ nhịp 1 Local - 2 General!
  let desiredType = 'general';
  if (lastWasLocal) {
    desiredType = 'general';
  } else if (recentLocalCount === 0 && allExisting.length >= 2) {
    desiredType = (posHash % 10 < 6) ? 'local' : 'general';
  } else {
    desiredType = (posHash % 10 < 3) ? 'local' : 'general';
  }

  const primaryClusters = TOPIC_CLUSTERS.filter(c => c.type === desiredType);
  const secondaryClusters = TOPIC_CLUSTERS.filter(c => c.type !== desiredType);
  const candidateClusterPool = [...primaryClusters, ...secondaryClusters];

  let selectedLoc = SOUTHERN_REGIONS[posHash % SOUTHERN_REGIONS.length];
  let selectedCap = CAPACITY_SPECS[posHash % CAPACITY_SPECS.length];
  let selectedCluster = primaryClusters[posHash % primaryClusters.length] || TOPIC_CLUSTERS[posHash % TOPIC_CLUSTERS.length];
  let bestTitle = '';
  let candidateTitles = [];

  for (let step = 0; step < 25; step++) {
    const cluster = candidateClusterPool[step % candidateClusterPool.length];
    const curLocIdx = (posHash + step * 7) % SOUTHERN_REGIONS.length;
    const curCapIdx = (posHash + step * 3) % CAPACITY_SPECS.length;

    const loc = SOUTHERN_REGIONS[curLocIdx];
    const cap = CAPACITY_SPECS[curCapIdx];

    const rawList = cluster.titleGenerator(keyword, cap, loc, posHash + step);
    const fittedList = rawList.map(t => fitTitleLength(t, keyword));

    let candidateFound = null;
    for (const cand of fittedList) {
      let isDup = false;
      for (const ex of allExistingLower) {
        const sim = computeTitleSimilarity(cand, ex);
        if (sim >= 0.50 || (cluster.type === 'local' && ex.includes(loc.shortName.toLowerCase()) && ex.includes(keyword.toLowerCase()))) {
          isDup = true;
          break;
        }
      }
      if (!isDup) {
        candidateFound = cand;
        break;
      }
    }

    if (candidateFound) {
      selectedLoc = loc;
      selectedCap = cap;
      selectedCluster = cluster;
      bestTitle = candidateFound;
      candidateTitles = fittedList;
      break;
    }
  }

  // Fallback an toàn nếu chưa tìm được
  if (!bestTitle) {
    const loc = SOUTHERN_REGIONS[(posHash + 13) % SOUTHERN_REGIONS.length];
    const cap = CAPACITY_SPECS[(posHash + 5) % CAPACITY_SPECS.length];
    selectedLoc = loc;
    selectedCap = cap;
    if (desiredType === 'general') {
      selectedCluster = TOPIC_CLUSTERS.find(c => c.clusterId === 'comparison_buying_guide') || TOPIC_CLUSTERS[3];
      bestTitle = fitTitleLength(`So Sánh Cột Lọc Composite Và Inox 304 Trong ${getFullKw(keyword)}`, keyword);
    } else {
      selectedCluster = TOPIC_CLUSTERS[0];
      bestTitle = fitTitleLength(`Giải Pháp ${getFullKw(keyword)} Tại ${loc.shortName} – Uy Tín 100%`, keyword);
    }
    candidateTitles = [bestTitle];
  }

  const competitorList = getCompetitorExemplars(domainKey, 6);

  return {
    clusterId: selectedCluster.clusterId,
    clusterName: selectedCluster.clusterName,
    type: selectedCluster.type,
    selectedTitle: bestTitle,
    candidateTitles,
    technicalDepth: typeof selectedCluster.technicalDepth === 'function' ? selectedCluster.technicalDepth(selectedCap, selectedLoc) : selectedCluster.technicalDepth,
    location: selectedLoc,
    capacity: selectedCap,
    competitorExemplars: competitorList
  };
}

module.exports = {
  selectDynamicTopicStrategy,
  fitTitleLength,
  computeTitleSimilarity,
  isTitleLocal,
  TOPIC_CLUSTERS,
  SOUTHERN_REGIONS,
  CAPACITY_SPECS,
  getFullKw,
  getBaseKw
};
