const fs = require('fs-extra');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, '..', '..', 'templates', 'android');

function replacePlaceholders(content, config) {
  const storeHost = new URL(config.storeUrl).hostname;
  const packagePath = config.packageName.replace(/\./g, '/');

  return content
    .replace(/\{\{APP_NAME\}\}/g, config.appName)
    .replace(/\{\{STORE_URL\}\}/g, config.storeUrl)
    .replace(/\{\{STORE_HOST\}\}/g, storeHost)
    .replace(/\{\{PACKAGE_NAME\}\}/g, config.packageName)
    .replace(/\{\{PACKAGE_PATH\}\}/g, packagePath)
    .replace(/\{\{THEME_COLOR\}\}/g, config.themeColor);
}

async function generateAndroidProject(config, outputDir) {
  const androidDir = path.join(outputDir, 'android');
  await fs.ensureDir(androidDir);

  // Process all template files
  const filesToProcess = [
    'app/src/main/AndroidManifest.xml',
    'app/src/main/java/com/shopifyapp/MainActivity.java',
    'app/src/main/java/com/shopifyapp/SplashActivity.java',
    'app/src/main/res/layout/activity_main.xml',
    'app/src/main/res/layout/activity_splash.xml',
    'app/src/main/res/values/strings.xml',
    'app/src/main/res/values/colors.xml',
    'app/src/main/res/values/themes.xml',
    'app/src/main/res/drawable/splash_bg.xml',
    'app/build.gradle',
    'build.gradle',
    'settings.gradle',
    'gradle.properties',
    'gradle/wrapper/gradle-wrapper.properties',
    'app/proguard-rules.pro',
  ];

  for (const file of filesToProcess) {
    const srcPath = path.join(TEMPLATE_DIR, file);

    if (!await fs.pathExists(srcPath)) continue;

    let content = await fs.readFile(srcPath, 'utf-8');
    content = replacePlaceholders(content, config);

    // Remap Java files to correct package directory
    let destFile = file;
    if (file.includes('java/com/shopifyapp/')) {
      const packagePath = config.packageName.replace(/\./g, '/');
      destFile = file.replace('java/com/shopifyapp/', `java/${packagePath}/`);
    }

    const destPath = path.join(androidDir, destFile);
    await fs.ensureDir(path.dirname(destPath));
    await fs.writeFile(destPath, content, 'utf-8');
  }

  // Create a placeholder icon if none exists
  const iconDir = path.join(androidDir, 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi');
  await fs.ensureDir(iconDir);
  const iconPath = path.join(iconDir, 'ic_launcher.png');
  if (!await fs.pathExists(iconPath)) {
    // Create a simple 1x1 pixel placeholder PNG
    const placeholderPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    await fs.writeFile(iconPath, placeholderPng);
  }
}

module.exports = { generateAndroidProject };
