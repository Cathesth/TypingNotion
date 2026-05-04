const crypto = require('crypto');

const REPO = process.env.GITHUB_REPO || 'Cathesth/TypingNotion';
const WORKFLOW = process.env.QA_WORKFLOW_FILE || 'playwright.yml';
const SESSION_COOKIE = 'tn_qa_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function unbase64url(input) {
  return Buffer.from(input, 'base64url').toString();
}

function secret() {
  return process.env.QA_SESSION_SECRET || process.env.GITHUB_CLIENT_SECRET || 'dev-secret-change-me';
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function signedJson(payload) {
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function readSignedJson(value) {
  if (!value || !value.includes('.')) return null;
  const [body, sig] = value.split('.');
  if (sign(body) !== sig) return null;
  try { return JSON.parse(unbase64url(body)); }
  catch { return null; }
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(raw.split(';').map(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return ['', ''];
    return [part.slice(0, idx).trim(), decodeURIComponent(part.slice(idx + 1))];
  }).filter(([key]) => key));
}

function cookie(name, value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function originFromReq(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function getSession(req) {
  const payload = readSignedJson(parseCookies(req)[SESSION_COOKIE]);
  if (!payload || !payload.login || !payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

function sessionCookie(login) {
  return cookie(SESSION_COOKIE, signedJson({ login, exp: Date.now() + SESSION_TTL_MS }), SESSION_TTL_MS / 1000);
}

function allowedUsers() {
  return (process.env.QA_ALLOWED_USERS || '')
    .split(',')
    .map(user => user.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowed(login) {
  const users = allowedUsers();
  return users.length > 0 && users.includes(String(login || '').toLowerCase());
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function githubFetch(path, options = {}) {
  const token = process.env.GITHUB_ACTIONS_TOKEN;
  if (!token) throw new Error('GITHUB_ACTIONS_TOKEN is not configured');
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text}`);
  }
  return response;
}

module.exports = {
  REPO,
  WORKFLOW,
  SESSION_COOKIE,
  clearCookie,
  cookie,
  getSession,
  githubFetch,
  isAllowed,
  json,
  originFromReq,
  readSignedJson,
  sessionCookie,
  signedJson
};
