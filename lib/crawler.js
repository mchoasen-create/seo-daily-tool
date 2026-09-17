const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const LIVE_BLOG_FILE = path.join(DATA_DIR, 'live_blog_posts.json');

// HTML Entity decoder helper
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#038;/g, '&')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8230;/g, '...')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// Tokenize text into words for similarity calculation
function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
}

// Jaccard similarity between two texts
function calculateJaccardSimilarity(textA, textB) {
  const setA = new Set(tokenize(textA));
  const setB = new Set(tokenize(textB));
  if (setA.size === 0 || setB.size === 0) return 0;
  
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// Read cached live blog posts and local posts to prevent any duplicate titles
function getLiveBlogPosts() {
  const all = [];
  try {
    if (fs.existsSync(LIVE_BLOG_FILE)) {
      const data = JSON.parse(fs.readFileSync(LIVE_BLOG_FILE, 'utf8') || '{}');
      if (Array.isArray(data.posts)) all.push(...data.posts);
    }
  } catch (e) {
    console.error('Error reading live_blog_posts.json:', e);
  }
  try {
    const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
    if (fs.existsSync(POSTS_FILE)) {
      const localPosts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8') || '[]');
      localPosts.forEach(p => {
        if (p.title) all.push({ title: p.title, url: p.wpLink || '' });
      });
    }
  } catch (e) {}
  return all;
}

function getLiveBlogMetadata() {
  try {
    if (fs.existsSync(LIVE_BLOG_FILE)) {
      return JSON.parse(fs.readFileSync(LIVE_BLOG_FILE, 'utf8') || '{}');
    }
  } catch (e) {}
  return { posts: [], count: 0, lastScanned: null };
}

// Crawl a single page of blog-chia-se
async function crawlPage(pageUrl) {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8'
      }
    });

    if (!res.ok) return { posts: [], nextPages: [] };
    const html = await res.text();

    const posts = [];
    // Match titles inside h2 / h3 tags with link
    const hLinkRegex = /<h[23][^>]*>[\s\S]*?<a[^>]+href=[\"']([^\"']+)[\"'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h[23]>/gi;
    let match;
    while ((match = hLinkRegex.exec(html)) !== null) {
      const link = match[1];
      const title = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, '').trim());
      // Skip pagination links, category links, or empty
      if (title && link && !link.includes('/category/') && !link.includes('/page/') && !link.includes('#')) {
        if (!posts.some(p => p.url === link)) {
          // Extract slug
          const slugMatch = link.match(/xulynuochoasen\.com\/([^\/]+)\/?$/);
          const slug = slugMatch ? slugMatch[1] : '';
          posts.push({
            title,
            url: link,
            slug
          });
        }
      }
    }

    // Find next pagination URLs
    const nextPages = [];
    const pRegex = /href=[\"'](https:\/\/xulynuochoasen\.com\/blog-chia-se\/page\/\d+\/?)[\"']/gi;
    let pMatch;
    while ((pMatch = pRegex.exec(html)) !== null) {
      const pUrl = pMatch[1].endsWith('/') ? pMatch[1] : pMatch[1] + '/';
      if (!nextPages.includes(pUrl)) {
        nextPages.push(pUrl);
      }
    }

    return { posts, nextPages };
  } catch (err) {
    console.error(`Error crawling ${pageUrl}:`, err.message);
    return { posts: [], nextPages: [] };
  }
}

// Master crawl function: crawls all pages starting from /blog-chia-se/
async function crawlAllBlogPosts() {
  const baseUrl = 'https://xulynuochoasen.com/blog-chia-se/';
  console.log(`[Crawler] Starting crawl from ${baseUrl}...`);

  const visitedPages = new Set();
  const queue = [baseUrl];
  const allPostsMap = new Map();

  while (queue.length > 0 && visitedPages.size < 15) { // safety limit to 15 pages
    const currentPage = queue.shift();
    if (visitedPages.has(currentPage)) continue;
    visitedPages.add(currentPage);

    console.log(`[Crawler] Crawling page: ${currentPage}`);
    const { posts, nextPages } = await crawlPage(currentPage);

    posts.forEach(p => {
      if (!allPostsMap.has(p.url)) {
        allPostsMap.set(p.url, p);
      }
    });

    nextPages.forEach(pUrl => {
      if (!visitedPages.has(pUrl) && !queue.includes(pUrl)) {
        queue.push(pUrl);
      }
    });

    // Polite delay between requests
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  const allPosts = Array.from(allPostsMap.values());
  console.log(`[Crawler] Crawl finished. Found total ${allPosts.length} distinct live blog posts.`);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const payload = {
    sourceUrl: baseUrl,
    count: allPosts.length,
    lastScanned: new Date().toISOString(),
    posts: allPosts
  };

  fs.writeFileSync(LIVE_BLOG_FILE, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

// Check title against all crawled posts for similarity
function checkDuplicateTitle(proposedTitle) {
  const livePosts = getLiveBlogPosts();
  let maxSimilarity = 0;
  let mostSimilarPost = null;

  for (const post of livePosts) {
    const sim = calculateJaccardSimilarity(proposedTitle, post.title);
    if (sim > maxSimilarity) {
      maxSimilarity = sim;
      mostSimilarPost = post;
    }
  }

  return {
    isDuplicate: maxSimilarity >= 0.65, // > 65% token overlap is considered duplicate
    similarity: Math.round(maxSimilarity * 100),
    mostSimilarPost
  };
}

// Get avoidance context for a keyword — returns { count, titles, contentSnippets }
function getAvoidanceContextForKeyword(keyword) {
  const livePosts = getLiveBlogPosts();
  if (!livePosts || livePosts.length === 0) return { count: 0, titles: [], contentSnippets: [] };

  const cleanKw = (keyword || '').toLowerCase().trim();
  const kwTokens = tokenize(cleanKw);

  // Find posts that relate to this keyword (title match OR content snippet match)
  const relevantPosts = livePosts.filter(p => {
    const postTokens = tokenize(p.title);
    const hasOverlap = kwTokens.some(t => postTokens.includes(t));
    return hasOverlap || p.title.toLowerCase().includes(cleanKw);
  });

  const pool = relevantPosts.length > 0 ? relevantPosts.slice(0, 12) : livePosts.slice(0, 8);

  return {
    count: pool.length,
    titles: pool.map(p => p.title),
    contentSnippets: pool
      .filter(p => p.contentSnippet)
      .map(p => `=== "${p.title}" ===\n${p.contentSnippet}`)
  };
}

// Direct Realtime Two-Way Sync with WordPress REST API
async function syncWordPressLivePosts(customWpConfig = null) {
  const WP_CONFIG_FILE = path.join(DATA_DIR, 'wordpress.json');
  const KEYWORDS_FILE = path.join(DATA_DIR, 'keywords.json');
  const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
  const WP_ACTIVE_FILE = path.join(DATA_DIR, 'wp_active_images.json');

  let wpConfig = customWpConfig;
  if (!wpConfig && fs.existsSync(WP_CONFIG_FILE)) {
    try {
      wpConfig = JSON.parse(fs.readFileSync(WP_CONFIG_FILE, 'utf8') || '{}');
    } catch (e) {}
  }

  const siteUrl = (wpConfig?.siteUrl || 'https://xulynuochoasen.com').replace(/\/+$/, '');
  const https = require('https');
  const http = require('http');

  function fetchJson(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchJson(res.headers.location).then(resolve).catch(reject);
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data)); } catch (e) { resolve([]); }
          } else {
            resolve([]);
          }
        });
      }).on('error', () => resolve([]));
    });
  }

  // Fetch up to 100 recent published posts from WordPress REST API
  let rawPosts = await fetchJson(`${siteUrl}/wp-json/wp/v2/posts?per_page=100&_embed=1&status=publish`);
  if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
    // Fallback without _embed
    rawPosts = await fetchJson(`${siteUrl}/wp-json/wp/v2/posts?per_page=100&status=publish`);
  }

  if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
    console.log('[WP Sync] Không thể lấy bài viết từ WP REST API hoặc website chưa có bài.');
    return { success: false, message: 'Không lấy được dữ liệu từ WordPress REST API', count: 0 };
  }

  const livePosts = rawPosts.map(p => {
    const cleanTitle = decodeHtmlEntities(p.title?.rendered || '');
    let featuredImg = '';
    if (p._embedded && p._embedded['wp:featuredmedia'] && p._embedded['wp:featuredmedia'][0]) {
      featuredImg = p._embedded['wp:featuredmedia'][0].source_url || '';
    }
    // === FIX: Lưu content snippet để dùng cho avoidance context ===
    const rawContent = p.content?.rendered || p.excerpt?.rendered || '';
    const contentSnippet = rawContent
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z#0-9]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 600);

    return {
      id: p.id,
      title: cleanTitle,
      slug: p.slug,
      url: p.link,
      date: p.date,
      featuredImageUrl: featuredImg,
      contentSnippet  // ← body text đầu bài để detect duplicate thật sự
    };
  });

  // 1. Save live blog posts cache
  const livePayload = {
    sourceUrl: siteUrl,
    count: livePosts.length,
    lastScanned: new Date().toISOString(),
    posts: livePosts
  };
  fs.writeFileSync(LIVE_BLOG_FILE, JSON.stringify(livePayload, null, 2), 'utf8');

  // 2. Update wp_active_images.json with images actually used on WP
  const activeImages = livePosts
    .map(p => p.featuredImageUrl)
    .filter(Boolean)
    .map(u => u.replace(/^https?:\/\/[^\/]+/i, ''));
  fs.writeFileSync(WP_ACTIVE_FILE, JSON.stringify([...new Set(activeImages)], null, 2), 'utf8');

  // 3. Resolve and complete all pending keywords & draft posts that are ALREADY LIVE on WP
  let resolvedKwCount = 0;
  let resolvedPostCount = 0;

  let keywords = [];
  if (fs.existsSync(KEYWORDS_FILE)) {
    try { keywords = JSON.parse(fs.readFileSync(KEYWORDS_FILE, 'utf8') || '[]'); } catch (e) {}
  }

  let posts = [];
  if (fs.existsSync(POSTS_FILE)) {
    try { posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8') || '[]'); } catch (e) {}
  }

  keywords.forEach(k => {
    if (k.status === 'pending') {
      const generatedPost = k.generatedPostId ? posts.find(p => p.id === k.generatedPostId) : null;
      const targetTitle = generatedPost ? generatedPost.title : (k.topic || k.keyword);
      const cleanTarget = targetTitle.toLowerCase().trim();
      const kwClean = k.keyword.toLowerCase().trim();

      const matchedLive = livePosts.find(live => {
        const liveTitle = live.title.toLowerCase().trim();
        if (liveTitle === cleanTarget) return true;
        const sim = calculateJaccardSimilarity(cleanTarget, liveTitle);
        if (sim >= 0.7) return true;
        // Check if live title has the exact keyword and broad similarity
        if (liveTitle.includes(kwClean) && (liveTitle.includes(cleanTarget) || cleanTarget.includes(liveTitle))) return true;
        return false;
      });

      if (matchedLive) {
        k.status = 'completed';
        k.completedAt = matchedLive.date || new Date().toISOString();
        k.wpPostId = matchedLive.id;
        k.wpLink = matchedLive.url;
        k.pregenerated = false;
        resolvedKwCount++;

        if (generatedPost) {
          generatedPost.status = 'published';
          generatedPost.wpPublished = true;
          generatedPost.wpLink = matchedLive.url;
          resolvedPostCount++;
        }
      }
    }
  });

  // Also check any orphaned ready posts in posts.json
  posts.forEach(p => {
    if (p.status === 'ready' && !p.wpPublished) {
      const cleanTitle = p.title.toLowerCase().trim();
      const matchedLive = livePosts.find(live => {
        const liveTitle = live.title.toLowerCase().trim();
        return liveTitle === cleanTitle || calculateJaccardSimilarity(cleanTitle, liveTitle) >= 0.75;
      });
      if (matchedLive) {
        p.status = 'published';
        p.wpPublished = true;
        p.wpLink = matchedLive.url;
        p.wpPostId = p.wpPostId || matchedLive.id; // ← FIX: lưu wpPostId nếu chưa có
        resolvedPostCount++;
      }
    }
    // === FIX: Resolve wpPostId từ wpLink nếu còn thiếu ===
    if (p.wpPublished && p.wpLink && !p.wpPostId) {
      const slug = p.wpLink.replace(/\/$/, '').split('/').pop();
      const matchedBySlug = livePosts.find(live => live.slug === slug);
      if (matchedBySlug) {
        p.wpPostId = matchedBySlug.id;
        resolvedPostCount++;
        console.log(`[WP Sync] Resolved wpPostId=${matchedBySlug.id} for post: ${p.title}`);
      }
    }
  });

  // 4. Đồng bộ các bài viết mới đăng trực tiếp trên WordPress vào posts.json nếu chưa có
  livePosts.slice(0, 30).forEach(live => {
    const cleanLiveTitle = (live.title || '').toLowerCase().trim();
    const alreadyExists = posts.some(p => 
      (p.wpPostId && Number(p.wpPostId) === Number(live.id)) ||
      (p.title && p.title.toLowerCase().trim() === cleanLiveTitle) ||
      (p.wpLink && live.url && p.wpLink.replace(/\/$/, '') === live.url.replace(/\/$/, ''))
    );
    if (!alreadyExists) {
      let targetProductUrl = '';
      try {
        const { getGoogleAdsTargetUrl } = require('./generator');
        targetProductUrl = getGoogleAdsTargetUrl(live.title);
      } catch (e) {
        targetProductUrl = 'https://xulynuochoasen.com/he-thong-loc-nuoc-sinh-hoat/';
      }

      posts.unshift({
        id: 'post_live_' + live.id,
        title: live.title,
        targetKeyword: live.title,
        content: live.contentSnippet || '',
        metaDescription: live.contentSnippet ? live.contentSnippet.substring(0, 160) : '',
        score: 100,
        imageUrl: live.featuredImageUrl || '',
        secondaryImageUrl: '',
        targetProductUrl: targetProductUrl,
        status: 'published',
        date: live.date ? live.date.split('T')[0] : new Date().toISOString().split('T')[0],
        updatedAt: live.date || new Date().toISOString(),
        isAutoGenerated: true,
        wpPublished: true,
        wpLink: live.url,
        wpPostId: live.id
      });
      resolvedPostCount++;
      console.log(`[WP Sync] 📥 Đã đồng bộ bài viết thực tế từ WordPress vào danh sách: "${live.title}" (ID: ${live.id})`);
    }
  });

  if (resolvedKwCount > 0) {
    fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(keywords, null, 2), 'utf8');
  }
  if (resolvedPostCount > 0) {
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), 'utf8');
  }

  console.log(`[WP Sync] Đã đồng bộ ${livePosts.length} bài viết trực tiếp từ WP. Đã xử lý giải phóng ${resolvedKwCount} từ khóa trùng lặp trong hàng chờ.`);
  return {
    success: true,
    count: livePosts.length,
    resolvedKeywords: resolvedKwCount,
    resolvedPosts: resolvedPostCount,
    livePosts: livePosts.slice(0, 15)
  };
}

module.exports = {
  crawlAllBlogPosts,
  getLiveBlogPosts,
  getLiveBlogMetadata,
  checkDuplicateTitle,
  getAvoidanceContextForKeyword,
  calculateJaccardSimilarity,
  syncWordPressLivePosts
};

