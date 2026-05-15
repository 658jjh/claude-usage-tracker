#!/bin/bash
# Build a standalone macOS .app for Claude Usage Tracker
# Double-click to collect fresh data + view dashboard in a native window.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src"
PREMIUM_DIR="$SCRIPT_DIR/src-premium"
ASSETS_DIR="$SCRIPT_DIR/assets"
DIST_DIR="$SCRIPT_DIR/dist"
APP_NAME="Claude Usage Tracker"
VERSION_FILE="$SCRIPT_DIR/VERSION"
if [ -n "${APP_VERSION:-}" ]; then
    APP_VERSION="$APP_VERSION"
elif [ -f "$VERSION_FILE" ]; then
    APP_VERSION="$(tr -d '[:space:]' < "$VERSION_FILE")"
else
    echo "❌ VERSION file not found and APP_VERSION is not set"
    exit 1
fi
if [[ ! "$APP_VERSION" =~ ^[0-9]+(\.[0-9]+){1,3}([.-][A-Za-z0-9]+)?$ ]]; then
    echo "❌ Invalid app version: $APP_VERSION"
    exit 1
fi
APP_DIR="$DIST_DIR/$APP_NAME.app"
CONTENTS="$APP_DIR/Contents"
MACOS="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"

# PAID_BUILD=1 includes src-premium/*.swift (gitignored, maintainer-only).
PREMIUM_FILES=()
SWIFT_DEFINES=()
if [ "${PAID_BUILD:-}" = "1" ]; then
    if [ -d "$PREMIUM_DIR" ]; then
        while IFS= read -r f; do PREMIUM_FILES+=("$f"); done \
            < <(find "$PREMIUM_DIR" -name '*.swift')
        SWIFT_DEFINES=(-D PAID_BUILD)
        echo "🔒 Paid build: including ${#PREMIUM_FILES[@]} file(s) from src-premium/"
    else
        echo "⚠️  PAID_BUILD=1 but $PREMIUM_DIR not found — falling back to OSS build"
    fi
fi

echo "🔨 Building $APP_NAME.app ..."
echo "🏷️  Version: $APP_VERSION"

# Clean previous build
rm -rf "$APP_DIR"

# Create .app bundle structure (and dist/)
# Runtime data (sessions-cache.json, scan-index.json, data.js, launcher.log)
# is written to ~/Library/Application Support/ClaudeUsageTracker, not into
# the bundle — so there's no Resources/data subdir to create here.
mkdir -p "$MACOS" "$RESOURCES"

# ─── Compile native Swift app (universal binary) ──────────
echo "⚙️  Compiling universal binary (arm64 + x86_64) ..."
TMP_BIN_ARM="$(mktemp -t ClaudeUsageTracker.arm64.XXXX)"
TMP_BIN_X86="$(mktemp -t ClaudeUsageTracker.x86_64.XXXX)"
trap 'rm -f "$TMP_BIN_ARM" "$TMP_BIN_X86"' EXIT

swiftc -O -parse-as-library "${SWIFT_DEFINES[@]}" -o "$TMP_BIN_ARM" \
    "$SRC_DIR/App.swift" "${PREMIUM_FILES[@]}" \
    -framework Cocoa -framework WebKit \
    -target arm64-apple-macos12.0
swiftc -O -parse-as-library "${SWIFT_DEFINES[@]}" -o "$TMP_BIN_X86" \
    "$SRC_DIR/App.swift" "${PREMIUM_FILES[@]}" \
    -framework Cocoa -framework WebKit \
    -target x86_64-apple-macos12.0
lipo -create -output "$MACOS/ClaudeUsageTracker" "$TMP_BIN_ARM" "$TMP_BIN_X86"
echo "  ✅ Universal binary built: $(lipo -archs "$MACOS/ClaudeUsageTracker")"

# Copy the core files into Resources
cp "$SRC_DIR/collect-usage.js" "$RESOURCES/"
cp "$SRC_DIR/dashboard.html" "$RESOURCES/"

# Copy the modular CSS and JS directories
cp -r "$SRC_DIR/css" "$RESOURCES/"
cp -r "$SRC_DIR/js" "$RESOURCES/"

# Create Info.plist
cat > "$CONTENTS/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>ClaudeUsageTracker</string>
    <key>CFBundleName</key>
    <string>Claude Usage Tracker</string>
    <key>CFBundleDisplayName</key>
    <string>Claude Usage Tracker</string>
    <key>CFBundleIdentifier</key>
    <string>com.claudeusagetracker</string>
    <key>CFBundleVersion</key>
    <string>$APP_VERSION</string>
    <key>CFBundleShortVersionString</key>
    <string>$APP_VERSION</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
PLIST

# ─── Generate app icon from logo.svg ─────────────────────
SVG="$ASSETS_DIR/logo.svg"
if [ -f "$SVG" ]; then
    echo "🎨 Generating app icon from logo.svg ..."
    ICONSET="$RESOURCES/AppIcon.iconset"
    mkdir -p "$ICONSET"

    # Render SVG at each required size using Swift (preserves transparency)
    swift - "$SVG" "$ICONSET" << 'SWIFT'
    import Cocoa
    let args = CommandLine.arguments
    let svgPath = args[1]
    let outDir = args[2]
    let sizes = [16, 32, 64, 128, 256, 512, 1024]
    let svgData = try! Data(contentsOf: URL(fileURLWithPath: svgPath))
    let svgImage = NSImage(data: svgData)!
    for size in sizes {
        let s = CGFloat(size)
        let rep = NSBitmapImageRep(
            bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
            bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
            isPlanar: false, colorSpaceName: .deviceRGB,
            bytesPerRow: 0, bitsPerPixel: 0)!
        rep.size = NSSize(width: s, height: s)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
        svgImage.draw(in: NSRect(x: 0, y: 0, width: s, height: s))
        NSGraphicsContext.restoreGraphicsState()
        let png = rep.representation(using: .png, properties: [:])!
        let outURL = URL(fileURLWithPath: outDir).appendingPathComponent("icon_\(size)x\(size).png")
        try! png.write(to: outURL)
    }
SWIFT

    # Map to Apple's expected @2x naming
    cd "$ICONSET"
    cp icon_32x32.png   icon_16x16@2x.png   2>/dev/null
    cp icon_64x64.png   icon_32x32@2x.png   2>/dev/null
    cp icon_256x256.png icon_128x128@2x.png 2>/dev/null
    cp icon_512x512.png icon_256x256@2x.png 2>/dev/null
    cp icon_1024x1024.png icon_512x512@2x.png 2>/dev/null
    rm -f icon_64x64.png icon_1024x1024.png
    cd "$SCRIPT_DIR"

    # Convert iconset → icns
    if command -v iconutil &>/dev/null; then
        iconutil -c icns "$ICONSET" -o "$RESOURCES/AppIcon.icns" 2>/dev/null \
            && echo "  ✅ AppIcon.icns created" \
            || echo "  ⚠️  iconutil failed — app will use default icon"
    fi
    rm -rf "$ICONSET"
else
    echo "  ⚠️  logo.svg not found — app will use default icon"
fi

# ─── Sign, notarize, staple (optional) ────────────────────
# Set these env vars to enable distribution-ready output:
#   SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)"
#   NOTARY_PROFILE="AC_NOTARY"    # name used with `notarytool store-credentials`
# Without them, the .app is left unsigned (fine for local use).
if [ -n "$SIGN_IDENTITY" ]; then
    echo ""
    echo "🔏 Signing with: $SIGN_IDENTITY"
    codesign --force --options runtime --timestamp \
        --sign "$SIGN_IDENTITY" \
        "$APP_DIR"
    codesign --verify --deep --strict --verbose=2 "$APP_DIR"
    echo "  ✅ Signed"

    if [ -n "$NOTARY_PROFILE" ]; then
        ZIP_PATH="$DIST_DIR/ClaudeUsageTracker.zip"
        echo ""
        echo "📤 Submitting for notarization (profile: $NOTARY_PROFILE) ..."
        ditto -c -k --keepParent "$APP_DIR" "$ZIP_PATH"
        xcrun notarytool submit "$ZIP_PATH" \
            --keychain-profile "$NOTARY_PROFILE" \
            --wait
        echo "  ✅ Notarized"

        echo "📎 Stapling ticket ..."
        xcrun stapler staple "$APP_DIR"
        xcrun stapler validate "$APP_DIR"

        # Re-zip the now-stapled app for distribution
        rm -f "$ZIP_PATH"
        ditto -c -k --keepParent "$APP_DIR" "$ZIP_PATH"
        echo "  ✅ Distribution zip: $ZIP_PATH"
    else
        echo "  ℹ️  NOTARY_PROFILE not set — skipping notarization"
    fi
fi

# ─── DMG installer ────────────────────────────────────────
# Produces dist/ClaudeUsageTracker-<version>.dmg with a /Applications
# shortcut so users get the standard "drag to install" window.
# Set SKIP_DMG=1 to opt out.
if [ "${SKIP_DMG:-}" != "1" ]; then
    DMG_NAME="ClaudeUsageTracker-$APP_VERSION"
    DMG_PATH="$DIST_DIR/$DMG_NAME.dmg"
    DMG_VOLNAME="Claude Usage Tracker"
    rm -f "$DMG_PATH"

    echo ""
    if command -v create-dmg &>/dev/null; then
        echo "💿 Creating styled DMG installer..."
        # create-dmg already builds its own staging dir; pass the .app directly.
        # It exits non-zero when the codesign step is skipped, even on success —
        # so we check for the output file rather than $?.
        create-dmg \
            --volname "$DMG_VOLNAME" \
            --window-pos 200 120 \
            --window-size 540 380 \
            --icon-size 96 \
            --icon "$APP_NAME.app" 140 190 \
            --hide-extension "$APP_NAME.app" \
            --app-drop-link 400 190 \
            --no-internet-enable \
            "$DMG_PATH" \
            "$APP_DIR" >/dev/null 2>&1 || true
    else
        echo "💿 Creating DMG installer (install create-dmg via 'brew install create-dmg' for a styled window)..."
        DMG_STAGE="$(mktemp -d -t claude-usage-dmg.XXXX)"
        cp -R "$APP_DIR" "$DMG_STAGE/"
        ln -s /Applications "$DMG_STAGE/Applications"
        hdiutil create \
            -volname "$DMG_VOLNAME" \
            -srcfolder "$DMG_STAGE" \
            -ov -format UDZO \
            "$DMG_PATH" >/dev/null 2>&1 || true
        rm -rf "$DMG_STAGE"
    fi

    if [ -f "$DMG_PATH" ]; then
        # Sign the DMG container itself if a signing identity is set (Gatekeeper
        # treats a signed DMG more leniently than an unsigned one).
        if [ -n "$SIGN_IDENTITY" ]; then
            codesign --force --sign "$SIGN_IDENTITY" --timestamp "$DMG_PATH" >/dev/null 2>&1 \
                && echo "  🔏 DMG signed"
        fi
        echo "  ✅ DMG: $DMG_PATH"
    else
        echo "  ⚠️  DMG creation failed"
    fi
fi

# ─── Done ─────────────────────────────────────────────────
echo ""
echo "✅ Built: $APP_DIR"
if [ "${SKIP_DMG:-}" != "1" ] && [ -f "${DMG_PATH:-}" ]; then
    echo "✅ DMG:   $DMG_PATH"
fi
echo ""
echo "You can now:"
if [ -f "${DMG_PATH:-}" ]; then
    echo "  • Distribute the .dmg — users open it and drag the app to /Applications"
fi
echo "  • Double-click '$APP_NAME.app' in Finder for a local run"
echo "  • It opens as a native app — no browser or Python needed"
