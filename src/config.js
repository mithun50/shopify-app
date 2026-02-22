const fs = require('fs-extra');
const path = require('path');

const CONFIG_FILE = 'app.config.json';

function getConfigPath() {
  return path.join(process.cwd(), CONFIG_FILE);
}

function loadConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return null;
  return fs.readJsonSync(configPath);
}

function saveConfig(config) {
  const configPath = getConfigPath();
  fs.writeJsonSync(configPath, config, { spaces: 2 });
}

function validateShopifyUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

function normalizeUrl(url) {
  if (!url.startsWith('http')) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, '');
}

function getGithubToken() {
  const config = loadConfig();
  return (config && config.githubToken) ? config.githubToken : null;
}

function saveGithubToken(token) {
  let config = loadConfig() || {};
  config.githubToken = token;
  saveConfig(config);
}

module.exports = { loadConfig, saveConfig, validateShopifyUrl, normalizeUrl, getGithubToken, saveGithubToken };
