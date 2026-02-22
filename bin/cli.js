#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('path');
const { generateProject } = require('../src/index');
const { loadConfig, saveConfig, validateShopifyUrl } = require('../src/config');

const program = new Command();

program
  .name('shopify2app')
  .description('Convert your Shopify store into a native mobile app')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize a new mobile app project from your Shopify store')
  .option('-u, --url <url>', 'Shopify store URL')
  .option('-n, --name <name>', 'App name')
  .option('-p, --package <package>', 'Package name (e.g., com.mystore.app)')
  .option('-c, --color <color>', 'Primary theme color (hex)')
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
        }
      ]);
    }

    const config = {
      storeUrl: options.url || answers.storeUrl,
      appName: options.name || answers.appName,
      packageName: options.package || answers.packageName || `com.${(options.name || answers.appName).toLowerCase().replace(/[^a-z0-9]/g, '')}.app`,
      themeColor: options.color || answers.themeColor || '#000000',
      iconPath: null
    };

    if (!validateShopifyUrl(config.storeUrl)) {
      console.log(chalk.red('\n  Error: Invalid store URL. Please provide a valid URL.\n'));
      process.exit(1);
    }

    console.log(chalk.gray('\n  Configuration:'));
    console.log(chalk.gray(`  Store URL:    ${config.storeUrl}`));
    console.log(chalk.gray(`  App Name:     ${config.appName}`));
    console.log(chalk.gray(`  Package:      ${config.packageName}`));
    console.log(chalk.gray(`  Theme Color:  ${config.themeColor}\n`));

    try {
      saveConfig(config);
      await generateProject(config);
      console.log(chalk.green.bold('\n  Project generated successfully!\n'));
      console.log(chalk.white('  Next steps:'));
      console.log(chalk.gray('  1. git init && git add -A && git commit -m "Initial commit"'));
      console.log(chalk.gray('  2. Create a GitHub repo and push'));
      console.log(chalk.gray('  3. Add signing secrets to GitHub repo settings'));
      console.log(chalk.gray('  4. GitHub Actions will build APK + IPA automatically\n'));
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
    console.log(chalk.white(`  Icon:         ${config.iconPath || 'default'}\n`));
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

    const fs = require('fs-extra');
    const resolvedPath = path.resolve(iconPath);

    if (!await fs.pathExists(resolvedPath)) {
      console.log(chalk.red(`\n  Error: File not found: ${resolvedPath}\n`));
      process.exit(1);
    }

    config.iconPath = resolvedPath;
    saveConfig(config);

    try {
      const sharp = require('sharp');
      const outputDir = path.join(process.cwd(), 'output');

      const androidSizes = [
        { name: 'mipmap-mdpi', size: 48 },
        { name: 'mipmap-hdpi', size: 72 },
        { name: 'mipmap-xhdpi', size: 96 },
        { name: 'mipmap-xxhdpi', size: 144 },
        { name: 'mipmap-xxxhdpi', size: 192 }
      ];

      for (const { name, size } of androidSizes) {
        const dir = path.join(outputDir, 'android', 'app', 'src', 'main', 'res', name);
        await fs.ensureDir(dir);
        await sharp(resolvedPath).resize(size, size).png().toFile(path.join(dir, 'ic_launcher.png'));
      }

      const iosDir = path.join(outputDir, 'ios', 'ShopifyApp', 'Assets.xcassets', 'AppIcon.appiconset');
      await fs.ensureDir(iosDir);
      await sharp(resolvedPath).resize(1024, 1024).png().toFile(path.join(iosDir, 'icon-1024.png'));

      console.log(chalk.green('\n  App icon updated successfully!\n'));
    } catch (err) {
      console.log(chalk.yellow(`\n  Icon path saved. Install 'sharp' for automatic resizing: npm install sharp`));
      console.log(chalk.green('  Config updated.\n'));
    }
  });

program.parse();
