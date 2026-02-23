'use strict';

const https = require('https');

const API_HOST = 'api.github.com';
const USER_AGENT = 'shopify2app-cli';

function githubRequest(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': USER_AGENT,
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const options = {
      hostname: API_HOST,
      path: path,
      method: method,
      headers: headers,
    };

    const req = https.request(options, (res) => {
      // Follow redirects — return location for caller to handle
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        resolve({ statusCode: res.statusCode, data: null, redirect: res.headers.location });
        res.resume();
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString('utf-8');
        let data = null;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
        resolve({ statusCode: res.statusCode, data: data });
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('Request timed out'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function downloadFromUrl(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : require('http');

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
      },
    };

    const req = mod.request(options, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        downloadFromUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data: Buffer.concat(chunks) });
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy(new Error('Download timed out'));
    });
    req.end();
  });
}

async function getAuthenticatedUser(token) {
  const res = await githubRequest('GET', '/user', token);
  if (res.statusCode !== 200) {
    throw new Error(`Authentication failed (HTTP ${res.statusCode}): ${res.data.message || 'Invalid token'}`);
  }
  return res.data;
}

async function createRepo(token, name, isPrivate) {
  const res = await githubRequest('POST', '/user/repos', token, {
    name: name,
    private: isPrivate,
    auto_init: false,
  });
  if (res.statusCode !== 201) {
    throw new Error(`Failed to create repo (HTTP ${res.statusCode}): ${res.data.message || 'Unknown error'}`);
  }
  return res.data;
}

async function repoExists(token, owner, repo) {
  const res = await githubRequest('GET', `/repos/${owner}/${repo}`, token);
  return res.statusCode === 200;
}

async function getWorkflowRuns(token, owner, repo) {
  const res = await githubRequest('GET', `/repos/${owner}/${repo}/actions/runs?event=push&branch=main&per_page=5`, token);
  if (res.statusCode !== 200) {
    throw new Error(`Failed to get workflow runs (HTTP ${res.statusCode}): ${res.data.message || 'Unknown error'}`);
  }
  return res.data;
}

async function getWorkflowRun(token, owner, repo, runId) {
  const res = await githubRequest('GET', `/repos/${owner}/${repo}/actions/runs/${runId}`, token);
  if (res.statusCode !== 200) {
    throw new Error(`Failed to get workflow run (HTTP ${res.statusCode}): ${res.data.message || 'Unknown error'}`);
  }
  return res.data;
}

async function getRunArtifacts(token, owner, repo, runId) {
  const res = await githubRequest('GET', `/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`, token);
  if (res.statusCode !== 200) {
    throw new Error(`Failed to get artifacts (HTTP ${res.statusCode}): ${res.data.message || 'Unknown error'}`);
  }
  return res.data;
}

async function downloadArtifact(token, owner, repo, artifactId) {
  // GitHub returns a 302 redirect to a temporary download URL
  const res = await githubRequest('GET', `/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`, token);
  if (res.redirect) {
    const download = await downloadFromUrl(res.redirect);
    return download.data;
  }
  throw new Error(`Failed to download artifact (HTTP ${res.statusCode}): expected redirect`);
}

module.exports = {
  githubRequest,
  downloadFromUrl,
  getAuthenticatedUser,
  createRepo,
  repoExists,
  getWorkflowRuns,
  getWorkflowRun,
  getRunArtifacts,
  downloadArtifact,
};
