const { getSession, json } = require('../_qa');

module.exports = async function handler(req, res) {
  const session = getSession(req);
  json(res, 200, { authenticated: !!session, user: session?.login || null });
};
