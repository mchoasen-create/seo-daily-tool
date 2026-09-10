// Custom Media Manager for SEO Daily Tool (Uploads & Google Drive Links)

const fs = require('fs');
const path = require('path');

const BASE_DIR = process.pkg ? process.cwd() : path.join(__dirname, '..');
const MEDIA_FILE = path.join(BASE_DIR, 'data/custom_media.json');
const UPLOADS_DIR = path.join(BASE_DIR, 'public/uploads');

function initMediaStorage() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(MEDIA_FILE)) {
    fs.writeFileSync(MEDIA_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

const VERIFIED_MEDIA_FILE = path.join(BASE_DIR, 'data/verified_wp_images.json');

function getCustomMedia() {
  initMediaStorage();
  try {
    if (fs.existsSync(VERIFIED_MEDIA_FILE)) {
      const verified = JSON.parse(fs.readFileSync(VERIFIED_MEDIA_FILE, 'utf8'));
      if (Array.isArray(verified) && verified.length > 0) {
        return verified;
      }
    }
    return JSON.parse(fs.readFileSync(MEDIA_FILE, 'utf8'));
  } catch (err) {
    return [];
  }
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
  return driveUrl; // Return as is if already direct
}

function findMatchingCustomImage(keyword, index = 0, excludeUrls = []) {
  const mediaList = getCustomMedia();
  if (mediaList.length === 0) return null;

  const lowerKw = (keyword || '').toLowerCase().trim();
  const matches = mediaList.filter(m => {
    const tag = (m.tagKeyword || m.filename || '').toLowerCase();
    return lowerKw.includes(tag) || tag.includes(lowerKw);
  });

  const available = matches.length > 0 ? matches : mediaList;
  const filtered = available.filter(m => !excludeUrls.includes(m.url));
  const finalPool = filtered.length > 0 ? filtered : available;

  return finalPool[index % finalPool.length].url;
}

function getTwoDistinctRotatedImages(keyword = '', recentUsedUrls = []) {
  initMediaStorage();
  const mediaList = getCustomMedia();
  if (!mediaList || mediaList.length === 0) {
    return {
      img1: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4e?w=800&auto=format&fit=crop&q=80',
      img2: 'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=800&auto=format&fit=crop&q=80'
    };
  }

  // Filter out recently used images to prevent repetition
  const unusedMedia = mediaList.filter(m => !recentUsedUrls.includes(m.url));
  const pool = unusedMedia.length >= 2 ? unusedMedia : mediaList;

  const lowerKw = (keyword || '').toLowerCase().trim();
  const matched = pool.filter(m => {
    const tag = (m.tagKeyword || m.filename || '').toLowerCase();
    return lowerKw.includes(tag) || tag.includes(lowerKw);
  });

  let img1, img2;
  if (matched.length >= 2) {
    img1 = matched[0].url;
    img2 = matched[1].url;
  } else if (matched.length === 1) {
    img1 = matched[0].url;
    const remaining = pool.filter(m => m.url !== img1);
    img2 = remaining.length > 0 ? remaining[Math.floor(Math.random() * remaining.length)].url : pool[0].url;
  } else {
    const randOffset = Math.floor(Math.random() * Math.max(1, pool.length - 2));
    img1 = pool[randOffset % pool.length].url;
    img2 = pool[(randOffset + Math.max(1, Math.floor(pool.length / 3))) % pool.length].url;
    if (img1 === img2 && pool.length > 1) {
      img2 = pool[(randOffset + 1) % pool.length].url;
    }
  }

  const res = { img1, img2 };
  res[0] = img1;
  res[1] = img2;
  res[Symbol.iterator] = function* () { yield img1; yield img2; };
  return res;
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
  UPLOADS_DIR
};
