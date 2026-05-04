const { isAllowed, originFromReq, readSignedJson, sessionCookie } = require('../../_qa');

async function exchangeCode(code, redirectUri) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'GitHub OAuth failed');
  }
  return data.access_token;
}

async function fetchUser(token) {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  const data = await response.json();
  if (!response.ok || !data.login) throw new Error('Could not read GitHub user');
  return data;
}

module.exports = async function handler(req, res) {
  try {
    const state = readSignedJson(String(req.query.state || ''));
    if (!state || !state.exp || state.exp < Date.now()) throw new Error('Invalid OAuth state');

    const origin = originFromReq(req);
    const redirectUri = `${origin}/api/auth/github/callback`;
    const token = await exchangeCode(String(req.query.code || ''), redirectUri);
    const user = await fetchUser(token);

    if (!isAllowed(user.login)) {
      res.statusCode = 302;
      res.setHeader('Location', `${state.returnTo}${state.returnTo.includes('?') ? '&' : '?'}qa_error=not_allowed`);
      res.end();
      return;
    }

    res.statusCode = 302;
    res.setHeader('Set-Cookie', sessionCookie(user.login));
    res.setHeader('Location', `${state.returnTo}${state.returnTo.includes('?') ? '&' : '?'}qa_auth=ok`);
    res.end();
  } catch (error) {
    res.statusCode = 302;
    res.setHeader('Location', `/?qa_error=${encodeURIComponent(error.message)}`);
    res.end();
  }
};
