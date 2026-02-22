const fs = require('fs-extra');
const path = require('path');
const { createSolidPNG, hexToRgb } = require('../png');
const { createDefaultLogoPNG } = require('../logo');

const TEMPLATE_DIR = path.join(__dirname, '..', '..', 'templates', 'android');

function replacePlaceholders(content, config) {
  const storeHost = new URL(config.storeUrl).hostname;
  const packagePath = config.packageName.replace(/\./g, '/');

  // FCM conditional replacements
  const fcmEnabled = config.fcmEnabled || false;
  const fcmPlugin = fcmEnabled ? "id 'com.google.gms.google-services'" : '';
  const fcmDependencies = fcmEnabled
    ? "implementation platform('com.google.firebase:firebase-bom:32.7.0')\n    implementation 'com.google.firebase:firebase-messaging'"
    : '';
  const fcmClasspath = fcmEnabled
    ? "id 'com.google.gms.google-services' version '4.4.0' apply false"
    : '';
  const fcmServiceDeclaration = fcmEnabled
    ? `<service
            android:name=".ShopifyFirebaseMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>`
    : '';

  return content
    .replace(/\{\{APP_NAME\}\}/g, config.appName)
    .replace(/\{\{STORE_URL\}\}/g, config.storeUrl)
    .replace(/\{\{STORE_HOST\}\}/g, storeHost)
    .replace(/\{\{PACKAGE_NAME\}\}/g, config.packageName)
    .replace(/\{\{PACKAGE_PATH\}\}/g, packagePath)
    .replace(/\{\{THEME_COLOR\}\}/g, config.themeColor)
    .replace(/\{\{FCM_PLUGIN\}\}/g, fcmPlugin)
    .replace(/\{\{FCM_DEPENDENCIES\}\}/g, fcmDependencies)
    .replace(/\{\{FCM_CLASSPATH\}\}/g, fcmClasspath)
    .replace(/\{\{FCM_SERVICE_DECLARATION\}\}/g, fcmServiceDeclaration);
}

async function generateAndroidProject(config, outputDir) {
  const androidDir = path.join(outputDir, 'android');
  await fs.ensureDir(androidDir);

  // Process all template files
  const filesToProcess = [
    'app/src/main/AndroidManifest.xml',
    'app/src/main/java/com/shopifyapp/MainActivity.java',
    'app/src/main/java/com/shopifyapp/SplashActivity.java',
    'app/src/main/java/com/shopifyapp/NotificationHelper.java',
    'app/src/main/java/com/shopifyapp/NotificationReceiver.java',
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

  // Conditionally include FCM service when enabled
  if (config.fcmEnabled) {
    filesToProcess.push('app/src/main/java/com/shopifyapp/ShopifyFirebaseMessagingService.java');
  }

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

  // Create placeholder icons at all densities
  const { r, g, b } = hexToRgb(config.themeColor);
  const sizes = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
  ];
  for (const { dir, size } of sizes) {
    const iconDir = path.join(androidDir, 'app', 'src', 'main', 'res', dir);
    await fs.ensureDir(iconDir);
    const iconPath = path.join(iconDir, 'ic_launcher.png');
    await fs.writeFile(iconPath, createSolidPNG(size, size, r, g, b));
  }

  // Create splash_logo drawable
  const drawableDir = path.join(androidDir, 'app', 'src', 'main', 'res', 'drawable');
  await fs.ensureDir(drawableDir);
  if (config.logoPath && await fs.pathExists(config.logoPath)) {
    await fs.copy(config.logoPath, path.join(drawableDir, 'splash_logo.png'));
  } else {
    // Generate default shopping bag logo from SVG → PNG
    await fs.writeFile(path.join(drawableDir, 'splash_logo.png'), createDefaultLogoPNG(512));
  }

  // Copy google-services.json if FCM is enabled
  if (config.fcmEnabled && config.fcmConfigPath) {
    const fcmSrc = path.resolve(config.fcmConfigPath);
    if (await fs.pathExists(fcmSrc)) {
      await fs.copy(fcmSrc, path.join(androidDir, 'app', 'google-services.json'));
    }
  }
}

module.exports = { generateAndroidProject };
