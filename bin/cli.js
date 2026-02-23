#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs-extra');
const { generateProject } = require('../src/index');
const { loadConfig, saveConfig, validateShopifyUrl, getGithubToken, saveGithubToken, getKeystore, saveKeystore } = require('../src/config');

const program = new Command();

program
  .name('shopify2app')
  .description('Convert your Shopify store into a native mobile app')
  .version('1.2.0');

program
  .command('init')
  .description('Initialize a new mobile app project from your Shopify store')
  .option('-u, --url <url>', 'Shopify store URL')
  .option('-n, --name <name>', 'App name')
  .option('-p, --package <package>', 'Package name (e.g., com.mystore.app)')
  .option('-c, --color <color>', 'Primary theme color (hex)')
  .option('-l, --logo <path>', 'Path to splash screen logo image')
  .option('--fcm <path>', 'Path to google-services.json for Firebase Cloud Messaging')
  .action(async (options) => {
    console.log(chalk.bold.cyan('\n  Shopify2App - Store to Mobile App Converter\n'));

    let answers = {};

    if (!options.url || !options.name) {
      answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'storeUrl',
          message: 'Enter your Shopify store URL:',
          when: !options.url,
          validate: (input) => {
            if (!input.trim()) return 'Store URL is required';
            if (!validateShopifyUrl(input)) return 'Please enter a valid URL (e.g., https://mystore.myshopify.com)';
            return true;
          }
        },
        {
          type: 'input',
          name: 'appName',
          message: 'Enter your app name:',
          when: !options.name,
          validate: (input) => input.trim() ? true : 'App name is required'
        },
        {
          type: 'input',
          name: 'packageName',
          message: 'Enter package name (e.g., com.mystore.app):',
          when: !options.package,
          default: (prev) => {
            const name = (options.name || prev.appName || 'myapp').toLowerCase().replace(/[^a-z0-9]/g, '');
            return `com.${name}.app`;
          },
          validate: (input) => /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(input) ? true : 'Invalid package name format'
        },
        {
          type: 'input',
          name: 'themeColor',
          message: 'Enter primary theme color (hex):',
          when: !options.color,
          default: '#000000',
          validate: (input) => /^#[0-9A-Fa-f]{6}$/.test(input) ? true : 'Please enter a valid hex color (e.g., #FF5733)'
        },
        {
          type: 'input',
          name: 'logoPath',
          message: 'Path to splash logo (optional, press Enter to skip):',
          when: !options.logo,
        }
      ]);
    }

    // Resolve logo path
    let logoPath = options.logo || answers.logoPath || null;
    if (logoPath && logoPath.trim()) {
      logoPath = path.resolve(logoPath.trim());
      if (!await fs.pathExists(logoPath)) {
        console.log(chalk.red(`\n  Error: Logo file not found: ${logoPath}\n`));
        process.exit(1);
      }
    } else {
      logoPath = null;
    }

    // Resolve FCM config path
    let fcmEnabled = false;
    let fcmConfigPath = null;
    if (options.fcm) {
      fcmConfigPath = path.resolve(options.fcm.trim());
      if (!await fs.pathExists(fcmConfigPath)) {
        console.log(chalk.red(`\n  Error: FCM config file not found: ${fcmConfigPath}\n`));
        process.exit(1);
      }
      fcmEnabled = true;
    }

    const config = {
      storeUrl: options.url || answers.storeUrl,
      appName: options.name || answers.appName,
      packageName: options.package || answers.packageName || `com.${(options.name || answers.appName).toLowerCase().replace(/[^a-z0-9]/g, '')}.app`,
      themeColor: options.color || answers.themeColor || '#000000',
      iconPath: null,
      logoPath: logoPath,
      fcmEnabled: fcmEnabled,
      fcmConfigPath: fcmConfigPath
    };

    if (!validateShopifyUrl(config.storeUrl)) {
      console.log(chalk.red('\n  Error: Invalid store URL. Please provide a valid URL.\n'));
      process.exit(1);
    }

    console.log(chalk.gray('\n  Configuration:'));
    console.log(chalk.gray(`  Store URL:    ${config.storeUrl}`));
    console.log(chalk.gray(`  App Name:     ${config.appName}`));
    console.log(chalk.gray(`  Package:      ${config.packageName}`));
    console.log(chalk.gray(`  Theme Color:  ${config.themeColor}`));
    console.log(chalk.gray(`  Splash Logo:  ${config.logoPath || 'none'}`));
    console.log(chalk.gray(`  FCM:          ${config.fcmEnabled ? 'enabled' : 'disabled (local notifications only)'}\n`));

    try {
      saveConfig(config);
      await generateProject(config);
      console.log(chalk.green.bold('\n  Project generated successfully!\n'));
      console.log(chalk.white('  Next steps:'));
      console.log(chalk.gray('  1. shopify2app build                - Build APK/IPA in the cloud'));
      console.log(chalk.gray('  2. Add signing secrets for release builds (see README)'));
      console.log(chalk.gray(''));
      console.log(chalk.white('  Or manually:'));
      console.log(chalk.gray('  1. git init && git add -A && git commit -m "Initial commit"'));
      console.log(chalk.gray('  2. Create a GitHub repo and push'));
      console.log(chalk.gray('  3. Add signing secrets to GitHub repo settings'));
      console.log(chalk.gray('  4. GitHub Actions will build APK + AAB + IPA automatically'));
      console.log(chalk.gray(''));
      console.log(chalk.white('  Customize your app:'));
      console.log(chalk.gray('  shopify2app icon <path>           - Set custom app icon'));
      console.log(chalk.gray('  shopify2app splash <path>         - Set custom splash logo'));
      console.log(chalk.gray('  shopify2app notifications --fcm   - Enable push notifications'));
      console.log(chalk.gray('  shopify2app config                - View/update configuration\n'));
    } catch (err) {
      console.log(chalk.red(`\n  Error: ${err.message}\n`));
      process.exit(1);
    }
  });

program
  .command('config')
  .description('View or update app configuration')
  .option('-u, --url <url>', 'Update store URL')
  .option('-n, --name <name>', 'Update app name')
  .option('-c, --color <color>', 'Update theme color')
  .action((options) => {
    const config = loadConfig();

    if (!config) {
      console.log(chalk.red('\n  No config found. Run "shopify2app init" first.\n'));
      process.exit(1);
    }

    let updated = false;
    if (options.url) {
      if (!validateShopifyUrl(options.url)) {
        console.log(chalk.red('\n  Error: Invalid store URL.\n'));
        process.exit(1);
      }
      config.storeUrl = options.url;
      updated = true;
    }
    if (options.name) { config.appName = options.name; updated = true; }
    if (options.color) { config.themeColor = options.color; updated = true; }

    if (updated) {
      saveConfig(config);
      console.log(chalk.green('\n  Configuration updated.\n'));
    }

    console.log(chalk.cyan('\n  Current Configuration:'));
    console.log(chalk.white(`  Store URL:    ${config.storeUrl}`));
    console.log(chalk.white(`  App Name:     ${config.appName}`));
    console.log(chalk.white(`  Package:      ${config.packageName}`));
    console.log(chalk.white(`  Theme Color:  ${config.themeColor}`));
    console.log(chalk.white(`  Icon:         ${config.iconPath || 'default'}`));
    console.log(chalk.white(`  Splash Logo:  ${config.logoPath || 'none'}`));
    console.log(chalk.white(`  FCM:          ${config.fcmEnabled ? 'enabled' : 'disabled'}`));
    console.log(chalk.white(`  Notifications: local${config.fcmEnabled ? ' + push (FCM)' : ' only'}\n`));
  });

program
  .command('icon <path>')
  .description('Set app icon from an image file')
  .action(async (iconPath) => {
    const config = loadConfig();
    if (!config) {
      console.log(chalk.red('\n  No config found. Run "shopify2app init" first.\n'));
      process.exit(1);
    }

    const resolvedPath = path.resolve(iconPath);

    if (!await fs.pathExists(resolvedPath)) {
      console.log(chalk.red(`\n  Error: File not found: ${resolvedPath}\n`));
      process.exit(1);
    }

    config.iconPath = resolvedPath;
    saveConfig(config);

    const outputDir = path.join(process.cwd(), 'output');

    // Copy icon to all Android density buckets
    const androidSizes = [
      'mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'
    ];

    for (const name of androidSizes) {
      const dir = path.join(outputDir, 'android', 'app', 'src', 'main', 'res', name);
      await fs.ensureDir(dir);
      await fs.copy(resolvedPath, path.join(dir, 'ic_launcher.png'));
    }

    // Copy icon to iOS assets
    const iosDir = path.join(outputDir, 'ios', 'ShopifyApp', 'Assets.xcassets', 'AppIcon.appiconset');
    await fs.ensureDir(iosDir);
    await fs.copy(resolvedPath, path.join(iosDir, 'icon-1024.png'));

    console.log(chalk.green('\n  App icon updated successfully!\n'));
    console.log(chalk.gray('  Tip: For best results, use a 1024x1024 PNG image.\n'));
  });

program
  .command('splash <path>')
  .description('Set splash screen logo from an image file')
  .action(async (logoPath) => {
    const config = loadConfig();
    if (!config) {
      console.log(chalk.red('\n  No config found. Run "shopify2app init" first.\n'));
      process.exit(1);
    }

    const resolvedPath = path.resolve(logoPath);

    if (!await fs.pathExists(resolvedPath)) {
      console.log(chalk.red(`\n  Error: File not found: ${resolvedPath}\n`));
      process.exit(1);
    }

    config.logoPath = resolvedPath;
    saveConfig(config);

    const outputDir = path.join(process.cwd(), 'output');

    // Copy to Android drawable
    const drawableDir = path.join(outputDir, 'android', 'app', 'src', 'main', 'res', 'drawable');
    await fs.ensureDir(drawableDir);
    await fs.copy(resolvedPath, path.join(drawableDir, 'splash_logo.png'));

    // Copy to iOS SplashLogo imageset
    const iosImagesetDir = path.join(outputDir, 'ios', 'ShopifyApp', 'Assets.xcassets', 'SplashLogo.imageset');
    await fs.ensureDir(iosImagesetDir);
    await fs.copy(resolvedPath, path.join(iosImagesetDir, 'splash_logo.png'));
    await fs.writeJson(path.join(iosImagesetDir, 'Contents.json'), {
      images: [
        { idiom: 'universal', filename: 'splash_logo.png', scale: '1x' },
        { idiom: 'universal', scale: '2x' },
        { idiom: 'universal', scale: '3x' }
      ],
      info: { version: 1, author: 'xcode' }
    }, { spaces: 2 });

    console.log(chalk.green('\n  Splash logo updated successfully!\n'));
    console.log(chalk.gray('  Tip: For best results, use a transparent PNG (e.g., 512x512).\n'));
  });

program
  .command('notifications')
  .description('Configure push notifications')
  .option('--fcm <path>', 'Enable FCM with google-services.json path')
  .option('--disable', 'Disable FCM push notifications (local notifications remain)')
  .action(async (options) => {
    const config = loadConfig();
    if (!config) {
      console.log(chalk.red('\n  No config found. Run "shopify2app init" first.\n'));
      process.exit(1);
    }

    if (options.disable) {
      config.fcmEnabled = false;
      config.fcmConfigPath = null;
      saveConfig(config);
      console.log(chalk.green('\n  FCM push notifications disabled. Local notifications still active.'));
      console.log(chalk.gray('  Run "shopify2app init" to regenerate the project.\n'));
      return;
    }

    if (options.fcm) {
      const fcmPath = path.resolve(options.fcm.trim());
      if (!await fs.pathExists(fcmPath)) {
        console.log(chalk.red(`\n  Error: File not found: ${fcmPath}\n`));
        process.exit(1);
      }
      config.fcmEnabled = true;
      config.fcmConfigPath = fcmPath;
      saveConfig(config);

      // Copy google-services.json to output if it exists
      const outputGS = path.join(process.cwd(), 'output', 'android', 'app', 'google-services.json');
      await fs.ensureDir(path.dirname(outputGS));
      await fs.copy(fcmPath, outputGS);

      console.log(chalk.green('\n  FCM push notifications enabled!'));
      console.log(chalk.gray(`  google-services.json: ${fcmPath}`));
      console.log(chalk.gray('  Run "shopify2app init" to regenerate the project with FCM support.\n'));
      return;
    }

    // Show current status
    console.log(chalk.cyan('\n  Notification Configuration:'));
    console.log(chalk.white(`  Local Notifications: enabled (always)`));
    console.log(chalk.white(`  FCM Push:            ${config.fcmEnabled ? 'enabled' : 'disabled'}`));
    if (config.fcmConfigPath) {
      console.log(chalk.white(`  google-services.json: ${config.fcmConfigPath}`));
    }
    console.log(chalk.gray('\n  Options:'));
    console.log(chalk.gray('  --fcm <path>   Enable FCM with google-services.json'));
    console.log(chalk.gray('  --disable      Disable FCM push notifications\n'));
  });

program
  .command('keystore')
  .description('Generate a signing keystore for Android release builds')
  .option('--show', 'Show current keystore status')
  .action(async (options) => {
    const existing = getKeystore();

    if (options.show) {
      if (existing) {
        console.log(chalk.cyan('\n  Keystore Configuration:'));
        console.log(chalk.white(`  Alias:    ${existing.alias}`));
        console.log(chalk.white(`  Created:  ${existing.createdAt || 'unknown'}`));
        console.log(chalk.green('  Status:   saved (will be used for all builds)\n'));
      } else {
        console.log(chalk.yellow('\n  No keystore configured. Run "shopify2app keystore" to generate one.\n'));
      }
      return;
    }

    if (existing) {
      const { overwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: 'A keystore already exists. Generate a new one? (WARNING: builds signed with the old key will need re-publishing)',
        default: false,
      }]);
      if (!overwrite) {
        console.log(chalk.gray('\n  Keeping existing keystore.\n'));
        return;
      }
    }

    // Check for keytool
    const { execSync } = require('child_process');
    try {
      execSync('keytool -help', { stdio: 'pipe' });
    } catch {
      console.log(chalk.red('\n  Error: keytool not found. Install JDK to generate a keystore.'));
      console.log(chalk.gray('  On Ubuntu/Debian: sudo apt install default-jdk'));
      console.log(chalk.gray('  On macOS: brew install openjdk'));
      console.log(chalk.gray('  On Termux: pkg install openjdk-17\n'));
      process.exit(1);
    }

    // Generate password
    const password = require('crypto').randomBytes(16).toString('hex');
    const alias = 'release';
    const keystorePath = path.join(require('os').tmpdir(), `shopify2app-${Date.now()}.jks`);

    const config = loadConfig();
    const appName = (config && config.appName) || 'ShopifyApp';

    console.log(chalk.cyan('\n  Generating signing keystore...\n'));

    try {
      const dname = `CN=${appName}, OU=Mobile, O=${appName}, L=City, ST=State, C=US`;
      execSync([
        'keytool', '-genkey', '-v',
        '-keystore', `"${keystorePath}"`,
        '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
        '-alias', alias,
        '-storepass', password,
        '-keypass', password,
        '-dname', `"${dname}"`,
      ].join(' '), { stdio: 'pipe' });

      const keystoreBase64 = fs.readFileSync(keystorePath).toString('base64');
      fs.removeSync(keystorePath);

      saveKeystore({
        base64: keystoreBase64,
        password: password,
        alias: alias,
        createdAt: new Date().toISOString().split('T')[0],
      });

      console.log(chalk.green('  Keystore generated and saved to config!\n'));
      console.log(chalk.white('  Details:'));
      console.log(chalk.gray(`  Alias:      ${alias}`));
      console.log(chalk.gray(`  Algorithm:  RSA 2048-bit`));
      console.log(chalk.gray(`  Validity:   10,000 days`));
      console.log(chalk.gray(`  Stored in:  app.config.json (base64 encoded)\n`));
      console.log(chalk.white('  This keystore will be used automatically for all builds.'));
      console.log(chalk.white('  Run "shopify2app build" to create a signed release.\n'));
      console.log(chalk.yellow('  IMPORTANT: Back up your app.config.json!'));
      console.log(chalk.yellow('  If you lose the keystore, you cannot update apps on Play Store.\n'));
    } catch (err) {
      fs.removeSync(keystorePath);
      console.log(chalk.red(`\n  Error generating keystore: ${err.message}\n`));
      process.exit(1);
    }
  });

program
  .command('build')
  .description('Build APK/IPA in the cloud via GitHub Actions')
  .option('-t, --token <token>', 'GitHub personal access token')
  .option('-r, --repo <name>', 'GitHub repository name (default: app name)')
  .option('-o, --output <path>', 'Output directory for build artifacts', './builds')
  .option('--public', 'Create a public repository instead of private')
  .action(async (options) => {
    // Token resolution chain: flag → env → config → interactive prompt
    let token = options.token || process.env.GITHUB_TOKEN || getGithubToken();

    if (!token) {
      const answers = await inquirer.prompt([
        {
          type: 'password',
          name: 'token',
          message: 'Enter your GitHub personal access token:',
          mask: '*',
          validate: (input) => input.trim() ? true : 'Token is required',
        }
      ]);
      token = answers.token.trim();

      // Ask to save token
      const { save } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'save',
          message: 'Save token to config for future builds?',
          default: false,
        }
      ]);
      if (save) {
        saveGithubToken(token);
        console.log(chalk.gray('  Token saved to app.config.json'));
      }
    }

    const { runBuild } = require('../src/build');
    await runBuild({
      token: token,
      repo: options.repo || null,
      output: options.output,
      isPublic: options.public || false,
    });
  });

program.parse();
