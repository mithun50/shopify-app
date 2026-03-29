# {{APP_NAME}}

A native mobile app for **[{{APP_NAME}}]({{STORE_URL}})** — built with [shopify2app](https://github.com/mithun50/shopify-app).

## App Info

| Field | Value |
|---|---|
| **App Name** | {{APP_NAME}} |
| **Store URL** | {{STORE_URL}} |
| **Package Name** | {{PACKAGE_NAME}} |
| **Theme Color** | {{THEME_COLOR}} |
| **Push Notifications** | {{NOTIFICATIONS_STATUS}} |

## Project Structure

```
android/           Android project (Java + Gradle)
ios/               iOS project (Swift + Xcode)
.github/workflows/ CI/CD workflows (GitHub Actions)
```

## Build

Builds run automatically via GitHub Actions on every push to `main`.

### Artifacts produced

| Artifact | Description |
|---|---|
| `{{APP_NAME}}-debug.apk` | Unsigned debug build |
| `{{APP_NAME}}-release.apk` | Signed release APK (direct install) |
| `{{APP_NAME}}-release.aab` | Signed AAB for Play Store |
| `{{APP_NAME}}-ios.xcarchive.zip` | iOS archive for App Store (re-sign in Xcode) |

### Build locally with shopify2app

```bash
shopify2app build
```

## Customization

```bash
# Update store URL or theme color
shopify2app config --url https://newstore.com --color "#FF5733"

# Set a new app icon (use 1024x1024 PNG)
shopify2app icon ./icon.png

# Set a new splash screen logo (use 512x512 transparent PNG)
shopify2app splash ./logo.png

# Enable Firebase push notifications
shopify2app notifications --fcm ./google-services.json
```

## Android Signing

Signing is handled automatically if you ran `shopify2app keystore` before building.
To set up manually, add these secrets to your GitHub repo (`Settings > Secrets > Actions`):

| Secret | Description |
|---|---|
| `KEYSTORE_BASE64` | Base64-encoded `.jks` keystore |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Key alias |
| `KEY_PASSWORD` | Key password |

## Deployment

**Play Store:** Download the `app-release-bundle` artifact (`.aab`) and upload to [Google Play Console](https://play.google.com/console).

**App Store:** Download the `ios-archive` artifact, re-sign in Xcode with your distribution certificate, then upload via Xcode Organizer.

---

Generated with [shopify2app](https://github.com/mithun50/shopify-app)
