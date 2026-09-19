/**
 * lib/cluster_coordinator.js
 * Quản lý Leader Election & Heartbeat phân tán qua WordPress REST API
 * 
 * Mục tiêu:
 * - Đảm bảo chỉ CÓ ĐÚNG 1 MÁY đóng vai trò LEADER (chính thức xuất bản bài lên WP)
 * - Máy còn lại tự động ở chế độ STANDBY (Dự phòng theo dõi)
 * - Nếu máy LEADER bị tắt/mất mạng/treo quá LEADER_TIMEOUT_MS (mặc định 15 phút),
 *   máy STANDBY sẽ tự động thăng cấp thành LEADER (Failover an toàn) để tiếp quản lịch đăng bài.
 * - Khi người dùng bấm "Ép làm máy chính", máy này sẽ cưỡng chế giành quyền Leader ngay lập tức.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

const COORDINATOR_PAGE_ID = 15082; // WordPress Draft Page ID
const LEADER_TIMEOUT_MS = 15 * 60 * 1000; // 15 phút không có heartbeat => coi như offline

const BASE_DIR = process.pkg ? process.cwd() : path.join(__dirname, '..');
const LOCAL_HOSTNAME = os.hostname() || 'machine_' + process.pid;

function getWPConfig() {
  try {
    const configPath = path.join(BASE_DIR, 'data/wordpress.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error('[Cluster] Lỗi đọc wordpress.json:', e.message);
  }
  return {};
}

function getAuthHeader(wpConfig) {
  const username = wpConfig.username || '';
  const appPassword = (wpConfig.appPassword || '').replace(/\s+/g, '');
  return 'Basic ' + Buffer.from(`${username}:${appPassword}`).toString('base64');
}

/**
 * Đọc trạng thái coordinator hiện tại từ WordPress Page 15082
 */
async function fetchCoordinatorState() {
  const wpConfig = getWPConfig();
  if (!wpConfig.enabled || !wpConfig.siteUrl || !wpConfig.appPassword) {
    return { error: 'WordPress chưa cấu hình' };
  }

  const auth = getAuthHeader(wpConfig);
  const siteUrl = wpConfig.siteUrl.replace(/\/$/, '');
  const url = `${siteUrl}/wp-json/wp/v2/pages/${COORDINATOR_PAGE_ID}?context=edit`;

  let fetchFn = globalThis.fetch;
  try { fetchFn = (await import('node-fetch')).default || globalThis.fetch; } catch(e) {}

  try {
    const res = await fetchFn(url, {
      method: 'GET',
      headers: {
        'Authorization': auth,
        'User-Agent': `ClusterCoordinator/${LOCAL_HOSTNAME}`
      }
    });

    if (!res.ok) {
      return { error: `WP HTTP error: ${res.status}` };
    }

    const data = await res.json();
    const rawContent = data.content?.raw || '';
    let parsedState = null;
    try {
      parsedState = JSON.parse(rawContent);
    } catch(e) {
      // Thử bóc tách JSON nếu bị WordPress wrap HTML
      const match = rawContent.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsedState = JSON.parse(match[0]); } catch(err) {}
      }
    }

    if (!parsedState) {
      parsedState = {
        leaderHostname: '',
        lastHeartbeat: 0,
        manualTakeover: false
      };
    }

    return {
      success: true,
      pageId: data.id,
      state: parsedState
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Cập nhật trạng thái coordinator lên WordPress
 */
async function updateCoordinatorState(newState) {
  const wpConfig = getWPConfig();
  if (!wpConfig.enabled || !wpConfig.siteUrl || !wpConfig.appPassword) {
    return { error: 'WordPress chưa cấu hình' };
  }

  const auth = getAuthHeader(wpConfig);
  const siteUrl = wpConfig.siteUrl.replace(/\/$/, '');
  const url = `${siteUrl}/wp-json/wp/v2/pages/${COORDINATOR_PAGE_ID}`;

  let fetchFn = globalThis.fetch;
  try { fetchFn = (await import('node-fetch')).default || globalThis.fetch; } catch(e) {}

  try {
    const res = await fetchFn(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth,
        'User-Agent': `ClusterCoordinator/${LOCAL_HOSTNAME}`
      },
      body: JSON.stringify({
        content: JSON.stringify(newState)
      })
    });

    if (!res.ok) {
      return { error: `WP update error: ${res.status}` };
    }

    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Kiểm tra xem máy hiện tại có được phép Publish bài không
 * @param {boolean} forceTakeover - Ép máy này làm Leader
 * @returns {Promise<{ canPublish: boolean, isLeader: boolean, leaderHostname: string, lastHeartbeat: string, message: string }>}
 */
async function checkClusterRole(forceTakeover = false) {
  const wpConfig = getWPConfig();
  if (!wpConfig.enabled || !wpConfig.autoPublish) {
    return {
      canPublish: false,
      isLeader: false,
      leaderHostname: 'NONE',
      lastHeartbeat: null,
      message: 'WordPress Auto-Publish đang tắt'
    };
  }

  const coord = await fetchCoordinatorState();
  if (coord.error) {
    // Nếu tạm thời không kết nối được WP (mất mạng cục bộ...), giữ nguyên an toàn: không publish để tránh bắn trùng
    return {
      canPublish: false,
      isLeader: false,
      leaderHostname: 'UNKNOWN',
      lastHeartbeat: null,
      message: `Không thể kết nối WordPress Coordinator (${coord.error}). Giữ an toàn Standby.`
    };
  }

  const now = Date.now();
  const state = coord.state || {};
  const currentLeader = state.leaderHostname || '';
  const lastHeartbeatTime = state.lastHeartbeat ? new Date(state.lastHeartbeat).getTime() : 0;
  const timeSinceHeartbeat = now - lastHeartbeatTime;
  const isHeartbeatFresh = timeSinceHeartbeat < LEADER_TIMEOUT_MS;

  // Trường hợp 1: Người dùng bấm "Cưỡng chế làm máy chính" (Force Takeover)
  if (forceTakeover) {
    const newState = {
      leaderHostname: LOCAL_HOSTNAME,
      lastHeartbeat: new Date().toISOString(),
      manualTakeoverAt: new Date().toISOString(),
      note: `Leader manually assigned to ${LOCAL_HOSTNAME}`
    };
    await updateCoordinatorState(newState);
    return {
      canPublish: true,
      isLeader: true,
      leaderHostname: LOCAL_HOSTNAME,
      lastHeartbeat: newState.lastHeartbeat,
      message: `Đã cưỡng chế ${LOCAL_HOSTNAME} làm Leader thành công!`
    };
  }

  // Trường hợp 2: Máy này ĐANG LÀ LEADER
  if (currentLeader === LOCAL_HOSTNAME) {
    // Gia hạn Heartbeat (Renew lock)
    const newState = {
      ...state,
      leaderHostname: LOCAL_HOSTNAME,
      lastHeartbeat: new Date().toISOString()
    };
    await updateCoordinatorState(newState);
    return {
      canPublish: true,
      isLeader: true,
      leaderHostname: LOCAL_HOSTNAME,
      lastHeartbeat: newState.lastHeartbeat,
      message: `Máy này (${LOCAL_HOSTNAME}) đang giữ vai trò LEADER chính thức.`
    };
  }

  // Trường hợp 3: Máy khác đang là Leader và VẪN CÒN HOẠT ĐỘNG (Heartbeat < 15 phút)
  if (currentLeader && currentLeader !== LOCAL_HOSTNAME && isHeartbeatFresh) {
    const minutesLeft = Math.max(1, Math.round((LEADER_TIMEOUT_MS - timeSinceHeartbeat) / 60000));
    return {
      canPublish: false,
      isLeader: false,
      leaderHostname: currentLeader,
      lastHeartbeat: state.lastHeartbeat,
      message: `Máy [${currentLeader}] đang là Leader hoạt động tốt (Heartbeat cách đây ${Math.round(timeSinceHeartbeat/1000)}s). Máy này (${LOCAL_HOSTNAME}) đang ở chế độ STANDBY dự phòng.`
    };
  }

  // Trường hợp 4: Máy kia BỊ SẬP HOẶC QUÁ HẠN 15 PHÚT (Failover Trigger)
  // Tự động thăng cấp máy này làm Leader!
  console.log(`[Cluster] 🚨 Phát hiện máy Leader cũ [${currentLeader || 'NONE'}] mất tín hiệu (${Math.round(timeSinceHeartbeat/60000)} phút). Tự động kích hoạt Failover sang ${LOCAL_HOSTNAME}!`);
  
  const newState = {
    leaderHostname: LOCAL_HOSTNAME,
    lastHeartbeat: new Date().toISOString(),
    failoverAt: new Date().toISOString(),
    previousLeader: currentLeader,
    note: `Auto failover to ${LOCAL_HOSTNAME} because ${currentLeader} timed out.`
  };
  await updateCoordinatorState(newState);

  return {
    canPublish: true,
    isLeader: true,
    leaderHostname: LOCAL_HOSTNAME,
    lastHeartbeat: newState.lastHeartbeat,
    message: `Máy [${currentLeader}] đã ngừng phản hồi. Máy này (${LOCAL_HOSTNAME}) đã tự động thăng cấp thành LEADER thay thế!`
  };
}

module.exports = {
  COORDINATOR_PAGE_ID,
  LEADER_TIMEOUT_MS,
  LOCAL_HOSTNAME,
  fetchCoordinatorState,
  updateCoordinatorState,
  checkClusterRole
};
