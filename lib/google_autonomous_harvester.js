const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { 
  getIndustryKnowledge, 
  categorizeDomain, 
  extractLexicon, 
  INDUSTRY_LEXICON_MASTER 
} = require('./industry_crawler');

const DATA_DIR = path.join(__dirname, '../data');
const CONFIG_FILE = path.join(DATA_DIR, 'google_config.json');
const KNOWLEDGE_FILE = path.join(DATA_DIR, 'industry_knowledge.json');

function getSerperApiKey() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}');
      return cfg.serperApiKey || (cfg.googleApiKey && cfg.googleApiKey.length === 40 ? cfg.googleApiKey : '');
    }
  } catch (e) {}
  return '';
}

// Master search queries covering 100% of the water filtration spectrum
const SECTOR_SEARCH_QUERIES = [
  // 1. Tinh Khiết / RO
  { domain: 'tinh_khiet', query: 'lọc nước ro công nghiệp chuyên sâu' },
  { domain: 'tinh_khiet', query: 'dây chuyền lọc nước đóng bình 20L QCVN 6-1' },
  { domain: 'tinh_khiet', query: 'hệ thống lọc nước ion kiềm công nghiệp' },
  
  // 2. Lọc Tổng Sinh Hoạt
  { domain: 'sinh_hoat', query: 'lọc nước tổng sinh hoạt đầu nguồn biệt thự' },
  { domain: 'sinh_hoat', query: 'lọc nước đầu nguồn khử clo làm mềm nước cứng' },
  { domain: 'sinh_hoat', query: 'bao lâu nên rửa ngược cột lọc tổng backwash' },
  
  // 3. Giếng Khoan
  { domain: 'gieng_khoan', query: 'lọc nước giếng khoan gia đình chuyên sâu' },
  { domain: 'gieng_khoan', query: 'xử lý nước giếng khoan nhiễm amoni thạch tín' },
  { domain: 'gieng_khoan', query: 'công nghệ lọc nước giếng khoan không bể lắng' },
  
  // 4. Khử Phèn Sắt Mangan
  { domain: 'phen', query: 'cách xử lý nước nhiễm phèn sắt asen hiệu quả' },
  { domain: 'phen', query: 'sục khí ejector oxy hóa khử phèn giếng khoan' },
  { domain: 'phen', query: 'vật liệu lọc nước nhiễm phèn cát mangan birm' },
  
  // 5. Công Nghiệp & Lò Hơi & EDI
  { domain: 'cong_nghiep', query: 'xử lý nước cấp lò hơi làm mềm ro di' },
  { domain: 'cong_nghiep', query: 'hệ thống xử lý nước tháp giải nhiệt cooling tower' },
  { domain: 'cong_nghiep', query: 'hệ thống nước siêu tinh khiết edi phòng thí nghiệm' },
  
  // 6. Khử Mặn
  { domain: 'man', query: 'hệ thống lọc nước nhiễm mặn tưới cây sầu riêng' },
  { domain: 'man', query: 'máy lọc nước mặn màng swro miền tây' }
];

// Query Google.com via Serper
function queryGoogleSerp(query) {
  const apiKey = getSerperApiKey();
  if (!apiKey) return Promise.resolve([]);

  return new Promise((resolve) => {
    const payload = JSON.stringify({ q: query, gl: 'vn', hl: 'vi', num: 10 });
    const req = https.request({
      hostname: 'google.serper.dev',
      path: '/search',
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
          resolve(json.organic || []);
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
    req.write(payload);
    req.end();
  });
}

// Helper to fetch HTML of any competitor page safely
function fetchPageHtml(url) {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache'
        },
        timeout: 10000
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let redirect = res.headers.location;
          if (redirect.startsWith('/')) {
            try {
              const u = new URL(url);
              redirect = `${u.protocol}//${u.host}${redirect}`;
            } catch (e) { return resolve(''); }
          }
          return resolve(fetchPageHtml(redirect));
        }
        if (res.statusCode !== 200) return resolve('');
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(data));
      });
      req.on('error', () => resolve(''));
      req.on('timeout', () => { req.destroy(); resolve(''); });
    } catch (e) {
      resolve('');
    }
  });
}

function cleanHtmlText(html = '') {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8230;/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if link is a valid competitor article (exclude YouTube, Facebook, Shopee, PDF, and our own site)
function isValidCompetitorUrl(link = '') {
  if (!link || !link.startsWith('http')) return false;
  const l = link.toLowerCase();
  if (l.includes('xulynuochoasen.com')) return false; // Exclude own site
  if (l.includes('facebook.com') || l.includes('youtube.com') || l.includes('tiktok.com')) return false;
  if (l.includes('shopee.vn') || l.includes('tiki.vn') || l.includes('lazada.vn')) return false;
  if (l.endsWith('.pdf') || l.endsWith('.doc') || l.endsWith('.jpg') || l.endsWith('.png')) return false;
  return true;
}

/**
 * Autonomous Google Harvester
 * Automatically searches Google Vietnam across 17 sector queries,
 * scrapes top-ranking authority articles, extracts outlines & technical terms,
 * and updates data/industry_knowledge.json.
 */
async function runAutonomousGoogleHarvester(options = {}) {
  const maxPerSector = options.maxPerSector || 2;
  console.log('════════════════════════════════════════════════════════════════');
  console.log('🤖 [Google Auto-Harvester] KHỞI ĐỘNG LÙNG SỤC GOOGLE VIỆT NAM TỰ ĐỘNG...');
  console.log(`Số lượng truy vấn chuyên ngành: ${SECTOR_SEARCH_QUERIES.length} chuyên đề`);
  console.log('════════════════════════════════════════════════════════════════');

  // Load existing knowledge to merge and deduplicate
  let currentKnowledge = getIndustryKnowledge();
  if (!currentKnowledge.articlesByDomain) {
    currentKnowledge.articlesByDomain = {
      cong_nghiep: [],
      tinh_khiet: [],
      sinh_hoat: [],
      gieng_khoan: [],
      phen: [],
      man: []
    };
  }

  const existingUrls = new Set();
  Object.values(currentKnowledge.articlesByDomain).forEach(list => {
    (list || []).forEach(art => { if (art.url) existingUrls.add(art.url); });
  });

  const vocabularySet = new Set(currentKnowledge.vocabularyBank || INDUSTRY_LEXICON_MASTER);
  let newlyHarvestedCount = 0;
  const discoveredDomains = new Set();

  for (const item of SECTOR_SEARCH_QUERIES) {
    console.log(`\n🔍 [Google Query]: "${item.query}" (Chuyên mục: ${item.domain})`);
    const serpResults = await queryGoogleSerp(item.query);
    console.log(`   -> Tìm thấy ${serpResults.length} kết quả xếp hạng.`);

    let addedForThisSector = 0;
    for (const res of serpResults) {
      if (addedForThisSector >= maxPerSector) break;
      if (!isValidCompetitorUrl(res.link) || existingUrls.has(res.link)) continue;

      try {
        const html = await fetchPageHtml(res.link);
        if (!html || html.length < 2000) continue;

        // Parse headings
        const hMatches = html.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi) || [];
        const headings = hMatches.map(h => cleanHtmlText(h)).filter(h => h.length > 10 && h.length < 150);

        // Parse paragraphs
        const pMatches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
        const paragraphs = pMatches.map(p => cleanHtmlText(p)).filter(p => p.length > 40 && !p.includes('HOTLINE') && !p.includes('Chính sách'));

        if (paragraphs.length < 2) continue;

        const sampleText = paragraphs.slice(0, 10).join('\n\n');
        const lexicon = extractLexicon(sampleText);
        lexicon.forEach(term => vocabularySet.add(term));

        let hostname = 'Đối thủ Google';
        try { hostname = new URL(res.link).hostname.replace('www.', ''); } catch (e) {}

        const articleObj = {
          source: `${hostname} (Top Google)`,
          title: res.title || 'Bài viết kỹ thuật ngành nước',
          url: res.link,
          domain: item.domain,
          headings: headings.slice(0, 6),
          lexicon,
          keyTakeaways: paragraphs.slice(0, 3),
          sampleText: sampleText.substring(0, 1200)
        };

        currentKnowledge.articlesByDomain[item.domain].unshift(articleObj);
        existingUrls.add(res.link);
        newlyHarvestedCount++;
        addedForThisSector++;
        discoveredDomains.add(hostname);

        console.log(`   ✅ Đã nạp thành công: [${item.domain}] "${res.title}" (${hostname}) [${lexicon.length} thuật ngữ]`);
      } catch (err) {
        console.warn(`   ⚠️ Bỏ qua link lỗi: ${res.link}`, err.message);
      }
    }
  }

  // Calculate totals
  let totalArticles = 0;
  const domainCounts = {};
  Object.entries(currentKnowledge.articlesByDomain).forEach(([d, list]) => {
    domainCounts[d] = list.length;
    totalArticles += list.length;
  });

  const sourcesList = [
    { name: 'Xử Lý Nước Kenwa (Việt Nhật)', url: 'https://locnuockenwa.com/tin-tuc' },
    { name: 'Xử Lý Nước Wepar', url: 'https://wepar.vn/tin-tuc/' },
    { name: 'Xử Lý Nước Việt Phát', url: 'https://xulynuocvietphat.com/tin-tuc' },
    { name: 'Ecomax Water Chuyên Nghiệp', url: 'https://ecomaxwater.com/' },
    { name: 'Toàn Á Môi Trường', url: 'https://toana.vn/' },
    { name: 'Karofi Chuyên Gia', url: 'https://karofi.com/' },
    { name: 'Các Đơn Vị Top 1-5 Google Việt Nam', url: 'https://google.com.vn/' }
  ];

  const updatedKnowledge = {
    lastUpdated: new Date().toISOString(),
    totalArticles,
    totalLexiconTerms: vocabularySet.size,
    sources: sourcesList,
    newlyHarvested: newlyHarvestedCount,
    discoveredWebsites: Array.from(discoveredDomains),
    vocabularyBank: Array.from(vocabularySet).sort(),
    domainCounts,
    articlesByDomain: currentKnowledge.articlesByDomain
  };

  fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(updatedKnowledge, null, 2), 'utf8');

  console.log('════════════════════════════════════════════════════════════════');
  console.log(`🎉 [Google Auto-Harvester] HOÀN TẤT NẠP TRI THỨC GOOGLE TỰ ĐỘNG!`);
  console.log(`   + Nạp mới: ${newlyHarvestedCount} bài viết từ Google.`);
  console.log(`   + Tổng số bài viết trong kho: ${totalArticles} bài.`);
  console.log(`   + Tổng số thuật ngữ kỹ thuật: ${vocabularySet.size} thuật ngữ.`);
  console.log(`   + Phân bố: Tinh khiết (${domainCounts.tinh_khiet}), Sinh hoạt (${domainCounts.sinh_hoat}), Giếng (${domainCounts.gieng_khoan}), Phèn (${domainCounts.phen}), Mặn (${domainCounts.man}), Công nghiệp (${domainCounts.cong_nghiep}).`);
  console.log('════════════════════════════════════════════════════════════════');

  return updatedKnowledge;
}

module.exports = {
  runAutonomousGoogleHarvester,
  SECTOR_SEARCH_QUERIES,
  queryGoogleSerp
};

if (require.main === module) {
  runAutonomousGoogleHarvester().catch(console.error);
}
