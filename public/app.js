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

async function initApp() {
  setupNavigation();
  setupDateDisplay();
  setupEditorEvents();
  setupGeneratorEvents();
  setupSchemaEvents();
  setupSettingsEvents();
  setupAutoPilotEvents();
  setupWPEvents();
  
  await Promise.all([loadPosts(), loadKeywords(), loadSchedulerConfig()]);
  loadSchedulerStatus();
  startCountdownLoop();
  loadWPConfig();
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
    'tab-settings': { t: 'Cấu Hình API & WordPress', s: 'Cấu hình API Gemini và kết nối WordPress REST API tự động đăng bài.' }
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
    const response = await fetch('/api/posts');
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
            ? `<button class="btn btn-sm btn-ghost btn-timeline-read" data-post-id="${item.generatedPostId}" title="Xem bài viết" style="padding: 5px 8px; font-size: 0.78rem;">
                 <i class="fa-solid fa-book-open"></i> Đọc
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
      const targetPost = currentPostsData.find(p => p.id === postId);
      if (targetPost) {
        openQuickPreviewModal(targetPost);
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
    const res = await fetch('/api/keywords');
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
    const targetPost = item.generatedPostId ? currentPostsData.find(p => p.id === item.generatedPostId) : null;
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
    const targetUrlVal = item.targetUrl || '';
    const colTargetUrl = `
      <td>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input 
            type="url" 
            class="form-control form-control-sm input-target-url" 
            data-id="${item.id}" 
            value="${escapeHtml(targetUrlVal)}" 
            placeholder="https://xulynuochoasen.com/san-pham/..." 
            title="Dán link sản phẩm/dịch vụ đích để AI tự động gắn vào bài viết"
            style="font-size: 12px; padding: 7px 12px; border-radius: 8px; background: rgba(10, 15, 29, 0.85); border: 1px solid rgba(255, 255, 255, 0.12); color: #f1f5f9; width: 100%; min-width: 160px;"
          />
          <button 
            type="button"
            class="btn btn-sm btn-secondary btn-save-target-url" 
            data-id="${item.id}" 
            title="Lưu Link Đích SEO Mục Tiêu"
            style="padding: 7px 10px; font-size: 13px; border-radius: 8px; flex-shrink: 0; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15);"
          >💾</button>
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
            <button class="btn btn-sm btn-primary btn-quick-read" data-post-id="${targetPost.id}" title="Đọc toàn văn bài viết" style="padding: 5px 8px; font-size: 0.75rem;"><i class="fa-solid fa-book-open"></i> Đọc</button>
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
        openQuickPreviewModal(targetPost, item);
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
  const img1El = document.getElementById('modal-img1-preview');
  const img2El = document.getElementById('modal-img2-preview');
  if (img1El) img1El.src = img1;
  if (img2El) img2El.src = img2;
}

function openQuickPreviewModal(post, keywordItem) {
  const modal = document.getElementById('quick-preview-modal');
  if (!modal || !post) return;

  document.getElementById('modal-post-title').textContent = post.title || 'Bài viết chưa có tiêu đề';
  document.getElementById('modal-post-meta').textContent = `Từ khóa mục tiêu: ${post.targetKeyword || keywordItem?.keyword || 'N/A'}`;
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
          if (contentBox) {
            if (window.marked && typeof marked.parse === 'function') {
              contentBox.innerHTML = marked.parse(post.content || '');
            } else {
              contentBox.innerHTML = (post.content || '').replace(/\n\n/g, '<br><br>');
            }
          }
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
  if (window.marked && typeof marked.parse === 'function') {
    contentBox.innerHTML = marked.parse(post.content || '*Chưa có nội dung bài viết.*');
  } else {
    contentBox.innerHTML = (post.content || '').replace(/\n\n/g, '<br><br>');
  }

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
              if (contentBox) {
                if (window.marked && typeof marked.parse === 'function') {
                  contentBox.innerHTML = marked.parse(galleryPickingPost.content || '');
                } else {
                  contentBox.innerHTML = (galleryPickingPost.content || '').replace(/\n\n/g, '<br><br>');
                }
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

/* --- Custom Media UI Handlers --- */
async function loadCustomMediaGallery() {
  try {
    const res = await fetch('/api/media');
    const data = await res.json();
    if (data.success) {
      renderCustomMediaGrid(data.data || []);
    }
  } catch (err) {
    console.error('Error loading custom media:', err);
  }
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

function renderCustomMediaGrid(mediaList) {
  const grid = document.getElementById('custom-media-gallery-grid');
  const countEl = document.getElementById('custom-media-count');
  if (!grid) return;

  grid.innerHTML = '';
  if (countEl) countEl.textContent = mediaList.length;

  if (mediaList.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 30px;">Chưa có ảnh thực tế nào. Hãy chọn ảnh từ máy tính hoặc dán link Google Drive bên trên để bắt đầu!</div>`;
    return;
  }

  mediaList.forEach(m => {
    const card = document.createElement('div');
    card.style.cssText = 'background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; position: relative;';

    const tagBadge = m.tagKeyword ? `<span style="position: absolute; top: 6px; left: 6px; background: rgba(14, 165, 233, 0.9); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; z-index: 2;">${escapeHtml(m.tagKeyword)}</span>` : '<span style="position: absolute; top: 6px; left: 6px; background: rgba(100, 116, 139, 0.8); color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; z-index: 2;">Dùng chung</span>';

    const driveIcon = m.isDrive ? '<i class="fa-brands fa-google-drive" style="color: #4285f4; margin-right: 4px;"></i>' : '<i class="fa-solid fa-image" style="color: #10b981; margin-right: 4px;"></i>';

    card.innerHTML = `
      ${tagBadge}
      <div style="width: 100%; height: 130px; background: #000; overflow: hidden; position: relative;">
        <img src="${m.url}" alt="${escapeHtml(m.tagKeyword || 'Custom Image')}" style="width: 100%; height: 100%; object-fit: cover;">
        <button class="btn-rotate-media" data-id="${m.id}" title="Xoay 90° sang phải" style="position: absolute; bottom: 6px; right: 6px; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); color: #38bdf8; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 4px; z-index: 2;">
          <i class="fa-solid fa-rotate-right"></i> Xoay 90°
        </button>
      </div>
      <div style="padding: 10px; font-size: 0.82rem; display: flex; justify-content: space-between; align-items: center; background: rgba(15, 23, 42, 0.6);">
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px; color: var(--text-muted);" title="${escapeHtml(m.filename || 'Ảnh')}">${driveIcon}${escapeHtml(m.filename || 'Ảnh')}</span>
        <button class="btn-delete-media" data-id="${m.id}" title="Xóa ảnh" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px 6px;">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
    grid.appendChild(card);
  });

  // Attach delete listeners
  document.querySelectorAll('.btn-delete-media').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (!confirm('Anh có chắc muốn xóa hình ảnh này khỏi thư viện không?')) return;
      try {
        const res = await fetch('/api/media/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Đã xóa ảnh khỏi thư viện!', 'success');
          loadCustomMediaGallery();
        }
      } catch (err) {
        showToast('Lỗi khi xóa ảnh', 'error');
      }
    });
  });

  // Attach rotate listeners
  document.querySelectorAll('.btn-rotate-media').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const cardImg = e.currentTarget.parentElement.querySelector('img');
      if (!cardImg) return;

      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Xoay...`;

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
        btn.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Xoay 90°`;
      }
    });
  });
}

function initCustomMediaUI() {
  const btnUpload = document.getElementById('btn-upload-custom-media');
  const fileInput = document.getElementById('custom-media-file-input');
  const tagInput = document.getElementById('custom-media-tag-input');
  const dragZone = document.getElementById('media-drag-drop-zone');

  const processSelectedFiles = async (filesList) => {
    const tag = tagInput ? tagInput.value.trim() : '';
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
        body: JSON.stringify({ files: parsedFiles, tagKeyword: tag })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Tải ảnh lên thành công!', 'success');
        if (fileInput) fileInput.value = '';
        if (tagInput) tagInput.value = '';
        loadCustomMediaGallery();
      } else {
        showToast(data.message || 'Lỗi khi tải ảnh lên', 'error');
      }
    } catch (err) {
      showToast('Lỗi kết nối khi tải ảnh lên', 'error');
    } finally {
      btnUpload.disabled = false;
      btnUpload.innerHTML = `<i class="fa-solid fa-upload"></i> Tải Ảnh Lên Thư Viện`;
    }
  };

  if (btnUpload && fileInput) {
    btnUpload.addEventListener('click', () => {
      processSelectedFiles(fileInput.files);
    });
  }

  if (dragZone && fileInput) {
    dragZone.addEventListener('click', () => fileInput.click());
    dragZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dragZone.style.background = 'rgba(14, 165, 233, 0.15)';
    });
    dragZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragZone.style.background = 'rgba(14, 165, 233, 0.06)';
    });
    dragZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dragZone.style.background = 'rgba(14, 165, 233, 0.06)';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processSelectedFiles(e.dataTransfer.files);
      }
    });
  }

  const btnDrive = document.getElementById('btn-add-drive-media');
  const driveUrlInput = document.getElementById('drive-media-url-input');
  const driveTagInput = document.getElementById('drive-media-tag-input');

  if (btnDrive && driveUrlInput) {
    btnDrive.addEventListener('click', async () => {
      const url = driveUrlInput.value.trim();
      const tag = driveTagInput ? driveTagInput.value.trim() : '';
      if (!url) return showToast('Vui lòng dán đường dẫn Google Drive', 'error');

      btnDrive.disabled = true;
      btnDrive.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang Lưu Link Drive...`;

      try {
        const res = await fetch('/api/media/drive-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driveUrl: url, tagKeyword: tag })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Đã kết nối ảnh Google Drive!', 'success');
          driveUrlInput.value = '';
          if (driveTagInput) driveTagInput.value = '';
          loadCustomMediaGallery();
        }
      } catch (err) {
        showToast('Lỗi khi kết nối Google Drive', 'error');
      } finally {
        btnDrive.disabled = false;
        btnDrive.innerHTML = `<i class="fa-solid fa-link"></i> Thêm Link Ảnh Google Drive`;
      }
    });
  }

  const btnRotateAll = document.getElementById('btn-rotate-media-all');
  if (btnRotateAll) {
    btnRotateAll.addEventListener('click', async () => {
      btnRotateAll.disabled = true;
      btnRotateAll.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang Xoay Vòng Kho Ảnh...`;
      try {
        const res = await fetch('/api/media/rotate-all', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || 'Đã xoay vòng ảnh thành công!', 'success');
          loadPostsList();
        } else {
          showToast(data.message || 'Không thể xoay vòng ảnh', 'error');
        }
      } catch (err) {
        showToast('Lỗi khi xoay vòng ảnh', 'error');
      } finally {
        btnRotateAll.disabled = false;
        btnRotateAll.innerHTML = `<i class="fa-solid fa-sync"></i> Xoay Vòng Kho Ảnh Vào Tất Cả Bài Viết`;
      }
    });
  }

  loadCustomMediaGallery();
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

