'use strict';

const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const { execSync } = require('child_process');
const zlib = require('zlib');
const {
  getAuthenticatedUser,
  createRepo,
  repoExists,
  getWorkflowRuns,
  getWorkflowRun,
  getRunArtifacts,
  downloadArtifact,
} = require('./github');
const { loadConfig } = require('./config');

const POLL_INTERVAL = 15000; // 15 seconds
const BUILD_TIMEOUT = 30 * 60 * 1000; // 30 minutes

function step(num, total, msg) {
  console.log(chalk.cyan(`\n  [${num}/${total}] `) + chalk.white(msg));
}

function info(msg) {
  console.log(chalk.gray(`        ${msg}`));
}

function success(msg) {
  console.log(chalk.green(`        ${msg}`));
}

// --- Step 1: Validate project ---
async function stepValidate(ctx) {
  step(1, 6, 'Validate project');

  const outputDir = path.join(ctx.cwd, 'output');
  if (!await fs.pathExists(outputDir)) {
    throw new Error('output/ directory not found. Run "shopify2app init" first.');
  }

  const workflowDir = path.join(outputDir, '.github', 'workflows');
  if (!await fs.pathExists(workflowDir)) {
    throw new Error('No GitHub workflows found in output/.github/workflows/. Run "shopify2app init" first.');
  }

  // Check git is available
  try {
    execSync('git --version', { stdio: 'pipe' });
  } catch {
    throw new Error('git is not installed or not in PATH.');
  }

  // Load app config for naming
  const config = loadConfig();
  if (!config || !config.appName) {
    throw new Error('No app config found. Run "shopify2app init" first.');
  }
  ctx.appName = config.appName;
  ctx.appConfig = config;

  success('Project validated');
  info(`App: ${ctx.appName}`);
}

// --- Step 2: Authenticate ---
async function stepAuthenticate(ctx) {
  step(2, 6, 'Authenticate with GitHub');

  const user = await getAuthenticatedUser(ctx.token);
  ctx.owner = user.login;
  ctx.userName = user.name || user.login;
  ctx.userEmail = user.email || `${user.login}@users.noreply.github.com`;

  success(`Authenticated as ${ctx.userName} (${ctx.owner})`);
}

// --- Step 3: Create repo ---
async function stepCreateRepo(ctx) {
  step(3, 6, 'Create GitHub repository');

  const repoName = ctx.repoName;
  const exists = await repoExists(ctx.token, ctx.owner, repoName);

  if (exists) {
    info(`Repository ${ctx.owner}/${repoName} already exists, reusing`);
  } else {
    const isPrivate = !ctx.isPublic;
    await createRepo(ctx.token, repoName, isPrivate);
    success(`Created ${isPrivate ? 'private' : 'public'} repository: ${ctx.owner}/${repoName}`);
  }

  ctx.repoFullName = `${ctx.owner}/${repoName}`;
}

// --- Step 4: Push code ---
async function stepPushCode(ctx) {
  step(4, 6, 'Push code to GitHub');

  const outputDir = path.join(ctx.cwd, 'output');
  const stagingDir = path.join(ctx.cwd, '.build-staging');

  // Clean any previous staging
  await fs.remove(stagingDir);
  await fs.ensureDir(stagingDir);

  try {
    // Copy output/ to staging/output/ (excluding .github)
    const outputContents = await fs.readdir(outputDir);
    for (const item of outputContents) {
      if (item === '.github') continue;
      await fs.copy(path.join(outputDir, item), path.join(stagingDir, 'output', item));
    }

    // Copy output/.github/ to staging/.github/ (root level for GH Actions)
    const ghDir = path.join(outputDir, '.github');
    if (await fs.pathExists(ghDir)) {
      await fs.copy(ghDir, path.join(stagingDir, '.github'));
    }

    // Git init + commit + push
    const repoUrl = `https://${ctx.token}@github.com/${ctx.owner}/${ctx.repoName}.git`;

    const gitOpts = { cwd: stagingDir, stdio: 'pipe' };
    execSync('git init', gitOpts);
    execSync('git checkout -b main', gitOpts);
    execSync(`git config user.email "${ctx.userEmail}"`, gitOpts);
    execSync(`git config user.name "${ctx.userName}"`, gitOpts);
    execSync('git add -A', gitOpts);
    execSync('git commit -m "shopify2app build\n\nCo-Authored-By: Mithun Gowda B <mithungowda.b7411@gmail.com>"', gitOpts);
    execSync(`git remote add origin "${repoUrl}"`, gitOpts);
    execSync('git push --force origin main', gitOpts);

    success('Code pushed to main branch');
    info(`https://github.com/${ctx.owner}/${ctx.repoName}`);
  } finally {
    // Clean up staging dir
    await fs.remove(stagingDir);
  }
}

// --- Step 5: Wait for builds ---
async function stepWaitForBuilds(ctx) {
  step(5, 6, 'Wait for GitHub Actions builds');
  info('Polling every 15s (timeout: 30 min)...');

  const startTime = Date.now();
  let runIds = [];

  // Wait a bit for runs to appear
  await sleep(5000);

  // Find the workflow runs triggered by our push
  while (Date.now() - startTime < BUILD_TIMEOUT) {
    const runsData = await getWorkflowRuns(ctx.token, ctx.owner, ctx.repoName);
    const runs = runsData.workflow_runs || [];

    // Find runs that started after we pushed (within last 2 minutes)
    const recentRuns = runs.filter(r => {
      const created = new Date(r.created_at).getTime();
      return created > startTime - 120000;
    });

    if (recentRuns.length > 0) {
      runIds = recentRuns.map(r => r.id);
      break;
    }

    info('Waiting for builds to start...');
    await sleep(POLL_INTERVAL);
  }

  if (runIds.length === 0) {
    throw new Error('No workflow runs detected. Check your GitHub Actions workflows.');
  }

  info(`Found ${runIds.length} workflow run(s)`);

  // Poll until all runs complete
  const completedRuns = [];
  while (Date.now() - startTime < BUILD_TIMEOUT) {
    let allDone = true;
    for (const runId of runIds) {
      const run = await getWorkflowRun(ctx.token, ctx.owner, ctx.repoName, runId);
      const name = run.name || `Run #${runId}`;

      if (run.status === 'completed') {
        if (!completedRuns.find(r => r.id === runId)) {
          completedRuns.push(run);
          const icon = run.conclusion === 'success' ? chalk.green('done') : chalk.red(run.conclusion);
          info(`${name}: ${icon}`);
        }
      } else {
        allDone = false;
        info(`${name}: ${run.status}...`);
      }
    }

    if (allDone) break;
    await sleep(POLL_INTERVAL);
  }

  if (completedRuns.length < runIds.length) {
    throw new Error('Build timed out after 30 minutes.');
  }

  // Store successful run IDs for artifact download
  ctx.completedRuns = completedRuns;

  const successCount = completedRuns.filter(r => r.conclusion === 'success').length;
  const failCount = completedRuns.length - successCount;

  if (successCount > 0) {
    success(`${successCount} build(s) completed successfully`);
  }
  if (failCount > 0) {
    console.log(chalk.yellow(`        ${failCount} build(s) failed — artifacts from successful builds will still be downloaded`));
  }
}

// --- Step 6: Download artifacts ---
async function stepDownloadArtifacts(ctx) {
  step(6, 6, 'Download build artifacts');

  await fs.ensureDir(ctx.outputPath);

  let downloadCount = 0;

  for (const run of ctx.completedRuns) {
    if (run.conclusion !== 'success') continue;

    const artifactsData = await getRunArtifacts(ctx.token, ctx.owner, ctx.repoName, run.id);
    const artifacts = artifactsData.artifacts || [];

    for (const artifact of artifacts) {
      if (artifact.expired) continue;

      info(`Downloading ${artifact.name}...`);

      try {
        const zipBuffer = await downloadArtifact(ctx.token, ctx.owner, ctx.repoName, artifact.id);
        const filename = getArtifactFilename(artifact.name, ctx.appName);
        const extracted = extractSingleFile(zipBuffer);

        if (extracted) {
          const destPath = path.join(ctx.outputPath, filename);
          await fs.writeFile(destPath, extracted.data);
          success(`Saved: ${filename} (${formatSize(extracted.data.length)})`);
          downloadCount++;
        } else {
          // Save raw zip if extraction fails
          const destPath = path.join(ctx.outputPath, `${artifact.name}.zip`);
          await fs.writeFile(destPath, zipBuffer);
          success(`Saved: ${artifact.name}.zip (${formatSize(zipBuffer.length)})`);
          downloadCount++;
        }
      } catch (err) {
        console.log(chalk.yellow(`        Failed to download ${artifact.name}: ${err.message}`));
      }
    }
  }

  if (downloadCount === 0) {
    console.log(chalk.yellow('        No artifacts found. Builds may have failed or produced no outputs.'));
  } else {
    success(`${downloadCount} artifact(s) saved to ${ctx.outputPath}`);
  }
}

// --- Zip extraction (no external deps) ---
function extractSingleFile(zipBuffer) {
  // Parse from the central directory (at end of zip) to get accurate sizes
  // This handles zips that use data descriptors (sizes=0 in local header)
  if (zipBuffer.length < 22) return null;

  // Find End of Central Directory record (scan from end)
  let eocdOffset = -1;
  for (let i = zipBuffer.length - 22; i >= Math.max(0, zipBuffer.length - 65557); i--) {
    if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return null;

  const centralDirOffset = zipBuffer.readUInt32LE(eocdOffset + 16);
  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  if (totalEntries === 0) return null;

  // Read first non-directory entry from central directory
  let offset = centralDirOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (offset + 46 > zipBuffer.length) return null;
    if (zipBuffer.readUInt32LE(offset) !== 0x02014b50) return null;

    const compressionMethod = zipBuffer.readUInt16LE(offset + 10);
    const compressedSize = zipBuffer.readUInt32LE(offset + 20);
    const uncompressedSize = zipBuffer.readUInt32LE(offset + 24);
    const fileNameLen = zipBuffer.readUInt16LE(offset + 28);
    const extraFieldLen = zipBuffer.readUInt16LE(offset + 30);
    const commentLen = zipBuffer.readUInt16LE(offset + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(offset + 42);

    const fileName = zipBuffer.slice(offset + 46, offset + 46 + fileNameLen).toString('utf-8');

    // Skip directories
    if (fileName.endsWith('/') || (compressedSize === 0 && uncompressedSize === 0)) {
      offset += 46 + fileNameLen + extraFieldLen + commentLen;
      continue;
    }

    // Read data from local file header position
    const localFnLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFnLen + localExtraLen;
    const compressedData = zipBuffer.slice(dataStart, dataStart + compressedSize);

    let data;
    if (compressionMethod === 0) {
      data = compressedData;
    } else if (compressionMethod === 8) {
      try {
        data = zlib.inflateRawSync(compressedData);
      } catch {
        data = compressedData;
      }
    } else {
      data = compressedData;
    }

    return { name: fileName, data: data };
  }

  return null;
}

function getArtifactFilename(artifactName, appName) {
  const safeName = appName.replace(/[^a-zA-Z0-9_-]/g, '');
  const lowerName = artifactName.toLowerCase();

  if (lowerName.includes('release-bundle') || lowerName.includes('release-aab')) {
    return `${safeName}-release.aab`;
  }
  if (lowerName.includes('release-signed')) {
    return `${safeName}-release-signed.apk`;
  }
  if (lowerName.includes('release')) {
    return `${safeName}-release.apk`;
  }
  if (lowerName.includes('debug')) {
    return `${safeName}-debug.apk`;
  }
  if (lowerName.includes('ios') || lowerName.includes('archive')) {
    return `${safeName}-ios.xcarchive.zip`;
  }
  // Fallback
  return `${safeName}-${artifactName}`;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Main entry point ---
async function runBuild(options) {
  console.log(chalk.bold.cyan('\n  Shopify2App — Cloud Build\n'));

  const ctx = {
    cwd: process.cwd(),
    token: options.token,
    repoName: options.repo,
    isPublic: options.isPublic || false,
    outputPath: path.resolve(options.output || './builds'),
    appName: null,
    appConfig: null,
    owner: null,
    repoFullName: null,
    completedRuns: [],
  };

  try {
    await stepValidate(ctx);

    // Use repo name from option or derive from app name
    if (!ctx.repoName) {
      ctx.repoName = ctx.appName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (!ctx.repoName) ctx.repoName = 'shopify2app-build';
    }

    await stepAuthenticate(ctx);
    await stepCreateRepo(ctx);
    await stepPushCode(ctx);
    await stepWaitForBuilds(ctx);
    await stepDownloadArtifacts(ctx);

    console.log(chalk.green.bold('\n  Build complete!\n'));
    console.log(chalk.white(`  Artifacts: ${ctx.outputPath}`));
    console.log(chalk.white(`  Repo:      https://github.com/${ctx.repoFullName}`));
    console.log('');
  } catch (err) {
    console.log(chalk.red(`\n  Error: ${err.message}\n`));
    process.exit(1);
  }
}

module.exports = { runBuild };
