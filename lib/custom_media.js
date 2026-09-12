// Custom Media Manager for SEO Daily Tool (Uploads & Verified Library)

const fs = require('fs');
const path = require('path');

const BASE_DIR = process.pkg ? process.cwd() : path.join(__dirname, '..');
const MEDIA_FILE = path.join(BASE_DIR, 'data/custom_media.json');
const VERIFIED_MEDIA_FILE = path.join(BASE_DIR, 'data/verified_wp_images.json');
const HISTORY_FILE = path.join(BASE_DIR, 'data/used_images_history.json');
const UPLOADS_DIR = path.join(BASE_DIR, 'public/uploads');

const KHO_1_FILE = path.join(BASE_DIR, 'data/kho_1_sinh_hoat.json');
const KHO_2_FILE = path.join(BASE_DIR, 'data/kho_2_cong_nghiep.json');
const KHO_3_FILE = path.join(BASE_DIR, 'data/kho_3_tinh_khiet_ro.json');

function initMediaStorage() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(MEDIA_FILE)) {
    fs.writeFileSync(MEDIA_FILE, JSON.stringify([], null, 2), 'utf8');
  }
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function syncKhoFiles(mediaList) {
  try {
    const k1 = mediaList.filter(m => categorizeImage(m) === 'kho_1');
    const k2 = mediaList.filter(m => categorizeImage(m) === 'kho_2');
    const k3 = mediaList.filter(m => categorizeImage(m) === 'kho_3');

    fs.writeFileSync(KHO_1_FILE, JSON.stringify(k1, null, 2), 'utf8');
    fs.writeFileSync(KHO_2_FILE, JSON.stringify(k2, null, 2), 'utf8');
    fs.writeFileSync(KHO_3_FILE, JSON.stringify(k3, null, 2), 'utf8');
  } catch (err) {
    console.error('Lỗi khi đồng bộ 3 file kho:', err);
  }
}

function getUsedHistory() {
  initMediaStorage();
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || '[]');
    }
  } catch (e) {}
  return [];
}

function recordUsedImages(urls = []) {
  initMediaStorage();
  try {
    let history = getUsedHistory();
    urls.forEach(u => {
      if (u && !history.includes(u)) history.push(u);
    });
    // Keep last 250 URLs in history
    if (history.length > 250) {
      history = history.slice(-250);
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
  } catch (e) {}
}

function getCustomMedia() {
  initMediaStorage();
  try {
    if (fs.existsSync(MEDIA_FILE)) {
      const list = JSON.parse(fs.readFileSync(MEDIA_FILE, 'utf8') || '[]');
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  } catch (err) {}
  return [];
}

function saveCustomMedia(mediaList) {
  initMediaStorage();
  fs.writeFileSync(MEDIA_FILE, JSON.stringify(mediaList, null, 2), 'utf8');
  syncKhoFiles(mediaList);
}

// Convert Google Drive share link to direct embeddable image URL
function convertGoogleDriveLink(driveUrl) {
  if (!driveUrl) return '';
  const match = driveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || driveUrl.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    const fileId = match[1];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }
  return driveUrl;
}

// Helper: Determine which of the 3 Kho an image belongs to
function categorizeImage(img) {
  if (img.kho && (img.kho === 'kho_1' || img.kho === 'kho_2' || img.kho === 'kho_3')) {
    return img.kho;
  }
  const tag = (img.tagKeyword || '').toLowerCase();
  if (tag.includes('sinh hoạt') || tag.includes('giếng') || tag.includes('phèn') || tag.includes('kho_1')) return 'kho_1';
  if (tag.includes('công nghiệp') || tag.includes('kho_2')) return 'kho_2';
  if (tag.includes('mặn') || tag.includes('tinh khiết') || tag.includes('ro') || tag.includes('kho_3')) return 'kho_3';

  const str = `${img.title || ''} ${img.slug || ''} ${img.url || ''} ${img.alt || ''} ${img.filename || ''}`.toLowerCase();
  if (str.includes('ro') || str.includes('tinh-khiet') || str.includes('man') || str.includes('khu-man')) return 'kho_3';
  if (str.includes('cong-nghiep') || str.includes('nha-xuong') || str.includes('cong_nghiep')) return 'kho_2';
  if (str.includes('phen') || str.includes('sat') || str.includes('gieng') || str.includes('sinh-hoat')) return 'kho_1';
  return 'general';
}

// Map any keyword/topic to one of the 3 designated Kho
function getKeywordKho(keyword = '') {
  const lowerKw = (keyword || '').toLowerCase().trim();
  if (lowerKw.includes('công nghiệp') || lowerKw.includes('nhà xưởng') || lowerKw.includes('xí nghiệp') || lowerKw.includes('công suất lớn')) {
    return 'kho_2';
  }
  if (lowerKw.includes('mặn') || lowerKw.includes('tinh khiết') || lowerKw.includes('ro') || lowerKw.includes('nước lợ') || lowerKw.includes('đóng bình') || lowerKw.includes('uống')) {
    return 'kho_3';
  }
  // Default to Kho 1: Lọc nước phèn, giếng khoan, sinh hoạt
  return 'kho_1';
}

function findMatchingCustomImage(keyword, index = 0, excludeUrls = []) {
  const mediaList = getCustomMedia();
  if (mediaList.length === 0) return null;

  const targetKho = getKeywordKho(keyword);
  const khoMatches = mediaList.filter(m => categorizeImage(m) === targetKho);
  const pool = khoMatches.length > 0 ? khoMatches : mediaList;

  const filtered = pool.filter(m => !excludeUrls.includes(m.url));
  const finalPool = filtered.length > 0 ? filtered : pool;

  return finalPool[index % finalPool.length].url;
}

// Pick 2 completely distinct, non-repeating images for an article from the EXACT Kho matching the keyword
function getTwoDistinctRotatedImages(keyword = '', recentUsedUrls = []) {
  initMediaStorage();
  const mediaList = getCustomMedia();
  if (!mediaList || mediaList.length === 0) {
    return {
      img1: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4e?w=800&auto=format&fit=crop&q=80',
      img2: 'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=800&auto=format&fit=crop&q=80'
    };
  }

  // 1. Determine target Kho for this keyword
  const targetKho = getKeywordKho(keyword);

  // 2. Filter available pool specifically for this Kho
  const khoAllImages = mediaList.filter(m => categorizeImage(m) === targetKho);
  const candidateBase = khoAllImages.length >= 2 ? khoAllImages : mediaList;

  // 3. Exclude recently used images to guarantee rotation
  const history = getUsedHistory();
  const excludeSet = new Set([...recentUsedUrls, ...history]);

  let availablePool = candidateBase.filter(m => !excludeSet.has(m.url));

  // If pool has less than 2 available, reset exclusion to keep circulating inside this Kho
  if (availablePool.length < 2) {
    availablePool = candidateBase.filter(m => !recentUsedUrls.includes(m.url));
    if (availablePool.length < 2) availablePool = candidateBase;
  }

  // 4. Shuffle and pick 2 distinct images
  const shuffled = [...availablePool].sort(() => Math.random() - 0.5);
  const img1Obj = shuffled[0];
  let img2Obj = shuffled.find(m => m.url !== img1Obj.url);

  if (!img2Obj) {
    const fallbackShuffled = [...candidateBase].sort(() => Math.random() - 0.5);
    img2Obj = fallbackShuffled.find(m => m.url !== img1Obj.url) || candidateBase[1] || candidateBase[0];
  }

  const img1 = img1Obj.url;
  const img2 = img2Obj.url;

  // Record into persistent history
  recordUsedImages([img1, img2]);

  const res = {
    img1,
    img2,
    img1Id: img1Obj.id || null,
    img2Id: img2Obj.id || null,
    targetKho
  };
  res[0] = img1;
  res[1] = img2;
  res[Symbol.iterator] = function* () { yield img1; yield img2; };
  return res;
}

// Get paginated gallery for UI image picker
function getMediaGallery({ category = 'all', search = '', page = 1, limit = 24 } = {}) {
  const mediaList = getCustomMedia();
  let filtered = mediaList;

  if (category && category !== 'all') {
    filtered = filtered.filter(m => categorizeImage(m) === category);
  }

  if (search && search.trim()) {
    const s = search.trim().toLowerCase();
    filtered = filtered.filter(m => {
      const text = `${m.filename || ''} ${m.tagKeyword || ''} ${m.title || ''} ${m.slug || ''} ${m.url || ''} ${m.alt || ''}`.toLowerCase();
      return text.includes(s);
    });
  }

  const total = filtered.length;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
  const items = filtered.slice(offset, offset + parseInt(limit)).map(m => ({
    id: m.id,
    url: m.url,
    title: m.filename || m.tagKeyword || m.title || 'Ảnh thực tế Hoa Sen',
    category: categorizeImage(m)
  }));

  return {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit)),
    items
  };
}

// Update images for a specific post in data/posts.json
function updatePostImages(postId, { img1, img2, featured_image } = {}) {
  const postsFile = path.join(BASE_DIR, 'data/posts.json');
  if (!fs.existsSync(postsFile)) return { success: false, message: 'posts.json not found' };

  try {
    const posts = JSON.parse(fs.readFileSync(postsFile, 'utf8') || '[]');
    const post = posts.find(p => String(p.id) === String(postId));
    if (!post) return { success: false, message: 'Post not found' };

    if (img1) {
      post.imageUrl = img1;
      post.featured_image = img1;
    }
    if (img2) {
      post.secondaryImageUrl = img2;
    }
    if (featured_image) {
      post.featured_image = featured_image;
    }

    // Replace images in content if markdown image syntax exists
    if (post.content && (img1 || img2)) {
      let count = 0;
      post.content = post.content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt) => {
        if (count === 0 && img1) {
          count++;
          return `![${alt || post.targetKeyword || 'Lọc nước'}](${img1})`;
        } else if (count === 1 && img2) {
          count++;
          return `![${alt || post.targetKeyword || 'Lọc nước'}](${img2})`;
        }
        return match;
      });
    }

    fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2), 'utf8');
    return { success: true, post };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// Randomize fresh images for a specific post in data/posts.json
function randomizePostImages(postId) {
  const postsFile = path.join(BASE_DIR, 'data/posts.json');
  if (!fs.existsSync(postsFile)) return { success: false, message: 'posts.json not found' };

  try {
    const posts = JSON.parse(fs.readFileSync(postsFile, 'utf8') || '[]');
    const post = posts.find(p => String(p.id) === String(postId));
    if (!post) return { success: false, message: 'Post not found' };

    // Gather images from other posts to avoid collision
    const otherUrls = [];
    posts.forEach(p => {
      if (p.id !== post.id) {
        if (p.imageUrl) otherUrls.push(p.imageUrl);
        if (p.secondaryImageUrl) otherUrls.push(p.secondaryImageUrl);
      }
    });

    const { img1, img2 } = getTwoDistinctRotatedImages(post.targetKeyword || post.title, otherUrls);
    return updatePostImages(postId, { img1, img2, featured_image: img1 });
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function rotateMediaToAllPosts() {
  const mediaList = getCustomMedia();
  if (!mediaList || mediaList.length === 0) return { success: false, message: 'Chưa có ảnh nào trong kho thư viện' };

  const postsFile = path.join(BASE_DIR, 'data/posts.json');
  if (!fs.existsSync(postsFile)) return { success: false, message: 'Không tìm thấy file posts.json' };

  try {
    const posts = JSON.parse(fs.readFileSync(postsFile, 'utf8'));
    let updatedCount = 0;

    posts.forEach((post, i) => {
      const img1Obj = mediaList[(i * 2) % mediaList.length];
      const img2Obj = mediaList[(i * 2 + 1) % mediaList.length];

      const img1Url = img1Obj.url;
      const img2Url = img2Obj.url;

      post.imageUrl = img1Url;
      post.secondaryImageUrl = img2Url;
      post.featured_image = img1Url;

      if (post.content) {
        let imageIdx = 0;
        post.content = post.content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt) => {
          if (imageIdx === 0) {
            imageIdx++;
            return `![${alt || post.targetKeyword || 'Lọc nước'}](${img1Url})`;
          } else {
            imageIdx++;
            return `![${alt || post.targetKeyword || 'Lọc nước'}](${img2Url})`;
          }
        });
      }
      updatedCount++;
    });

    fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2), 'utf8');
    return { success: true, updatedCount, totalMedia: mediaList.length };
  } catch (err) {
    console.error('Lỗi khi xoay vòng ảnh:', err);
    return { success: false, message: err.message };
  }
}

// Rotate images of a specific Kho into only posts that match that Kho's keywords
function rotateKhoMediaToPosts(khoId) {
  const mediaList = getCustomMedia();
  const khoImages = mediaList.filter(m => categorizeImage(m) === khoId);
  if (khoImages.length === 0) {
    return { success: false, message: `Kho ${khoId} hiện chưa có ảnh nào để xoay vòng.` };
  }

  const postsFile = path.join(BASE_DIR, 'data/posts.json');
  if (!fs.existsSync(postsFile)) return { success: false, message: 'Không tìm thấy file posts.json' };

  try {
    const posts = JSON.parse(fs.readFileSync(postsFile, 'utf8'));
    let updatedCount = 0;

    posts.forEach((post, i) => {
      const kw = post.targetKeyword || post.keyword || post.title || '';
      const postKho = getKeywordKho(kw);
      if (postKho !== khoId) return; // Skip posts belonging to other Kho

      const img1Obj = khoImages[(i * 2) % khoImages.length];
      const img2Obj = khoImages[(i * 2 + 1) % khoImages.length];

      const img1Url = img1Obj.url;
      const img2Url = img2Obj.url;

      post.imageUrl = img1Url;
      post.featured_image = img1Url;
      post.secondaryImageUrl = img2Url;

      if (post.content) {
        let count = 0;
        post.content = post.content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt) => {
          count++;
          if (count === 1) return `![${alt || kw || 'Thiết bị lọc nước'}](${img1Url})`;
          if (count === 2) return `![${alt || kw || 'Chi tiết kỹ thuật'}](${img2Url})`;
          return match;
        });
      }
      updatedCount++;
    });

    fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2), 'utf8');
    return { success: true, updatedCount, totalKhoImages: khoImages.length, khoId };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function bulkUpdateKho(ids = [], newKho) {
  if (!Array.isArray(ids) || ids.length === 0 || !newKho) {
    return { success: false, message: 'Danh sách ID hoặc kho không hợp lệ.' };
  }
  const KHO_TAGS = {
    kho_1: 'Lọc Nước Sinh Hoạt, Giếng Khoan, Phèn',
    kho_2: 'Lọc Nước Công Nghiệp',
    kho_3: 'Lọc Nước Mặn, Tinh Khiết RO'
  };

  const mediaList = getCustomMedia();
  let updated = 0;
  ids.forEach(id => {
    const item = mediaList.find(m => m.id === id);
    if (item) {
      item.kho = newKho;
      item.tagKeyword = KHO_TAGS[newKho] || newKho;
      item.categoryName = KHO_TAGS[newKho] || newKho;
      updated++;
    }
  });

  saveCustomMedia(mediaList);
  return { success: true, updatedCount: updated, targetKho: newKho };
}

function bulkDeleteMedia(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, message: 'Không có ID nào được chọn để xóa.' };
  }
  let mediaList = getCustomMedia();
  const initial = mediaList.length;
  mediaList = mediaList.filter(m => !ids.includes(m.id));
  const deleted = initial - mediaList.length;
  saveCustomMedia(mediaList);
  return { success: true, deletedCount: deleted };
}

module.exports = {
  getCustomMedia,
  saveCustomMedia,
  syncKhoFiles,
  convertGoogleDriveLink,
  findMatchingCustomImage,
  getTwoDistinctRotatedImages,
  rotateMediaToAllPosts,
  rotateKhoMediaToPosts,
  bulkUpdateKho,
  bulkDeleteMedia,
  categorizeImage,
  getKeywordKho,
  getMediaGallery,
  updatePostImages,
  randomizePostImages,
  UPLOADS_DIR,
  KHO_1_FILE,
  KHO_2_FILE,
  KHO_3_FILE
};
