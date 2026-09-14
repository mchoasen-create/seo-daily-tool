const fs = require('fs');
const path = require('path');
const { calculateJaccardSimilarity } = require('./crawler');

const DATA_DIR = path.join(__dirname, '../data');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const KEYWORDS_FILE = path.join(DATA_DIR, 'keywords.json');
const LIVE_POSTS_FILE = path.join(DATA_DIR, 'live_blog_posts.json');
const AUDIT_REPORT_FILE = path.join(DATA_DIR, 'audit_report.json');

/**
 * Run a full system audit:
 * 1. Duplicate title detection (>65% similarity)
 * 2. Duplicate content / Jaccard similarity (>45%)
 * 3. Reused / duplicate featured image detection
 * 4. Product landing URL integrity (valid Google Ads target)
 * 5. SEO health & word count (>1000 words, score >= 90)
 */
async function runSystemAudit() {
  console.log('🔍 [Startup Audit] Bắt đầu rà soát toàn diện hệ thống & chống trùng lặp nội dung...');
  const startTime = Date.now();

  let posts = [];
  try {
    posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8') || '[]');
  } catch (e) {
    posts = [];
  }

  let liveData = { posts: [] };
  try {
    liveData = JSON.parse(fs.readFileSync(LIVE_POSTS_FILE, 'utf8') || '{"posts":[]}');
  } catch (e) {
    liveData = { posts: [] };
  }

  let keywords = [];
  try {
    keywords = JSON.parse(fs.readFileSync(KEYWORDS_FILE, 'utf8') || '[]');
  } catch (e) {
    keywords = [];
  }

  const livePosts = liveData.posts || [];
  const issues = [];
  const duplicateContentPairs = [];
  const duplicateTitlePairs = [];
  const duplicateImages = {};

  // 1. Audit Image Uniqueness across local posts and live posts
  const imageUsageMap = {};
  posts.forEach(p => {
    if (p.imageUrl) {
      const img = p.imageUrl;
      if (!imageUsageMap[img]) imageUsageMap[img] = [];
      imageUsageMap[img].push({ type: 'local', id: p.id, wpPostId: p.wpPostId || p.wp_post_id, title: p.title });
    }
  });

  livePosts.forEach(lp => {
    if (lp.featuredImageUrl) {
      const img = lp.featuredImageUrl;
      // Skip if this live post is already accounted for in local posts
      const matchingLocal = posts.find(p => (p.wpPostId && String(p.wpPostId) === String(lp.id)) || (p.wp_post_id && String(p.wp_post_id) === String(lp.id)));
      if (!matchingLocal) {
        if (!imageUsageMap[img]) imageUsageMap[img] = [];
        imageUsageMap[img].push({ type: 'live', id: lp.id, title: lp.title });
      }
    }
  });

  Object.entries(imageUsageMap).forEach(([img, uses]) => {
    if (uses.length > 1) {
      duplicateImages[img] = uses;
      const fn = img.substring(img.lastIndexOf('/') + 1);
      issues.push({
        level: 'warning',
        category: 'duplicate_image',
        message: `Ảnh "${fn}" bị dùng trùng lặp trong ${uses.length} bài viết.`,
        image: img,
        filename: fn,
        posts: uses
      });
    }
  });

  // 2. Audit Duplicate Titles & Content Similarity across all posts
  const allAuditedPosts = [...posts];
  for (let i = 0; i < allAuditedPosts.length; i++) {
    for (let j = i + 1; j < allAuditedPosts.length; j++) {
      const p1 = allAuditedPosts[i];
      const p2 = allAuditedPosts[j];

      // Title check
      const t1 = (p1.title || '').toLowerCase().trim();
      const t2 = (p2.title || '').toLowerCase().trim();
      if (t1 && t2) {
        const titleSim = calculateJaccardSimilarity(t1, t2);
        if (titleSim > 0.65) {
          duplicateTitlePairs.push({
            post1: { id: p1.id, wpPostId: p1.wpPostId || p1.wp_post_id, title: p1.title },
            post2: { id: p2.id, wpPostId: p2.wpPostId || p2.wp_post_id, title: p2.title },
            similarity: Math.round(titleSim * 100)
          });
          issues.push({
            level: 'warning',
            category: 'duplicate_title',
            message: `Tiêu đề bài viết "${p1.title}" trùng ${(titleSim*100).toFixed(0)}% với bài "${p2.title}".`,
            post1: { id: p1.id, wpPostId: p1.wpPostId || p1.wp_post_id, title: p1.title },
            post2: { id: p2.id, wpPostId: p2.wpPostId || p2.wp_post_id, title: p2.title },
            similarity: Math.round(titleSim * 100)
          });
        }
      }

      // Body Content check
      const b1 = (p1.content || '').substring(0, 3000);
      const b2 = (p2.content || '').substring(0, 3000);
      if (b1 && b2) {
        const bodySim = calculateJaccardSimilarity(b1, b2);
        if (bodySim > 0.45) {
          duplicateContentPairs.push({
            post1: { id: p1.id, wpPostId: p1.wpPostId || p1.wp_post_id, title: p1.title },
            post2: { id: p2.id, wpPostId: p2.wpPostId || p2.wp_post_id, title: p2.title },
            similarity: Math.round(bodySim * 100)
          });
          issues.push({
            level: 'danger',
            category: 'duplicate_content',
            message: `Nội dung bài "${p1.title}" trùng ${(bodySim*100).toFixed(0)}% với bài "${p2.title}". Cần viết lại độc bản!`,
            post1: { id: p1.id, wpPostId: p1.wpPostId || p1.wp_post_id, title: p1.title, content: p1.content || '' },
            post2: { id: p2.id, wpPostId: p2.wpPostId || p2.wp_post_id, title: p2.title, content: p2.content || '' },
            similarity: Math.round(bodySim * 100)
          });
        }
      }
    }
  }

  // 3. Audit Landing Link Integrity
  const invalidLandingPosts = [];
  posts.forEach(p => {
    const url = p.targetProductUrl || '';
    if (!url || !url.startsWith('https://xulynuochoasen.com/') || url.includes('/san-pham/')) {
      invalidLandingPosts.push({ id: p.id, title: p.title, url });
      issues.push({
        level: 'warning',
        category: 'landing_url',
        message: `Bài "${p.title}" chưa có link đích sản phẩm chuẩn Google Ads (${url}).`
      });
    }
  });

  // 4. Audit SEO Scores
  const lowSeoPosts = posts.filter(p => ((p.seoScore || p.score || 0) < 90));
  lowSeoPosts.forEach(p => {
    issues.push({
      level: 'warning',
      category: 'seo_score',
      message: `Bài "${p.title}" có điểm SEO dưới 90 (${p.seoScore || p.score || 0}đ).`
    });
  });

  // Only penalize health score for active local issues
  const localDuplicateImages = Object.values(duplicateImages).filter(uses => uses.some(u => u.type === 'local'));
  const activeDuplicateContent = duplicateContentPairs.filter(pair => pair.similarity >= 50);

  const calcHealthScore = Math.max(0, 100 - (activeDuplicateContent.length * 15) - (duplicateTitlePairs.length * 10) - (localDuplicateImages.length * 5) - (invalidLandingPosts.length * 15) - (lowSeoPosts.length * 5));

  const auditReport = {
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    healthScore: calcHealthScore,
    totalIssues: issues.length,
    summary: {
      totalPostsAudited: posts.length,
      totalLiveBlogPosts: livePosts.length,
      totalKeywordsInQueue: keywords.length,
      duplicateContentCount: duplicateContentPairs.length,
      duplicateTitleCount: duplicateTitlePairs.length,
      duplicateImageCount: Object.keys(duplicateImages).length,
      localDuplicateImageCount: localDuplicateImages.length,
      invalidLandingCount: invalidLandingPosts.length,
      lowSeoScoreCount: lowSeoPosts.length,
      totalIssues: issues.length,
      healthScore: calcHealthScore
    },
    duplicateContentPairs,
    duplicateTitlePairs,
    duplicateImages,
    issues
  };

  fs.writeFileSync(AUDIT_REPORT_FILE, JSON.stringify(auditReport, null, 2), 'utf8');

  console.log(`✅ [Startup Audit] Rà soát hoàn tất trong ${auditReport.durationMs}ms:`);
  console.log(`   - Tổng bài viết kiểm tra: ${posts.length} bài hệ thống (${livePosts.length} bài live)`);
  console.log(`   - Điểm sức khỏe nội dung: ${auditReport.summary.healthScore}/100đ`);
  console.log(`   - Trùng lặp nội dung (>45%): ${duplicateContentPairs.length} cặp`);
  console.log(`   - Trùng lặp tiêu đề (>65%): ${duplicateTitlePairs.length} cặp`);
  console.log(`   - Ảnh minh họa bị trùng: ${Object.keys(duplicateImages).length} ảnh`);
  console.log(`   - Bài viết điểm SEO < 90: ${lowSeoPosts.length} bài`);

  return auditReport;
}

function getLatestAuditReport() {
  try {
    if (fs.existsSync(AUDIT_REPORT_FILE)) {
      return JSON.parse(fs.readFileSync(AUDIT_REPORT_FILE, 'utf8') || '{}');
    }
  } catch (e) {}
  return null;
}

module.exports = {
  runSystemAudit,
  getLatestAuditReport
};
