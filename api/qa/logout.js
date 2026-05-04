const { SESSION_COOKIE, clearCookie, json } = require('../_qa');

module.exports = async function handler(req, res) {
  res.setHeader('Set-Cookie', clearCookie(SESSION_COOKIE));
  json(res, 200, { ok: true });
};
