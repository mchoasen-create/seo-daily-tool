const { generateSmartSeoTemplate, getRecentUsedImages } = require('./lib/generator');
const { 
  getTwoDistinctRotatedImages, 
  getMediaGallery, 
  updatePostImages, 
  randomizePostImages 
} = require('./lib/custom_media');
const { 
  crawlAllBlogPosts, 
  getLiveBlogPosts, 
  getLiveBlogMetadata, 
  checkDuplicateTitle, 
  getAvoidanceContextForKeyword 
} = require('./lib/crawler');
const {
  getRankings,
  getRankingsStats,
  runRankCheck,
  runTechnicalAudit,
  getGoogleConfig,
  saveGoogleConfig,
  fetchRealGoogleRank,
  searchSerperLive
} = require('./lib/audit_tracker');
const { generateKeywordCluster } = require('./lib/clustering');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const KEYWORDS_FILE = path.join(DATA_DIR, 'keywords.json');
const SCHEDULER_FILE = path.join(DATA_DIR, 'scheduler.json');
const WORDPRESS_FILE = path.join(DATA_DIR, 'wordpress.json');

// Ensure data files exist
const UPLOADS_DIR = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/* ==========================================================================
   CUSTOM MEDIA LIBRARY API ENDPOINTS
   ========================================================================== */
const CUSTOM_MEDIA_FILE = path.join(DATA_DIR, 'custom_media.json');

function getCustomMedia() {
  if (!fs.existsSync(CUSTOM_MEDIA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(CUSTOM_MEDIA_FILE, 'utf-8') || '[]');
  } catch (e) {
    return [];
  }
}

function saveCustomMedia(list) {
  fs.writeFileSync(CUSTOM_MEDIA_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

app.get('/api/media', (req, res) => {
  const mediaList = getCustomMedia();
  res.json({ success: true, count: mediaList.length, data: mediaList });
});

app.post('/api/media/upload', (req, res) => {
  const { files = [], tagKeyword = '' } = req.body;
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ success: false, message: 'Không có file ảnh nào được gửi.' });
  }

  const mediaList = getCustomMedia();
  let addedCount = 0;

  for (const fileObj of files) {
    const { base64, filename } = fileObj;
    if (!base64) continue;
    const matches = base64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (matches) {
      const ext = matches[1] || 'jpg';
      const buffer = Buffer.from(matches[2], 'base64');
      const uniqueId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const saveName = `${uniqueId}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, saveName);
      fs.writeFileSync(filePath, buffer);

      mediaList.push({
        id: uniqueId,
        url: `/uploads/${saveName}`,
        tagKeyword: tagKeyword.trim(),
        filename: filename || saveName,
        createdAt: new Date().toISOString()
      });
      addedCount++;
    }
  }

  saveCustomMedia(mediaList);
  res.json({ success: true, message: `Đã tải lên thành công ${addedCount} tấm ảnh thực tế!`, count: addedCount });
});

app.post('/api/media/drive-link', (req, res) => {
  const { driveUrl = '', tagKeyword = '' } = req.body;
  if (!driveUrl) return res.status(400).json({ success: false, message: 'Thiếu link Google Drive.' });

  let directUrl = driveUrl;
  const match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    directUrl = `https://lh3.googleusercontent.com/u/0/d/${match[1]}`;
  }

  const mediaList = getCustomMedia();
  const uniqueId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  mediaList.push({
    id: uniqueId,
    url: directUrl,
    isDrive: true,
    tagKeyword: tagKeyword.trim(),
    createdAt: new Date().toISOString()
  });

  saveCustomMedia(mediaList);
  res.json({ success: true, message: 'Đã lưu link ảnh Google Drive thành công!' });
});

app.post('/api/media/delete', (req, res) => {
  const { id } = req.body;
  let mediaList = getCustomMedia();
  mediaList = mediaList.filter(m => m.id !== id);
  saveCustomMedia(mediaList);
  res.json({ success: true, message: 'Đã xóa hình ảnh khỏi thư viện.' });
});

app.post('/api/media/update-image', (req, res) => {
  const { id, base64 } = req.body;
  if (!id || !base64) return res.status(400).json({ success: false, message: 'Thiếu dữ liệu xoay ảnh.' });

  const mediaList = getCustomMedia();
  const item = mediaList.find(m => m.id === id);
  if (!item) return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh.' });

  const matches = base64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
  if (matches) {
    const ext = matches[1] || 'jpg';
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `${id}_rot_${Date.now()}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    item.url = `/uploads/${filename}`;
    saveCustomMedia(mediaList);
    return res.json({ success: true, message: 'Đã cập nhật góc xoay ảnh thành công!', data: item });
  }

  res.status(400).json({ success: false, message: 'Dữ liệu ảnh xoay không hợp lệ.' });
});

function rotateMediaToAllPosts() {
  const posts = getPosts();
  const mediaList = getCustomMedia();
  if (!mediaList || mediaList.length === 0) {
    return { success: false, message: 'Chưa có ảnh nào trong Thư Viện Ảnh Thực Tế.' };
  }

  let updatedCount = 0;
  const usedInBatch = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const kw = post.targetKeyword || post.keyword || post.title || '';
    const imgPair = getTwoDistinctRotatedImages(kw, usedInBatch);
    const img1 = imgPair.img1;
    const img2 = imgPair.img2;
    usedInBatch.push(img1, img2);

    post.imageUrl = img1;
    post.featured_image = img1;
    post.secondaryImageUrl = img2;

    if (post.content) {
      let count = 0;
      post.content = post.content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt) => {
        count++;
        if (count === 1) {
          return `![${alt || post.targetKeyword || 'Hệ thống lọc nước Hoa Sen'}](${img1})`;
        } else if (count === 2) {
          return `![${alt || post.targetKeyword || 'Chi tiết cấu tạo lọc nước Hoa Sen'}](${img2})`;
        }
        return match;
      });
    }

    updatedCount++;
  }

  savePosts(posts);
  return { success: true, updatedCount, totalMedia: mediaList.length };
}

app.post('/api/media/rotate-all', (req, res) => {
  const result = rotateMediaToAllPosts();
  if (result.success) {
    res.json({
      success: true,
      message: `Đã tự động xoay vòng ${result.totalMedia} hình ảnh trong kho cho ${result.updatedCount} bài viết từ khóa!`,
      data: result
    });
  } else {
    res.status(400).json(result);
  }
});

// Get paginated gallery of 611 verified images with filters
app.get('/api/media/gallery', (req, res) => {
  try {
    const data = getMediaGallery(req.query);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update draft post images
app.post('/api/posts/:id/update-images', (req, res) => {
  try {
    const result = updatePostImages(req.params.id, req.body);
    if (result.success) {
      res.json({ success: true, message: 'Đã cập nhật hình ảnh bài viết thành công!', post: result.post });
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Randomize fresh non-repeating images for a draft post
app.post('/api/posts/:id/randomize-images', (req, res) => {
  try {
    const result = randomizePostImages(req.params.id);
    if (result.success) {
      res.json({ success: true, message: 'Đã đổi ảnh ngẫu nhiên độc bản thành công!', post: result.post });
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ==========================================================================
   LIVE BLOG CRAWLER & ANTI-CANNIBALIZATION API
   ========================================================================== */
app.get('/api/crawler/status', (req, res) => {
  const meta = getLiveBlogMetadata();
  res.json({ success: true, ...meta });
});

app.get('/api/crawler/posts', (req, res) => {
  const posts = getLiveBlogPosts();
  res.json({ success: true, count: posts.length, data: posts });
});

let isCrawling = false;
app.post('/api/crawler/scan', async (req, res) => {
  if (isCrawling) {
    return res.json({ success: false, message: 'Hệ thống đang tiến hành quét blog, vui lòng đợi trong giây lát...' });
  }
  isCrawling = true;
  try {
    const result = await crawlAllBlogPosts();
    isCrawling = false;
    res.json({ 
      success: true, 
      message: `Đã quét thành công ${result.count} bài viết từ ${result.baseUrl}! Hệ thống đã nạp bộ nhớ chống trùng lặp live.`,
      data: result 
    });
  } catch (err) {
    isCrawling = false;
    res.status(500).json({ success: false, message: 'Lỗi khi quét blog: ' + err.message });
  }
});

/* ==========================================================================
   RANK TRACKER, TECHNICAL AUDIT & KEYWORD CLUSTERING APIs
   ========================================================================== */
app.get('/api/rankings', (req, res) => {
  try {
    const stats = getRankingsStats();
    const mappedKeywords = (stats.rankings || []).map(r => {
      const prev = r.previousPosition || r.position || 5;
      const curr = r.position || 5;
      const change = prev - curr;
      return {
        id: r.id || `rank_${r.keyword}`,
        keyword: r.keyword,
        currentRank: curr,
        previousRank: prev,
        change: change,
        trend: r.trend || (change > 0 ? 'up' : (change < 0 ? 'down' : 'same')),
        targetUrl: r.targetUrl || 'https://xulynuochoasen.com/',
        searchVolume: r.searchVolume || 1200,
        lastChecked: r.lastChecked || new Date().toISOString()
      };
    });
    res.json({
      success: true,
      keywords: mappedKeywords,
      summary: {
        top3: stats.top3,
        top10: stats.top10,
        avgRank: stats.avgRank,
        totalKeywords: stats.total,
        upCount: stats.upCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải dữ liệu thứ hạng: ' + err.message });
  }
});

app.post('/api/rankings/check', async (req, res) => {
  try {
    const updatedRankings = await runRankCheck();
    const stats = getRankingsStats();
    const mappedKeywords = (updatedRankings || []).map(r => {
      const prev = r.previousPosition || r.position || 5;
      const curr = r.position || 5;
      const change = prev - curr;
      return {
        id: r.id || `rank_${r.keyword}`,
        keyword: r.keyword,
        currentRank: curr,
        previousRank: prev,
        change: change,
        trend: r.trend || (change > 0 ? 'up' : (change < 0 ? 'down' : 'same')),
        targetUrl: r.targetUrl || 'https://xulynuochoasen.com/',
        searchVolume: r.searchVolume || 1200,
        lastChecked: r.lastChecked || new Date().toISOString()
      };
    });
    res.json({
      success: true,
      message: `Đã quét và cập nhật vị trí thứ hạng Google mới nhất cho ${mappedKeywords.length} từ khóa!`,
      keywords: mappedKeywords,
      summary: {
        top3: stats.top3,
        top10: stats.top10,
        avgRank: stats.avgRank,
        totalKeywords: stats.total,
        upCount: stats.upCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi khi quét vị trí thứ hạng Google: ' + err.message });
  }
});

app.post('/api/serper/search', async (req, res) => {
  try {
    const { query, num = 100 } = req.body || {};
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập từ khóa tìm kiếm.' });
    }
    const result = await searchSerperLive({ query: query.trim(), num: Number(num) || 100 });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/audit', (req, res) => {
  try {
    const posts = getPosts();
    const auditResult = runTechnicalAudit(posts);
    res.json({
      success: true,
      data: {
        overallScore: auditResult.healthScore || 95,
        totalPosts: auditResult.totalPosts || posts.length,
        passedRules: {
          titleCount: auditResult.passedTitle || 0,
          metaCount: auditResult.passedMeta || 0,
          altCount: auditResult.passedImages || 0,
          internalLinkCount: auditResult.passedLinks || 0,
          wordCountPass: auditResult.passedWordCount || 0,
          schemaPass: auditResult.passedSchema || 0
        },
        issues: auditResult.issues || [],
        lastAuditDate: auditResult.lastAuditDate
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi khi audit website: ' + err.message });
  }
});

app.get('/api/google/config', (req, res) => {
  res.json({ success: true, data: getGoogleConfig() });
});

app.post('/api/google/config', (req, res) => {
  try {
    const updated = saveGoogleConfig(req.body || {});
    res.json({ success: true, message: 'Đã lưu cấu hình Google API thành công!', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi khi lưu cấu hình Google: ' + err.message });
  }
});

app.post('/api/keywords/cluster', (req, res) => {
  try {
    const { seedKeyword } = req.body;
    if (!seedKeyword) return res.status(400).json({ success: false, message: 'Vui lòng nhập từ khóa gốc.' });
    const cluster = generateKeywordCluster(seedKeyword);
    res.json({ success: true, data: cluster });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi phân tích cụm từ khóa: ' + err.message });
  }
});

app.post('/api/keywords/add-bulk', (req, res) => {
  try {
    const { keywordsText = '', topic = 'Cụm LSI Mở Rộng', targetUrl = '' } = req.body;
    const lines = keywordsText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có từ khóa nào.' });
    }
    const keywords = getKeywords();
    let added = 0;
    lines.forEach(kw => {
      const id = 'kw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      keywords.push({
        id,
        keyword: kw,
        topic: topic || 'Cụm LSI',
        targetUrl: targetUrl || '',
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      added++;
    });
    saveKeywords(keywords);
    res.json({ success: true, message: `Đã thêm ${added} từ khóa vào hàng chờ!`, count: added });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi thêm từ khóa: ' + err.message });
  }
});

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(POSTS_FILE)) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify([], null, 2), 'utf-8');
}
if (!fs.existsSync(KEYWORDS_FILE)) {
  fs.writeFileSync(KEYWORDS_FILE, JSON.stringify([], null, 2), 'utf-8');
}
if (!fs.existsSync(SCHEDULER_FILE)) {
  fs.writeFileSync(SCHEDULER_FILE, JSON.stringify({ enabled: false, intervalHours: 24, lastRun: null }, null, 2), 'utf-8');
}
if (!fs.existsSync(WORDPRESS_FILE)) {
  fs.writeFileSync(WORDPRESS_FILE, JSON.stringify({ enabled: false, siteUrl: '', username: '', appPassword: '', autoPublish: false, defaultStatus: 'publish' }, null, 2), 'utf-8');
}

// Helpers
function getPosts() {
  try { return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8') || '[]'); } catch (e) { return []; }
}
function savePosts(posts) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), 'utf-8');
}

function getKeywords() {
  try { return JSON.parse(fs.readFileSync(KEYWORDS_FILE, 'utf-8') || '[]'); } catch (e) { return []; }
}
function saveKeywords(keywords) {
  fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(keywords, null, 2), 'utf-8');
}

function getSchedulerConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(SCHEDULER_FILE, 'utf-8') || '{}');
    return {
      enabled: cfg.enabled !== undefined ? cfg.enabled : false,
      intervalHours: cfg.intervalHours || 4,
      publishIntervalHours: cfg.publishIntervalHours || cfg.intervalHours || 4,
      generateIntervalHours: cfg.generateIntervalHours || 2,
      lastPublishRun: cfg.lastPublishRun || cfg.lastRun || null,
      lastGenerateRun: cfg.lastGenerateRun || cfg.lastRun || null,
      lastRun: cfg.lastRun || null
    };
  } catch (e) {
    return { enabled: false, intervalHours: 4, publishIntervalHours: 4, generateIntervalHours: 2, lastPublishRun: null, lastGenerateRun: null, lastRun: null };
  }
}
function saveSchedulerConfig(config) {
  fs.writeFileSync(SCHEDULER_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function getWPConfig() {
  try { return JSON.parse(fs.readFileSync(WORDPRESS_FILE, 'utf-8') || '{}'); } catch (e) { return {}; }
}
function saveWPConfig(config) {
  fs.writeFileSync(WORDPRESS_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function normalizeWpUrl(url) {
  if (!url) return '';
  let clean = url.trim().replace(/\/+$/, '');
  clean = clean.replace(/\/(quantri-web|wp-admin|wp-login\.php|wp-json).*$/i, '');
  return clean;
}

/* Helper to convert Markdown to HTML cleanly for WordPress REST API */
function markdownToHtml(md) {
  if (!md) return '';
  let src = md;

  // Clean out any raw script or raw style tags that cause code blocks in WP
  src = src.replace(/<script[\s\S]*?<\/script>/gi, '');
  src = src.replace(/<style[\s\S]*?<\/style>/gi, '');

  let lines = src.split('\n');
  let result = [];
  let inList = false;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (!line) {
      if (inList) { result.push('</ul>'); inList = false; }
      if (inTable) { result.push('</tbody></table>'); inTable = false; }
      continue;
    }

    // Markdown Table Row: | col1 | col2 |
    if (line.startsWith('|') && line.endsWith('|')) {
      if (inList) { result.push('</ul>'); inList = false; }
      if (line.includes('---') || line.includes(':---')) {
        continue;
      }
      const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (!inTable) {
        inTable = true;
        result.push('<table style="width:100%; border-collapse:collapse; margin:20px 0; border:1px solid #cbd5e1;"><thead><tr style="background:#f8fafc;">');
        cells.forEach(cell => {
          result.push(`<th style="padding:10px; border:1px solid #cbd5e1; text-align:left;">${formatInlineMarkdown(cell)}</th>`);
        });
        result.push('</tr></thead><tbody>');
      } else {
        result.push('<tr>');
        cells.forEach(cell => {
          result.push(`<td style="padding:10px; border:1px solid #cbd5e1;">${formatInlineMarkdown(cell)}</td>`);
        });
        result.push('</tr>');
      }
      continue;
    }

    if (inTable) { result.push('</tbody></table>'); inTable = false; }

    // Unordered List: * or -
    if (line.startsWith('* ') || line.startsWith('- ')) {
      if (!inList) { result.push('<ul style="margin:15px 0; padding-left:20px;">'); inList = true; }
      const itemText = line.replace(/^[\*\-]\s+/, '').trim();
      result.push(`<li>${formatInlineMarkdown(itemText)}</li>`);
      continue;
    }

    if (inList) { result.push('</ul>'); inList = false; }

    // Headings
    if (line.startsWith('# ')) {
      result.push(`<h1 style="color:#0f172a; margin-top:25px; margin-bottom:15px;">${formatInlineMarkdown(line.substring(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      result.push(`<h2 style="color:#0f172a; margin-top:25px; margin-bottom:15px; border-bottom:2px solid #0284c7; padding-bottom:6px;">${formatInlineMarkdown(line.substring(3))}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      result.push(`<h3 style="color:#1e293b; margin-top:20px; margin-bottom:10px;">${formatInlineMarkdown(line.substring(4))}</h3>`);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      result.push(`<blockquote style="border-left:4px solid #0284c7; background:#f8fafc; padding:12px 18px; margin:15px 0; border-radius:4px; font-style:italic;">${formatInlineMarkdown(line.substring(2))}</blockquote>`);
      continue;
    }

    // Images (Linked and Plain)
    if (line.startsWith('[![') || line.startsWith('![')) {
      const linkedImgMatch = line.match(/^\[!\[(.*?)\]\((.*?)\)\]\((.*?)\)$/);
      if (linkedImgMatch) {
        const alt = linkedImgMatch[1];
        let imgSrc = linkedImgMatch[2];
        const linkHref = linkedImgMatch[3];
        if (imgSrc.startsWith('/uploads/')) {
          imgSrc = 'https://xulynuochoasen.com/wp-content/uploads/2026/09/' + path.basename(imgSrc);
        }
        result.push(`<p style="text-align:center;"><a href="${linkHref}" target="_blank" rel="noopener noreferrer" title="${alt}"><img src="${imgSrc}" alt="${alt}" title="${alt}" style="max-width:100%; height:auto; border-radius:8px; margin:15px 0; box-shadow:0 4px 15px rgba(0,0,0,0.08); transition:transform 0.2s ease;" /></a></p>`);
        continue;
      }
      const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (imgMatch) {
        let imgSrc = imgMatch[2];
        if (imgSrc.startsWith('/uploads/')) {
          imgSrc = 'https://xulynuochoasen.com/wp-content/uploads/2026/09/' + path.basename(imgSrc);
        }
        result.push(`<p style="text-align:center;"><img src="${imgSrc}" alt="${imgMatch[1]}" title="${imgMatch[1]}" style="max-width:100%; height:auto; border-radius:8px; margin:15px 0;" /></p>`);
        continue;
      }
    }

    // HTML Block (like div)
    if (line.startsWith('<div') || line.startsWith('</div')) {
      result.push(line);
      continue;
    }

    // Standard Paragraph
    result.push(`<p style="margin-bottom:16px; line-height:1.7;">${formatInlineMarkdown(line)}</p>`);
  }

  if (inList) result.push('</ul>');
  if (inTable) result.push('</tbody></table>');

  return result.join('\n');
}

function formatInlineMarkdown(text) {
  if (!text) return '';
  let str = text;
  str = str.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
    const finalUrl = url.startsWith('/uploads/') ? ('https://xulynuochoasen.com/wp-content/uploads/2026/09/' + path.basename(url)) : url;
    return `<img src="${finalUrl}" alt="${alt}" style="max-width:100%; height:auto;" />`;
  });
  str = str.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#0284c7; font-weight:600;">$1</a>');
  str = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  str = str.replace(/\*(.*?)\*/g, '<em>$1</em>');
  return str;
}

async function uploadLocalImageToWordPress(imgUrlOrPath, wpConfig, authHeader, fetchFn) {
  if (!imgUrlOrPath) return null;
  const filename = path.basename(imgUrlOrPath).split('?')[0];
  const localFilePath = path.join(UPLOADS_DIR, filename);

  const VERIFIED_IMAGES_FILE = path.join(DATA_DIR, 'verified_wp_images.json');
  let verifiedImages = [];
  if (fs.existsSync(VERIFIED_IMAGES_FILE)) {
    try {
      verifiedImages = JSON.parse(fs.readFileSync(VERIFIED_IMAGES_FILE, 'utf-8') || '[]');
      const matched = verifiedImages.find(img => img.url && (img.url.includes(filename) || path.basename(img.url) === filename));
      if (matched && matched.id && matched.url) {
        return { id: matched.id, url: matched.url };
      }
    } catch (e) {}
  }

  // If local file exists, upload it to WordPress Media Library
  if (fs.existsSync(localFilePath)) {
    try {
      const cleanUrl = normalizeWpUrl(wpConfig.siteUrl);
      const endpoint = `${cleanUrl}/wp-json/wp/v2/media`;
      const buffer = fs.readFileSync(localFilePath);
      const ext = path.extname(filename).toLowerCase().replace('.', '');
      const mimeType = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');

      console.log(`🚀 [WP Media Auto-Upload] Đang tự động tải ảnh "${filename}" lên WordPress media library...`);
      const res = await fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${filename}"`
        },
        body: buffer
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`✅ [WP Media Auto-Upload] Đã tải ảnh thành công lên WP! ID: ${data.id} | Live URL: ${data.source_url}`);
        const newEntry = {
          id: data.id,
          url: data.source_url,
          title: filename.replace(/\.[^/.]+$/, ''),
          alt: filename.replace(/\.[^/.]+$/, ''),
          slug: filename.replace(/\.[^/.]+$/, '')
        };
        verifiedImages.unshift(newEntry);
        try {
          fs.writeFileSync(VERIFIED_IMAGES_FILE, JSON.stringify(verifiedImages, null, 2), 'utf-8');
        } catch (e) {}
        return { id: data.id, url: data.source_url };
      } else {
        const errText = await res.text();
        console.warn(`⚠️ [WP Media Auto-Upload] Lỗi upload ảnh "${filename}" (Status ${res.status}): ${errText.slice(0, 150)}`);
      }
    } catch (err) {
      console.error(`❌ [WP Media Auto-Upload] Lỗi ngoại lệ khi tải ảnh "${filename}": ${err.message}`);
    }
  }

  return null;
}

/* Helper to Publish to WordPress via REST API */
async function publishToWordPress(postData) {
  const wpConfig = getWPConfig();
  if (!wpConfig.siteUrl || !wpConfig.username || !wpConfig.appPassword) {
    throw new Error('Chưa cấu hình đầy đủ WordPress URL, Username hoặc App Password.');
  }

  let fetchFn = globalThis.fetch;
  try {
    fetchFn = (await import('node-fetch')).default || globalThis.fetch;
  } catch (e) {
    fetchFn = globalThis.fetch;
  }
  const cleanUrl = normalizeWpUrl(wpConfig.siteUrl);
  const endpoint = `${cleanUrl}/wp-json/wp/v2/posts`;

  const authHeader = 'Basic ' + Buffer.from(`${wpConfig.username}:${wpConfig.appPassword.replace(/\s+/g, '')}`).toString('base64');
  const cleanTitle = (postData.title || '').trim();

  // 1. Anti-Duplicate Check: Avoid publishing duplicate titles to WordPress
  try {
    const searchUrl = `${endpoint}?search=${encodeURIComponent(cleanTitle)}&per_page=5`;
    const checkRes = await fetchFn(searchUrl, {
      headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
    });
    if (checkRes.ok) {
      const existingList = await checkRes.json();
      const exactMatch = Array.isArray(existingList) && existingList.find(p => p.title && p.title.rendered.trim().toLowerCase() === cleanTitle.toLowerCase());
      if (exactMatch) {
        console.log(`⚠️ WordPress đã có bài viết mang tiêu đề y hệt (ID ${exactMatch.id}): "${cleanTitle}". Bỏ qua để tránh trùng lặp!`);
        return {
          success: true,
          wpId: exactMatch.id,
          link: exactMatch.link,
          status: exactMatch.status,
          message: `Bài viết đã tồn tại trên WordPress (ID ${exactMatch.id})`
        };
      }
    }
  } catch (checkErr) {
    console.warn('Lỗi kiểm tra trùng lặp trên WordPress:', checkErr.message);
  }

  // 2. Ensure Featured Image & Content Images exist on WordPress
  let mediaId = null;
  let updatedContent = postData.content || '';

  // Process Featured Image
  const targetImg = postData.imageUrl || postData.featured_image;
  if (targetImg) {
    const uploadRes = await uploadLocalImageToWordPress(targetImg, wpConfig, authHeader, fetchFn);
    if (uploadRes) {
      mediaId = uploadRes.id;
    }
  }

  // Scan post content for any /uploads/ images and ensure they are uploaded to WP
  const localImgRegex = /\/uploads\/(media_[a-zA-Z0-9_\.]+\.(?:jpg|jpeg|png|webp))/gi;
  const matches = [...new Set(updatedContent.match(localImgRegex) || [])];
  for (const match of matches) {
    const filename = path.basename(match);
    const uploaded = await uploadLocalImageToWordPress(filename, wpConfig, authHeader, fetchFn);
    if (uploaded && uploaded.url) {
      updatedContent = updatedContent.split(match).join(uploaded.url);
      if (!mediaId) mediaId = uploaded.id;
    }
  }

  const htmlContent = markdownToHtml(updatedContent);

  const payload = {
    title: postData.title,
    content: htmlContent,
    excerpt: postData.metaDescription || '',
    status: wpConfig.defaultStatus || 'publish'
  };

  if (mediaId) {
    payload.featured_media = mediaId;
  }

  const categoryId = postData.categoryId || wpConfig.categoryId;
  if (categoryId) {
    payload.categories = [parseInt(categoryId)];
  }

  const response = await fetchFn(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'Authorization': authHeader,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();
  let responseData = {};
  try {
    responseData = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Máy chủ WordPress trả về lỗi HTML (Status ${response.status}). Kiểm tra lại tường lửa/Cloudflare trên host.`);
  }

  if (!response.ok) {
    throw new Error(responseData.message || `Lỗi WordPress REST API (Status ${response.status})`);
  }

  return {
    success: true,
    wpId: responseData.id,
    link: responseData.link,
    status: responseData.status
  };
}

/* ==========================================================================
   REST APIs: POSTS
   ========================================================================== */
app.get('/api/posts', (req, res) => {
  res.json({ success: true, data: getPosts() });
});

app.get('/api/settings/gemini-key', (req, res) => {
  const GEMINI_FILE = path.join(DATA_DIR, 'gemini.json');
  try {
    const data = JSON.parse(fs.readFileSync(GEMINI_FILE, 'utf-8') || '{}');
    res.json({ success: true, apiKey: data.apiKey || '' });
  } catch (e) {
    res.json({ success: true, apiKey: '' });
  }
});

app.post('/api/settings/gemini-key', (req, res) => {
  const { apiKey } = req.body;
  const GEMINI_FILE = path.join(DATA_DIR, 'gemini.json');
  fs.writeFileSync(GEMINI_FILE, JSON.stringify({ apiKey: apiKey || '' }, null, 2), 'utf-8');
  res.json({ success: true, message: 'Đã lưu Gemini API Key!' });
});

app.post('/api/posts', (req, res) => {
  const { id, title, targetKeyword, content, metaDescription, score, status, date } = req.body;
  const posts = getPosts();

  const newPost = {
    id: id || 'post_' + Date.now(),
    title: title || 'Bài viết mới',
    targetKeyword: targetKeyword || '',
    content: content || '',
    metaDescription: metaDescription || '',
    score: score || 0,
    status: status || 'draft',
    date: date || new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString()
  };

  const existingIndex = posts.findIndex(p => p.id === newPost.id);
  if (existingIndex >= 0) {
    posts[existingIndex] = { ...posts[existingIndex], ...newPost };
  } else {
    posts.unshift(newPost);
  }

  savePosts(posts);
  res.json({ success: true, data: newPost });
});

app.delete('/api/posts/:id', (req, res) => {
  const { id } = req.params;
  let posts = getPosts();
  posts = posts.filter(p => p.id !== id);
  savePosts(posts);
  res.json({ success: true, message: 'Đã xóa bài viết' });
});

app.post('/api/posts/clear-all', (req, res) => {
  const currentPosts = getPosts();
  try {
    fs.writeFileSync(path.join(DATA_DIR, 'posts.backup.json'), JSON.stringify(currentPosts, null, 2), 'utf-8');
  } catch (e) {
    console.error('Backup posts failed:', e);
  }

  savePosts([]);

  const keywords = getKeywords();
  keywords.forEach(k => {
    delete k.generatedPostId;
    delete k.pregenerated;
    delete k.completedAt;
    k.status = 'pending';
  });
  saveKeywords(keywords);

  res.json({ success: true, message: `Đã xóa toàn bộ ${currentPosts.length} bài viết (đã đăng & nháp) thành công!`, clearedCount: currentPosts.length });
});

/* ==========================================================================
   REST APIs: WORDPRESS INTEGRATION
   ========================================================================== */
app.get('/api/wordpress/config', (req, res) => {
  res.json({ success: true, data: getWPConfig() });
});

app.post('/api/wordpress/config', (req, res) => {
  const { siteUrl, username, appPassword, autoPublish, defaultStatus, categoryId, enabled } = req.body;
  const config = getWPConfig();

  config.enabled = enabled !== undefined ? enabled : config.enabled;
  config.siteUrl = siteUrl !== undefined ? siteUrl : config.siteUrl;
  config.username = username !== undefined ? username : config.username;
  config.appPassword = appPassword !== undefined ? appPassword : config.appPassword;
  config.autoPublish = autoPublish !== undefined ? autoPublish : config.autoPublish;
  config.defaultStatus = defaultStatus || config.defaultStatus || 'publish';
  config.categoryId = categoryId !== undefined ? categoryId : config.categoryId;

  saveWPConfig(config);
  res.json({ success: true, data: config });
});

app.get('/api/wordpress/categories', async (req, res) => {
  try {
    const wpConfig = getWPConfig();
    if (!wpConfig.siteUrl) {
      return res.status(400).json({ success: false, message: 'Chưa cấu hình URL WordPress.' });
    }

    let fetchFn = globalThis.fetch;
    try {
      fetchFn = (await import('node-fetch')).default || globalThis.fetch;
    } catch (e) {
      fetchFn = globalThis.fetch;
    }

    const cleanUrl = normalizeWpUrl(wpConfig.siteUrl);
    const endpoint = `${cleanUrl}/wp-json/wp/v2/categories?per_page=100`;

    const response = await fetchFn(endpoint, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (response.ok) {
      const cats = await response.json();
      const formatted = cats.map(c => ({ id: c.id, name: c.name, slug: c.slug }));
      res.json({ success: true, data: formatted });
    } else {
      res.status(400).json({ success: false, message: 'Không thể lấy danh sách Chuyên mục từ WordPress.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi kết nối Chuyên mục WordPress: ' + err.message });
  }
});

app.post('/api/wordpress/test-connection', async (req, res) => {
  try {
    let { siteUrl, username, appPassword } = req.body || {};
    const wpConfig = getWPConfig();

    siteUrl = (siteUrl || wpConfig.siteUrl || '').trim();
    username = (username || wpConfig.username || '').trim();
    appPassword = (appPassword || wpConfig.appPassword || '').trim();

    if (!siteUrl || !username || !appPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đủ URL, Username và App Password trước khi kiểm tra.' });
    }

    // Auto save configuration if valid inputs provided
    wpConfig.siteUrl = siteUrl;
    wpConfig.username = username;
    wpConfig.appPassword = appPassword;
    wpConfig.enabled = true;
    saveWPConfig(wpConfig);

    let fetchFn = globalThis.fetch;
    try {
      fetchFn = (await import('node-fetch')).default || globalThis.fetch;
    } catch (e) {
      fetchFn = globalThis.fetch;
    }

    const cleanUrl = normalizeWpUrl(siteUrl);
    const endpoint = `${cleanUrl}/wp-json/wp/v2/users/me`;
    const authHeader = 'Basic ' + Buffer.from(`${username}:${appPassword.replace(/\s+/g, '')}`).toString('base64');

    const response = await fetchFn(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const data = await response.json();
    if (response.ok) {
      res.json({ success: true, message: `Kết nối thành công! Tài khoản: ${data.name || username}` });
    } else {
      res.status(400).json({ success: false, message: data.message || 'Kết nối thất bại. Kiểm tra lại thông tin.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Không thể kết nối tới website WordPress: ' + err.message });
  }
});

// Publish 1-Click Endpoint
app.post('/api/wordpress/publish', async (req, res) => {
  const { postId, postData } = req.body;
  let targetPost = postData;

  if (postId) {
    const posts = getPosts();
    targetPost = posts.find(p => p.id === postId);
  }

  if (!targetPost) {
    return res.status(400).json({ success: false, message: 'Không tìm thấy bài viết để đăng.' });
  }

  try {
    const wpResult = await publishToWordPress(targetPost);

    // Update local post state
    if (postId) {
      const posts = getPosts();
      const idx = posts.findIndex(p => p.id === postId);
      if (idx >= 0) {
        posts[idx].status = 'published';
        posts[idx].wpPublished = true;
        posts[idx].wpLink = wpResult.link;
        savePosts(posts);
      }
    }

    res.json({ success: true, message: 'Đăng bài lên WordPress thành công!', data: wpResult });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi đăng bài WordPress: ' + err.message });
  }
});

/* ==========================================================================
   REST APIs: KEYWORDS QUEUE & AUTO-SCHEDULER
   ========================================================================== */
app.get('/api/keywords', (req, res) => {
  res.json({ success: true, data: getKeywords() });
});

app.post('/api/keywords', (req, res) => {
  const { keywordList = [], topicCategory = '', defaultTargetUrl = '', allowDuplicate = true } = req.body;
  const keywords = getKeywords();

  const newItems = [];
  keywordList.forEach(item => {
    const trimmed = item.trim();
    if (!trimmed) return;

    // Check if currently PENDING
    const isPending = keywords.some(k => k.keyword.toLowerCase() === trimmed.toLowerCase() && k.status === 'pending');

    if (!isPending) {
      const kwObj = {
        id: 'kw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        keyword: trimmed,
        topic: topicCategory || trimmed,
        status: 'pending',
        createdAt: new Date().toISOString(),
        generatedPostId: null,
        targetUrl: (defaultTargetUrl || '').trim()
      };
      keywords.push(kwObj);
      newItems.push(kwObj);
    }
  });

  saveKeywords(keywords);
  res.json({ success: true, addedCount: newItems.length, data: keywords });
});

app.post('/api/keywords/update-target-url', (req, res) => {
  const { id, targetUrl } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'Thiếu ID từ khóa.' });

  const keywords = getKeywords();
  const item = keywords.find(k => k.id === id);
  if (!item) return res.status(404).json({ success: false, message: 'Không tìm thấy từ khóa.' });

  const cleanUrl = (targetUrl || '').trim();
  item.targetUrl = cleanUrl;
  saveKeywords(keywords);

  // Sync into existing generated post if exists
  if (item.generatedPostId) {
    const posts = getPosts();
    const post = posts.find(p => p.id === item.generatedPostId);
    if (post) {
      post.targetProductUrl = cleanUrl;
      if (cleanUrl) {
        if (/👉 \*\*Sản Phẩm Đúng Chuyên Mục:\*\* \[.*?\]\(.*?\)/gi.test(post.content)) {
          post.content = post.content.replace(
            /👉 \*\*Sản Phẩm Đúng Chuyên Mục:\*\* \[.*?\]\(.*?\)/gi,
            `👉 **Sản Phẩm Đúng Chuyên Mục:** [Xem Sản Phẩm Tương Ứng](${cleanUrl})`
          );
        } else {
          post.content += `\n\n👉 **Sản Phẩm Đúng Chuyên Mục:** [Xem Sản Phẩm Tương Ứng](${cleanUrl}) - *Giải pháp kỹ thuật chuyên sâu đạt chuẩn Bộ Y Tế.*`;
        }
      }
      savePosts(posts);
    }
  }

  res.json({ success: true, message: `Đã lưu link đích SEO cho từ khóa "${item.keyword}"!`, data: item });
});

app.delete('/api/keywords/:id', (req, res) => {
  const { id } = req.params;
  let keywords = getKeywords();
  keywords = keywords.filter(k => k.id !== id);
  saveKeywords(keywords);
  res.json({ success: true, message: 'Đã xóa từ khóa khỏi hàng chờ' });
});

app.post('/api/keywords/move-top', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'Thiếu ID từ khóa.' });
  let keywords = getKeywords();
  const idx = keywords.findIndex(k => k.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Không tìm thấy từ khóa.' });
  const [item] = keywords.splice(idx, 1);
  keywords.unshift(item);
  saveKeywords(keywords);
  res.json({ success: true, message: `Đã đưa từ khóa "${item.keyword}" lên vị trí số 1 trong hàng chờ đăng!`, data: item });
});

app.get('/api/scheduler/config', (req, res) => {
  res.json({ success: true, data: getSchedulerConfig() });
});

app.get('/api/scheduler/status', (req, res) => {
  const config = getSchedulerConfig();
  const wpConfig = getWPConfig();
  const keywords = getKeywords();
  const posts = getPosts();

  const pendingKeywords = keywords.filter(k => k.status === 'pending');
  const pregeneratedCount = pendingKeywords.filter(k => k.generatedPostId).length;
  const now = Date.now();

  // 1. Publish countdown calculation
  const pubIntervalHours = parseFloat(config.publishIntervalHours || config.intervalHours || 4);
  const pubIntervalMs = pubIntervalHours * 3600000;
  const lastPubTime = config.lastPublishRun ? new Date(config.lastPublishRun).getTime() : 0;
  const nextPubTimeMs = lastPubTime ? lastPubTime + pubIntervalMs : now;
  const publishRemainingSec = Math.max(0, Math.round((nextPubTimeMs - now) / 1000));

  // Next item to publish (first pending keyword)
  const nextPublishItem = pendingKeywords.length > 0 ? pendingKeywords[0] : null;
  let nextPublishTitle = '';
  if (nextPublishItem) {
    if (nextPublishItem.generatedPostId) {
      const p = posts.find(post => post.id === nextPublishItem.generatedPostId);
      nextPublishTitle = p ? p.title : nextPublishItem.keyword;
    } else {
      nextPublishTitle = nextPublishItem.topic || nextPublishItem.keyword;
    }
  }

  // 2. Generate countdown & Queue Readiness calculation
  const ungeneratedKeywords = pendingKeywords.filter(k => !k.generatedPostId);
  const ungeneratedCount = ungeneratedKeywords.length;
  const allPregenerated = pendingKeywords.length > 0 && ungeneratedCount === 0;

  const genIntervalHours = parseFloat(config.generateIntervalHours || 2);
  const genIntervalMs = genIntervalHours * 3600000;
  const lastGenTime = config.lastGenerateRun ? new Date(config.lastGenerateRun).getTime() : 0;
  const nextGenTimeMs = lastGenTime ? lastGenTime + genIntervalMs : now;
  const generateRemainingSec = Math.max(0, Math.round((nextGenTimeMs - now) / 1000));

  // Next item to generate (first pending keyword without generated post)
  let nextGenObj = ungeneratedKeywords.length > 0 ? ungeneratedKeywords[0] : null;

  const timeline = pendingKeywords.map((item, idx) => {
    const itemRemainingSec = publishRemainingSec + (idx * pubIntervalMs / 1000);
    const estTime = new Date(now + itemRemainingSec * 1000).toISOString();
    const targetPost = item.generatedPostId ? posts.find(p => p.id === item.generatedPostId) : null;
    return {
      order: idx + 1,
      id: item.id,
      keyword: item.keyword,
      topic: item.topic || item.keyword,
      targetUrl: item.targetUrl || '',
      generatedPostId: item.generatedPostId || null,
      title: targetPost ? targetPost.title : (item.topic || item.keyword),
      hasPost: !!item.generatedPostId,
      score: targetPost ? (targetPost.score || 0) : null,
      wordCount: targetPost && targetPost.content ? targetPost.content.trim().split(/\s+/).filter(Boolean).length : 0,
      imageUrl: targetPost ? targetPost.imageUrl : null,
      remainingSec: Math.round(itemRemainingSec),
      estimatedPublishTime: estTime
    };
  });

  res.json({
    success: true,
    data: {
      enabled: !!config.enabled,
      publishIntervalHours: pubIntervalHours,
      generateIntervalHours: genIntervalHours,
      lastPublishRun: config.lastPublishRun,
      nextPublishTime: new Date(nextPubTimeMs).toISOString(),
      publishRemainingSec,
      lastGenerateRun: config.lastGenerateRun,
      nextGenerateTime: new Date(nextGenTimeMs).toISOString(),
      generateRemainingSec: allPregenerated ? 0 : generateRemainingSec,
      allPregenerated,
      ungeneratedCount,
      nextPublishItem: nextPublishItem ? {
        id: nextPublishItem.id,
        keyword: nextPublishItem.keyword,
        title: nextPublishTitle,
        hasPost: !!nextPublishItem.generatedPostId
      } : null,
      nextGenerateItem: allPregenerated ? {
        allReady: true,
        keyword: 'Tất cả bài trong hàng chờ đã soạn xong 100%',
        topic: 'Tất cả bài trong hàng chờ đã soạn xong 100%'
      } : (nextGenObj ? {
        id: nextGenObj.id,
        keyword: nextGenObj.keyword,
        topic: nextGenObj.topic || nextGenObj.keyword,
        isRotating: false
      } : null),
      pendingCount: pendingKeywords.length,
      pregeneratedCount,
      timeline,
      wpStatus: {
        enabled: !!wpConfig.enabled,
        autoPublish: !!wpConfig.autoPublish,
        defaultStatus: wpConfig.defaultStatus || 'publish',
        siteUrl: wpConfig.siteUrl || ''
      }
    }
  });
});

app.post('/api/scheduler/config', (req, res) => {
  const { enabled, intervalHours, publishIntervalHours, generateIntervalHours, defaultStatus } = req.body;
  const config = getSchedulerConfig();
  if (enabled !== undefined) config.enabled = !!enabled;
  if (publishIntervalHours !== undefined) {
    config.publishIntervalHours = parseFloat(publishIntervalHours) || 4;
    config.intervalHours = config.publishIntervalHours;
  } else if (intervalHours !== undefined) {
    config.publishIntervalHours = parseFloat(intervalHours) || 4;
    config.intervalHours = config.publishIntervalHours;
  }
  if (generateIntervalHours !== undefined) {
    config.generateIntervalHours = parseFloat(generateIntervalHours) || 2;
  }
  saveSchedulerConfig(config);

  if (defaultStatus) {
    const wpConfig = getWPConfig();
    wpConfig.defaultStatus = defaultStatus;
    saveWPConfig(wpConfig);
  }

  res.json({ success: true, data: config });
});

async function pregenerateNextKeywordInQueue(apiKey = '') {
  let keywords = getKeywords();
  if (!keywords || keywords.length === 0) {
    return { success: false, message: 'Chưa có từ khóa nào trong danh sách. Vui lòng thêm từ khóa!' };
  }

  let posts = getPosts();
  let nextItem = keywords.find(k => k.status === 'pending' && !k.generatedPostId);
  let isRotatingCycle = false;

  // Cyclic rotation: if all keywords already have posts, rotate to the next keyword in cyclic order!
  if (!nextItem) {
    isRotatingCycle = true;
    const masterKeywords = [];
    const seenKw = new Set();
    keywords.forEach(k => {
      const lower = k.keyword.toLowerCase().trim();
      if (!seenKw.has(lower)) {
        seenKw.add(lower);
        masterKeywords.push(k);
      }
    });

    const latestPost = posts[0];
    let nextIdx = 0;
    if (latestPost && latestPost.targetKeyword) {
      const foundIdx = masterKeywords.findIndex(k => k.keyword.toLowerCase() === latestPost.targetKeyword.toLowerCase());
      if (foundIdx !== -1) {
        nextIdx = (foundIdx + 1) % masterKeywords.length;
      }
    }
    const templateKw = masterKeywords[nextIdx] || masterKeywords[0];

    nextItem = {
      id: 'kw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      keyword: templateKw.keyword,
      topic: templateKw.topic || templateKw.keyword,
      status: 'pending',
      createdAt: new Date().toISOString(),
      targetUrl: templateKw.targetUrl || '',
      generatedPostId: null,
      pregenerated: false,
      isRotated: true
    };
    keywords.unshift(nextItem);
  }

  const generated = await generateContentForKeyword(nextItem.topic || nextItem.keyword, nextItem.keyword, apiKey, nextItem.targetUrl);
  const seoResult = calculateSeoScore(generated.title, generated.content, nextItem.keyword, generated.metaDescription);

  const newPost = {
    id: 'post_auto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    title: generated.title,
    targetKeyword: nextItem.keyword,
    content: generated.content,
    metaDescription: generated.metaDescription,
    score: seoResult.score,
    imageUrl: generated.imageUrl || '',
    secondaryImageUrl: generated.secondaryImageUrl || '',
    targetProductUrl: (nextItem.targetUrl || '').trim(),
    status: 'ready',
    date: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString(),
    isAutoGenerated: true
  };

  posts.unshift(newPost);
  savePosts(posts);

  nextItem.generatedPostId = newPost.id;
  nextItem.pregenerated = true;
  nextItem.status = 'pending';
  saveKeywords(keywords);

  const config = getSchedulerConfig();
  config.lastGenerateRun = new Date().toISOString();
  saveSchedulerConfig(config);

  const modeMsg = isRotatingCycle ? 'xoay vòng tuần hoàn' : 'tự động';
  return { 
    success: true, 
    message: `Đã ${modeMsg} soạn xong bài cho "${nextItem.keyword}" (Điểm SEO: ${seoResult.score}/100)!`, 
    post: newPost, 
    keyword: nextItem 
  };
}

app.post('/api/keywords/pregenerate-next', async (req, res) => {
  try {
    const result = await pregenerateNextKeywordInQueue();
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi khi soạn bài tiếp theo: ' + err.message });
  }
});

app.post('/api/keywords/pregenerate-all', async (req, res) => {
  const keywords = getKeywords();
  const pendingItems = keywords.filter(k => k.status === 'pending');
  let count = 0;

  for (const item of pendingItems) {
    let posts = getPosts();
    let existingPost = item.generatedPostId ? posts.find(p => p.id === item.generatedPostId) : null;

    if (!existingPost) {
      try {
        const generated = await generateContentForKeyword(item.topic || item.keyword, item.keyword, '', item.targetUrl);
        const seoResult = calculateSeoScore(generated.title, generated.content, item.keyword, generated.metaDescription);

        const newPost = {
          id: 'post_auto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          title: generated.title,
          targetKeyword: item.keyword,
          content: generated.content,
          metaDescription: generated.metaDescription,
          score: seoResult.score,
          imageUrl: generated.imageUrl || '',
          secondaryImageUrl: generated.secondaryImageUrl || '',
          targetProductUrl: (item.targetUrl || '').trim(),
          status: 'ready',
          date: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString(),
          isAutoGenerated: true
        };

        posts.unshift(newPost);
        savePosts(posts);

        item.generatedPostId = newPost.id;
        item.pregenerated = true;
        count++;
      } catch (err) {
        console.error('Error pre-generating post for:', item.keyword, err);
      }
    }
  }

  saveKeywords(keywords);
  res.json({ success: true, message: `Đã tự động soạn sẵn ${count} bài viết vào hàng chờ!`, pregeneratedCount: count });
});

app.post('/api/keywords/pregenerate/:id', async (req, res) => {
  const { id } = req.params;
  const keywords = getKeywords();
  const item = keywords.find(k => k.id === id);

  if (!item) return res.status(404).json({ success: false, message: 'Không tìm thấy từ khóa.' });

  const posts = getPosts();
  let existingPost = item.generatedPostId ? posts.find(p => p.id === item.generatedPostId) : null;

  if (!existingPost) {
    const generated = await generateContentForKeyword(item.topic || item.keyword, item.keyword, '', item.targetUrl);
    const seoResult = calculateSeoScore(generated.title, generated.content, item.keyword, generated.metaDescription);

    existingPost = {
      id: 'post_auto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: generated.title,
      targetKeyword: item.keyword,
      content: generated.content,
      metaDescription: generated.metaDescription,
      score: seoResult.score,
      imageUrl: generated.imageUrl || '',
      secondaryImageUrl: generated.secondaryImageUrl || '',
      targetProductUrl: (item.targetUrl || '').trim(),
      status: 'ready',
      date: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
      isAutoGenerated: true
    };

    posts.unshift(existingPost);
    savePosts(posts);

    item.generatedPostId = existingPost.id;
    item.pregenerated = true;
    saveKeywords(keywords);
  }

  res.json({ success: true, message: `Đã soạn xong bài chuẩn bị đăng cho từ khóa "${item.keyword}"!`, post: existingPost });
});

app.post('/api/scheduler/run-next', async (req, res) => {
  const result = await processNextKeywordInQueue();
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

/* Core Auto-Writer & Auto-Publisher Engine */
async function processNextKeywordInQueue(apiKey = '') {
  let keywords = getKeywords();
  let nextItem = keywords.find(k => k.status === 'pending');

  if (!nextItem) {
    const completedKeywords = keywords.filter(k => k.status === 'completed');
    if (completedKeywords.length > 0) {
      keywords.forEach(k => {
        k.status = 'pending';
        k.generatedPostId = null;
        k.pregenerated = false;
      });
      saveKeywords(keywords);
      nextItem = keywords[0];
    } else {
      return { success: false, message: 'Tất cả từ khóa trong hàng chờ đã được đăng xong! Vui lòng thêm từ khóa mới.' };
    }
  }

  nextItem.status = 'processing';
  saveKeywords(keywords);

  try {
    const posts = getPosts();
    let targetPost = nextItem.generatedPostId ? posts.find(p => p.id === nextItem.generatedPostId) : null;

    if (!targetPost) {
      const generated = await generateContentForKeyword(nextItem.topic || nextItem.keyword, nextItem.keyword, apiKey, nextItem.targetUrl);
      const seoResult = calculateSeoScore(generated.title, generated.content, nextItem.keyword, generated.metaDescription);

      targetPost = {
        id: 'post_auto_' + Date.now(),
        title: generated.title,
        targetKeyword: nextItem.keyword,
        content: generated.content,
        metaDescription: generated.metaDescription,
        score: seoResult.score,
        imageUrl: generated.imageUrl || '',
        secondaryImageUrl: generated.secondaryImageUrl || '',
        targetProductUrl: (nextItem.targetUrl || '').trim(),
        status: 'ready',
        date: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
        isAutoGenerated: true
      };

      posts.unshift(targetPost);
      savePosts(posts);

      nextItem.generatedPostId = targetPost.id;
    }

    // Auto-Publish to WordPress if enabled
    const wpConfig = getWPConfig();
    let wpMessage = '';
    if (wpConfig.enabled && wpConfig.autoPublish) {
      try {
        const wpResult = await publishToWordPress(targetPost);
        targetPost.status = 'published';
        targetPost.wpPublished = true;
        targetPost.wpLink = wpResult.link;
        savePosts(posts);
        wpMessage = ` 🚀 Đã đăng bài lên WordPress: ${wpResult.link}`;
      } catch (wpErr) {
        console.error('WP Auto-Publish Error:', wpErr);
        wpMessage = ` (Lỗi tự động đăng WP: ${wpErr.message})`;
      }
    }

    // Update Keyword item status
    nextItem.status = 'completed';
    nextItem.completedAt = new Date().toISOString();
    saveKeywords(keywords);

    // Update scheduler last run
    const config = getSchedulerConfig();
    config.lastPublishRun = new Date().toISOString();
    config.lastRun = config.lastPublishRun;
    saveSchedulerConfig(config);

    return {
      success: true,
      message: `Đã xử lý và xuất bản xong bài cho từ khóa "${nextItem.keyword}"!${wpMessage}`,
      post: targetPost,
      keyword: nextItem
    };

  } catch (err) {
    nextItem.status = 'pending';
    saveKeywords(keywords);
    return { success: false, message: 'Lỗi khi xuất bản bài viết tự động: ' + err.message };
  }
}


async function generateContentForKeyword(topic, keyword, customApiKey = '', customTargetUrl = '') {
  let apiKey = customApiKey;
  const GEMINI_FILE = path.join(DATA_DIR, 'gemini.json');

  if (!apiKey && fs.existsSync(GEMINI_FILE)) {
    try {
      const gData = JSON.parse(fs.readFileSync(GEMINI_FILE, 'utf-8') || '{}');
      apiKey = gData.apiKey || '';
    } catch (e) {}
  }

  // Get dynamic rotated non-repeating images
  const recentUsedUrls = getRecentUsedImages();
  const { img1, img2 } = getTwoDistinctRotatedImages(keyword, recentUsedUrls);

  if (apiKey) {
    try {
      let fetchFn = globalThis.fetch;
      try {
        fetchFn = (await import('node-fetch')).default || globalThis.fetch;
      } catch (e) {
        fetchFn = globalThis.fetch;
      }

      const avoidance = getAvoidanceContextForKeyword(keyword);
      let avoidanceNotice = '';
      if (avoidance.count > 0) {
        avoidanceNotice = `\n11. CHỐNG TRÙNG LẶP NỘI DUNG & ĂN THỊT TỪ KHÓA (WEBSITE ĐÃ CÓ ${avoidance.count} BÀI LIÊN QUAN):
Trên trang https://xulynuochoasen.com/blog-chia-se/ đã có các bài viết sau:
${avoidance.titles.slice(0, 15).map(t => `- "${t}"`).join('\n')}
YÊU CẦU BẮT BUỘC: Tiêu đề và góc độ nội dung mới TUYỆT ĐỐI KHÔNG ĐƯỢC trùng lặp ý tưởng hay câu từ với các bài trên. Phải khai thác góc nhìn mới mẻ, độc quyền và chuyên sâu.`;
      }

      const prompt = `Bạn là một Chuyên gia viết bài Content SEO đỉnh cao. 
Hãy viết một bài viết chuẩn SEO 100% bằng tiếng Việt cho chủ đề: "${topic}".

BẮT BUỘC TUÂN THỦ CÁC QUY TẮC TỐI ƯU SEO VÀ TỪ KHÓA CHÍNH:
1. Từ khóa chính bắt buộc: "${keyword}"
2. ĐỘ DÀI BÀI VIẾT: Bắt buộc dài trên 1050 từ (từ 1100 đến 1400 từ) để đạt điểm SEO tối đa (> 90 - 100 điểm).
3. TIÊU ĐỀ H1: Phải chứa CHÍNH XÁC từ khóa "${keyword}", độ dài tiêu đề từ 50 đến 65 ký tự.
4. META DESCRIPTION: Phải chứa CHÍNH XÁC từ khóa "${keyword}", độ dài 140 đến 158 ký tự.
5. ĐOẠN MỞ BÀI (SAPO): Phải chèn từ khóa "${keyword}" ngay trong 100 từ đầu tiên.
6. MẬT ĐỘ TỪ KHÓA: Từ khóa "${keyword}" phải xuất hiện rải rác tự nhiên từ 8 đến 12 lần trong toàn bộ thân bài (mật độ 1.5% - 2.5%).
7. NỘI DUNG THỰC TẾ: Bài viết tập trung 100% vào kiến thức, giải pháp thực tế của chủ đề "${topic}". KHÔNG viết các câu giải thích quy tắc SEO hay lý thuyết SEO trong bài.
8. CẤU TRÚC THẺ: Có ít nhất 3-5 thẻ H2, các thẻ H3 phụ, bảng biểu kỹ thuật và phần FAQ 3 câu hỏi liên quan.
9. HÌNH ẢNH MINH HỌA:
   - Dưới thẻ H2 đầu tiên, chèn ảnh: ![Hình ảnh mô tả ${keyword}](${img1})
   - Ở phần thân bài kỹ thuật, chèn ảnh: ![Cấu tạo chi tiết ${keyword}](${img2})
${customTargetUrl ? `10. LINK ĐÍCH SẢN PHẨM: Cuối bài phải chèn liên kết điều hướng sản phẩm: 👉 **Sản Phẩm Đúng Chuyên Mục:** [Xem Sản Phẩm Tương Ứng](${customTargetUrl}) - *Giải pháp kỹ thuật chuyên sâu đạt chuẩn Bộ Y Tế.*` : ''}${avoidanceNotice}

Trả về JSON thuần túy (không bọc markdown block):
{
  "title": "...",
  "metaDescription": "...",
  "content": "...(Nội dung Markdown đầy đủ với #, ##, ###, bảng biểu và hình ảnh)..."
}`;

      const response = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        let textResult = data.candidates[0].content.parts[0].text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
        const parsed = JSON.parse(textResult);

        // Auto-Trim Title to optimal 50-65 chars if needed
        if (parsed.title && parsed.title.length > 65) {
          parsed.title = parsed.title.substring(0, 62).trim() + '...';
        }
        // Auto-Trim Meta Description to optimal 140-158 chars if needed
        if (parsed.metaDescription && parsed.metaDescription.length > 158) {
          parsed.metaDescription = parsed.metaDescription.substring(0, 155).trim() + '...';
        }

        // Anti-cannibalization check against live blog posts
        const dupCheck = checkDuplicateTitle(parsed.title);
        if (dupCheck.isDuplicate) {
          console.log(`[Anti-Cannibalization] Tiêu đề Gemini "${parsed.title}" bị trùng ${Math.round(dupCheck.similarity * 100)}% với bài live: "${dupCheck.matchedLiveTitle}". Chuyển sang Smart SEO Engine để bảo đảm tính độc nhất 100%!`);
          return generateSmartSeoTemplate(topic, keyword, 'Thuyết phục & Chuẩn SEO', customTargetUrl);
        }

        const targetBrandLink = customTargetUrl || 'https://xulynuochoasen.com';
        parsed.imageUrl = img1;
        parsed.secondaryImageUrl = img2;
        parsed.targetProductUrl = targetBrandLink;

        // Auto-wrap any plain markdown images with target brand link
        if (parsed.content) {
          parsed.content = parsed.content.replace(/(?<!\[)!\[(.*?)\]\((.*?)\)(?!\))/g, `[![$1]($2)](${targetBrandLink})`);
        }

        // Inject images if missing from content
        if (parsed.content && !parsed.content.includes(img1)) {
          const h2Idx = parsed.content.indexOf('## ');
          if (h2Idx !== -1) {
            const nextLine = parsed.content.indexOf('\n', h2Idx);
            parsed.content = parsed.content.slice(0, nextLine + 1) + `\n[![Hệ thống ${keyword}](${img1})](${targetBrandLink})\n` + parsed.content.slice(nextLine + 1);
          } else {
            parsed.content = `[![Hệ thống ${keyword}](${img1})](${targetBrandLink})\n\n` + parsed.content;
          }
        }
        if (parsed.content && !parsed.content.includes(img2)) {
          parsed.content += `\n\n[![Chi tiết cấu tạo ${keyword}](${img2})](${targetBrandLink})\n\n`;
        }

        if (customTargetUrl && parsed.content && !parsed.content.includes(customTargetUrl)) {
          parsed.content += `\n\n👉 **Sản Phẩm Đúng Chuyên Mục:** [Xem Sản Phẩm Tương Ứng](${customTargetUrl}) - *Giải pháp kỹ thuật chuyên sâu đạt chuẩn Bộ Y Tế.*`;
        }

        // Quality Gate: verify SEO score > 90
        const testSeo = calculateSeoScore(parsed.title, parsed.content, keyword, parsed.metaDescription);
        if (testSeo.score >= 90) {
          return parsed;
        } else {
          console.log(`[SEO Quality Gate] Bài viết từ Gemini chỉ đạt ${testSeo.score} điểm (< 90). Tự động nâng cấp sang Smart SEO Engine để đạt điểm SEO tối đa > 90 (100 điểm tuyệt đối)!`);
        }
      }
    } catch (e) {
      console.error('Gemini API Error in auto worker:', e);
    }
  }

  return generateSmartSeoTemplate(topic, keyword, 'Thuyết phục & Chuẩn SEO', customTargetUrl);
}

/* ==========================================================================
   SEO ANALYSIS ENGINE
   ========================================================================== */
app.post('/api/analyze-seo', (req, res) => {
  const { title = '', content = '', targetKeyword = '', keyword = '', metaDescription = '' } = req.body;
  const kw = targetKeyword || keyword || '';
  const result = calculateSeoScore(title, content, kw, metaDescription);
  res.json({ success: true, ...result });
});

function calculateSeoScore(title = '', content = '', targetKw = '', metaDescription = '') {
  const keyword = targetKw.trim().toLowerCase();
  const rawText = content.replace(/<[^>]*>?/gm, '');
  const words = rawText.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  let totalScore = 0;
  const checks = [];

  if (keyword && title.toLowerCase().includes(keyword)) {
    totalScore += 15;
    checks.push({ pass: true, label: 'Tiêu đề có chứa từ khóa chính', weight: 15 });
  } else {
    checks.push({ pass: false, label: 'Tiêu đề CHƯA chứa từ khóa chính', weight: 15, tip: 'Thêm từ khóa vào tiêu đề.' });
  }

  const titleLen = title.trim().length;
  if (titleLen >= 45 && titleLen <= 70) {
    totalScore += 10;
    checks.push({ pass: true, label: `Độ dài tiêu đề chuẩn (${titleLen} ký tự)`, weight: 10 });
  } else {
    checks.push({ pass: false, label: `Độ dài tiêu đề (${titleLen} ký tự, nên từ 50-65 ký tự)`, weight: 10 });
  }

  const metaLen = metaDescription.trim().length;
  if (keyword && metaDescription.toLowerCase().includes(keyword)) {
    totalScore += 15;
    checks.push({ pass: true, label: 'Meta Description chứa từ khóa chính', weight: 15 });
  } else {
    checks.push({ pass: false, label: 'Meta Description CHƯA chứa từ khóa', weight: 15 });
  }

  if (metaLen >= 130 && metaLen <= 165) {
    totalScore += 10;
    checks.push({ pass: true, label: `Độ dài Meta Description chuẩn (${metaLen} ký tự)`, weight: 10 });
  } else {
    checks.push({ pass: false, label: `Độ dài Meta Description (${metaLen} ký tự, nên từ 140-160 ký tự)`, weight: 10 });
  }

  if (wordCount >= 1000) {
    totalScore += 15;
    checks.push({ pass: true, label: `Độ dài bài viết tuyệt vời (${wordCount} từ)`, weight: 15 });
  } else if (wordCount >= 600) {
    totalScore += 10;
    checks.push({ pass: true, label: `Độ dài bài viết vừa phải (${wordCount} từ)`, weight: 10 });
  } else {
    checks.push({ pass: false, label: `Bài viết khá ngắn (${wordCount} từ)`, weight: 15 });
  }

  // 6. Keyword Density Check (Optimal 0.8% - 3.5%) (Max 15 pts)
  let kwCount = 0;
  if (keyword) {
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = rawText.match(regex);
    kwCount = matches ? matches.length : 0;
  }
  const density = wordCount > 0 ? ((kwCount * keyword.split(' ').length / wordCount) * 100).toFixed(2) : 0;
  const densityVal = parseFloat(density);

  if (densityVal >= 0.8 && densityVal <= 5.0) {
    totalScore += 15;
    checks.push({ pass: true, label: `Mật độ từ khóa chuẩn (${density}% - ${kwCount} lần)`, weight: 15 });
  } else if (densityVal > 5.0) {
    checks.push({ pass: false, label: `Mật độ từ khóa (${density}% - ${kwCount} lần, khuyên dùng 1-2.5%)`, weight: 15 });
  } else {
    checks.push({ pass: false, label: `Mật độ từ khóa (${density}% - ${kwCount} lần, khuyên dùng 1-2.5%)`, weight: 15 });
  }

  const h2Matches = (content.match(/<h2[^>]*>/gi) || content.match(/^##\s/gm) || []).length;
  const h3Matches = (content.match(/<h3[^>]*>/gi) || content.match(/^###\s/gm) || []).length;

  if (h2Matches >= 2) {
    totalScore += 10;
    checks.push({ pass: true, label: `Cấu trúc thẻ tiêu đề tốt (${h2Matches} H2, ${h3Matches} H3)`, weight: 10 });
  } else {
    checks.push({ pass: false, label: `Thiếu thẻ H2 phụ (hiện có ${h2Matches} H2)`, weight: 10 });
  }

  const first100Words = words.slice(0, 100).join(' ').toLowerCase();
  if (keyword && first100Words.includes(keyword)) {
    totalScore += 10;
    checks.push({ pass: true, label: 'Từ khóa xuất hiện trong 100 từ đầu tiên', weight: 10 });
  } else {
    checks.push({ pass: false, label: 'Chưa có từ khóa ở 100 từ đầu mở bài', weight: 10 });
  }

  return {
    score: Math.min(100, totalScore),
    stats: { wordCount, keywordMatches: kwCount, keywordDensity: density + '%', titleLength: titleLen, metaLength: metaLen, h2Count: h2Matches, h3Count: h3Matches },
    checks
  };
}

app.post('/api/generate-ai', async (req, res) => {
  const { topic, keyword, tone = 'Thuyết phục & Chuẩn SEO', apiKey = '', addToQueue = true, targetUrl = '' } = req.body;
  if (!topic || !keyword) return res.status(400).json({ success: false, message: 'Vui lòng nhập chủ đề và từ khóa.' });
  
  try {
    const keywords = getKeywords();
    const existingKw = keywords.find(k => k.keyword.toLowerCase() === keyword.toLowerCase().trim() && k.status === 'pending');
    const finalTargetUrl = (targetUrl || (existingKw ? existingKw.targetUrl : '') || '').trim();

    const result = await generateContentForKeyword(topic, keyword, apiKey, finalTargetUrl);
    let savedPost = null;
    let keywordItem = null;

    if (addToQueue !== false) {
      const posts = getPosts();
      const seoResult = calculateSeoScore(result.title, result.content, keyword, result.metaDescription);

      savedPost = {
        id: 'post_auto_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        title: result.title,
        targetKeyword: keyword,
        content: result.content,
        metaDescription: result.metaDescription,
        score: seoResult.score,
        imageUrl: result.imageUrl || '',
        secondaryImageUrl: result.secondaryImageUrl || '',
        targetProductUrl: finalTargetUrl,
        status: 'ready',
        date: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
        isAutoGenerated: true
      };

      posts.unshift(savedPost);
      savePosts(posts);

      let kw = existingKw;
      if (!kw) {
        kw = {
          id: 'kw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          keyword: keyword.trim(),
          topic: topic.trim(),
          status: 'pending',
          createdAt: new Date().toISOString(),
          generatedPostId: savedPost.id,
          pregenerated: true,
          targetUrl: finalTargetUrl
        };
        keywords.push(kw);
      } else {
        kw.generatedPostId = savedPost.id;
        kw.pregenerated = true;
        if (finalTargetUrl) kw.targetUrl = finalTargetUrl;
      }
      saveKeywords(keywords);
      keywordItem = kw;
    }

    const pendingCount = getKeywords().filter(k => k.status === 'pending').length;

    res.json({ 
      success: true, 
      data: result, 
      post: savedPost,
      keyword: keywordItem,
      pendingCount,
      source: apiKey ? 'Gemini AI' : 'SEO Built-in Engine' 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi sinh bài viết: ' + err.message });
  }
});



/* Cron Endpoint for External Callers (e.g. cron-job.org or UptimeRobot) */
app.all('/api/cron/trigger', async (req, res) => {
  console.log('⚡ External Cron Webhook triggered!');
  const result = await processNextKeywordInQueue();
  res.json({ success: true, timestamp: new Date().toISOString(), result });
});

/* Background Cron Worker */
async function checkAndRunAutoScheduler() {
  const config = getSchedulerConfig();
  if (!config.enabled) return;

  const now = Date.now();
  const wpConfig = getWPConfig();

  // 1. Check Auto-Generation cycle
  const genIntervalHours = parseFloat(config.generateIntervalHours || 2);
  const genIntervalMs = genIntervalHours * 3600000;
  const lastGenTime = config.lastGenerateRun ? new Date(config.lastGenerateRun).getTime() : 0;
  if (!lastGenTime || (now - lastGenTime) >= genIntervalMs) {
    const keywords = getKeywords();
    const hasUngenerated = keywords.some(k => k.status === 'pending' && !k.generatedPostId);
    if (hasUngenerated) {
      console.log('🤖 Auto-Scheduler: Auto-Generating content for next pending keyword...');
      try {
        const genRes = await pregenerateNextKeywordInQueue();
        console.log('🤖 Auto-Generation result:', genRes.message);
      } catch (err) {
        console.error('Error in auto-generation cycle:', err.message);
      }
    }
  }

  // 2. Check Auto-Publishing cycle
  const pubIntervalHours = parseFloat(config.publishIntervalHours || config.intervalHours || 4);
  const pubIntervalMs = pubIntervalHours * 3600000;
  const lastPubTime = config.lastPublishRun ? new Date(config.lastPublishRun).getTime() : (config.lastRun ? new Date(config.lastRun).getTime() : 0);
  if (!lastPubTime || (now - lastPubTime) >= pubIntervalMs) {
    const keywords = getKeywords();
    const hasPending = keywords.some(k => k.status === 'pending');
    if (hasPending && wpConfig.enabled && wpConfig.autoPublish) {
      console.log('🤖 Auto-Scheduler: Auto-Publishing next keyword to WordPress...');
      try {
        const res = await processNextKeywordInQueue();
        console.log('🤖 Auto-Scheduler result:', res.message);
      } catch (err) {
        console.error('Error in auto-publishing cycle:', err.message);
      }
    }
  }
}

// Execute immediately when server starts
setTimeout(() => {
  checkAndRunAutoScheduler().catch(err => console.error('Error in initial auto-scheduler check:', err));
}, 3000);

// Continuous background interval loop (every 1 minute)
setInterval(checkAndRunAutoScheduler, 60000);


app.listen(PORT, () => {
  console.log(`🚀 Daily SEO Tool for Tris is running on http://localhost:${PORT}`);
});
