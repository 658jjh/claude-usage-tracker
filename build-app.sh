#!/bin/bash
# Build a standalone macOS .app for Claude Usage Dashboard
# Double-click to collect fresh data + view dashboard in a native window.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Claude Usage Dashboard"
APP_DIR="$SCRIPT_DIR/$APP_NAME.app"
CONTENTS="$APP_DIR/Contents"
MACOS="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"

echo "🔨 Building $APP_NAME.app ..."

# Clean previous build
rm -rf "$APP_DIR"

# Create .app bundle structure
mkdir -p "$MACOS" "$RESOURCES/data"

# ─── Compile native Swift app ─────────────────────────────
echo "⚙️  Compiling native app ..."
swiftc -O \
    -o "$MACOS/ClaudeUsageDashboard" \
    "$SCRIPT_DIR/App.swift" \
    -framework Cocoa \
    -framework WebKit \
    -target "$(uname -m)-apple-macos12.0"
echo "  ✅ Binary compiled"

# Copy the core files into Resources
cp "$SCRIPT_DIR/collect-usage.js" "$RESOURCES/"
cp "$SCRIPT_DIR/dashboard.html" "$RESOURCES/"

# Copy the modular CSS and JS directories
cp -r "$SCRIPT_DIR/css" "$RESOURCES/"
cp -r "$SCRIPT_DIR/js" "$RESOURCES/"

# Create Info.plist
cat > "$CONTENTS/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>ClaudeUsageDashboard</string>
    <key>CFBundleName</key>
    <string>Claude Usage Dashboard</string>
    <key>CFBundleDisplayName</key>
    <string>Claude Usage Dashboard</string>
    <key>CFBundleIdentifier</key>
    <string>com.openclaw.usage-dashboard</string>
    <key>CFBundleVersion</key>
    <string>2.2</string>
    <key>CFBundleShortVersionString</key>
    <string>2.2</string>
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
SVG="$SCRIPT_DIR/logo.svg"
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

# ─── Done ─────────────────────────────────────────────────
echo ""
echo "✅ Built: $APP_DIR"
echo ""
echo "You can now:"
echo "  • Double-click '$APP_NAME.app' in Finder"
echo "  • Drag it to /Applications or your Desktop"
echo "  • It opens as a native app — no browser or Python needed"
