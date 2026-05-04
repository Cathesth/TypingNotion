const { originFromReq, signedJson } = require('../../_qa');

module.exports = async function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.statusCode = 500;
    res.end('GITHUB_CLIENT_ID is not configured');
    return;
  }

  const origin = originFromReq(req);
  const returnTo = String(req.query.returnTo || '/');
  const safeReturnTo = returnTo.startsWith('/') ? returnTo : '/';
  const state = signedJson({ returnTo: safeReturnTo, exp: Date.now() + 1000 * 60 * 10 });
  const redirectUri = `${origin}/api/auth/github/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user',
    state
  });

  res.statusCode = 302;
  res.setHeader('Location', `https://github.com/login/oauth/authorize?${params}`);
  res.end();
};
