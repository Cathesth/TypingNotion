const { REPO, WORKFLOW, getSession, githubFetch, json } = require('../_qa');

const ALLOWED_TARGETS = new Set(['prod', 'beta', 'both']);

async function getRecentRuns(owner, repo) {
  const response = await githubFetch(`/repos/${owner}/${repo}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=5`);
  return response.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' });
    return;
  }

  const session = getSession(req);
  if (!session) {
    json(res, 401, { error: 'GitHub login required' });
    return;
  }

  try {
    let body = req.body;
    if (!body) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = chunks.length ? Buffer.concat(chunks).toString('utf8') : '{}';
    }
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    const target = String(body.target || 'both');
    if (!ALLOWED_TARGETS.has(target)) {
      json(res, 400, { error: 'Invalid target' });
      return;
    }

    const [owner, repo] = REPO.split('/');
    const recent = await getRecentRuns(owner, repo);
    const activeRun = (recent.workflow_runs || []).find(run => run.status === 'queued' || run.status === 'in_progress');
    if (activeRun) {
      json(res, 409, {
        error: '이미 QA가 실행 중입니다. 현재 실행이 끝난 뒤 다시 시도하세요.',
        actionsUrl: activeRun.html_url
      });
      return;
    }

    await githubFetch(`/repos/${owner}/${repo}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: process.env.QA_WORKFLOW_REF || 'beta',
        inputs: {
          target,
          actor: session.login
        }
      })
    });

    json(res, 200, {
      ok: true,
      target,
      actionsUrl: `https://github.com/${REPO}/actions/workflows/${WORKFLOW}`,
      reportUrl: process.env.QA_REPORT_URL || `https://${owner}.github.io/${repo}/`
    });
  } catch (error) {
    json(res, 500, { error: error.message || 'Could not start QA run' });
  }
};
