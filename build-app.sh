#!/bin/bash
# Build a standalone macOS .app for Claude Usage Dashboard
# Double-click to collect fresh data + open dashboard — no install needed.

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

# Copy the core files into Resources
cp "$SCRIPT_DIR/collect-usage.js" "$RESOURCES/"
cp "$SCRIPT_DIR/dashboard.html" "$RESOURCES/"

# Copy the modular CSS and JS directories
cp -r "$SCRIPT_DIR/css" "$RESOURCES/"
cp -r "$SCRIPT_DIR/js" "$RESOURCES/"

# Create the launcher script
cat > "$MACOS/launcher" << 'LAUNCHER'
#!/bin/bash
# Claude Usage Dashboard — macOS App Launcher
# Collects fresh usage data, starts a local server, then opens the dashboard.

RESOURCES="$(dirname "$0")/../Resources"
cd "$RESOURCES"

LOG="$RESOURCES/data/launcher.log"

# Find node — check common locations
NODE=""
for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
    if [ -x "$candidate" ]; then
        NODE="$candidate"
        break
    fi
done

# Fallback: try PATH
if [ -z "$NODE" ]; then
    NODE=$(which node 2>/dev/null || true)
fi

if [ -z "$NODE" ]; then
    osascript -e 'display alert "Node.js not found" message "Claude Usage Dashboard requires Node.js to collect data. Please install it from https://nodejs.org" as critical'
    exit 1
fi

# Collect fresh data (log errors instead of suppressing)
"$NODE" "$RESOURCES/collect-usage.js" > "$LOG" 2>&1

# Find Python3 for HTTP server (ES6 modules require http://)
PYTHON3=""
for candidate in /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
    if [ -x "$candidate" ]; then
        PYTHON3="$candidate"
        break
    fi
done

if [ -z "$PYTHON3" ]; then
    PYTHON3=$(which python3 2>/dev/null || true)
fi

if [ -z "$PYTHON3" ]; then
    # Fallback: try opening file directly (won't work with ES6 modules but better than nothing)
    open "$RESOURCES/dashboard.html"
    exit 0
fi

# Kill any existing server on port 8765
lsof -ti:8765 | xargs kill -9 2>/dev/null || true

# Start a no-cache HTTP server so the browser always loads fresh data
"$PYTHON3" -c "
from http.server import SimpleHTTPRequestHandler, HTTPServer
class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    def log_message(self, *a): pass
HTTPServer(('127.0.0.1', 8765), H).serve_forever()
" &
SERVER_PID=$!

# Give server time to start
sleep 1

# Open dashboard via HTTP
open "http://localhost:8765/dashboard.html"

# Keep server running for 30 seconds (enough for browser to load all resources)
(sleep 30; kill $SERVER_PID 2>/dev/null) &
LAUNCHER

chmod +x "$MACOS/launcher"

# Create Info.plist
cat > "$CONTENTS/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleName</key>
    <string>Claude Usage Dashboard</string>
    <key>CFBundleDisplayName</key>
    <string>Claude Usage Dashboard</string>
    <key>CFBundleIdentifier</key>
    <string>com.openclaw.usage-dashboard</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
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

    # Render SVG at each required size via qlmanage
    for size in 16 32 64 128 256 512 1024; do
        qlmanage -t -s "$size" -o "$ICONSET" "$SVG" 2>/dev/null
        mv "$ICONSET/logo.svg.png" "$ICONSET/icon_${size}x${size}.png" 2>/dev/null
    done

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
echo "  • It collects fresh data and opens the dashboard each time"
