const { REPO, WORKFLOW, getSession, githubFetch, json } = require('../_qa');

function reportUrl(owner, repo) {
  return process.env.QA_REPORT_URL || `https://${owner}.github.io/${repo}/`;
}

async function getRun(owner, repo, runId) {
  const response = await githubFetch(`/repos/${owner}/${repo}/actions/runs/${runId}`);
  return response.json();
}

async function findRecentRun(owner, repo, since) {
  const response = await githubFetch(`/repos/${owner}/${repo}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=10`);
  const data = await response.json();
  const minTime = Number(since || 0) - 30_000;
  return (data.workflow_runs || []).find(run => !minTime || new Date(run.created_at).getTime() >= minTime) || null;
}

async function getJobs(owner, repo, runId) {
  const response = await githubFetch(`/repos/${owner}/${repo}/actions/runs/${runId}/jobs?per_page=20`);
  const data = await response.json();
  return data.jobs || [];
}

function summarizeJobs(jobs) {
  const failed = [];
  for (const job of jobs) {
    const badSteps = (job.steps || []).filter(step =>
      ['failure', 'cancelled', 'timed_out'].includes(step.conclusion)
    );
    if (['failure', 'cancelled', 'timed_out'].includes(job.conclusion) || badSteps.length) {
      failed.push({
        name: job.name,
        conclusion: job.conclusion,
        steps: badSteps.slice(0, 4).map(step => ({
          name: step.name,
          conclusion: step.conclusion,
          number: step.number
        }))
      });
    }
  }
  return failed.slice(0, 4);
}

module.exports = async function handler(req, res) {
  const session = getSession(req);
  if (!session) {
    json(res, 401, { error: 'GitHub login required' });
    return;
  }

  try {
    const [owner, repo] = REPO.split('/');
    const query = req.query || {};
    const run = query.runId
      ? await getRun(owner, repo, encodeURIComponent(String(query.runId)))
      : await findRecentRun(owner, repo, Number(query.since || 0));

    if (!run) {
      json(res, 200, {
        found: false,
        status: 'queued',
        conclusion: null,
        message: 'GitHub Actions 실행 생성 대기 중입니다.'
      });
      return;
    }

    const jobs = run.id ? await getJobs(owner, repo, run.id) : [];
    json(res, 200, {
      found: true,
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      name: run.name,
      htmlUrl: run.html_url,
      reportUrl: reportUrl(owner, repo),
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      jobs: jobs.map(job => ({
        name: job.name,
        status: job.status,
        conclusion: job.conclusion
      })),
      failures: summarizeJobs(jobs)
    });
  } catch (error) {
    json(res, 500, { error: error.message || 'Could not read QA status' });
  }
};
