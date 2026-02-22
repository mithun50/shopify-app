const fs = require('fs-extra');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, '..', '..', 'templates', 'ios');

function replacePlaceholders(content, config) {
  const storeHost = new URL(config.storeUrl).hostname;

  return content
    .replace(/\{\{APP_NAME\}\}/g, config.appName)
    .replace(/\{\{STORE_URL\}\}/g, config.storeUrl)
    .replace(/\{\{STORE_HOST\}\}/g, storeHost)
    .replace(/\{\{PACKAGE_NAME\}\}/g, config.packageName)
    .replace(/\{\{THEME_COLOR\}\}/g, config.themeColor);
}

async function generateIosProject(config, outputDir) {
  const iosDir = path.join(outputDir, 'ios');
  await fs.ensureDir(iosDir);

  const filesToProcess = [
    'ShopifyApp/AppDelegate.swift',
    'ShopifyApp/SceneDelegate.swift',
    'ShopifyApp/WebViewController.swift',
    'ShopifyApp/Info.plist',
    'ShopifyApp/LaunchScreen.storyboard',
    'ShopifyApp/Assets.xcassets/Contents.json',
    'ShopifyApp/Assets.xcassets/AppIcon.appiconset/Contents.json',
    'ShopifyApp.xcodeproj/project.pbxproj',
  ];

  for (const file of filesToProcess) {
    const srcPath = path.join(TEMPLATE_DIR, file);

    if (!await fs.pathExists(srcPath)) continue;

    let content = await fs.readFile(srcPath, 'utf-8');
    content = replacePlaceholders(content, config);

    const destPath = path.join(iosDir, file);
    await fs.ensureDir(path.dirname(destPath));
    await fs.writeFile(destPath, content, 'utf-8');
  }

  // Create a placeholder icon
  const iconDir = path.join(iosDir, 'ShopifyApp', 'Assets.xcassets', 'AppIcon.appiconset');
  await fs.ensureDir(iconDir);
  const iconPath = path.join(iconDir, 'icon-1024.png');
  if (!await fs.pathExists(iconPath)) {
    const placeholderPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    await fs.writeFile(iconPath, placeholderPng);
  }
}

module.exports = { generateIosProject };
