// Custom Media Manager for SEO Daily Tool (Uploads & Verified Library)

const fs = require('fs');
const path = require('path');

const BASE_DIR = process.pkg ? process.cwd() : path.join(__dirname, '..');
const MEDIA_FILE = path.join(BASE_DIR, 'data/custom_media.json');
const VERIFIED_MEDIA_FILE = path.join(BASE_DIR, 'data/verified_wp_images.json');
const HISTORY_FILE = path.join(BASE_DIR, 'data/used_images_history.json');
const UPLOADS_DIR = path.join(BASE_DIR, 'public/uploads');

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

// Tag / Categorize an image for smart filtering
function categorizeImage(img) {
  const str = `${img.title || ''} ${img.slug || ''} ${img.url || ''} ${img.alt || ''}`.toLowerCase();
  if (str.includes('phen') || str.includes('sat') || str.includes('nhiem-phen')) return 'phen';
  if (str.includes('ro') || str.includes('tinh-khiet') || str.includes('uong') || str.includes('dong-binh')) return 'ro';
  if (str.includes('gieng') || str.includes('ngam') || str.includes('khoan')) return 'gieng';
  if (str.includes('sinh-hoat') || str.includes('tong') || str.includes('may') || str.includes('nha-pho') || str.includes('chung-cu')) return 'sinh_hoat';
  if (str.includes('cong-nghiep') || str.includes('lon') || str.includes('nha-xuong') || str.includes('1000l')) return 'cong_nghiep';
  return 'general';
}

function findMatchingCustomImage(keyword, index = 0, excludeUrls = []) {
  const mediaList = getCustomMedia();
  if (mediaList.length === 0) return null;

  const lowerKw = (keyword || '').toLowerCase().trim();
  const kwWords = lowerKw.split(/\s+/).filter(w => w.length > 2);

  const matches = mediaList.filter(m => {
    const searchStr = `${m.title || ''} ${m.alt || ''} ${m.slug || ''} ${m.url || ''}`.toLowerCase().trim();
    return kwWords.some(w => searchStr.includes(w));
  });

  const available = matches.length > 0 ? matches : mediaList;
  const filtered = available.filter(m => !excludeUrls.includes(m.url));
  const finalPool = filtered.length > 0 ? filtered : available;

  return finalPool[index % finalPool.length].url;
}

// Pick 2 completely distinct, non-repeating images for an article
function getTwoDistinctRotatedImages(keyword = '', recentUsedUrls = []) {
  initMediaStorage();
  const mediaList = getCustomMedia();
  if (!mediaList || mediaList.length === 0) {
    return {
      img1: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4e?w=800&auto=format&fit=crop&q=80',
      img2: 'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=800&auto=format&fit=crop&q=80'
    };
  }

  // Combine recent caller-supplied exclusions and persistent history
  const history = getUsedHistory();
  const excludeSet = new Set([...recentUsedUrls, ...history]);

  let availablePool = mediaList.filter(m => !excludeSet.has(m.url));

  // If pool has less than 10 available, reset history to keep circulating
  if (availablePool.length < 10) {
    availablePool = mediaList.filter(m => !recentUsedUrls.includes(m.url));
    if (availablePool.length < 2) availablePool = mediaList;
  }

  // Determine keyword domain
  const lowerKw = (keyword || '').toLowerCase().trim();
  let targetDomain = 'general';
  if (lowerKw.includes('phèn') || lowerKw.includes('sắt')) targetDomain = 'phen';
  else if (lowerKw.includes('tinh khiết') || lowerKw.includes('ro') || lowerKw.includes('uống')) targetDomain = 'ro';
  else if (lowerKw.includes('giếng') || lowerKw.includes('ngầm')) targetDomain = 'gieng';
  else if (lowerKw.includes('sinh hoạt') || lowerKw.includes('đầu nguồn') || lowerKw.includes('nước máy')) targetDomain = 'sinh_hoat';
  else if (lowerKw.includes('công nghiệp') || lowerKw.includes('nhà xưởng')) targetDomain = 'cong_nghiep';

  // Find candidate matches in available pool
  let domainCandidates = availablePool.filter(m => categorizeImage(m) === targetDomain);
  let pool = domainCandidates.length >= 2 ? domainCandidates : availablePool;

  // Shuffle candidates
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const img1Obj = shuffled[0];
  let img2Obj = shuffled.find(m => m.url !== img1Obj.url);

  if (!img2Obj) {
    const fallbackShuffled = [...availablePool].sort(() => Math.random() - 0.5);
    img2Obj = fallbackShuffled.find(m => m.url !== img1Obj.url) || mediaList[1] || mediaList[0];
  }

  const img1 = img1Obj.url;
  const img2 = img2Obj.url;

  // Record into persistent history
  recordUsedImages([img1, img2]);

  const res = {
    img1,
    img2,
    img1Id: img1Obj.id || null,
    img2Id: img2Obj.id || null
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

module.exports = {
  getCustomMedia,
  saveCustomMedia,
  convertGoogleDriveLink,
  findMatchingCustomImage,
  getTwoDistinctRotatedImages,
  rotateMediaToAllPosts,
  categorizeImage,
  getMediaGallery,
  updatePostImages,
  randomizePostImages,
  UPLOADS_DIR
};
