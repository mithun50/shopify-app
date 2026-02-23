# Shopify2App

Convert your Shopify store into a native mobile app (Android APK/AAB + iOS IPA) with a single command. No coding required.

## Features

- **WebView-based** native apps for Android (Java) and iOS (Swift)
- **Splash screen** with customizable logo and theme color
- **Deep linking** — `https://yourstore.com` URLs open in-app
- **Pull-to-refresh**, progress bar, offline detection with retry
- **File upload** support (camera + gallery on Android, document picker on iOS)
- **Notifications** — local reminders + optional FCM push notifications (Android) and APNs (iOS)
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
| `--fcm <path>` | Path to `google-services.json` for Firebase push notifications |

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

### `shopify2app build`

Build your app in the cloud using GitHub Actions. This command automates the entire flow: creates a private GitHub repo, pushes your generated project, waits for CI builds to complete, and downloads the build artifacts locally.

```bash
# Interactive (prompts for GitHub token)
shopify2app build

# With token flag
shopify2app build --token ghp_xxxxxxxxxxxx

# Custom repo name and output directory
shopify2app build --token ghp_xxx --repo my-app --output ./my-builds

# Create a public repo instead of private
shopify2app build --token ghp_xxx --public
```

| Option | Description |
|--------|-------------|
| `-t, --token <token>` | GitHub personal access token (or set `GITHUB_TOKEN` env var) |
| `-r, --repo <name>` | Repository name (defaults to app name) |
| `-o, --output <path>` | Artifact download directory (default: `./builds/`) |
| `--public` | Create a public repository (default: private) |

**Token resolution order:** `--token` flag → `GITHUB_TOKEN` env variable → saved config → interactive prompt.

**What it does:**
1. Validates your project (`output/` directory, workflows, and config must exist)
2. Authenticates with GitHub using your token
3. Creates a private repo named after your app (or reuses an existing one)
4. Restructures and pushes code so GitHub Actions can discover workflows
5. Polls GitHub Actions every 15s until all builds complete (30 min timeout)
6. Downloads and extracts build artifacts to your local output directory

**How the push works — repo structure:**

Your local `output/` directory has workflows nested inside it (`output/.github/workflows/`), but GitHub Actions only discovers workflows at the repo root (`.github/workflows/`). The build command creates a staging directory that restructures the files:

```
Local:                          Pushed to GitHub:
output/                         .github/
  .github/workflows/    ──→       workflows/
    build-android.yml               build-android.yml
    build-ios.yml                    build-ios.yml
  android/               ──→   output/
  ios/                            android/...
                                  ios/...
```

The workflow templates already reference `./output/android` and `./output/ios` as their `working-directory`, which matches this pushed structure. No template changes are needed — the build command handles the restructuring automatically.

**If you modify workflow templates** (`templates/.github/workflows/`), keep these path rules:
- `working-directory:` must use `./output/android` or `./output/ios`
- `path:` in `upload-artifact` must use `output/android/...` or `output/ios/...` (no leading `./`)
- These paths work because `output/` is preserved as a subdirectory in the pushed repo

**Build artifacts:**

| Artifact | File | Description |
|----------|------|-------------|
| Debug APK | `AppName-debug.apk` | Unsigned debug build (always produced) |
| Release APK | `AppName-release.apk` | Signed release (requires signing secrets) |
| Release AAB | `AppName-release.aab` | Play Store bundle (requires signing secrets) |
| iOS Archive | `AppName-ios.xcarchive.zip` | Xcode archive (unsigned, for re-signing) |

**Creating a GitHub Token:**

The token needs `repo` and `workflow` scopes to create repos and push workflow files.

1. Go to [GitHub Settings → Personal Access Tokens → Tokens (classic)](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Select scopes: **`repo`** (full) and **`workflow`**
4. Copy the token — use it with `--token` or set `GITHUB_TOKEN` env var

> **Note:** Fine-grained tokens also work — grant `Read and write` access to `Contents`, `Actions`, and `Administration` on the target repo.

**Re-running builds:**

Running `shopify2app build` again will detect the existing repo, force-push updated code, and trigger fresh builds. Previous build artifacts on GitHub are not affected.

### `shopify2app notifications`

Configure push notifications.

```bash
# View notification status
shopify2app notifications

# Enable FCM push notifications
shopify2app notifications --fcm ./google-services.json

# Disable FCM (local notifications remain active)
shopify2app notifications --disable
```

| Option | Description |
|--------|-------------|
| `--fcm <path>` | Enable FCM with `google-services.json` |
| `--disable` | Disable FCM push notifications |

## Notifications

The generated app includes both **local notifications** and optional **push notifications**.

### Local Notifications (Always Active)

A "Welcome back" reminder is automatically scheduled 24 hours after the user opens the app. This works on both Android and iOS without any server setup.

### Push Notifications (Optional FCM)

To enable server-driven push notifications on Android:

1. Create a [Firebase project](https://console.firebase.google.com/)
2. Add an Android app with your package name
3. Download `google-services.json`
4. Run:

```bash
shopify2app init --url https://mystore.com --name "My Store" --fcm ./google-services.json
```

Or enable FCM on an existing project:

```bash
shopify2app notifications --fcm ./google-services.json
shopify2app init  # regenerate project
```

When FCM is **not** configured:
- No Firebase dependencies are added to the build
- No FCM service is included in the manifest
- Local notifications still work

When FCM is **enabled**:
- Firebase BOM + Messaging are added to `build.gradle`
- `google-services.json` is copied to `app/`
- `ShopifyFirebaseMessagingService` handles incoming push messages
- Notification taps open the app (optionally navigating to a URL via `url` data payload)

### iOS Push Notifications

iOS uses native APNs (no Firebase SDK required). The app registers for remote notifications at launch. To send push notifications:

1. Enable Push Notifications capability in your Apple Developer account
2. Generate an APNs key or certificate
3. Use your backend or a service to send notifications via APNs

### Testing Notifications

**Android (local):** Install the debug APK, open the app, then wait 24h (or adjust the delay in `MainActivity.java` for testing).

**Android (FCM):** Use the [Firebase Console](https://console.firebase.google.com/) > Cloud Messaging > Send test message.

**iOS (local):** Run on a device, open the app, notification fires after 24h.

**iOS (remote):** Requires a physical device and APNs configuration.

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
      java/.../           # MainActivity, SplashActivity, NotificationHelper, NotificationReceiver
      res/                # Layouts, icons, splash logo, themes
    build.gradle
  ios/                    # Complete iOS project (Swift + Xcode)
    ShopifyApp/           # AppDelegate, WebViewController, NotificationHelper, assets
    ShopifyApp.xcodeproj/
```

## License

MIT
