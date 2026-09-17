// ==========================================================================
// TRIS SEO DAILY MASTER - CLIENT APP ENGINE
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

let currentPostId = null;
let debounceTimer = null;
let currentPostsData = [];
let currentKeywordsData = [];
let googleAdsLinks = [];

async function initApp() {
  setupNavigation();
  setupDateDisplay();
  setupEditorEvents();
  setupGeneratorEvents();
  setupSchemaEvents();
  setupSettingsEvents();
  setupAutoPilotEvents();
  setupWPEvents();
  setupStartupAuditEvents();
  setupGoogleAdsEvents();
  setupIndustryKnowledgeEvents();
  
  await Promise.all([loadPosts(), loadGoogleAdsLinks(), loadKeywords(), loadSchedulerConfig(), loadIndustryKnowledge()]);
  loadSchedulerStatus();
  startCountdownLoop();
  loadWPConfig();
  loadStartupAuditStatus();

  // Tự động kiểm tra & đồng bộ live với WordPress để dọn dẹp hàng chờ trùng lặp
  fetch('/api/wordpress/sync', { method: 'POST' })
    .then(r => r.json())
    .then(res => {
      if (res.resolvedKeywords > 0 || res.resolvedPosts > 0) {
        console.log('[WP Sync] Đã dọn dẹp bài trùng từ WP:', res);
        loadKeywords();
        loadPosts();
        loadSchedulerStatus();
      }
    })
    .catch(() => {});
}

/* --- Navigation & Tabs --- */
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const tabPages = document.querySelectorAll('.tab-page');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');

      navItems.forEach(n => n.classList.remove('active'));
      tabPages.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const activePage = document.getElementById(targetTab);
      if (activePage) activePage.classList.add('active');

      updateHeaderTitles(targetTab);
    });
  });

  document.getElementById('btn-quick-new').addEventListener('click', () => {
    switchToTab('tab-editor');
    resetEditorForm();
  });

  document.getElementById('btn-goto-library').addEventListener('click', () => {
    switchToTab('tab-library');
  });
}

function switchToTab(tabId) {
  const btn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (btn) btn.click();
}

function updateHeaderTitles(tabId) {
  const titleEl = document.getElementById('page-title');
  const subEl = document.getElementById('page-subtitle');

  const titles = {
    'tab-dashboard': { t: 'Dashboard & Tiến Độ Hàng Ngày', s: 'Theo dõi thói quen tạo nội dung chuẩn SEO và chất lượng bài viết.' },
    'tab-autopilot': { t: 'Tự Động Hóa Viết Bài Hàng Ngày (Auto-Pilot)', s: 'Tự động tạo bài viết chuẩn SEO theo danh sách từ khóa hàng chờ.' },
    'tab-generator': { t: 'Sinh Bài Viết Auto Chuẩn SEO', s: 'Tự động lập dàn bài và soạn thảo nội dung chất lượng cao cùng AI.' },
    'tab-editor': { t: 'SEO Editor & Realtime Live Meter', s: 'Soạn thảo bài viết và tối ưu hóa từ khóa theo thời gian thực.' },
    'tab-schema': { t: 'Bộ Tạo Schema JSON-LD Google', s: 'Đóng gói dữ liệu cấu trúc giúp website hiển thị Rich Snippet rực rỡ.' },
    'tab-library': { t: 'Thư Viện Bài Viết', s: 'Quản lý toàn bộ các bài viết đã lưu trữ và sẵn sàng xuất bản.' },
    'tab-settings': { t: 'Cấu Hình API & WordPress', s: 'Cấu hình API Gemini và kết nối WordPress REST API tự động đăng bài.' },
    'tab-duplicate': { t: 'Phát Hiện & Tối Ưu Trùng Lặp Nội Dung', s: 'Rà soát độ tương đồng giữa các bài viết để loại bỏ nguy cơ Google phạt duplicate.' },
    'tab-industry': { t: 'Kho Tri Thức Chuyên Ngành & Đối Thủ Đầu Ngành', s: 'Tổng hợp 38+ bài viết chuyên sâu & 53+ thuật ngữ kỹ thuật từ Kenwa, Wepar, Việt Phát tự động nạp vào AI Prompt.' }
  };

  if (titles[tabId]) {
    titleEl.textContent = titles[tabId].t;
    subEl.textContent = titles[tabId].s;
  }
}

function setupDateDisplay() {
  const dateStrEl = document.getElementById('current-date-str');
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const today = new Date();
  dateStrEl.textContent = today.toLocaleDateString('vi-VN', options);
}

/* --- API: Posts Loading & Storage --- */
async function loadPosts() {
  try {
    const response = await fetch('/api/posts?_t=' + Date.now(), { cache: 'no-store' });
    const result = await response.json();
    if (result.success) {
      currentPostsData = result.data || [];
      renderDashboardStats(currentPostsData);
      renderRecentTable(currentPostsData);
      renderLibraryTable(currentPostsData);
      renderCalendar(currentPostsData);
      if (currentKeywordsData && currentKeywordsData.length > 0) {
        renderKeywordQueueTable(currentKeywordsData);
        renderEnteredKeywordsCard(currentKeywordsData);
      }
    }
  } catch (err) {
    console.error('Error loading posts:', err);
  }
}

function renderDashboardStats(posts) {
  document.getElementById('stat-total-posts').textContent = posts.length;
  
  const avgScore = posts.length > 0
    ? Math.round(posts.reduce((acc, p) => acc + (p.score || 0), 0) / posts.length)
    : 0;
  document.getElementById('stat-avg-score').textContent = `${avgScore} / 100`;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayPosts = posts.filter(p => p.date === todayStr);
  const todayStatusEl = document.getElementById('stat-today-status');
  if (todayPosts.length > 0) {
    todayStatusEl.textContent = `${todayPosts.length} Bài (Đã Đạt Targets ✅)`;
    todayStatusEl.style.color = '#10b981';
  } else {
    todayStatusEl.textContent = '0 Bài (Cần Tạo Bài Mới 🎯)';
    todayStatusEl.style.color = '#f59e0b';
  }

  const perfectPosts = posts.filter(p => p.score >= 90).length;
  document.getElementById('stat-perfect-posts').textContent = perfectPosts;
}

function renderRecentTable(posts) {
  const tbody = document.getElementById('recent-posts-tbody');
  tbody.innerHTML = '';

  const recent = posts.slice(0, 5);
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">Chưa có bài viết nào. Hãy bấm "Bài Viết Mới" để tạo ngay!</td></tr>`;
    return;
  }

  recent.forEach(post => {
    tbody.appendChild(createPostRow(post));
  });
}

function renderLibraryTable(posts) {
  const tbody = document.getElementById('library-posts-tbody');
  tbody.innerHTML = '';

  if (posts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">Thư viện trống.</td></tr>`;
    return;
  }

  posts.forEach(post => {
    tbody.appendChild(createPostRow(post));
  });
}

function createPostRow(post) {
  const tr = document.createElement('tr');
  const scoreClass = post.score >= 80 ? 'high' : (post.score >= 60 ? 'mid' : 'low');

  const statusLabel = post.wpPublished 
    ? `<a href="${post.wpLink}" target="_blank" style="color: var(--accent-cyan); text-decoration: underline;">Đã Đăng WP 🔗</a>`
    : (post.status === 'published' ? 'Đã Xuất Bản' : 'Bản Nháp');

  tr.innerHTML = `
    <td><strong>${escapeHtml(post.title)}</strong> ${post.isAutoGenerated ? '<span class="badge-pro">AUTO</span>' : ''}</td>
    <td><span class="badge-cyan"><i class="fa-solid fa-key"></i> ${escapeHtml(post.targetKeyword || 'N/A')}</span></td>
    <td>${post.date || 'Hôm nay'}</td>
    <td><span class="score-badge ${scoreClass}">${post.score || 0} / 100</span></td>
    <td>${statusLabel}</td>
    <td>
      <button class="btn btn-sm btn-secondary btn-edit-post" data-id="${post.id}"><i class="fa-solid fa-pen"></i> Sửa</button>
      <button class="btn btn-sm btn-accent btn-wp-publish-item" data-id="${post.id}" title="Đăng lên WP"><i class="fa-brands fa-wordpress"></i></button>
      <button class="btn btn-sm btn-ghost btn-del-post" data-id="${post.id}"><i class="fa-solid fa-trash"></i></button>
    </td>
  `;

  tr.querySelector('.btn-edit-post').addEventListener('click', () => {
    editPost(post);
  });

  tr.querySelector('.btn-wp-publish-item').addEventListener('click', async () => {
    await publishPostToWP(post.id);
  });

  tr.querySelector('.btn-del-post').addEventListener('click', async () => {
    if (confirm(`Anh có chắc muốn xóa bài viết "${post.title}" không?`)) {
      await deletePost(post.id);
    }
  });

  return tr;
}

function editPost(post) {
  currentPostId = post.id;
  document.getElementById('edit-title').value = post.title || '';
  document.getElementById('edit-keyword').value = post.targetKeyword || '';
  document.getElementById('edit-meta').value = post.metaDescription || '';
  document.getElementById('edit-content').value = post.content || '';

  switchToTab('tab-editor');
  triggerSEOAnalysis();
}

async function deletePost(id) {
  try {
    const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Đã xóa bài viết thành công!', 'success');
      loadPosts();
    }
  } catch (err) {
    showToast('Lỗi khi xóa bài viết.', 'error');
  }
}

function renderCalendar(posts = []) {
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  const today = new Date();
  const currentMonthDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  for (let i = 1; i <= Math.min(28, currentMonthDays); i++) {
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const hasPost = posts.some(p => p.date === dateStr);
    const isToday = i === today.getDate();

    const dayBox = document.createElement('div');
    dayBox.className = `calendar-day-box ${isToday ? 'active-today' : ''} ${hasPost ? 'completed' : ''}`;
    dayBox.innerHTML = `
      <div class="day-number">Ngày ${i}</div>
      <div class="day-status-dot ${hasPost ? 'done' : (isToday ? 'pending' : '')}"></div>
    `;
    grid.appendChild(dayBox);
  }
}

/* --- WORDPRESS REST API LOGIC --- */
function setupWPEvents() {
  const btnTest = document.getElementById('btn-test-wp');
  const btnSave = document.getElementById('btn-save-wp');
  const btnPublishEditor = document.getElementById('btn-publish-wp');

  btnSave.addEventListener('click', async () => {
    const siteUrl = document.getElementById('wp-url').value.trim();
    const username = document.getElementById('wp-username').value.trim();
    const appPassword = document.getElementById('wp-app-password').value.trim();
    const defaultStatus = document.getElementById('wp-default-status').value;
    const categoryId = document.getElementById('wp-category-select').value;
    const autoPublish = document.getElementById('wp-auto-publish-check').checked;

    try {
      const res = await fetch('/api/wordpress/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, username, appPassword, defaultStatus, categoryId, autoPublish, enabled: true })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Đã lưu cấu hình kết nối WordPress & Chuyên mục!', 'success');
      }
    } catch (err) {
      showToast('Lỗi khi lưu cấu hình WordPress.', 'error');
    }
  });

  btnTest.addEventListener('click', async () => {
    const siteUrl = document.getElementById('wp-url').value.trim();
    const username = document.getElementById('wp-username').value.trim();
    const appPassword = document.getElementById('wp-app-password').value.trim();

    if (!siteUrl || !username || !appPassword) {
      showToast('Vui lòng điền đủ URL, Username và App Password trước khi kiểm tra.', 'error');
      return;
    }

    btnTest.disabled = true;
    btnTest.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang thử kết nối...';

    try {
      const res = await fetch('/api/wordpress/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, username, appPassword })
      });
      const data = await res.json();
      btnTest.disabled = false;
      btnTest.innerHTML = '<i class="fa-solid fa-plug"></i> Kiểm Tra Kết Nối';

      if (data.success) {
        showToast(data.message, 'success');
        await loadWPCategories();
      } else {
        showToast(data.message, 'error');
      }
    } catch (err) {
      btnTest.disabled = false;
      btnTest.innerHTML = '<i class="fa-solid fa-plug"></i> Kiểm Tra Kết Nối';
      showToast('Không thể kết nối tới máy chủ WordPress.', 'error');
    }
  });

  btnPublishEditor.addEventListener('click', async () => {
    const title = document.getElementById('edit-title').value;
    const content = document.getElementById('edit-content').value;
    const metaDescription = document.getElementById('edit-meta').value;

    if (!title || !content) {
      showToast('Vui lòng nhập tiêu đề và nội dung bài viết trước khi đăng!', 'error');
      return;
    }

    btnPublishEditor.disabled = true;
    btnPublishEditor.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng bài lên WP...';

    try {
      const res = await fetch('/api/wordpress/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: currentPostId,
          postData: { title, content, metaDescription }
        })
      });

      const data = await res.json();
      btnPublishEditor.disabled = false;
      btnPublishEditor.innerHTML = '<i class="fa-brands fa-wordpress"></i> 🚀 Đăng Lên WordPress Ngay';

      if (data.success) {
        showToast(`Đã đăng bài thành công lên WordPress! ${data.data?.link ? 'URL: ' + data.data.link : ''}`, 'success');
        loadPosts();
      } else {
        showToast(data.message, 'error');
      }
    } catch (err) {
      btnPublishEditor.disabled = false;
      btnPublishEditor.innerHTML = '<i class="fa-brands fa-wordpress"></i> 🚀 Đăng Lên WordPress Ngay';
      showToast('Lỗi khi gửi dữ liệu bài viết lên WordPress.', 'error');
    }
  });
}

async function loadWPConfig() {
  try {
    const res = await fetch('/api/wordpress/config');
    const data = await res.json();
    if (data.success && data.data) {
      document.getElementById('wp-url').value = data.data.siteUrl || '';
      document.getElementById('wp-username').value = data.data.username || '';
      document.getElementById('wp-app-password').value = data.data.appPassword || '';
      document.getElementById('wp-default-status').value = data.data.defaultStatus || 'publish';
      document.getElementById('wp-auto-publish-check').checked = !!data.data.autoPublish;

      await loadWPCategories(data.data.categoryId);
    }
  } catch (err) {
    console.error('Error loading WP config:', err);
  }
}

async function loadWPCategories(selectedId = null) {
  const selectEl = document.getElementById('wp-category-select');
  if (!selectEl) return;

  try {
    const res = await fetch('/api/wordpress/categories');
    const data = await res.json();
    if (data.success && data.data) {
      selectEl.innerHTML = '<option value="">-- Mặc định (Không chọn) --</option>';
      data.data.forEach(cat => {
        const isSelected = String(selectedId) === String(cat.id) || (cat.slug === 'blog-chia-se' && !selectedId);
        selectEl.innerHTML += `<option value="${cat.id}" ${isSelected ? 'selected' : ''}>📁 ${cat.name} (ID: ${cat.id})</option>`;
      });
    } else {
      selectEl.innerHTML = '<option value="">-- Chưa kết nối được WP --</option>';
    }
  } catch (err) {
    selectEl.innerHTML = '<option value="">-- Không thể tải chuyên mục --</option>';
  }
}

async function publishPostToWP(postId) {
  try {
    showToast('Đang tiến hành đăng bài lên WordPress...', 'success');
    const res = await fetch('/api/wordpress/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Đăng bài lên WordPress thành công!', 'success');
      loadPosts();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi khi kết nối đăng bài WordPress', 'error');
  }
}

/* --- AUTO-PILOT KEYWORD QUEUE --- */
function setupAutoPilotEvents() {
  const bulkForm = document.getElementById('bulk-keywords-form');
  const runNowBtn = document.getElementById('btn-trigger-run-now');
  const pregenAllBtn = document.getElementById('btn-pregenerate-all');
  const intervalSelect = document.getElementById('auto-interval-select');

  bulkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = document.getElementById('bulk-keywords-text').value;
    const category = document.getElementById('bulk-category').value;
    const defaultTargetUrl = document.getElementById('bulk-target-url')?.value || '';

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      showToast('Vui lòng nhập ít nhất 1 từ khóa!', 'error');
      return;
    }

    try {
      const res = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywordList: lines, topicCategory: category, defaultTargetUrl: defaultTargetUrl.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã thêm ${data.addedCount} từ khóa vào hàng chờ!`, 'success');
        document.getElementById('bulk-keywords-text').value = '';
        const targetUrlInput = document.getElementById('bulk-target-url');
        if (targetUrlInput) targetUrlInput.value = '';
        const targetUrlSelect = document.getElementById('bulk-target-url-select');
        if (targetUrlSelect) targetUrlSelect.value = '';
        loadKeywords();
      }
    } catch (err) {
      showToast('Lỗi khi thêm từ khóa.', 'error');
    }
  });

  if (pregenAllBtn) {
    pregenAllBtn.addEventListener('click', async () => {
      pregenAllBtn.disabled = true;
      pregenAllBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tự động soạn sẵn bài...';

      try {
        const res = await fetch('/api/keywords/pregenerate-all', { method: 'POST' });
        const data = await res.json();
        pregenAllBtn.disabled = false;
        pregenAllBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> ✨ Soạn Sẵn Bài Cho Tất Cả Hàng Chờ';

        if (data.success) {
          showToast(data.message, 'success');
          await loadKeywords();
          await loadPosts();
        } else {
          showToast(data.message || 'Lỗi khi soạn bài.', 'error');
        }
      } catch (err) {
        pregenAllBtn.disabled = false;
        pregenAllBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> ✨ Soạn Sẵn Bài Cho Tất Cả Hàng Chờ';
        showToast('Lỗi kết nối khi soạn bài tự động.', 'error');
      }
    });
  }

  runNowBtn.addEventListener('click', async () => {
    runNowBtn.disabled = true;
    runNowBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xuất bản bài...';

    try {
      const res = await fetch('/api/scheduler/run-next', { method: 'POST' });
      const data = await res.json();
      runNowBtn.disabled = false;
      runNowBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> 🚀 Đăng Bài Ngay Cho Từ Khóa Tiếp Theo';

      if (data.success) {
        showToast(data.message, 'success');
        loadKeywords();
        loadPosts();
      } else {
        showToast(data.message, 'error');
      }
    } catch (err) {
      runNowBtn.disabled = false;
      runNowBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> 🚀 Đăng Bài Ngay Cho Từ Khóa Tiếp Theo';
      showToast('Không thể thực hiện đăng bài tự động.', 'error');
    }
  });

  const syncWpBtn = document.getElementById('btn-sync-wp-now');
  if (syncWpBtn) {
    syncWpBtn.addEventListener('click', async () => {
      syncWpBtn.disabled = true;
      syncWpBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đồng bộ từ WP...';
      try {
        const res = await fetch('/api/wordpress/sync', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'Đã đồng bộ live với WordPress thành công!', 'success');
          await Promise.all([loadKeywords(), loadPosts(), loadSchedulerStatus()]);
        } else {
          showToast(data.message || 'Lỗi đồng bộ WordPress', 'error');
        }
      } catch (err) {
        showToast('Lỗi kết nối khi đồng bộ: ' + err.message, 'error');
      } finally {
        syncWpBtn.disabled = false;
        syncWpBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> 🔄 Quét & Đồng Bộ Live Với WordPress';
      }
    });
  }

  if (intervalSelect) {
    intervalSelect.addEventListener('change', async () => {
      const hours = parseInt(intervalSelect.value);
      await fetch('/api/scheduler/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, publishIntervalHours: hours })
      });
      showToast('Đã lưu lịch tự động chạy!', 'success');
      loadSchedulerStatus();
    });
  }

  // Realtime Dual Countdown Command Center Event Listeners
  const btnToggleSched = document.getElementById('btn-toggle-scheduler');
  if (btnToggleSched) {
    btnToggleSched.addEventListener('click', async () => {
      const isCurrentlyEnabled = schedulerStatusData ? schedulerStatusData.enabled : true;
      const res = await fetch('/api/scheduler/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !isCurrentlyEnabled })
      });
      const data = await res.json();
      if (data.success) {
        showToast(!isCurrentlyEnabled ? 'Đã kích hoạt tự động hóa bài viết!' : 'Đã tạm dừng tự động hóa bài viết!', 'info');
        loadSchedulerStatus();
      }
    });
  }

  const quickWpModeSelect = document.getElementById('quick-wp-mode-select');
  if (quickWpModeSelect) {
    quickWpModeSelect.addEventListener('change', async () => {
      const mode = quickWpModeSelect.value;
      const res = await fetch('/api/scheduler/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultStatus: mode })
      });
      const data = await res.json();
      if (data.success) {
        showToast(mode === 'draft' ? 'Đã đổi sang chế độ: Lưu bản nháp trên WordPress' : 'Đã đổi sang chế độ: Xuất bản công khai ngay', 'success');
        const wpDefStatus = document.getElementById('wp-default-status');
        if (wpDefStatus) wpDefStatus.value = mode;
        loadSchedulerStatus();
      }
    });
  }

  const selectPubIntervalDual = document.getElementById('select-publish-interval-dual');
  if (selectPubIntervalDual) {
    selectPubIntervalDual.addEventListener('change', async () => {
      const hours = parseFloat(selectPubIntervalDual.value);
      await fetch('/api/scheduler/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishIntervalHours: hours })
      });
      showToast(`Đã lưu thời gian chờ đăng: Mỗi ${hours} giờ!`, 'success');
      loadSchedulerStatus();
    });
  }

  const selectGenIntervalDual = document.getElementById('select-generate-interval-dual');
  if (selectGenIntervalDual) {
    selectGenIntervalDual.addEventListener('change', async () => {
      const hours = parseFloat(selectGenIntervalDual.value);
      await fetch('/api/scheduler/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generateIntervalHours: hours })
      });
      showToast(`Đã lưu thời gian chờ sinh bài: Mỗi ${hours >= 1 ? hours + ' giờ' : (hours * 60) + ' phút'}!`, 'success');
      loadSchedulerStatus();
    });
  }

  // Anti-Footprint Random Jitter Event Listeners
  const chkJitterEnabled = document.getElementById('chk-jitter-enabled');
  const selectJitterRange = document.getElementById('select-jitter-range');
  const lblJitterState = document.getElementById('lbl-jitter-state');

  if (chkJitterEnabled) {
    chkJitterEnabled.addEventListener('change', async () => {
      const isEnabled = chkJitterEnabled.checked;
      if (lblJitterState) {
        lblJitterState.textContent = isEnabled ? 'Bật' : 'Tắt';
        lblJitterState.style.color = isEnabled ? '#34d399' : '#94a3b8';
      }
      if (selectJitterRange) selectJitterRange.disabled = !isEnabled;

      await fetch('/api/scheduler/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ randomJitterEnabled: isEnabled })
      });
      showToast(isEnabled ? 'Đã bật lệch ngẫu nhiên đăng bài (Chống Footprint Google)!' : 'Đã tắt lệch ngẫu nhiên!', 'success');
      loadSchedulerStatus();
    });
  }

  if (selectJitterRange) {
    selectJitterRange.addEventListener('change', async () => {
      const maxMins = parseInt(selectJitterRange.value, 10) || 60;
      await fetch('/api/scheduler/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ randomJitterMaxMinutes: maxMins })
      });
      showToast(`Đã thiết lập biên độ lệch ngẫu nhiên: ± 1 - ${maxMins} phút!`, 'success');
      loadSchedulerStatus();
    });
  }

  const btnRunPubNow = document.getElementById('btn-run-publish-now');
  if (btnRunPubNow) {
    btnRunPubNow.addEventListener('click', async () => {
      btnRunPubNow.disabled = true;
      btnRunPubNow.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng...';
      try {
        const res = await fetch('/api/scheduler/run-next', { method: 'POST' });
        const data = await res.json();
        btnRunPubNow.disabled = false;
        btnRunPubNow.innerHTML = '<i class="fa-solid fa-paper-plane"></i> 🚀 Đăng Ngay';
        if (data.success) {
          showToast(data.message, 'success');
          await loadKeywords();
          await loadPosts();
          await loadSchedulerStatus();
        } else {
          showToast(data.message || 'Lỗi khi đăng bài.', 'error');
        }
      } catch (e) {
        btnRunPubNow.disabled = false;
        btnRunPubNow.innerHTML = '<i class="fa-solid fa-paper-plane"></i> 🚀 Đăng Ngay';
        showToast('Lỗi kết nối khi đăng bài.', 'error');
      }
    });
  }

  const btnRunGenNow = document.getElementById('btn-run-generate-now');
  if (btnRunGenNow) {
    btnRunGenNow.addEventListener('click', async () => {
      btnRunGenNow.disabled = true;
      btnRunGenNow.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang viết...';
      try {
        const res = await fetch('/api/keywords/pregenerate-next', { method: 'POST' });
        const data = await res.json();
        btnRunGenNow.disabled = false;
        btnRunGenNow.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> ✨ Soạn Bài Ngay';
        if (data.success) {
          showToast(data.message, 'success');
          await loadKeywords();
          await loadPosts();
          await loadSchedulerStatus();
        } else {
          showToast(data.message || 'Không có từ khóa cần soạn.', 'error');
        }
      } catch (e) {
        btnRunGenNow.disabled = false;
        btnRunGenNow.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> ✨ Soạn Bài Ngay';
        showToast('Lỗi kết nối khi soạn bài.', 'error');
      }
    });
  }

  const btnJumpAutopilot = document.getElementById('btn-jump-autopilot');
  if (btnJumpAutopilot) {
    btnJumpAutopilot.addEventListener('click', () => {
      const autopilotTabBtn = document.querySelector('.nav-item[data-tab="tab-autopilot"]');
      if (autopilotTabBtn) autopilotTabBtn.click();
    });
  }

  // Queue Filter Tabs Listener
  const filterBtns = document.querySelectorAll('#queue-filter-bar .filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentQueueFilter = btn.getAttribute('data-filter') || 'all';
      renderKeywordQueueTable(currentKeywordsData);
    });
  });

  // Refresh Queue Button Listener
  const btnRefreshQueue = document.getElementById('btn-refresh-queue');
  if (btnRefreshQueue) {
    btnRefreshQueue.addEventListener('click', async () => {
      btnRefreshQueue.disabled = true;
      btnRefreshQueue.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      await loadPosts();
      await loadKeywords();
      await loadSchedulerStatus();
      btnRefreshQueue.disabled = false;
      btnRefreshQueue.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Làm Mới';
      showToast('Đã làm mới danh sách hàng chờ!', 'success');
    });
  }

  // Khóa 7 Chiến Dịch Ads Button Listener
  const btnResetMaster7 = document.getElementById('btn-reset-master-7');
  if (btnResetMaster7) {
    btnResetMaster7.addEventListener('click', async () => {
      if (!confirm('Khóa chết hàng chờ theo 7 Chiến dịch Google Ads chuẩn (Lọc Nước Giếng, Công Nghiệp, Phèn, Sinh Hoạt, Tinh Khiết, Đầu Nguồn, Mặn)?\n\nHệ thống sẽ thiết lập lại hàng chờ xoay tua vô hạn bắt đầu từ vị trí số 1!')) return;
      btnResetMaster7.disabled = true;
      btnResetMaster7.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang khóa...';
      try {
        const res = await fetch('/api/keywords/reset-master-7', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          await loadKeywords();
          await loadPosts();
          await loadSchedulerStatus();
          showToast('✅ Đã khóa chết 7 chiến dịch Google Ads tuần hoàn!', 'success');
        } else {
          showToast('Lỗi: ' + data.message, 'danger');
        }
      } catch (e) {
        showToast('Lỗi kết nối máy chủ: ' + e.message, 'danger');
      } finally {
        btnResetMaster7.disabled = false;
        btnResetMaster7.innerHTML = '<i class="fa-solid fa-lock"></i> Khóa 7 Chiến Dịch Ads';
      }
    });
  }

  // Refresh Timeline Button Listener
  const btnRefreshTimeline = document.getElementById('btn-refresh-timeline');
  if (btnRefreshTimeline) {
    btnRefreshTimeline.addEventListener('click', async () => {
      btnRefreshTimeline.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i>';
      await loadSchedulerStatus();
      setTimeout(() => {
        if (btnRefreshTimeline) btnRefreshTimeline.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
      }, 500);
      showToast('Đã đồng bộ dòng thời gian đếm ngược!', 'success');
    });
  }

  // Quick Preview Modal Close Handlers
  const previewModal = document.getElementById('quick-preview-modal');
  const btnCloseModal = document.getElementById('btn-close-preview-modal');
  const btnCloseModalBtn = document.getElementById('btn-modal-close-btn');
  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      if (previewModal) previewModal.style.display = 'none';
    });
  }
  if (btnCloseModalBtn) {
    btnCloseModalBtn.addEventListener('click', () => {
      if (previewModal) previewModal.style.display = 'none';
    });
  }
  if (previewModal) {
    previewModal.addEventListener('click', (e) => {
      if (e.target === previewModal) previewModal.style.display = 'none';
    });
  }
}

let schedulerStatusData = null;
let countdownTimerInterval = null;
let localPublishRemainingSec = 0;
let localGenerateRemainingSec = 0;

function formatSecToHMS(totalSec) {
  if (!totalSec || totalSec <= 0) return { h: '00', m: '00', s: '00', str: '00:00:00' };
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return { h, m, s, str: `${h}:${m}:${s}` };
}

function formatDisplayDateTime(isoStr) {
  if (!isoStr) return '--:--';
  try {
    const d = new Date(isoStr);
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${hours}:${mins} (${day}/${month})`;
  } catch (e) {
    return '--:--';
  }
}

async function loadSchedulerStatus() {
  try {
    const res = await fetch('/api/scheduler/status');
    const data = await res.json();
    if (!data.success || !data.data) return;

    schedulerStatusData = data.data;
    localPublishRemainingSec = schedulerStatusData.publishRemainingSec;
    localGenerateRemainingSec = schedulerStatusData.generateRemainingSec;

    // 1. Status Pill & Toggle Button
    const statusPill = document.getElementById('scheduler-live-pill');
    const statusText = document.getElementById('scheduler-status-text');
    const toggleBtnText = document.getElementById('btn-toggle-scheduler-text');
    if (statusPill && statusText) {
      if (schedulerStatusData.enabled) {
        statusPill.classList.remove('paused');
        statusText.textContent = 'Đang Hoạt Động';
        if (toggleBtnText) toggleBtnText.textContent = 'Tạm Dừng';
      } else {
        statusPill.classList.add('paused');
        statusText.textContent = 'Đang Tạm Dừng';
        if (toggleBtnText) toggleBtnText.textContent = 'Kích Hoạt';
      }
    }

    // 2. WP Mode Selector & Badge
    const quickModeSelect = document.getElementById('quick-wp-mode-select');
    if (quickModeSelect) {
      quickModeSelect.value = schedulerStatusData.wpStatus.defaultStatus || 'publish';
    }
    const ribbonModeBadge = document.getElementById('mini-wp-mode-badge');
    if (ribbonModeBadge) {
      if (schedulerStatusData.wpStatus.defaultStatus === 'draft') {
        ribbonModeBadge.textContent = '📝 Lưu Nháp WP';
        ribbonModeBadge.className = 'badge badge-draft';
      } else {
        ribbonModeBadge.textContent = '🚀 Xuất Bản Ngay';
        ribbonModeBadge.className = 'badge badge-pub';
      }
    }

    // 3. Next Post To Publish Info
    const dispNextPubPost = document.getElementById('disp-next-publish-post');
    const dispNextPubTime = document.getElementById('disp-next-publish-time');
    const miniPubPost = document.getElementById('mini-pub-post');
    if (dispNextPubPost) {
      if (schedulerStatusData.nextPublishItem) {
        dispNextPubPost.textContent = schedulerStatusData.nextPublishItem.title || schedulerStatusData.nextPublishItem.keyword;
        dispNextPubPost.title = dispNextPubPost.textContent;
        if (miniPubPost) miniPubPost.textContent = 'Bài: ' + (schedulerStatusData.nextPublishItem.title || schedulerStatusData.nextPublishItem.keyword);
      } else {
        dispNextPubPost.textContent = 'Hàng chờ trống (Chưa có từ khóa)';
        dispNextPubPost.title = '';
        if (miniPubPost) miniPubPost.textContent = 'Hàng chờ trống';
      }
    }
    if (dispNextPubTime) {
      dispNextPubTime.textContent = schedulerStatusData.nextPublishItem 
        ? formatDisplayDateTime(schedulerStatusData.nextPublishTime) 
        : 'Đang đợi từ khóa mới';
    }

    // 4. Next Keyword To Generate Info (Gối đầu tự động)
    const dispGenerateQueueTag = document.getElementById('disp-generate-queue-tag');
    const dispNextGenKw = document.getElementById('disp-next-generate-kw');
    const dispNextGenTime = document.getElementById('disp-next-generate-time');
    const miniGenKw = document.getElementById('mini-gen-kw');
    const pregenCount = schedulerStatusData.pregeneratedCount || 0;
    const pendingCount = schedulerStatusData.pendingCount || 0;

    if (dispGenerateQueueTag) {
      dispGenerateQueueTag.innerHTML = `<i class="fa-solid fa-arrows-rotate" style="color:#06b6d4;"></i> Gối đầu: <strong style="color:#38bdf8;">${pregenCount}/${pendingCount}</strong> bài sẵn sàng`;
    }

    if (dispNextGenKw) {
      if (schedulerStatusData.nextGenerateItem) {
        const kwText = schedulerStatusData.nextGenerateItem.keyword;
        const isRolling = schedulerStatusData.nextGenerateItem.isBufferRolling;
        dispNextGenKw.innerHTML = isRolling
          ? `<span style="color: #38bdf8; font-weight: 600;"><i class="fa-solid fa-arrows-rotate fa-spin-pulse"></i> ${escapeHtml(kwText)} <small style="color:var(--text-muted);font-weight:normal;">(Gối đầu xoay tua)</small></span>`
          : `<span style="color: #38bdf8; font-weight: 600;">${escapeHtml(kwText)}</span>`;
        dispNextGenKw.title = kwText;
        if (miniGenKw) miniGenKw.textContent = 'Gối đầu: ' + kwText;
      } else {
        dispNextGenKw.textContent = 'Hàng chờ trống';
        dispNextGenKw.title = '';
        if (miniGenKw) miniGenKw.textContent = 'Hàng chờ trống';
      }
    }
    if (dispNextGenTime) {
      dispNextGenTime.innerHTML = schedulerStatusData.nextGenerateTime
        ? `<span style="color: var(--text-color); font-weight:600;"><i class="fa-regular fa-clock" style="color:#06b6d4;"></i> ${formatDisplayDateTime(schedulerStatusData.nextGenerateTime)}</span>`
        : '--:--';
    }

    // 5. Sync Interval Dropdowns
    const pubIntervalSelect = document.getElementById('select-publish-interval-dual');
    if (pubIntervalSelect) {
      pubIntervalSelect.value = String(schedulerStatusData.publishIntervalHours || 4);
    }
    const genIntervalSelect = document.getElementById('select-generate-interval-dual');
    if (genIntervalSelect) {
      genIntervalSelect.value = String(schedulerStatusData.generateIntervalHours || 2);
    }

    // 5b. Anti-Footprint Random Jitter Sync (+- 1 to 60 mins)
    const chkJitter = document.getElementById('chk-jitter-enabled');
    const lblJitter = document.getElementById('lbl-jitter-state');
    const selectJitter = document.getElementById('select-jitter-range');
    const dispJitterOffset = document.getElementById('disp-jitter-offset');

    const jitterEnabled = schedulerStatusData.randomJitterEnabled !== false;
    const jitterMax = schedulerStatusData.randomJitterMaxMinutes || 60;
    const currentJitter = schedulerStatusData.currentJitterMinutes || 0;

    if (chkJitter) chkJitter.checked = jitterEnabled;
    if (lblJitter) {
      lblJitter.textContent = jitterEnabled ? 'Bật' : 'Tắt';
      lblJitter.style.color = jitterEnabled ? '#34d399' : '#94a3b8';
    }
    if (selectJitter) {
      selectJitter.value = String(jitterMax);
      selectJitter.disabled = !jitterEnabled;
    }
    if (dispJitterOffset) {
      if (!jitterEnabled) {
        dispJitterOffset.textContent = 'Đã tắt (Cố định giờ)';
        dispJitterOffset.style.color = '#94a3b8';
      } else {
        const sign = currentJitter >= 0 ? '+' : '';
        dispJitterOffset.innerHTML = `<span style="color:#38bdf8;font-weight:700;">${sign}${currentJitter} phút</span> <span style="color:#94a3b8;font-weight:normal;">(giới hạn ±${jitterMax}p)</span>`;
      }
    }

    // 6. Render Publishing Queue Timeline
    renderPublishingTimeline(schedulerStatusData.timeline || []);
    const timelineBadge = document.getElementById('timeline-queue-info-badge');
    if (timelineBadge) {
      timelineBadge.textContent = `Chu kỳ: ${schedulerStatusData.publishIntervalHours || 4} giờ / bài (${schedulerStatusData.pendingCount} bài trong hàng chờ)`;
    }

    // Render immediately on load
    updateCountdownDOM();
  } catch (err) {
    console.error('Error loading scheduler status:', err);
  }
}

function updateCountdownDOM() {
  const pubTime = formatSecToHMS(localPublishRemainingSec);
  const genTime = formatSecToHMS(localGenerateRemainingSec);

  // Publish clock
  const pubH = document.getElementById('pub-hours');
  const pubM = document.getElementById('pub-mins');
  const pubS = document.getElementById('pub-secs');
  const miniPubTimer = document.getElementById('mini-pub-timer');
  if (pubH) pubH.textContent = pubTime.h;
  if (pubM) pubM.textContent = pubTime.m;
  if (pubS) pubS.textContent = pubTime.s;
  if (miniPubTimer) miniPubTimer.textContent = pubTime.str;

  // Generate clock - LUÔN HIỂN THỊ ĐỒNG HỒ ĐẾM NGƯỢC GIỜ:PHÚT:GIÂY
  const genBox = document.getElementById('generate-countdown-box');
  const miniGenTimer = document.getElementById('mini-gen-timer');

  if (genBox && !genBox.querySelector('.countdown-unit')) {
    genBox.innerHTML = `
      <div class="countdown-unit">
        <span class="unit-num num-cyan" id="gen-hours">00</span>
        <span class="unit-label">Giờ</span>
      </div>
      <span class="countdown-sep sep-cyan">:</span>
      <div class="countdown-unit">
        <span class="unit-num num-cyan" id="gen-mins">00</span>
        <span class="unit-label">Phút</span>
      </div>
      <span class="countdown-sep sep-cyan">:</span>
      <div class="countdown-unit">
        <span class="unit-num num-cyan" id="gen-secs">00</span>
        <span class="unit-label">Giây</span>
      </div>
    `;
  }
  const genH = document.getElementById('gen-hours');
  const genM = document.getElementById('gen-mins');
  const genS = document.getElementById('gen-secs');
  if (genH) genH.textContent = genTime.h;
  if (genM) genM.textContent = genTime.m;
  if (genS) genS.textContent = genTime.s;
  if (miniGenTimer) miniGenTimer.textContent = genTime.str;


  // Live timeline countdown tickers
  const pubIntervalSec = (schedulerStatusData?.publishIntervalHours || 4) * 3600;
  document.querySelectorAll('.timeline-countdown-live').forEach(el => {
    const idx = parseInt(el.getAttribute('data-pending-idx'), 10) || 0;
    const remaining = Math.max(0, localPublishRemainingSec + (idx * pubIntervalSec));
    el.textContent = formatSecToHMS(remaining).str;
  });

  // Table row countdown tickers
  document.querySelectorAll('.row-countdown-tick').forEach(el => {
    const idx = parseInt(el.getAttribute('data-pending-idx'), 10) || 0;
    const remaining = Math.max(0, localPublishRemainingSec + (idx * pubIntervalSec));
    el.textContent = formatSecToHMS(remaining).str;
  });
}

function renderPublishingTimeline(timeline = []) {
  const container = document.getElementById('timeline-stream-container');
  if (!container) return;

  if (!timeline || timeline.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px; color: var(--text-muted); text-align: center; width: 100%;">
        <i class="fa-solid fa-circle-check" style="color: #10b981; font-size: 1.6rem; display: block; margin-bottom: 8px;"></i>
        Hàng chờ đăng hiện đang trống. Hãy thêm từ khóa mới vào hàng chờ để kích hoạt dòng thời gian xuất bản tự động!
      </div>
    `;
    return;
  }

  const pubIntervalSec = (schedulerStatusData?.publishIntervalHours || 4) * 3600;

  container.innerHTML = timeline.map((item, idx) => {
    const isNextUp = idx === 0;
    const remainingSec = Math.max(0, localPublishRemainingSec + (idx * pubIntervalSec));
    const hms = formatSecToHMS(remainingSec);
    const estDate = new Date(Date.now() + remainingSec * 1000);
    const estTimeStr = formatDisplayDateTime(estDate.toISOString());

    return `
      <div class="timeline-item-card ${isNextUp ? 'next-up' : ''}" data-kw-id="${item.id}" data-pending-idx="${idx}">
        <div class="timeline-card-top">
          <span class="timeline-order-badge">
            ${isNextUp ? '<i class="fa-solid fa-fire"></i> SẮP ĐĂNG (#1)' : `LƯỢT ĐĂNG #${item.order}`}
          </span>
          <span class="timeline-timer-badge">
            <i class="${isNextUp ? 'fa-solid fa-stopwatch fa-spin' : 'fa-regular fa-clock'}"></i>
            <span class="timeline-countdown-live" data-pending-idx="${idx}">${hms.str}</span>
          </span>
        </div>

        <div>
          <h5 class="timeline-title" title="${escapeHtml(item.title)}">
            ${escapeHtml(item.title)}
          </h5>
          <div style="display: flex; gap: 6px; align-items: center; margin-top: 6px; flex-wrap: wrap;">
            <span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #a5b4fc; font-size: 0.72rem; padding: 2px 6px;">
              <i class="fa-solid fa-tag"></i> ${escapeHtml(item.keyword)}
            </span>
            ${item.hasPost ? `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 0.72rem; padding: 2px 6px;">${item.score || 100}/100đ</span>` : '<span class="badge" style="background: rgba(234, 179, 8, 0.15); color: #fde047; font-size: 0.72rem; padding: 2px 6px;">Chờ Soạn</span>'}
          </div>
        </div>

        <div class="timeline-meta-time">
          <i class="fa-regular fa-calendar-check" style="color: #38bdf8;"></i>
          <span>Dự kiến: <strong style="color: #e2e8f0;">${estTimeStr}</strong></span>
        </div>

        <div class="timeline-actions">
          ${isNextUp 
            ? `<button class="btn btn-sm btn-accent btn-timeline-publish-now" style="flex: 1; font-size: 0.78rem; padding: 5px 8px;">
                 <i class="fa-solid fa-paper-plane"></i> Đăng Ngay
               </button>` 
            : `<button class="btn btn-sm btn-secondary btn-timeline-move-top" data-id="${item.id}" style="flex: 1; font-size: 0.78rem; padding: 5px 8px;" title="Ưu tiên đăng bài này tiếp theo">
                 <i class="fa-solid fa-arrow-up"></i> Ưu Tiên #1
               </button>`
          }
          ${item.generatedPostId 
            ? `<button class="btn btn-sm btn-ghost btn-timeline-read" data-post-id="${item.generatedPostId}" title="Xem bài viết & nguồn đối chiếu thực tế" style="padding: 5px 8px; font-size: 0.78rem;">
                 <i class="fa-solid fa-book-open"></i> Đọc & Nguồn
               </button>` 
            : `<button class="btn btn-sm btn-primary btn-timeline-pregen" data-id="${item.id}" title="Soạn bài trước" style="padding: 5px 8px; font-size: 0.78rem;">
                 <i class="fa-solid fa-wand-magic-sparkles"></i> Soạn
               </button>`
          }
        </div>
      </div>
    `;
  }).join('');

  // Wire event handlers for timeline cards
  container.querySelectorAll('.btn-timeline-publish-now').forEach(btn => {
    btn.addEventListener('click', () => {
      const runPublishBtn = document.getElementById('btn-run-publish-now');
      if (runPublishBtn) runPublishBtn.click();
    });
  });

  container.querySelectorAll('.btn-timeline-move-top').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      try {
        const res = await fetch('/api/keywords/move-top', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          await loadSchedulerStatus();
          await loadKeywords();
        } else {
          showToast(data.message || 'Không thể thay đổi thứ tự', 'error');
        }
      } catch (e) {
        showToast('Lỗi khi đổi thứ tự bài', 'error');
      }
    });
  });

  container.querySelectorAll('.btn-timeline-read').forEach(btn => {
    btn.addEventListener('click', () => {
      const postId = btn.getAttribute('data-post-id');
      if (postId) {
        openQuickPreviewModal(postId);
      }
    });
  });

  container.querySelectorAll('.btn-timeline-pregen').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
      try {
        const res = await fetch(`/api/keywords/pregenerate/${id}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          await loadKeywords();
          await loadPosts();
          await loadSchedulerStatus();
        } else {
          showToast(data.message || 'Lỗi soạn bài', 'error');
        }
      } catch (e) {
        showToast('Lỗi khi soạn bài', 'error');
      }
    });
  });
}

let syncLoopCounter = 0;
function startCountdownLoop() {
  if (countdownTimerInterval) clearInterval(countdownTimerInterval);
  countdownTimerInterval = setInterval(() => {
    syncLoopCounter++;
    // Auto sync background status & queue count every 15 seconds
    if (syncLoopCounter % 15 === 0) {
      loadSchedulerStatus();
      loadKeywords();
      loadPosts();
    }

    if (schedulerStatusData && schedulerStatusData.enabled) {
      let needRefresh = false;
      if (localPublishRemainingSec > 0) {
        localPublishRemainingSec--;
        if (localPublishRemainingSec === 0) needRefresh = true;
      }
      if (localGenerateRemainingSec > 0) {
        localGenerateRemainingSec--;
        if (localGenerateRemainingSec === 0) needRefresh = true;
      }
      updateCountdownDOM();
      if (needRefresh) {
        setTimeout(loadSchedulerStatus, 2000);
      }
    }
  }, 1000);
}

async function loadKeywords() {
  try {
    const res = await fetch('/api/keywords?_t=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();
    if (data.success) {
      currentKeywordsData = data.data || [];
      renderKeywordQueueTable(currentKeywordsData);
      renderEnteredKeywordsCard(currentKeywordsData);
      loadSchedulerStatus();
    }
  } catch (err) {
    console.error('Error loading keywords:', err);
  }
}

async function loadSchedulerConfig() {
  try {
    const res = await fetch('/api/scheduler/config');
    const data = await res.json();
    if (data.success && data.data) {
      const autoInterval = document.getElementById('auto-interval-select');
      if (autoInterval) autoInterval.value = data.data.publishIntervalHours || data.data.intervalHours || '4';
      loadSchedulerStatus();
    }
  } catch (err) {
    console.error('Error loading scheduler config:', err);
  }
}

let currentQueueFilter = 'all';

function renderKeywordQueueTable(keywords = []) {
  const tbody = document.getElementById('keyword-queue-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const pending = keywords.filter(k => k.status === 'pending');
  const pregenerated = keywords.filter(k => k.status === 'pending' && k.generatedPostId);
  const waiting = keywords.filter(k => k.status === 'pending' && !k.generatedPostId);
  const completed = keywords.filter(k => k.status === 'completed');

  // Update counter badges
  const qPendingCount = document.getElementById('queue-pending-count');
  if (qPendingCount) qPendingCount.textContent = pending.length;
  const miniRibbonPendingCount = document.getElementById('mini-ribbon-pending-count');
  if (miniRibbonPendingCount) miniRibbonPendingCount.textContent = pending.length;
  const fAll = document.getElementById('filter-all-count');
  if (fAll) fAll.textContent = keywords.length;
  const fPending = document.getElementById('filter-pending-count');
  if (fPending) fPending.textContent = pending.length;
  const fPregen = document.getElementById('filter-pregen-count');
  if (fPregen) fPregen.textContent = pregenerated.length;
  const fWaiting = document.getElementById('filter-waiting-count');
  if (fWaiting) fWaiting.textContent = waiting.length;
  const fComp = document.getElementById('filter-completed-count');
  if (fComp) fComp.textContent = completed.length;

  let displayItems = keywords;
  if (currentQueueFilter === 'pending') displayItems = pending;
  else if (currentQueueFilter === 'pregenerated') displayItems = pregenerated;
  else if (currentQueueFilter === 'waiting') displayItems = waiting;
  else if (currentQueueFilter === 'completed') displayItems = completed;

  if (displayItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 28px; color: var(--text-muted);"><i class="fa-solid fa-inbox" style="font-size: 1.6rem; display: block; margin-bottom: 8px; opacity: 0.6;"></i> Không có từ khóa nào trong danh mục này.</td></tr>`;
    return;
  }

  displayItems.forEach(item => {
    const tr = document.createElement('tr');
    let targetPost = item.generatedPostId ? currentPostsData.find(p => p.id === item.generatedPostId) : null;
    if (!targetPost && item.wpPostId) {
      targetPost = currentPostsData.find(p => p.wpPostId === item.wpPostId || p.wpPostId === Number(item.wpPostId));
    }
    if (!targetPost && item.wpLink) {
      targetPost = currentPostsData.find(p => p.wpLink && p.wpLink.replace(/\/$/, '') === item.wpLink.replace(/\/$/, ''));
    }
    const pendingIdx = pending.findIndex(k => k.id === item.id);

    // Col 1: Từ khóa mục tiêu
    const colKw = `
      <td>
        <strong class="kw-title">${escapeHtml(item.keyword)}</strong>
        <span class="kw-topic"><i class="fa-solid fa-folder-open"></i> ${escapeHtml(item.topic || 'Chủ đề chung')}</span>
        <span class="kw-date"><i class="fa-regular fa-clock"></i> ${formatDisplayDateTime(item.createdAt)}</span>
      </td>
    `;

    // Col 2: Nội dung bài viết AI đã sinh
    let colContent = '';
    if (targetPost) {
      const wordCount = targetPost.content ? targetPost.content.trim().split(/\s+/).filter(Boolean).length : 0;
      colContent = `
        <td>
          <div class="post-preview-info">
            <strong class="generated-title" title="${escapeHtml(targetPost.title)}">${escapeHtml(targetPost.title)}</strong>
            <p class="generated-excerpt">${escapeHtml(targetPost.metaDescription || (targetPost.content ? targetPost.content.substring(0, 110) + '...' : ''))}</p>
            <div class="post-mini-tags">
              <span class="mini-tag words"><i class="fa-solid fa-align-left"></i> ${wordCount} từ</span>
              ${targetPost.imageUrl ? '<span class="mini-tag img"><i class="fa-solid fa-image"></i> Có ảnh</span>' : ''}
              <span class="mini-tag date"><i class="fa-regular fa-calendar"></i> ${targetPost.date || 'Hôm nay'}</span>
            </div>
          </div>
        </td>
      `;
    } else {
      colContent = `
        <td>
          <div class="post-pending-placeholder">
            <i class="fa-solid fa-hourglass-half" style="color: #38bdf8;"></i>
            <span><em>Chưa có bài viết — Đang xếp hàng chờ AI tự động sinh bài...</em></span>
          </div>
        </td>
      `;
    }

    // Col 3: LINK ĐÍCH SEO MỤC TIÊU (GÁN SẢN PHẨM/PAGE)
    const targetUrlVal = (item.targetUrl || '').trim();
    let hasMatchedGads = false;
    let gadsOptionsHtml = `<option value="">-- Chọn Trang Đích Google Ads --</option>`;
    if (Array.isArray(googleAdsLinks) && googleAdsLinks.length > 0) {
      googleAdsLinks.forEach(g => {
        const isSel = (targetUrlVal && (targetUrlVal === g.url || targetUrlVal.replace(/\/$/, '') === g.url.replace(/\/$/, '')));
        if (isSel) hasMatchedGads = true;
        gadsOptionsHtml += `<option value="${escapeHtml(g.url)}" ${isSel ? 'selected' : ''}>🎯 ${escapeHtml(g.name)}</option>`;
      });
    }
    gadsOptionsHtml += `<option value="__custom__" ${(!hasMatchedGads && targetUrlVal) ? 'selected' : ''}>✏️ Tùy chỉnh (URL khác)...</option>`;

    const colTargetUrl = `
      <td>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <select 
            class="form-control form-control-sm select-gads-quick" 
            data-id="${item.id}"
            style="font-size: 11px; padding: 5px 8px; border-radius: 6px; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; font-weight: 600; cursor: pointer; max-width: 220px;"
            title="Chọn nhanh trang đích Google Ads mục tiêu"
          >
            ${gadsOptionsHtml}
          </select>
          <div style="display: flex; gap: 6px; align-items: center;">
            <input 
              type="url" 
              class="form-control form-control-sm input-target-url" 
              data-id="${item.id}" 
              value="${escapeHtml(targetUrlVal)}" 
              placeholder="https://xulynuochoasen.com/he-thong-loc-..." 
              title="URL trang đích thực tế trên website"
              style="font-size: 11px; padding: 5px 8px; border-radius: 6px; background: rgba(10, 15, 29, 0.85); border: 1px solid rgba(255, 255, 255, 0.12); color: #f1f5f9; width: 100%; min-width: 140px;"
            />
            <button 
              type="button"
              class="btn btn-sm btn-secondary btn-save-target-url" 
              data-id="${item.id}" 
              title="Lưu Link Đích SEO Mục Tiêu"
              style="padding: 5px 8px; font-size: 12px; border-radius: 6px; flex-shrink: 0; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15);"
            >💾</button>
          </div>
        </div>
      </td>
    `;

    // Col 4: ⏱️ Đếm Ngược Xuất Bản
    let colCountdown = '';
    if (pendingIdx !== -1) {
      const pubIntervalSec = (schedulerStatusData?.publishIntervalHours || 4) * 3600;
      const remaining = Math.max(0, localPublishRemainingSec + (pendingIdx * pubIntervalSec));
      const hms = formatSecToHMS(remaining);
      const estDate = new Date(Date.now() + remaining * 1000);
      const estStr = formatDisplayDateTime(estDate.toISOString());
      const isNext = pendingIdx === 0;

      colCountdown = `
        <td>
          <div class="cell-countdown">
            <span class="badge-timer ${isNext ? 'next-up' : ''}">
              <i class="${isNext ? 'fa-solid fa-stopwatch' : 'fa-regular fa-clock'}"></i>
              <span class="row-countdown-tick" data-pending-idx="${pendingIdx}">${hms.str}</span>
            </span>
            <span class="est-time-text">${isNext ? '🔥 Sắp đăng:' : `Lượt #${pendingIdx + 1}:`} ${estStr}</span>
          </div>
        </td>
      `;
    } else {
      colCountdown = `
        <td>
          <div class="cell-countdown">
            <span class="badge" style="background: rgba(16,185,129,0.15); color: #34d399; font-weight: 600; padding: 4px 8px; border-radius: 6px; width: fit-content;">
              <i class="fa-solid fa-circle-check"></i> Đã Đăng
            </span>
            <span class="est-time-text">${formatDisplayDateTime(item.completedAt || item.updatedAt)}</span>
          </div>
        </td>
      `;
    }

    // Col 5: Điểm SEO & Trạng thái
    let colStatus = '';
    if (targetPost) {
      const scoreClass = targetPost.score >= 80 ? 'high' : (targetPost.score >= 60 ? 'mid' : 'low');
      const isPublished = item.status === 'completed' || targetPost.wpPublished;
      colStatus = `
        <td>
          <span class="score-badge ${scoreClass}">${targetPost.score || 0}/100</span>
          <div style="margin-top: 5px;">
            ${isPublished 
              ? (targetPost.wpLink ? `<a href="${targetPost.wpLink}" target="_blank" class="badge badge-pub" style="font-size: 0.72rem; padding: 2px 6px;">WP 🔗</a>` : '<span class="badge badge-pub" style="font-size: 0.72rem; padding: 2px 6px;">WP ✅</span>')
              : '<span class="badge badge-draft" style="font-size: 0.72rem; padding: 2px 6px;">Đã Soạn</span>'}
          </div>
        </td>
      `;
    } else {
      colStatus = `
        <td>
          <span class="score-badge low">Chờ Viết</span>
          <div style="margin-top: 5px;">
            <span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-muted); font-size: 0.72rem; padding: 2px 6px;">Hàng Đợi</span>
          </div>
        </td>
      `;
    }

    // Col 6: Thao tác & Theo dõi nội dung
    let colAction = '';
    const canMoveTop = pendingIdx > 0;
    if (targetPost) {
      colAction = `
        <td>
          <div style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
            ${canMoveTop ? `<button class="btn btn-sm btn-secondary btn-move-top" data-id="${item.id}" title="Đưa lên vị trí #1 để đăng tiếp theo" style="padding: 5px 8px; font-size: 0.75rem;"><i class="fa-solid fa-arrow-up"></i> Ưu Tiên</button>` : ''}
            <button class="btn btn-sm btn-primary btn-quick-read" data-post-id="${targetPost.id}" title="Đọc toàn văn bài viết & xem link nguồn" style="padding: 5px 8px; font-size: 0.75rem;"><i class="fa-solid fa-book-open"></i> Đọc & Nguồn</button>
            <button class="btn btn-sm btn-secondary btn-edit-post-table" data-post-id="${targetPost.id}" title="Mở trong trình soạn thảo" style="padding: 5px 8px; font-size: 0.75rem;"><i class="fa-solid fa-pen-nib"></i></button>
            ${item.status !== 'completed' ? `<button class="btn btn-sm btn-accent btn-publish-single-table" data-post-id="${targetPost.id}" title="Xuất bản lên WordPress ngay" style="padding: 5px 8px; font-size: 0.75rem;"><i class="fa-brands fa-wordpress"></i></button>` : ''}
            <button class="btn btn-sm btn-ghost btn-del-kw" data-id="${item.id}" title="Xóa khỏi hàng chờ" style="padding: 5px 8px; font-size: 0.75rem;"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      `;
    } else {
      colAction = `
        <td>
          <div style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
            ${canMoveTop ? `<button class="btn btn-sm btn-secondary btn-move-top" data-id="${item.id}" title="Đưa lên vị trí #1" style="padding: 5px 8px; font-size: 0.75rem;"><i class="fa-solid fa-arrow-up"></i></button>` : ''}
            <button class="btn btn-sm btn-primary btn-pregen-single" data-id="${item.id}" style="white-space: nowrap; padding: 5px 8px; font-size: 0.75rem;"><i class="fa-solid fa-wand-magic-sparkles"></i> Soạn</button>
            <button class="btn btn-sm btn-ghost btn-del-kw" data-id="${item.id}" title="Xóa khỏi hàng chờ" style="padding: 5px 8px; font-size: 0.75rem;"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      `;
    }

    tr.innerHTML = colKw + colContent + colTargetUrl + colCountdown + colStatus + colAction;

    // Event: Move to top
    const moveTopBtn = tr.querySelector('.btn-move-top');
    if (moveTopBtn) {
      moveTopBtn.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/keywords/move-top', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: item.id })
          });
          const data = await res.json();
          if (data.success) {
            showToast(data.message, 'success');
            await loadSchedulerStatus();
            await loadKeywords();
          } else {
            showToast(data.message || 'Lỗi khi đổi thứ tự', 'error');
          }
        } catch (e) {
          showToast('Lỗi khi đổi thứ tự bài', 'error');
        }
      });
    }

    // Event: Read content in Modal
    const readBtn = tr.querySelector('.btn-quick-read');
    if (readBtn) {
      readBtn.addEventListener('click', () => {
        openQuickPreviewModal(targetPost ? targetPost.id : null, item);
      });
    }

    // Event: Edit in Editor
    const editBtn = tr.querySelector('.btn-edit-post-table');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        editPost(targetPost);
        showToast(`Đang mở bài viết "${targetPost.title}" trong Editor!`, 'success');
      });
    }

    // Event: 1-Click Publish from table
    const pubBtn = tr.querySelector('.btn-publish-single-table');
    if (pubBtn) {
      pubBtn.addEventListener('click', async () => {
        pubBtn.disabled = true;
        pubBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        await publishPostToWP(targetPost.id);
        await loadKeywords();
        await loadPosts();
        await loadSchedulerStatus();
      });
    }

    // Event: Pregenerate single
    const pregenBtn = tr.querySelector('.btn-pregen-single');
    if (pregenBtn) {
      pregenBtn.addEventListener('click', async () => {
        pregenBtn.disabled = true;
        pregenBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang viết...';
        try {
          const res = await fetch(`/api/keywords/pregenerate/${item.id}`, { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            showToast(data.message, 'success');
            await loadPosts();
            await loadKeywords();
            await loadSchedulerStatus();
          } else {
            showToast(data.message || 'Lỗi khi soạn bài.', 'error');
            pregenBtn.disabled = false;
            pregenBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> ✨ Soạn Bài Ngay';
          }
        } catch (e) {
          showToast('Lỗi kết nối khi soạn bài.', 'error');
          pregenBtn.disabled = false;
          pregenBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> ✨ Soạn Bài Ngay';
        }
      });
    }

    // Event: Delete keyword
    const delBtn = tr.querySelector('.btn-del-kw');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (confirm(`Anh có chắc muốn xóa từ khóa "${item.keyword}" khỏi hàng chờ không?`)) {
          await deleteKeyword(item.id);
        }
      });
    }

    // Event: Save Target URL (Link Đích SEO)
    const saveUrlBtn = tr.querySelector('.btn-save-target-url');
    const urlInput = tr.querySelector('.input-target-url');
    const handleSaveUrl = async () => {
      if (!urlInput || !saveUrlBtn) return;
      const newUrl = urlInput.value.trim();
      saveUrlBtn.disabled = true;
      saveUrlBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      try {
        const res = await fetch('/api/keywords/update-target-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, targetUrl: newUrl })
        });
        const data = await res.json();
        if (data.success) {
          saveUrlBtn.innerHTML = '✅';
          showToast(`Đã lưu link đích SEO cho từ khóa "${item.keyword}"!`, 'success');
          item.targetUrl = newUrl;
          setTimeout(() => {
            if (saveUrlBtn) {
              saveUrlBtn.innerHTML = '💾';
              saveUrlBtn.disabled = false;
            }
          }, 1500);
          if (data.postUpdated) {
            await loadPosts();
          }
        } else {
          showToast(data.message || 'Lỗi khi lưu link đích.', 'error');
          saveUrlBtn.innerHTML = '💾';
          saveUrlBtn.disabled = false;
        }
      } catch (err) {
        showToast('Lỗi kết nối khi lưu link đích.', 'error');
        saveUrlBtn.innerHTML = '💾';
        saveUrlBtn.disabled = false;
      }
    };

    const gadsSelect = tr.querySelector('.select-gads-quick');
    if (gadsSelect && urlInput) {
      gadsSelect.addEventListener('change', () => {
        const val = gadsSelect.value;
        if (val && val !== '__custom__') {
          urlInput.value = val;
          handleSaveUrl();
        } else if (val === '__custom__') {
          urlInput.focus();
          urlInput.select();
        }
      });
    }

    if (saveUrlBtn) {
      saveUrlBtn.addEventListener('click', handleSaveUrl);
    }
    if (urlInput) {
      urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSaveUrl();
        }
      });
    }

    tbody.appendChild(tr);
  });
}

function getPostImages(post) {
  let img1 = post.imageUrl || post.featured_image || '';
  let img2 = post.secondaryImageUrl || '';
  if (!img2 && post.content) {
    const matches = [...post.content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
    if (matches.length >= 2) {
      if (!img1) img1 = matches[0][2];
      img2 = matches[1][2];
    } else if (matches.length === 1 && !img1) {
      img1 = matches[0][2];
    }
  }
  return {
    img1: img1 || 'https://images.unsplash.com/photo-1548839140-29a749e1cf4e?w=800&auto=format&fit=crop&q=80',
    img2: img2 || 'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=800&auto=format&fit=crop&q=80'
  };
}

function updatePreviewModalImages(post) {
  const { img1, img2 } = getPostImages(post);
  const targetUrl = (post.targetProductUrl || post.targetUrl || 'https://xulynuochoasen.com/').trim();
  const img1El = document.getElementById('modal-img1-preview');
  const img2El = document.getElementById('modal-img2-preview');
  if (img1El) {
    img1El.src = img1;
    img1El.style.cursor = 'pointer';
    img1El.title = `Nhấp để xem trang sản phẩm đích (mở tab mới): ${targetUrl}`;
    img1El.onclick = () => window.open(targetUrl, '_blank');
  }
  if (img2El) {
    img2El.src = img2;
    img2El.style.cursor = 'pointer';
    img2El.title = `Nhấp để xem trang sản phẩm đích (mở tab mới): ${targetUrl}`;
    img2El.onclick = () => window.open(targetUrl, '_blank');
  }
}

function renderArticleContent(contentBox, post) {
  if (!contentBox || !post) return;
  const targetUrl = (post.targetProductUrl || post.targetUrl || 'https://xulynuochoasen.com/').trim();
  let html = '';
  if (window.marked && typeof marked.parse === 'function') {
    html = marked.parse(post.content || '*Chưa có nội dung bài viết.*');
  } else {
    html = (post.content || '').replace(/\n\n/g, '<br><br>');
  }
  contentBox.innerHTML = html;

  // Process all images inside article content to ensure they are clickable links to targetProductUrl
  const imgs = contentBox.querySelectorAll('img');
  imgs.forEach(img => {
    img.style.cursor = 'pointer';
    img.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
    img.title = (img.alt ? img.alt + ' - ' : '') + 'Nhấp để xem sản phẩm chi tiết (mở tab mới)';

    const parentA = img.closest('a');
    if (parentA) {
      parentA.target = '_blank';
      parentA.rel = 'noopener noreferrer';
      parentA.title = img.title;
      parentA.href = targetUrl;
    } else {
      const a = document.createElement('a');
      a.href = targetUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.title = img.title;
      img.parentNode.insertBefore(a, img);
      a.appendChild(img);
    }
    img.onclick = (e) => {
      e.preventDefault();
      window.open(targetUrl, '_blank');
    };
  });

  // Ensure all links in content open in new tab
  const allLinks = contentBox.querySelectorAll('a');
  allLinks.forEach(a => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
}

async function openQuickPreviewModal(postInput, keywordItem) {
  const modal = document.getElementById('quick-preview-modal');
  if (!modal || !postInput) return;

  let post = postInput;
  const postId = typeof postInput === 'string' ? postInput : postInput.id;
  if (postId) {
    try {
      const res = await fetch(`/api/posts/${postId}`);
      const d = await res.json();
      if (d.success && d.post) {
        post = d.post;
        const cachedIdx = currentPostsData.findIndex(p => p.id === postId);
        if (cachedIdx !== -1) currentPostsData[cachedIdx] = post;
      }
    } catch (e) {}
  }

  document.getElementById('modal-post-title').textContent = post.title || 'Bài viết chưa có tiêu đề';
  const metaEl = document.getElementById('modal-post-meta');
  if (metaEl) {
    metaEl.innerHTML = `<span style="color:#a5b4fc;"><i class="fa-solid fa-tag"></i> Từ khóa: <strong>${escapeHtml(post.targetKeyword || keywordItem?.keyword || 'N/A')}</strong></span>
      <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; margin-left: 8px; font-size: 0.72rem; padding: 2px 6px;">
        <i class="fa-solid fa-brain"></i> Tri Thức: Google Top 1-5 & Khảo Sát Thực Địa Miền Nam
      </span>`;
  }
  document.getElementById('modal-score-badge').textContent = `Điểm SEO: ${post.score || 0}/100`;
  const wordCount = post.content ? post.content.trim().split(/\s+/).filter(Boolean).length : 0;
  document.getElementById('modal-words-badge').textContent = `${wordCount} từ`;
  document.getElementById('modal-status-badge').textContent = post.wpPublished 
    ? 'Trạng thái: Đã đăng WordPress' 
    : (post.status === 'ready' ? 'Trạng thái: Bản nháp sẵn sàng' : 'Trạng thái: ' + post.status);
  document.getElementById('modal-meta-desc').textContent = post.metaDescription || 'Chưa có thẻ Meta Description.';

  // Update image slots
  updatePreviewModalImages(post);

  // Wire Randomize Image Pair Button
  const btnRandomize = document.getElementById('btn-modal-randomize-images');
  if (btnRandomize) {
    btnRandomize.onclick = async () => {
      btnRandomize.disabled = true;
      btnRandomize.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đổi ảnh...';
      try {
        const res = await fetch(`/api/posts/${post.id}/randomize-images`, { method: 'POST' });
        const data = await res.json();
        if (data.success && data.post) {
          Object.assign(post, data.post);
          const cachedIdx = currentPostsData.findIndex(p => p.id === post.id);
          if (cachedIdx !== -1) currentPostsData[cachedIdx] = post;

          updatePreviewModalImages(post);

          const contentBox = document.getElementById('modal-article-rendered-content');
          renderArticleContent(contentBox, post);
          showToast('Đã đổi cả 2 ảnh mới độc bản từ thư viện 942 ảnh!', 'success');
        } else {
          showToast(data.message || 'Không thể đổi ảnh', 'error');
        }
      } catch (err) {
        showToast('Lỗi khi đổi ảnh: ' + err.message, 'error');
      } finally {
        btnRandomize.disabled = false;
        btnRandomize.innerHTML = '<i class="fa-solid fa-shuffle"></i> 🔄 Đổi Cả 2 Ảnh Mới';
      }
    };
  }

  // Wire Compose Banner Button (Wave, Circles, VS Split)
  const btnComposeBanner = document.getElementById('btn-modal-compose-banner');
  const selectBannerStyle = document.getElementById('modal-banner-style-select');
  if (btnComposeBanner) {
    btnComposeBanner.onclick = async () => {
      btnComposeBanner.disabled = true;
      btnComposeBanner.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang ghép...';
      const chosenStyle = selectBannerStyle ? selectBannerStyle.value : 'auto';
      try {
        const res = await fetch(`/api/banner/generate-for-post/${post.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ style: chosenStyle })
        });
        const data = await res.json();
        if (data.success && data.post) {
          Object.assign(post, data.post);
          const cachedIdx = currentPostsData.findIndex(p => p.id === post.id);
          if (cachedIdx !== -1) currentPostsData[cachedIdx] = post;

          updatePreviewModalImages(post);

          const contentBox = document.getElementById('modal-article-rendered-content');
          renderArticleContent(contentBox, post);
          showToast(data.message || 'Đã ghép Banner 16:9 độc bản thành công!', 'success');
          loadPosts();
        } else {
          showToast(data.message || 'Không thể tạo banner', 'error');
        }
      } catch (err) {
        showToast('Lỗi khi tạo banner: ' + err.message, 'error');
      } finally {
        btnComposeBanner.disabled = false;
        btnComposeBanner.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 🎨 Ghép Banner 16:9 Độc Bản';
      }
    };
  }

  // Wire Hand-Pick Buttons
  const btnPick1 = document.getElementById('btn-pick-img1');
  if (btnPick1) {
    btnPick1.onclick = () => {
      openMediaGalleryModal(1, post);
    };
  }

  const btnPick2 = document.getElementById('btn-pick-img2');
  if (btnPick2) {
    btnPick2.onclick = () => {
      openMediaGalleryModal(2, post);
    };
  }

  const contentBox = document.getElementById('modal-article-rendered-content');
  renderArticleContent(contentBox, post);

  // Render External Sources List Panel
  await renderModalExternalSources(post);

  const btnEdit = document.getElementById('btn-modal-open-editor');
  if (btnEdit) {
    btnEdit.onclick = () => {
      modal.style.display = 'none';
      editPost(post);
    };
  }

  const btnPub = document.getElementById('btn-modal-publish-wp');
  if (btnPub) {
    btnPub.onclick = async () => {
      btnPub.disabled = true;
      btnPub.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng...';
      await publishPostToWP(post.id);
      btnPub.disabled = false;
      btnPub.innerHTML = '<i class="fa-brands fa-wordpress"></i> 🚀 Đăng Lên WordPress Ngay';
      modal.style.display = 'none';
      await loadKeywords();
      await loadPosts();
      await loadSchedulerStatus();
    };
  }

  modal.style.display = 'flex';
}

async function renderModalExternalSources(post) {
  const countBadge = document.getElementById('modal-sources-count-badge');
  const sourcesListEl = document.getElementById('modal-sources-list');
  const btnRefreshSources = document.getElementById('btn-refresh-modal-sources');
  if (!sourcesListEl) return;

  let sources = post.sources || [];
  if (!sources || sources.length === 0) {
    if (countBadge) countBadge.textContent = 'Đang tải nguồn...';
    try {
      const res = await fetch(`/api/posts/${post.id}/sources`);
      const data = await res.json();
      if (data.success && data.sources && data.sources.length > 0) {
        sources = data.sources;
        post.sources = sources;
      }
    } catch (e) {
      console.warn('Could not fetch sources for modal:', e);
    }
  }

  if (countBadge) {
    countBadge.textContent = sources.length > 0 ? `${sources.length} nguồn tham khảo` : 'Chưa có nguồn';
  }

  if (!sources || sources.length === 0) {
    sourcesListEl.innerHTML = `
      <div style="padding: 12px; color: var(--text-muted); font-size: 0.82rem; text-align: center;">
        <i class="fa-solid fa-circle-info"></i> Chưa có danh sách nguồn. Bấm "Quét Lại Nguồn" để tự động cào từ Google VN & Quốc Tế.
      </div>
    `;
  } else {
    sourcesListEl.innerHTML = sources.map((s, idx) => {
      let badgeStyle = 'background: rgba(59, 130, 246, 0.2); color: #60a5fa;';
      let badgeIcon = 'fa-earth-americas';
      if (s.region === 'VN') {
        badgeStyle = 'background: rgba(239, 68, 68, 0.2); color: #f87171;';
        badgeIcon = 'fa-flag';
      } else if (s.region === 'DE') {
        badgeStyle = 'background: rgba(234, 179, 8, 0.2); color: #facc15;';
        badgeIcon = 'fa-gear';
      } else if (s.region === 'JP') {
        badgeStyle = 'background: rgba(168, 85, 247, 0.2); color: #c084fc;';
        badgeIcon = 'fa-microchip';
      }

      const url = s.url || s.link || '#';
      const cleanSnippet = s.snippet ? escapeHtml(s.snippet) : 'Không có đoạn trích dẫn kỹ thuật.';

      return `
        <div class="source-item-card" style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px;">
              <span class="badge" style="${badgeStyle} font-size: 0.72rem; padding: 2px 6px; font-weight: 600;">
                <i class="fa-solid ${badgeIcon}"></i> ${escapeHtml(s.regionName || s.badge || s.region || 'Quốc tế')}
              </span>
              <strong style="color: #f8fafc; font-size: 0.86rem; line-height: 1.3;">#${idx + 1}. ${escapeHtml(s.title || 'Tài liệu kỹ thuật')}</strong>
            </div>
            <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-ghost" style="padding: 3px 8px; font-size: 0.72rem; border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; text-decoration: none; white-space: nowrap;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Mở Web Nguồn
            </a>
          </div>
          <div style="margin-top: 2px;">
            <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; font-size: 0.78rem; text-decoration: underline; word-break: break-all;">
              ${escapeHtml(url)}
            </a>
          </div>
          <p style="margin: 3px 0 0 0; color: #94a3b8; font-size: 0.76rem; line-height: 1.35;">
            ${cleanSnippet}
          </p>
        </div>
      `;
    }).join('');
  }

  if (btnRefreshSources) {
    btnRefreshSources.onclick = async () => {
      btnRefreshSources.disabled = true;
      btnRefreshSources.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang quét...';
      try {
        const res = await fetch(`/api/posts/${post.id}/sources?force=true`);
        const data = await res.json();
        if (data.success && data.sources) {
          post.sources = data.sources;
          await renderModalExternalSources(post);
          showToast(`Đã quét thành công ${data.sources.length} nguồn tri thức thực tế!`, 'success');
        }
      } catch (err) {
        showToast('Lỗi khi quét lại nguồn: ' + err.message, 'error');
      } finally {
        btnRefreshSources.disabled = false;
        btnRefreshSources.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Quét Lại Nguồn';
      }
    };
  }
}


/* ==========================================================================
   MEDIA GALLERY MODAL & IMAGE PICKER LOGIC (611 VERIFIED IMAGES)
   ========================================================================== */
let galleryPickingSlot = 1;
let galleryPickingPost = null;
let galleryCurrentPage = 1;
let galleryCurrentCategory = 'all';
let galleryCurrentSearch = '';
let gallerySearchDebounce = null;
let galleryTotalPages = 1;

function openMediaGalleryModal(slot, post) {
  galleryPickingSlot = slot;
  galleryPickingPost = post;
  galleryCurrentPage = 1;
  galleryCurrentCategory = 'all';
  galleryCurrentSearch = '';

  const label = document.getElementById('gallery-picking-for-label');
  if (label) {
    label.textContent = slot === 1 
      ? 'Ảnh 1 (Ảnh Đại Diện & Hero)' 
      : 'Ảnh 2 (Minh Họa Nội Dung)';
  }

  // Reset category tabs
  document.querySelectorAll('#gallery-cat-tabs .gallery-cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-cat') === 'all');
  });

  const searchInput = document.getElementById('gallery-search-input');
  if (searchInput) searchInput.value = '';

  const modal = document.getElementById('media-gallery-modal');
  if (modal) modal.style.display = 'flex';

  fetchAndRenderGallery();
}

async function fetchAndRenderGallery() {
  const grid = document.getElementById('gallery-grid');
  const loading = document.getElementById('gallery-loading-indicator');
  const emptyState = document.getElementById('gallery-empty-state');
  const pageInfo = document.getElementById('gallery-page-info');
  const btnPrev = document.getElementById('btn-gallery-prev');
  const btnNext = document.getElementById('btn-gallery-next');

  if (loading) loading.style.display = 'block';
  if (grid) grid.innerHTML = '';
  if (emptyState) emptyState.style.display = 'none';

  try {
    const params = new URLSearchParams({
      category: galleryCurrentCategory,
      search: galleryCurrentSearch,
      page: galleryCurrentPage,
      limit: 24
    });

    const res = await fetch(`/api/media/gallery?${params.toString()}`);
    const data = await res.json();

    if (loading) loading.style.display = 'none';

    if (data.success && Array.isArray(data.items)) {
      galleryTotalPages = data.totalPages || 1;

      if (pageInfo) {
        pageInfo.textContent = `Trang ${data.page} / ${data.totalPages} (${data.total} ảnh)`;
      }

      if (btnPrev) btnPrev.disabled = data.page <= 1;
      if (btnNext) btnNext.disabled = data.page >= data.totalPages;

      if (data.items.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      data.items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'gallery-item-card';
        card.style.cssText = 'background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; cursor: pointer; transition: all 0.2s ease; position: relative;';

        const categoryLabels = {
          phen: 'Lọc Phèn',
          ro: 'Lọc RO',
          gieng: 'Giếng Khoan',
          sinh_hoat: 'Sinh Hoạt',
          cong_nghiep: 'Công Nghiệp',
          general: 'Chung'
        };

        const catName = categoryLabels[item.category] || 'Ảnh Thư Viện';

        card.innerHTML = `
          <div style="width: 100%; height: 120px; background: #0b1329; overflow: hidden; position: relative;">
            <img src="${item.url}" alt="${escapeHtml(item.title)}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;" onerror="this.src='https://images.unsplash.com/photo-1548839140-29a749e1cf4e?w=300&q=80'" />
            <span style="position: absolute; top: 6px; right: 6px; background: rgba(15, 23, 42, 0.85); color: #38bdf8; font-size: 0.7rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.3);">${catName}</span>
          </div>
          <div style="padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; flex: 1; justify-content: space-between;">
            <div style="font-size: 0.76rem; color: #f1f5f9; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" title="${escapeHtml(item.title)}">
              ${escapeHtml(item.title)}
            </div>
            <button class="btn btn-sm btn-primary btn-pick-this-img" style="width: 100%; font-size: 0.75rem; padding: 4px 6px; margin-top: 4px;">
              <i class="fa-solid fa-check"></i> Chọn Ảnh Này
            </button>
          </div>
        `;

        card.onmouseenter = () => {
          card.style.borderColor = 'rgba(56, 189, 248, 0.5)';
          card.style.transform = 'translateY(-2px)';
          card.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
        };
        card.onmouseleave = () => {
          card.style.borderColor = 'rgba(255,255,255,0.08)';
          card.style.transform = 'translateY(0)';
          card.style.boxShadow = 'none';
        };

        const selectThisImage = async () => {
          if (!galleryPickingPost) return;
          const bodyPayload = galleryPickingSlot === 1 
            ? { img1: item.url } 
            : { img2: item.url };

          try {
            const res = await fetch(`/api/posts/${galleryPickingPost.id}/update-images`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(bodyPayload)
            });
            const resData = await res.json();
            if (resData.success && resData.post) {
              Object.assign(galleryPickingPost, resData.post);
              const cachedIdx = currentPostsData.findIndex(p => p.id === galleryPickingPost.id);
              if (cachedIdx !== -1) currentPostsData[cachedIdx] = galleryPickingPost;

              updatePreviewModalImages(galleryPickingPost);

              const contentBox = document.getElementById('modal-article-rendered-content');
              if (contentBox && typeof renderArticleContent === 'function') {
                renderArticleContent(contentBox, galleryPickingPost);
              } else if (contentBox) {
                contentBox.innerHTML = (galleryPickingPost.content || '').replace(/\n\n/g, '<br><br>');
              }

              const modal = document.getElementById('media-gallery-modal');
              if (modal) modal.style.display = 'none';

              showToast(`Đã gán ảnh thành công cho Ảnh ${galleryPickingSlot}!`, 'success');
            } else {
              showToast(resData.message || 'Không thể cập nhật ảnh', 'error');
            }
          } catch (err) {
            showToast('Lỗi khi cập nhật ảnh: ' + err.message, 'error');
          }
        };

        card.addEventListener('click', (e) => {
          selectThisImage();
        });

        grid.appendChild(card);
      });
    }
  } catch (err) {
    if (loading) loading.style.display = 'none';
    showToast('Lỗi tải danh sách ảnh: ' + err.message, 'error');
  }
}

function initMediaGalleryModalEvents() {
  const modal = document.getElementById('media-gallery-modal');
  const btnClose = document.getElementById('btn-close-gallery-modal');
  const btnCloseFooter = document.getElementById('btn-gallery-close');

  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCloseFooter) btnCloseFooter.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Category filter tabs
  document.querySelectorAll('#gallery-cat-tabs .gallery-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#gallery-cat-tabs .gallery-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      galleryCurrentCategory = btn.getAttribute('data-cat') || 'all';
      galleryCurrentPage = 1;
      fetchAndRenderGallery();
    });
  });

  // Live search
  const searchInput = document.getElementById('gallery-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(gallerySearchDebounce);
      gallerySearchDebounce = setTimeout(() => {
        galleryCurrentSearch = e.target.value.trim();
        galleryCurrentPage = 1;
        fetchAndRenderGallery();
      }, 300);
    });
  }

  // Pagination
  const btnPrev = document.getElementById('btn-gallery-prev');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (galleryCurrentPage > 1) {
        galleryCurrentPage--;
        fetchAndRenderGallery();
      }
    });
  }

  const btnNext = document.getElementById('btn-gallery-next');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (galleryCurrentPage < galleryTotalPages) {
        galleryCurrentPage++;
        fetchAndRenderGallery();
      }
    });
  }
}


async function deleteKeyword(id) {
  try {
    const res = await fetch(`/api/keywords/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Đã xóa từ khóa khỏi hàng chờ', 'success');
      loadKeywords();
    }
  } catch (err) {
    showToast('Lỗi khi xóa từ khóa', 'error');
  }
}

/* ==========================================================================
   ENTERED KEYWORDS TRACKER LOGIC (THEO DÕI & ĐỐI CHIẾU TỪ KHÓA ĐÃ NHẬP)
   ========================================================================== */
let currentEnteredDateFilter = 'all';
let currentEnteredSearchQuery = '';
let enteredKeywordsEventsInitialized = false;

function setupEnteredKeywordsEvents() {
  if (enteredKeywordsEventsInitialized) return;
  enteredKeywordsEventsInitialized = true;

  const searchInput = document.getElementById('input-search-entered-kw');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentEnteredSearchQuery = e.target.value.trim().toLowerCase();
      renderEnteredKeywordsList(currentKeywordsData);
    });
  }

  const copyBtn = document.getElementById('btn-copy-entered-kw');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const itemsToCopy = getFilteredEnteredKeywords(currentKeywordsData);
      if (itemsToCopy.length === 0) {
        showToast('Không có từ khóa nào để copy!', 'error');
        return;
      }
      const text = itemsToCopy.map(k => k.keyword).join('\n');
      navigator.clipboard.writeText(text);
      showToast(`Đã copy ${itemsToCopy.length} từ khóa vào bộ nhớ tạm để anh đối chiếu!`, 'success');
    });
  }

  const refreshBtn = document.getElementById('btn-refresh-entered-kw');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      await loadKeywords();
      refreshBtn.disabled = false;
      showToast('Đã làm mới danh sách từ khóa đã nhập!', 'success');
    });
  }
}

function getLocalDateString(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getFilteredEnteredKeywords(keywords = []) {
  let list = [...keywords];

  // Date filter
  if (currentEnteredDateFilter !== 'all') {
    list = list.filter(k => getLocalDateString(k.createdAt) === currentEnteredDateFilter);
  }

  // Search filter
  if (currentEnteredSearchQuery) {
    list = list.filter(k => 
      k.keyword.toLowerCase().includes(currentEnteredSearchQuery) || 
      (k.topic && k.topic.toLowerCase().includes(currentEnteredSearchQuery))
    );
  }

  return list;
}

function renderEnteredKeywordsCard(keywords = []) {
  setupEnteredKeywordsEvents();

  const countEl = document.getElementById('entered-kw-count');
  if (countEl) countEl.textContent = keywords.length;

  // 1. Build dynamic date filter buttons
  renderEnteredDateFilterButtons(keywords);

  // 2. Render list items
  renderEnteredKeywordsList(keywords);
}

function renderEnteredDateFilterButtons(keywords = []) {
  const container = document.getElementById('entered-date-filters');
  if (!container) return;

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  // Count by date key
  const dateCounts = {};
  keywords.forEach(k => {
    const key = getLocalDateString(k.createdAt) || 'other';
    dateCounts[key] = (dateCounts[key] || 0) + 1;
  });

  // Unique sorted dates descending
  const sortedDateKeys = Object.keys(dateCounts).sort().reverse();

  let html = `
    <button type="button" class="date-pill-btn ${currentEnteredDateFilter === 'all' ? 'active' : ''}" data-date="all">
      Tất Cả (${keywords.length})
    </button>
  `;

  sortedDateKeys.forEach(dateKey => {
    let label = '';
    if (dateKey === todayKey) {
      label = `Hôm Nay (${dateCounts[dateKey]})`;
    } else if (dateKey === yesterdayKey) {
      label = `Hôm Qua (${dateCounts[dateKey]})`;
    } else {
      const parts = dateKey.split('-');
      label = parts.length === 3 ? `${parts[2]}/${parts[1]} (${dateCounts[dateKey]})` : `${dateKey} (${dateCounts[dateKey]})`;
    }

    const isActive = currentEnteredDateFilter === dateKey;
    html += `
      <button type="button" class="date-pill-btn ${isActive ? 'active' : ''}" data-date="${dateKey}">
        ${label}
      </button>
    `;
  });

  container.innerHTML = html;

  // Add click events to date buttons
  container.querySelectorAll('.date-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.date-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentEnteredDateFilter = btn.getAttribute('data-date');
      renderEnteredKeywordsList(currentKeywordsData);
    });
  });
}

function renderEnteredKeywordsList(keywords = []) {
  const listContainer = document.getElementById('entered-kw-list');
  if (!listContainer) return;

  const filtered = getFilteredEnteredKeywords(keywords);

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align:center; padding: 32px 16px; color: var(--text-muted);">
        <i class="fa-solid fa-magnifying-glass" style="font-size: 1.8rem; opacity: 0.4; display: block; margin-bottom: 8px;"></i>
        <span>Không tìm thấy từ khóa nào phù hợp với bộ lọc ngày hoặc từ khóa tìm kiếm.</span>
      </div>
    `;
    return;
  }

  let html = '';
  filtered.forEach((item, idx) => {
    let statusBadge = '';
    if (item.status === 'completed') {
      statusBadge = '<span class="badge badge-pub" style="font-size: 0.72rem;">Đã Đăng WP ✅</span>';
    } else if (item.generatedPostId || item.pregenerated) {
      statusBadge = '<span class="badge badge-draft" style="font-size: 0.72rem;">Đã Soạn Xong 📝</span>';
    } else {
      statusBadge = '<span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-muted); font-size: 0.72rem;">Chờ Viết ⏳</span>';
    }

    html += `
      <div class="entered-kw-item">
        <div class="entered-kw-left">
          <span class="entered-kw-idx">#${idx + 1}</span>
          <div class="entered-kw-info">
            <strong class="entered-kw-text" title="${escapeHtml(item.keyword)}">${escapeHtml(item.keyword)}</strong>
            <div class="entered-kw-meta">
              <span class="entered-kw-date-badge"><i class="fa-regular fa-clock"></i> ${formatDisplayDateTime(item.createdAt)}</span>
              <span class="kw-topic"><i class="fa-solid fa-folder-open"></i> ${escapeHtml(item.topic || 'Chung')}</span>
              ${item.targetUrl ? `<a href="${escapeHtml(item.targetUrl)}" target="_blank" class="entered-kw-link-badge" style="font-size: 0.72rem; color: #38bdf8; text-decoration: underline; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;" title="${escapeHtml(item.targetUrl)}"><i class="fa-solid fa-link"></i> ${escapeHtml(item.targetUrl)}</a>` : ''}
            </div>
          </div>
        </div>
        <div class="entered-kw-right">
          ${statusBadge}
          <button class="btn btn-sm btn-ghost btn-del-entered-kw" data-id="${item.id}" title="Xóa từ khóa khỏi hệ thống"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
  });

  listContainer.innerHTML = html;

  // Wire delete buttons
  listContainer.querySelectorAll('.btn-del-entered-kw').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const item = currentKeywordsData.find(k => k.id === id);
      const kwName = item ? item.keyword : 'từ khóa';
      if (confirm(`Anh có chắc muốn xóa từ khóa "${kwName}" khỏi hệ thống không?`)) {
        await deleteKeyword(id);
      }
    });
  });
}

/* --- Editor & Realtime SEO Analyzer --- */
function setupEditorEvents() {
  const titleInput = document.getElementById('edit-title');
  const keywordInput = document.getElementById('edit-keyword');
  const metaInput = document.getElementById('edit-meta');
  const contentInput = document.getElementById('edit-content');

  const inputs = [titleInput, keywordInput, metaInput, contentInput];

  inputs.forEach(input => {
    input.addEventListener('input', () => {
      if (input === metaInput) {
        document.getElementById('meta-count').textContent = metaInput.value.length;
      }
      debouncedSEOAnalysis();
    });
  });

  const btnWrite = document.getElementById('btn-mode-write');
  const btnPreview = document.getElementById('btn-mode-preview');
  const previewBox = document.getElementById('content-preview');

  btnWrite.addEventListener('click', () => {
    btnWrite.classList.add('active');
    btnPreview.classList.remove('active');
    contentInput.style.display = 'block';
    previewBox.style.display = 'none';
  });

  btnPreview.addEventListener('click', () => {
    btnPreview.classList.add('active');
    btnWrite.classList.remove('active');
    contentInput.style.display = 'none';
    previewBox.style.display = 'block';
    previewBox.innerHTML = marked.parse(contentInput.value || '*Chưa có nội dung bài viết.*');
  });

  document.getElementById('btn-copy-md').addEventListener('click', () => {
    navigator.clipboard.writeText(contentInput.value);
    showToast('Đã copy định dạng Markdown!', 'success');
  });

  document.getElementById('btn-copy-html').addEventListener('click', () => {
    const html = marked.parse(contentInput.value || '');
    navigator.clipboard.writeText(html);
    showToast('Đã copy HTML chuẩn bài viết!', 'success');
  });

  document.getElementById('btn-save-post').addEventListener('click', async () => {
    await saveCurrentPost();
  });

  // 1-Click Auto Fix SEO Button
  document.getElementById('btn-autofix-seo').addEventListener('click', () => {
    const titleInput = document.getElementById('edit-title');
    const metaInput = document.getElementById('edit-meta');
    const keyword = document.getElementById('edit-keyword').value.trim();

    let titleVal = titleInput.value.trim();
    let metaVal = metaInput.value.trim();

    // Auto Trim Title if > 65 chars
    if (titleVal.length > 65) {
      let trimmed = titleVal.substring(0, 62).trim();
      if (!trimmed.toLowerCase().includes(keyword.toLowerCase()) && keyword) {
        trimmed = `Hướng Dẫn ${keyword.toUpperCase()}: ${titleVal.substring(0, 45)}...`;
      } else {
        trimmed += '...';
      }
      titleInput.value = trimmed;
    }

    // Auto Trim Meta Description if > 160 chars
    if (metaVal.length > 160) {
      let trimmedMeta = metaVal.substring(0, 155).trim();
      if (!trimmedMeta.toLowerCase().includes(keyword.toLowerCase()) && keyword) {
        trimmedMeta = `Tìm hiểu thông tin về ${keyword}: ${metaVal.substring(0, 130)}...`;
      } else {
        trimmedMeta += '...';
      }
      metaInput.value = trimmedMeta;
      document.getElementById('meta-count').textContent = metaInput.value.length;
    }

    triggerSEOAnalysis();
    showToast('✨ Đã tự động cắt tỉa Tiêu đề & Meta Description đạt mốc chuẩn SEO!', 'success');
  });
}

function debouncedSEOAnalysis() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    triggerSEOAnalysis();
  }, 400);
}

async function triggerSEOAnalysis() {
  const title = document.getElementById('edit-title').value;
  const keyword = document.getElementById('edit-keyword').value;
  const metaDescription = document.getElementById('edit-meta').value;
  const content = document.getElementById('edit-content').value;

  try {
    const response = await fetch('/api/analyze-seo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, keyword, targetKeyword: keyword, metaDescription, content })
    });

    const data = await response.json();
    if (data.success) {
      updateSEOGauge(data.score, data.stats, data.checks);
    }
  } catch (err) {
    console.error('SEO Analysis error:', err);
  }
}

function updateSEOGauge(score, stats, checks) {
  document.getElementById('seo-score-num').textContent = score;

  const circle = document.getElementById('gauge-circle');
  const offset = 264 - (264 * score) / 100;
  circle.style.strokeDashoffset = offset;

  const label = document.getElementById('gauge-status-label');
  if (score >= 80) {
    circle.style.stroke = '#10b981';
    label.textContent = 'Chuẩn SEO Tuyệt Vời 🚀';
    label.style.color = '#10b981';
  } else if (score >= 60) {
    circle.style.stroke = '#f59e0b';
    label.textContent = 'Khá Tốt (Cần Tối Ưu Thêm)';
    label.style.color = '#f59e0b';
  } else {
    circle.style.stroke = '#f43f5e';
    label.textContent = 'Chưa Đạt Chuẩn';
    label.style.color = '#f43f5e';
  }

  document.getElementById('metric-words').textContent = stats.wordCount;
  document.getElementById('metric-density').textContent = stats.keywordDensity;
  document.getElementById('metric-h2').textContent = stats.h2Count;
  document.getElementById('metric-matches').textContent = stats.keywordMatches;

  const ul = document.getElementById('seo-checklist-ul');
  ul.innerHTML = '';
  checks.forEach(check => {
    const li = document.createElement('li');
    li.className = check.pass ? 'pass' : 'fail';
    li.innerHTML = `
      <i class="fa-solid ${check.pass ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
      <div>
        <strong>${escapeHtml(check.label)}</strong>
        ${check.tip ? `<br><small class="text-muted">${escapeHtml(check.tip)}</small>` : ''}
      </div>
    `;
    ul.appendChild(li);
  });
}

async function saveCurrentPost() {
  const title = document.getElementById('edit-title').value;
  const targetKeyword = document.getElementById('edit-keyword').value;
  const metaDescription = document.getElementById('edit-meta').value;
  const content = document.getElementById('edit-content').value;
  const score = parseInt(document.getElementById('seo-score-num').textContent) || 0;

  if (!title) {
    showToast('Vui lòng nhập tiêu đề bài viết trước khi lưu!', 'error');
    return;
  }

  try {
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: currentPostId,
        title,
        targetKeyword,
        metaDescription,
        content,
        score,
        status: score >= 80 ? 'ready' : 'draft'
      })
    });

    const result = await response.json();
    if (result.success) {
      currentPostId = result.data.id;
      showToast('Đã lưu bài viết vào thư viện thành công!', 'success');
      loadPosts();
    }
  } catch (err) {
    showToast('Lỗi hệ thống khi lưu bài viết.', 'error');
  }
}

function resetEditorForm() {
  currentPostId = null;
  document.getElementById('edit-title').value = '';
  document.getElementById('edit-keyword').value = '';
  document.getElementById('edit-meta').value = '';
  document.getElementById('edit-content').value = '';
  triggerSEOAnalysis();
}

/* --- AI Generator Tab --- */
function setupGeneratorEvents() {
  const form = document.getElementById('ai-generator-form');
  const spinner = document.getElementById('ai-loading-spinner');
  const resultContent = document.getElementById('ai-result-content');
  const sendBtn = document.getElementById('btn-send-to-editor');
  const viewQueueBtn = document.getElementById('btn-view-in-queue');
  const autoAddCheck = document.getElementById('gen-auto-add-queue');

  let generatedArticleData = null;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const topic = document.getElementById('gen-topic').value;
    const keyword = document.getElementById('gen-keyword').value;
    const tone = document.getElementById('gen-tone').value;
    const length = document.getElementById('gen-length').value;
    const apiKey = localStorage.getItem('gemini_api_key') || '';
    const addToQueue = autoAddCheck ? autoAddCheck.checked : true;

    spinner.style.display = 'block';
    resultContent.style.display = 'none';
    sendBtn.style.display = 'none';
    if (viewQueueBtn) viewQueueBtn.style.display = 'none';

    try {
      const response = await fetch('/api/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, keyword, tone, length, apiKey, addToQueue })
      });

      const result = await response.json();
      spinner.style.display = 'none';

      if (result.success) {
        generatedArticleData = result.data;

        resultContent.style.display = 'block';
        sendBtn.style.display = 'inline-flex';
        if (viewQueueBtn && result.post) viewQueueBtn.style.display = 'inline-flex';

        const queueAlert = result.post ? `
          <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
            <div>
              <strong style="color: #10b981; display: block; font-size: 0.95rem;"><i class="fa-solid fa-circle-check"></i> Đã đưa bài viết vào Hàng Chờ Chuẩn Bị Đăng! (${result.pendingCount || 0} Đang Chờ)</strong>
              <span style="font-size: 0.82rem; color: var(--text-muted);">Nội dung bài viết đã lưu sẵn sàng. Anh có thể theo dõi và xem lại bất cứ lúc nào trong Hàng Chờ.</span>
            </div>
            <button class="btn btn-sm btn-accent" id="btn-jump-queue-inline" type="button">
              <i class="fa-solid fa-list-ol"></i> Mở Hàng Chờ Xem Nội Dung
            </button>
          </div>
        ` : '';

        resultContent.innerHTML = `
          <div class="ai-generated-box">
            ${queueAlert}
            <span class="badge-pro">${result.source || 'AI Engine'}</span>
            <h2>${escapeHtml(generatedArticleData.title)}</h2>
            <p><strong>Meta Description:</strong> ${escapeHtml(generatedArticleData.metaDescription)}</p>
            <hr style="border-color: var(--border-color); margin: 16px 0;">
            <div class="markdown-preview">${marked.parse(generatedArticleData.content || '')}</div>
          </div>
        `;

        const inlineJumpBtn = document.getElementById('btn-jump-queue-inline');
        if (inlineJumpBtn) {
          inlineJumpBtn.addEventListener('click', () => {
            switchToTab('tab-autopilot');
          });
        }

        showToast(result.post ? 'Đã sinh bài và thêm vào Hàng Chờ Chuẩn Bị Đăng!' : 'Sinh bài viết hoàn tất!', 'success');
        
        // Refresh local data
        await loadPosts();
        await loadKeywords();
        await loadSchedulerStatus();
      } else {
        resultContent.style.display = 'block';
        resultContent.innerHTML = `<p class="text-rose">Lỗi: ${result.message}</p>`;
      }
    } catch (err) {
      spinner.style.display = 'none';
      resultContent.style.display = 'block';
      resultContent.innerHTML = `<p class="text-rose">Không thể kết nối máy chủ sinh bài AI.</p>`;
    }
  });

  if (viewQueueBtn) {
    viewQueueBtn.addEventListener('click', () => {
      switchToTab('tab-autopilot');
    });
  }

  sendBtn.addEventListener('click', () => {
    if (generatedArticleData) {
      document.getElementById('edit-title').value = generatedArticleData.title || '';
      document.getElementById('edit-keyword').value = document.getElementById('gen-keyword').value || '';
      document.getElementById('edit-meta').value = generatedArticleData.metaDescription || '';
      document.getElementById('edit-content').value = generatedArticleData.content || '';

      switchToTab('tab-editor');
      triggerSEOAnalysis();
      showToast('Đã đưa bài viết sang bộ SEO Editor!', 'success');
    }
  });
}

/* --- Schema Generator --- */
function setupSchemaEvents() {
  const btnBuild = document.getElementById('btn-build-schema');
  const btnCopy = document.getElementById('btn-copy-schema');
  const codeOutput = document.getElementById('schema-code-output');

  btnBuild.addEventListener('click', () => {
    const type = document.getElementById('schema-type').value;
    const headline = document.getElementById('schema-headline').value || document.getElementById('edit-title').value || 'Tiêu đề bài viết';
    const image = document.getElementById('schema-image').value || 'https://example.com/default-image.jpg';
    const author = document.getElementById('schema-author').value || 'Tris';
    const publisher = document.getElementById('schema-publisher').value || 'Tris SEO Portal';

    const schemaObj = {
      "@context": "https://schema.org",
      "@type": type,
      "headline": headline,
      "image": [image],
      "datePublished": new Date().toISOString(),
      "dateModified": new Date().toISOString(),
      "author": [{
        "@type": "Person",
        "name": author
      }],
      "publisher": {
        "@type": "Organization",
        "name": publisher,
        "logo": {
          "@type": "ImageObject",
          "url": image
        }
      }
    };

    codeOutput.textContent = `<script type="application/ld+json">\n${JSON.stringify(schemaObj, null, 2)}\n</script>`;
    showToast('Đã tạo mã Schema JSON-LD!', 'success');
  });

  btnCopy.addEventListener('click', () => {
    navigator.clipboard.writeText(codeOutput.textContent);
    showToast('Đã copy mã Schema vào bộ nhớ tạm!', 'success');
  });
}

/* --- Settings --- */
function setupSettingsEvents() {
  const keyInput = document.getElementById('setting-gemini-key');
  const btnSave = document.getElementById('btn-save-settings');

  keyInput.value = localStorage.getItem('gemini_api_key') || '';

  // Also load from server if available
  fetch('/api/settings/gemini-key')
    .then(res => res.json())
    .then(data => {
      if (data.success && data.apiKey) {
        keyInput.value = data.apiKey;
        localStorage.setItem('gemini_api_key', data.apiKey);
      }
    })
    .catch(() => {});

  btnSave.addEventListener('click', async () => {
    const key = keyInput.value.trim();
    localStorage.setItem('gemini_api_key', key);

    try {
      await fetch('/api/settings/gemini-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key })
      });
      showToast('Đã lưu Gemini API Key lên máy chủ!', 'success');
    } catch (err) {
      showToast('Đã lưu Gemini API Key!', 'success');
    }
  });
}

/* ==========================================================================
   GOOGLE ADS LANDING PAGES MANAGEMENT (FRONTEND)
   ========================================================================== */

async function loadGoogleAdsLinks() {
  try {
    const res = await fetch('/api/google-ads/links');
    const data = await res.json();
    if (data.success && Array.isArray(data.data)) {
      googleAdsLinks = data.data;
      renderGoogleAdsTable();
      populateBulkTargetUrlSelect();
      const badge = document.getElementById('gads-count-badge');
      if (badge) {
        badge.textContent = `${googleAdsLinks.length} Trang Đích Chuẩn`;
      }
    }
  } catch (err) {
    console.error('Lỗi khi tải danh sách Google Ads links:', err);
  }
}

function renderGoogleAdsTable() {
  const tbody = document.getElementById('gads-links-tbody');
  if (!tbody) return;

  if (!googleAdsLinks || googleAdsLinks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">
          Chưa có trang đích Google Ads nào. Nhấn <strong>Thêm Trang Đích Mới</strong> để tạo!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = googleAdsLinks.map(item => {
    const kwTags = (item.keywords || []).map(k => `<span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 0.72rem; margin: 2px 3px; display: inline-block;">${escapeHtml(k)}</span>`).join('');
    const defaultBadge = item.isDefault ? `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 0.7rem; margin-left: 6px;">Mặc định</span>` : '';
    
    return `
      <tr data-id="${item.id}">
        <td>
          <div style="font-weight: 600; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
            <span>${escapeHtml(item.name)}</span>
            ${defaultBadge}
          </div>
        </td>
        <td>
          <a href="${escapeHtml(item.url)}" target="_blank" style="color: #38bdf8; text-decoration: underline; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; word-break: break-all; display: inline-flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.75rem;"></i>
            ${escapeHtml(item.url)}
          </a>
        </td>
        <td>
          <div style="display: flex; flex-wrap: wrap; gap: 2px; max-width: 320px;">
            ${kwTags || '<span style="color: var(--text-muted); font-size: 0.75rem;">(Mọi từ khóa)</span>'}
          </div>
        </td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 6px; justify-content: center;">
            <button type="button" class="btn btn-sm btn-secondary btn-gads-edit" data-id="${item.id}" title="Chỉnh sửa trang đích" style="padding: 5px 10px; font-size: 0.8rem;">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button type="button" class="btn btn-sm btn-ghost btn-gads-delete" data-id="${item.id}" title="Xóa trang đích" style="padding: 5px 10px; font-size: 0.8rem; color: #ef4444;">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach Edit & Delete events
  tbody.querySelectorAll('.btn-gads-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const item = googleAdsLinks.find(l => l.id === id);
      if (!item) return;
      openGoogleAdsForm(item);
    });
  });

  tbody.querySelectorAll('.btn-gads-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const item = googleAdsLinks.find(l => l.id === id);
      if (!item) return;
      if (!confirm(`Anh có chắc muốn xóa trang đích "${item.name}" không?`)) return;
      
      try {
        const res = await fetch(`/api/google-ads/links/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          showToast('Đã xóa trang đích thành công!', 'success');
          await loadGoogleAdsLinks();
        } else {
          showToast(data.message || 'Lỗi khi xóa.', 'error');
        }
      } catch (err) {
        showToast('Lỗi kết nối khi xóa.', 'error');
      }
    });
  });
}

function populateBulkTargetUrlSelect() {
  const select = document.getElementById('bulk-target-url-select');
  if (!select) return;

  const currentVal = select.value;
  let optionsHtml = `<option value="">-- Chọn nhanh từ danh sách Trang Đích Google Ads --</option>`;
  (googleAdsLinks || []).forEach(item => {
    const isDef = item.isDefault ? ' (Mặc định)' : '';
    optionsHtml += `<option value="${escapeHtml(item.url)}">🎯 ${escapeHtml(item.name)}${isDef} - ${escapeHtml(item.url.replace('https://xulynuochoasen.com', ''))}</option>`;
  });
  select.innerHTML = optionsHtml;
  if (currentVal) select.value = currentVal;
}

function openGoogleAdsForm(item = null) {
  const wrap = document.getElementById('gads-form-wrap');
  const title = document.getElementById('gads-form-title');
  const idInput = document.getElementById('gads-edit-id');
  const nameInput = document.getElementById('gads-input-name');
  const urlInput = document.getElementById('gads-input-url');
  const kwInput = document.getElementById('gads-input-keywords');
  const defCheck = document.getElementById('gads-input-default');

  if (!wrap) return;
  wrap.style.display = 'block';

  if (item) {
    title.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> <span>Chỉnh Sửa Trang Đích: ${escapeHtml(item.name)}</span>`;
    idInput.value = item.id;
    nameInput.value = item.name || '';
    urlInput.value = item.url || '';
    kwInput.value = Array.isArray(item.keywords) ? item.keywords.join(', ') : '';
    defCheck.checked = !!item.isDefault;
  } else {
    title.innerHTML = `<i class="fa-solid fa-plus"></i> <span>Thêm Trang Đích Google Ads Mới</span>`;
    idInput.value = '';
    nameInput.value = '';
    urlInput.value = 'https://xulynuochoasen.com/';
    kwInput.value = '';
    defCheck.checked = false;
  }

  nameInput.focus();
  wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeGoogleAdsForm() {
  const wrap = document.getElementById('gads-form-wrap');
  if (wrap) wrap.style.display = 'none';
}

async function runGoogleAdsSyncAll() {
  const btn = document.getElementById('btn-gads-sync-all') || document.getElementById('btn-sync-all-google-ads-now');
  const oldText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đồng bộ link Google Ads...';
  }

  try {
    const res = await fetch('/api/google-ads/sync-all', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Đồng bộ toàn bộ link Google Ads thành công!', 'success');
      await Promise.all([loadKeywords(), loadPosts()]);
      if (typeof loadStartupAuditStatus === 'function') {
        loadStartupAuditStatus();
      }
    } else {
      showToast(data.message || 'Lỗi khi đồng bộ link Google Ads.', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối khi đồng bộ link Google Ads: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = oldText;
    }
  }
}

function setupGoogleAdsEvents() {
  const btnAdd = document.getElementById('btn-gads-add-new');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => openGoogleAdsForm());
  }

  const btnCancel = document.getElementById('btn-gads-cancel');
  if (btnCancel) {
    btnCancel.addEventListener('click', () => closeGoogleAdsForm());
  }

  const btnSync = document.getElementById('btn-gads-sync-all');
  if (btnSync) {
    btnSync.addEventListener('click', () => runGoogleAdsSyncAll());
  }

  const btnSyncAutopilot = document.getElementById('btn-sync-all-google-ads-now');
  if (btnSyncAutopilot) {
    btnSyncAutopilot.addEventListener('click', () => runGoogleAdsSyncAll());
  }

  const bulkTargetSelect = document.getElementById('bulk-target-url-select');
  if (bulkTargetSelect) {
    bulkTargetSelect.addEventListener('change', () => {
      const val = bulkTargetSelect.value;
      const targetInput = document.getElementById('bulk-target-url');
      if (targetInput && val) {
        targetInput.value = val;
      }
    });
  }

  const btnSave = document.getElementById('btn-gads-save');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const id = document.getElementById('gads-edit-id')?.value;
      const name = document.getElementById('gads-input-name')?.value.trim();
      const url = document.getElementById('gads-input-url')?.value.trim();
      const kwStr = document.getElementById('gads-input-keywords')?.value.trim();
      const isDefault = document.getElementById('gads-input-default')?.checked;

      if (!name || !url) {
        showToast('Vui lòng nhập Tên hiển thị và URL trang đích!', 'error');
        return;
      }

      const kwArr = kwStr ? kwStr.split(',').map(k => k.trim()).filter(Boolean) : [];
      btnSave.disabled = true;
      btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';

      try {
        let res;
        if (id) {
          res = await fetch(`/api/google-ads/links/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, url, keywords: kwArr, isDefault })
          });
        } else {
          res = await fetch('/api/google-ads/links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, url, keywords: kwArr, isDefault })
          });
        }
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'Đã lưu trang đích Google Ads thành công!', 'success');
          closeGoogleAdsForm();
          await loadGoogleAdsLinks();
          await loadKeywords();
        } else {
          showToast(data.message || 'Lỗi khi lưu.', 'error');
        }
      } catch (err) {
        showToast('Lỗi kết nối khi lưu: ' + err.message, 'error');
      } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu Trang Đích';
      }
    });
  }
}

/* --- Toast Helper --- */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}


/* --- Rank Tracker, Audit & Keyword Clustering UI Handlers --- */
let currentClusterPills = [];

function loadRankingsData() {
  fetch('/api/rankings')
    .then(r => r.json())
    .then(data => {
      if (data.success && data.keywords) {
        renderRankingsTable(data.keywords);
        if (data.summary) renderRankingsKPI(data.summary);
      }
    })
    .catch(console.error);
}

function renderRankingsKPI(summary) {
  const top3El = document.getElementById('kpi-top3-count');
  const top10El = document.getElementById('kpi-top10-count');
  const avgEl = document.getElementById('kpi-avg-rank');
  const totalEl = document.getElementById('kpi-total-kw');

  if (top3El) top3El.textContent = summary.top3 || 0;
  if (top10El) top10El.textContent = summary.top10 || 0;
  if (avgEl) avgEl.textContent = summary.avgRank ? `#${summary.avgRank}` : '#--';
  if (totalEl) totalEl.textContent = summary.totalKeywords || 0;
}

function renderRankingsTable(keywords) {
  const tbody = document.getElementById('rankings-table-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  keywords.forEach(kw => {
    const tr = document.createElement('tr');

    let badgeClass = 'rank-badge-page2';
    let badgeText = `Hạng #${kw.currentRank}`;
    if (kw.currentRank <= 3) {
      badgeClass = 'rank-badge-top3';
      badgeText = `🏆 TOP ${kw.currentRank} GOOGLE`;
    } else if (kw.currentRank <= 10) {
      badgeClass = 'rank-badge-top10';
      badgeText = `🟢 TOP ${kw.currentRank} (Trang 1)`;
    }

    let changeText = '— Giữ nguyên';
    let changeColor = 'var(--text-muted)';
    if (kw.change > 0) {
      changeText = `🚀 +${kw.change} nấc`;
      changeColor = '#10b981';
    } else if (kw.change < 0) {
      changeText = `🔻 ${kw.change} nấc`;
      changeColor = '#ef4444';
    }

    const shortUrl = kw.targetUrl ? kw.targetUrl.replace('https://xulynuochoasen.com', '') : '/';
    const kwEncoded = encodeURIComponent(kw.keyword);

    tr.innerHTML = `
      <td style="font-weight: 700; color: var(--text-color);">${escapeHtml(kw.keyword)}</td>
      <td><span class="rank-badge ${badgeClass}">${badgeText}</span></td>
      <td style="color: var(--text-muted); font-size: 0.88rem;">#${kw.previousRank || kw.currentRank}</td>
      <td style="color: ${changeColor}; font-weight: 600; font-size: 0.88rem;">${changeText}</td>
      <td style="color: #06b6d4; font-weight: 600; font-size: 0.88rem;">${(kw.searchVolume || 0).toLocaleString('vi-VN')} /tháng</td>
      <td><a href="${kw.targetUrl}" target="_blank" style="color: var(--accent-primary); font-size: 0.82rem; text-decoration: none;"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${escapeHtml(shortUrl)}</a></td>
      <td>
        <button onclick="showKeywordHistory('${kwEncoded}')" title="Xem lịch sử thứ hạng" style="background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.4); color: #a855f7; border-radius: 8px; padding: 4px 10px; cursor: pointer; font-size: 0.78rem; white-space:nowrap;">
          <i class="fa-solid fa-clock-rotate-left"></i> Lịch sử
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function showKeywordHistory(kwEncoded) {
  const modal = document.getElementById('ranking-history-modal');
  const loadingEl = document.getElementById('ranking-history-loading');
  const emptyEl = document.getElementById('ranking-history-empty');
  const tableEl = document.getElementById('ranking-history-table');
  const tbodyEl = document.getElementById('ranking-history-tbody');
  const titleEl = document.getElementById('ranking-history-keyword-title');

  const keyword = decodeURIComponent(kwEncoded);

  // Show modal in loading state
  modal.style.display = 'flex';
  loadingEl.style.display = 'block';
  emptyEl.style.display = 'none';
  tableEl.style.display = 'none';
  titleEl.textContent = keyword;

  try {
    const res = await fetch(`/api/rankings/history/${kwEncoded}`);
    const data = await res.json();
    loadingEl.style.display = 'none';

    if (!data.success || !data.history || data.history.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }

    titleEl.textContent = `${data.keyword} — Hiện tại: Top ${data.currentPosition || '?'}`;
    tbodyEl.innerHTML = '';

    data.history.forEach(h => {
      const isTop3 = h.position <= 3;
      const isTop10 = h.position <= 10;
      let posColor = '#ef4444'; // page 2+
      if (isTop3) posColor = '#f59e0b';
      else if (isTop10) posColor = '#10b981';

      let changeHtml = '<span style="color:var(--text-muted)">—</span>';
      if (h.change > 0) changeHtml = `<span style="color:#10b981; font-weight:700">↑ +${h.change} nấc</span>`;
      else if (h.change < 0) changeHtml = `<span style="color:#ef4444; font-weight:700">↓ ${h.change} nấc</span>`;

      // Format date to DD/MM/YYYY
      const [y, m, d] = h.date.split('-');
      const dateFormatted = `${d}/${m}/${y}`;

      const liveBadge = h.isLive
        ? '<span style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);color:#10b981;border-radius:6px;padding:2px 7px;font-size:0.72rem;">Live SERP</span>'
        : '<span style="background:rgba(100,100,120,0.2);border:1px solid rgba(100,100,120,0.3);color:#888;border-radius:6px;padding:2px 7px;font-size:0.72rem;">Demo</span>';

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-color, #2a2a4a)';
      tr.innerHTML = `
        <td style="padding:10px 8px; color:var(--text-color);">${dateFormatted}</td>
        <td style="padding:10px 8px;">
          <span style="font-weight:800; font-size:1rem; color:${posColor};">Top ${h.position}</span>
        </td>
        <td style="padding:10px 8px;">${changeHtml}</td>
        <td style="padding:10px 8px;">${liveBadge}</td>
      `;
      tbodyEl.appendChild(tr);
    });

    tableEl.style.display = 'table';
  } catch (err) {
    loadingEl.style.display = 'none';
    emptyEl.style.display = 'block';
    emptyEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation fa-2x" style="opacity:0.5;"></i><br><br>Lỗi tải dữ liệu: ${err.message}`;
  }
}


function runAuditCheck() {
  fetch('/api/audit')
    .then(r => r.json())
    .then(data => {
      if (data.success && data.data) {
        const audit = data.data;
        const scoreEl = document.getElementById('audit-health-score');
        if (scoreEl) scoreEl.textContent = `${audit.overallScore}/100`;

        const renderPass = (id, count, total) => {
          const el = document.getElementById(id);
          if (el) el.textContent = `${count}/${total} Đạt`;
        };

        renderPass('audit-pass-title', audit.passedRules.titleCount, audit.totalPosts);
        renderPass('audit-pass-meta', audit.passedRules.metaCount, audit.totalPosts);
        renderPass('audit-pass-alt', audit.passedRules.altCount, audit.totalPosts);
        renderPass('audit-pass-links', audit.passedRules.internalLinkCount, audit.totalPosts);
        renderPass('audit-pass-words', audit.passedRules.wordCountPass, audit.totalPosts);
        renderPass('audit-pass-schema', audit.passedRules.schemaPass, audit.totalPosts);
      }
    })
    .catch(console.error);
}

function initRankTrackerAndAuditUI() {
  const btnCheckRank = document.getElementById('btn-check-rankings');
  const btnRunAudit = document.getElementById('btn-run-audit');

  if (btnCheckRank) {
    btnCheckRank.addEventListener('click', async () => {
      btnCheckRank.disabled = true;
      btnCheckRank.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang Quét Live SERP...`;
      try {
        const res = await fetch('/api/rankings/check', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast('Đã quét xong vị trí thứ hạng Google mới nhất!', 'success');
          loadRankingsData();
        }
      } catch (err) {
        showToast('Lỗi khi quét vị trí thứ hạng Google', 'error');
      } finally {
        btnCheckRank.disabled = false;
        btnCheckRank.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Quét Vị Trí Google Mới Nhất`;
      }
    });
  }

  if (btnRunAudit) {
    btnRunAudit.addEventListener('click', () => {
      runAuditCheck();
      showToast('Đã quét xong Audit kỹ thuật toàn website!', 'success');
    });
  }

  const btnToggleGoogleConfig = document.getElementById('btn-toggle-google-config');
  const cardGoogleConfig = document.getElementById('card-google-config');
  const btnSaveGoogleConfig = document.getElementById('btn-save-google-config');

  if (btnToggleGoogleConfig && cardGoogleConfig) {
    btnToggleGoogleConfig.addEventListener('click', async () => {
      const isHidden = cardGoogleConfig.style.display === 'none' || !cardGoogleConfig.style.display;
      cardGoogleConfig.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        try {
          const res = await fetch('/api/google/config');
          const data = await res.json();
          if (data.success && data.data) {
            const c = data.data;
            if (document.getElementById('google-config-domain')) document.getElementById('google-config-domain').value = c.domain || 'xulynuochoasen.com';
            if (document.getElementById('google-config-serper-key')) document.getElementById('google-config-serper-key').value = c.serperApiKey || '';
            if (document.getElementById('google-config-api-key')) document.getElementById('google-config-api-key').value = c.googleApiKey || '';
            if (document.getElementById('google-config-email')) document.getElementById('google-config-email').value = c.searchConsoleEmail || '';
            if (document.getElementById('google-config-live-mode')) document.getElementById('google-config-live-mode').checked = !!c.isLiveMode;
            if (document.getElementById('google-config-auto-ping')) document.getElementById('google-config-auto-ping').checked = !!c.autoIndexPing;
          }
        } catch (e) {
          console.error(e);
        }
      }
    });
  }

  const btnBannerSetup = document.getElementById('btn-banner-setup-google');
  if (btnBannerSetup && btnToggleGoogleConfig) {
    btnBannerSetup.addEventListener('click', () => {
      if (cardGoogleConfig && (cardGoogleConfig.style.display === 'none' || !cardGoogleConfig.style.display)) {
        btnToggleGoogleConfig.click();
      }
      cardGoogleConfig?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (btnSaveGoogleConfig) {
    btnSaveGoogleConfig.addEventListener('click', async () => {
      const domain = document.getElementById('google-config-domain')?.value.trim() || 'xulynuochoasen.com';
      const serperApiKey = document.getElementById('google-config-serper-key')?.value.trim() || '';
      const googleApiKey = document.getElementById('google-config-api-key')?.value.trim() || '';
      const searchConsoleEmail = document.getElementById('google-config-email')?.value.trim() || '';
      const isLiveMode = !!document.getElementById('google-config-live-mode')?.checked;
      const autoIndexPing = !!document.getElementById('google-config-auto-ping')?.checked;

      btnSaveGoogleConfig.disabled = true;
      btnSaveGoogleConfig.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang Lưu...`;

      try {
        const res = await fetch('/api/google/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain, serperApiKey, googleApiKey, searchConsoleEmail, isLiveMode, autoIndexPing })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'Đã lưu cấu hình Google API!', 'success');
          if (cardGoogleConfig) cardGoogleConfig.style.display = 'none';
        }
      } catch (err) {
        showToast('Lỗi khi lưu cấu hình Google', 'error');
      } finally {
        btnSaveGoogleConfig.disabled = false;
        btnSaveGoogleConfig.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Lưu Cấu Hình Google API`;
      }
    });
  }

  initLiveSerpPlaygroundUI();
  loadRankingsData();
  runAuditCheck();
}

function initLiveSerpPlaygroundUI() {
  const input = document.getElementById('live-serp-query-input');
  const btnRun = document.getElementById('btn-run-live-serp');
  const resultsBox = document.getElementById('live-serp-results-container');
  const tagBtns = document.querySelectorAll('.btn-quick-serp-tag');

  // Update mode banner if live config is active
  fetch('/api/google/config')
    .then(r => r.json())
    .then(d => {
      if (d.success && d.data && d.data.serperApiKey) {
        const banner = document.getElementById('rank-tracker-mode-banner');
        if (banner) {
          banner.style.background = 'rgba(16, 185, 129, 0.12)';
          banner.style.borderColor = 'rgba(16, 185, 129, 0.35)';
          banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-circle-check" style="color: #10b981; font-size: 1.2rem;"></i>
              <span style="font-size: 0.88rem; color: #a7f3d0;">
                <strong>Chế Độ Live SERP Thật Đang Bật</strong> — Kết nối Serper API đã kích hoạt. Dữ liệu truy vấn trực tiếp từ Google SERP Việt Nam 100%.
              </span>
            </div>
            <span class="badge" style="background: rgba(16, 185, 129, 0.25); color: #34d399; font-weight: 600;">Live Google Active</span>
          `;
        }
      }
    })
    .catch(() => {});

  async function executeLiveSearch(query) {
    if (!query || !query.trim()) {
      showToast('Vui lòng nhập từ khóa để quét Google', 'warning');
      return;
    }
    const q = query.trim();
    if (input) input.value = q;

    if (!resultsBox) return;
    resultsBox.style.display = 'block';
    resultsBox.innerHTML = `
      <div style="text-align: center; padding: 25px; color: var(--text-muted);">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.8rem; color: #38bdf8; margin-bottom: 10px;"></i>
        <p style="font-size: 0.9rem;">Đang kết nối Google Việt Nam (gl: vn, hl: vi) quét 100 kết quả cho <strong>"${q}"</strong>...</p>
      </div>
    `;

    if (btnRun) {
      btnRun.disabled = true;
      btnRun.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang quét...`;
    }

    try {
      const res = await fetch('/api/serper/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, num: 100 })
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'Lỗi truy vấn Google SERP');
      }

      const foundRank = data.foundRank;
      const targetUrl = data.targetUrl;
      const organic = data.organic || [];

      let rankBadgeHtml = '';
      if (foundRank) {
        rankBadgeHtml = `
          <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%); border: 1px solid rgba(16, 185, 129, 0.45); border-radius: 8px; padding: 14px 18px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 44px; height: 44px; border-radius: 50%; background: #10b981; color: white; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 700; box-shadow: 0 0 15px rgba(16, 185, 129, 0.5);">
                #${foundRank}
              </div>
              <div>
                <div style="font-size: 1rem; font-weight: 700; color: #a7f3d0;">🎉 Website xulynuochoasen.com Đang Đứng TOP #${foundRank} Trên Google!</div>
                <div style="font-size: 0.8rem; color: #94a3b8; word-break: break-all;">
                  Link: <a href="${targetUrl}" target="_blank" style="color: #38bdf8; text-decoration: underline;">${targetUrl}</a>
                </div>
              </div>
            </div>
            <span class="badge" style="background: #10b981; color: #064e3b; font-weight: 700; padding: 6px 12px; font-size: 0.85rem;">Xác Thực Live 100%</span>
          </div>
        `;
      } else {
        rankBadgeHtml = `
          <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-circle-info" style="color: #f59e0b; font-size: 1.2rem;"></i>
            <div style="font-size: 0.85rem; color: #fde68a;">
              Website <code>xulynuochoasen.com</code> chưa lọt vào Top ${organic.length} cho từ khóa <strong>"${q}"</strong>. (Nên xuất bản thêm bài viết chuyên sâu nhắm từ khóa dài này!)
            </div>
          </div>
        `;
      }

      let organicListHtml = organic.map((item, idx) => {
        const isMySite = item.link && item.link.includes('xulynuochoasen.com');
        return `
          <div style="padding: 12px 14px; border-radius: 6px; margin-bottom: 8px; transition: all 0.2s; ${isMySite ? 'background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; box-shadow: 0 0 10px rgba(16, 185, 129, 0.2);' : 'background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);'}">
            <div style="display: flex; align-items: flex-start; gap: 10px;">
              <span style="font-size: 0.8rem; font-weight: 700; min-width: 32px; padding: 2px 6px; border-radius: 4px; text-align: center; ${isMySite ? 'background: #10b981; color: white;' : 'background: rgba(255,255,255,0.1); color: #94a3b8;'}">
                #${idx + 1}
              </span>
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 0.95rem; font-weight: 600;">
                  <a href="${item.link}" target="_blank" style="color: ${isMySite ? '#34d399' : '#38bdf8'}; text-decoration: none;">
                    ${item.title || item.link}
                  </a>
                  ${isMySite ? '<span class="badge" style="background: #10b981; color: white; margin-left: 8px; font-size: 0.7rem;">Website Của Bạn</span>' : ''}
                </div>
                <div style="font-size: 0.78rem; color: #10b981; word-break: break-all; margin-top: 2px;">
                  ${item.link}
                </div>
                <div style="font-size: 0.82rem; color: #cbd5e1; margin-top: 4px; line-height: 1.4;">
                  ${item.snippet || ''}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      resultsBox.innerHTML = `
        ${rankBadgeHtml}
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 0.85rem; color: var(--text-muted);">
            Tìm thấy <strong>${organic.length} kết quả Google Việt Nam</strong>:
          </span>
          <button class="btn btn-sm btn-outline" id="btn-close-serp-results" style="font-size: 0.75rem; padding: 2px 8px;">
            <i class="fa-solid fa-xmark"></i> Đóng Kết Quả
          </button>
        </div>
        <div style="max-height: 450px; overflow-y: auto; padding-right: 4px;">
          ${organicListHtml}
        </div>
      `;

      const btnClose = document.getElementById('btn-close-serp-results');
      if (btnClose) {
        btnClose.addEventListener('click', () => {
          resultsBox.style.display = 'none';
        });
      }
    } catch (err) {
      resultsBox.innerHTML = `
        <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 14px; color: #fca5a5;">
          <i class="fa-solid fa-triangle-exclamation"></i> Lỗi khi quét Google: ${err.message}
        </div>
      `;
    } finally {
      if (btnRun) {
        btnRun.disabled = false;
        btnRun.innerHTML = `<i class="fa-solid fa-bolt"></i> Quét Google Ngay`;
      }
    }
  }

  if (btnRun && input) {
    btnRun.addEventListener('click', () => executeLiveSearch(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeLiveSearch(input.value);
      }
    });
  }

  tagBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-q');
      if (q) executeLiveSearch(q);
    });
  });
}

function initKeywordClusteringUI() {
  const btnRunCluster = document.getElementById('btn-run-cluster');
  const seedInput = document.getElementById('seed-keyword-input');
  const resultsArea = document.getElementById('cluster-results-area');
  const pillsContainer = document.getElementById('cluster-pills-container');
  const btnAddCluster = document.getElementById('btn-add-cluster-to-queue');

  if (btnRunCluster && seedInput) {
    btnRunCluster.addEventListener('click', async () => {
      const seed = seedInput.value.trim();
      if (!seed) return showToast('Vui lòng nhập từ khóa gốc', 'error');

      btnRunCluster.disabled = true;
      btnRunCluster.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang Phân Tích...`;

      try {
        const res = await fetch('/api/keywords/cluster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seedKeyword: seed })
        });
        const data = await res.json();
        if (data.success && data.data) {
          currentClusterPills = data.data.lsiKeywords || [];
          resultsArea.style.display = 'block';
          pillsContainer.innerHTML = '';
          currentClusterPills.forEach(kw => {
            const span = document.createElement('span');
            span.style.cssText = 'background: rgba(14, 165, 233, 0.15); color: var(--accent-primary); border: 1px solid var(--accent-primary); padding: 8px 14px; border-radius: 20px; font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 8px;';
            span.innerHTML = `<i class="fa-solid fa-tag"></i> ${escapeHtml(kw)}`;
            pillsContainer.appendChild(span);
          });
          showToast(`Đã tạo xong cụm ${currentClusterPills.length} từ khóa LSI!`, 'success');
        }
      } catch (err) {
        showToast('Lỗi khi gom nhóm từ khóa', 'error');
      } finally {
        btnRunCluster.disabled = false;
        btnRunCluster.innerHTML = `<i class="fa-solid fa-network-wired"></i> Phân Tích Cụm Từ Khóa`;
      }
    });
  }

  if (btnAddCluster) {
    btnAddCluster.addEventListener('click', async () => {
      if (currentClusterPills.length === 0) return;
      try {
        const res = await fetch('/api/keywords/add-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywordsText: currentClusterPills.join('\n') })
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Đã thêm ${currentClusterPills.length} từ khóa LSI vào hàng chờ!`, 'success');
          loadKeywords();
        }
      } catch (err) {
        showToast('Lỗi khi thêm cụm từ khóa vào hàng chờ', 'error');
      }
    });
  }
}

let activeCustomMediaKho = 'kho_1';
let currentMediaItemsCache = [];
let selectedMediaIds = new Set();
let mediaPage = 1;
let mediaPageSize = 24;

let KHO_METADATA = {
  kho_1: {
    name: 'Kho 1: Lọc Nước Sinh Hoạt / Giếng Khoan / Phèn',
    shortName: 'Sinh Hoạt / Giếng / Phèn',
    badge: '📁 Đang Mở Kho 1: Sinh Hoạt & Giếng Khoan',
    badgeBg: '#0ea5e9',
    desc: 'Hình ảnh thực tế các mẫu bình lọc composite 2 hoặc 3 bình nhỏ gọn gia đình, cột lọc inox sinh hoạt trên mái nhà, bồn nước, ban công.',
    rotateBtnText: '🔄 Xoay Vòng Riêng Kho 1 Vào Bài Viết'
  },
  kho_2: {
    name: 'Kho 2: Lọc Nước Công Nghiệp',
    shortName: 'Nước Công Nghiệp',
    badge: '🏭 Đang Mở Kho 2: Nước Công Nghiệp',
    badgeBg: '#f59e0b',
    desc: 'Bình lọc to, đường kính lớn, bồn xưởng composite cỡ lớn hoặc bồn inox công nghiệp có cửa thăm manhole/mặt bích tròn, tủ điện tự động.',
    rotateBtnText: '🔄 Xoay Vòng Riêng Kho 2 Vào Bài Viết'
  },
  kho_3: {
    name: 'Kho 3: Lọc Nước Mặn & Lọc Nước Tinh Khiết RO',
    shortName: 'Mặn & Tinh Khiết RO',
    badge: '💧 Đang Mở Kho 3: Mặn & Tinh Khiết RO',
    badgeBg: '#10b981',
    desc: 'Khung máy inox, vỏ màng RO composite màu trắng và vỏ màng inox 304 sáng bóng, bơm cao áp trục đứng, đồng hồ đo áp lực, lưu lượng kế.',
    rotateBtnText: '🔄 Xoay Vòng Riêng Kho 3 Vào Bài Viết'
  },
  all: {
    name: 'Tổng Kho Tất Cả Hình Ảnh Thực Tế',
    shortName: 'Tổng Kho',
    badge: '📦 Đang Mở Tổng Kho (Tất Cả 3 Kho)',
    badgeBg: '#8b5cf6',
    desc: 'Xem toàn bộ hình ảnh thực tế từ cả 3 kho kỹ thuật đã phân loại và sẵn sàng đưa vào bài viết.',
    rotateBtnText: '🔄 Xoay Vòng Kho Này Vào Bài Viết'
  }
};

async function loadKhoConfig() {
  try {
    const res = await fetch('/api/kho/config');
    const data = await res.json();
    if (data.success && data.data) {
      Object.keys(data.data).forEach(k => {
        if (!KHO_METADATA[k]) KHO_METADATA[k] = {};
        KHO_METADATA[k].name = data.data[k].name || KHO_METADATA[k].name;
        KHO_METADATA[k].shortName = data.data[k].shortName || KHO_METADATA[k].shortName;
        KHO_METADATA[k].desc = data.data[k].desc || KHO_METADATA[k].desc;
        KHO_METADATA[k].badge = `📁 Đang Mở ${data.data[k].name || k}`;

        const domId = k.replace('_', '-');
        const titleEl = document.getElementById(`card-title-${domId}`);
        const descEl = document.getElementById(`card-desc-${domId}`);
        if (titleEl) titleEl.textContent = data.data[k].name;
        if (descEl) descEl.textContent = data.data[k].desc;
      });
    }
  } catch (e) {
    console.warn('Cannot load kho config:', e);
  }
}

function switchActiveKho(kho) {
  activeCustomMediaKho = kho;
  mediaPage = 1;
  selectedMediaIds.clear();
  updateBulkToolbarUI();

  // Highlight active Kho card
  const cards = {
    kho_1: document.getElementById('card-tab-kho-1'),
    kho_2: document.getElementById('card-tab-kho-2'),
    kho_3: document.getElementById('card-tab-kho-3')
  };

  const btnAll = document.getElementById('btn-show-all-media');

  Object.entries(cards).forEach(([k, cardEl]) => {
    if (!cardEl) return;
    if (k === kho) {
      cardEl.classList.add('active');
      if (k === 'kho_1') {
        cardEl.style.border = '2px solid #0ea5e9';
        cardEl.style.background = 'rgba(14, 165, 233, 0.12)';
        cardEl.style.boxShadow = '0 0 20px rgba(14, 165, 233, 0.25)';
      } else if (k === 'kho_2') {
        cardEl.style.border = '2px solid #f59e0b';
        cardEl.style.background = 'rgba(245, 158, 11, 0.12)';
        cardEl.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.25)';
      } else if (k === 'kho_3') {
        cardEl.style.border = '2px solid #10b981';
        cardEl.style.background = 'rgba(16, 185, 129, 0.12)';
        cardEl.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.25)';
      }
    } else {
      cardEl.classList.remove('active');
      cardEl.style.border = '1px solid var(--border-color)';
      cardEl.style.background = 'var(--card-bg)';
      cardEl.style.boxShadow = 'none';
    }
  });

  if (btnAll) {
    if (kho === 'all') {
      btnAll.classList.add('active');
      btnAll.style.background = 'rgba(139, 92, 246, 0.25)';
      btnAll.style.borderColor = '#a855f7';
      btnAll.style.color = '#c084fc';
    } else {
      btnAll.classList.remove('active');
      btnAll.style.background = 'rgba(255, 255, 255, 0.05)';
      btnAll.style.borderColor = 'var(--border-color)';
      btnAll.style.color = 'var(--text-muted)';
    }
  }

  // Update Header details
  const meta = KHO_METADATA[kho] || KHO_METADATA.all;
  const badgeEl = document.getElementById('active-kho-badge');
  const titleEl = document.getElementById('active-kho-title');
  const descEl = document.getElementById('active-kho-desc');
  const rotateBtn = document.getElementById('btn-rotate-active-kho');

  if (badgeEl) {
    badgeEl.textContent = meta.badge;
    badgeEl.style.background = meta.badgeBg;
  }
  if (titleEl) titleEl.textContent = meta.name;
  if (descEl) descEl.textContent = meta.desc;
  if (rotateBtn) rotateBtn.innerHTML = `<i class="fa-solid fa-rotate"></i> ${meta.rotateBtnText}`;

  loadCustomMediaGallery(kho);
}

async function loadCustomMediaGallery(kho = activeCustomMediaKho) {
  try {
    const res = await fetch(`/api/media?kho=${encodeURIComponent(kho)}`);
    const data = await res.json();
    if (data.success) {
      if (data.stats) {
        const setStat = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setStat('stat-kho-all', data.stats.all);
        setStat('stat-kho-1', data.stats.kho_1);
        setStat('stat-kho-2', data.stats.kho_2);
        setStat('stat-kho-3', data.stats.kho_3);
      }
      currentMediaItemsCache = data.data || [];
      renderCustomMediaGrid(currentMediaItemsCache);
    }
  } catch (err) {
    console.error('Error loading custom media:', err);
  }
}

/* ==========================================================================
   SMART MEDIA HARVESTER & STAGING INBOX CLIENT
   ========================================================================== */
async function loadStagingMedia() {
  const container = document.getElementById('staging-cards-container');
  const badge = document.getElementById('staging-pending-badge');
  if (!container) return;

  try {
    const res = await fetch('/api/media/staging');
    const data = await res.json();
    if (!data.success) return;

    const items = data.data || [];
    const pendingItems = items.filter(x => x.status === 'pending');

    if (badge) {
      badge.textContent = `${pendingItems.length} ảnh chờ duyệt`;
      badge.style.background = pendingItems.length > 0 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.2)';
      badge.style.color = pendingItems.length > 0 ? '#fbbf24' : '#34d399';
    }

    renderStagingMedia(items);
  } catch (err) {
    console.error('Lỗi tải staging media:', err);
  }
}

function renderStagingMedia(items = []) {
  const container = document.getElementById('staging-cards-container');
  if (!container) return;

  const pending = items.filter(x => x.status === 'pending');
  if (pending.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 25px; color: #64748b; font-size: 0.9rem;">
        <i class="fa-solid fa-circle-check fa-2x" style="opacity: 0.35; color: #34d399; margin-bottom: 8px; display: block;"></i>
        Hộp thư xét duyệt đang trống. Tất cả ảnh đã được duyệt an toàn vào các Kho!
      </div>
    `;
    return;
  }

  const khoColorMap = {
    kho_1: { label: 'Kho 1: Sinh Hoạt', bg: 'rgba(14, 165, 233, 0.2)', color: '#38bdf8' },
    kho_2: { label: 'Kho 2: Công Nghiệp', bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' },
    kho_3: { label: 'Kho 3: RO Tinh Khiết', bg: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }
  };

  container.innerHTML = pending.map(item => {
    const kInfo = khoColorMap[item.suggestedKho] || khoColorMap.kho_1;
    return `
      <div class="glass" style="padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); background: rgba(15, 23, 42, 0.6); display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
        <div>
          <div style="position: relative; width: 100%; height: 160px; border-radius: 8px; overflow: hidden; background: #0b1329; margin-bottom: 8px;">
            <img src="${item.url}" alt="${escapeHtml(item.alt)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.opacity=0.3;" />
            <span style="position: absolute; top: 6px; left: 6px; background: rgba(15,23,42,0.85); backdrop-filter: blur(4px); color: #38bdf8; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(56,189,248,0.3);">
              <i class="fa-solid fa-shield-halved"></i> Đã tẩy Exif & Smart Crop
            </span>
          </div>

          <div style="margin-bottom: 6px;">
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 5px;">
              <span style="background: ${kInfo.bg}; color: ${kInfo.color}; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 6px;">
                💡 Gợi ý: ${kInfo.label}
              </span>
              ${item.wasAutoCleaned ? `
                <span style="background: rgba(245, 158, 11, 0.18); color: #fbbf24; font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; border: 1px solid rgba(245, 158, 11, 0.4);">
                  <i class="fa-solid fa-wand-magic-sparkles"></i> ✨ Đã AI 3.8 Xóa Logo Đối Thủ
                </span>
              ` : `
                <span style="background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 0.72rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.3);">
                  <i class="fa-solid fa-shield-halved"></i> AI: Ảnh Gốc Sạch 100%
                </span>
              `}
              ${item.wasLogoStamped ? `
                <span style="background: linear-gradient(135deg, rgba(2,132,199,0.25), rgba(56,189,248,0.25)); color: #38bdf8; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(56,189,248,0.4); box-shadow: 0 0 8px rgba(56,189,248,0.25);">
                  <i class="fa-solid fa-stamp"></i> 💎 Đã Ghép Logo Của Anh
                </span>
              ` : ''}
            </div>
            <p style="margin: 0; font-size: 0.82rem; color: #cbd5e1; font-weight: 600; line-height: 1.35; max-height: 2.7em; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHtml(item.alt || item.pageTitle || 'Ảnh nguồn')}
            </p>
            ${item.cleanSummary ? `
              <p style="margin: 3px 0 0 0; font-size: 0.71rem; color: #38bdf8; font-weight: 600;">
                <i class="fa-solid fa-circle-check"></i> ${escapeHtml(item.cleanSummary)}
              </p>
            ` : ''}
            <p style="margin: 3px 0 0 0; font-size: 0.72rem; color: #94a3b8; font-style: italic;">
              ${escapeHtml(item.reason || '')}
            </p>
          </div>
        </div>

        <div>
          <div style="display: flex; gap: 6px; margin-bottom: 6px;">
            <button class="btn btn-sm btn-success btn-staging-approve" data-id="${item.id}" data-kho="${item.suggestedKho}" style="flex: 1; font-size: 0.78rem; padding: 6px 8px; font-weight: 700;">
              <i class="fa-solid fa-check"></i> Duyệt vào ${kInfo.label}
            </button>
            <button class="btn btn-sm btn-danger btn-staging-reject" data-id="${item.id}" style="padding: 6px 10px; font-size: 0.78rem;" title="Xóa ảnh này">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
          <div style="display: flex; gap: 4px; justify-content: flex-end;">
            <span style="font-size: 0.7rem; color: #64748b; align-self: center; margin-right: 4px;">Đổi kho:</span>
            <button class="btn btn-xs btn-outline btn-staging-move" data-id="${item.id}" data-kho="kho_1" style="font-size: 0.68rem; padding: 2px 6px;">Kho 1</button>
            <button class="btn btn-xs btn-outline btn-staging-move" data-id="${item.id}" data-kho="kho_2" style="font-size: 0.68rem; padding: 2px 6px;">Kho 2</button>
            <button class="btn btn-xs btn-outline btn-staging-move" data-id="${item.id}" data-kho="kho_3" style="font-size: 0.68rem; padding: 2px 6px;">Kho 3</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Wire buttons inside cards
  container.querySelectorAll('.btn-staging-approve').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const targetKho = btn.getAttribute('data-kho');
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
      await approveStagingImage(id, targetKho);
    });
  });

  container.querySelectorAll('.btn-staging-move').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const targetKho = btn.getAttribute('data-kho');
      btn.disabled = true;
      await approveStagingImage(id, targetKho);
    });
  });

  container.querySelectorAll('.btn-staging-reject').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      btn.disabled = true;
      await rejectStagingImage(id);
    });
  });
}

async function approveStagingImage(id, targetKho) {
  try {
    const res = await fetch('/api/media/staging/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, targetKho })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await Promise.all([loadStagingMedia(), loadCustomMediaGallery()]);
    } else {
      showToast(data.message || 'Không thể duyệt ảnh', 'error');
    }
  } catch (err) {
    showToast('Lỗi duyệt ảnh: ' + err.message, 'error');
  }
}

async function rejectStagingImage(id) {
  try {
    const res = await fetch('/api/media/staging/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Đã xóa ảnh khỏi hộp thư xét duyệt!', 'info');
      await loadStagingMedia();
    }
  } catch (err) {
    showToast('Lỗi xóa ảnh: ' + err.message, 'error');
  }
}

/* ==========================================================================
   BRAND LOGO CUSTOMIZER & AUTO-STAMPING CLIENT
   ========================================================================== */
async function loadBrandLogoConfig() {
  const badgeStatus = document.getElementById('badge-brand-logo-status');
  const previewImg = document.getElementById('img-brand-logo-preview');
  const placeholder = document.getElementById('brand-logo-placeholder');
  const btnDelete = document.getElementById('btn-delete-brand-logo');
  const chkEnabled = document.getElementById('chk-brand-logo-enabled');
  const selectPosition = document.getElementById('select-brand-logo-position');
  const rangeScale = document.getElementById('range-brand-logo-scale');
  const valScale = document.getElementById('val-brand-logo-scale');

  try {
    const res = await fetch('/api/media/brand-logo');
    const data = await res.json();
    if (!data.success) return;

    const cfg = data.config || {};

    if (chkEnabled) chkEnabled.checked = cfg.enabled !== false;
    if (selectPosition && cfg.position) selectPosition.value = cfg.position;
    if (rangeScale && cfg.scalePercent) {
      rangeScale.value = cfg.scalePercent;
      if (valScale) valScale.textContent = `${cfg.scalePercent}%`;
    }

    if (cfg.hasCustomLogo && cfg.logoUrl) {
      if (previewImg) {
        previewImg.src = cfg.logoUrl;
        previewImg.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
      if (btnDelete) btnDelete.style.display = 'inline-block';
      if (badgeStatus) {
        badgeStatus.textContent = '✅ Đang Áp Dụng Logo Của Anh';
        badgeStatus.style.background = 'rgba(16, 185, 129, 0.2)';
        badgeStatus.style.color = '#34d399';
        badgeStatus.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      }
    } else {
      if (previewImg) {
        previewImg.src = '';
        previewImg.style.display = 'none';
      }
      if (placeholder) placeholder.style.display = 'block';
      if (btnDelete) btnDelete.style.display = 'none';
      if (badgeStatus) {
        badgeStatus.textContent = 'Chưa tải logo';
        badgeStatus.style.background = 'rgba(56, 189, 248, 0.15)';
        badgeStatus.style.color = '#38bdf8';
        badgeStatus.style.borderColor = 'rgba(56, 189, 248, 0.35)';
      }
    }
  } catch (err) {
    console.warn('[BrandLogo Client] Lỗi khi tải config logo:', err);
  }
}

function initBrandLogoCustomizer() {
  const btnUpload = document.getElementById('btn-upload-brand-logo');
  const fileInput = document.getElementById('input-brand-logo-file');
  const btnDelete = document.getElementById('btn-delete-brand-logo');
  const btnSave = document.getElementById('btn-save-brand-logo-settings');
  const chkEnabled = document.getElementById('chk-brand-logo-enabled');
  const selectPosition = document.getElementById('select-brand-logo-position');
  const rangeScale = document.getElementById('range-brand-logo-scale');
  const valScale = document.getElementById('val-brand-logo-scale');

  if (rangeScale && valScale) {
    rangeScale.addEventListener('input', () => {
      valScale.textContent = `${rangeScale.value}%`;
    });
  }

  if (btnUpload && fileInput) {
    btnUpload.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showToast('Vui lòng chọn file hình ảnh (PNG, JPG, WebP)!', 'warning');
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result;
        btnUpload.disabled = true;
        btnUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải lên...';

        try {
          const res = await fetch('/api/media/brand-logo/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64Data })
          });
          const data = await res.json();
          if (data.success) {
            showToast('💎 Đã tải lên và kích hoạt Logo Thương Hiệu thành công!', 'success');
            await loadBrandLogoConfig();
          } else {
            showToast('Lỗi tải logo: ' + data.message, 'error');
          }
        } catch (err) {
          showToast('Lỗi khi tải logo lên: ' + err.message, 'error');
        } finally {
          btnUpload.disabled = false;
          btnUpload.innerHTML = '<i class="fa-solid fa-upload"></i> Chọn Logo Từ Máy (.PNG/.JPG)';
          fileInput.value = '';
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      if (!confirm('Anh có chắc muốn xóa file logo thương hiệu này không?')) return;
      try {
        const res = await fetch('/api/media/brand-logo', { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          showToast('Đã xóa logo thương hiệu!', 'info');
          await loadBrandLogoConfig();
        }
      } catch (err) {
        showToast('Lỗi xóa logo: ' + err.message, 'error');
      }
    });
  }

  const saveSettings = async () => {
    try {
      const enabled = chkEnabled ? chkEnabled.checked : true;
      const position = selectPosition ? selectPosition.value : 'replace-competitor';
      const scalePercent = rangeScale ? Number(rangeScale.value) : 18;

      const res = await fetch('/api/media/brand-logo/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, position, scalePercent })
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Đã lưu cài đặt tự động ghép logo thương hiệu!', 'success');
        await loadBrandLogoConfig();
      }
    } catch (err) {
      showToast('Lỗi lưu cài đặt logo: ' + err.message, 'error');
    }
  };

  if (btnSave) btnSave.addEventListener('click', saveSettings);
  if (chkEnabled) chkEnabled.addEventListener('change', saveSettings);
}

function rotateImageClient(imgUrl, degrees = 90) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (degrees === 90 || degrees === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const base64 = canvas.toDataURL('image/jpeg', 0.92);
      resolve(base64);
    };
    img.onerror = (err) => reject(err);
    img.src = imgUrl;
  });
}

function updateBulkToolbarUI() {
  const countEl = document.getElementById('selected-media-count');
  const btnGroup = document.getElementById('bulk-action-buttons');
  const checkAll = document.getElementById('check-select-all');

  const count = selectedMediaIds.size;
  if (countEl) countEl.textContent = count;

  if (btnGroup) {
    if (count > 0) {
      btnGroup.style.opacity = '1';
      btnGroup.style.pointerEvents = 'auto';
    } else {
      btnGroup.style.opacity = '0.4';
      btnGroup.style.pointerEvents = 'none';
    }
  }

  if (checkAll && currentMediaItemsCache.length > 0) {
    checkAll.checked = count === currentMediaItemsCache.length;
    checkAll.indeterminate = count > 0 && count < currentMediaItemsCache.length;
  }
}

function renderCustomMediaGrid(mediaList) {
  const grid = document.getElementById('custom-media-gallery-grid');
  const paginContainer = document.getElementById('custom-media-pagination-container');
  if (!grid) return;

  grid.innerHTML = '';
  if (paginContainer) paginContainer.innerHTML = '';
  selectedMediaIds.clear();
  updateBulkToolbarUI();

  if (!mediaList || mediaList.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 50px 20px; background: rgba(15, 23, 42, 0.4); border-radius: 12px; border: 1px dashed var(--border-color);">
      <i class="fa-solid fa-folder-open" style="font-size: 2.8rem; color: #64748b; margin-bottom: 12px; display: block;"></i>
      <div style="font-weight: 600; font-size: 1rem; color: #fff; margin-bottom: 6px;">Kho này hiện chưa có ảnh nào</div>
      <div style="font-size: 0.85rem; color: var(--text-muted); max-width: 480px; margin: 0 auto;">
        Anh có thể bấm nút "Tải Thêm Ảnh Vào Kho Này" ở trên để tải ảnh từ máy tính hoặc dán link Google Drive nhé!
      </div>
    </div>`;
    return;
  }

  // 1. Phân trang mượt mà (Chống lag tuyệt đối khi kho có hàng trăm ảnh)
  const total = mediaList.length;
  const totalPages = Math.ceil(total / mediaPageSize);
  if (mediaPage > totalPages) mediaPage = totalPages;
  if (mediaPage < 1) mediaPage = 1;

  const startIndex = (mediaPage - 1) * mediaPageSize;
  const endIndex = Math.min(startIndex + mediaPageSize, total);
  const pagedItems = mediaList.slice(startIndex, endIndex);

  pagedItems.forEach(m => {
    const card = document.createElement('div');
    card.className = 'custom-media-card';
    card.style.cssText = 'background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; position: relative; transition: all 0.2s ease; box-shadow: 0 4px 10px rgba(0,0,0,0.2);';

    const mKho = m.kho || (
      (m.tagKeyword || '').toLowerCase().includes('công nghiệp') ? 'kho_2' :
      ((m.tagKeyword || '').toLowerCase().includes('mặn') || (m.tagKeyword || '').toLowerCase().includes('tinh khiết')) ? 'kho_3' : 'kho_1'
    );

    let badgeHtml = '';
    const shortLabel = KHO_METADATA[mKho]?.shortName || mKho;
    if (mKho === 'kho_1') {
      badgeHtml = `<span style="position: absolute; top: 8px; left: 32px; background: rgba(14, 165, 233, 0.95); color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 700; z-index: 2;"><i class="fa-solid fa-house-chimney"></i> ${escapeHtml(shortLabel)}</span>`;
    } else if (mKho === 'kho_2') {
      badgeHtml = `<span style="position: absolute; top: 8px; left: 32px; background: rgba(245, 158, 11, 0.95); color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 700; z-index: 2;"><i class="fa-solid fa-industry"></i> ${escapeHtml(shortLabel)}</span>`;
    } else if (mKho === 'kho_3') {
      badgeHtml = `<span style="position: absolute; top: 8px; left: 32px; background: rgba(16, 185, 129, 0.95); color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 700; z-index: 2;"><i class="fa-solid fa-water"></i> ${escapeHtml(shortLabel)}</span>`;
    }

    const driveIcon = m.isDrive ? '<i class="fa-brands fa-google-drive" style="color: #4285f4; margin-right: 4px;"></i>' : '<i class="fa-solid fa-image" style="color: #10b981; margin-right: 4px;"></i>';

    card.innerHTML = `
      <!-- Checkbox Select -->
      <label style="position: absolute; top: 8px; left: 8px; z-index: 3; margin: 0; cursor: pointer;">
        <input type="checkbox" class="check-media-item" data-id="${m.id}" style="width: 17px; height: 17px; cursor: pointer; accent-color: var(--accent-primary);">
      </label>
      ${badgeHtml}

      <!-- Image Box -->
      <div style="width: 100%; height: 140px; background: #0b0f19; overflow: hidden; position: relative;">
        <img src="${m.url}" alt="${escapeHtml(m.alt || m.tagKeyword || 'Ảnh công trình Hoa Sen')}" loading="lazy" decoding="async" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;">
        <button class="btn-rotate-media" data-id="${m.id}" title="Xoay 90° sang phải" style="position: absolute; bottom: 6px; right: 6px; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); color: #38bdf8; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 4px; z-index: 2;">
          <i class="fa-solid fa-rotate-right"></i>
        </button>
      </div>

      <!-- Card Details & Actions -->
      <div style="padding: 10px; background: rgba(15, 23, 42, 0.7); display: flex; flex-direction: column; gap: 8px; flex: 1; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; color: #fff; font-weight: 600; font-size: 0.82rem;" title="${escapeHtml(m.title || m.filename || 'Ảnh')}">
              ${driveIcon}${escapeHtml(m.title || m.filename || 'Ảnh')}
            </span>
            <div style="display: flex; gap: 2px;">
              <button class="btn-edit-media" data-id="${m.id}" title="Chỉnh sửa chi tiết" style="background: none; border: none; color: #38bdf8; cursor: pointer; padding: 3px 5px; font-size: 0.82rem;">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn-delete-media" data-id="${m.id}" title="Xóa ảnh" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 3px 5px; font-size: 0.82rem;">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
          ${m.features ? `<div style="font-size: 0.72rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(m.features)}">${escapeHtml(m.features)}</div>` : ''}
        </div>

        <!-- Quick Kho Selector -->
        <div style="display: flex; align-items: center; gap: 4px;">
          <select class="select-change-kho" data-id="${m.id}" style="width: 100%; background: rgba(30, 41, 59, 0.95); border: 1px solid var(--border-color); color: #e2e8f0; font-size: 0.75rem; border-radius: 4px; padding: 3px 6px; cursor: pointer;">
            <option value="kho_1" ${mKho === 'kho_1' ? 'selected' : ''}>📁 ${escapeHtml(KHO_METADATA.kho_1?.name || 'Kho 1')}</option>
            <option value="kho_2" ${mKho === 'kho_2' ? 'selected' : ''}>🏭 ${escapeHtml(KHO_METADATA.kho_2?.name || 'Kho 2')}</option>
            <option value="kho_3" ${mKho === 'kho_3' ? 'selected' : ''}>💧 ${escapeHtml(KHO_METADATA.kho_3?.name || 'Kho 3')}</option>
          </select>
        </div>
      </div>
    `;

    // Bấm vào bất kỳ đâu trên card (ngoại trừ nút/menu) để chọn ảnh ngay
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) {
        return;
      }
      const chk = card.querySelector('.check-media-item');
      if (chk) {
        chk.checked = !chk.checked;
        const id = chk.getAttribute('data-id');
        if (chk.checked) {
          selectedMediaIds.add(id);
          card.style.borderColor = '#0ea5e9';
          card.style.boxShadow = '0 0 14px rgba(14, 165, 233, 0.45)';
        } else {
          selectedMediaIds.delete(id);
          card.style.borderColor = 'var(--border-color)';
          card.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
        }
        updateBulkToolbarUI();
      }
    });

    grid.appendChild(card);
  });

  // 2. Render Thanh Phân Trang Siêu Mượt
  if (paginContainer && totalPages > 1) {
    paginContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding: 12px 18px; background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-color); border-radius: 10px;">
        <div style="font-size: 0.85rem; color: var(--text-muted);">
          Đang hiển thị <strong style="color: #fff;">${startIndex + 1} - ${endIndex}</strong> trên tổng số <strong style="color: var(--accent-primary);">${total}</strong> ảnh
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <button class="btn btn-sm btn-secondary btn-pagin-nav" data-page="1" ${mediaPage === 1 ? 'disabled' : ''} title="Trang đầu">&laquo;&laquo;</button>
          <button class="btn btn-sm btn-secondary btn-pagin-nav" data-page="${mediaPage - 1}" ${mediaPage <= 1 ? 'disabled' : ''}>&laquo; Trước</button>
          <span style="font-size: 0.85rem; font-weight: 700; color: #fff; padding: 4px 12px; background: rgba(255,255,255,0.08); border-radius: 6px;">Trang ${mediaPage} / ${totalPages}</span>
          <button class="btn btn-sm btn-secondary btn-pagin-nav" data-page="${mediaPage + 1}" ${mediaPage >= totalPages ? 'disabled' : ''}>Sau &raquo;</button>
          <button class="btn btn-sm btn-secondary btn-pagin-nav" data-page="${totalPages}" ${mediaPage === totalPages ? 'disabled' : ''} title="Trang cuối">&raquo;&raquo;</button>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 0.8rem; color: var(--text-muted);">Mỗi trang:</span>
          <select id="select-media-page-size" style="background: rgba(30, 41, 59, 0.9); border: 1px solid var(--border-color); color: #fff; font-size: 0.8rem; border-radius: 6px; padding: 4px 8px; cursor: pointer;">
            <option value="24" ${mediaPageSize === 24 ? 'selected' : ''}>24 ảnh</option>
            <option value="48" ${mediaPageSize === 48 ? 'selected' : ''}>48 ảnh</option>
            <option value="96" ${mediaPageSize === 96 ? 'selected' : ''}>96 ảnh</option>
          </select>
        </div>
      </div>
    `;

    paginContainer.querySelectorAll('.btn-pagin-nav').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetPage = parseInt(e.currentTarget.getAttribute('data-page'));
        if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
          mediaPage = targetPage;
          renderCustomMediaGrid(mediaList);
          document.getElementById('active-kho-workspace')?.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    const pageSizeSelect = document.getElementById('select-media-page-size');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        mediaPageSize = parseInt(e.currentTarget.value) || 24;
        mediaPage = 1;
        renderCustomMediaGrid(mediaList);
      });
    }
  }

  // Checkbox item change
  grid.querySelectorAll('.check-media-item').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const card = chk.closest('.custom-media-card');
      if (e.currentTarget.checked) {
        selectedMediaIds.add(id);
        if (card) {
          card.style.borderColor = '#0ea5e9';
          card.style.boxShadow = '0 0 14px rgba(14, 165, 233, 0.45)';
        }
      } else {
        selectedMediaIds.delete(id);
        if (card) {
          card.style.borderColor = 'var(--border-color)';
          card.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
        }
      }
      updateBulkToolbarUI();
    });
  });

  // Quick Kho Changer
  grid.querySelectorAll('.select-change-kho').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const newKho = e.currentTarget.value;
      try {
        const res = await fetch('/api/media/update-kho', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, kho: newKho })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'Đã chuyển kho ảnh thành công!', 'success');
          loadCustomMediaGallery(activeCustomMediaKho);
        } else {
          showToast(data.message || 'Lỗi khi chuyển kho', 'error');
        }
      } catch (err) {
        showToast('Lỗi kết nối khi đổi kho ảnh', 'error');
      }
    });
  });

  // Edit Image Modal Trigger
  grid.querySelectorAll('.btn-edit-media').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const item = currentMediaItemsCache.find(m => m.id === id);
      if (!item) return;

      const modal = document.getElementById('edit-media-modal');
      const idInput = document.getElementById('edit-media-id');
      const previewImg = document.getElementById('edit-media-preview-img');
      const filenameSub = document.getElementById('edit-media-filename-sub');
      const khoSelect = document.getElementById('edit-media-kho-select');
      const titleInput = document.getElementById('edit-media-title-input');
      const altInput = document.getElementById('edit-media-alt-input');
      const featuresInput = document.getElementById('edit-media-features-input');

      if (idInput) idInput.value = item.id;
      if (previewImg) previewImg.src = item.url;
      if (filenameSub) filenameSub.textContent = item.filename || item.id;
      if (khoSelect) khoSelect.value = item.kho || 'kho_1';
      if (titleInput) titleInput.value = item.title || item.filename || '';
      if (altInput) altInput.value = item.alt || item.tagKeyword || '';
      if (featuresInput) featuresInput.value = item.features || '';

      if (modal) modal.style.display = 'flex';
    });
  });

  // Delete listeners
  grid.querySelectorAll('.btn-delete-media').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (!confirm('Anh có chắc muốn xóa hình ảnh này khỏi kho không?')) return;
      try {
        const res = await fetch('/api/media/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Đã xóa ảnh khỏi kho thành công!', 'success');
          loadCustomMediaGallery(activeCustomMediaKho);
        }
      } catch (err) {
        showToast('Lỗi khi xóa ảnh', 'error');
      }
    });
  });

  // Rotate listeners
  grid.querySelectorAll('.btn-rotate-media').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const cardImg = e.currentTarget.parentElement.querySelector('img');
      if (!cardImg) return;

      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;

      try {
        const rotatedBase64 = await rotateImageClient(cardImg.src, 90);
        const res = await fetch('/api/media/update-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, base64: rotatedBase64 })
        });
        const data = await res.json();
        if (data.success && data.data) {
          cardImg.src = data.data.url + '?t=' + Date.now();
          showToast('Đã xoay ảnh 90° thành công!', 'success');
        }
      } catch (err) {
        showToast('Lỗi khi xoay ảnh', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-rotate-right"></i>`;
      }
    });
  });
}

function initCustomMediaUI() {
  // 1. Bind the 3 Big Kho Cards & All Media Button
  const cardKho1 = document.getElementById('card-tab-kho-1');
  const cardKho2 = document.getElementById('card-tab-kho-2');
  const cardKho3 = document.getElementById('card-tab-kho-3');
  const btnShowAll = document.getElementById('btn-show-all-media');

  if (cardKho1) cardKho1.addEventListener('click', () => switchActiveKho('kho_1'));
  if (cardKho2) cardKho2.addEventListener('click', () => switchActiveKho('kho_2'));
  if (cardKho3) cardKho3.addEventListener('click', () => switchActiveKho('kho_3'));
  if (btnShowAll) btnShowAll.addEventListener('click', () => switchActiveKho('all'));

  // 2. Toggle Upload Box
  const btnToggleUpload = document.getElementById('btn-toggle-upload-box');
  const uploadPanel = document.getElementById('kho-upload-panel');
  if (btnToggleUpload && uploadPanel) {
    btnToggleUpload.addEventListener('click', () => {
      const isHidden = uploadPanel.style.display === 'none' || !uploadPanel.style.display;
      uploadPanel.style.display = isHidden ? 'block' : 'none';
      btnToggleUpload.innerHTML = isHidden
        ? `<i class="fa-solid fa-chevron-up"></i> Đóng Khung Tải Ảnh`
        : `<i class="fa-solid fa-cloud-arrow-up"></i> Tải Thêm Ảnh Vào Kho Này`;
    });
  }

  // 3. Rotate Active Kho into Posts
  const btnRotateActiveKho = document.getElementById('btn-rotate-active-kho');
  if (btnRotateActiveKho) {
    btnRotateActiveKho.addEventListener('click', async () => {
      const targetKho = (activeCustomMediaKho === 'all') ? 'kho_1' : activeCustomMediaKho;
      btnRotateActiveKho.disabled = true;
      btnRotateActiveKho.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang Xoay Vòng...`;

      try {
        const res = await fetch('/api/media/rotate-kho', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ khoId: targetKho })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'Đã xoay vòng ảnh thành công!', 'success');
          loadPostsList();
        } else {
          showToast(data.message || 'Không thể xoay vòng kho này', 'error');
        }
      } catch (err) {
        showToast('Lỗi kết nối khi xoay vòng kho', 'error');
      } finally {
        btnRotateActiveKho.disabled = false;
        const meta = KHO_METADATA[activeCustomMediaKho] || KHO_METADATA.all;
        btnRotateActiveKho.innerHTML = `<i class="fa-solid fa-rotate"></i> ${meta.rotateBtnText}`;
      }
    });
  }

  // 4. Select All Checkbox
  const checkSelectAll = document.getElementById('check-select-all');
  if (checkSelectAll) {
    checkSelectAll.addEventListener('change', (e) => {
      const isChecked = e.currentTarget.checked;
      const allCheckboxes = document.querySelectorAll('.check-media-item');
      selectedMediaIds.clear();
      allCheckboxes.forEach(chk => {
        chk.checked = isChecked;
        const card = chk.closest('.custom-media-card');
        if (isChecked) {
          selectedMediaIds.add(chk.getAttribute('data-id'));
          if (card) {
            card.style.borderColor = '#0ea5e9';
            card.style.boxShadow = '0 0 14px rgba(14, 165, 233, 0.45)';
          }
        } else {
          if (card) {
            card.style.borderColor = 'var(--border-color)';
            card.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
          }
        }
      });
      updateBulkToolbarUI();
    });
  }

  // 5. Bulk Move
  document.querySelectorAll('.btn-bulk-move').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const targetKho = e.currentTarget.getAttribute('data-target');
      const ids = Array.from(selectedMediaIds);
      if (ids.length === 0) return showToast('Vui lòng chọn ít nhất 1 ảnh để chuyển kho.', 'error');

      const KHO_NAMES = { kho_1: 'Kho 1', kho_2: 'Kho 2', kho_3: 'Kho 3' };
      btn.disabled = true;
      try {
        const res = await fetch('/api/media/bulk-update-kho', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, kho: targetKho })
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Đã chuyển thành công ${data.updatedCount} ảnh sang ${KHO_NAMES[targetKho]}!`, 'success');
          loadCustomMediaGallery(activeCustomMediaKho);
        } else {
          showToast(data.message || 'Lỗi khi chuyển kho hàng loạt', 'error');
        }
      } catch (err) {
        showToast('Lỗi kết nối khi chuyển kho hàng loạt', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // 6. Bulk Delete
  const btnBulkDelete = document.getElementById('btn-bulk-delete');
  if (btnBulkDelete) {
    btnBulkDelete.addEventListener('click', async () => {
      const ids = Array.from(selectedMediaIds);
      if (ids.length === 0) return showToast('Vui lòng chọn ít nhất 1 ảnh để xóa.', 'error');
      if (!confirm(`Anh có chắc chắn muốn xóa ${ids.length} ảnh đã chọn khỏi kho không?`)) return;

      btnBulkDelete.disabled = true;
      try {
        const res = await fetch('/api/media/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids })
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Đã xóa thành công ${data.deletedCount} ảnh!`, 'success');
          loadCustomMediaGallery(activeCustomMediaKho);
        } else {
          showToast(data.message || 'Lỗi khi xóa hàng loạt', 'error');
        }
      } catch (err) {
        showToast('Lỗi kết nối khi xóa hàng loạt', 'error');
      } finally {
        btnBulkDelete.disabled = false;
      }
    });
  }

  // 7. Edit Image Modal Save & Close
  const modalEdit = document.getElementById('edit-media-modal');
  const btnCloseModal = document.getElementById('btn-close-edit-media-modal');
  const btnCancelModal = document.getElementById('btn-cancel-edit-media');
  const btnSaveModal = document.getElementById('btn-save-edit-media');

  const closeEditModal = () => { if (modalEdit) modalEdit.style.display = 'none'; };
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeEditModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeEditModal);

  if (btnSaveModal) {
    btnSaveModal.addEventListener('click', async () => {
      const id = document.getElementById('edit-media-id')?.value;
      const kho = document.getElementById('edit-media-kho-select')?.value;
      const title = document.getElementById('edit-media-title-input')?.value;
      const alt = document.getElementById('edit-media-alt-input')?.value;
      const features = document.getElementById('edit-media-features-input')?.value;

      if (!id) return;

      btnSaveModal.disabled = true;
      btnSaveModal.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang Lưu...`;

      try {
        const res = await fetch('/api/media/edit-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, kho, title, alt, features })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Đã lưu thông tin ảnh thành công!', 'success');
          closeEditModal();
          loadCustomMediaGallery(activeCustomMediaKho);
        } else {
          showToast(data.message || 'Lỗi khi lưu ảnh', 'error');
        }
      } catch (err) {
        showToast('Lỗi kết nối khi lưu thông tin ảnh', 'error');
      } finally {
        btnSaveModal.disabled = false;
        btnSaveModal.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Lưu Thay Đổi`;
      }
    });
  }

  // 8. Upload files directly into the active Kho
  const btnUpload = document.getElementById('btn-upload-custom-media');
  const fileInput = document.getElementById('custom-media-file-input');
  const dragZone = document.getElementById('media-drag-drop-zone');

  const processSelectedFiles = async (filesList) => {
    const targetKho = (activeCustomMediaKho === 'all') ? 'kho_1' : activeCustomMediaKho;
    if (!filesList || filesList.length === 0) return showToast('Vui lòng chọn ít nhất 1 hình ảnh từ máy tính.', 'error');

    btnUpload.disabled = true;
    btnUpload.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang Tải Lên (${filesList.length} ảnh)...`;

    const filePromises = Array.from(filesList).map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ base64: e.target.result, filename: file.name });
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    });

    const parsedFiles = (await Promise.all(filePromises)).filter(Boolean);

    try {
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: parsedFiles, kho: targetKho })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Tải ảnh lên thành công!', 'success');
        if (fileInput) fileInput.value = '';
        loadCustomMediaGallery(activeCustomMediaKho);
      } else {
        showToast(data.message || 'Lỗi khi tải ảnh lên', 'error');
      }
    } catch (err) {
      showToast('Lỗi kết nối khi tải ảnh lên', 'error');
    } finally {
      btnUpload.disabled = false;
      btnUpload.innerHTML = `<i class="fa-solid fa-upload"></i> Tải Lên Kho Này`;
    }
  };

  if (btnUpload && fileInput) {
    btnUpload.addEventListener('click', () => processSelectedFiles(fileInput.files));
  }

  if (dragZone && fileInput) {
    dragZone.addEventListener('click', () => fileInput.click());
    dragZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dragZone.style.background = 'rgba(14, 165, 233, 0.15)';
    });
    dragZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragZone.style.background = 'rgba(14, 165, 233, 0.05)';
    });
    dragZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dragZone.style.background = 'rgba(14, 165, 233, 0.05)';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processSelectedFiles(e.dataTransfer.files);
      }
    });
  }

  // 9. Drive Link
  const btnDrive = document.getElementById('btn-add-drive-media');
  const driveUrlInput = document.getElementById('drive-media-url-input');
  const driveTagInput = document.getElementById('drive-media-tag-input');

  if (btnDrive && driveUrlInput) {
    btnDrive.addEventListener('click', async () => {
      const url = driveUrlInput.value.trim();
      const tag = driveTagInput ? driveTagInput.value.trim() : '';
      const targetKho = (activeCustomMediaKho === 'all') ? 'kho_1' : activeCustomMediaKho;
      if (!url) return showToast('Vui lòng dán đường dẫn Google Drive', 'error');

      btnDrive.disabled = true;
      btnDrive.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang Lưu Link Drive...`;

      try {
        const res = await fetch('/api/media/drive-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driveUrl: url, tagKeyword: tag, kho: targetKho })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Đã lưu link ảnh Google Drive thành công!', 'success');
          driveUrlInput.value = '';
          if (driveTagInput) driveTagInput.value = '';
          loadCustomMediaGallery(activeCustomMediaKho);
        } else {
          showToast(data.message || 'Lỗi khi lưu link Drive', 'error');
        }
      } catch (err) {
        showToast('Lỗi kết nối Google Drive', 'error');
      } finally {
        btnDrive.disabled = false;
        btnDrive.innerHTML = `<i class="fa-solid fa-link"></i> Thêm Link Drive Vào Kho Này`;
      }
    });
  }

  // 10. Rotate All Media
  const btnRotateAll = document.getElementById('btn-rotate-media-all');
  if (btnRotateAll) {
    btnRotateAll.addEventListener('click', async () => {
      btnRotateAll.disabled = true;
      btnRotateAll.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang Xoay Vòng...`;
      try {
        const res = await fetch('/api/media/rotate-all', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'Đã xoay vòng toàn bộ kho ảnh vào bài viết!', 'success');
          loadPostsList();
        } else {
          showToast(data.message || 'Không thể xoay vòng', 'error');
        }
      } catch (err) {
        showToast('Lỗi khi xoay vòng ảnh', 'error');
      } finally {
        btnRotateAll.disabled = false;
        btnRotateAll.innerHTML = `<i class="fa-solid fa-sync"></i> Xoay Vòng Toàn Bộ 3 Kho`;
      }
    });
  }

  // 10b. Staging Inbox & Media Harvester Controls
  const btnHarvestCrawl = document.getElementById('btn-harvest-crawl-now');
  const inputHarvestUrl = document.getElementById('input-harvest-url');
  const btnStagingApproveAll = document.getElementById('btn-staging-approve-all');
  const btnStagingRefresh = document.getElementById('btn-staging-refresh');
  const btnStagingClearAll = document.getElementById('btn-staging-clear-all');

  if (btnStagingClearAll) {
    btnStagingClearAll.addEventListener('click', async () => {
      if (!confirm('Anh có chắc muốn dọn sạch toàn bộ ảnh trong Hộp Thư Xét Duyệt không?')) return;
      try {
        const res = await fetch('/api/media/staging/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'all' })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'Đã dọn sạch Hộp Thư Xét Duyệt!', 'success');
          await loadStagingMedia();
        }
      } catch (err) {
        showToast('Lỗi khi dọn hộp thư: ' + err.message, 'error');
      }
    });
  }

  if (btnHarvestCrawl && inputHarvestUrl) {
    btnHarvestCrawl.addEventListener('click', async () => {
      const url = (inputHarvestUrl.value || '').trim();
      if (!url) {
        showToast('Vui lòng dán link URL cần cào ảnh!', 'warning');
        inputHarvestUrl.focus();
        return;
      }
      const chkStrict = document.getElementById('chk-strict-brand-shield');
      const strictBrandShield = chkStrict ? chkStrict.checked : true;
      const chkDeep = document.getElementById('chk-deep-media-crawl');
      const deepCrawl = chkDeep ? chkDeep.checked : true;
      const selectDepth = document.getElementById('select-media-crawl-depth');
      const depthVal = selectDepth ? selectDepth.value : 'deep';
      let maxSubPages = 15;
      let maxPaginationPages = 5;
      if (depthVal === 'ultra') {
        maxSubPages = 35;
        maxPaginationPages = 12;
      } else if (depthVal === 'fast') {
        maxSubPages = 5;
        maxPaginationPages = 2;
      }

      const selectLimit = document.getElementById('select-media-harvest-limit');
      const maxImages = selectLimit ? parseInt(selectLimit.value, 10) : 40;

      btnHarvestCrawl.disabled = true;
      btnHarvestCrawl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang quét sâu bài viết & cào ảnh...';
      try {
        const res = await fetch('/api/media/harvest-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, strictBrandShield, deepCrawl, maxImages, maxSubPages, maxPaginationPages })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'Cào ảnh thành công!', 'success');
          inputHarvestUrl.value = '';
          await loadStagingMedia();
        } else {
          showToast(data.message || 'Lỗi khi cào ảnh từ URL', 'error');
        }
      } catch (err) {
        showToast('Lỗi kết nối khi cào ảnh: ' + err.message, 'error');
      } finally {
        btnHarvestCrawl.disabled = false;
        btnHarvestCrawl.innerHTML = '<i class="fa-solid fa-spider"></i> Cào Ảnh Nguồn';
      }
    });
  }

  // 10b-1. AUTONOMOUS MULTI-SOURCE HARVESTER (Quét tất cả nguồn đối thủ)
  const btnHarvestAllSources = document.getElementById('btn-harvest-all-sources');
  if (btnHarvestAllSources) {
    btnHarvestAllSources.addEventListener('click', async () => {
      const chkStrict = document.getElementById('chk-strict-brand-shield');
      const strictBrandShield = chkStrict ? chkStrict.checked : true;

      btnHarvestAllSources.disabled = true;
      btnHarvestAllSources.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tự động rà soát 6+ nguồn đối thủ...';
      try {
        const res = await fetch('/api/media/harvester/auto-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxPerSource: 3, strictBrandShield })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          await loadStagingMedia();
          loadHarvesterSources();
        } else {
          showToast(data.message || 'Lỗi khi quét tự động', 'error');
        }
      } catch (err) {
        showToast('Lỗi kết nối khi quét tự động: ' + err.message, 'error');
      } finally {
        btnHarvestAllSources.disabled = false;
        btnHarvestAllSources.innerHTML = '<i class="fa-solid fa-bolt-lightning"></i> 🚀 Tự Động Quét Tất Cả Nguồn Ngành';
      }
    });
  }

  // 10b-2. Cào nhanh từng đơn vị đối thủ cụ thể
  document.querySelectorAll('.btn-quick-harvest-src').forEach(btn => {
    btn.addEventListener('click', async () => {
      const srcId = btn.getAttribute('data-id');
      const chkStrict = document.getElementById('chk-strict-brand-shield');
      const strictBrandShield = chkStrict ? chkStrict.checked : true;

      const oldText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang cào...';

      try {
        const res = await fetch('/api/media/harvester/auto-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceId: srcId, maxPerSource: 4, strictBrandShield })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          await loadStagingMedia();
          loadHarvesterSources();
        } else {
          showToast(data.message || 'Lỗi khi cào nguồn', 'error');
        }
      } catch (err) {
        showToast('Lỗi cào nguồn: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = oldText;
      }
    });
  });

  // 10b-3. TÌM KIẾM & CÀO ẢNH THEO TỪ KHÓA KỸ THUẬT
  const btnHarvestSearchKeywords = document.getElementById('btn-harvest-search-keywords');
  const inputHarvestKeywords = document.getElementById('input-harvest-keywords');

  async function executeKeywordHarvest(kw) {
    if (!kw) return showToast('Vui lòng nhập từ khóa tìm ảnh!', 'warning');
    const chkStrict = document.getElementById('chk-strict-brand-shield');
    const strictBrandShield = chkStrict ? chkStrict.checked : true;

    if (btnHarvestSearchKeywords) {
      btnHarvestSearchKeywords.disabled = true;
      btnHarvestSearchKeywords.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tìm ảnh Google & lọc AI...';
    }

    try {
      const res = await fetch('/api/media/harvester/search-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: kw, maxImages: 6, strictBrandShield })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        if (inputHarvestKeywords) inputHarvestKeywords.value = '';
        await loadStagingMedia();
      } else {
        showToast(data.message || 'Lỗi tìm kiếm ảnh', 'error');
      }
    } catch (err) {
      showToast('Lỗi khi tìm ảnh: ' + err.message, 'error');
    } finally {
      if (btnHarvestSearchKeywords) {
        btnHarvestSearchKeywords.disabled = false;
        btnHarvestSearchKeywords.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Tìm & Cào Ảnh Nguồn';
      }
    }
  }

  if (btnHarvestSearchKeywords && inputHarvestKeywords) {
    btnHarvestSearchKeywords.addEventListener('click', () => {
      executeKeywordHarvest(inputHarvestKeywords.value.trim());
    });
    inputHarvestKeywords.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeKeywordHarvest(inputHarvestKeywords.value.trim());
      }
    });
  }

  // Keyword Chips click
  document.querySelectorAll('.chip-harvest-kw').forEach(chip => {
    chip.addEventListener('click', () => {
      const kw = chip.getAttribute('data-kw');
      if (kw) {
        if (inputHarvestKeywords) inputHarvestKeywords.value = kw;
        executeKeywordHarvest(kw);
      }
    });
  });

  // 10b-4. Bảng Drawer quản lý danh sách nguồn đối thủ
  const btnToggleSourcesPanel = document.getElementById('btn-toggle-sources-panel');
  const sourcesPanel = document.getElementById('sources-management-panel');
  const sourcesContainer = document.getElementById('sources-list-container');

  async function loadHarvesterSources() {
    if (!sourcesContainer) return;
    try {
      const res = await fetch('/api/media/harvester/sources');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        renderSourcesList(data.data);
      }
    } catch (e) {
      console.warn('Lỗi tải danh sách nguồn:', e);
    }
  }

  function renderSourcesList(sources) {
    if (!sourcesContainer) return;
    sourcesContainer.innerHTML = sources.map(s => `
      <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 700; font-size: 0.8rem; color: #f8fafc;">${escapeHtml(s.name)}</div>
          <div style="font-size: 0.7rem; color: #64748b;">${escapeHtml(s.domain)} • Đã cào: ${s.stats?.totalHarvested || 0} ảnh sạch</div>
        </div>
        <label style="margin: 0; cursor: pointer;">
          <input type="checkbox" class="chk-toggle-source" data-id="${s.id}" ${s.active !== false ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #38bdf8;">
        </label>
      </div>
    `).join('');

    sourcesContainer.querySelectorAll('.chk-toggle-source').forEach(chk => {
      chk.addEventListener('change', async () => {
        const id = chk.getAttribute('data-id');
        try {
          await fetch('/api/media/harvester/sources/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, active: chk.checked })
          });
          showToast('Đã cập nhật trạng thái nguồn!', 'info');
        } catch (e) {
          showToast('Lỗi cập nhật nguồn', 'error');
        }
      });
    });
  }

  if (btnToggleSourcesPanel && sourcesPanel) {
    btnToggleSourcesPanel.addEventListener('click', () => {
      const isHidden = sourcesPanel.style.display === 'none';
      sourcesPanel.style.display = isHidden ? 'block' : 'none';
      btnToggleSourcesPanel.innerHTML = isHidden 
        ? '<i class="fa-solid fa-chevron-up"></i> Thu Gọn Nguồn' 
        : '<i class="fa-solid fa-list-check"></i> Xem 6 Nguồn Đối Thủ';
      if (isHidden) loadHarvesterSources();
    });
  }

  // 10c. Warehouse Logo Audit Button
  const btnAuditKhoLogos = document.getElementById('btn-audit-kho-logos');
  if (btnAuditKhoLogos) {
    btnAuditKhoLogos.addEventListener('click', async () => {
      btnAuditKhoLogos.disabled = true;
      btnAuditKhoLogos.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang rà soát AI Vision...`;
      try {
        const targetKho = (activeCustomMediaKho === 'all') ? 'kho_1' : activeCustomMediaKho;
        const res = await fetch('/api/media/audit-warehouse-logos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ khoId: targetKho, limit: 20 })
        });
        const data = await res.json();
        if (data.success) {
          const r = data.data;
          if (r.flaggedCount === 0) {
            showToast(`✅ Rà soát hoàn tất ${r.totalScanned} ảnh trong ${r.kho}: Sạch 100% không phát hiện logo đối thủ nào!`, 'success');
          } else {
            showToast(`⚠️ Phát hiện ${r.flaggedCount} ảnh dính logo đối thủ trong ${r.kho}!`, 'warning');
            const detailsMsg = r.flaggedItems.map(x => `• ${x.url}: ${x.details} (${(x.detectedBrands || []).join(', ')})`).join('\n');
            const doPurge = confirm(`🚨 CẢNH BÁO THƯƠNG HIỆU:\nPhát hiện ${r.flaggedCount} ảnh có chứa logo/nhãn dán đối thủ:\n\n${detailsMsg}\n\nAnh có muốn tự động XÓA SẠCH các bức ảnh vi phạm này khỏi kho ngay bây giờ không?`);
            if (doPurge) {
              btnAuditKhoLogos.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang xóa ảnh vi phạm...`;
              const purgeRes = await fetch('/api/media/audit-warehouse-logos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ khoId: targetKho, limit: 30, purgeFlagged: true })
              });
              const purgeData = await purgeRes.json();
              if (purgeData.success) {
                showToast(purgeData.message || 'Đã dọn sạch ảnh vi phạm khỏi kho!', 'success');
                if (typeof loadCustomMediaGallery === 'function') await loadCustomMediaGallery();
              }
            }
          }
        } else {
          showToast(data.message || 'Lỗi rà soát logo', 'error');
        }
      } catch (err) {
        showToast('Lỗi khi rà soát logo kho: ' + err.message, 'error');
      } finally {
        btnAuditKhoLogos.disabled = false;
        btnAuditKhoLogos.innerHTML = `<i class="fa-solid fa-shield-halved"></i> 🛡️ Rà Soát Logo Đối Thủ`;
      }
    });
  }

  if (btnStagingApproveAll) {
    btnStagingApproveAll.addEventListener('click', async () => {
      btnStagingApproveAll.disabled = true;
      btnStagingApproveAll.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang duyệt...';
      try {
        const res = await fetch('/api/media/staging/approve-all', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          await Promise.all([loadStagingMedia(), loadCustomMediaGallery()]);
        } else {
          showToast(data.message || 'Lỗi duyệt ảnh', 'error');
        }
      } catch (err) {
        showToast('Lỗi khi duyệt ảnh: ' + err.message, 'error');
      } finally {
        btnStagingApproveAll.disabled = false;
        btnStagingApproveAll.innerHTML = '<i class="fa-solid fa-check-double"></i> ⚡ Duyệt Hết Theo Gợi Ý AI';
      }
    });
  }

  if (btnStagingRefresh) {
    btnStagingRefresh.addEventListener('click', () => {
      loadStagingMedia();
      loadBrandLogoConfig();
      showToast('Đã làm mới hộp thư xét duyệt!', 'info');
    });
  }

  // Tải Staging Media & Cấu hình Logo Thương Hiệu khi khởi động
  loadStagingMedia();
  initBrandLogoCustomizer();
  loadBrandLogoConfig();

  // 11. Rename Kho Modal & Actions
  const modalRename = document.getElementById('rename-kho-modal');
  const btnCloseRename = document.getElementById('btn-close-rename-kho-modal');
  const btnCancelRename = document.getElementById('btn-cancel-rename-kho');
  const btnSaveRename = document.getElementById('btn-save-rename-kho');

  const openRenameModal = (khoId) => {
    const meta = KHO_METADATA[khoId] || {};
    const targetInput = document.getElementById('rename-kho-target-id');
    const label = document.getElementById('rename-kho-current-label');
    const nameInput = document.getElementById('rename-kho-name-input');
    const shortInput = document.getElementById('rename-kho-short-input');
    const descInput = document.getElementById('rename-kho-desc-input');

    if (targetInput) targetInput.value = khoId;
    if (label) label.textContent = khoId.toUpperCase();
    if (nameInput) nameInput.value = meta.name || '';
    if (shortInput) shortInput.value = meta.shortName || '';
    if (descInput) descInput.value = meta.desc || '';

    if (modalRename) modalRename.style.display = 'flex';
  };

  const closeRenameModal = () => {
    if (modalRename) modalRename.style.display = 'none';
  };

  if (btnCloseRename) btnCloseRename.addEventListener('click', closeRenameModal);
  if (btnCancelRename) btnCancelRename.addEventListener('click', closeRenameModal);

  document.querySelectorAll('.btn-rename-kho').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetKho = e.currentTarget.getAttribute('data-kho');
      openRenameModal(targetKho);
    });
  });

  const btnRenameActive = document.getElementById('btn-rename-active-kho');
  if (btnRenameActive) {
    btnRenameActive.addEventListener('click', () => {
      const targetKho = (activeCustomMediaKho === 'all') ? 'kho_1' : activeCustomMediaKho;
      openRenameModal(targetKho);
    });
  }

  if (btnSaveRename) {
    btnSaveRename.addEventListener('click', async () => {
      const khoId = document.getElementById('rename-kho-target-id')?.value;
      const name = document.getElementById('rename-kho-name-input')?.value;
      const shortName = document.getElementById('rename-kho-short-input')?.value;
      const desc = document.getElementById('rename-kho-desc-input')?.value;

      if (!khoId || !name) return showToast('Vui lòng nhập tên kho mới.', 'error');

      btnSaveRename.disabled = true;
      btnSaveRename.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang Lưu...`;

      try {
        const res = await fetch('/api/kho/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ khoId, name, shortName, desc })
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Đã đổi tên ${khoId.toUpperCase()} thành công!`, 'success');
          closeRenameModal();
          await loadKhoConfig();
          switchActiveKho(activeCustomMediaKho);
        } else {
          showToast(data.message || 'Lỗi khi đổi tên kho', 'error');
        }
      } catch (err) {
        showToast('Lỗi kết nối khi đổi tên kho', 'error');
      } finally {
        btnSaveRename.disabled = false;
        btnSaveRename.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Lưu Tên Kho Mới`;
      }
    });
  }

  // Load kho config & initialize with Kho 1 active by default
  loadKhoConfig().then(() => {
    switchActiveKho('kho_1');
  });
}

/* ==========================================================================
   LIVE BLOG CRAWLER & ANTI-CANNIBALIZATION SHIELD UI
   ========================================================================== */
let crawledPostsCache = [];

async function loadCrawlerStatus() {
  try {
    const res = await fetch('/api/crawler/status');
    const data = await res.json();
    if (data.success) {
      const count = data.count || 0;
      const statusText = document.getElementById('crawler-status-text');
      if (statusText) statusText.textContent = `Đã Quét ${count} Bài Live`;
      
      const shieldBadge = document.getElementById('live-shield-count-badge');
      if (shieldBadge) shieldBadge.textContent = `${count} Bài Đã Quét`;

      const modalBadge = document.getElementById('crawler-modal-total-badge');
      if (modalBadge) modalBadge.textContent = `${count} Bài Viết`;

      const scannedAt = document.getElementById('crawler-modal-scanned-at');
      if (scannedAt && data.lastScanned) {
        const dateObj = new Date(data.lastScanned);
        scannedAt.textContent = dateObj.toLocaleTimeString('vi-VN') + ' ' + dateObj.toLocaleDateString('vi-VN');
      }
    }
  } catch (e) {
    console.error('Error loading crawler status:', e);
  }
}

async function triggerCrawlerScan(triggerBtn) {
  const originalHtml = triggerBtn ? triggerBtn.innerHTML : '';
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang Quét Blog...`;
  }

  showToast('Đang kết nối tới https://xulynuochoasen.com/blog-chia-se/ để quét danh sách bài viết...', 'info');

  try {
    const res = await fetch('/api/crawler/scan', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await loadCrawlerStatus();
      if (document.getElementById('crawler-posts-modal')?.style.display === 'flex') {
        await loadAndRenderCrawlerPosts();
      }
    } else {
      showToast(data.message || 'Không thể quét blog', 'error');
    }
  } catch (err) {
    showToast('Lỗi khi quét blog: ' + err.message, 'error');
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.innerHTML = originalHtml;
    }
  }
}

async function loadAndRenderCrawlerPosts(filterText = '') {
  const container = document.getElementById('crawler-posts-list');
  if (!container) return;

  try {
    if (crawledPostsCache.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu bài viết thực tế...</div>`;
      const res = await fetch('/api/crawler/posts');
      const data = await res.json();
      if (data.success) {
        crawledPostsCache = data.data || [];
      }
    }

    const filtered = filterText.trim()
      ? crawledPostsCache.filter(p => (p.title || '').toLowerCase().includes(filterText.toLowerCase().trim()))
      : crawledPostsCache;

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding: 30px; color: var(--text-muted);">Không tìm thấy bài viết nào khớp với từ khóa tìm kiếm.</div>`;
      return;
    }

    container.innerHTML = filtered.map((post, idx) => `
      <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; transition: all 0.2s ease;">
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 0.75rem; color: #64748b; font-weight: 700; min-width: 24px;">#${idx + 1}</span>
            <h5 style="margin: 0; font-size: 0.92rem; color: #f8fafc; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${post.title}
            </h5>
          </div>
          <div style="font-size: 0.78rem; color: #38bdf8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <i class="fa-solid fa-link" style="font-size: 0.7rem;"></i> ${post.url}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 0.72rem; padding: 4px 8px; border-radius: 12px;">
            <i class="fa-solid fa-shield-check"></i> Đang Bảo Vệ
          </span>
          <a href="${post.url}" target="_blank" class="btn btn-sm btn-ghost" style="padding: 6px 10px;" title="Mở bài viết trên web">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        </div>
      </div>
    `).join('');

  } catch (e) {
    container.innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center;">Lỗi tải bài viết: ${e.message}</div>`;
  }
}

function initLiveBlogCrawlerUI() {
  loadCrawlerStatus();

  // Button: Scan from top header
  const btnScanTop = document.getElementById('btn-scan-live-blog');
  if (btnScanTop) {
    btnScanTop.addEventListener('click', () => triggerCrawlerScan(btnScanTop));
  }

  // Button: Rescan from Keywords Banner
  const btnRescanBanner = document.getElementById('btn-rescan-blog-shield');
  if (btnRescanBanner) {
    btnRescanBanner.addEventListener('click', () => triggerCrawlerScan(btnRescanBanner));
  }

  // Modal open triggers
  const openModal = () => {
    const modal = document.getElementById('crawler-posts-modal');
    if (modal) {
      modal.style.display = 'flex';
      crawledPostsCache = []; // reset cache to refresh
      loadAndRenderCrawlerPosts();
    }
  };

  const btnViewCrawled = document.getElementById('btn-view-crawled-posts');
  if (btnViewCrawled) btnViewCrawled.addEventListener('click', openModal);

  const shieldBadge = document.getElementById('crawler-shield-badge');
  if (shieldBadge) shieldBadge.addEventListener('click', openModal);

  // Modal close triggers
  const closeModal = () => {
    const modal = document.getElementById('crawler-posts-modal');
    if (modal) modal.style.display = 'none';
  };

  const btnCloseModal = document.getElementById('btn-close-crawler-modal');
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);

  const btnCloseModalBtn = document.getElementById('btn-close-crawler-modal-btn');
  if (btnCloseModalBtn) btnCloseModalBtn.addEventListener('click', closeModal);

  // Modal rescan trigger
  const btnModalRescan = document.getElementById('btn-modal-rescan-trigger');
  if (btnModalRescan) {
    btnModalRescan.addEventListener('click', () => triggerCrawlerScan(btnModalRescan));
  }

  // Modal search input
  const searchInput = document.getElementById('crawler-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      loadAndRenderCrawlerPosts(e.target.value);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initRankTrackerAndAuditUI();
  initKeywordClusteringUI();
  initCustomMediaUI();
  initLiveBlogCrawlerUI();
  initMediaGalleryModalEvents();
});

// ==========================================================================
// DUPLICATE CONTENT CHECKER & AI REWRITER
// ==========================================================================

let _lastDuplicateReport = null;

async function scanDuplicates() {
  const btn = document.getElementById('btn-scan-duplicate');
  const statusEl = document.getElementById('duplicate-scan-status');
  const container = document.getElementById('duplicate-groups-container');
  const statsEl = document.getElementById('duplicate-stats');

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang quét...';
  statusEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang phân tích toàn bộ bài viết...';
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem"></i><p>Đang phân tích...</p></div>';

  try {
    const res = await fetch('/api/duplicate-check');
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    _lastDuplicateReport = data;
    renderDuplicateReport(data);

    // Update nav badge
    const badge = document.getElementById('duplicate-nav-badge');
    if (badge) {
      const count = data.duplicateGroups ? data.duplicateGroups.length : 0;
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }

    statusEl.innerHTML = data.duplicateGroups && data.duplicateGroups.length > 0
      ? `<i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b"></i> Phát hiện <strong>${data.duplicateGroups.length} nhóm duplicate</strong>`
      : `<i class="fa-solid fa-circle-check" style="color:#22c55e"></i> Tuyệt vời! Không phát hiện duplicate content`;
  } catch (err) {
    statusEl.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color:#ef4444"></i> Lỗi: ${err.message}`;
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444"><p>${err.message}</p></div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Quét Toàn Bộ Bài Viết';
  }
}

function renderDuplicateReport(data) {
  const container = document.getElementById('duplicate-groups-container');
  const statsEl = document.getElementById('duplicate-stats');

  // Update stats
  document.getElementById('dup-total-posts').textContent = data.totalPosts || 0;
  document.getElementById('dup-total-groups').textContent = (data.duplicateGroups || []).length;
  document.getElementById('dup-total-affected').textContent = data.totalDuplicatePosts || 0;
  document.getElementById('dup-total-ok').textContent = (data.totalPosts || 0) - (data.totalDuplicatePosts || 0);
  statsEl.style.display = 'flex';

  if (!data.duplicateGroups || data.duplicateGroups.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <i class="fa-solid fa-circle-check" style="font-size:3.5rem;color:#22c55e;margin-bottom:16px;display:block"></i>
        <h3 style="color:#22c55e;margin-bottom:8px">Hoàn hảo! Không có duplicate content</h3>
        <p>Tất cả ${data.totalPosts} bài viết đều có nội dung unique. Google sẽ yêu thích site của bạn! 🎉</p>
      </div>`;
    return;
  }

  let html = '';
  data.duplicateGroups.forEach((group, gi) => {
    const kwDisplay = group.keyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    html += `
      <div class="glass" style="border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid rgba(239,68,68,0.3)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="margin:0 0 4px;display:flex;align-items:center;gap:8px">
              <span style="background:#ef4444;color:#fff;border-radius:6px;padding:2px 8px;font-size:0.75rem;font-weight:700">DUPLICATE</span>
              🔑 Keyword: <em>${kwDisplay}</em>
            </h3>
            <p style="margin:0;color:var(--text-muted);font-size:0.85rem">${group.count} bài viết cùng keyword — nội dung trùng lặp nghiêm trọng, Google sẽ penalize!</p>
          </div>
          <button class="btn-primary" style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:8px 16px;font-size:0.85rem"
                  onclick="rewriteAllInGroup(${gi})"
                  id="btn-rewrite-group-${gi}">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Rewrite Cả Nhóm
          </button>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${group.posts.map((post, pi) => `
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"
                 id="dup-post-row-${post.id}">
              <div style="flex:1;min-width:200px">
                <div style="font-weight:600;margin-bottom:4px;font-size:0.92rem">${post.title}</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
                  <span style="font-size:0.75rem;padding:2px 7px;border-radius:4px;background:${post.wpPublished ? 'rgba(34,197,94,0.2);color:#4ade80' : 'rgba(99,102,241,0.2);color:#a5b4fc'}">
                    ${post.wpPublished ? '✅ WP Published' : '📝 Local'}
                  </span>
                  <span style="font-size:0.75rem;color:var(--text-muted)">${post.contentLength ? Math.round(post.contentLength/100)/10 + 'k chars' : ''}</span>
                  ${post.wpLink ? `<a href="${post.wpLink}" target="_blank" style="font-size:0.75rem;color:var(--primary-color)">🔗 Xem WP</a>` : ''}
                </div>
              </div>
              <div style="display:flex;gap:8px">
                ${pi > 0 ? `
                  <button class="btn-secondary" style="padding:6px 14px;font-size:0.8rem"
                          onclick="rewritePost('${post.id}', ${post.wpPublished})"
                          id="btn-rewrite-${post.id}">
                    <i class="fa-solid fa-rotate"></i> AI Rewrite
                  </button>` : `
                  <span style="font-size:0.78rem;color:#4ade80;padding:6px 10px">
                    <i class="fa-solid fa-star"></i> Bài gốc
                  </span>`
                }
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

async function rewritePost(postId, isWpPublished) {
  const btn = document.getElementById(`btn-rewrite-${postId}`);
  const row = document.getElementById(`dup-post-row-${postId}`);
  if (!btn) return;

  const updateWP = isWpPublished && confirm('Bài này đã publish lên WordPress. Cập nhật luôn lên WP sau khi rewrite?');

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang rewrite...';

  try {
    const res = await fetch('/api/posts/rewrite-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, updateWordPress: updateWP })
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.message);

    btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Đã Rewrite!';
    btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
    if (row) {
      row.style.borderColor = 'rgba(34,197,94,0.4)';
      row.style.background = 'rgba(34,197,94,0.05)';
    }

    showToast(`✅ Đã rewrite thành công! Tiêu đề mới: "${data.post?.title}"`, 'success');
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> AI Rewrite';
    showToast(`❌ Lỗi rewrite: ${err.message}`, 'error');
  }
}

async function rewriteAllInGroup(groupIndex) {
  if (!_lastDuplicateReport || !_lastDuplicateReport.duplicateGroups) return;
  const group = _lastDuplicateReport.duplicateGroups[groupIndex];
  if (!group) return;

  // Rewrite tất cả ngoại trừ bài đầu tiên (bài gốc)
  const postsToRewrite = group.posts.slice(1);
  if (postsToRewrite.length === 0) return;

  const confirmed = confirm(`Rewrite ${postsToRewrite.length} bài bị duplicate trong nhóm keyword "${group.keyword}"?\n\n(Bài đầu tiên sẽ được giữ nguyên)`);
  if (!confirmed) return;

  const btn = document.getElementById(`btn-rewrite-group-${groupIndex}`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang rewrite...'; }

  let successCount = 0;
  for (const post of postsToRewrite) {
    try {
      const res = await fetch('/api/posts/rewrite-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, updateWordPress: post.wpPublished })
      });
      const data = await res.json();
      if (data.success) {
        successCount++;
        const rowBtn = document.getElementById(`btn-rewrite-${post.id}`);
        if (rowBtn) {
          rowBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Done';
          rowBtn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
        }
        const row = document.getElementById(`dup-post-row-${post.id}`);
        if (row) { row.style.borderColor = 'rgba(34,197,94,0.4)'; row.style.background = 'rgba(34,197,94,0.05)'; }
      }
    } catch(e) { console.error('Rewrite error for', post.id, e); }
  }

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Đã rewrite ${successCount}/${postsToRewrite.length} bài`;
    btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
  }

  showToast(`✅ Đã rewrite ${successCount}/${postsToRewrite.length} bài trong nhóm "${group.keyword}"`, 'success');
}

// Helper toast (nếu chưa có)
function showToast(message, type = 'info') {
  const existing = document.getElementById('toast-notification');
  if (existing) existing.remove();

  const colors = { success: '#22c55e', error: '#ef4444', info: '#6366f1', warning: '#f59e0b' };
  const toast = document.createElement('div');
  toast.id = 'toast-notification';
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${colors[type] || colors.info};color:#fff;
    padding:14px 20px;border-radius:10px;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
    max-width:380px;font-size:0.9rem;font-weight:500;
    animation:slideInRight 0.3s ease;
  `;
  toast.innerHTML = message;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
}

/* ==========================================================================
   STARTUP HEALTH & SYSTEM ANTI-DUPLICATE AUDITOR
   ========================================================================== */
function setupStartupAuditEvents() {
  const btnRunFull = document.getElementById('btn-run-full-audit');
  if (btnRunFull) {
    btnRunFull.addEventListener('click', () => runFullSystemAudit());
  }

  const btnReAudit = document.getElementById('btn-re-audit-now');
  if (btnReAudit) {
    btnReAudit.addEventListener('click', () => runFullSystemAudit());
  }

  const badge = document.getElementById('startup-audit-badge');
  if (badge) {
    badge.addEventListener('click', () => {
      const banner = document.getElementById('startup-audit-banner');
      if (banner) {
        banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        banner.style.boxShadow = '0 0 35px rgba(59, 130, 246, 0.6)';
        setTimeout(() => { banner.style.boxShadow = '0 10px 30px -10px rgba(0, 0, 0, 0.5)'; }, 2000);
      }
    });
  }

  const aiBadge = document.getElementById('global-ai-shield-badge');
  if (aiBadge) {
    aiBadge.addEventListener('click', () => {
      showToast('🛡️ Lá Chắn AI: Gemini 3.8 Flash & Vision đang kích hoạt 100% bảo vệ nội dung độc bản, chặn logo đối thủ!', 'info');
    });
  }
}

async function loadStartupAuditStatus() {
  try {
    const res = await fetch('/api/audit/report');
    if (!res.ok) return;
    const json = await res.json();
    const report = json.report || json.data || json;
    if (!report || !report.summary) return;

    renderStartupAuditUI(report);
  } catch (err) {
    console.warn('[Startup Audit] Lỗi tải kết quả rà soát:', err.message);
  }
}

async function runFullSystemAudit() {
  const btnRun = document.getElementById('btn-run-full-audit');
  const btnReAudit = document.getElementById('btn-re-audit-now');
  if (btnRun) {
    btnRun.disabled = true;
    btnRun.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang rà soát...';
  }
  if (btnReAudit) {
    btnReAudit.disabled = true;
    btnReAudit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang rà soát...';
  }

  showToast('🔍 Đang rà soát toàn bộ lỗi hệ thống, trùng lặp nội dung và ảnh...', 'info');

  try {
    const res = await fetch('/api/audit/run', { method: 'POST' });
    const json = await res.json();
    if (json.success && json.report) {
      renderStartupAuditUI(json.report);
      showToast(`✅ Rà soát hoàn tất! Điểm sức khỏe: ${json.report.summary.healthScore}/100đ`, 'success');
    } else {
      showToast('❌ Có lỗi khi chạy rà soát: ' + (json.message || 'Thử lại sau'), 'error');
    }
  } catch (err) {
    showToast('❌ Lỗi kết nối khi rà soát: ' + err.message, 'error');
  } finally {
    if (btnRun) {
      btnRun.disabled = false;
      btnRun.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i> Quét Rà Soát Hệ Thống';
    }
    if (btnReAudit) {
      btnReAudit.disabled = false;
      btnReAudit.innerHTML = '<i class="fa-solid fa-rotate"></i> <span>Chạy Rà Soát Toàn Bộ Ngay</span>';
    }
  }
}

function renderStartupAuditUI(report) {
  const sum = report.summary || {};
  const score = sum.healthScore !== undefined ? sum.healthScore : 100;
  
  // Header Badge
  const badgeText = document.getElementById('startup-audit-badge-text');
  const badgeEl = document.getElementById('startup-audit-badge');
  if (badgeText && badgeEl) {
    badgeText.textContent = `Sức Khỏe: ${score}/100đ`;
    if (score >= 90) {
      badgeEl.style.background = 'rgba(16, 185, 129, 0.15)';
      badgeEl.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      badgeEl.style.color = '#34d399';
    } else if (score >= 70) {
      badgeEl.style.background = 'rgba(245, 158, 11, 0.15)';
      badgeEl.style.borderColor = 'rgba(245, 158, 11, 0.35)';
      badgeEl.style.color = '#fbbf24';
    } else {
      badgeEl.style.background = 'rgba(239, 68, 68, 0.15)';
      badgeEl.style.borderColor = 'rgba(239, 68, 68, 0.35)';
      badgeEl.style.color = '#f87171';
    }
  }

  // Dashboard Pill
  const pill = document.getElementById('audit-health-pill');
  if (pill) {
    if (score >= 90) {
      pill.textContent = 'Khởi Động An Toàn (Chuẩn SEO)';
      pill.style.background = 'rgba(16, 185, 129, 0.2)';
      pill.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      pill.style.color = '#34d399';
    } else {
      pill.textContent = `Cần Lưu Ý (${sum.totalIssues || 0} mục)`;
      pill.style.background = 'rgba(245, 158, 11, 0.2)';
      pill.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      pill.style.color = '#fbbf24';
    }
  }

  // 4 Metrics
  const elHealth = document.getElementById('audit-metric-health');
  if (elHealth) elHealth.textContent = score;

  const elContent = document.getElementById('audit-metric-content-dupe');
  if (elContent) {
    elContent.textContent = sum.duplicateContentCount || 0;
    elContent.style.color = (sum.duplicateContentCount > 0) ? '#f87171' : '#34d399';
  }

  const elImage = document.getElementById('audit-metric-image-dupe');
  if (elImage) {
    elImage.textContent = sum.duplicateImageCount || 0;
    elImage.style.color = (sum.duplicateImageCount > 0) ? '#f87171' : '#34d399';
  }

  const elTitle = document.getElementById('audit-metric-title-dupe');
  if (elTitle) {
    elTitle.textContent = sum.duplicateTitleCount || 0;
    elTitle.style.color = (sum.duplicateTitleCount > 0) ? '#fbbf24' : '#34d399';
  }

  // Detail Container
  const detailContainer = document.getElementById('audit-detail-container');
  if (detailContainer) {
    if (report.issues && report.issues.length > 0) {
      window._currentAuditIssues = report.issues;
      let issuesHtml = `
        <div style="padding: 14px 18px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 10px; margin-bottom: 8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <div style="display:flex; align-items:center; gap:8px; font-weight:700; color:#f87171; font-size: 0.95rem;">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <span>Phát hiện ${report.issues.length} cảnh báo cần khắc phục:</span>
            </div>
            <span style="font-size: 0.8rem; color: #94a3b8;"><i class="fa-solid fa-wand-magic-sparkles" style="color: #c084fc;"></i> Bấm "Tự Động Viết Lại Bằng AI" hoặc "Xem & Sửa Thủ Công"</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${report.issues.map((iss, idx) => {
              const isImg = iss.category === 'duplicate_image';
              const isContent = iss.category === 'duplicate_content';
              const isTitle = iss.category === 'duplicate_title';
              const icon = isImg ? 'fa-solid fa-image' : (isContent ? 'fa-solid fa-file-lines' : 'fa-solid fa-circle-exclamation');
              const iconColor = isImg ? '#38bdf8' : (isContent ? '#f87171' : '#fbbf24');
              const thumb = iss.image ? `<img src="${iss.image}" style="width: 38px; height: 38px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); flex-shrink: 0;">` : '';

              return `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 12px 16px; background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; flex-wrap: wrap;">
                  <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 280px;">
                    ${thumb}
                    <div style="font-size: 0.86rem; color: #f1f5f9; line-height: 1.45;">
                      <i class="${icon}" style="color: ${iconColor}; margin-right: 6px;"></i>
                      <span>${escapeHtml(iss.message || '')}</span>
                    </div>
                  </div>
                  <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    ${isContent ? `
                      <button class="btn btn-sm btn-direct-rewrite-ai" data-index="${idx}" data-post-id="${iss.post2?.id || iss.post1?.id || ''}" style="background: linear-gradient(135deg, #9333ea, #c026d3); color: #fff; font-weight: 700; border: none; padding: 7px 14px; border-radius: 6px; cursor: pointer; box-shadow: 0 2px 10px rgba(147, 51, 234, 0.35); font-size: 0.8rem; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> ✨ Tự Động Viết Lại Bằng AI
                      </button>
                      <button class="btn btn-sm btn-open-audit-fix" data-index="${idx}" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                        <i class="fa-solid fa-pen-to-square"></i> ✍️ Xem &amp; Sửa Thủ Công
                      </button>
                    ` : (isImg ? `
                      <button class="btn btn-sm btn-direct-auto-swap-img" data-index="${idx}" style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-weight: 700; border: none; padding: 7px 14px; border-radius: 6px; cursor: pointer; box-shadow: 0 2px 10px rgba(16, 185, 129, 0.35); font-size: 0.8rem; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                        <i class="fa-solid fa-dice"></i> 🎲 Đổi Ảnh Tự Động
                      </button>
                      <button class="btn btn-sm btn-open-audit-fix" data-index="${idx}" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                        <i class="fa-solid fa-images"></i> 🖼️ Xem &amp; Chọn Ảnh Từ Kho
                      </button>
                    ` : `
                      <button class="btn btn-sm btn-open-audit-fix" data-index="${idx}" style="background: linear-gradient(135deg, #0284c7, #2563eb); color: #fff; font-weight: 600; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                        <i class="fa-solid fa-wrench"></i> Xem &amp; Xử Lý
                      </button>
                    `)}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
      detailContainer.innerHTML = issuesHtml;

      // 1. Bind direct AI Rewrite button on dashboard row
      detailContainer.querySelectorAll('.btn-direct-rewrite-ai').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const b = e.currentTarget;
          const postId = b.getAttribute('data-post-id');
          const idx = parseInt(b.getAttribute('data-index'));
          const iss = window._currentAuditIssues ? window._currentAuditIssues[idx] : null;
          const postTitle = iss?.post2?.title || iss?.post1?.title || 'bài viết';

          if (!confirm(`Anh có chắc muốn dùng Gemini AI để viết lại bài viết:\n"${postTitle}"\nthành bài viết 100% độc bản chuẩn SEO không?`)) {
            return;
          }

          b.disabled = true;
          const originalText = b.innerHTML;
          b.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> AI Đang Viết Lại...`;
          showToast('Gemini đang phân tích và viết lại bài viết độc bản 100%... Vui lòng đợi trong giây lát!', 'info', 6000);

          try {
            const res = await fetch('/api/posts/rewrite-ai', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ postId, updateWordPress: true })
            });
            const data = await res.json();
            if (data.success) {
              showToast('✨ AI đã viết lại bài viết thành công và đồng bộ WordPress!', 'success');
              if (data.report) {
                renderStartupAuditUI(data.report);
              } else {
                const auditRes = await fetch('/api/audit/run', { method: 'POST' });
                const auditData = await auditRes.json();
                if (auditData.report) renderStartupAuditUI(auditData.report);
              }
              if (typeof loadPostsList === 'function') loadPostsList();
            } else {
              showToast(data.message || 'Lỗi khi AI viết lại bài viết', 'error');
              b.disabled = false;
              b.innerHTML = originalText;
            }
          } catch (err) {
            showToast('Lỗi kết nối khi gọi AI: ' + err.message, 'error');
            b.disabled = false;
            b.innerHTML = originalText;
          }
        });
      });

      // 2. Bind direct Auto Swap Image button on dashboard row
      detailContainer.querySelectorAll('.btn-direct-auto-swap-img').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const b = e.currentTarget;
          const idx = parseInt(b.getAttribute('data-index'));
          const iss = window._currentAuditIssues ? window._currentAuditIssues[idx] : null;
          if (!iss || !iss.posts || iss.posts.length < 2) {
            return showToast('Không tìm thấy bài viết trùng ảnh để đổi.', 'error');
          }

          const postToSwap = iss.posts[iss.posts.length - 1];
          const pTitle = postToSwap.title || '';
          const targetKho = pTitle.toLowerCase().includes('công nghiệp') ? 'kho_2' :
            ((pTitle.toLowerCase().includes('mặn') || pTitle.toLowerCase().includes('tinh khiết') || pTitle.toLowerCase().includes('ro')) ? 'kho_3' : 'kho_1');

          b.disabled = true;
          const originalText = b.innerHTML;
          b.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang Đổi Ảnh...`;

          try {
            const candRes = await fetch(`/api/audit/warehouse-candidates?kho=${targetKho}`);
            const candData = await candRes.json();
            if (!candData.success || !candData.candidates || candData.candidates.length === 0) {
              b.disabled = false;
              b.innerHTML = originalText;
              return showToast(`Kho ${targetKho} hiện không còn ảnh trống độc bản. Vui lòng nạp thêm ảnh vào kho!`, 'warning');
            }

            const candidate = candData.candidates[0];
            const swapRes = await fetch('/api/audit/swap-post-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                postId: postToSwap.id,
                postType: postToSwap.type,
                oldImageUrl: iss.image,
                newImageUrl: candidate.url,
                newImageWpId: candidate.wpMediaId
              })
            });
            const swapData = await swapRes.json();
            if (swapData.success) {
              showToast(`Đã tự động đổi sang ảnh "${candidate.filename}" từ Kho ${targetKho} và đồng bộ WordPress!`, 'success');
              if (swapData.report) renderStartupAuditUI(swapData.report);
              if (typeof loadPostsList === 'function') loadPostsList();
            } else {
              showToast(swapData.message || 'Lỗi khi đổi ảnh', 'error');
              b.disabled = false;
              b.innerHTML = originalText;
            }
          } catch (err) {
            showToast('Lỗi kết nối khi đổi ảnh: ' + err.message, 'error');
            b.disabled = false;
            b.innerHTML = originalText;
          }
        });
      });

      // 3. Bind Open Audit Fix Modal
      detailContainer.querySelectorAll('.btn-open-audit-fix').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const targetBtn = e.target.closest('.btn-open-audit-fix');
          const idx = parseInt(targetBtn.getAttribute('data-index'));
          if (!isNaN(idx) && window._currentAuditIssues && window._currentAuditIssues[idx]) {
            openAuditManualFixModal(window._currentAuditIssues[idx]);
          }
        });
      });
    } else {
      detailContainer.innerHTML = `
        <div style="padding: 10px 16px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-circle-check" style="color: #34d399; font-size: 1.1rem;"></i>
          <span id="audit-status-summary-text">Hệ thống đã tự động rà soát khi khởi động: Tất cả ${sum.totalLiveBlogPosts || 82} bài viết WordPress đều độc bản 100%, ảnh đại diện độc quyền, link Google Ads chính xác và điểm SEO đạt chuẩn!</span>
        </div>
      `;
    }
  }
}

// BẬT MODAL XỬ LÝ & ĐỔI THỦ CÔNG
async function openAuditManualFixModal(issue) {
  let modal = document.getElementById('audit-manual-fix-modal');
  const title = document.getElementById('audit-modal-title');
  const subtitle = document.getElementById('audit-modal-subtitle');
  const body = document.getElementById('audit-modal-body');
  const iconGlow = document.getElementById('audit-modal-icon-glow');
  if (!modal || !body) return;

  // Đảm bảo modal gắn trực tiếp vào body và hiển thị trên cùng
  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  modal.style.zIndex = '999999';

  // Bind close buttons securely
  const btnClose = document.getElementById('btn-close-audit-modal');
  const btnCloseFooter = document.getElementById('btn-close-audit-modal-footer');
  if (btnClose) btnClose.onclick = () => { modal.style.display = 'none'; };
  if (btnCloseFooter) btnCloseFooter.onclick = () => { modal.style.display = 'none'; };
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

  if (issue.category === 'duplicate_image') {
    if (title) title.textContent = 'Đổi Ảnh Trùng Lặp Thủ Công';
    if (subtitle) subtitle.textContent = `Ảnh "${issue.filename || 'này'}" đang được dùng chung giữa các bài viết. Anh có thể chọn ảnh khác từ kho tương ứng.`;
    if (iconGlow) {
      iconGlow.innerHTML = '<i class="fa-solid fa-images"></i>';
      iconGlow.style.background = 'rgba(14, 165, 233, 0.2)';
      iconGlow.style.color = '#38bdf8';
    }

    body.innerHTML = `
      <div style="display: flex; gap: 18px; margin-bottom: 20px; align-items: center; background: rgba(15, 23, 42, 0.6); padding: 14px 18px; border-radius: 10px; border: 1px solid var(--border-color);">
        <img src="${issue.image}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 2px solid #ef4444;">
        <div style="flex: 1;">
          <div style="font-weight: 700; color: #f87171; font-size: 0.95rem; margin-bottom: 4px;">
            <i class="fa-solid fa-triangle-exclamation"></i> Tấm ảnh này đang bị trùng ở các bài viết bên dưới:
          </div>
          <div style="font-size: 0.8rem; color: #94a3b8; word-break: break-all;">File: <strong>${escapeHtml(issue.filename || issue.image)}</strong></div>
        </div>
      </div>

      <h4 style="color: #fff; font-size: 0.95rem; margin-bottom: 12px;"><i class="fa-solid fa-list-check" style="color: var(--accent-primary);"></i> Chọn bài viết anh muốn đổi ảnh sang ảnh khác:</h4>
      <div id="audit-fix-posts-list" style="display: flex; flex-direction: column; gap: 14px;">
        <div style="text-align: center; padding: 20px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu ảnh từ Kho...</div>
      </div>
    `;

    // Fetch warehouse candidates
    const posts = issue.posts || [];
    const postsListContainer = document.getElementById('audit-fix-posts-list');
    if (!postsListContainer) return;

    let postsHtml = '';
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      const targetKho = (p.title || '').toLowerCase().includes('công nghiệp') ? 'kho_2' :
        (((p.title || '').toLowerCase().includes('mặn') || (p.title || '').toLowerCase().includes('tinh khiết') || (p.title || '').toLowerCase().includes('ro')) ? 'kho_3' : 'kho_1');
      
      postsHtml += `
        <div class="audit-post-card-fix" style="background: rgba(30, 41, 59, 0.7); border: 1px solid var(--border-color); border-radius: 10px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 10px;">
            <div>
              <div style="font-size: 0.75rem; color: var(--accent-primary); font-weight: 700; text-transform: uppercase;">
                ${p.type === 'live' ? '🟢 Bài Viết WordPress Live [ID: ' + p.id + ']' : '📝 Bản Nháp Hệ Thống'}
              </div>
              <div style="font-size: 0.92rem; font-weight: 700; color: #fff; margin-top: 2px;">${escapeHtml(p.title || 'Bài viết')}</div>
            </div>
            <span style="font-size: 0.75rem; padding: 3px 8px; border-radius: 6px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-weight: 600; white-space: nowrap;">Kho: ${targetKho}</span>
          </div>

          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <select class="form-control select-swap-img-candidate" data-post-id="${p.id}" data-post-type="${p.type}" data-old-img="${issue.image}" style="flex: 1; min-width: 250px; font-size: 0.82rem; padding: 8px 12px;">
              <option value="">-- Đang nạp danh sách ảnh từ Kho ${targetKho}... --</option>
            </select>
            <button class="btn btn-primary btn-sm btn-confirm-swap-image" data-post-id="${p.id}" data-post-type="${p.type}" data-old-img="${issue.image}" style="padding: 8px 16px; font-weight: 600; white-space: nowrap;">
              <i class="fa-solid fa-arrow-right-arrow-left"></i> Xác Nhận Đổi Ảnh Này
            </button>
          </div>
        </div>
      `;
    }

    postsListContainer.innerHTML = postsHtml;

    // Load available candidates for each select
    postsListContainer.querySelectorAll('.select-swap-img-candidate').forEach(async sel => {
      const pTitle = sel.closest('.audit-post-card-fix').querySelector('div[style*="font-weight: 700"]').textContent;
      const targetKho = pTitle.toLowerCase().includes('công nghiệp') ? 'kho_2' :
        ((pTitle.toLowerCase().includes('mặn') || pTitle.toLowerCase().includes('tinh khiết') || pTitle.toLowerCase().includes('ro')) ? 'kho_3' : 'kho_1');
      
      try {
        const res = await fetch(`/api/audit/warehouse-candidates?kho=${targetKho}`);
        const data = await res.json();
        if (data.success && data.candidates && data.candidates.length > 0) {
          sel.innerHTML = `
            <option value="">-- Chọn 1 tấm ảnh độc bản từ Kho ${targetKho} (${data.availableCount} ảnh sẵn sàng) --</option>
            ${data.candidates.map(c => `
              <option value="${c.url}" data-wp-id="${c.wpMediaId || ''}">
                ${c.wpMediaId ? '✅ [WP ' + c.wpMediaId + '] ' : '📁 '} ${escapeHtml(c.title || c.filename)}
              </option>
            `).join('')}
          `;
        } else {
          sel.innerHTML = `<option value="">Kho ${targetKho} không còn ảnh trống</option>`;
        }
      } catch (err) {
        sel.innerHTML = `<option value="">Lỗi tải ảnh từ Kho</option>`;
      }
    });

    // Bind confirm swap buttons
    postsListContainer.querySelectorAll('.btn-confirm-swap-image').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const card = e.currentTarget.closest('.audit-post-card-fix');
        const sel = card.querySelector('.select-swap-img-candidate');
        const newImgUrl = sel.value;
        const selectedOpt = sel.options[sel.selectedIndex];
        const newImageWpId = selectedOpt ? selectedOpt.getAttribute('data-wp-id') : null;

        if (!newImgUrl) {
          return showToast('Vui lòng chọn 1 tấm ảnh từ danh sách trước khi bấm xác nhận.', 'error');
        }

        const postId = e.currentTarget.getAttribute('data-post-id');
        const postType = e.currentTarget.getAttribute('data-post-type');
        const oldImageUrl = e.currentTarget.getAttribute('data-old-img');

        e.currentTarget.disabled = true;
        e.currentTarget.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang Đổi Ảnh...`;

        try {
          const res = await fetch('/api/audit/swap-post-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postId,
              postType,
              oldImageUrl,
              newImageUrl: newImgUrl,
              newImageWpId
            })
          });
          const data = await res.json();
          if (data.success) {
            showToast(data.message || 'Đã đổi ảnh thủ công thành công!', 'success');
            modal.style.display = 'none';
            if (data.report) renderStartupAuditUI(data.report);
            if (typeof loadPostsList === 'function') loadPostsList();
          } else {
            showToast(data.message || 'Lỗi khi đổi ảnh', 'error');
            e.currentTarget.disabled = false;
            e.currentTarget.innerHTML = `<i class="fa-solid fa-arrow-right-arrow-left"></i> Xác Nhận Đổi Ảnh Này`;
          }
        } catch (err) {
          showToast('Lỗi kết nối khi đổi ảnh', 'error');
          e.currentTarget.disabled = false;
          e.currentTarget.innerHTML = `<i class="fa-solid fa-arrow-right-arrow-left"></i> Xác Nhận Đổi Ảnh Này`;
        }
      });
    });

  } else if (issue.category === 'duplicate_content') {
    if (title) title.textContent = 'Xử Lý Trùng Lặp Nội Dung';
    if (subtitle) subtitle.textContent = `Phát hiện mức độ tương đồng ${issue.similarity || 45}% giữa 2 bài viết. Anh có thể bấm Viết lại bằng AI hoặc sửa tay trực tiếp.`;
    if (iconGlow) {
      iconGlow.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
      iconGlow.style.background = 'rgba(147, 51, 234, 0.2)';
      iconGlow.style.color = '#c084fc';
    }

    const p1 = issue.post1 || {};
    const p2 = issue.post2 || {};

    body.innerHTML = `
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); padding: 14px 18px; border-radius: 8px; margin-bottom: 18px; font-size: 0.85rem; color: #fca5a5;">
        <div style="font-weight: 700; margin-bottom: 6px; font-size: 0.95rem;">
          <i class="fa-solid fa-triangle-exclamation"></i> Cảnh báo tương đồng nội dung: ${issue.similarity || 45}%
        </div>
        <div style="display: flex; gap: 12px; margin-top: 8px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 250px; background: rgba(0,0,0,0.3); padding: 10px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06);">
            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;">BÀI VIẾT 1</div>
            <div style="color: #fff; font-weight: 600; margin-top: 2px;">${escapeHtml(p1.title || 'Bài 1')}</div>
            <div style="font-size: 0.75rem; color: #38bdf8; margin-top: 4px;">ID: ${p1.id || ''} ${p1.wpPostId ? '(WP #' + p1.wpPostId + ')' : ''}</div>
          </div>
          <div style="flex: 1; min-width: 250px; background: rgba(0,0,0,0.3); padding: 10px 12px; border-radius: 6px; border: 1px solid rgba(239,68,68,0.3);">
            <div style="font-size: 0.75rem; color: #f87171; font-weight: 600;">BÀI VIẾT 2 (ĐỀ XUẤT VIẾT LẠI)</div>
            <div style="color: #fff; font-weight: 600; margin-top: 2px;">${escapeHtml(p2.title || 'Bài 2')}</div>
            <div style="font-size: 0.75rem; color: #38bdf8; margin-top: 4px;">ID: ${p2.id || ''} ${p2.wpPostId ? '(WP #' + p2.wpPostId + ')' : ''}</div>
          </div>
        </div>
      </div>

      <!-- Quick AI Rewrite Action Box -->
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 18px; background: rgba(147, 51, 234, 0.12); border: 1px solid rgba(147, 51, 234, 0.35); border-radius: 8px; margin-bottom: 18px; flex-wrap: wrap;">
        <div>
          <div style="font-weight: 700; color: #e9d5ff; font-size: 0.92rem;">
            <i class="fa-solid fa-wand-magic-sparkles" style="color: #c084fc;"></i> Tự Động Viết Lại Bài Viết Bằng Gemini AI
          </div>
          <div style="font-size: 0.78rem; color: #cbd5e1; margin-top: 2px;">
            AI sẽ tạo cấu trúc hoàn toàn mới, độc bản 100% không trùng lặp và tự động cập nhật lên WordPress.
          </div>
        </div>
        <button class="btn" id="btn-audit-rewrite-ai" data-post-id="${p2.id}" style="background: linear-gradient(135deg, #9333ea, #c026d3); color: #fff; font-weight: 700; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; box-shadow: 0 2px 10px rgba(147, 51, 234, 0.4); white-space: nowrap; font-size: 0.85rem;">
          <i class="fa-solid fa-wand-magic-sparkles"></i> ✨ Bấm Viết Lại Ngay Bằng AI
        </button>
      </div>

      <!-- Manual Edit Box -->
      <div style="margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <label style="color: #fff; font-weight: 700; font-size: 0.9rem; margin: 0;">
            <i class="fa-solid fa-pen-to-square" style="color: var(--accent-primary);"></i> Hoặc Sửa Nội Dung Thủ Công Trực Tiếp:
          </label>
          <span style="font-size: 0.78rem; color: #94a3b8;">Đang sửa: <em>"${escapeHtml(p2.title || '')}"</em></span>
        </div>
        <textarea id="audit-manual-content-textarea" class="form-control" rows="12" style="font-family: monospace; font-size: 0.84rem; line-height: 1.55; padding: 14px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #f8fafc;">${escapeHtml(p2.content || '')}</textarea>
      </div>

      <div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px;">
        <button class="btn btn-primary" id="btn-audit-save-manual-content" data-post-id="${p2.id}" style="font-weight: 600; padding: 10px 24px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; border-radius: 6px;">
          <i class="fa-solid fa-floppy-disk"></i> Lưu Nội Dung Mới Lên WordPress
        </button>
      </div>
    `;

    // Bind AI Rewrite in modal
    const btnAi = document.getElementById('btn-audit-rewrite-ai');
    if (btnAi) {
      btnAi.addEventListener('click', async () => {
        if (!confirm(`Anh có chắc muốn dùng Gemini AI để viết lại bài viết:\n"${p2.title}"\nthành 100% độc bản chuẩn SEO không?`)) return;
        btnAi.disabled = true;
        const origHtml = btnAi.innerHTML;
        btnAi.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> AI Đang Viết Lại...`;
        showToast('Gemini đang phân tích và viết lại bài viết độc bản 100%... Vui lòng đợi trong giây lát!', 'info', 6000);

        try {
          const res = await fetch('/api/posts/rewrite-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId: p2.id, updateWordPress: true })
          });
          const data = await res.json();
          if (data.success) {
            showToast('✨ AI đã viết lại bài viết độc bản thành công và đồng bộ WordPress!', 'success');
            modal.style.display = 'none';
            if (data.report) {
              renderStartupAuditUI(data.report);
            } else {
              const auditRes = await fetch('/api/audit/run', { method: 'POST' });
              const auditData = await auditRes.json();
              if (auditData.report) renderStartupAuditUI(auditData.report);
            }
            if (typeof loadPostsList === 'function') loadPostsList();
          } else {
            showToast(data.message || 'Lỗi khi AI viết lại bài viết', 'error');
            btnAi.disabled = false;
            btnAi.innerHTML = origHtml;
          }
        } catch (err) {
          showToast('Lỗi kết nối khi gọi AI rewrite: ' + err.message, 'error');
          btnAi.disabled = false;
          btnAi.innerHTML = origHtml;
        }
      });
    }

    // Bind Save Manual in modal
    const btnSave = document.getElementById('btn-audit-save-manual-content');
    if (btnSave) {
      btnSave.addEventListener('click', async () => {
        const text = document.getElementById('audit-manual-content-textarea').value;
        if (!text || text.length < 200) {
          return showToast('Nội dung bài viết quá ngắn, vui lòng nhập đầy đủ.', 'error');
        }

        btnSave.disabled = true;
        const origSave = btnSave.innerHTML;
        btnSave.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang Lưu Lên WordPress...`;

        try {
          const res = await fetch('/api/audit/save-manual-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId: p2.id, content: text })
          });
          const data = await res.json();
          if (data.success) {
            showToast('Đã lưu nội dung mới và đồng bộ WordPress thành công!', 'success');
            modal.style.display = 'none';
            if (data.report) renderStartupAuditUI(data.report);
            if (typeof loadPostsList === 'function') loadPostsList();
          } else {
            showToast(data.message || 'Lỗi khi lưu nội dung', 'error');
            btnSave.disabled = false;
            btnSave.innerHTML = origSave;
          }
        } catch (err) {
          showToast('Lỗi kết nối khi lưu nội dung: ' + err.message, 'error');
          btnSave.disabled = false;
          btnSave.innerHTML = origSave;
        }
      });
    }
  }
}

// Close Modal event listeners
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('audit-manual-fix-modal');
  const btnClose = document.getElementById('btn-close-audit-modal');
  const btnCloseFooter = document.getElementById('btn-close-audit-modal-footer');

  if (btnClose && modal) btnClose.addEventListener('click', () => { modal.style.display = 'none'; });
  if (btnCloseFooter && modal) btnCloseFooter.addEventListener('click', () => { modal.style.display = 'none'; });
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }
});

/* ==========================================================================
   24/7 AUTO HEARTBEAT KEEP-ALIVE
   Tự động gửi nhịp tim mỗi 3 phút để giữ Render không bao giờ ngủ đông (Sleep)
   khi có bất kỳ máy nào mở trang web
   ========================================================================== */
setInterval(() => {
  fetch('/api/keywords?_hb=' + Date.now(), { cache: 'no-store' })
    .then(() => console.log('[Heartbeat 24/7] Server kept awake!'))
    .catch(() => {});
}, 3 * 60 * 1000); // Mỗi 3 phút (Render sleep sau 15 phút không có request)

/* ==========================================================================
   INDUSTRY KNOWLEDGE & COMPETITOR HARVESTER CLIENT LOGIC
   ========================================================================== */
let cachedIndustryData = null;
let currentIndustryDomain = 'all';

function setupIndustryKnowledgeEvents() {
  const btnAutoDiscoverGoogle = document.getElementById('btn-auto-discover-google');
  const btnHarvestAll = document.getElementById('btn-harvest-all-industry');
  const btnIngestCustom = document.getElementById('btn-ingest-custom-url');
  const inputCustomUrl = document.getElementById('input-custom-competitor-url');

  if (btnAutoDiscoverGoogle) {
    btnAutoDiscoverGoogle.addEventListener('click', async () => {
      const origHtml = btnAutoDiscoverGoogle.innerHTML;
      btnAutoDiscoverGoogle.disabled = true;
      btnAutoDiscoverGoogle.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tự động lùng sục Google across 6 chuyên mục...';
      try {
        const res = await fetch('/api/industry-knowledge/auto-discover-google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxPerSector: 2 })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          loadIndustryKnowledge();
        } else {
          showToast(data.message || 'Lỗi khi lùng sục Google', 'error');
        }
      } catch (e) {
        showToast('Lỗi kết nối: ' + e.message, 'error');
      } finally {
        btnAutoDiscoverGoogle.disabled = false;
        btnAutoDiscoverGoogle.innerHTML = origHtml;
      }
    });
  }

  if (btnHarvestAll) {
    btnHarvestAll.addEventListener('click', async () => {
      const origHtml = btnHarvestAll.innerHTML;
      btnHarvestAll.disabled = true;
      btnHarvestAll.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang cào toàn diện Kenwa, Wepar, Việt Phát...';
      try {
        const res = await fetch('/api/industry-knowledge/crawl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          loadIndustryKnowledge();
        } else {
          showToast(data.message || 'Lỗi khi cào dữ liệu đối thủ', 'error');
        }
      } catch (e) {
        showToast('Lỗi kết nối: ' + e.message, 'error');
      } finally {
        btnHarvestAll.disabled = false;
        btnHarvestAll.innerHTML = origHtml;
      }
    });
  }

  if (btnIngestCustom && inputCustomUrl) {
    btnIngestCustom.addEventListener('click', async () => {
      const url = inputCustomUrl.value.trim();
      if (!url || !url.startsWith('http')) {
        return showToast('Vui lòng nhập URL hợp lệ (bắt đầu bằng http/https)!', 'warning');
      }

      const depthSelect = document.getElementById('select-competitor-crawl-depth');
      const maxPages = depthSelect ? parseInt(depthSelect.value, 10) : 5;

      const origHtml = btnIngestCustom.innerHTML;
      btnIngestCustom.disabled = true;
      btnIngestCustom.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang quét ${maxPages} trang & phân tích...`;
      try {
        const res = await fetch('/api/industry-knowledge/crawl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, maxPages })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          inputCustomUrl.value = '';
          loadIndustryKnowledge();
        } else {
          showToast(data.message || 'Lỗi cào URL đối thủ', 'error');
        }
      } catch (e) {
        showToast('Lỗi kết nối: ' + e.message, 'error');
      } finally {
        btnIngestCustom.disabled = false;
        btnIngestCustom.innerHTML = origHtml;
      }
    });
  }

  // Dọn dẹp kho tri thức theo danh mục hoặc toàn bộ
  const btnClearArticles = document.getElementById('btn-clear-industry-articles');
  if (btnClearArticles) {
    btnClearArticles.addEventListener('click', async () => {
      const domainName = currentIndustryDomain === 'all' ? 'TẤT CẢ các chuyên mục' : `chuyên mục ${currentIndustryDomain}`;
      if (!confirm(`⚠️ Anh có chắc muốn xóa bài viết trong ${domainName} không?`)) {
        return;
      }

      btnClearArticles.disabled = true;
      btnClearArticles.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang dọn...';
      try {
        const res = await fetch('/api/industry-knowledge/clear-articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: currentIndustryDomain })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          loadIndustryKnowledge();
        } else {
          showToast(data.message || 'Lỗi khi dọn dẹp kho', 'error');
        }
      } catch (e) {
        showToast('Lỗi kết nối: ' + e.message, 'error');
      } finally {
        btnClearArticles.disabled = false;
        btnClearArticles.innerHTML = '<i class="fa-solid fa-trash-can"></i> Dọn Dẹp Mục Này';
      }
    });
  }

  // Domain filter tabs
  const filterBtns = document.querySelectorAll('.ind-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.classList.remove('active', 'btn-primary');
        b.classList.add('btn-secondary');
      });
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-secondary');
      currentIndustryDomain = btn.getAttribute('data-domain') || 'all';
      renderIndustryArticles();
    });
  });
}

async function loadIndustryKnowledge() {
  try {
    const res = await fetch('/api/industry-knowledge');
    const json = await res.json();
    if (json.success && json.data) {
      cachedIndustryData = json.data;
      renderIndustryStats(json.data);
      renderIndustryLexicon(json.data.vocabularyBank || []);
      renderIndustryArticles();
    }
  } catch (e) {
    console.warn('[IndustryKnowledge] Lỗi tải dữ liệu:', e);
  }
}

function renderIndustryStats(data) {
  const totalArticlesEl = document.getElementById('ind-stat-total-articles');
  const totalLexiconEl = document.getElementById('ind-stat-total-lexicon');
  const badgeEl = document.getElementById('industry-nav-badge');

  if (totalArticlesEl) totalArticlesEl.textContent = data.totalArticles || 0;
  if (totalLexiconEl) totalLexiconEl.textContent = (data.vocabularyBank || []).length || 0;
  if (badgeEl) badgeEl.textContent = `${data.totalArticles || 0} bài`;

  // Update filter buttons numbers dynamically
  const counts = data.domainCounts || {};
  const filterBtns = document.querySelectorAll('.ind-filter-btn');
  filterBtns.forEach(btn => {
    const d = btn.getAttribute('data-domain');
    if (d === 'all') btn.textContent = `Tất cả (${data.totalArticles || 0})`;
    else if (d === 'tinh_khiet') btn.textContent = `Tinh Khiết / RO (${counts.tinh_khiet || 0})`;
    else if (d === 'cong_nghiep') btn.textContent = `Công Nghiệp (${counts.cong_nghiep || 0})`;
    else if (d === 'sinh_hoat') btn.textContent = `Lọc Tổng Sinh Hoạt (${counts.sinh_hoat || 0})`;
    else if (d === 'gieng_khoan') btn.textContent = `Giếng Khoan (${counts.gieng_khoan || 0})`;
    else if (d === 'phen') btn.textContent = `Khử Phèn Sắt (${counts.phen || 0})`;
    else if (d === 'man') btn.textContent = `Khử Mặn (${counts.man || 0})`;
  });
}

function renderIndustryLexicon(terms) {
  const container = document.getElementById('industry-lexicon-container');
  if (!container) return;
  if (!terms || terms.length === 0) {
    container.innerHTML = '<span style="color:#94a3b8;font-size:0.85rem">Chưa có thuật ngữ nào được nạp.</span>';
    return;
  }

  container.innerHTML = terms.map(term => {
    return `<span class="lexicon-chip" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); color: #6ee7b7; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 500; display: inline-flex; align-items: center; gap: 5px;">
      <i class="fa-solid fa-check" style="font-size: 10px; opacity: 0.7;"></i> ${escapeHtml(term)}
    </span>`;
  }).join('');
}

function renderIndustryArticles() {
  const listEl = document.getElementById('industry-articles-list');
  if (!listEl || !cachedIndustryData) return;

  const articlesByDomain = cachedIndustryData.articlesByDomain || {};
  let list = [];

  if (currentIndustryDomain === 'all') {
    Object.values(articlesByDomain).forEach(arr => {
      if (Array.isArray(arr)) list.push(...arr);
    });
  } else {
    list = articlesByDomain[currentIndustryDomain] || [];
  }

  if (list.length === 0) {
    listEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #94a3b8;">
      <i class="fa-solid fa-folder-open fa-2x" style="opacity: 0.3; margin-bottom: 12px; display: block;"></i>
      Chưa có bài viết nào cho chuyên mục này.
    </div>`;
    return;
  }

  const domainLabels = {
    tinh_khiet: { label: 'Tinh Khiết / RO', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' },
    cong_nghiep: { label: 'Công Nghiệp & Lò Hơi', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
    sinh_hoat: { label: 'Lọc Tổng Sinh Hoạt', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    gieng_khoan: { label: 'Giếng Khoan', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    phen: { label: 'Khử Phèn Sắt', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    man: { label: 'Khử Mặn', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' }
  };

  listEl.innerHTML = list.map(art => {
    const dInfo = domainLabels[art.domain] || { label: art.domain, color: '#94a3b8', bg: 'rgba(255,255,255,0.1)' };
    const headingsHtml = (art.headings || []).slice(0, 4).map(h => `<li style="margin-bottom: 4px;">${escapeHtml(h)}</li>`).join('');
    const lexiconChips = (art.lexicon || []).slice(0, 4).map(t => `<span style="background: rgba(255,255,255,0.06); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; color: #cbd5e1;">${escapeHtml(t)}</span>`).join(' ');

    return `
      <div class="glass" style="padding: 18px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.08); display: flex; flex-direction: column; justify-content: space-between; gap: 12px; background: rgba(15, 23, 42, 0.45); position: relative;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
            <span style="background: ${dInfo.bg}; color: ${dInfo.color}; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">
              ${dInfo.label}
            </span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <a href="${art.url}" target="_blank" rel="noopener" style="color: #94a3b8; font-size: 0.78rem; text-decoration: none; display: flex; align-items: center; gap: 4px;">
                <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 10px;"></i> ${escapeHtml(art.source || '')}
              </a>
              <button class="btn-del-ind-article" data-url="${escapeHtml(art.url)}" data-domain="${escapeHtml(art.domain || '')}" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); color: #fca5a5; padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; cursor: pointer; transition: all 0.2s;" title="Xóa bài viết này khỏi kho tri thức">
                <i class="fa-solid fa-trash-can"></i> Xóa
              </button>
            </div>
          </div>
          <h4 style="font-size: 0.98rem; font-weight: 600; color: #f8fafc; margin: 0 0 10px 0; line-height: 1.4;">
            ${escapeHtml(art.title)}
          </h4>
          ${headingsHtml ? `<ul style="margin: 0 0 12px 0; padding-left: 18px; color: #94a3b8; font-size: 0.8rem; line-height: 1.5;">${headingsHtml}</ul>` : ''}
        </div>
        <div>
          ${lexiconChips ? `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px;">${lexiconChips}</div>` : ''}
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 0.75rem; color: #64748b; font-style: italic;">
              Đã nạp vào bộ nhớ kỹ thuật Gemini
            </div>
            <button class="btn-del-ind-article" data-url="${escapeHtml(art.url)}" data-domain="${escapeHtml(art.domain || '')}" style="background: transparent; border: none; color: #ef4444; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 4px; opacity: 0.7; padding: 2px 6px;" title="Xóa bài viết này">
              <i class="fa-solid fa-trash-can"></i> Xóa
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Gán sự kiện click xóa bài viết cho từng button
  listEl.querySelectorAll('.btn-del-ind-article').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const url = btn.getAttribute('data-url');
      const domain = btn.getAttribute('data-domain');
      if (!confirm('Anh có chắc muốn xóa bài viết này khỏi kho tri thức không?')) return;

      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      try {
        const res = await fetch('/api/industry-knowledge/delete-article', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, domain })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          loadIndustryKnowledge();
        } else {
          showToast(data.message || 'Lỗi khi xóa bài viết', 'error');
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Xóa';
        }
      } catch (err) {
        showToast('Lỗi kết nối: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Xóa';
      }
    });
  });
}




