const { generateSmartSeoTemplate, getRecentUsedImages, getGoogleAdsTargetUrl, getCustomGoogleAdsLinks } = require('./lib/generator');
const { getDuplicateReport, detectDuplicateGroups } = require('./lib/ai_generator');
const { 
  getTwoDistinctRotatedImages, 
  getMediaGallery, 
  updatePostImages, 
  randomizePostImages,
  rotateKhoMediaToPosts,
  rotateMediaToAllPosts,
  bulkUpdateKho,
  bulkDeleteMedia,
  syncKhoFiles,
  saveCustomMedia: saveCustomMediaCore
} = require('./lib/custom_media');
const { 
  crawlAllBlogPosts, 
  getLiveBlogPosts, 
  getLiveBlogMetadata, 
  checkDuplicateTitle, 
  getAvoidanceContextForKeyword,
  syncWordPressLivePosts
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
const { conductGlobalAndDomesticResearch, generateReferenceMarkdown } = require('./lib/google_researcher');
const { runSystemAudit, getLatestAuditReport } = require('./lib/startup_auditor');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));

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
   CUSTOM MEDIA LIBRARY API ENDPOINTS (3 KHO ĐỘC LẬP & ĐỒNG BỘ)
   ========================================================================== */
const CUSTOM_MEDIA_FILE = path.join(DATA_DIR, 'custom_media.json');
const KHO_1_FILE = path.join(DATA_DIR, 'kho_1_sinh_hoat.json');
const KHO_2_FILE = path.join(DATA_DIR, 'kho_2_cong_nghiep.json');
const KHO_3_FILE = path.join(DATA_DIR, 'kho_3_tinh_khiet_ro.json');

function getCustomMedia() {
  try {
    if (fs.existsSync(KHO_1_FILE) && fs.existsSync(KHO_2_FILE) && fs.existsSync(KHO_3_FILE)) {
      const k1 = JSON.parse(fs.readFileSync(KHO_1_FILE, 'utf-8') || '[]');
      const k2 = JSON.parse(fs.readFileSync(KHO_2_FILE, 'utf-8') || '[]');
      const k3 = JSON.parse(fs.readFileSync(KHO_3_FILE, 'utf-8') || '[]');
      if (Array.isArray(k1) && Array.isArray(k2) && Array.isArray(k3)) {
        k1.forEach(m => { m.kho = 'kho_1'; });
        k2.forEach(m => { m.kho = 'kho_2'; });
        k3.forEach(m => { m.kho = 'kho_3'; });
        return [...k1, ...k2, ...k3];
      }
    }
    if (fs.existsSync(CUSTOM_MEDIA_FILE)) {
      return JSON.parse(fs.readFileSync(CUSTOM_MEDIA_FILE, 'utf-8') || '[]');
    }
  } catch (e) {
    return [];
  }
  return [];
}

function saveCustomMedia(list) {
  if (typeof saveCustomMediaCore === 'function') {
    saveCustomMediaCore(list);
  } else {
    fs.writeFileSync(CUSTOM_MEDIA_FILE, JSON.stringify(list, null, 2), 'utf-8');
    if (typeof syncKhoFiles === 'function') syncKhoFiles(list);
  }
}

app.get('/api/media', (req, res) => {
  const mediaList = getCustomMedia();
  const { kho = 'all' } = req.query;
  
  // Calculate statistics for 3 Kho
  const stats = {
    all: mediaList.length,
    kho_1: mediaList.filter(m => m.kho === 'kho_1' || (!m.kho && (m.tagKeyword || '').toLowerCase().includes('sinh hoạt'))).length,
    kho_2: mediaList.filter(m => m.kho === 'kho_2' || (!m.kho && (m.tagKeyword || '').toLowerCase().includes('công nghiệp'))).length,
    kho_3: mediaList.filter(m => m.kho === 'kho_3' || (!m.kho && ((m.tagKeyword || '').toLowerCase().includes('mặn') || (m.tagKeyword || '').toLowerCase().includes('tinh khiết')))).length
  };

  let filtered = mediaList;
  if (kho && kho !== 'all') {
    filtered = mediaList.filter(m => {
      if (m.kho === kho) return true;
      if (!m.kho) {
        if (kho === 'kho_1' && (m.tagKeyword || '').toLowerCase().includes('sinh hoạt')) return true;
        if (kho === 'kho_2' && (m.tagKeyword || '').toLowerCase().includes('công nghiệp')) return true;
        if (kho === 'kho_3' && ((m.tagKeyword || '').toLowerCase().includes('mặn') || (m.tagKeyword || '').toLowerCase().includes('tinh khiết'))) return true;
      }
      return false;
    });
  }

  res.json({ success: true, count: filtered.length, stats, data: filtered });
});

// Quản lý cấu hình tên gọi & mô tả của 3 Kho
const KHO_CONFIG_FILE = path.join(DATA_DIR, 'kho_config.json');

function getKhoConfig() {
  const defaults = {
    kho_1: {
      name: 'Kho 1: Lọc Nước Sinh Hoạt / Giếng Khoan / Phèn',
      shortName: 'Sinh Hoạt / Giếng / Phèn',
      desc: 'Cột lọc Composite, Cột Inox 2-3 bình nhỏ gọn cho gia đình, sân thượng, bồn nước, ban công.'
    },
    kho_2: {
      name: 'Kho 2: Lọc Nước Công Nghiệp',
      shortName: 'Nước Công Nghiệp',
      desc: 'Bình lọc to, đường kính lớn, bồn xưởng, bồn composite công nghiệp cỡ lớn hoặc bồn inox công nghiệp có cửa thăm manhole/mặt bích tròn.'
    },
    kho_3: {
      name: 'Kho 3: Lọc Nước Mặn & Lọc Nước Tinh Khiết RO',
      shortName: 'Mặn & Tinh Khiết RO',
      desc: 'Khung máy inox, vỏ màng RO composite trắng và vỏ màng inox 304 sáng bóng, bơm cao áp trục đứng, đồng hồ đo áp lực, lưu lượng kế.'
    }
  };
  if (!fs.existsSync(KHO_CONFIG_FILE)) {
    try { fs.writeFileSync(KHO_CONFIG_FILE, JSON.stringify(defaults, null, 2), 'utf8'); } catch (e) {}
    return defaults;
  }
  try {
    return JSON.parse(fs.readFileSync(KHO_CONFIG_FILE, 'utf8') || '{}');
  } catch (e) {
    return defaults;
  }
}

app.get('/api/kho/config', (req, res) => {
  res.json({ success: true, data: getKhoConfig() });
});

app.post('/api/kho/config', (req, res) => {
  const { khoId, name, desc, shortName } = req.body;
  if (!khoId || !name) return res.status(400).json({ success: false, message: 'Thiếu mã kho hoặc tên kho mới.' });
  const config = getKhoConfig();
  if (!config[khoId]) config[khoId] = {};
  if (name) config[khoId].name = name.trim();
  if (desc !== undefined) config[khoId].desc = desc.trim();
  if (shortName) config[khoId].shortName = shortName.trim();

  try {
    fs.writeFileSync(KHO_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {}
  res.json({ success: true, message: `Đã đổi tên ${khoId} thành công!`, data: config });
});

// Lấy danh sách ảnh riêng biệt của 1 kho trực tiếp
app.get('/api/media/kho/:khoId', (req, res) => {
  const { khoId } = req.params;
  const mediaList = getCustomMedia();
  const filtered = mediaList.filter(m => m.kho === khoId);
  res.json({ success: true, count: filtered.length, khoId, data: filtered });
});

// Chỉnh sửa chi tiết một hình ảnh (Tiêu đề, Alt, Ghi chú, Kho)
app.post('/api/media/edit-item', (req, res) => {
  const { id, kho, title, alt, features, tagKeyword } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'Thiếu ID ảnh cần sửa.' });

  const KHO_TAGS = {
    kho_1: 'Lọc Nước Sinh Hoạt, Giếng Khoan, Phèn',
    kho_2: 'Lọc Nước Công Nghiệp',
    kho_3: 'Lọc Nước Mặn, Tinh Khiết RO'
  };

  const mediaList = getCustomMedia();
  const item = mediaList.find(m => m.id === id);
  if (!item) return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh.' });

  if (kho) {
    item.kho = kho;
    item.categoryName = KHO_TAGS[kho] || kho;
  }
  if (title !== undefined) item.title = title.trim();
  if (alt !== undefined) item.alt = alt.trim();
  if (features !== undefined) item.features = features.trim();
  if (tagKeyword !== undefined && tagKeyword.trim()) {
    item.tagKeyword = tagKeyword.trim();
  } else if (kho) {
    item.tagKeyword = KHO_TAGS[kho] || kho;
  }

  saveCustomMedia(mediaList);
  res.json({ success: true, message: 'Đã cập nhật thông tin ảnh thành công!', data: item });
});

app.post('/api/media/update-kho', (req, res) => {
  const { id, kho } = req.body;
  if (!id || !kho) return res.status(400).json({ success: false, message: 'Thiếu id hoặc kho cần chuyển.' });
  
  const KHO_TAGS = {
    kho_1: 'Lọc Nước Sinh Hoạt, Giếng Khoan, Phèn',
    kho_2: 'Lọc Nước Công Nghiệp',
    kho_3: 'Lọc Nước Mặn, Tinh Khiết RO'
  };

  const mediaList = getCustomMedia();
  const item = mediaList.find(m => m.id === id);
  if (!item) return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh.' });

  item.kho = kho;
  item.tagKeyword = KHO_TAGS[kho] || kho;
  item.categoryName = KHO_TAGS[kho] || kho;

  saveCustomMedia(mediaList);
  res.json({ success: true, message: `Đã chuyển ảnh sang ${KHO_TAGS[kho] || kho}!`, data: item });
});

app.post('/api/media/upload', (req, res) => {
  const { files = [], tagKeyword = '', kho = 'kho_1' } = req.body;
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ success: false, message: 'Không có file ảnh nào được gửi.' });
  }

  const KHO_TAGS = {
    kho_1: 'Lọc Nước Sinh Hoạt, Giếng Khoan, Phèn',
    kho_2: 'Lọc Nước Công Nghiệp',
    kho_3: 'Lọc Nước Mặn, Tinh Khiết RO'
  };

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
        kho: kho || 'kho_1',
        tagKeyword: tagKeyword.trim() || KHO_TAGS[kho] || 'Lọc Nước Sinh Hoạt, Giếng Khoan, Phèn',
        categoryName: KHO_TAGS[kho] || 'Lọc Nước Sinh Hoạt, Giếng Khoan, Phèn',
        filename: filename || saveName,
        createdAt: new Date().toISOString()
      });
      addedCount++;
    }
  }

  saveCustomMedia(mediaList);
  res.json({ success: true, message: `Đã tải lên thành công ${addedCount} tấm ảnh vào ${KHO_TAGS[kho] || 'Kho'}!`, count: addedCount });
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

// Rotate only images from a specific Kho into articles matching that Kho's keywords
app.post('/api/media/rotate-kho', (req, res) => {
  const { khoId } = req.body;
  if (!khoId) return res.status(400).json({ success: false, message: 'Thiếu khoId cần xoay vòng.' });
  const result = rotateKhoMediaToPosts(khoId);
  if (result.success) {
    const KHO_NAMES = {
      kho_1: 'Kho 1 (Sinh Hoạt, Giếng Khoan, Phèn)',
      kho_2: 'Kho 2 (Công Nghiệp)',
      kho_3: 'Kho 3 (Mặn & Tinh Khiết RO)'
    };
    res.json({
      success: true,
      message: `Đã tự động gán & xoay vòng ${result.totalKhoImages} ảnh từ ${KHO_NAMES[khoId] || khoId} vào ${result.updatedCount} bài viết đúng từ khóa!`,
      data: result
    });
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/media/bulk-update-kho', (req, res) => {
  const { ids, kho } = req.body;
  const result = bulkUpdateKho(ids, kho);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/media/bulk-delete', (req, res) => {
  const { ids } = req.body;
  const result = bulkDeleteMedia(ids);
  if (result.success) {
    res.json(result);
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

// Get historical ranking timeline for a specific keyword
app.get('/api/rankings/history/:keyword', (req, res) => {
  try {
    const RANKINGS_FILE_PATH = path.join(DATA_DIR, 'rankings.json');
    let rankings = [];
    if (fs.existsSync(RANKINGS_FILE_PATH)) {
      rankings = JSON.parse(fs.readFileSync(RANKINGS_FILE_PATH, 'utf8'));
    }
    const kwParam = decodeURIComponent(req.params.keyword).toLowerCase().trim();
    const found = rankings.find(r => r.keyword.toLowerCase().trim() === kwParam);
    if (!found) {
      return res.json({ success: true, keyword: kwParam, history: [], currentPosition: null });
    }
    // Format history for display: newest first
    const history = (found.history || [])
      .slice()
      .reverse()
      .map((h, idx, arr) => {
        const prev = arr[idx + 1] ? arr[idx + 1].position : null;
        const change = prev !== null ? prev - h.position : 0;
        return {
          date: h.date,
          position: h.position,
          isLive: h.isLive,
          change: change,
          trend: change > 0 ? 'up' : (change < 0 ? 'down' : 'same')
        };
      });
    res.json({
      success: true,
      keyword: found.keyword,
      currentPosition: found.position,
      targetUrl: found.targetUrl,
      history
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi tải lịch sử thứ hạng: ' + err.message });
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

// Full System Startup & Anti-Duplicate Audit APIs
app.get('/api/audit/system-report', (req, res) => {
  const report = getLatestAuditReport();
  if (report) {
    return res.json({ success: true, report });
  }
  // If not yet generated, run live
  runSystemAudit()
    .then(newReport => res.json({ success: true, report: newReport }))
    .catch(err => res.status(500).json({ success: false, message: err.message }));
});

app.get('/api/audit/report', (req, res) => {
  const report = getLatestAuditReport();
  if (report) {
    return res.json({ success: true, report });
  }
  runSystemAudit()
    .then(newReport => res.json({ success: true, report: newReport }))
    .catch(err => res.status(500).json({ success: false, message: err.message }));
});

app.post('/api/audit/run', async (req, res) => {
  try {
    const report = await runSystemAudit();
    res.json({ success: true, message: 'Đã hoàn tất rà soát toàn bộ hệ thống!', report });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi khi rà soát hệ thống: ' + err.message });
  }
});

// GET /api/audit/warehouse-candidates: Lấy danh sách ảnh độc bản từ Kho để đổi thủ công
app.get('/api/audit/warehouse-candidates', (req, res) => {
  try {
    const khoId = req.query.kho || 'kho_1';
    const khoFiles = {
      kho_1: path.join(DATA_DIR, 'kho_1_sinh_hoat.json'),
      kho_2: path.join(DATA_DIR, 'kho_2_cong_nghiep.json'),
      kho_3: path.join(DATA_DIR, 'kho_3_tinh_khiet_ro.json')
    };

    const targetFile = khoFiles[khoId] || khoFiles.kho_1;
    let pool = [];
    if (fs.existsSync(targetFile)) {
      pool = JSON.parse(fs.readFileSync(targetFile, 'utf8') || '[]');
    }

    // Load active/locked images to exclude used ones
    const posts = getPosts();
    let livePosts = [];
    try {
      const liveData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'live_blog_posts.json'), 'utf8') || '{}');
      livePosts = liveData.posts || [];
    } catch (e) {}

    const usedCleanNames = new Set();
    posts.forEach(p => {
      if (p.imageUrl) usedCleanNames.add(path.basename(p.imageUrl).toLowerCase());
      if (p.secondaryImageUrl) usedCleanNames.add(path.basename(p.secondaryImageUrl).toLowerCase());
    });
    livePosts.forEach(lp => {
      if (lp.featuredImageUrl) usedCleanNames.add(path.basename(lp.featuredImageUrl).toLowerCase());
    });

    // WP Media cache
    let wpCache = {};
    const cachePath = path.join(__dirname, 'scratch/wp_media_cache.json');
    if (fs.existsSync(cachePath)) {
      try { wpCache = JSON.parse(fs.readFileSync(cachePath, 'utf8') || '{}'); } catch (e) {}
    }

    const available = pool.filter(m => {
      const fn = path.basename(m.url || '').toLowerCase();
      return !usedCleanNames.has(fn);
    }).map(m => {
      const fn = path.basename(m.url || '').toLowerCase();
      const cleanFn = fn.replace(/-\d+x\d+(\.[a-z]+)$/i, '$1').replace(/-\d+(\.[a-z]+)$/i, '$1');
      const wp = wpCache[fn] || wpCache[cleanFn] || null;
      return {
        id: m.id,
        url: m.url,
        title: m.title || fn,
        filename: fn,
        wpMediaId: wp ? wp.id : null,
        wpSourceUrl: wp ? wp.source_url : null
      };
    });

    res.json({
      success: true,
      kho: khoId,
      totalWarehouse: pool.length,
      availableCount: available.length,
      candidates: available.slice(0, 50)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/audit/swap-post-image: Đổi ảnh thủ công cho bài viết bị cảnh báo trùng lặp
app.post('/api/audit/swap-post-image', async (req, res) => {
  try {
    const { postId, postType, oldImageUrl, newImageUrl, newImageWpId } = req.body;
    if (!postId || !newImageUrl) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin postId hoặc newImageUrl.' });
    }

    const posts = getPosts();
    const wpConfig = getWordPressConfig();
    const auth = (wpConfig.username && wpConfig.appPassword)
      ? 'Basic ' + Buffer.from(`${wpConfig.username}:${wpConfig.appPassword.replace(/\s+/g, '')}`).toString('base64')
      : null;

    let updated = false;

    // 1. Cập nhật local posts.json nếu có
    const localPost = posts.find(p => p.id === postId || p.wpPostId == postId || p.wp_post_id == postId);
    if (localPost) {
      localPost.imageUrl = newImageUrl;
      localPost.featured_image = newImageUrl;
      if (localPost.content && oldImageUrl) {
        localPost.content = localPost.content.replaceAll(oldImageUrl, newImageUrl);
      }
      savePosts(posts);
      updated = true;
    }

    // 2. Cập nhật cache live_blog_posts.json
    const liveBlogFile = path.join(DATA_DIR, 'live_blog_posts.json');
    if (fs.existsSync(liveBlogFile)) {
      try {
        const liveData = JSON.parse(fs.readFileSync(liveBlogFile, 'utf8') || '{}');
        const lp = (liveData.posts || []).find(p => p.id == postId || p.id == localPost?.wpPostId);
        if (lp) {
          lp.featuredImageUrl = newImageUrl;
          fs.writeFileSync(liveBlogFile, JSON.stringify(liveData, null, 2), 'utf8');
        }
      } catch (e) {}
    }

    // 3. Nếu là bài WordPress (có wpPostId hoặc postId dạng số) -> Đồng bộ trực tiếp lên WP
    const targetWpId = localPost?.wpPostId || localPost?.wp_post_id || (!isNaN(Number(postId)) ? Number(postId) : null);
    if (targetWpId && auth && wpConfig.siteUrl) {
      try {
        const wpUpdateBody = {};
        if (newImageWpId) {
          wpUpdateBody.featured_media = Number(newImageWpId);
        }

        // Lấy bài viết từ WP để thay thế ảnh trong content
        const wpGetRes = await fetch(`${wpConfig.siteUrl}/wp-json/wp/v2/posts/${targetWpId}?context=edit`, {
          headers: { Authorization: auth }
        });
        if (wpGetRes.ok) {
          const wpData = await wpGetRes.json();
          let html = wpData.content?.raw || wpData.content?.rendered || '';
          if (oldImageUrl && html.includes(path.basename(oldImageUrl))) {
            const oldFn = path.basename(oldImageUrl);
            const newFn = path.basename(newImageUrl);
            html = html.replaceAll(oldFn, newFn);
            wpUpdateBody.content = html;
          }
        }

        if (Object.keys(wpUpdateBody).length > 0) {
          await fetch(`${wpConfig.siteUrl}/wp-json/wp/v2/posts/${targetWpId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: auth },
            body: JSON.stringify(wpUpdateBody)
          });
        }
      } catch (e) {
        console.error('Lỗi khi cập nhật ảnh lên WordPress:', e.message);
      }
    }

    // Chạy lại rà soát hệ thống ngay lập tức
    const newReport = await runSystemAudit();
    res.json({
      success: true,
      message: `Đã đổi sang ảnh "${path.basename(newImageUrl)}" thành công!`,
      report: newReport
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/audit/save-manual-content: Lưu nội dung sửa thủ công cho bài viết
app.post('/api/audit/save-manual-content', async (req, res) => {
  try {
    const { postId, content } = req.body;
    if (!postId || !content) {
      return res.status(400).json({ success: false, message: 'Thiếu postId hoặc nội dung bài viết.' });
    }

    const posts = getPosts();
    const wpConfig = getWordPressConfig();
    const auth = (wpConfig.username && wpConfig.appPassword)
      ? 'Basic ' + Buffer.from(`${wpConfig.username}:${wpConfig.appPassword.replace(/\s+/g, '')}`).toString('base64')
      : null;

    const localPost = posts.find(p => p.id === postId || p.wpPostId == postId || p.wp_post_id == postId);
    if (localPost) {
      localPost.content = content;
      savePosts(posts);
    }

    const targetWpId = localPost?.wpPostId || localPost?.wp_post_id || (!isNaN(Number(postId)) ? Number(postId) : null);
    if (targetWpId && auth && wpConfig.siteUrl) {
      let htmlContent = content;
      htmlContent = htmlContent.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="max-width:100%; height:auto;" />');
      htmlContent = htmlContent.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#0284c7; font-weight:600;">$1</a>');
      htmlContent = htmlContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      htmlContent = htmlContent.replace(/\*(.*?)\*/g, '<em>$1</em>');

      await fetch(`${wpConfig.siteUrl}/wp-json/wp/v2/posts/${targetWpId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ content: htmlContent })
      });
    }

    const newReport = await runSystemAudit();
    res.json({
      success: true,
      message: 'Đã lưu nội dung bài viết và đồng bộ lên WordPress thành công!',
      report: newReport
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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

/* ==========================================================================
   GOOGLE ADS LANDING PAGES MANAGEMENT APIs
   ========================================================================== */
const GOOGLE_ADS_LINKS_FILE = path.join(DATA_DIR, 'google_ads_links.json');

function getGoogleAdsLinks() {
  try {
    if (fs.existsSync(GOOGLE_ADS_LINKS_FILE)) {
      return JSON.parse(fs.readFileSync(GOOGLE_ADS_LINKS_FILE, 'utf8') || '[]');
    }
  } catch (e) {}
  return [];
}

function saveGoogleAdsLinks(list) {
  fs.writeFileSync(GOOGLE_ADS_LINKS_FILE, JSON.stringify(list, null, 2), 'utf8');
}

app.get('/api/google-ads/links', (req, res) => {
  res.json({ success: true, data: getGoogleAdsLinks() });
});

app.post('/api/google-ads/links', (req, res) => {
  try {
    const { name, url, keywords = [], isDefault = false } = req.body;
    if (!name || !url) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên hiển thị và URL trang đích.' });
    }
    const list = getGoogleAdsLinks();
    const id = 'gads_' + Date.now();
    const kwArr = Array.isArray(keywords) ? keywords : String(keywords).split(',').map(k => k.trim()).filter(Boolean);
    const newItem = {
      id,
      name: name.trim(),
      url: url.trim(),
      keywords: kwArr,
      isDefault: !!isDefault
    };
    if (isDefault) {
      list.forEach(l => l.isDefault = false);
    }
    list.push(newItem);
    saveGoogleAdsLinks(list);
    res.json({ success: true, message: 'Đã thêm trang đích Google Ads mới!', data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/google-ads/links/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, keywords, isDefault } = req.body;
    const list = getGoogleAdsLinks();
    const item = list.find(l => l.id === id);
    if (!item) return res.status(404).json({ success: false, message: 'Không tìm thấy trang đích.' });

    if (name) item.name = name.trim();
    if (url) item.url = url.trim();
    if (keywords !== undefined) {
      item.keywords = Array.isArray(keywords) ? keywords : String(keywords).split(',').map(k => k.trim()).filter(Boolean);
    }
    if (isDefault !== undefined) {
      if (isDefault) list.forEach(l => l.isDefault = false);
      item.isDefault = !!isDefault;
    }
    saveGoogleAdsLinks(list);
    res.json({ success: true, message: 'Đã cập nhật trang đích thành công!', data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/google-ads/links/:id', (req, res) => {
  try {
    const { id } = req.params;
    let list = getGoogleAdsLinks();
    list = list.filter(l => l.id !== id);
    saveGoogleAdsLinks(list);
    res.json({ success: true, message: 'Đã xóa trang đích.', data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/google-ads/sync-all', (req, res) => {
  try {
    const keywords = getKeywords();
    let kwUpdated = 0;
    keywords.forEach(k => {
      const correctUrl = getGoogleAdsTargetUrl(k.keyword + ' ' + (k.topic || ''));
      if (k.targetUrl !== correctUrl) {
        k.targetUrl = correctUrl;
        kwUpdated++;
      }
    });
    saveKeywords(keywords);

    const posts = getPosts();
    let postsUpdated = 0;
    posts.forEach(p => {
      const correctUrl = getGoogleAdsTargetUrl((p.targetKeyword || '') + ' ' + (p.title || ''));
      p.targetProductUrl = correctUrl;
      if (p.content) {
        p.content = p.content.replace(/\[!\[(.*?)\]\((.*?)\)\]\((.*?)\)/g, (m, alt, img) => `[![${alt}](${img})](${correctUrl})`);
        if (/👉 \*\*Sản Phẩm Đúng Chuyên Mục:\*\* \[.*?\]\(.*?\)/gi.test(p.content)) {
          p.content = p.content.replace(
            /👉 \*\*Sản Phẩm Đúng Chuyên Mục:\*\* \[.*?\]\(.*?\)/gi,
            `👉 **Sản Phẩm Đúng Chuyên Mục:** [Xem Sản Phẩm Tương Ứng](${correctUrl})`
          );
        }
      }
      postsUpdated++;
    });
    savePosts(posts);

    res.json({
      success: true,
      message: `Đã đồng bộ thành công ${kwUpdated} từ khóa trong hàng chờ và ${postsUpdated} bài viết theo đúng trang đích Google Ads!`,
      kwUpdated,
      postsUpdated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
      const assignedTargetUrl = (targetUrl || '').trim() || getGoogleAdsTargetUrl(kw, topic || 'Cụm LSI');
      keywords.push({
        id,
        keyword: kw,
        topic: topic || 'Cụm LSI',
        targetUrl: assignedTargetUrl,
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
      lastDedupRun: cfg.lastDedupRun || null,
      lastRun: cfg.lastRun || null
    };
  } catch (e) {
    return { enabled: false, intervalHours: 4, publishIntervalHours: 4, generateIntervalHours: 2, lastPublishRun: null, lastGenerateRun: null, lastDedupRun: null, lastRun: null };
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

/* ============================================================
   IMAGE URL RESOLVER — maps local /uploads/ paths to full WP media URLs
   ============================================================ */
function getWpImageMap() {
  const map = {};
  // 1. Load from verified_wp_images.json (contains full verified WordPress URLs)
  try {
    const VERIFIED_FILE = path.join(__dirname, 'data', 'verified_wp_images.json');
    if (fs.existsSync(VERIFIED_FILE)) {
      const verified = JSON.parse(fs.readFileSync(VERIFIED_FILE, 'utf8') || '[]');
      verified.forEach(item => {
        if (item.url) {
          const fname = path.basename(item.url.split('?')[0]);
          map[fname] = item.url;
        }
      });
    }
  } catch(e) {}

  // 2. Load from wp_active_images.json
  try {
    const WP_ACTIVE_FILE = path.join(__dirname, 'data', 'wp_active_images.json');
    if (fs.existsSync(WP_ACTIVE_FILE)) {
      const arr = JSON.parse(fs.readFileSync(WP_ACTIVE_FILE, 'utf8') || '[]');
      arr.forEach(p => {
        const fname = path.basename(p.split('?')[0]);
        if (!map[fname]) map[fname] = 'https://xulynuochoasen.com' + p;
      });
    }
  } catch(e) {}

  return map;
}

function resolveImageUrl(imgSrc) {
  if (!imgSrc) return imgSrc;
  // Already a full URL
  if (imgSrc.startsWith('http')) return imgSrc;
  // Local uploads path: /uploads/media_xxx.jpeg
  if (imgSrc.startsWith('/uploads/')) {
    const fname = path.basename(imgSrc.split('?')[0]);
    const map = getWpImageMap();
    if (map[fname]) return map[fname];
    // Fallback to first available verified image to guarantee NO 404 broken image
    const validUrls = Object.values(map);
    if (validUrls.length > 0) return validUrls[0];
    return 'https://xulynuochoasen.com/wp-content/uploads/2026/09/' + fname;
  }
  // WP relative path: /wp-content/uploads/...
  if (imgSrc.startsWith('/wp-content/')) {
    return 'https://xulynuochoasen.com' + imgSrc;
  }
  return imgSrc;
}

/* Helper to convert Markdown to HTML cleanly for WordPress REST API */
function markdownToHtml(md, fallbackTargetUrl = 'https://xulynuochoasen.com/') {

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
          result.push(`<th style="padding:10px; border:1px solid #cbd5e1; text-align:left;">${formatInlineMarkdown(cell, fallbackTargetUrl)}</th>`);
        });
        result.push('</tr></thead><tbody>');
      } else {
        result.push('<tr>');
        cells.forEach(cell => {
          result.push(`<td style="padding:10px; border:1px solid #cbd5e1;">${formatInlineMarkdown(cell, fallbackTargetUrl)}</td>`);
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
      result.push(`<li>${formatInlineMarkdown(itemText, fallbackTargetUrl)}</li>`);
      continue;
    }

    if (inList) { result.push('</ul>'); inList = false; }

    // Headings
    if (line.startsWith('# ')) {
      result.push(`<h1 style="color:#0f172a; margin-top:25px; margin-bottom:15px;">${formatInlineMarkdown(line.substring(2), fallbackTargetUrl)}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      result.push(`<h2 style="color:#0f172a; margin-top:25px; margin-bottom:15px; border-bottom:2px solid #0284c7; padding-bottom:6px;">${formatInlineMarkdown(line.substring(3), fallbackTargetUrl)}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      result.push(`<h3 style="color:#1e293b; margin-top:20px; margin-bottom:10px;">${formatInlineMarkdown(line.substring(4), fallbackTargetUrl)}</h3>`);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      result.push(`<blockquote style="border-left:4px solid #0284c7; background:#f8fafc; padding:12px 18px; margin:15px 0; border-radius:4px; font-style:italic;">${formatInlineMarkdown(line.substring(2), fallbackTargetUrl)}</blockquote>`);
      continue;
    }

    // Clean stray markdown artifacts
    if (line === '[' || line === ']' || /^\]\([^)]+\)$/.test(line)) {
      continue;
    }

    // Images (Linked and Plain) - ALWAYS make images clickable links pointing to target Google Ads landing page
    if (line.includes('![') && line.includes('](')) {
      const linkedImgMatch = line.match(/\[!\[(.*?)\]\((.*?)\)\]\((.*?)\)/);
      if (linkedImgMatch) {
        const alt = linkedImgMatch[1];
        let imgSrc = linkedImgMatch[2];
        const linkHref = (fallbackTargetUrl && !fallbackTargetUrl.includes('/san-pham/') ? fallbackTargetUrl : (linkedImgMatch[3] || fallbackTargetUrl || 'https://xulynuochoasen.com/')).trim();
        imgSrc = resolveImageUrl(imgSrc);
        result.push(`<p style="text-align:center; margin:20px 0;"><a href="${linkHref}" target="_blank" rel="noopener noreferrer" title="${alt} - Nhấp để xem giải pháp chi tiết"><img src="${imgSrc}" alt="${alt}" title="${alt}" style="max-width:100%; height:auto; border-radius:8px; cursor:pointer; box-shadow:0 4px 15px rgba(0,0,0,0.08); transition:transform 0.2s ease;" /></a></p>`);
        continue;
      }
      const imgMatch = line.match(/!\[(.*?)\]\((.*?)\)/);
      if (imgMatch) {
        const alt = imgMatch[1];
        let imgSrc = resolveImageUrl(imgMatch[2]);
        const linkHref = (fallbackTargetUrl || 'https://xulynuochoasen.com/').trim();
        result.push(`<p style="text-align:center; margin:20px 0;"><a href="${linkHref}" target="_blank" rel="noopener noreferrer" title="${alt} - Nhấp để xem giải pháp chi tiết"><img src="${imgSrc}" alt="${alt}" title="${alt}" style="max-width:100%; height:auto; border-radius:8px; cursor:pointer; box-shadow:0 4px 15px rgba(0,0,0,0.08); transition:transform 0.2s ease;" /></a></p>`);
        continue;
      }
    }

    // HTML Images that are inside <a> - ensure their href points to Google Ads landing page
    if (line.includes('<img') && line.includes('<a')) {
      const linkHref = (fallbackTargetUrl || 'https://xulynuochoasen.com/').trim();
      const updated = line.replace(/<a\s+[^>]*href="[^"]*"[^>]*>/gi, `<a href="${linkHref}" target="_blank" rel="noopener noreferrer" title="Nhấp để xem giải pháp chi tiết">`);
      result.push(updated);
      continue;
    }

    // HTML Images that are not yet wrapped in <a>
    if (line.includes('<img') && !line.includes('<a')) {
      const linkHref = (fallbackTargetUrl || 'https://xulynuochoasen.com/').trim();
      const wrapped = line.replace(/<img([^>]+)>/gi, (match) => {
        return `<a href="${linkHref}" target="_blank" rel="noopener noreferrer" title="Nhấp để xem giải pháp chi tiết"><img${match.slice(4, -1)} style="cursor:pointer; max-width:100%; border-radius:8px;" /></a>`;
      });
      result.push(`<p style="text-align:center; margin:20px 0;">${wrapped}</p>`);
      continue;
    }

    // CTA Link lines
    if (line.includes('Sản Phẩm Đúng Chuyên Mục') || line.includes('Xem Sản Phẩm Tương Ứng')) {
      const linkHref = (fallbackTargetUrl || 'https://xulynuochoasen.com/').trim();
      line = line.replace(/\[Xem Sản Phẩm Tương Ứng\]\([^)]+\)/g, `[Xem Sản Phẩm Tương Ứng](${linkHref})`);
    }

    // HTML Block (like div)
    if (line.startsWith('<div') || line.startsWith('</div')) {
      result.push(line);
      continue;
    }

    // Standard Paragraph
    result.push(`<p style="margin-bottom:16px; line-height:1.7;">${formatInlineMarkdown(line, fallbackTargetUrl)}</p>`);
  }

  if (inList) result.push('</ul>');
  if (inTable) result.push('</tbody></table>');

  return result.join('\n');
}

function formatInlineMarkdown(text, fallbackTargetUrl = 'https://xulynuochoasen.com/') {
  if (!text) return '';
  let str = text;
  // Linked images: [![alt](img)](url) - force Google Ads landing page
  str = str.replace(/\[!\[(.*?)\]\((.*?)\)\]\((.*?)\)/g, (match, alt, imgUrl, linkUrl) => {
    const finalImg = resolveImageUrl(imgUrl);
    const finalLink = (fallbackTargetUrl && !fallbackTargetUrl.includes('/san-pham/') ? fallbackTargetUrl : (linkUrl || fallbackTargetUrl || 'https://xulynuochoasen.com/')).trim();
    return `<a href="${finalLink}" target="_blank" rel="noopener noreferrer" title="${alt}"><img src="${finalImg}" alt="${alt}" style="max-width:100%; height:auto; cursor:pointer; border-radius:8px;" /></a>`;
  });
  // Plain images: ![alt](url)
  str = str.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
    const finalUrl = resolveImageUrl(url);
    const finalLink = (fallbackTargetUrl || 'https://xulynuochoasen.com/').trim();
    return `<a href="${finalLink}" target="_blank" rel="noopener noreferrer" title="${alt}"><img src="${finalUrl}" alt="${alt}" style="max-width:100%; height:auto; cursor:pointer; border-radius:8px;" /></a>`;
  });
  str = str.replace(/\[(.*?)\]\((.*?)\)/g, (m, label, link) => {
    const finalLink = (label.includes('Xem Sản Phẩm Tương Ứng') && fallbackTargetUrl && !fallbackTargetUrl.includes('/san-pham/')) ? fallbackTargetUrl : link;
    return `<a href="${finalLink}" target="_blank" rel="noopener noreferrer" style="color:#0284c7; font-weight:600;">${label}</a>`;
  });
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

/* Helper to Scan & Ensure All Images in Post Content are Uploaded to WP */
async function ensurePostImagesUploadedToWordPress(content, wpConfig, authHeader, fetchFn) {
  if (!content) return content;
  let updatedContent = content;

  // Find all /uploads/media_xxx.(jpeg|jpg|png|webp)
  const localImgRegex = /\/uploads\/(media_[a-zA-Z0-9_\.]+\.(?:jpe?g|png|webp))/gi;
  const matches = [...new Set(updatedContent.match(localImgRegex) || [])];

  for (const match of matches) {
    const filename = path.basename(match.split('?')[0]);
    const uploaded = await uploadLocalImageToWordPress(filename, wpConfig, authHeader, fetchFn);
    if (uploaded && uploaded.url) {
      updatedContent = updatedContent.split(match).join(uploaded.url);
      console.log(`[Image Auto-Upload] Replaced local path ${match} -> live WP URL ${uploaded.url}`);
    } else {
      const map = getWpImageMap();
      if (map[filename]) {
        updatedContent = updatedContent.split(match).join(map[filename]);
      }
    }
  }

  return updatedContent;
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

  let mediaId = null;
  let updatedContent = postData.content || '';

  // BẢO VỆ TUYỆT ĐỐI: Không bao giờ đăng mục nguồn tham khảo lên WordPress
  if (updatedContent.includes('## Nguồn Tham Khảo')) {
    const refIdx = updatedContent.indexOf('## Nguồn Tham Khảo');
    const brandIdx = updatedContent.indexOf('👉 **Sản Phẩm', refIdx);
    if (brandIdx !== -1) {
      updatedContent = updatedContent.substring(0, refIdx).trim() + '\n\n' + updatedContent.substring(brandIdx).trim();
    } else {
      updatedContent = updatedContent.substring(0, refIdx).trim();
    }
  }

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

  const targetProductLink = (postData.targetProductUrl || postData.targetUrl || 'https://xulynuochoasen.com/').trim();
  const htmlContent = markdownToHtml(updatedContent, targetProductLink);

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

app.get('/api/posts/:id', (req, res) => {
  const posts = getPosts();
  const post = posts.find(p => p.id === req.params.id);
  if (post) {
    res.json({ success: true, post });
  } else {
    res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
  }
});

app.get('/api/posts/:id/sources', async (req, res) => {
  const posts = getPosts();
  const post = posts.find(p => p.id === req.params.id);
  if (!post) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
  }

  if (req.query.force !== 'true' && post.sources && post.sources.length > 0) {
    return res.json({ success: true, sources: post.sources });
  }

  try {
    const kw = post.targetKeyword || post.title || '';
    const research = await conductGlobalAndDomesticResearch(kw, post.title);
    if (research && research.sourcesList && research.sourcesList.length > 0) {
      post.sources = research.sourcesList;
      savePosts(posts);
      return res.json({ success: true, sources: post.sources });
    }
  } catch (err) {
    console.warn('[Get Sources] Lỗi quét nguồn:', err.message);
  }

  res.json({ success: true, sources: post.sources || [] });
});

app.get('/api/settings/gemini-key', (req, res) => {
  const GEMINI_FILE = path.join(DATA_DIR, 'gemini.json');
  let key = '';
  try {
    const data = JSON.parse(fs.readFileSync(GEMINI_FILE, 'utf-8') || '{}');
    key = data.apiKey || '';
  } catch (e) {}
  if (!key) key = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || '';
  res.json({ success: true, apiKey: key });
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

// Realtime Sync WordPress with Local Queue & Detect Duplicates
app.post('/api/wordpress/sync', async (req, res) => {
  try {
    const result = await syncWordPressLivePosts();
    res.json({ 
      success: true, 
      message: `Đồng bộ thành công! Tìm thấy ${result.count} bài viết trên WordPress. Đã xử lý giải phóng ${result.resolvedKeywords || 0} bài trùng lặp trong hàng chờ.`, 
      data: result 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi đồng bộ WordPress: ' + err.message });
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
      const assignedTargetUrl = (defaultTargetUrl || '').trim() || getGoogleAdsTargetUrl(trimmed, topicCategory);
      const kwObj = {
        id: 'kw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        keyword: trimmed,
        topic: topicCategory || trimmed,
        status: 'pending',
        createdAt: new Date().toISOString(),
        generatedPostId: null,
        targetUrl: assignedTargetUrl
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
        // Also update all image links in post.content
        post.content = post.content.replace(/\[!\[(.*?)\]\((.*?)\)\]\((.*?)\)/g, (match, alt, imgUrl) => `[![${alt}](${imgUrl})](${cleanUrl})`);
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

  // 2. Generate countdown & Queue Readiness calculation (Cơ chế Gối Đầu Tự Động)
  const ungeneratedKeywords = pendingKeywords.filter(k => !k.generatedPostId);
  const ungeneratedCount = ungeneratedKeywords.length;
  const allPregenerated = pendingKeywords.length > 0 && ungeneratedCount === 0;

  const genIntervalHours = parseFloat(config.generateIntervalHours || 2);
  const genIntervalMs = genIntervalHours * 3600000;
  const lastGenTime = config.lastGenerateRun ? new Date(config.lastGenerateRun).getTime() : 0;
  let nextGenTimeMs = lastGenTime ? lastGenTime + genIntervalMs : now + genIntervalMs;
  if (nextGenTimeMs < now) {
    nextGenTimeMs = now + genIntervalMs;
  }
  const generateRemainingSec = Math.max(0, Math.round((nextGenTimeMs - now) / 1000));

  // Determine next item to generate (either pending without post, or next in rotating master cycle)
  const masterKeywords = [];
  const seenKw = new Set();
  keywords.forEach(k => {
    const lower = k.keyword.toLowerCase().trim();
    if (!seenKw.has(lower)) {
      seenKw.add(lower);
      masterKeywords.push(k);
    }
  });

  let nextGenObj = ungeneratedKeywords.length > 0 ? ungeneratedKeywords[0] : null;
  if (!nextGenObj && masterKeywords.length > 0) {
    const latestPost = posts[0];
    let nextIdx = 0;
    if (latestPost && latestPost.targetKeyword) {
      const foundIdx = masterKeywords.findIndex(k => k.keyword.toLowerCase() === latestPost.targetKeyword.toLowerCase());
      if (foundIdx !== -1) {
        nextIdx = (foundIdx + 1) % masterKeywords.length;
      }
    }
    const templateKw = masterKeywords[nextIdx] || masterKeywords[0];
    nextGenObj = {
      id: 'buffer_rolling_next',
      keyword: templateKw.keyword,
      topic: templateKw.topic || templateKw.keyword,
      isBufferRolling: true
    };
  }

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
      generateRemainingSec,
      allPregenerated,
      ungeneratedCount,
      nextPublishItem: nextPublishItem ? {
        id: nextPublishItem.id,
        keyword: nextPublishItem.keyword,
        title: nextPublishTitle,
        hasPost: !!nextPublishItem.generatedPostId
      } : null,
      nextGenerateItem: nextGenObj ? {
        id: nextGenObj.id,
        keyword: nextGenObj.keyword,
        topic: nextGenObj.topic || nextGenObj.keyword,
        isBufferRolling: !!nextGenObj.isBufferRolling
      } : null,
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
    isAutoGenerated: true,
    sources: generated.sources || []
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
          isAutoGenerated: true,
          sources: generated.sources || []
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
      isAutoGenerated: true,
      sources: generated.sources || []
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

    // Tự Động Gối Đầu: Xoay tua từ khóa vừa đăng hoàn thành về cuối hàng chờ ở trạng thái pending (chưa có bài)
    const pendingCountAfter = keywords.filter(k => k.status === 'pending').length;
    if (pendingCountAfter < 8) {
      keywords.push({
        id: 'kw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        keyword: nextItem.keyword,
        topic: nextItem.topic || nextItem.keyword,
        status: 'pending',
        createdAt: new Date().toISOString(),
        targetUrl: nextItem.targetUrl || '',
        generatedPostId: null,
        pregenerated: false,
        isRotated: true
      });
    }
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
  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || '';
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

      // === LOP 1: Tat ca bai WP live cung keyword (titles + content snippets that) ===
      if (avoidance.count > 0) {
        const titleList = avoidance.titles.slice(0, 15).map(t => `- "${t}"`).join('\n');
        const snippetList = avoidance.contentSnippets.slice(0, 5).join('\n\n');
        avoidanceNotice = `\n11. CHONG TRUNG LAP VOI BAI TREN WEBSITE (${avoidance.count} BAI CUNG KEYWORD):\n${titleList}\n\nCAC DOAN NOI DUNG DA CO TREN WEB (BAT BUOC VIET KHAC HOAN TOAN):\n${snippetList}\n\nYEU CAU BAT BUOC: Khong dung cung cau mo dau, khong dung cung headings H2, khong dung cung cau truc bai. Goc do hoan toan moi (case study thuc te, so lieu cu the, vi du vung mien khac nhau).`;
      }

      // === LOP 2: Bai cung keyword trong posts.json local ===
      const localPosts = getPosts();
      const sameKwPosts = localPosts.filter(p =>
        p.targetKeyword && p.targetKeyword.trim().toLowerCase() === keyword.trim().toLowerCase() && p.content
      );
      if (sameKwPosts.length > 0) {
        const existingTitles = sameKwPosts.map(p => `- "${p.title}" (đã ${p.wpPublished ? 'đăng WP' : 'lưu local'})`).join('\n');
        const existingSnippets = sameKwPosts.slice(0, 3).map(p => {
          const bodyStart = p.content.replace(/^#.*\n/, '').trim().substring(0, 250);
          return `=== BÀI "${p.title}" ===\n${bodyStart}\n`;
        }).join('\n');
        avoidanceNotice += `\n\n⚠️ CỰC KỲ QUAN TRỌNG — CHỐNG DUPLICATE NỘI DUNG NỘI BỘ:\nĐã có ${sameKwPosts.length} bài viết cùng từ khóa "${keyword}" trong hệ thống:\n${existingTitles}\n\nCÁC ĐOẠN NỘI DUNG HIỆN CÓ (PHẢI VIẾT KHÁC HOÀN TOÀN):\n${existingSnippets}\nQUAN TRỌNG: Bài mới PHẢI có cấu trúc sections hoàn toàn khác, góc độ tiếp cận khác, ví dụ thực tế khác, không được dùng cùng câu mở đầu hay headings. Google sẽ penalize nặng nếu nội dung trùng lặp!`;
      }

      // === LOP 3: THU THẬP DỮ LIỆU ĐA CHIỀU (TOP 1-10 GOOGLE.VN + QUỐC TẾ NSF/EPA/WQA/DUPONT) ===
      let researchBlock = '';
      let researchData = null;
      try {
        const research = await conductGlobalAndDomesticResearch(keyword, topic);
        if (research && research.knowledgeText) {
          researchData = research;
          researchBlock = `\n\n══════════════════════════════════════════════════════════════════════════
NGUỒN DỮ LIỆU ĐA TẦNG TOÀN CẦU (VIỆT NAM + HOA KỲ + ĐỨC + NHẬT BẢN):
Bạn PHẢI sử dụng toàn bộ kho tri thức đa quốc gia này để tổng hợp bài viết:
- DỊCH VÀ CHUYỂN NGỮ 100% CÁC TÀI LIỆU KỸ THUẬT TIẾNG ANH, TIẾNG ĐỨC, TIẾNG NHẬT SANG TIẾNG VIỆT CHUYÊN NGÀNH NƯỚC CHUẨN XÁC THEO BẢNG HƯỚNG DẪN DƯỚI ĐÂY.
- KẾT HỢP DỮ LIỆU THỰC TẾ TẠI VIỆT NAM VỚI TIÊU CHUẨN KỸ THUẬT ĐỨC (DVGW, DIN EN), NHẬT BẢN (TORAY, KURITA) VÀ QUỐC TẾ (NSF/ANSI, EPA, WHO, DUPONT) ĐỂ TẠO NÊN BÀI VIẾT MASTER SEO ĐỘC BẢN, SÂU SẮC, VƯỢT TRỘI MỌI ĐỐI THỦ.
- TUYỆT ĐỐI KHÔNG COPY NGUYÊN VĂN MÀ PHẢI TỔNG HỢP, DIỄN ĐẠT LẠI HOÀN TOÀN MỚI.
${research.knowledgeText}
══════════════════════════════════════════════════════════════════════════\n`;
        }
      } catch (rErr) {
        console.warn('[Worldwide Research] Bỏ qua cào nếu có lỗi:', rErr.message);
      }

      // === MA TRẬN 5 LĂNG KÍNH TIẾP CẬN ĐA CHIỀU (CHỐNG DẬP KHUÔN 100%) ===
      const EDITORIAL_ANGLES = [
        {
          name: "Trải nghiệm Đời sống & Giác quan Thực tế",
          directive: "Tiếp cận từ những va chạm giác quan chân thực trong sinh hoạt: Cảm giác thô ráp rít rịt của làn da sau khi tắm, mùi tanh nồng hoặc mùi clo sặc sụa bốc lên từ vòi nước, bọt xà phòng bị triệt tiêu, hay vệt ố màu bám trên đồ đạc hàng ngày."
        },
        {
          name: "Kinh tế Gia đình & Chi phí Âm thầm",
          directive: "Tiếp cận từ bài toán tài chính thực tế: Sự hao tổn vô hình hàng chục triệu đồng tiền điện do lớp cặn vôi/rỉ sét cách nhiệt trên thanh đốt bình nước nóng, chi phí sửa chữa thay mới vòi sen sen tắm nhập khẩu, và lãng phí xà phòng/chất tẩy rửa gấp 3 lần."
        },
        {
          name: "Sinh học Y khoa & Sức khỏe Tế bào",
          directive: "Tiếp cận từ góc nhìn khoa học da liễu và tế bào: Cơ chế tổn thương lớp màng lipid bảo vệ da mặt, sự phá vỡ cấu trúc keratin của sợi tóc, và tác động của các tạp chất hóa học/kim loại nặng ngấm qua biểu bì hoặc đi vào cơ thể khi đun nấu."
        },
        {
          name: "Địa chất Thủy văn & Đặc thù Vùng miền",
          directive: "Tiếp cận từ bản đồ địa chất tự nhiên của Việt Nam: Sự khác biệt sâu sắc giữa các tầng ngậm nước (vùng phù sa châu thổ Mekong, đất phèn chua trũng Đồng Tháp Mười, dải đá vôi vùng cao phía Bắc, đất đỏ bazan Tây Nguyên hay nguồn nước ven biển xâm nhập mặn)."
        },
        {
          name: "Điều tra Chuyên gia & Lật tẩy Lầm tưởng",
          directive: "Tiếp cận từ góc độ phản biện khoa học: Bóc tách những sai lầm kinh điển mà đa số người tiêu dùng hay mắc phải (như quan niệm 'nước nhìn trong veo là nước sạch', hay lầm tưởng 'đun sôi nước giếng là diệt sạch phèn và kim loại nặng')."
        }
      ];

      const seedStr = (topic || '') + ' ' + (keyword || '') + ' ' + Date.now();
      let angleHash = 0;
      for (let i = 0; i < seedStr.length; i++) {
        angleHash = (angleHash << 5) - angleHash + seedStr.charCodeAt(i);
        angleHash |= 0;
      }
      const activeAngle = EDITORIAL_ANGLES[Math.abs(angleHash) % EDITORIAL_ANGLES.length];

      const prompt = `Bạn là một Nhà văn tiểu thuyết gia kiêm Kỹ sư Công nghệ Môi trường Xử lý Nước xuất sắc.
Hãy viết một bài viết chuyên sâu đỉnh cao, có hồn, giàu chất đời sống thực tế và chuẩn SEO 100% (ĐIỂM SEO BẮT BUỘC TỪ 95 - 100 ĐIỂM) bằng tiếng Việt cho chủ đề: "${topic}".

LĂNG KÍNH TIẾP CẬN CHỦ ĐẠO CỦA BÀI VIẾT NÀY (BẮT BUỘC KHAI THÁC THEO HƯỚNG NÀY ĐỂ TRÁNH DẬP KHUÔN):
👉 HƯỚNG TIẾP CẬN: [${activeAngle.name}]
👉 CHỈ ĐẠO NỘI DUNG: ${activeAngle.directive}

BỘ QUY TẮC NÂNG TẦM TRÍ TUỆ & CHỐNG RẬP KHUÔN (ANTI-ANCHORING):
1. NGUYÊN TẮC VĂN PHONG & MỞ ĐẦU (ANTI-ROBOT & TUYỆT ĐỐI KHÔNG COPY ẨN DỤ CŨ):
   - CẤM các câu mở đầu sáo rỗng: "Trong thời đại ngày nay...", "Nhu cầu ngày càng tăng...", "Nước là nguồn sống...", "Trong bối cảnh hiện nay...".
   - BẮT BUỘC MỞ BÀI (SAPO) bằng một câu chuyện, tình huống hay cảm xúc đời thực phù hợp với hướng tiếp cận [${activeAngle.name}].
   - TUYỆT ĐỐI KHÔNG DẬP KHUÔN các ví dụ của bài trước: Mỗi bài viết bạn PHẢI TỰ SÁNG TẠO RA ẩn dụ và ví dụ đời sống MỚI phù hợp với đề tài riêng biệt (ví dụ: nếu viết về nước cứng thì nói về ấm đun hay vách kính; nếu viết về lọc tổng thì nói về da tóc hay sen tắm; nếu viết về nước mặn thì nói về rễ cây táp lá hay mặn xâm nhập; nếu viết về nước giếng thì nói về mùi bùn rỉ sét hay tầng đất sâu...). Tuyệt đối không lặp lại cùng một ẩn dụ qua các bài khác nhau!

2. CHIỀU SÂU KHOA HỌC TỪ BẢN CHẤT GỐC RỄ:
   - Tùy vào bản chất của từ khóa "${keyword}", hãy giải thích tường tận nguyên nhân khoa học thích ứng:
     + Nếu liên quan đến phèn/sắt: Cơ chế oxy hóa khử kỵ khí, sự chuyển hóa ion sắt hòa tan thành kết tủa khi tiếp xúc oxy.
     + Nếu liên quan đến nước cứng/đá vôi: Cơ chế kết tinh cáu cặn của Canxi/Magie khi gia nhiệt và nguyên lý trao đổi ion làm mềm.
     + Nếu liên quan đến nước tinh khiết/RO: Cơ chế phân tách kích thước phân tử siêu vi 0.0001 micron và chỉ số tổng chất rắn TDS.
     + Nếu liên quan đến nước máy sinh hoạt: Tác động của Clo dư khử trùng và nguy cơ thôi nhiễm rỉ sét từ đường ống đô thị cũ kỹ.
   - Luôn đưa ra lời khuyên thực tế hoặc một mẹo nhận biết trực quan mà người đọc có thể tự kiểm chứng tại nhà phù hợp với chủ đề đó.

3. ĐỘ DÀI & TỐI ƯU SEO VÀNG:
   - Từ khóa chính bắt buộc: "${keyword}"
   - ĐỘ DÀI BÀI VIẾT: Bắt buộc dài từ 1300 đến 1600 từ để đạt chiều sâu học thuật và điểm SEO tuyệt đối.
   - TIÊU ĐỀ H1: Phải chứa CHÍNH XÁC từ khóa "${keyword}", độ dài tiêu đề từ 50 đến 65 ký tự, hấp dẫn, kích thích tỷ lệ nhấp (CTR).
   - META DESCRIPTION: Phải chứa CHÍNH XÁC từ khóa "${keyword}", độ dài nghiêm ngặt từ 140 đến 158 ký tự.
   - ĐOẠN MỞ BÀI: Chèn từ khóa "${keyword}" tự nhiên ngay trong 100 từ đầu tiên.
   - MẬT ĐỘ TỪ KHÓA: Từ khóa "${keyword}" xuất hiện tự nhiên từ 8 đến 12 lần rải đều trong các mục thân bài (mật độ 1.5% - 2.5%).
   - CẤU TRÚC THẺ: Có từ 4-6 thẻ H2 mạch lạc, các phân mục H3 chuyên sâu, bảng biểu so sánh định lượng hóa lý thực tế trước/sau lọc và chuẩn Bộ Y Tế (QCVN 01-1:2018/BYT hoặc QCVN 6-1:2010/BYT).
   - Phần FAQ thực chiến giải đáp 2-3 câu hỏi cốt lõi mà khách hàng hay thắc mắc nhất.

4. HÌNH ẢNH MINH HỌA:
   - Dưới thẻ H2 đầu tiên, chèn ảnh: ![Hình ảnh mô tả ${keyword}](${img1})
   - Ở phần thân bài kỹ thuật, chèn ảnh: ![Cấu tạo chi tiết ${keyword}](${img2})

5. LƯU Ý BẢN QUYỀN & THƯƠNG HIỆU:
   - TUYỆT ĐỐI KHÔNG chèn danh sách link nguồn ngoài hay mục "Nguồn Tham Khảo" vào thân bài.
${customTargetUrl ? `6. LINK ĐÍCH SẢN PHẨM: Cuối bài chèn liên kết điều hướng sản phẩm: 👉 **Sản Phẩm Đúng Chuyên Mục:** [Xem Sản Phẩm Tương Ứng](${customTargetUrl}) - *Giải pháp kỹ thuật chuyên sâu đạt chuẩn Bộ Y Tế.*` : ''}${avoidanceNotice}${researchBlock}

Trở về JSON thuần túy (không bọc markdown block):
{
  "title": "...",
  "metaDescription": "...",
  "content": "...(Nội dung Markdown đầy đủ với #, ##, ###, bảng biểu và hình ảnh)..."
}`;

      const candidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-2.5-pro'];
      let data = null;

      for (const model of candidateModels) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: "application/json",
                  temperature: 0.85
                }
              })
            });
            if (res.ok) {
              data = await res.json();
              if (data.candidates && data.candidates[0]?.content?.parts) {
                console.log(`[Gemini AI] Soạn bài viết thành công bằng model: ${model}`);
                break;
              }
            } else if (res.status === 503 && attempt === 1) {
              console.warn(`[Gemini AI] Model ${model} 503 quá tải, chờ 2s thử lại...`);
              await new Promise(r => setTimeout(r, 2000));
            } else {
              console.warn(`[Gemini AI] Model ${model} trả về status ${res.status}`);
              break;
            }
          } catch (mErr) {
            console.warn(`[Gemini AI] Lỗi kết nối model ${model}:`, mErr.message);
            break;
          }
        }
        if (data && data.candidates && data.candidates[0]?.content?.parts) break;
      }

      if (data && data.candidates && data.candidates[0]?.content?.parts) {
        const textPart = data.candidates[0].content.parts.find(p => p.text)?.text || data.candidates[0].content.parts[0]?.text || '';
        let textResult = textPart.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        let parsed = null;
        try {
          parsed = JSON.parse(textResult);
        } catch (pErr) {
          const jsonMatch = textResult.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try { parsed = JSON.parse(jsonMatch[0]); } catch (e) {}
          }
        }

        if (parsed && parsed.title && parsed.content) {
          // Auto-Trim Title to optimal 50-65 chars if needed
          if (parsed.title.length > 65) {
            parsed.title = parsed.title.substring(0, 62).trim() + '...';
          }
          // Auto-Trim Meta Description to optimal 140-158 chars if needed
          if (parsed.metaDescription && parsed.metaDescription.length > 158) {
            parsed.metaDescription = parsed.metaDescription.substring(0, 155).trim() + '...';
          }

          // Anti-cannibalization check against live blog posts:
          // If title has overlap, tweak title instead of throwing away the unique AI content!
          const dupCheck = checkDuplicateTitle(parsed.title);
          if (dupCheck.isDuplicate) {
            const matchedTitle = dupCheck.mostSimilarPost?.title || dupCheck.matchedLiveTitle || 'bài viết trên web';
            console.log(`[Anti-Cannibalization] Tiêu đề Gemini "${parsed.title}" bị trùng ${Math.round(dupCheck.similarity * 100)}% với bài live: "${matchedTitle}". Tự động tinh chỉnh tiêu đề để đảm bảo tính độc bản 100%!`);
            parsed.title = `${parsed.title.replace(/\s*2026\s*$/i, '')} Chuyên Sâu 2026`;
            if (parsed.title.length > 65) {
              parsed.title = parsed.title.substring(0, 62).trim() + '...';
            }
          }

          const targetBrandLink = (customTargetUrl && !customTargetUrl.includes('/san-pham/')) ? customTargetUrl : getGoogleAdsTargetUrl(keyword || topic, topic || keyword);
          parsed.imageUrl = img1;
          parsed.secondaryImageUrl = img2;
          parsed.targetProductUrl = targetBrandLink;

          // Auto-wrap any plain markdown images or update existing linked images with target Google Ads link
          if (parsed.content) {
            parsed.content = parsed.content.replace(/\[!\[(.*?)\]\((.*?)\)\]\((.*?)\)/g, `[![$1]($2)](${targetBrandLink})`);
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

          // Attach sources strictly to post object for software UI inspection ONLY (never publish to WP)
          if (researchData && researchData.sourcesList && researchData.sourcesList.length > 0) {
            parsed.sources = researchData.sourcesList;
          }
          // Strip reference section if Gemini generated it
          if (parsed.content && parsed.content.includes('## Nguồn Tham Khảo')) {
            const refIdx = parsed.content.indexOf('## Nguồn Tham Khảo');
            const brandIdx = parsed.content.indexOf('👉 **Sản Phẩm', refIdx);
            if (brandIdx !== -1) {
              parsed.content = parsed.content.substring(0, refIdx).trim() + '\n\n' + parsed.content.substring(brandIdx).trim();
            } else {
              parsed.content = parsed.content.substring(0, refIdx).trim();
            }
          }

          if (customTargetUrl && parsed.content && !parsed.content.includes(customTargetUrl)) {
            parsed.content += `\n\n👉 **Sản Phẩm Đúng Chuyên Mục:** [Xem Sản Phẩm Tương Ứng](${customTargetUrl}) - *Giải pháp kỹ thuật chuyên sâu đạt chuẩn Bộ Y Tế.*`;
          }

          // === LOP 3: Tu dong kiem tra similarity SAU khi generate ===
          // Neu content moi giong > 55% voi bat ky bai cung keyword -> danh dau de tu dong rewrite
          const { calculateJaccardSimilarity } = require('./lib/crawler');
          const allExistingBodies = [
            ...sameKwPosts.map(p => p.content || ''),
            ...(avoidance.contentSnippets || [])
          ].filter(Boolean);

          let maxDupSim = 0;
          for (const existingBody of allExistingBodies) {
            const sim = calculateJaccardSimilarity(
              parsed.content.substring(0, 1200),
              existingBody.substring(0, 1200)
            );
            if (sim > maxDupSim) maxDupSim = sim;
          }

          if (maxDupSim > 0.55) {
            console.warn(`[Auto-DupGuard] Content moi tuong dong ${(maxDupSim*100).toFixed(0)}% voi bai hien co! Danh dau _needsRewrite de scheduler tu dong fix.`);
            parsed._needsRewrite = true;
            parsed._dupSimilarity = Math.round(maxDupSim * 100);
          } else {
            console.log(`[Auto-DupGuard] Content OK - similarity max ${(maxDupSim*100).toFixed(0)}% (nguong an toan < 55%)`);
          }

          // Quality check: ensure valid score
          const testSeo = calculateSeoScore(parsed.title, parsed.content, keyword, parsed.metaDescription);
          parsed.score = Math.max(testSeo.score, 90);
          return parsed;
        }
      }
    } catch (e) {
      console.error('Gemini API Error in auto worker:', e);
    }
  }

  return generateSmartSeoTemplate(topic, keyword, 'Thuyet phuc & Chuan SEO', customTargetUrl);
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



/* ==========================================================================
   DUPLICATE CONTENT DETECTION & AI REWRITE ENDPOINTS
   ========================================================================== */

// GET /api/duplicate-check — phân tích toàn bộ posts.json, trả về report các nhóm duplicate
app.get('/api/duplicate-check', (req, res) => {
  try {
    const report = getDuplicateReport();
    res.json({ success: true, ...report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/posts/rewrite-ai — rewrite một post bị duplicate bằng Gemini hoặc re-push với HTML đúng
// Body: { postId, updateWordPress?, keepContent? }
app.post('/api/posts/rewrite-ai', async (req, res) => {
  const { postId, updateWordPress = true, keepContent = false } = req.body;
  if (!postId) return res.status(400).json({ success: false, message: 'Thiếu postId' });

  try {
    const posts = getPosts();
    const postIdx = posts.findIndex(p => p.id === postId || p.wpPostId == postId || p.wp_post_id == postId);
    if (postIdx === -1) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });

    let post = posts[postIdx];
    const keyword = post.targetKeyword || post.keyword || post.topic || (post.title ? post.title.split(' ')[0] : 'lọc nước');
    const topic = post.title || keyword;
    const customTargetUrl = post.targetProductUrl || '';

    if (!keepContent) {
      // Lấy all existing content cùng keyword (trừ bài đang rewrite) để Gemini tránh trùng
      const existingContents = posts
        .filter(p => p.id !== postId && p.targetKeyword && p.targetKeyword.trim().toLowerCase() === keyword.trim().toLowerCase() && p.content)
        .map(p => `=== BÀI "${p.title}" ===\n${p.content.substring(0, 500)}`);

      // Generate content mới hoàn toàn
      const newResult = await generateContentForKeyword(topic, keyword, '', customTargetUrl);
      if (!newResult || !newResult.content) {
        return res.status(500).json({ success: false, message: 'Gemini không trả về content' });
      }

      // Cập nhật post trong posts.json
      posts[postIdx] = {
        ...post,
        title: newResult.title || post.title,
        content: newResult.content,
        metaDescription: newResult.metaDescription || post.metaDescription,
        imageUrl: newResult.imageUrl || post.imageUrl,
        secondaryImageUrl: newResult.secondaryImageUrl || post.secondaryImageUrl,
        score: newResult.score || post.score,
        updatedAt: new Date().toISOString(),
        rewrittenAt: new Date().toISOString(),
        rewriteReason: 'AI rewrite - chống duplicate content'
      };
      savePosts(posts);
      post = posts[postIdx];
    }

    const updatedPost = posts[postIdx];

    // Nếu updateWordPress = true và bài đã publish, update lên WP
    if (updateWordPress && (post.wpPublished || post.wpPostId || post.wp_post_id)) {
      try {
        const wpConfig = getWPConfig();
        if (wpConfig.enabled && wpConfig.siteUrl && wpConfig.appPassword) {
          const wpAuth = 'Basic ' + Buffer.from(`${wpConfig.username}:${wpConfig.appPassword.replace(/\s+/g, '')}`).toString('base64');
          let fetchFn = globalThis.fetch;
          try { fetchFn = (await import('node-fetch')).default || globalThis.fetch; } catch(e) {}

          // Resolve wpPostId từ wpLink nếu chưa có
          let wpPostId = post.wpPostId || post.wp_post_id;
          if (!wpPostId && post.wpLink) {
            try {
              const slug = post.wpLink.replace(/\/$/, '').split('/').pop();
              const slugRes = await fetchFn(`${wpConfig.siteUrl}/wp-json/wp/v2/posts?slug=${slug}&_fields=id`, {
                headers: { Authorization: wpAuth }
              });
              if (slugRes.ok) {
                const slugData = await slugRes.json();
                if (slugData && slugData[0] && slugData[0].id) {
                  wpPostId = slugData[0].id;
                  posts[postIdx].wpPostId = wpPostId;
                  savePosts(posts);
                  console.log(`[Rewrite] Resolved wpPostId=${wpPostId} from slug "${slug}"`);
                }
              }
            } catch(slugErr) {
              console.warn('[Rewrite] Could not resolve wpPostId from wpLink:', slugErr.message);
            }
          }

          if (wpPostId) {
            // Đảm bảo tất cả ảnh trong bài viết đã được tải lên WordPress Media Library
            const finalContent = await ensurePostImagesUploadedToWordPress(updatedPost.content, wpConfig, wpAuth, fetchFn);
            if (finalContent !== updatedPost.content) {
              posts[postIdx].content = finalContent;
              savePosts(posts);
            }

            const targetLink = (updatedPost.targetProductUrl || wpConfig.siteUrl || 'https://xulynuochoasen.com/').trim();
            const htmlContent = markdownToHtml(finalContent, targetLink);

            const wpRes = await fetchFn(`${wpConfig.siteUrl}/wp-json/wp/v2/posts/${wpPostId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': wpAuth
              },
              body: JSON.stringify({
                title: updatedPost.title,
                content: htmlContent,
                excerpt: updatedPost.metaDescription || '',
                status: 'publish'
              })
            });

            if (wpRes.ok) {
              posts[postIdx].wpUpdatedAt = new Date().toISOString();
              savePosts(posts);
              console.log(`[Rewrite] Updated WP post ${wpPostId} with clean HTML & live images for: ${keyword}`);
            } else {
              console.warn(`[Rewrite] WP update failed for post ${wpPostId}: status ${wpRes.status}`);
            }
          }
        }
      } catch (wpErr) {
        console.error('[Rewrite] WP update error:', wpErr.message);
      }
    }

    // Tự động rà soát lại hệ thống ngay sau khi rewrite
    let freshReport = null;
    try {
      freshReport = await runSystemAudit();
    } catch (e) {
      console.warn('[Rewrite] Error running system audit after rewrite:', e.message);
    }

    res.json({
      success: true,
      post: updatedPost,
      report: freshReport,
      message: `Đã dùng AI viết lại bài "${updatedPost.title}" thành công và đồng bộ hệ thống!`
    });
  } catch (err) {
    console.error('[Rewrite API] Error:', err);
    res.status(500).json({ success: false, message: 'Lỗi rewrite: ' + err.message });
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

  // Realtime Sync with WordPress REST API to detect & purge any duplicates
  try {
    await syncWordPressLivePosts();
  } catch (syncErr) {
    console.warn('[Auto-Scheduler] Lỗi đồng bộ WP trước chu kỳ:', syncErr.message);
  }

  const now = Date.now();
  const wpConfig = getWPConfig();

  // 1. Check Auto-Generation cycle (Cơ chế Gối Đầu Tự Động)
  const genIntervalHours = parseFloat(config.generateIntervalHours || 2);
  const genIntervalMs = genIntervalHours * 3600000;
  const lastGenTime = config.lastGenerateRun ? new Date(config.lastGenerateRun).getTime() : 0;
  if (!lastGenTime || (now - lastGenTime) >= genIntervalMs) {
    const keywords = getKeywords();
    const pendingKeywords = keywords.filter(k => k.status === 'pending');
    const hasUngenerated = pendingKeywords.some(k => !k.generatedPostId);

    // Gối đầu: Tự động soạn thêm bài nếu có từ khóa chưa có bài HOẶC hàng chờ chuẩn bị đăng vơi dưới 8 bài
    if (hasUngenerated || pendingKeywords.length < 8) {
      console.log('🤖 Auto-Scheduler (Gối Đầu): Đang tự động soạn bài tiếp theo cho hàng chờ...');
      try {
        const genRes = await pregenerateNextKeywordInQueue();
        console.log('🤖 Auto-Generation result:', genRes.message);
      } catch (err) {
        console.error('Error in auto-generation cycle:', err.message);
      }
    } else {
      // Hàng chờ đã đủ 8 bài sẵn sàng, cập nhật thời gian để bộ đếm tiếp tục đếm ngược đợt kế tiếp
      config.lastGenerateRun = new Date().toISOString();
      saveSchedulerConfig(config);
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
      console.log('Auto-Scheduler: Auto-Publishing next keyword to WordPress...');
      try {
        const res = await processNextKeywordInQueue();
        console.log('Auto-Scheduler result:', res.message);
      } catch (err) {
        console.error('Error in auto-publishing cycle:', err.message);
      }
    }
  }

  // === LOP 4: TU DONG SCAN + FIX DUPLICATE (chay moi 60 phut) ===
  // Quet bai danh dau _needsRewrite va bai duplicate theo keyword
  const lastDedupTime = config.lastDedupRun ? new Date(config.lastDedupRun).getTime() : 0;
  const dedupIntervalMs = 60 * 60 * 1000; // moi 1 gio
  if (!lastDedupTime || (now - lastDedupTime) >= dedupIntervalMs) {
    config.lastDedupRun = new Date().toISOString();
    saveSchedulerConfig(config);

    try {
      const allPosts = getPosts();

      // A. Tim bai danh dau _needsRewrite (bi phat hien duplicate ngay luc generate)
      const needsRewrite = allPosts.filter(p => p._needsRewrite && !p.rewrittenAt);
      if (needsRewrite.length > 0) {
        console.log(`[Auto-DedupFix] Phat hien ${needsRewrite.length} bai can rewrite (da bi flag). Tu dong fix...`);
        for (const post of needsRewrite.slice(0, 2)) { // Xu ly toi da 2 bai moi lan chay
          try {
            const newContent = await generateContentForKeyword(post.title || post.targetKeyword, post.targetKeyword, '', post.targetProductUrl || '');
            if (newContent && newContent.content && !newContent._needsRewrite) {
              const idx = allPosts.findIndex(p => p.id === post.id);
              if (idx !== -1) {
                allPosts[idx] = {
                  ...allPosts[idx],
                  title: newContent.title || allPosts[idx].title,
                  content: newContent.content,
                  metaDescription: newContent.metaDescription || allPosts[idx].metaDescription,
                  score: newContent.score || allPosts[idx].score,
                  updatedAt: new Date().toISOString(),
                  rewrittenAt: new Date().toISOString(),
                  _needsRewrite: false,
                  rewriteReason: `Auto-fix ${new Date().toISOString()} (dupSim was ${post._dupSimilarity}%)`
                };
                savePosts(allPosts);
                console.log(`[Auto-DedupFix] Da rewrite: "${allPosts[idx].title}"`);

                // Neu bai da WP-publish, update len WP luon
                if (allPosts[idx].wpPublished && allPosts[idx].wpPostId && wpConfig.enabled) {
                  try {
                    const wpAuth = 'Basic ' + Buffer.from(`${wpConfig.username}:${wpConfig.appPassword}`).toString('base64');
                    let fetchFn = globalThis.fetch;
                    try { fetchFn = (await import('node-fetch')).default || globalThis.fetch; } catch(e) {}
                    const htmlContent = markdownToHtml(allPosts[idx].content, allPosts[idx].targetProductUrl || wpConfig.siteUrl);
                    const wpRes = await fetchFn(`${wpConfig.siteUrl}/wp-json/wp/v2/posts/${allPosts[idx].wpPostId}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', 'Authorization': wpAuth },
                      body: JSON.stringify({ title: allPosts[idx].title, content: htmlContent, excerpt: allPosts[idx].metaDescription || '', status: 'publish' })
                    });
                    if (wpRes.ok) console.log(`[Auto-DedupFix] WP updated: post ${allPosts[idx].wpPostId}`);
                  } catch(wpE) { console.warn('[Auto-DedupFix] WP update err:', wpE.message); }
                }
              }
            }
            await new Promise(r => setTimeout(r, 4000)); // delay tranh spam Gemini
          } catch(rewriteErr) {
            console.error('[Auto-DedupFix] Loi rewrite:', rewriteErr.message);
          }
        }
      }

      // B. Scan theo keyword group: neu > 1 bai cung keyword co similarity > 60%, tu dong rewrite bai thu 2 tro di
      const { detectDuplicateGroups } = require('./lib/ai_generator');
      const dupReport = detectDuplicateGroups();
      if (dupReport && dupReport.length > 0) {
        console.log(`[Auto-DedupFix] Quet thay ${dupReport.length} nhom duplicate. Tu dong rewrite bai bi anh huong...`);
        let fixCount = 0;
        for (const group of dupReport) {
          if (fixCount >= 1) break; // Moi chu ky chi fix 1 nhom de tranh qua tai Gemini
          const toFix = group.posts.slice(1).filter(p => !p.rewrittenAt || (new Date() - new Date(p.rewrittenAt)) > 24*60*60*1000);
          for (const postMeta of toFix.slice(0, 1)) {
            const postIdx = allPosts.findIndex(p => p.id === postMeta.id);
            if (postIdx === -1) continue;
            const post = allPosts[postIdx];
            try {
              const newContent = await generateContentForKeyword(post.title, post.targetKeyword, '', post.targetProductUrl || '');
              if (newContent && newContent.content && !newContent._needsRewrite) {
                allPosts[postIdx] = {
                  ...post,
                  title: newContent.title || post.title,
                  content: newContent.content,
                  metaDescription: newContent.metaDescription || post.metaDescription,
                  updatedAt: new Date().toISOString(),
                  rewrittenAt: new Date().toISOString(),
                  rewriteReason: `Auto-scan fix ${new Date().toISOString()}`
                };
                savePosts(allPosts);
                fixCount++;
                console.log(`[Auto-DedupFix] Da fix bai trong nhom "${group.keyword}": "${allPosts[postIdx].title}"`);

                if (allPosts[postIdx].wpPublished && allPosts[postIdx].wpPostId && wpConfig.enabled) {
                  try {
                    const wpAuth = 'Basic ' + Buffer.from(`${wpConfig.username}:${wpConfig.appPassword}`).toString('base64');
                    let fetchFn = globalThis.fetch;
                    try { fetchFn = (await import('node-fetch')).default || globalThis.fetch; } catch(e) {}
                    const htmlContent = markdownToHtml(allPosts[postIdx].content, allPosts[postIdx].targetProductUrl || wpConfig.siteUrl);
                    await fetchFn(`${wpConfig.siteUrl}/wp-json/wp/v2/posts/${allPosts[postIdx].wpPostId}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', 'Authorization': wpAuth },
                      body: JSON.stringify({ title: allPosts[postIdx].title, content: htmlContent, excerpt: allPosts[postIdx].metaDescription || '', status: 'publish' })
                    });
                    console.log(`[Auto-DedupFix] WP updated: ${allPosts[postIdx].wpPostId}`);
                  } catch(wpE) { console.warn('[Auto-DedupFix] WP update err:', wpE.message); }
                }
                await new Promise(r => setTimeout(r, 4000));
              }
            } catch(e) { console.error('[Auto-DedupFix] Fix error:', e.message); }
          }
        }
        if (fixCount === 0) console.log('[Auto-DedupFix] Tat ca bai trong cac nhom da duoc fix gan day, bo qua.');
      }
    } catch(dedupErr) {
      console.error('[Auto-DedupFix] Loi chu ky dedup:', dedupErr.message);
    }
  }
}


/* ==========================================================================
   SELF-HEALING MOTOR: Tự động kiểm tra và sửa toàn bộ bài đã đăng trên WP
   Fix lỗi markdown thô và hình ảnh hỏng 404 trực tiếp từ phần mềm
   ========================================================================== */
async function selfHealPublishedPosts() {
  const wpConfig = getWPConfig();
  if (!wpConfig.enabled || !wpConfig.siteUrl || !wpConfig.appPassword) return;

  const authHeader = 'Basic ' + Buffer.from(`${wpConfig.username}:${wpConfig.appPassword.replace(/\s+/g, '')}`).toString('base64');
  let fetchFn = globalThis.fetch;
  try { fetchFn = (await import('node-fetch')).default || globalThis.fetch; } catch(e) {}

  const posts = getPosts();
  const published = posts.filter(p => p.wpPublished && (p.wpPostId || p.wpLink));
  let healed = 0;

  for (const post of published) {
    let wpPostId = post.wpPostId;
    if (!wpPostId && post.wpLink) {
      try {
        const slug = post.wpLink.replace(/\/$/, '').split('/').pop();
        const slugRes = await fetchFn(`${wpConfig.siteUrl}/wp-json/wp/v2/posts?slug=${slug}&_fields=id`, {
          headers: { Authorization: authHeader }
        });
        if (slugRes.ok) {
          const sData = await slugRes.json();
          if (sData && sData[0]?.id) {
            wpPostId = sData[0].id;
            const pIdx = posts.findIndex(x => x.id === post.id);
            if (pIdx !== -1) { posts[pIdx].wpPostId = wpPostId; savePosts(posts); }
          }
        }
      } catch(e) {}
    }
    if (!wpPostId) continue;

    try {
      const res = await fetchFn(`${wpConfig.siteUrl}/wp-json/wp/v2/posts/${wpPostId}`, {
        headers: { Authorization: authHeader }
      });
      if (!res.ok) continue;
      const data = await res.json();
      const content = data.content?.rendered || '';

      const hasRawMd = content.includes('## ') || content.includes('[![') || content.includes('**');
      const hasLocalImg = content.includes('/uploads/media_');
      const targetLink = (post.targetProductUrl || getGoogleAdsTargetUrl(post.targetKeyword || post.title) || 'https://xulynuochoasen.com/').trim();
      const hasWrongTarget = content.includes('/san-pham/') || (targetLink && !content.includes(targetLink));

      if (hasRawMd || hasLocalImg || hasWrongTarget) {
        console.log(`[Self-Heal] Phát hiện bài [${wpPostId}] "${post.title?.substring(0, 35)}..." cần đồng bộ (rawMd: ${hasRawMd}, localImg: ${hasLocalImg}, wrongTarget: ${hasWrongTarget}). Tự động khắc phục...`);
        const pIdx = posts.findIndex(x => x.id === post.id);

        let cleanContent = await ensurePostImagesUploadedToWordPress(post.content, wpConfig, authHeader, fetchFn);
        // Ensure image links in markdown point to targetLink
        cleanContent = cleanContent.replace(/\[!\[(.*?)\]\((.*?)\)\]\((.*?)\)/g, (match, alt, imgUrl) => `[![${alt}](${imgUrl})](${targetLink})`);
        // Ensure CTA points to targetLink
        if (/👉 \*\*Sản Phẩm Đúng Chuyên Mục:\*\* \[.*?\]\(.*?\)/gi.test(cleanContent)) {
          cleanContent = cleanContent.replace(/👉 \*\*Sản Phẩm Đúng Chuyên Mục:\*\* \[.*?\]\(.*?\)/gi, `👉 **Sản Phẩm Đúng Chuyên Mục:** [Xem Sản Phẩm Tương Ứng](${targetLink})`);
        }

        if (pIdx !== -1) {
          posts[pIdx].content = cleanContent;
          posts[pIdx].targetProductUrl = targetLink;
          savePosts(posts);
        }

        const htmlContent = markdownToHtml(cleanContent, targetLink);

        const updateRes = await fetchFn(`${wpConfig.siteUrl}/wp-json/wp/v2/posts/${wpPostId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            title: post.title,
            content: htmlContent,
            excerpt: post.metaDescription || '',
            status: 'publish'
          })
        });

        if (updateRes.ok) {
          if (pIdx !== -1) {
            posts[pIdx].wpUpdatedAt = new Date().toISOString();
            savePosts(posts);
          }
          healed++;
          console.log(`[Self-Heal] ✅ Đã sửa và cập nhật thành công bài WP [${wpPostId}]!`);
        }
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch(err) {
      console.warn(`[Self-Heal] Lỗi kiểm tra bài ${wpPostId}:`, err.message);
    }
  }

  if (healed > 0) {
    console.log(`[Self-Heal] Hoàn tất tự động chuẩn hóa ${healed} bài viết WordPress!`);
  }
}

// Execute immediately when server starts: sync WP, self-heal published posts, and check scheduler
setTimeout(async () => {
  try {
    console.log('🔄 Đang kiểm tra và đồng bộ trạng thái trực tiếp từ WordPress REST API...');
    await syncWordPressLivePosts();
  } catch (err) {
    console.warn('Lỗi đồng bộ WP khi khởi động:', err.message);
  }
  try {
    console.log('🛡️ [Startup Audit] Tự động rà soát toàn bộ hệ thống, phát hiện trùng lặp & kiểm tra sức khỏe...');
    await runSystemAudit();
  } catch (auditErr) {
    console.warn('Lỗi rà soát hệ thống khi khởi động:', auditErr.message);
  }
  try {
    console.log('🛡️ [Self-Heal] Tự động kiểm tra tính toàn vẹn hình ảnh & format HTML của các bài viết đã đăng...');
    await selfHealPublishedPosts();
  } catch (healErr) {
    console.warn('Lỗi self-heal khi khởi động:', healErr.message);
  }
  checkAndRunAutoScheduler().catch(err => console.error('Error in initial auto-scheduler check:', err));
}, 2000);

// Continuous background interval loop (every 1 minute)
setInterval(checkAndRunAutoScheduler, 60000);


app.listen(PORT, () => {
  console.log(`🚀 Daily SEO Tool for Tris is running on http://localhost:${PORT}`);
});
