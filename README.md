# Shopify2App

Convert your Shopify store into a native mobile app (Android APK/AAB + iOS IPA) with a single command. No coding required.

## Features

- **WebView-based** native apps for Android (Java) and iOS (Swift)
- **Splash screen** with customizable logo and theme color
- **Deep linking** — `https://yourstore.com` URLs open in-app
- **Pull-to-refresh**, progress bar, offline detection with retry
- **File upload** support (camera + gallery on Android, document picker on iOS)
- **GitHub Actions CI/CD** — builds are automated on every push
- **Build outputs**: Debug APK, signed Release APK, Release AAB (Play Store), iOS archive

## Installation

```bash
npm install -g shopify2app
```

Or run locally:

```bash
git clone https://github.com/mithungowda/shopify2app.git
cd shopify2app
npm install
```

## Quick Start

```bash
# Interactive setup
shopify2app init

# Or pass all options
shopify2app init --url https://mystore.myshopify.com --name "My Store" --color "#FF5733"

# With a custom splash logo
shopify2app init --url https://mystore.com --name "My Store" --logo ./logo.png
```

This generates a complete project in `output/` with Android + iOS source code and GitHub Actions workflows.

## CLI Commands

### `shopify2app init`

Initialize a new mobile app project.

| Option | Description |
|--------|-------------|
| `-u, --url <url>` | Shopify store URL |
| `-n, --name <name>` | App display name |
| `-p, --package <id>` | Package name (e.g., `com.mystore.app`) |
| `-c, --color <hex>` | Theme color (e.g., `#FF5733`) |
| `-l, --logo <path>` | Splash screen logo image |

### `shopify2app icon <path>`

Set a custom app icon. Copies the image to all Android density buckets and iOS assets.

```bash
shopify2app icon ./my-icon.png
```

> Tip: Use a 1024x1024 PNG for best results.

### `shopify2app splash <path>`

Set or update the splash screen logo.

```bash
shopify2app splash ./my-logo.png
```

> Tip: Use a transparent PNG (e.g., 512x512) for best results.

### `shopify2app config`

View or update the current configuration.

```bash
# View config
shopify2app config

# Update values
shopify2app config --url https://newstore.com --color "#000000"
```

## GitHub Actions Setup

The generated project includes workflows that build automatically on push to `main`.

### Required Secrets

For **signed release builds**, add these secrets to your GitHub repo (`Settings > Secrets and variables > Actions`):

| Secret | Description |
|--------|-------------|
| `KEYSTORE_BASE64` | Base64-encoded Android keystore file |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Key alias name |
| `KEY_PASSWORD` | Key password |

### Creating a Keystore

```bash
# Generate keystore
keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias myapp

# Base64 encode it
base64 -i release.jks | tr -d '\n'
```

Copy the base64 output to the `KEYSTORE_BASE64` secret.

### Build Outputs

Without signing secrets:
- **Debug APK** — `app-debug` artifact

With signing secrets configured:
- **Release APK** — `app-release` artifact (direct install)
- **Release AAB** — `app-release-bundle` artifact (Play Store upload)
- **iOS Archive** — `ios-archive` artifact (unsigned, for App Store)

On GitHub Release creation, signed APK and AAB are automatically attached.

## Play Store Deployment

1. Configure signing secrets in GitHub (see above)
2. Push to `main` or create a GitHub Release
3. Download the `app-release-bundle` artifact (`.aab` file)
4. Upload to [Google Play Console](https://play.google.com/console) > Your App > Production > Create new release

## App Store Deployment

1. Download the `ios-archive` artifact from GitHub Actions
2. Open in Xcode, re-sign with your distribution certificate
3. Upload via Xcode Organizer or `altool` to App Store Connect

> Note: iOS builds require code signing. The GitHub Actions workflow produces an unsigned archive that you re-sign locally with your Apple Developer certificate.

## Customization

### Theme Color

Set during init or update later:

```bash
shopify2app config --color "#1a1a2e"
```

The theme color is applied to:
- Splash screen background
- Android status bar and progress bar
- iOS window tint color
- Placeholder app icon (until you set a custom one)

### App Icon

```bash
shopify2app icon ./icon-1024.png
```

Copies your icon to all required sizes for both platforms.

### Splash Logo

```bash
shopify2app splash ./logo.png
```

Displayed centered on the splash screen above the app name. If no logo is provided, a default store icon is generated automatically (SVG design rasterized to PNG).

## Project Structure

```
output/
  .github/workflows/     # CI/CD workflows
  .gitignore
  android/               # Complete Android project (Java + Gradle)
    app/src/main/
      java/.../           # MainActivity, SplashActivity
      res/                # Layouts, icons, splash logo, themes
    build.gradle
  ios/                    # Complete iOS project (Swift + Xcode)
    ShopifyApp/           # AppDelegate, WebViewController, assets
    ShopifyApp.xcodeproj/
```

## License

MIT
