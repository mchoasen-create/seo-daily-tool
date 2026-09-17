const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const KNOWLEDGE_FILE = path.join(DATA_DIR, 'industry_knowledge.json');

// Helper to fetch HTML with redirects support and realistic browser headers
function fetchHtml(url) {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache'
        },
        timeout: 12000
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith('/')) {
            const u = new URL(url);
            redirectUrl = `${u.protocol}//${u.host}${redirectUrl}`;
          }
          return resolve(fetchHtml(redirectUrl));
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', (err) => resolve({ status: 500, error: err.message, data: '' }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 408, error: 'Timeout', data: '' }); });
    } catch (e) {
      resolve({ status: 500, error: e.message, data: '' });
    }
  });
}

// Categorize text or title into 6 core domains with title prioritization
function categorizeDomain(title = '', content = '') {
  const t = (title || '').toLowerCase();
  const c = (content || '').toLowerCase();

  // 1. Check title first (High precision)
  if (t.includes('mặn') || t.includes('nước lợ') || t.includes('nước biển') || t.includes('sầu riêng')) return 'man';
  if (t.includes('giếng') || t.includes('nước ngầm') || t.includes('khoan')) return 'gieng_khoan';
  if (t.includes('phèn') || t.includes('sắt') || t.includes('mangan') || t.includes('vàng đục') || t.includes('tanh')) return 'phen';
  if (t.includes('lọc tổng') || t.includes('sinh hoạt') || t.includes('đầu nguồn') || t.includes('biệt thự') || t.includes('backwash') || t.includes('rửa ngược cột')) return 'sinh_hoat';
  if (t.includes('tinh khiết') || t.includes('đóng bình') || t.includes('uống') || t.includes('ion kiềm') || t.includes('chiết rót') || t.includes('phòng thí nghiệm')) return 'tinh_khiet';
  if (t.includes('lò hơi') || t.includes('tháp giải nhiệt') || t.includes('edi') || t.includes('di và') || t.includes('nước thải') || t.includes('công nghiệp') || t.includes('nhà máy')) return 'cong_nghiep';

  // 2. Fallback to body content matching
  if (c.includes('nhiễm mặn') || c.includes('nước lợ') || c.includes('khử mặn')) return 'man';
  if (c.includes('giếng khoan') || c.includes('nước ngầm')) return 'gieng_khoan';
  if (c.includes('nhiễm phèn') || c.includes('khử phèn') || c.includes('khử sắt')) return 'phen';
  if (c.includes('lọc tổng') || c.includes('sinh hoạt') || c.includes('làm mềm nước')) return 'sinh_hoat';
  if (c.includes('tinh khiết') || c.includes('màng ro') || c.includes('đóng bình')) return 'tinh_khiet';
  return 'cong_nghiep';
}

// Master Technical Lexicon List
const INDUSTRY_LEXICON_MASTER = [
  'thẩm thấu ngược', 'màng bán thấm', 'màng ro', 'màng ro 4040', 'màng ro 8040', 'dow filmtec', 'dupont', 'toray', 'hydranautics',
  'chênh áp dp', 'lưu lượng tức thời', 'tỷ lệ thu hồi permeate', 'dòng cô đặc concentrate', 'nước thành phẩm',
  'chỉ số sdi', 'tds tổng chất rắn hòa tan', 'độ dẫn điện ec', 'điện trở suất', 'khử ion di', 'hệ edi', 'hỗn hợp mixed bed',
  'bơm trục đứng đa tầng cánh', 'áp suất vận hành', 'hóa chất chống cáu cặn antiscalant', 'quy trình tẩy rửa cip',
  'rửa ngược backwash', 'rửa xuôi fast rinse', 'hoàn nguyên hạt nhựa', 'muối viên tinh khiết nacl',
  'autovalve van tự động', 'van clack usa', 'van runxin 3 ngã 5 ngã', 'cột lọc composite 1054 1252', 'cột lọc inox 304 316',
  'than hoạt tính gáo dừa trà bắc', 'than calgon norit', 'cát thạch anh', 'quặng mangan greensand', 'hạt birm clack', 'hạt cation purolite dow',
  'trao đổi ion làm mềm', 'độ cứng canxi magie', 'khử clo dư', 'sục khí ejector venturi', 'tháp sục khí oxy hóa',
  'nước cấp lò hơi', 'khử oxy hòa tan', 'tháp giải nhiệt cooling tower', 'chu trình cô đặc coc', 'buồng điện phân titan platinum',
  'chỉ số chống oxy hóa orp', 'qcvn 01-1:2018/byt', 'qcvn 6-1:2010/byt'
];

function extractLexicon(text) {
  const found = new Set();
  const lower = text.toLowerCase();
  for (const kw of INDUSTRY_LEXICON_MASTER) {
    const term = kw.split(' ')[0];
    if (lower.includes(term) || lower.includes(kw)) {
      found.add(kw);
    }
  }
  return Array.from(found);
}

function cleanText(html) {
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

// 1. Kenwa Scraper (locnuockenwa.com)
async function crawlKenwa() {
  console.log('[IndustryCrawler] 🔍 Crawling Kenwa (locnuockenwa.com)...');
  const res = await fetchHtml('https://locnuockenwa.com/tin-tuc');
  if (res.status !== 200 || !res.data) return [];

  const aRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  const links = [];
  const seen = new Set();

  while ((match = aRegex.exec(res.data)) !== null) {
    const href = match[1];
    let title = cleanText(match[2]);
    if (!title) {
      const tm = match[0].match(/title=["']([^"']+)["']/i);
      if (tm) title = cleanText(tm[1]);
    }
    if (href && title.length > 20 && !href.startsWith('http') && !href.includes('#') && !href.includes('lien-he')) {
      if (!seen.has(href)) {
        seen.add(href);
        links.push({ title, url: `https://locnuockenwa.com/${href}` });
      }
    }
  }

  const articles = [];
  for (const item of links.slice(0, 15)) {
    try {
      const artRes = await fetchHtml(item.url);
      if (artRes.status === 200 && artRes.data) {
        const hMatches = artRes.data.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi) || [];
        const headings = hMatches.map(h => cleanText(h)).filter(h => h.length > 10 && h.length < 150);

        const pMatches = artRes.data.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
        const paragraphs = pMatches.map(p => cleanText(p)).filter(p => p.length > 40 && !p.includes('HOTLINE') && !p.includes('Công Ty TNHH'));

        const fullSample = paragraphs.slice(0, 12).join('\n\n');
        const domain = categorizeDomain(item.title, fullSample);
        const lexicon = extractLexicon(fullSample);

        articles.push({
          source: 'Kenwa (locnuockenwa.com)',
          title: item.title,
          url: item.url,
          domain,
          headings: headings.slice(0, 8),
          lexicon,
          keyTakeaways: paragraphs.slice(0, 4),
          sampleText: fullSample.substring(0, 1400)
        });
        console.log(`  + [Kenwa] (${domain}) ${item.title} [${lexicon.length} terms]`);
      }
    } catch (e) {}
  }
  return articles;
}

// 2. Wepar Scraper (wepar.vn)
async function crawlWepar() {
  console.log('[IndustryCrawler] 🔍 Crawling Wepar (wepar.vn)...');
  const res = await fetchHtml('https://wepar.vn/tin-tuc/');
  if (res.status !== 200 || !res.data) return [];

  const aRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  const links = [];
  const seen = new Set();

  while ((match = aRegex.exec(res.data)) !== null) {
    const href = match[1];
    let title = cleanText(match[2]);
    if (!title) {
      const tm = match[0].match(/title=["']([^"']+)["']/i);
      if (tm) title = cleanText(tm[1]);
    }
    if (href && title.length > 25 && href.startsWith('https://wepar.vn/') && !href.includes('/category/') && !href.includes('/page/')) {
      if (!seen.has(href)) {
        seen.add(href);
        links.push({ title, url: href });
      }
    }
  }

  const articles = [];
  for (const item of links.slice(0, 12)) {
    try {
      const artRes = await fetchHtml(item.url);
      if (artRes.status === 200 && artRes.data) {
        const hMatches = artRes.data.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi) || [];
        const headings = hMatches.map(h => cleanText(h)).filter(h => h.length > 10 && h.length < 150);

        const pMatches = artRes.data.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
        const paragraphs = pMatches.map(p => cleanText(p)).filter(p => p.length > 40 && !p.includes('Hotline') && !p.includes('WEPAR'));

        const fullSample = paragraphs.slice(0, 12).join('\n\n');
        const domain = categorizeDomain(item.title, fullSample);
        const lexicon = extractLexicon(fullSample);

        articles.push({
          source: 'Wepar (wepar.vn)',
          title: item.title,
          url: item.url,
          domain,
          headings: headings.slice(0, 8),
          lexicon,
          keyTakeaways: paragraphs.slice(0, 4),
          sampleText: fullSample.substring(0, 1400)
        });
        console.log(`  + [Wepar] (${domain}) ${item.title} [${lexicon.length} terms]`);
      }
    } catch (e) {}
  }
  return articles;
}

// 3. Việt Phát Scraper (xulynuocvietphat.com)
async function crawlVietPhat() {
  console.log('[IndustryCrawler] 🔍 Crawling Việt Phát (xulynuocvietphat.com)...');
  const res = await fetchHtml('https://xulynuocvietphat.com/tin-tuc');
  if (res.status !== 200 || !res.data) return [];

  const aRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  const links = [];
  const seen = new Set();

  while ((match = aRegex.exec(res.data)) !== null) {
    const href = match[1];
    let title = cleanText(match[2]);
    if (!title) {
      const tm = match[0].match(/title=["']([^"']+)["']/i);
      if (tm) title = cleanText(tm[1]);
    }
    if (href && title.length > 25 && href.includes('xulynuocvietphat.com/') && !href.includes('/danh-muc/') && !href.includes('cart') && !href.includes('gio-hang') && !title.includes('Giỏ hàng')) {
      if (!seen.has(href)) {
        seen.add(href);
        links.push({ title, url: href });
      }
    }
  }

  const articles = [];
  for (const item of links.slice(0, 12)) {
    try {
      const artRes = await fetchHtml(item.url);
      if (artRes.status === 200 && artRes.data) {
        const hMatches = artRes.data.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi) || [];
        const headings = hMatches.map(h => cleanText(h)).filter(h => h.length > 10 && h.length < 150);

        const pMatches = artRes.data.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
        const paragraphs = pMatches.map(p => cleanText(p)).filter(p => p.length > 40 && !p.includes('Việt Phát'));

        const fullSample = paragraphs.slice(0, 12).join('\n\n');
        const domain = categorizeDomain(item.title, fullSample);
        const lexicon = extractLexicon(fullSample);

        articles.push({
          source: 'Việt Phát (xulynuocvietphat.com)',
          title: item.title,
          url: item.url,
          domain,
          headings: headings.slice(0, 8),
          lexicon,
          keyTakeaways: paragraphs.slice(0, 4),
          sampleText: fullSample.substring(0, 1400)
        });
        console.log(`  + [Việt Phát] (${domain}) ${item.title} [${lexicon.length} terms]`);
      }
    } catch (e) {}
  }
  return articles;
}

// Trích xuất các liên kết phân trang và dự đoán URL các trang tiếp theo
function detectPaginationLinks(html, currentUrl) {
  const pageUrls = [];
  const seen = new Set();
  seen.add(currentUrl);

  const u = new URL(currentUrl);
  const origin = u.origin;
  const pathname = u.pathname;

  // Regex tìm thẻ <a>
  const aRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  let maxFoundPage = 1;
  let patternType = null; // 'page-num', 'page/num', 'param_page', 'param_paged'

  while ((match = aRegex.exec(html)) !== null) {
    let href = match[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
    if (href.startsWith('//')) href = `${u.protocol}${href}`;
    else if (href.startsWith('/')) href = `${origin}${href}`;
    else if (!href.startsWith('http')) {
      href = new URL(href, currentUrl).href;
    }

    // Chỉ xét cùng domain
    try {
      const parsed = new URL(href);
      if (parsed.hostname !== u.hostname) continue;
    } catch (e) { continue; }

    // Kiểm tra các dạng pagination phổ biến
    const m1 = href.match(/\/page-(\d+)\/?/i);
    const m2 = href.match(/\/page\/(\d+)\/?/i);
    const m3 = href.match(/[?&]page=(\d+)/i);
    const m4 = href.match(/[?&]paged=(\d+)/i);
    const m5 = href.match(/\/trang-(\d+)\/?/i);

    const num = parseInt((m1 && m1[1]) || (m2 && m2[1]) || (m3 && m3[1]) || (m4 && m4[1]) || (m5 && m5[1]) || '0', 10);
    if (num > 1) {
      if (num > maxFoundPage) maxFoundPage = num;
      if (m1) patternType = 'page-num';
      else if (m2) patternType = 'page/num';
      else if (m3) patternType = 'param_page';
      else if (m4) patternType = 'param_paged';
      else if (m5) patternType = 'trang-num';

      if (!seen.has(href)) {
        seen.add(href);
        pageUrls.push({ pageNum: num, url: href });
      }
    }
  }

  // Nếu phát hiện pattern nhưng danh sách pageUrls còn thiếu các trang trung gian
  // ta chủ động sinh ra URL cho các trang tiếp theo
  function buildPageUrl(targetPage) {
    if (patternType === 'page-num') {
      const cleanPath = pathname.replace(/\/page-\d+\/?/i, '').replace(/\/+$/, '');
      return `${origin}${cleanPath}/page-${targetPage}/`;
    } else if (patternType === 'page/num') {
      const cleanPath = pathname.replace(/\/page\/\d+\/?/i, '').replace(/\/+$/, '');
      return `${origin}${cleanPath}/page/${targetPage}/`;
    } else if (patternType === 'trang-num') {
      const cleanPath = pathname.replace(/\/trang-\d+\/?/i, '').replace(/\/+$/, '');
      return `${origin}${cleanPath}/trang-${targetPage}/`;
    } else if (patternType === 'param_page') {
      const newU = new URL(currentUrl);
      newU.searchParams.set('page', targetPage);
      return newU.href;
    } else if (patternType === 'param_paged') {
      const newU = new URL(currentUrl);
      newU.searchParams.set('paged', targetPage);
      return newU.href;
    }
    // Fallback thử dạng phổ biến nhất nếu link có /tin-tuc/
    const cleanPath = pathname.replace(/\/+$/, '');
    return `${origin}${cleanPath}/page-${targetPage}/`;
  }

  return {
    maxFoundPage,
    patternType,
    existingPages: pageUrls.sort((a, b) => a.pageNum - b.pageNum),
    buildPageUrl
  };
}

// Trích xuất các liên kết bài viết thực sự từ 1 trang danh mục
function extractArticleLinksFromListing(html, listingUrl) {
  const articles = [];
  const seen = new Set();
  seen.add(listingUrl);

  const u = new URL(listingUrl);
  const origin = u.origin;
  const listingPath = u.pathname.replace(/\/+$/, '');

  const aRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  const blacklistPatterns = [
    '/gioi-thieu', '/lien-he', '/chinh-sach', '/dieu-khoan', '/cart', '/gio-hang',
    '/checkout', '/thanh-toan', '/login', '/dang-nhap', '/register', '/tai-khoan',
    'zalo.me', 'facebook.com', 'youtube.com', 'tel:', 'mailto:', 'javascript:', '#'
  ];

  while ((match = aRegex.exec(html)) !== null) {
    let href = match[1].trim();
    if (!href) continue;

    const fullTag = match[0];
    let title = cleanText(match[2]);
    if (!title || title.length < 15) {
      const tm = fullTag.match(/title=["']([^"']+)["']/i);
      if (tm) title = cleanText(tm[1]);
    }
    if (!title || title.length < 15) {
      const altM = fullTag.match(/alt=["']([^"']+)["']/i);
      if (altM) title = cleanText(altM[1]);
    }

    if (href.startsWith('//')) href = `${u.protocol}${href}`;
    else if (href.startsWith('/')) href = `${origin}${href}`;
    else if (!href.startsWith('http')) {
      href = new URL(href, listingUrl).href;
    }

    try {
      const parsed = new URL(href);
      if (parsed.hostname !== u.hostname) continue;
      const lowerHref = href.toLowerCase();

      // Bỏ qua blacklist
      if (blacklistPatterns.some(p => lowerHref.includes(p))) continue;

      // Bỏ qua chính trang phân trang
      if (/\/page-\d+/i.test(lowerHref) || /\/page\/\d+/i.test(lowerHref) || /[?&](page|paged)=\d+/i.test(lowerHref)) {
        continue;
      }

      // Tránh lấy lại chính trang danh mục
      const itemPath = parsed.pathname.replace(/\/+$/, '');
      if (itemPath === listingPath) continue;

      // Tiêu đề phải có nghĩa và dài hơn 18 ký tự
      if (title && title.length >= 18 && !seen.has(href)) {
        seen.add(href);
        articles.push({ title, url: href });
      }
    } catch (e) {}
  }

  return articles;
}

// Cào nội dung chi tiết của 1 bài viết con
async function crawlSingleArticle(articleUrl, fallbackTitle = '') {
  try {
    const res = await fetchHtml(articleUrl);
    if (res.status !== 200 || !res.data) return null;

    let title = '';
    const titleMatch = res.data.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || res.data.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) title = cleanText(titleMatch[1]);
    if (!title || title.length < 10) title = fallbackTitle || 'Bài viết chuyên ngành';

    // Loại bỏ tên website ở đuôi tiêu đề nếu có (ví dụ: " - Kensi", " | Locnuoc")
    title = title.replace(/\s*[-–|]\s*(Kensi|Wepar|Kenwa|Việt Phát|Locnuoc).*$/i, '').trim();

    const hMatches = res.data.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi) || [];
    const headings = hMatches.map(h => cleanText(h)).filter(h => h.length > 8 && h.length < 160);

    const pMatches = res.data.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    const paragraphs = pMatches.map(p => cleanText(p)).filter(p => p.length > 35);

    const fullSample = paragraphs.slice(0, 15).join('\n\n');
    const domain = categorizeDomain(title, fullSample);
    const lexicon = extractLexicon(`${title} ${fullSample}`);

    return {
      source: new URL(articleUrl).hostname,
      title,
      url: articleUrl,
      domain,
      headings: headings.slice(0, 10),
      lexicon,
      keyTakeaways: paragraphs.slice(0, 5),
      sampleText: fullSample.substring(0, 1800),
      crawledAt: new Date().toISOString()
    };
  } catch (err) {
    return null;
  }
}

// 4. Custom Scraper đa tầng: Hỗ trợ cả URL bài viết lẻ VÀ URL chuyên mục phân trang sâu
async function crawlCustomUrl(customUrl, { maxPages = 5, onProgress } = {}) {
  console.log(`[IndustryCrawler] 🔍 Crawling URL: ${customUrl} (MaxPages: ${maxPages})`);
  const res = await fetchHtml(customUrl);
  if (res.status !== 200 || !res.data) throw new Error(`Không thể kết nối đến URL: ${customUrl} (Status ${res.status})`);

  // Phân tích xem đây là trang chuyên mục (Listing/Archive) hay bài viết lẻ
  const listingArticles = extractArticleLinksFromListing(res.data, customUrl);
  const paginationInfo = detectPaginationLinks(res.data, customUrl);

  const isListingPage = listingArticles.length >= 3 || paginationInfo.existingPages.length > 0;

  // TRƯỜNG HỢP 1: ĐÂY LÀ TRANG CHUYÊN MỤC / DANH MỤC TIN TỨC ĐỐI THỦ
  if (isListingPage) {
    console.log(`[IndustryCrawler] 📂 Phát hiện trang chuyên mục với tối đa ~${paginationInfo.maxFoundPage || 1} trang phân trang!`);
    if (onProgress) onProgress(`Phát hiện chuyên mục đối thủ (~${paginationInfo.maxFoundPage || 1} trang). Đang quét trang 1...`);

    const allArticleLinks = [...listingArticles];
    const seenArticleUrls = new Set(listingArticles.map(a => a.url));
    const pagesToCrawl = Math.min(maxPages, Math.max(paginationInfo.maxFoundPage, 1));

    // Quét tiếp các trang phân trang 2, 3, 4, ...
    for (let p = 2; p <= pagesToCrawl; p++) {
      let nextUrl = null;
      const found = paginationInfo.existingPages.find(x => x.pageNum === p);
      if (found) {
        nextUrl = found.url;
      } else {
        nextUrl = paginationInfo.buildPageUrl(p);
      }

      if (nextUrl) {
        try {
          if (onProgress) onProgress(`Đang quét trang danh mục ${p}/${pagesToCrawl}...`);
          console.log(`  + Đang cào trang danh mục ${p}/${pagesToCrawl}: ${nextUrl}`);
          const pRes = await fetchHtml(nextUrl);
          if (pRes.status === 200 && pRes.data) {
            const pageArticles = extractArticleLinksFromListing(pRes.data, nextUrl);
            pageArticles.forEach(item => {
              if (!seenArticleUrls.has(item.url)) {
                seenArticleUrls.add(item.url);
                allArticleLinks.push(item);
              }
            });
          }
        } catch (e) {
          console.warn(`  ! Lỗi cào trang ${p}:`, e.message);
        }
      }
    }

    console.log(`[IndustryCrawler] 🎯 Thu thập được ${allArticleLinks.length} bài viết từ ${pagesToCrawl} trang danh mục. Đang cào chi tiết từng bài...`);

    // Cào nội dung chi tiết từng bài viết con (chạy đồng thời theo batch để tối ưu tốc độ)
    const harvestedArticles = [];
    const BATCH_SIZE = 4;
    for (let i = 0; i < allArticleLinks.length; i += BATCH_SIZE) {
      const chunk = allArticleLinks.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(chunk.map(item => crawlSingleArticle(item.url, item.title)));
      results.forEach(art => {
        if (art && art.headings && (art.headings.length > 0 || art.sampleText.length > 100)) {
          harvestedArticles.push(art);
        }
      });
      if (onProgress) {
        onProgress(`Đã cào chi tiết ${harvestedArticles.length}/${allArticleLinks.length} bài viết kỹ thuật...`);
      }
    }

    // Nạp toàn bộ vào kho industry_knowledge.json
    const full = getIndustryKnowledge();
    if (!full.articlesByDomain) full.articlesByDomain = {};

    let newlyAdded = 0;
    const vocabularySet = new Set(full.vocabularyBank || INDUSTRY_LEXICON_MASTER);

    harvestedArticles.forEach(art => {
      if (!full.articlesByDomain[art.domain]) full.articlesByDomain[art.domain] = [];
      const exists = full.articlesByDomain[art.domain].some(x => x.url === art.url);
      if (!exists) {
        full.articlesByDomain[art.domain].unshift(art);
        newlyAdded++;
        (art.lexicon || []).forEach(w => vocabularySet.add(w));
      }
    });

    // Cập nhật thống kê
    let totalCount = 0;
    const domainCounts = {};
    Object.keys(full.articlesByDomain).forEach(d => {
      const c = full.articlesByDomain[d].length;
      domainCounts[d] = c;
      totalCount += c;
    });

    full.totalArticles = totalCount;
    full.domainCounts = domainCounts;
    full.vocabularyBank = Array.from(vocabularySet).sort();
    full.lastUpdated = new Date().toISOString();

    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(full, null, 2), 'utf8');

    return {
      isMulti: true,
      pagesCrawled: pagesToCrawl,
      totalFound: allArticleLinks.length,
      harvestedCount: harvestedArticles.length,
      newlyAdded,
      totalArticles: full.totalArticles,
      domainCounts: full.domainCounts,
      articles: harvestedArticles
    };
  }

  // TRƯỜNG HỢP 2: ĐÂY LÀ 1 BÀI VIẾT ĐƠN LẺ
  let title = '';
  const titleMatch = res.data.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || res.data.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) title = cleanText(titleMatch[1]);
  title = title.replace(/\s*[-–|]\s*(Kensi|Wepar|Kenwa|Việt Phát|Locnuoc).*$/i, '').trim();

  const hMatches = res.data.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi) || [];
  const headings = hMatches.map(h => cleanText(h)).filter(h => h.length > 8 && h.length < 150);

  const pMatches = res.data.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  const paragraphs = pMatches.map(p => cleanText(p)).filter(p => p.length > 35);

  const fullSample = paragraphs.slice(0, 15).join('\n\n');
  const domain = categorizeDomain(title, fullSample);
  const lexicon = extractLexicon(`${title} ${fullSample}`);

  const single = {
    source: new URL(customUrl).hostname,
    title: title || 'Bài viết chuyên ngành',
    url: customUrl,
    domain,
    headings: headings.slice(0, 10),
    lexicon,
    keyTakeaways: paragraphs.slice(0, 5),
    sampleText: fullSample.substring(0, 1800),
    crawledAt: new Date().toISOString()
  };

  const full = getIndustryKnowledge();
  if (!full.articlesByDomain) full.articlesByDomain = {};
  if (!full.articlesByDomain[single.domain]) full.articlesByDomain[single.domain] = [];

  const exists = full.articlesByDomain[single.domain].some(x => x.url === single.url);
  if (!exists) {
    full.articlesByDomain[single.domain].unshift(single);
    full.totalArticles = (full.totalArticles || 0) + 1;
    if (full.domainCounts) full.domainCounts[single.domain] = (full.domainCounts[single.domain] || 0) + 1;
    const vocabularySet = new Set(full.vocabularyBank || INDUSTRY_LEXICON_MASTER);
    (single.lexicon || []).forEach(w => vocabularySet.add(w));
    full.vocabularyBank = Array.from(vocabularySet).sort();
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(full, null, 2), 'utf8');
  }

  return {
    isMulti: false,
    article: single,
    totalArticles: full.totalArticles
  };
}

// 5. XÓA BÀI VIẾT LẺ KHỎI KHO TRI THỨC
function deleteIndustryArticle(targetUrl, domain = null) {
  const full = getIndustryKnowledge();
  let deleted = false;
  let removedArticle = null;

  if (!targetUrl) return { success: false, message: 'URL không hợp lệ' };

  const cleanTarget = targetUrl.trim();
  const cleanTargetNorm = cleanTarget.replace(/\/+$/, '').toLowerCase();

  function matchUrl(a) {
    if (!a) return false;
    if (a.url === cleanTarget) return true;
    if ((a.url || '').replace(/\/+$/, '').toLowerCase() === cleanTargetNorm) return true;
    if ((a.title || '').trim() === cleanTarget) return true;
    return false;
  }

  if (full.articlesByDomain) {
    // 1. Tìm trong domain được chỉ định trước
    if (domain && domain !== 'all' && full.articlesByDomain[domain]) {
      const arr = full.articlesByDomain[domain];
      const idx = arr.findIndex(matchUrl);
      if (idx !== -1) {
        removedArticle = arr.splice(idx, 1)[0];
        deleted = true;
      }
    }

    // 2. Nếu chưa tìm thấy, quét qua tất cả các domain
    if (!deleted) {
      for (const d of Object.keys(full.articlesByDomain)) {
        const arr = full.articlesByDomain[d] || [];
        const idx = arr.findIndex(matchUrl);
        if (idx !== -1) {
          removedArticle = arr.splice(idx, 1)[0];
          deleted = true;
          break;
        }
      }
    }
  }

  if (deleted) {
    let total = 0;
    const domainCounts = {};
    for (const d of Object.keys(full.articlesByDomain || {})) {
      const count = (full.articlesByDomain[d] || []).length;
      domainCounts[d] = count;
      total += count;
    }
    full.totalArticles = total;
    full.domainCounts = domainCounts;
    full.lastUpdated = new Date().toISOString();
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(full, null, 2), 'utf8');
  }

  return {
    success: deleted,
    removedArticle,
    totalArticles: full.totalArticles || 0,
    domainCounts: full.domainCounts || {}
  };
}

// 6. DỌN DẸP / XÓA BÀI VIẾT THEO CHUYÊN MỤC HOẶC TẤT CẢ
function clearIndustryArticles(domain = 'all') {
  const full = getIndustryKnowledge();
  if (!full.articlesByDomain) full.articlesByDomain = {};

  if (domain === 'all') {
    for (const d of Object.keys(full.articlesByDomain)) {
      full.articlesByDomain[d] = [];
    }
    full.totalArticles = 0;
    full.domainCounts = {
      cong_nghiep: 0,
      tinh_khiet: 0,
      sinh_hoat: 0,
      gieng_khoan: 0,
      phen: 0,
      man: 0
    };
  } else if (full.articlesByDomain[domain]) {
    const removedCount = full.articlesByDomain[domain].length;
    full.articlesByDomain[domain] = [];
    full.totalArticles = Math.max(0, (full.totalArticles || 0) - removedCount);
    if (full.domainCounts) full.domainCounts[domain] = 0;
  }

  full.lastUpdated = new Date().toISOString();
  fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(full, null, 2), 'utf8');

  return {
    success: true,
    totalArticles: full.totalArticles,
    domainCounts: full.domainCounts
  };
}

// Harvest All Sources
async function harvestAllIndustryKnowledge() {
  console.log('====================================================');
  console.log('🚀 Bắt đầu quét mở rộng đa nguồn: Kenwa, Wepar, Việt Phát...');
  console.log('====================================================');

  const [kenwa, wepar, vietphat] = await Promise.all([
    crawlKenwa(),
    crawlWepar(),
    crawlVietPhat()
  ]);

  const allArticles = [...kenwa, ...wepar, ...vietphat];

  const knowledgeByDomain = {
    cong_nghiep: [],
    tinh_khiet: [],
    sinh_hoat: [],
    gieng_khoan: [],
    phen: [],
    man: []
  };

  const vocabularySet = new Set(INDUSTRY_LEXICON_MASTER);

  allArticles.forEach(art => {
    if (!knowledgeByDomain[art.domain]) knowledgeByDomain[art.domain] = [];
    knowledgeByDomain[art.domain].push(art);
    (art.lexicon || []).forEach(w => vocabularySet.add(w));
  });

  const payload = {
    lastUpdated: new Date().toISOString(),
    totalArticles: allArticles.length,
    totalLexiconTerms: vocabularySet.size,
    sources: [
      { name: 'Xử Lý Nước Kenwa (Việt Nhật)', url: 'https://locnuockenwa.com/tin-tuc', count: kenwa.length },
      { name: 'Xử Lý Nước Wepar', url: 'https://wepar.vn/tin-tuc/', count: wepar.length },
      { name: 'Xử Lý Nước Việt Phát', url: 'https://xulynuocvietphat.com/tin-tuc', count: vietphat.length }
    ],
    vocabularyBank: Array.from(vocabularySet).sort(),
    domainCounts: {
      cong_nghiep: knowledgeByDomain.cong_nghiep.length,
      tinh_khiet: knowledgeByDomain.tinh_khiet.length,
      sinh_hoat: knowledgeByDomain.sinh_hoat.length,
      gieng_khoan: knowledgeByDomain.gieng_khoan.length,
      phen: knowledgeByDomain.phen.length,
      man: knowledgeByDomain.man.length
    },
    articlesByDomain: knowledgeByDomain
  };

  fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\n🎉 Đã thu thập thành công ${allArticles.length} bài viết & ${vocabularySet.size} thuật ngữ chuyên sâu!`);
  return payload;
}

function getIndustryKnowledge(domain = null) {
  try {
    if (fs.existsSync(KNOWLEDGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf8') || '{}');
      if (domain && data.articlesByDomain && data.articlesByDomain[domain]) {
        return {
          domainArticles: data.articlesByDomain[domain],
          vocabularyBank: data.vocabularyBank || [],
          totalArticles: data.totalArticles || 0
        };
      }
      return data;
    }
  } catch (e) {
    console.error('Error reading industry_knowledge.json:', e);
  }
  return { articlesByDomain: {}, vocabularyBank: INDUSTRY_LEXICON_MASTER, totalArticles: 0 };
}

module.exports = {
  harvestAllIndustryKnowledge,
  getIndustryKnowledge,
  crawlCustomUrl,
  deleteIndustryArticle,
  clearIndustryArticles,
  categorizeDomain,
  extractLexicon,
  INDUSTRY_LEXICON_MASTER
};

if (require.main === module) {
  harvestAllIndustryKnowledge().catch(console.error);
}
