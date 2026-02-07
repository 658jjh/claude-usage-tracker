# 🧾 Claude Usage Tracker

> Track and visualize Claude AI usage costs across all your local development tools.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16-green.svg)

## Overview

**Claude Usage Tracker** is a local-first tool that automatically discovers and aggregates your Claude AI usage across **9+ development tools**, including:

- **OpenClaw / Clawdbot** — AI agent framework
- **Claude Code CLI** — Anthropic's official CLI
- **Claude Desktop** — Anthropic's desktop app (local agent mode)
- **Cursor** — AI-powered code editor
- **Windsurf** — Codeium's AI IDE
- **Cline** — VS Code Claude extension
- **Roo Code** — VS Code AI assistant
- **Aider** — AI pair programming (litellm)
- **Continue.dev** — Open-source AI code assistant

It scans known data directories, parses JSONL/log files, calculates costs using model-specific pricing, and presents everything in a beautiful **dark-themed interactive dashboard** powered by Chart.js.

No cloud. No telemetry. Everything stays on your machine.

---

## ✨ Features

| Category | Details |
|----------|---------|
| **Multi-Source Tracking** | Auto-detects 9+ Claude-integrated tools and merges usage data |
| **Beautiful Dashboard** | Dark-themed UI with Chart.js visualizations |
| **Cost Breakdown** | Daily, weekly, monthly, and all-time cost tracking |
| **Model Analytics** | Per-model cost breakdown across Opus, Sonnet, and Haiku families |

| **Heatmaps** | Two views — Peak Hours (day × hour grid) and Peak Days (GitHub-style calendar) |
| **Session Log** | Expandable day-by-day session details with color-coded source cards |
| **Filtering** | Multi-criteria filtering (source, model, date range, min cost) with visual chips |
| **Monthly Projections** | Projected monthly cost based on current spending pace |
| **Yesterday Delta** | Compare today's spending vs yesterday at a glance |
| **Most Expensive Session** | Callout highlighting the priciest session of the day |
| **Keyboard Shortcuts** | `Shift+E` to expand/collapse all session rows |
| **macOS App** | Build a standalone `.app` bundle for double-click launching |
| **Animated Counters** | Smooth easing animations on stat cards |
| **Responsive Design** | Adapts to different screen sizes |

---

## 📸 Screenshots

> 📷 Screenshots coming soon.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or later)
- **A web browser** (Chrome, Firefox, Safari, etc.)
- **Python 3** *(optional)* — for a local HTTP server, needed because the dashboard uses ES6 modules

### Usage

```bash
# 1. Collect usage data from all detected tools
node collect-usage.js

# 2. Start a local server (ES6 modules require this)
python3 -m http.server 8765

# 3. Open the dashboard in your browser
open http://localhost:8765/dashboard.html
```

The collector will scan all known tool directories, parse session data, compute costs, and generate `data/data.js`. The dashboard reads this file and renders everything client-side.

### macOS App (One-Click Launch)

```bash
# Build the standalone app
chmod +x build-app.sh
./build-app.sh

# Then just double-click "Claude Usage Dashboard.app"
# It collects fresh data and opens the dashboard automatically
```

The `.app` bundle includes an embedded HTTP server, runs `collect-usage.js` on launch, and opens the dashboard in your default browser — all with a single double-click.

---

## 📊 Supported Tools

| Tool | Data Location | Format |
|------|---------------|--------|
| **OpenClaw / Clawdbot** | `~/.openclaw/agents/main/sessions/` or `~/.clawdbot/...` | JSONL |
| **Claude Code CLI** | `~/.claude/projects/` | JSONL |
| **Claude Desktop** | `~/Library/Application Support/Claude/local-agent-mode-sessions/` | JSONL |
| **Cursor** | `~/.cursor/projects/` or `~/Library/Application Support/Cursor/` | JSONL |
| **Windsurf** | `~/.windsurf/` or `~/Library/Application Support/Windsurf/` | JSONL |
| **Cline** | `~/.cline/` or VS Code extension storage | JSONL |
| **Roo Code** | `~/.roo-code/` or VS Code extension storage | JSONL |
| **Aider** | `~/.aider/` | JSONL (litellm) |
| **Continue.dev** | `~/.continue/sessions/` | JSON |

> **Note:** Tool detection is automatic. If a tool isn't installed or has no data, it's silently skipped.

---

## 💰 Pricing Models

Costs are calculated using Anthropic's per-million-token pricing. The tracker supports all current and upcoming model families:

### Current Models

| Model | Input ($/MTok) | Output ($/MTok) | Cache Write ($/MTok) | Cache Read ($/MTok) |
|-------|:--------------:|:---------------:|:--------------------:|:-------------------:|
| **Opus 4.5 / 4.6** | $5.00 | $25.00 | $6.25 | $0.50 |
| **Opus 4.0 / 4.1** | $15.00 | $75.00 | $18.75 | $1.50 |
| **Sonnet 3.5 / 3.7 / 4.0 / 4.5** | $3.00 | $15.00 | $3.75 | $0.30 |
| **Haiku 4.0 / 4.5** | $1.00 | $5.00 | $1.25 | $0.10 |
| **Haiku 3.0 / 3.5** | $0.25 | $1.25 | $0.30 | $0.03 |

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feat/my-feature`
3. **Commit** your changes: `git commit -m "feat: add my feature"`
4. **Push** to your fork: `git push origin feat/my-feature`
5. **Open** a Pull Request

Please follow the existing code style and commit message conventions (`feat:`, `fix:`, `docs:`, `chore:`).

### Ideas for Contributions

- Add support for additional AI tools
- Improve mobile responsiveness
- Add data export (CSV, JSON)
- Add cost alerts / budget thresholds
- Linux / Windows path support
- Electron or Tauri desktop app

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

Built with ❤️ for the Claude community

</div>
