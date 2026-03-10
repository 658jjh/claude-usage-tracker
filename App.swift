// App.swift — Native macOS app for Claude Usage Dashboard
// Renders the dashboard in a WKWebView instead of opening a browser.

import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!
    var dashboardNavigation: WKNavigation?

    // MARK: - App Lifecycle

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupMainMenu()
        setupWindow()
        showLoadingScreen()
        collectDataAndLoadDashboard()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        return false
    }

    // MARK: - Menu Bar

    func setupMainMenu() {
        let mainMenu = NSMenu()

        // App menu
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Claude Usage Dashboard",
                        action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)),
                        keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide Claude Usage Dashboard",
                        action: #selector(NSApplication.hide(_:)),
                        keyEquivalent: "h")
        let hideOthers = appMenu.addItem(withTitle: "Hide Others",
                        action: #selector(NSApplication.hideOtherApplications(_:)),
                        keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(withTitle: "Show All",
                        action: #selector(NSApplication.unhideAllApplications(_:)),
                        keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Claude Usage Dashboard",
                        action: #selector(NSApplication.terminate(_:)),
                        keyEquivalent: "q")
        appMenuItem.submenu = appMenu

        // Edit menu (enables copy/paste in WebView)
        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editMenuItem.submenu = editMenu

        // View menu
        let viewMenuItem = NSMenuItem()
        mainMenu.addItem(viewMenuItem)
        let viewMenu = NSMenu(title: "View")
        viewMenu.addItem(withTitle: "Refresh Data",
                         action: #selector(reloadDashboard),
                         keyEquivalent: "r")
        viewMenuItem.submenu = viewMenu

        // Window menu
        let windowMenuItem = NSMenuItem()
        mainMenu.addItem(windowMenuItem)
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Minimize",
                           action: #selector(NSWindow.miniaturize(_:)),
                           keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom",
                           action: #selector(NSWindow.zoom(_:)),
                           keyEquivalent: "")
        windowMenu.addItem(.separator())
        windowMenu.addItem(withTitle: "Close",
                           action: #selector(NSWindow.performClose(_:)),
                           keyEquivalent: "w")
        windowMenuItem.submenu = windowMenu

        NSApp.mainMenu = mainMenu
        NSApp.windowsMenu = windowMenu
    }

    // MARK: - Window Setup

    func setupWindow() {
        let screen = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1280, height: 800)
        let w = min(1440, screen.width * 0.88)
        let h = min(960, screen.height * 0.9)
        let frame = NSRect(
            x: screen.origin.x + (screen.width - w) / 2,
            y: screen.origin.y + (screen.height - h) / 2,
            width: w, height: h
        )

        window = NSWindow(
            contentRect: frame,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "Claude Usage Dashboard"
        window.appearance = NSAppearance(named: .darkAqua)
        window.backgroundColor = NSColor(red: 0.039, green: 0.055, blue: 0.09, alpha: 1.0)
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.isMovableByWindowBackground = true
        window.minSize = NSSize(width: 800, height: 600)

        // WKWebView — enable local file access for ES6 modules
        let config = WKWebViewConfiguration()
        let prefs = WKPreferences()
        prefs.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.preferences = prefs
        config.setValue(true, forKey: "allowUniversalAccessFromFileURLs")

        // Register message handlers
        let contentController = WKUserContentController()
        contentController.add(self, name: "reload")
        contentController.add(self, name: "exportData")
        contentController.add(self, name: "importData")
        config.userContentController = contentController

        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self

        // GPU acceleration: layer-backed, async drawing
        webView.wantsLayer = true
        webView.layer?.drawsAsynchronously = true
        webView.layer?.backgroundColor = NSColor(red: 0.039, green: 0.055, blue: 0.09, alpha: 1.0).cgColor
        webView.allowsBackForwardNavigationGestures = false

        window.contentView?.addSubview(webView)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    // MARK: - WKScriptMessageHandler

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case "reload":
            reloadDashboard()
        case "exportData":
            handleExport(message.body as? String ?? "")
        case "importData":
            handleImport()
        default:
            break
        }
    }

    // MARK: - Export (NSSavePanel)

    func handleExport(_ jsonString: String) {
        let panel = NSSavePanel()
        let dateStr = ISO8601DateFormatter().string(from: Date()).prefix(10)
        panel.nameFieldStringValue = "claude-usage-\(dateStr).json"
        panel.allowedContentTypes = [.json]
        panel.canCreateDirectories = true
        panel.title = "Export Usage Data"

        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let url = panel.url else { return }
            do {
                try jsonString.write(to: url, atomically: true, encoding: .utf8)
                let count = (try? JSONSerialization.jsonObject(with: Data(jsonString.utf8)) as? [String: Any])?["sessions"]
                let sessionCount = (count as? [[String: Any]])?.count ?? 0
                self?.webView.evaluateJavaScript("window._showExportToast('Exported \(sessionCount) sessions to file')")
            } catch {
                self?.webView.evaluateJavaScript("window._showExportToast('Export failed: \(error.localizedDescription)', true)")
            }
        }
    }

    // MARK: - Import (NSOpenPanel)

    func handleImport() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.title = "Import Usage Data"
        panel.message = "Select a claude-usage JSON file exported from another device"

        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let url = panel.url else {
                self?.webView.evaluateJavaScript("if(window._importDataResolver) window._importDataResolver(null)")
                return
            }
            do {
                let jsonString = try String(contentsOf: url, encoding: .utf8)
                // Escape for JS string literal
                let escaped = jsonString
                    .replacingOccurrences(of: "\\", with: "\\\\")
                    .replacingOccurrences(of: "'", with: "\\'")
                    .replacingOccurrences(of: "\n", with: "\\n")
                    .replacingOccurrences(of: "\r", with: "\\r")
                self?.webView.evaluateJavaScript("if(window._importDataResolver) window._importDataResolver('\(escaped)')")
            } catch {
                self?.webView.evaluateJavaScript("window._showExportToast('Failed to read file', true)")
                self?.webView.evaluateJavaScript("if(window._importDataResolver) window._importDataResolver(null)")
            }
        }
    }

    // MARK: - Loading Screen

    func showLoadingScreen() {
        webView.alphaValue = 1
        webView.loadHTMLString(loadingHTML(), baseURL: nil)
    }

    // MARK: - Data Collection

    func collectDataAndLoadDashboard() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.collectData()
            DispatchQueue.main.async {
                self?.loadDashboard()
            }
        }
    }

    func collectData() {
        let resourcesPath = Bundle.main.resourcePath ?? "."

        guard let node = findNode() else {
            DispatchQueue.main.async {
                let alert = NSAlert()
                alert.messageText = "Node.js not found"
                alert.informativeText = "Claude Usage Dashboard requires Node.js to collect data.\nInstall it from https://nodejs.org"
                alert.alertStyle = .critical
                alert.runModal()
                NSApp.terminate(nil)
            }
            return
        }

        // Ensure data directory exists
        let dataDir = resourcesPath + "/data"
        try? FileManager.default.createDirectory(atPath: dataDir, withIntermediateDirectories: true)

        let process = Process()
        process.executableURL = URL(fileURLWithPath: node)
        process.arguments = [resourcesPath + "/collect-usage.js"]
        process.currentDirectoryURL = URL(fileURLWithPath: resourcesPath)

        // Ensure child process has a usable PATH
        var env = ProcessInfo.processInfo.environment
        let extra = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
        env["PATH"] = extra + ":" + (env["PATH"] ?? "")
        process.environment = env

        let logPath = dataDir + "/launcher.log"
        FileManager.default.createFile(atPath: logPath, contents: nil)
        if let logHandle = FileHandle(forWritingAtPath: logPath) {
            process.standardOutput = logHandle
            process.standardError = logHandle
            try? process.run()
            process.waitUntilExit()
            logHandle.closeFile()
        } else {
            process.standardOutput = FileHandle.nullDevice
            process.standardError = FileHandle.nullDevice
            try? process.run()
            process.waitUntilExit()
        }
    }

    func findNode() -> String? {
        let candidates = [
            "/opt/homebrew/bin/node",
            "/usr/local/bin/node",
            "/usr/bin/node"
        ]
        for path in candidates {
            if FileManager.default.isExecutableFile(atPath: path) { return path }
        }

        // Fallback: which node
        let which = Process()
        which.executableURL = URL(fileURLWithPath: "/usr/bin/which")
        which.arguments = ["node"]
        let pipe = Pipe()
        which.standardOutput = pipe
        which.standardError = FileHandle.nullDevice
        try? which.run()
        which.waitUntilExit()

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        if let path = String(data: data, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
           !path.isEmpty, FileManager.default.isExecutableFile(atPath: path) {
            return path
        }
        return nil
    }

    // MARK: - Dashboard Loading

    func loadDashboard() {
        let resourcesPath = Bundle.main.resourcePath ?? "."
        let dashboardURL = URL(fileURLWithPath: resourcesPath + "/dashboard.html")
        let resourcesDir = URL(fileURLWithPath: resourcesPath, isDirectory: true)

        webView.alphaValue = 0
        dashboardNavigation = webView.loadFileURL(dashboardURL, allowingReadAccessTo: resourcesDir)
    }

    @objc func reloadDashboard() {
        showLoadingScreen()
        collectDataAndLoadDashboard()
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard navigation == dashboardNavigation else { return }
        dashboardNavigation = nil

        NSAnimationContext.runAnimationGroup({ context in
            context.duration = 0.35
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            webView.animator().alphaValue = 1
        })
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        webView.alphaValue = 1
        let alert = NSAlert()
        alert.messageText = "Failed to load dashboard"
        alert.informativeText = error.localizedDescription
        alert.alertStyle = .warning
        alert.runModal()
    }

    // MARK: - Loading HTML

    func loadingHTML() -> String {
        return """
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body {
                background: #0a0e17;
                color: #e2e8f0;
                font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                -webkit-font-smoothing: antialiased;
            }

            /* Aurora background — no blur filter, use pre-softened gradients */
            .aurora {
                position: fixed;
                inset: 0;
                pointer-events: none;
            }
            .aurora-blob {
                position: absolute;
                border-radius: 50%;
                will-change: transform;
                animation: auroraDrift 12s ease-in-out infinite alternate;
            }
            .aurora-blob:nth-child(1) {
                width: 600px; height: 600px;
                top: -20%; right: -10%;
                background: radial-gradient(circle, rgba(34,211,238,0.08) 0%, rgba(34,211,238,0.02) 40%, transparent 70%);
            }
            .aurora-blob:nth-child(2) {
                width: 500px; height: 500px;
                bottom: -15%; left: -8%;
                background: radial-gradient(circle, rgba(251,191,36,0.05) 0%, rgba(251,191,36,0.01) 40%, transparent 70%);
                animation-duration: 15s;
                animation-delay: -4s;
            }
            .aurora-blob:nth-child(3) {
                width: 450px; height: 450px;
                top: 25%; left: 15%;
                background: radial-gradient(circle, rgba(167,139,250,0.05) 0%, rgba(167,139,250,0.01) 40%, transparent 70%);
                animation-duration: 18s;
                animation-delay: -8s;
            }
            @keyframes auroraDrift {
                0%   { transform: translate3d(0, 0, 0) scale(1); }
                100% { transform: translate3d(25px, -15px, 0) scale(1.1); }
            }

            /* Floating particles — GPU-composited */
            .particles {
                position: fixed;
                inset: 0;
                pointer-events: none;
            }
            .dot {
                position: absolute;
                border-radius: 50%;
                opacity: 0;
                will-change: transform, opacity;
                animation: particleFloat linear infinite;
            }
            .dot:nth-child(1) { width:3px; height:3px; left:15%; top:80%; background:#22d3ee; animation-duration:8s;  animation-delay:0s;   }
            .dot:nth-child(2) { width:2px; height:2px; left:40%; top:88%; background:#a78bfa; animation-duration:10s; animation-delay:2s;   }
            .dot:nth-child(3) { width:3px; height:3px; left:65%; top:85%; background:#34d399; animation-duration:9s;  animation-delay:1s;   }
            .dot:nth-child(4) { width:2px; height:2px; left:85%; top:90%; background:#fbbf24; animation-duration:11s; animation-delay:3.5s; }
            .dot:nth-child(5) { width:3px; height:3px; left:8%;  top:92%; background:#60a5fa; animation-duration:9s;  animation-delay:5s;   }
            @keyframes particleFloat {
                0%   { transform: translate3d(0, 0, 0); opacity: 0; }
                10%  { opacity: 0.5; }
                90%  { opacity: 0.3; }
                100% { transform: translate3d(15px, -100vh, 0); opacity: 0; }
            }

            /* Main container */
            .loader {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 40px;
                position: relative;
                z-index: 1;
                animation: loaderIn 0.6s ease-out;
            }
            @keyframes loaderIn {
                from { opacity: 0; transform: translate3d(0, 16px, 0); }
                to   { opacity: 1; transform: translate3d(0, 0, 0); }
            }

            /* Logo with orbital rings */
            .logo-orbit {
                position: relative;
                width: 140px;
                height: 140px;
            }
            .logo {
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                width: 80px; height: 80px;
                will-change: transform;
                animation: logoFloat 3s ease-in-out infinite;
            }
            @keyframes logoFloat {
                0%, 100% { transform: translate(-50%, -50%) translate3d(0, 0, 0); }
                50%      { transform: translate(-50%, -50%) translate3d(0, -8px, 0); }
            }

            /* Orbit rings — GPU composited via transform */
            .orbit {
                position: absolute;
                border-radius: 50%;
                border: 1px solid transparent;
                will-change: transform;
            }
            .orbit-1 {
                inset: 0;
                border-color: rgba(34,211,238,0.12);
                animation: orbitSpin 6s linear infinite;
            }
            .orbit-1::after {
                content: '';
                position: absolute;
                top: -3px; left: 50%;
                width: 6px; height: 6px;
                margin-left: -3px;
                background: #22d3ee;
                border-radius: 50%;
            }
            .orbit-2 {
                inset: -14px;
                border-color: rgba(167,139,250,0.08);
                animation: orbitSpin 10s linear infinite reverse;
            }
            .orbit-2::after {
                content: '';
                position: absolute;
                bottom: -2px; right: 20%;
                width: 4px; height: 4px;
                background: #a78bfa;
                border-radius: 50%;
            }
            .orbit-3 {
                inset: -28px;
                border-color: rgba(52,211,153,0.05);
                animation: orbitSpin 14s linear infinite;
            }
            .orbit-3::after {
                content: '';
                position: absolute;
                top: 30%; right: -2px;
                width: 3px; height: 3px;
                background: #34d399;
                border-radius: 50%;
            }
            @keyframes orbitSpin {
                to { transform: rotate(360deg); }
            }

            /* Title with shimmer */
            .title {
                position: relative;
                font-size: 28px;
                font-weight: 700;
                letter-spacing: -0.5px;
                overflow: hidden;
            }
            .title em {
                font-style: normal;
                background: linear-gradient(135deg, #22d3ee, #a78bfa);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .title::after {
                content: '';
                position: absolute;
                top: 0;
                width: 60%; height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
                will-change: transform;
                animation: shimmerSweep 4s ease-in-out infinite;
                pointer-events: none;
            }
            @keyframes shimmerSweep {
                0%, 100% { transform: translate3d(-400%, 0, 0); }
                50%      { transform: translate3d(400%, 0, 0); }
            }

            /* Progress track */
            .progress {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 24px;
                width: 100%;
            }
            .progress-track {
                width: 220px;
                height: 2px;
                background: rgba(30,41,59,0.6);
                border-radius: 2px;
                overflow: hidden;
            }
            .progress-fill {
                width: 35%;
                height: 100%;
                background: linear-gradient(90deg, #22d3ee, #a78bfa, #fb7185);
                border-radius: 2px;
                will-change: transform;
                animation: progressSlide 1.8s ease-in-out infinite;
            }
            @keyframes progressSlide {
                0%   { transform: translate3d(-100%, 0, 0); }
                100% { transform: translate3d(620%, 0, 0); }
            }

            .status {
                font-size: 13px;
                color: #64748b;
                letter-spacing: 0.5px;
            }
            .status span {
                display: inline-block;
                animation: statusFade 2.5s ease-in-out infinite;
            }
            .status span:nth-child(1) { animation-delay: 0s; }
            .status span:nth-child(2) { animation-delay: 0.15s; }
            .status span:nth-child(3) { animation-delay: 0.3s; }
            @keyframes statusFade {
                0%, 100% { opacity: 0.35; }
                50%      { opacity: 1; }
            }

            /* Animated bars — use scaleY (GPU) instead of height (layout) */
            .bars {
                display: flex;
                align-items: flex-end;
                gap: 6px;
                height: 36px;
            }
            .bar {
                height: 32px;
                border-radius: 3px;
                transform-origin: bottom;
                will-change: transform, opacity;
                animation: barWave 2s ease-in-out infinite;
            }
            .bar:nth-child(1) { width:6px; background:linear-gradient(to top,#22d3ee,#34d399); animation-delay:0s; }
            .bar:nth-child(2) { width:6px; background:linear-gradient(to top,#60a5fa,#22d3ee); animation-delay:.15s; }
            .bar:nth-child(3) { width:6px; background:linear-gradient(to top,#a78bfa,#60a5fa); animation-delay:.3s; }
            .bar:nth-child(4) { width:6px; background:linear-gradient(to top,#fb7185,#a78bfa); animation-delay:.45s; }
            .bar:nth-child(5) { width:6px; background:linear-gradient(to top,#fbbf24,#fb7185); animation-delay:.6s; }
            .bar:nth-child(6) { width:6px; background:linear-gradient(to top,#34d399,#22d3ee); animation-delay:.75s; }
            .bar:nth-child(7) { width:6px; background:linear-gradient(to top,#22d3ee,#60a5fa); animation-delay:.9s; }
            @keyframes barWave {
                0%   { transform: scaleY(0.25); opacity: 0.4; }
                25%  { transform: scaleY(1);    opacity: 0.9; }
                50%  { transform: scaleY(0.5);  opacity: 0.6; }
                75%  { transform: scaleY(0.85); opacity: 0.85; }
                100% { transform: scaleY(0.25); opacity: 0.4; }
            }

            /* Skeleton preview cards */
            .skeleton-row {
                display: flex;
                gap: 14px;
                margin-top: 8px;
            }
            .skeleton-card {
                width: 90px;
                height: 56px;
                border-radius: 10px;
                background: rgba(21,29,46,0.6);
                border: 1px solid rgba(30,41,59,0.3);
                overflow: hidden;
                position: relative;
            }
            .skeleton-card::after {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.04) 50%, transparent 100%);
                will-change: transform;
                animation: skeletonShimmer 2s ease-in-out infinite;
            }
            .skeleton-card:nth-child(2)::after { animation-delay: 0.3s; }
            .skeleton-card:nth-child(3)::after { animation-delay: 0.6s; }
            .skeleton-card:nth-child(4)::after { animation-delay: 0.9s; }
            @keyframes skeletonShimmer {
                0%   { transform: translate3d(-100%, 0, 0); }
                100% { transform: translate3d(200%, 0, 0); }
            }
        </style>
        </head>
        <body>
        <div class="aurora">
            <div class="aurora-blob"></div>
            <div class="aurora-blob"></div>
            <div class="aurora-blob"></div>
        </div>

        <div class="particles">
            <div class="dot"></div><div class="dot"></div><div class="dot"></div>
            <div class="dot"></div><div class="dot"></div>
        </div>

        <div class="loader">
            <div class="logo-orbit">
                <div class="orbit orbit-1"></div>
                <div class="orbit orbit-2"></div>
                <div class="orbit orbit-3"></div>
                <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
                    <defs>
                        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#22d3ee"/><stop offset="100%" stop-color="#a78bfa"/></linearGradient>
                        <linearGradient id="gw" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#34d399" stop-opacity="0.25"/><stop offset="50%" stop-color="#22d3ee" stop-opacity="0.08"/><stop offset="100%" stop-color="#a78bfa" stop-opacity="0.25"/></linearGradient>
                        <linearGradient id="b1" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#22d3ee"/><stop offset="100%" stop-color="#34d399"/></linearGradient>
                        <linearGradient id="b2" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#22d3ee"/></linearGradient>
                        <linearGradient id="b3" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#60a5fa"/></linearGradient>
                        <linearGradient id="b4" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#fb7185"/><stop offset="100%" stop-color="#a78bfa"/></linearGradient>
                        <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#fb7185"/></linearGradient>
                        <linearGradient id="af" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fbbf24" stop-opacity="0.15"/><stop offset="100%" stop-color="#fb7185" stop-opacity="0.02"/></linearGradient>
                    </defs>
                    <rect width="512" height="512" rx="108" ry="108" fill="#0f1629"/>
                    <rect width="512" height="512" rx="108" ry="108" fill="url(#gw)" opacity="0.5"/>
                    <rect x="3" y="3" width="506" height="506" rx="105" ry="105" fill="none" stroke="url(#g)" stroke-width="1.5" opacity="0.4"/>
                    <rect x="80" y="100" width="352" height="312" rx="20" ry="20" fill="#131b2e" opacity="0.6"/>
                    <line x1="110" y1="370" x2="402" y2="370" stroke="#253147" stroke-width="1.5" opacity="0.6"/>
                    <rect x="122" y="238" width="50" height="132" rx="8" ry="8" fill="url(#b1)" opacity="0.92"/>
                    <rect x="192" y="168" width="50" height="202" rx="8" ry="8" fill="url(#b2)" opacity="0.92"/>
                    <rect x="262" y="206" width="50" height="164" rx="8" ry="8" fill="url(#b3)" opacity="0.92"/>
                    <rect x="332" y="128" width="50" height="242" rx="8" ry="8" fill="url(#b4)" opacity="0.92"/>
                    <polygon points="147,226 217,156 287,192 357,122 357,370 147,370" fill="url(#af)" opacity="0.6"/>
                    <polyline points="147,226 217,156 287,192 357,122" fill="none" stroke="url(#lg)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>
                    <circle cx="147" cy="226" r="4.5" fill="#fbbf24"/>
                    <circle cx="217" cy="156" r="4.5" fill="#f59e0b"/>
                    <circle cx="287" cy="192" r="4.5" fill="#e879a0"/>
                    <circle cx="357" cy="122" r="4.5" fill="#fb7185"/>
                </svg>
            </div>

            <div class="title"><em>Claude</em> Usage Tracker</div>

            <div class="progress">
                <div class="progress-track"><div class="progress-fill"></div></div>
                <div class="status">
                    <span>Collecting</span> <span>usage</span> <span>data&hellip;</span>
                </div>
            </div>

            <div class="bars">
                <div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div>
                <div class="bar"></div><div class="bar"></div><div class="bar"></div>
            </div>

            <div class="skeleton-row">
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
                <div class="skeleton-card"></div>
            </div>
        </div>
        </body>
        </html>
        """
    }
}

// MARK: - Entry Point

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
