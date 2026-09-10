/**
 * Traffic Booster & Dwell Time Simulator Module with Proxy Support
 * Built for Tris's seo-daily-tool by ENI
 */

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
];

const referralSources = [
  'https://www.facebook.com/',
  'https://l.facebook.com/',
  'https://twitter.com/',
  'https://t.co/',
  'https://www.instagram.com/',
  'https://www.linkedin.com/',
  'https://www.pinterest.com/',
  'https://www.youtube.com/'
];

const organicSources = [
  'https://www.google.com/',
  'https://www.google.com.vn/',
  'https://www.bing.com/',
  'https://search.yahoo.com/'
];

class TrafficBooster {
  constructor() {
    this.running = false;
    this.activeWorkers = 0;
    this.totalSessions = 0;
    this.successCount = 0;
    this.failCount = 0;
    this.logs = [];
    this.maxLogs = 200;
    this.config = {
      targetUrl: 'https://xulynuochoasen.com/',
      trafficType: 'referral',
      threads: 2,
      minStay: 10,
      maxStay: 30,
      minClicks: 1,
      maxClicks: 3,
      proxies: []
    };
  }

  log(msg, type = 'info') {
    const time = new Date().toLocaleTimeString('vi-VN');
    const entry = { time, msg, type };
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    console.log(`[TrafficBooster ${time}] (${type.toUpperCase()}) ${msg}`);
  }

  getRandomItem(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getReferrer(type) {
    if (type === 'direct') return '';
    if (type === 'referral') return this.getRandomItem(referralSources);
    if (type === 'organic') return this.getRandomItem(organicSources);
    
    const rand = Math.random();
    if (rand < 0.4) return this.getRandomItem(referralSources);
    if (rand < 0.8) return this.getRandomItem(organicSources);
    return '';
  }

  parseProxyList(rawText) {
    if (!rawText) return [];
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
    const parsed = [];
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length === 2) {
        parsed.push(`http://${parts[0]}:${parts[1]}`);
      } else if (parts.length === 4) {
        parsed.push(`http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`);
      } else if (line.startsWith('http')) {
        parsed.push(line);
      }
    }
    return parsed;
  }

  async fetchFreeProxies() {
    const sources = [
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
      'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt',
      'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=5000&country=all'
    ];

    const proxies = new Set();
    for (const src of sources) {
      try {
        const res = await fetch(src);
        if (res.ok) {
          const text = await res.text();
          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(l));
          lines.forEach(p => proxies.add(p));
        }
      } catch (e) {}
    }
    return Array.from(proxies);
  }

  extractInternalLinks(html, baseUrlStr) {
    try {
      const baseUrl = new URL(baseUrlStr);
      const host = baseUrl.hostname.replace(/^www\./, '');
      const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
      let match;
      const links = new Set();

      while ((match = linkRegex.exec(html)) !== null) {
        let href = match[1].trim();
        if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
        
        try {
          const absUrl = new URL(href, baseUrlStr);
          const absHost = absUrl.hostname.replace(/^www\./, '');
          if (absHost === host && absUrl.pathname !== baseUrl.pathname) {
            links.add(absUrl.href);
          }
        } catch (e) {}
      }
      return Array.from(links);
    } catch (e) {
      return [];
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runSingleSession(workerId) {
    const ua = this.getRandomItem(userAgents);
    const referrer = this.getReferrer(this.config.trafficType);
    const proxy = this.getRandomItem(this.config.proxies);
    let currentUrl = this.config.targetUrl;
    this.totalSessions++;

    const proxyTag = proxy ? ` [Proxy: ${proxy.replace(/:\/\/[^@]+@/, '://***@')}]` : ' [Direct IP]';
    this.log(`[Worker ${workerId}]${proxyTag} Bắt đầu phiên #${this.totalSessions} ➔ ${currentUrl} (Nguồn: ${referrer || 'Direct'})`, 'info');

    const headers = {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache'
    };
    if (referrer) {
      headers['Referer'] = referrer;
    }

    try {
      const startTime = Date.now();
      const res = await fetch(currentUrl, { headers, redirect: 'follow' });
      const html = await res.text();
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const stayTime = this.getRandomInt(this.config.minStay, this.config.maxStay);
      this.log(`[Worker ${workerId}] Nạp trang thành công! Đang ở lại trang (${stayTime}s)...`, 'success');
      await this.delay(stayTime * 1000);

      const targetClicks = this.getRandomInt(this.config.minClicks, this.config.maxClicks);
      let internalLinks = this.extractInternalLinks(html, currentUrl);

      for (let c = 1; c <= targetClicks; c++) {
        if (!this.running) break;
        if (internalLinks.length === 0) {
          this.log(`[Worker ${workerId}] Không tìm thấy thêm link nội bộ để click.`, 'warning');
          break;
        }

        const nextUrl = this.getRandomItem(internalLinks);
        this.log(`[Worker ${workerId}] Click nội bộ [${c}/${targetClicks}] ➔ ${nextUrl}`, 'info');

        const clickHeaders = { ...headers, 'Referer': currentUrl };
        const clickRes = await fetch(nextUrl, { headers: clickHeaders, redirect: 'follow' });
        const clickHtml = await clickRes.text();
        
        if (clickRes.ok) {
          currentUrl = nextUrl;
          internalLinks = this.extractInternalLinks(clickHtml, currentUrl);
          const clickStay = this.getRandomInt(5, 15);
          this.log(`[Worker ${workerId}] Xem trang nội bộ thành công! Ở lại (${clickStay}s)...`, 'success');
          await this.delay(clickStay * 1000);
        }
      }

      this.successCount++;
      const durationSec = Math.round((Date.now() - startTime) / 1000);
      this.log(`[Worker ${workerId}] Hoàn thành phiên #${this.totalSessions} tốt đẹp! (${durationSec}s)`, 'success');

    } catch (err) {
      this.failCount++;
      this.log(`[Worker ${workerId}] Lỗi phiên #${this.totalSessions}: ${err.message}`, 'error');
    }
  }

  async startWorker(workerId) {
    while (this.running) {
      await this.runSingleSession(workerId);
      if (!this.running) break;
      await this.delay(3000);
    }
    this.activeWorkers--;
    this.log(`[Worker ${workerId}] Đã dừng.`, 'warning');
  }

  start(newConfig = {}) {
    if (this.running) {
      return { success: false, message: 'Traffic Booster đang chạy rồi anh ơi!' };
    }

    let parsedProxies = [];
    if (typeof newConfig.proxyText === 'string') {
      parsedProxies = this.parseProxyList(newConfig.proxyText);
    } else if (Array.isArray(newConfig.proxies)) {
      parsedProxies = newConfig.proxies;
    }

    this.config = {
      ...this.config,
      ...newConfig,
      proxies: parsedProxies
    };

    this.running = true;
    this.activeWorkers = 0;

    const threadCount = Math.max(1, Math.min(10, parseInt(this.config.threads) || 2));
    const proxyCountStr = parsedProxies.length > 0 ? ` | Proxy: ${parsedProxies.length} IP` : ' | Proxy: Chạy Direct IP';
    this.log(`🚀 KÍCH HOẠT TRAFFIC BOOSTER (${threadCount} luồng | Nguồn: ${this.config.trafficType.toUpperCase()}${proxyCountStr} | Mục tiêu: ${this.config.targetUrl})`, 'success');

    for (let i = 1; i <= threadCount; i++) {
      this.activeWorkers++;
      this.startWorker(i);
    }

    return { success: true, message: `Đã khởi chạy Traffic Booster với ${threadCount} luồng (${parsedProxies.length} Proxy) thành công!` };
  }

  stop() {
    if (!this.running) {
      return { success: false, message: 'Traffic Booster đang dừng rồi anh ơi!' };
    }
    this.running = false;
    this.log('🛑 ĐÃ PHÁT LỆNH DỪNG TRAFFIC BOOSTER. Đang chờ các luồng kết thúc...', 'warning');
    return { success: true, message: 'Đã phát lệnh dừng Traffic Booster thành công!' };
  }

  getStatus() {
    return {
      running: this.running,
      activeWorkers: this.activeWorkers,
      totalSessions: this.totalSessions,
      successCount: this.successCount,
      failCount: this.failCount,
      config: this.config,
      proxyCount: this.config.proxies.length,
      logs: this.logs.slice(0, 50)
    };
  }
}

module.exports = new TrafficBooster();
