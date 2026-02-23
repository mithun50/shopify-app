const fs = require('fs-extra');
const path = require('path');
const { createSolidPNG, hexToRgb } = require('../png');
const { createDefaultLogoPNG } = require('../logo');
const { copyAsPng } = require('../imgutil');

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
    'ShopifyApp/NotificationHelper.swift',
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

  // Create 1024x1024 placeholder icon
  const { r, g, b } = hexToRgb(config.themeColor);
  const iconDir = path.join(iosDir, 'ShopifyApp', 'Assets.xcassets', 'AppIcon.appiconset');
  await fs.ensureDir(iconDir);
  await fs.writeFile(path.join(iconDir, 'icon-1024.png'), createSolidPNG(1024, 1024, r, g, b));

  // Create SplashLogo imageset
  const splashDir = path.join(iosDir, 'ShopifyApp', 'Assets.xcassets', 'SplashLogo.imageset');
  await fs.ensureDir(splashDir);

  if (config.logoPath && await fs.pathExists(config.logoPath)) {
    await copyAsPng(config.logoPath, path.join(splashDir, 'splash_logo.png'));
    await fs.writeJson(path.join(splashDir, 'Contents.json'), {
      images: [
        { idiom: 'universal', filename: 'splash_logo.png', scale: '1x' },
        { idiom: 'universal', scale: '2x' },
        { idiom: 'universal', scale: '3x' }
      ],
      info: { version: 1, author: 'xcode' }
    }, { spaces: 2 });
  } else {
    // Generate default shopping bag logo from SVG → PNG
    await fs.writeFile(path.join(splashDir, 'splash_logo.png'), createDefaultLogoPNG(512));
    await fs.writeJson(path.join(splashDir, 'Contents.json'), {
      images: [
        { idiom: 'universal', filename: 'splash_logo.png', scale: '1x' },
        { idiom: 'universal', scale: '2x' },
        { idiom: 'universal', scale: '3x' }
      ],
      info: { version: 1, author: 'xcode' }
    }, { spaces: 2 });
  }
}

module.exports = { generateIosProject };
