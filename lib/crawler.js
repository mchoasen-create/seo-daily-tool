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

// Read cached live blog posts
function getLiveBlogPosts() {
  try {
    if (fs.existsSync(LIVE_BLOG_FILE)) {
      const data = JSON.parse(fs.readFileSync(LIVE_BLOG_FILE, 'utf8') || '{}');
      return data.posts || [];
    }
  } catch (e) {
    console.error('Error reading live_blog_posts.json:', e);
  }
  return [];
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

// Get avoidance context for a keyword
function getAvoidanceContextForKeyword(keyword) {
  const livePosts = getLiveBlogPosts();
  if (!livePosts || livePosts.length === 0) return '';

  const cleanKw = (keyword || '').toLowerCase().trim();
  const kwTokens = tokenize(cleanKw);

  // Find posts that relate to this keyword
  const relevantPosts = livePosts.filter(p => {
    const postTokens = tokenize(p.title);
    const hasOverlap = kwTokens.some(t => postTokens.includes(t));
    return hasOverlap || p.title.toLowerCase().includes(cleanKw);
  });

  if (relevantPosts.length === 0) {
    // Return sample of general posts
    return livePosts.slice(0, 5).map(p => `• ${p.title}`).join('\n');
  }

  return relevantPosts.slice(0, 8).map(p => `• ${p.title}`).join('\n');
}

module.exports = {
  crawlAllBlogPosts,
  getLiveBlogPosts,
  getLiveBlogMetadata,
  checkDuplicateTitle,
  getAvoidanceContextForKeyword,
  calculateJaccardSimilarity
};
