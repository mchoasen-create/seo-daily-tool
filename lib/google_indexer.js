const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const BASE_DIR = process.pkg ? process.cwd() : path.join(__dirname, '..');
const KEY_FILE = path.join(BASE_DIR, 'data/google_indexing_key.json');
const INDEX_HISTORY_FILE = path.join(BASE_DIR, 'data/google_indexing_history.json');

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Get Google OAuth2 access token for Indexing API using Service Account JWT
 */
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && tokenExpiresAt > now + 60) {
    return cachedToken;
  }

  if (!fs.existsSync(KEY_FILE)) {
    throw new Error('Chưa cấu hình file data/google_indexing_key.json');
  }

  const keyData = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));

  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: keyData.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: keyData.token_uri || 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
  const unsignedToken = `${encodedHeader}.${encodedClaimSet}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();

  const signature = signer.sign(keyData.private_key);
  const encodedSignature = base64UrlEncode(signature);
  const jwt = `${unsignedToken}.${encodedSignature}`;

  const params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt
  });

  const res = await fetch(keyData.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Lỗi Google OAuth2: ${JSON.stringify(data)}`);
  }

  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600);
  return cachedToken;
}

/**
 * Send URL to Google Indexing API
 * @param {string} url - Target URL to index
 * @param {string} type - 'URL_UPDATED' or 'URL_DELETED'
 */
async function notifyGoogleIndex(url, type = 'URL_UPDATED') {
  try {
    const token = await getAccessToken();
    const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url, type })
    });

    const data = await res.json();
    const record = {
      url,
      type,
      status: res.status,
      success: res.ok,
      timestamp: new Date().toISOString(),
      response: data
    };

    saveIndexRecord(record);
    return record;
  } catch (err) {
    const record = {
      url,
      type,
      status: 500,
      success: false,
      timestamp: new Date().toISOString(),
      error: err.message
    };
    saveIndexRecord(record);
    return record;
  }
}

function saveIndexRecord(record) {
  try {
    let history = [];
    if (fs.existsSync(INDEX_HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(INDEX_HISTORY_FILE, 'utf8') || '[]');
    }
    history.unshift(record);
    if (history.length > 500) history = history.slice(0, 500);
    fs.writeFileSync(INDEX_HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
  } catch (e) {}
}

function getIndexStatus() {
  const isConfigured = fs.existsSync(KEY_FILE);
  let history = [];
  try {
    if (fs.existsSync(INDEX_HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(INDEX_HISTORY_FILE, 'utf8') || '[]');
    }
  } catch (e) {}

  return {
    isConfigured,
    totalPushed: history.length,
    successCount: history.filter(h => h.success).length,
    recentPushes: history.slice(0, 10)
  };
}

module.exports = {
  notifyGoogleIndex,
  getIndexStatus,
  getAccessToken
};
