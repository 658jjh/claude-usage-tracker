<div align="center">

# 🧾 AI Usage Tracker

### Track and visualize Claude + Codex usage costs across all your local development tools

<p>
  <img src="https://img.shields.io/badge/license-MIT-3b82f6?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/platform-macOS-a78bfa?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/node-%E2%89%A516-22c55e?style=flat-square" alt="Node" />
  <img src="https://img.shields.io/github/downloads/658jjh/claude-usage-tracker/total?label=downloads&color=ec4899&style=flat-square" alt="Downloads" />
  <img src="https://img.shields.io/badge/version-v3.0.0-f59e0b?style=flat-square" alt="Version" />
  <a href="https://buy.polar.sh/polar_cl_1ljeQzFXHTipMnCtDF7Od6hFug67DBci8CToc083Wxj"><img src="https://img.shields.io/badge/premium_build-%249-22c55e?style=flat-square" alt="Premium Build" /></a>
</p>

<p>
  <a href="#-quick-start"><strong>Quick Start</strong></a> ·
  <a href="#-screenshots"><strong>Screenshots</strong></a> ·
  <a href="#-features"><strong>Features</strong></a> ·
  <a href="#-supported-tools"><strong>Supported Tools</strong></a> ·
  <a href="#-pricing-models"><strong>Pricing</strong></a> ·
  <a href="#-contributing"><strong>Contributing</strong></a>
</p>

<br />

<img src="assets/screenshots/demo1.png" alt="AI Usage Tracker Dashboard" width="900" />

<br /><br />

</div>

---

## ✨ Overview

**AI Usage Tracker** (formerly Claude Usage Tracker) is a local-first tool that automatically discovers and aggregates your AI coding usage across **10+ development tools** — covering both **Anthropic Claude** and **OpenAI Codex**. It scans known data directories, parses JSONL/log files, calculates costs using model-specific pricing, and presents everything in a beautiful **dark-themed interactive dashboard** powered by Chart.js. A top-level **All / Claude / Codex** pill toggle scopes the entire dashboard to a single provider.

> [!TIP]
> **No cloud. No telemetry. No accounts.** Everything stays on your machine — your data never leaves your laptop.

This project is open source under the MIT license. You can build and use it yourself for free. If you want the convenience of a ready-to-use signed macOS app with premium licensing, automatic update checks, and one-click updates, you can buy the **Premium Build** for **$9**:

<p>
  <a href="https://buy.polar.sh/polar_cl_1ljeQzFXHTipMnCtDF7Od6hFug67DBci8CToc083Wxj"><strong>Buy Premium Build →</strong></a>
</p>

<table>
<tr>
<td width="50%" valign="top">

### 🎯 Built for developers

- **Auto-discovery** — detects Claude + Codex tools
- **Privacy-first** — 100% local, zero telemetry
- **Beautiful UI** — dark mode dashboard with charts
- **Zero config** — just run and open

</td>
<td width="50%" valign="top">

### 📦 Works with

`OpenClaw` · `Clawdbot` · `Claude Code CLI` · `Claude Desktop` · `Cursor` · `Windsurf` · `Cline` · `Roo Code` · [`Zoo Code`](https://zoocode.dev/) · `Aider` · `Continue.dev` · `Codex CLI` · `Codex Exec` · `Codex Review`

</td>
</tr>
</table>

---

## 📸 Screenshots

### Dashboard Overview

<p align="center">
  <img src="assets/screenshots/demo1.png" alt="Dashboard Overview" width="900" />
</p>

> Top-line stats (Today / Week / Month / All-time / Sessions), provider pill toggle (All / Claude / Codex), daily spend chart with source breakdown, and donut charts for cost-by-source and cost-by-model.

<br />

### Projects View

<p align="center">
  <img src="assets/screenshots/demo2.png" alt="Projects View" width="900" />
</p>

> Cost grouped by working directory — see which projects burn through your token budget. Filter by source, model, date range, and minimum cost.

<br />

### Session Log — Timeline

<p align="center">
  <img src="assets/screenshots/demo3.png" alt="Session Log Timeline" width="900" />
</p>

> Day-by-day session timeline with expandable rows. Color-coded model chips (Claude + GPT/Codex), full token breakdown (input / output / cache read / cache write), and per-day totals.

<br />

### Peak Hours Heatmap

<p align="center">
  <img src="assets/screenshots/demo4.png" alt="Peak Hours Heatmap" width="900" />
</p>

> Hour × day activity grid revealing your most productive — and most expensive — coding hours.

<br />

### Session Detail

<p align="center">
  <img src="assets/screenshots/demo5.png" alt="Session Detail Panel" width="420" />
</p>

> Drill into any session: token breakdown (including Codex reasoning tokens), conversation preview, and a one-click resume command (`claude --resume <id>` for Claude Code, `codex resume <id>` for Codex).

---

## 🚀 Features

<table>
<tr>
<td width="33%" valign="top">

#### 🔍 Discovery
- Claude + Codex auto-detection
- 10+ supported tools
- Silent fallback for missing tools
- Smart provider-aware deduplication

</td>
<td width="33%" valign="top">

#### 📊 Analytics
- Daily / weekly / monthly / all-time
- Per-provider, per-model, per-source breakdown
- Per-project cost rollup
- Monthly cost projections
- Yesterday delta comparison

</td>
<td width="33%" valign="top">

#### 🎨 Visualization
- Dark-themed dashboard
- Chart.js animated charts
- Two heatmap views
- Animated stat counters
- Responsive layouts

</td>
</tr>
<tr>
<td valign="top">

#### 🧮 Cost intelligence
- Per-million-token pricing
- Opus / Sonnet / Haiku tiers (Anthropic USD)
- GPT-5.x / Codex tiers (OpenAI API USD)
- Cache read / write + reasoning tokens
- Most-expensive-session callout

</td>
<td valign="top">

#### 🔎 Filtering & search
- Provider pill (All / Claude / Codex)
- Multi-criteria filters with chips
- Source / model / date range
- Minimum cost threshold

</td>
<td valign="top">

#### ⚡ Productivity
- Standalone `.app` bundle
- Premium build with automatic update checks
- Keyboard shortcuts (`Shift+E`)
- One-click session resume (Claude + Codex)
- Browser-mode fallback

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Option 1 — Premium Build (Convenience)

The source code is free, but the premium build is the easiest way to use the app on macOS.

- **Price:** $9 one-time purchase
- **Includes:** signed macOS app, license management, automatic update checks, and one-click updates
- **Requirements:** Node.js v16+ · macOS 12.0+

<p>
  <a href="https://buy.polar.sh/polar_cl_1ljeQzFXHTipMnCtDF7Od6hFug67DBci8CToc083Wxj"><strong>Buy Premium Build →</strong></a>
</p>

After purchase, download the `.dmg`, open it, drag **AI Usage Tracker** to **Applications**, and launch.

<br />

### Option 2 — Build From Source (Free)

```bash
git clone https://github.com/658jjh/claude-usage-tracker.git
cd claude-usage-tracker
./build-app.sh
```

Then double-click **AI Usage Tracker.app** — it collects fresh data and renders everything in a native window.

The source build is open source and does not include the premium license gate or premium update checker.

<br />

### Option 3 — Browser Mode (any OS)

```bash
cd src
node collect-usage.js
python3 -m http.server 8765
open http://localhost:8765/dashboard.html
```

> [!NOTE]
> Upgrading from 2.x? Your data carries over automatically — the app migrates `~/Library/Application Support/ClaudeUsageTracker` → `AIUsageTracker` on first launch.

---

## 📦 Supported Tools

<table>
<tr>
<th>Tool</th>
<th>Provider</th>
<th>Data Location</th>
<th>Format</th>
</tr>
<tr>
<td><strong>OpenClaw</strong> / Clawdbot</td>
<td>Claude</td>
<td><code>~/.openclaw/agents/main/sessions/</code></td>
<td>JSONL</td>
</tr>
<tr>
<td><strong>Claude Code CLI</strong></td>
<td>Claude</td>
<td><code>~/.claude/projects/</code></td>
<td>JSONL</td>
</tr>
<tr>
<td><strong>Claude Desktop</strong></td>
<td>Claude</td>
<td><code>~/Library/Application Support/Claude/</code></td>
<td>JSONL</td>
</tr>
<tr>
<td><strong>Cursor</strong></td>
<td>Claude</td>
<td><code>~/.cursor/projects/</code></td>
<td>JSONL</td>
</tr>
<tr>
<td><strong>Windsurf</strong></td>
<td>Claude</td>
<td><code>~/.windsurf/</code></td>
<td>JSONL</td>
</tr>
<tr>
<td><strong>Cline</strong></td>
<td>Claude</td>
<td><code>~/.cline/</code></td>
<td>JSONL</td>
</tr>
<tr>
<td><strong>Roo Code</strong></td>
<td>Claude</td>
<td><code>~/.roo-code/</code></td>
<td>JSONL</td>
</tr>
<tr>
<td><strong>Aider</strong></td>
<td>Claude</td>
<td><code>~/.aider/</code></td>
<td>JSONL (litellm)</td>
</tr>
<tr>
<td><strong>Continue.dev</strong></td>
<td>Claude</td>
<td><code>~/.continue/sessions/</code></td>
<td>JSON</td>
</tr>
<tr>
<td><strong>Codex CLI</strong> / Exec / Review</td>
<td>Codex</td>
<td><code>~/.codex/sessions/</code></td>
<td>JSONL (rollout-*)</td>
</tr>
</table>

> [!NOTE]
> Tool detection is automatic. If a tool isn't installed or has no data, it's silently skipped.

---

## 💰 Pricing Models

Costs are calculated using each provider's per-million-token pricing — Anthropic's published USD for Claude, OpenAI API standard USD for Codex. Totals stay comparable in a single dollar figure regardless of which provider you're viewing.

### Anthropic Claude

<table>
<tr>
<th align="left">Model</th>
<th align="right">Input</th>
<th align="right">Output</th>
<th align="right">Cache Write</th>
<th align="right">Cache Read</th>
</tr>
<tr>
<td>🔴 <strong>Opus 5.0</strong></td>
<td align="right">$20.00</td>
<td align="right">$100.00</td>
<td align="right">$25.00</td>
<td align="right">$2.00</td>
</tr>
<tr>
<td>🟠 <strong>Opus 4.5 — 4.9</strong></td>
<td align="right">$5.00</td>
<td align="right">$25.00</td>
<td align="right">$6.25</td>
<td align="right">$0.50</td>
</tr>
<tr>
<td>🟡 <strong>Opus 4.0 / 4.1</strong></td>
<td align="right">$15.00</td>
<td align="right">$75.00</td>
<td align="right">$18.75</td>
<td align="right">$1.50</td>
</tr>
<tr>
<td>🟢 <strong>Sonnet 3.5 — 4.6</strong></td>
<td align="right">$3.00</td>
<td align="right">$15.00</td>
<td align="right">$3.75</td>
<td align="right">$0.30</td>
</tr>
<tr>
<td>🔵 <strong>Haiku 4.0 / 4.5</strong></td>
<td align="right">$1.00</td>
<td align="right">$5.00</td>
<td align="right">$1.25</td>
<td align="right">$0.10</td>
</tr>
<tr>
<td>🟣 <strong>Haiku 3.0 / 3.5</strong></td>
<td align="right">$0.25</td>
<td align="right">$1.25</td>
<td align="right">$0.30</td>
<td align="right">$0.03</td>
</tr>
</table>

### OpenAI Codex

<table>
<tr>
<th align="left">Model</th>
<th align="right">Input</th>
<th align="right">Output</th>
<th align="right">Cache Read</th>
</tr>
<tr>
<td>🟢 <strong>GPT-5.5</strong></td>
<td align="right">$5.00</td>
<td align="right">$30.00</td>
<td align="right">$0.50</td>
</tr>
<tr>
<td>🟢 <strong>GPT-5.4</strong></td>
<td align="right">$2.50</td>
<td align="right">$15.00</td>
<td align="right">$0.25</td>
</tr>
<tr>
<td>🟢 <strong>GPT-5.4 Mini</strong></td>
<td align="right">$0.75</td>
<td align="right">$4.50</td>
<td align="right">$0.075</td>
</tr>
<tr>
<td>🟢 <strong>GPT-5.3 Codex</strong></td>
<td align="right">$1.75</td>
<td align="right">$14.00</td>
<td align="right">$0.175</td>
</tr>
<tr>
<td>🟢 <strong>GPT-5.2</strong></td>
<td align="right">$2.00</td>
<td align="right">$10.00</td>
<td align="right">$0.20</td>
</tr>
</table>

<sub>All prices in USD per million tokens. OpenAI bills reasoning tokens as part of <code>output_tokens</code>, so they aren't double-counted — the dashboard shows reasoning separately in the session detail modal for visibility only.</sub>

---

## 🤝 Contributing

Contributions are welcome — bug fixes, new tool integrations, and design improvements all encouraged.

```bash
1. Fork the repository
2. Create a feature branch:  git checkout -b feat/my-feature
3. Commit your changes:      git commit -m "feat: add my feature"
4. Push to your fork:        git push origin feat/my-feature
5. Open a Pull Request
```

Please follow the existing code style and commit message conventions (`feat:`, `fix:`, `docs:`, `chore:`).

#### 💡 Ideas for contributions

- 🔌 Add support for additional AI tools (Gemini CLI, Copilot CLI, etc.)
- 📱 Improve mobile responsiveness
- 📤 Add data export (CSV, JSON)
- 🔔 Add cost alerts / budget thresholds
- 🐧 Linux / Windows path support
- 🖥️ Electron or Tauri desktop app

---

## 📄 License

This project is licensed under the [**MIT License**](LICENSE).

---

<div align="center">

### Built with ❤️ for the AI developer community

<br />

#### ☕ Support the project

If this tool saves you time, consider buying the premium convenience build or buying me a coffee:

<p>
  <a href="https://buy.polar.sh/polar_cl_1ljeQzFXHTipMnCtDF7Od6hFug67DBci8CToc083Wxj"><strong>Buy Premium Build — $9</strong></a>
</p>

<a href="https://buymeacoffee.com/stevie658jjh">
  <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buymeacoffee&logoColor=black" alt="Buy Me a Coffee" />
</a>

<br /><br />

<sub>Made by developers, for developers. Star ⭐ the repo if you find it useful.</sub>

</div>
