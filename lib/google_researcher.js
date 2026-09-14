const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../data/google_config.json');

// Technical dictionary to query authoritative international sources across multiple languages
const MULTI_NATIONAL_QUERIES = {
  tinh_khiet: {
    enStandards: 'commercial reverse osmosis drinking water treatment NSF ANSI 58 61 EPA standards WHO DuPont Lenntech',
    deEngineering: 'Umkehrosmose Trinkwasseraufbereitung DIN EN 806 DVGW Membranfiltration Grünbeck ProMinent',
    jpTech: '逆浸透膜 純水装置 RO膜 水処理技術 東レ 日東電工 栗田工業 水質基準',
    vnDeep: 'quy chuẩn kỹ thuật lọc nước tinh khiết đóng bình QCVN 6-1:2010/BYT màng RO thẩm thấu ngược'
  },
  phen: {
    enStandards: 'well water iron and manganese removal aeration greensand filtration media EPA WQA Birm catalytic oxidation',
    deEngineering: 'Brunnenwasser Enteisenung Entmanganung Belüftung Filterkies Enteisenungsanlage DVGW',
    jpTech: '井戸水 除鉄 除マンガン ろ過装置 ばっき 酸化触媒 接触酸化 水質改善',
    vnDeep: 'kinh nghiệm xử lý nước giếng khoan nhiễm phèn sục khí oxy hóa cát mangan birm hạt nâng pH'
  },
  gieng_khoan: {
    enStandards: 'groundwater deep well borehole water filtration multi media filter activated carbon water softener EPA',
    deEngineering: 'Brunnenwasseraufbereitung Grundwasser Filteranlage Mehrschichtfilter Wasserenthärtung',
    jpTech: '地下水 浄化システム 井戸水ろ過 活性炭 軟水器 砂ろ過 重金属除去',
    vnDeep: 'hệ thống lọc nước giếng khoan gia đình cột lọc composite van 3 ngã hạt trao đổi ion cation'
  },
  sinh_hoat: {
    enStandards: 'whole house water filtration point of entry water softener sediment carbon NSF 42 53 44 hardness removal',
    deEngineering: 'Hauswasserstation Wasserenthärtung Ionenaustauscher DIN 1988 Trinkwasserfilter Rückspülung',
    jpTech: '家庭用 軟水装置 全館浄水 イオン交換樹脂 硬度除去 塩素除去',
    vnDeep: 'lọc nước sinh hoạt đầu nguồn biệt thự nhà phố QCVN 01-1:2018/BYT làm mềm nước vôi cặn'
  },
  cong_nghiep: {
    enStandards: 'industrial high purity water treatment plant reverse osmosis electrodeionization EDI boiler feed ASME microSiemens',
    deEngineering: 'Reinstwasseranlage Umkehrosmose EDI Elektrodeionisation Kesselspeisewasser Industrie Leitfähigkeit',
    jpTech: '産業用 超純水製造装置 電気脱イオン EDI 逆浸透膜 ボイラー給水 栗田工業 東レ',
    vnDeep: 'dây chuyền lọc nước công nghiệp công suất lớn EDI khử khoáng lò hơi dược phẩm điện tử'
  },
  man: {
    enStandards: 'seawater reverse osmosis SWRO desalination plant high pressure pump energy recovery device ERD brackish TDS',
    deEngineering: 'Meerwasserentsalzung Umkehrosmose SWRO Hochdruckpumpe Energierückgewinnung Brackwasser',
    jpTech: '海水淡水化 RO膜 高圧ポンプ エネルギー回収 東レ 日東電工 減塩',
    vnDeep: 'hệ thống lọc nước mặn khử mặn nước lợ tưới tiêu sầu riêng sinh hoạt màng lọc SWRO'
  }
};

// Chuẩn hóa thuật ngữ kỹ thuật đa quốc gia sang tiếng Việt chuyên ngành chính xác 100%
const TECHNICAL_TRANSLATION_GUIDE = `
BẢNG QUY CHUẨN THUẬT NGỮ ĐA QUỐC GIA (ANH - ĐỨC - NHẬT) -> TIẾNG VIỆT CHUYÊN NGÀNH:
1. Công nghệ thẩm thấu ngược (Reverse Osmosis / Umkehrosmose / 逆浸透膜):
   - Màng bán thấm Polyamide khe hở 0.0001 micron.
   - Silt Density Index (SDI / Schlammdichteindex): Chỉ số mật độ bùn/phù sa (yêu cầu SDI < 3 để bảo vệ màng RO).
   - Total Dissolved Solids (TDS / Gesamte gelöste Feststoffe / 総溶解固形物): Tổng chất rắn hòa tan (mg/L hoặc ppm).
   - Permeate (Reinstwasser / 透過水): Nước tinh khiết thành phẩm thu hồi sau màng.
   - Concentrate / Reject (Konzentrat / 濃縮水): Nước xả cô đặc chứa khoáng và tạp chất.
   - Recovery Rate (Ausbeute / 回収率): Tỷ lệ thu hồi nước tinh khiết (50% - 75% cho RO công nghiệp).
   - Salt Rejection Rate (Salzrückhalterate / 脱塩率): Tỷ lệ khử muối vô cơ (≥ 99.2% đến 99.7% với màng Toray, DuPont FilmTec, Hydranautics).
   - Membrane Flux (Membranfluss / 膜透過流束): Thông lượng qua màng (tính bằng LMH - Lít/m2/giờ).
   - Fouling & Scaling (Membranfoulung / ファウリング): Hiện tượng bám cặn vô cơ (CaCO3, CaSO4, Silica) và vi sinh vật.
   - Clean-In-Place - CIP (CIP-Reinigung / 定置洗浄): Quy trình tẩy rửa phục hồi màng lọc RO tại chỗ bằng hóa chất (Axit Citric loại cặn vô cơ và NaOH/EDTA loại màng sinh học).
   - Anti-scalant (Antiscalant / 膜スケール防止剤): Hóa chất ức chế cáu cặn bảo vệ màng RO.

2. Khử phèn, sắt và mangan (Iron & Manganese Removal / Enteisenung & Entmanganung / 除鉄・除マンガン):
   - Aeration & Catalytic Oxidation (Belüftung & katalytische Oxidation / ばっき・接触酸化): Quá trình sục khí làm giàu oxy hòa tan để chuyển đổi ion sắt Fe2+ thành kết tủa Fe3+ (Fe(OH)3), kết hợp vật liệu xúc tác quặng Mangan, hạt Birm (Mỹ) hoặc Pyrolox.

3. Làm mềm nước & Trao đổi ion (Ion Exchange Softening / Wasserenthärtung / 軟水装置・イオン交換):
   - Nhựa Cation acid mạnh (Stark saure Kationenaustauscher / 陽イオン交換樹脂) hoạt động theo chu trình Na+ khử triệt để ion Canxi (Ca2+) và Magie (Mg2+), tái sinh định kỳ bằng muối viên tinh khiết NaCl 99.5%.

4. Siêu tinh khiết & Khử ion điện cực (Electrodeionization - EDI / Elektrodeionisation / 電気脱イオン):
   - Công nghệ EDI kết hợp màng trao đổi ion và dòng điện một chiều, không dùng hóa chất tái sinh, sản xuất nước siêu tinh khiết điện trở suất lên đến 18.2 MΩ·cm cho vi mạch điện tử và dược phẩm.

5. Tiêu chuẩn và Quy chuẩn đối chiếu:
   - Quốc tế: NSF/ANSI 58, 61 (Hoa Kỳ), DIN EN 806 & DVGW (Đức), Tiêu chuẩn JIS / Kurita (Nhật Bản), WHO, EPA.
   - Việt Nam: QCVN 01-1:2018/BYT (nước sinh hoạt) và QCVN 6-1:2010/BYT (nước uống trực tiếp đóng chai).
`;

function detectDomain(text = '') {
  const lk = (text || '').toLowerCase();
  if (lk.includes('công nghiệp') || lk.includes('nhà máy') || lk.includes('xưởng') || lk.includes('lò hơi') || lk.includes('edi')) return 'cong_nghiep';
  if (lk.includes('mặn') || lk.includes('khử muối') || lk.includes('nước biển') || lk.includes('lợ')) return 'man';
  if (lk.includes('tinh khiết') || lk.includes('ro') || lk.includes('đóng bình') || lk.includes('uống') || lk.includes('chiết rót')) return 'tinh_khiet';
  if (lk.includes('giếng') || lk.includes('nước ngầm') || lk.includes('khoan')) return 'gieng_khoan';
  if (lk.includes('phèn') || lk.includes('sắt') || lk.includes('khử phèn') || lk.includes('mùi tanh')) return 'phen';
  return 'sinh_hoat';
}

function getSerperApiKey() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}');
      return cfg.serperApiKey || (cfg.googleApiKey && cfg.googleApiKey.length === 40 ? cfg.googleApiKey : '');
    }
  } catch (e) {}
  return '';
}

async function querySerper(query, gl = 'vn', hl = 'vi', num = 8) {
  const apiKey = getSerperApiKey();
  if (!apiKey) return [];

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: query, gl, hl, num })
    });

    if (!res.ok) return [];
    const data = await res.json();
    return (data.organic || []).map((item, idx) => ({
      rank: idx + 1,
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || ''
    }));
  } catch (e) {
    console.warn(`[Google Research] Lỗi khi cào Google (${gl}/${hl}):`, e.message);
    return [];
  }
}

async function conductGlobalAndDomesticResearch(keyword, topic) {
  const cleanKw = (keyword || topic || '').trim();
  const cleanTopic = (topic || keyword || '').trim();
  const domain = detectDomain(cleanKw + ' ' + cleanTopic);
  const qCfg = MULTI_NATIONAL_QUERIES[domain] || MULTI_NATIONAL_QUERIES.tinh_khiet;

  console.log(`[Worldwide & Domestic Deep-Sweep] 🌍 Đang quét đa quốc gia (VN, Hoa Kỳ/Toàn cầu, Đức, Nhật Bản) cho: "${cleanKw}"...`);

  // Parallel fetch 5 comprehensive channels:
  // 1. Google VN Direct Keyword (Top 10)
  // 2. Google VN Deep Technical & Standards (Top 6)
  // 3. Global US/EN Standards (NSF, ANSI, EPA, WHO, DuPont, Lenntech - Top 8)
  // 4. German Engineering (DVGW, DIN, Grünbeck, ProMinent - Top 5)
  // 5. Japanese Advanced Membrane & Ultrapure Tech (Toray, Kurita, Nitto Denko - Top 5)
  const [vnDirect, vnDeep, globalEn, germanTech, japaneseTech] = await Promise.all([
    querySerper(cleanKw, 'vn', 'vi', 10),
    querySerper(`${cleanKw} ${qCfg.vnDeep}`, 'vn', 'vi', 6),
    querySerper(qCfg.enStandards, 'us', 'en', 8),
    querySerper(qCfg.deEngineering, 'de', 'de', 5),
    querySerper(qCfg.jpTech, 'jp', 'ja', 5)
  ]);

  const totalSources = vnDirect.length + vnDeep.length + globalEn.length + germanTech.length + japaneseTech.length;
  console.log(`[Worldwide & Domestic Deep-Sweep] ✅ Thu thập thành công ${totalSources} nguồn tri thức toàn cầu:`);
  console.log(`   - Việt Nam: ${vnDirect.length + vnDeep.length} nguồn (${vnDirect.length} trực tiếp + ${vnDeep.length} quy chuẩn sâu)`);
  console.log(`   - Hoa Kỳ & Toàn Cầu (NSF/EPA/DuPont): ${globalEn.length} nguồn`);
  console.log(`   - CHLB Đức (DVGW/DIN EN/Grünbeck): ${germanTech.length} nguồn`);
  console.log(`   - Nhật Bản (Toray/Kurita/Nitto Denko): ${japaneseTech.length} nguồn`);

  let knowledgeText = '';

  // 1. Nguồn thực tiễn & thị trường Việt Nam
  knowledgeText += `\n--- 🇻🇳 PHẦN 1: TRUY QUÉT TOÀN BỘ NGUỒN XỬ LÝ NƯỚC TẠI VIỆT NAM (GOOGLE.VN) ---\n`;
  [...vnDirect, ...vnDeep].forEach((r, idx) => {
    knowledgeText += `• [VN Source #${idx + 1}] "${r.title}" (${r.link})\n  Trích dẫn thực tế: ${r.snippet}\n`;
  });

  // 2. Nguồn tiêu chuẩn kỹ thuật Hoa Kỳ & Quốc Tế
  if (globalEn.length > 0) {
    knowledgeText += `\n--- 🌐 PHẦN 2: TIÊU CHUẨN KỸ THUẬT & Y TẾ HOA KỲ VÀ TOÀN CẦU (NSF / ANSI / EPA / WHO) ---\n`;
    globalEn.forEach(r => {
      knowledgeText += `• [Global/US #${r.rank}] "${r.title}" (${r.link})\n  Technical Data: ${r.snippet}\n`;
    });
  }

  // 3. Nguồn kỹ thuật Đức (DVGW / DIN / Châu Âu)
  if (germanTech.length > 0) {
    knowledgeText += `\n--- 🇩🇪 PHẦN 3: CÔNG NGHỆ & TIÊU CHUẨN KỸ THUẬT CHLB ĐỨC (DIN EN / DVGW / CHÂU ÂU) ---\n`;
    germanTech.forEach(r => {
      knowledgeText += `• [German Tech #${r.rank}] "${r.title}" (${r.link})\n  Deutsche Wassertechnik: ${r.snippet}\n`;
    });
  }

  // 4. Nguồn công nghệ Nhật Bản (Toray / Kurita / Nitto Denko)
  if (japaneseTech.length > 0) {
    knowledgeText += `\n--- 🇯🇵 PHẦN 4: CÔNG NGHỆ MÀNG LỌC & XỬ LÝ NƯỚC TIÊN TIẾN NHẬT BẢN (TORAY / KURITA / NITTO DENKO) ---\n`;
    japaneseTech.forEach(r => {
      knowledgeText += `• [Japan Tech #${r.rank}] "${r.title}" (${r.link})\n  Japanese Advanced Data: ${r.snippet}\n`;
    });
  }

  // 6. Tổng hợp danh sách nguồn có cấu trúc chi tiết phục vụ hiển thị trên giao diện & chèn vào bài viết
  const allSources = [
    ...[...vnDirect, ...vnDeep].map(s => ({
      title: s.title,
      url: s.link,
      link: s.link,
      snippet: s.snippet,
      region: 'VN',
      regionName: 'Việt Nam (Google.vn)',
      badge: '🇻🇳 VN'
    })),
    ...globalEn.map(s => ({
      title: s.title,
      url: s.link,
      link: s.link,
      snippet: s.snippet,
      region: 'GLOBAL',
      regionName: 'Hoa Kỳ & Toàn Cầu (NSF/EPA/WQA)',
      badge: '🌐 Global'
    })),
    ...germanTech.map(s => ({
      title: s.title,
      url: s.link,
      link: s.link,
      snippet: s.snippet,
      region: 'DE',
      regionName: 'CHLB Đức (DVGW/DIN EN)',
      badge: '🇩🇪 Đức'
    })),
    ...japaneseTech.map(s => ({
      title: s.title,
      url: s.link,
      link: s.link,
      snippet: s.snippet,
      region: 'JP',
      regionName: 'Nhật Bản (Toray/Kurita)',
      badge: '🇯🇵 Nhật'
    }))
  ];

  return {
    vnSources: [...vnDirect, ...vnDeep],
    globalEn,
    germanTech,
    japaneseTech,
    totalSources,
    knowledgeText,
    sourcesList: allSources,
    translationGuide: TECHNICAL_TRANSLATION_GUIDE
  };
}

function generateReferenceMarkdown(sourcesList) {
  if (!sourcesList || sourcesList.length === 0) return '';
  
  const vnList = sourcesList.filter(s => s.region === 'VN').slice(0, 6);
  const globalList = sourcesList.filter(s => s.region === 'GLOBAL').slice(0, 4);
  const deList = sourcesList.filter(s => s.region === 'DE').slice(0, 3);
  const jpList = sourcesList.filter(s => s.region === 'JP').slice(0, 3);
  
  const selected = [...vnList, ...globalList, ...deList, ...jpList];
  if (selected.length === 0) return '';
  
  let md = `\n\n## Nguồn Tham Khảo & Đối Chiếu Dữ Liệu Kỹ Thuật Chuyên Ngành\n\n`;
  md += `Bài viết được đối chiếu thực tiễn và tổng hợp số liệu từ các tiêu chuẩn kỹ thuật quốc tế và nguồn nghiên cứu chuyên ngành tại Việt Nam:\n\n`;
  
  selected.forEach((s, idx) => {
    const cleanTitle = (s.title || 'Tài liệu kỹ thuật').replace(/[[\]]/g, '').trim();
    const cleanUrl = s.url || s.link;
    const cleanDesc = (s.snippet || 'Dữ liệu phân tích kỹ thuật và quy chuẩn xử lý nước.').replace(/\n+/g, ' ').substring(0, 140).trim();
    md += `${idx + 1}. ${s.badge || '🌐'} [${cleanTitle}](${cleanUrl}) — *${cleanDesc}...*\n`;
  });
  
  return md;
}

module.exports = {
  conductGlobalAndDomesticResearch,
  generateReferenceMarkdown,
  detectDomain,
  TECHNICAL_TRANSLATION_GUIDE
};

