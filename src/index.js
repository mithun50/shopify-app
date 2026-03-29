const path = require('path');
const chalk = require('chalk');
const { generateAndroidProject } = require('./generators/android');
const { generateIosProject } = require('./generators/ios');
const { normalizeUrl } = require('./config');

async function generateProject(config) {
  const outputDir = path.join(process.cwd(), 'output');
  const normalizedConfig = {
    ...config,
    storeUrl: normalizeUrl(config.storeUrl)
  };

  console.log(chalk.cyan('  Generating Android project...'));
  await generateAndroidProject(normalizedConfig, outputDir);
  console.log(chalk.green('  Android project generated.'));

  console.log(chalk.cyan('  Generating iOS project...'));
  await generateIosProject(normalizedConfig, outputDir);
  console.log(chalk.green('  iOS project generated.'));

  console.log(chalk.cyan('  Generating GitHub Actions workflows...'));
  await generateWorkflows(outputDir);
  console.log(chalk.green('  Workflows generated.'));

  // Generate .gitignore for the output directory
  const fs = require('fs-extra');
  const gitignoreContent = [
    '# Build outputs',
    'android/app/build/',
    'android/.gradle/',
    'android/build/',
    'ios/build/',
    'ios/DerivedData/',
    '',
    '# IDE',
    '.idea/',
    '*.iml',
    '*.xcworkspace/',
    'xcuserdata/',
    '*.xcuserdatad/',
    '',
    '# OS',
    '.DS_Store',
    'Thumbs.db',
    '',
    '# Signing',
    '*.jks',
    '*.keystore',
    '',
  ].join('\n');
  await fs.writeFile(path.join(outputDir, '.gitignore'), gitignoreContent, 'utf-8');

  // Generate README.md from template
  await generateReadme(normalizedConfig, outputDir);
}

async function generateReadme(config, outputDir) {
  const fs = require('fs-extra');
  const templatePath = path.join(__dirname, '..', 'templates', 'README.md');
  if (!await fs.pathExists(templatePath)) return;

  let content = await fs.readFile(templatePath, 'utf-8');
  const notificationsStatus = config.fcmEnabled ? 'FCM (Firebase) + Local' : 'Local only';

  content = content
    .replace(/\{\{APP_NAME\}\}/g, config.appName)
    .replace(/\{\{STORE_URL\}\}/g, config.storeUrl)
    .replace(/\{\{PACKAGE_NAME\}\}/g, config.packageName)
    .replace(/\{\{THEME_COLOR\}\}/g, config.themeColor)
    .replace(/\{\{NOTIFICATIONS_STATUS\}\}/g, notificationsStatus);

  await fs.writeFile(path.join(outputDir, 'README.md'), content, 'utf-8');
}

async function generateWorkflows(outputDir) {
  const fs = require('fs-extra');
  const templatesDir = path.join(__dirname, '..', 'templates');

  const workflowsSource = path.join(templatesDir, '.github', 'workflows');
  const workflowsDest = path.join(outputDir, '.github', 'workflows');

  await fs.ensureDir(workflowsDest);
  await fs.copy(workflowsSource, workflowsDest);
}

module.exports = { generateProject };
