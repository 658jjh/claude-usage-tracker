#!/usr/bin/env node
/**
 * AI Usage Collector v4
 *
 * Tracks usage across local AI coding tools (Claude + Codex):
 *   ✅ OpenClaw / Clawdbot      (~/.openclaw/ , ~/.clawdbot/)
 *   ✅ Claude Code CLI           (~/.claude/projects/)
 *   ✅ Claude Desktop (Agent)    (~/Library/Application Support/Claude/local-agent-mode-sessions/)
 *   ✅ Cursor                    (~/.cursor/ or ~/Library/Application Support/Cursor/)
 *   ✅ Windsurf                  (~/.windsurf/ or ~/Library/Application Support/Windsurf/)
 *   ✅ Cline (VS Code ext)       (~/.cline/ or VS Code extension storage)
 *   ✅ Roo Code (VS Code ext)    (~/.roo-code/ or VS Code extension storage)
 *   ✅ Continue.dev              (~/.continue/)
 *   ✅ Aider                     (~/.aider/)
 * 
 * Auto-detects which tools are installed and parses their JSONL/log files.
 * Attributes costs to actual dates from timestamps (not file mod dates).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// CLAUDE_USAGE_DATA_DIR lets the macOS app redirect output outside the
// .app bundle; standalone CLI runs default to src/data/.
const OUTPUT_DIR = process.env.CLAUDE_USAGE_DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const CACHE_FILE = path.join(OUTPUT_DIR, 'sessions-cache.json');
// Fingerprint of every JSONL file we've already parsed: {filePath: {mtime,size}}.
// Lets us skip re-parsing files that haven't changed since the last run.
const SCAN_INDEX_FILE = path.join(OUTPUT_DIR, 'scan-index.json');

const PRICING_FILE = path.join(__dirname, 'pricing.json');
let customPricing = {};
try {
  customPricing = JSON.parse(fs.readFileSync(PRICING_FILE, 'utf-8'));
  delete customPricing._comment;
} catch { customPricing = {}; }

const HOME = os.homedir();
const TZ_OFFSET = -new Date().getTimezoneOffset() / 60;

// ─── Helpers ─────────────────────────────────────────────

function toLocalDate(timestampMs) {
  if (!timestampMs) return null;
  const d = new Date(timestampMs + TZ_OFFSET * 3600000);
  return d.toISOString().split('T')[0];
}

function toLocalTime(timestampMs) {
  if (!timestampMs) return null;
  const d = new Date(timestampMs + TZ_OFFSET * 3600000);
  return d.toISOString().split('T')[1].substring(0, 5);
}

function parseTimestamp(ts) {
  if (!ts) return null;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

function getPricing(model) {
  if (model && customPricing[model]) {
    const p = customPricing[model];
    return { input: p.input || 0, output: p.output || 0, cacheWrite: p.cacheWrite || 0, cacheRead: p.cacheRead || 0 };
  }
  if (!model) return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
  const m = model.toLowerCase();
  if (m.includes('opus-5'))
    return { input: 20, output: 100, cacheWrite: 25, cacheRead: 2.0 };
  if (m.includes('opus-4-5') || m.includes('opus-4.5') || m.includes('opus-4-6') || m.includes('opus-4.6') || m.includes('opus-4-7') || m.includes('opus-4.7') || m.includes('opus-4-8') || m.includes('opus-4.8') || m.includes('opus-4-9') || m.includes('opus-4.9'))
    return { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.50 };
  if (m.includes('opus-4-1') || m.includes('opus-4.1'))
    return { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 };
  if (m.includes('opus'))
    return { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 };
  if (m.includes('sonnet'))
    return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
  if (m.includes('haiku-4-5') || m.includes('haiku-4.5'))
    return { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.10 };
  if (m.includes('haiku'))
    return { input: 0.25, output: 1.25, cacheWrite: 0.30, cacheRead: 0.03 };
  return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
}

// OpenAI API standard USD per 1M tokens. cacheWrite is 0 (no equivalent).
function getCodexPricing(model) {
  if (!model) return { input: 2.5, output: 15, cacheWrite: 0, cacheRead: 0.25 };
  const m = model.toLowerCase().replace(/_/g, '-');
  if (m.includes('gpt-5-5') || m.includes('gpt-5.5'))
    return { input: 5.00, output: 30.00, cacheWrite: 0, cacheRead: 0.50 };
  if (m.includes('gpt-5-4-mini') || m.includes('gpt-5.4-mini'))
    return { input: 0.75, output: 4.50, cacheWrite: 0, cacheRead: 0.075 };
  if (m.includes('gpt-5-4') || m.includes('gpt-5.4'))
    return { input: 2.50, output: 15.00, cacheWrite: 0, cacheRead: 0.25 };
  if (m.includes('gpt-5-3-codex') || m.includes('gpt-5.3-codex'))
    return { input: 1.75, output: 14.00, cacheWrite: 0, cacheRead: 0.175 };
  if (m.includes('gpt-5-2') || m.includes('gpt-5.2'))
    return { input: 2.00, output: 10.00, cacheWrite: 0, cacheRead: 0.20 };
  if (m.startsWith('gpt-') || m.includes('codex')) {
    process.stderr.write(`[collect-usage] Unknown Codex model "${model}" — using gpt-5.4 pricing\n`);
  }
  return { input: 2.50, output: 15.00, cacheWrite: 0, cacheRead: 0.25 };
}

function findJsonl(dir, maxDepth = 10) {
  const results = [];
  if (maxDepth <= 0) return results;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.git')) {
        results.push(...findJsonl(fullPath, maxDepth - 1));
      } else if (entry.name.endsWith('.jsonl') && !entry.name.includes('audit')) {
        results.push(fullPath);
      }
    }
  } catch {}
  return results;
}

function makeDayEntry() {
  return { cost: 0, input_tokens: 0, output_tokens: 0, cache_read: 0, cache_write: 0, reasoning_tokens: 0, models: new Set(), times: [] };
}

function cleanMessageText(text) {
  text = text.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim();
  text = text.replace(/<[^>]+>/g, '').trim();
  text = text.replace(/^\[SUGGESTION MODE:[^\]]*\]\s*/i, '').trim();
  const cronMatch = text.match(/^\[cron:[a-f0-9-]+\s+([^\]]*)\]\s*(.*)/i);
  if (cronMatch) {
    text = cronMatch[1].trim() + (cronMatch[2] ? ' — ' + cronMatch[2].trim() : '');
  }
  return text;
}

function extractText(msg) {
  if (!msg || typeof msg !== 'object') return '';
  const content = msg.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    if (content.some(b => b.type === 'tool_result')) return '';
    const textBlock = content.find(c => c.type === 'text' && c.text && c.text.trim());
    return textBlock ? textBlock.text : '';
  }
  return '';
}

// Conversation history is NOT stored here — it's read on-demand when the
// user opens the detail modal, so the cache + data.js payload stays small.
function extractSessionMeta(filePath) {
  const meta = { title: '', sessionId: '', cwd: '' };
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    let foundTitle = false;

    for (const line of lines) {
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }

      if (!meta.sessionId && entry.sessionId) meta.sessionId = entry.sessionId;
      if (!meta.cwd && entry.cwd) meta.cwd = entry.cwd;

      const msg = entry.message;
      if (!msg || typeof msg !== 'object') continue;
      const role = msg.role;
      if (role !== 'user' && role !== 'assistant') continue;

      // Bail as soon as we have everything to avoid walking the full file.
      if (foundTitle && meta.sessionId && meta.cwd) break;

      if (!foundTitle && role === 'user') {
        const rawText = extractText(msg);
        if (!rawText) continue;
        const text = cleanMessageText(rawText);
        if (!text) continue;
        meta.title = text.length > 80 ? text.substring(0, 77) + '...' : text;
        foundTitle = true;
      }
    }
  } catch {}
  if (!meta.sessionId) {
    const base = path.basename(filePath, '.jsonl');
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(base)) {
      meta.sessionId = base;
    }
  }
  return meta;
}

function pushSessions(sessions, dayData, source, fileName, meta, filePath, provider) {
  meta = meta || {};
  provider = provider || 'claude';
  const effectiveSource = meta.source || source;
  for (const [date, data] of Object.entries(dayData)) {
    if (data.cost < 0.0001 && data.input_tokens === 0 && data.output_tokens === 0) continue;
    const models = [...data.models];
    const time = data.times.length > 0 ? data.times.sort()[0] : '00:00';
    const entry = {
      date,
      time,
      provider,
      source: effectiveSource,
      file: fileName,
      cost: parseFloat(data.cost.toFixed(4)),
      input_tokens: data.input_tokens,
      output_tokens: data.output_tokens,
      cache_read: data.cache_read,
      cache_write: data.cache_write,
      model: models[models.length - 1] || ''
    };
    if (data.reasoning_tokens) entry.reasoning_tokens = data.reasoning_tokens;
    if (filePath) entry.filePath = filePath;
    if (meta.title) entry.title = meta.title;
    if (meta.sessionId) entry.sessionId = meta.sessionId;
    if (meta.cwd) entry.cwd = meta.cwd;
    sessions.push(entry);
  }
}

// ─── Cache helpers ───────────────────────────────────────

function loadCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return [];
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      console.warn('⚠️  Cache file has unexpected format, ignoring.');
      return [];
    }
    const valid = data.filter(s =>
      s && typeof s.source === 'string' && typeof s.file === 'string' &&
      typeof s.date === 'string' && typeof s.cost === 'number'
    );
    if (valid.length < data.length) {
      console.warn(`⚠️  Filtered out ${data.length - valid.length} malformed cache entries`);
    }
    // Pre-v4 caches embedded full history; details are now lazy-loaded.
    let strippedHistory = 0;
    let backfilledProvider = 0;
    for (const s of valid) {
      if (s.history) { delete s.history; strippedHistory++; }
      if (!s.provider) {
        s.provider = (s.source && s.source.startsWith('Codex')) ? 'codex' : 'claude';
        backfilledProvider++;
      }
    }
    if (strippedHistory > 0) {
      console.log(`🗜️  Stripped legacy history from ${strippedHistory} cache entries`);
    }
    if (backfilledProvider > 0) {
      console.log(`🔖 Backfilled provider on ${backfilledProvider} legacy cache entries`);
    }
    return valid;
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.warn(`⚠️  Could not load cache: ${e.message}`);
    }
    return [];
  }
}

function saveCache(sessions) {
  try {
    const tmpFile = CACHE_FILE + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(sessions));
    fs.renameSync(tmpFile, CACHE_FILE);
  } catch (e) {
    console.warn(`⚠️  Could not save cache: ${e.message}`);
  }
}

function mergeSessions(freshSessions, cachedSessions) {
  const freshKeys = new Set();
  for (const s of freshSessions) {
    freshKeys.add(`${s.source}|${s.file}|${s.date}`);
  }
  const merged = [...freshSessions];
  for (const s of cachedSessions) {
    const key = `${s.source}|${s.file}|${s.date}`;
    if (!freshKeys.has(key)) {
      merged.push(s);
    }
  }
  return merged;
}

// ─── Scan index (mtime fingerprint) ──────────────────────
// Remember mtime+size per file from the previous run and skip re-parsing
// files that haven't changed — drops steady-state launches from ~20s to <1s.

function loadScanIndex() {
  try {
    if (!fs.existsSync(SCAN_INDEX_FILE)) return {};
    const raw = fs.readFileSync(SCAN_INDEX_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
  } catch {
    return {};
  }
}

function saveScanIndex(index) {
  try {
    const tmp = SCAN_INDEX_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(index));
    fs.renameSync(tmp, SCAN_INDEX_FILE);
  } catch (e) {
    console.warn(`⚠️  Could not save scan index: ${e.message}`);
  }
}

let _scanIndex = {};
let _newScanIndex = {};
let _cachedByFilePath = new Map();
const _seenFilePaths = new Set();
let _skipCount = 0;
let _parseCount = 0;

function processJsonlFile(sessions, source, fullPath, parser, options) {
  const opts = options || {};
  const provider = opts.provider || 'claude';
  const metaExtractor = opts.metaExtractor || extractSessionMeta;
  let stat;
  try { stat = fs.statSync(fullPath); } catch { return; }
  _seenFilePaths.add(fullPath);

  const prev = _scanIndex[fullPath];
  const cached = _cachedByFilePath.get(fullPath);
  if (prev && cached && prev.mtime === stat.mtimeMs && prev.size === stat.size) {
    for (const entry of cached) sessions.push(entry);
    _newScanIndex[fullPath] = prev;
    _skipCount++;
    return;
  }

  try {
    const dayData = parser(fullPath);
    const meta = metaExtractor(fullPath);
    pushSessions(sessions, dayData, source, path.basename(fullPath), meta, fullPath, provider);
    _newScanIndex[fullPath] = { mtime: stat.mtimeMs, size: stat.size };
    _parseCount++;
  } catch (e) {
    console.error(`  Error: ${fullPath}: ${e.message}`);
  }
}

// ─── Parser: OpenClaw / Clawdbot format ──────────────────
function parseOpenClawFormat(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const dayData = {};
  let fallbackDate = null;
  try { fallbackDate = toLocalDate(fs.statSync(filePath).mtimeMs); } catch {}

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const msg = entry.message;
    const usage = (msg && msg.usage) || entry.usage;
    if (!usage) continue;
    if (!usage.cost && !usage.input && !usage.output) continue;

    const model = (msg && msg.model) || entry.model || '';
    // OpenClaw also routes non-Claude traffic — skip anything not on a Claude model.
    if (!model || !model.startsWith('claude')) continue;

    let tsMs = parseTimestamp(entry.timestamp) || parseTimestamp(msg && msg.timestamp);
    let date = tsMs ? toLocalDate(tsMs) : fallbackDate;
    let time = tsMs ? toLocalTime(tsMs) : '00:00';
    if (!date) continue;

    if (!dayData[date]) dayData[date] = makeDayEntry();
    const dd = dayData[date];
    if (time) dd.times.push(time);

    dd.models.add(model);

    if (usage.cost && usage.cost.total) {
      dd.cost += usage.cost.total;
    } else {
      const pricing = getPricing(model);
      const inp = usage.input || 0;
      const out = usage.output || 0;
      const cr = usage.cacheRead || 0;
      const cw = usage.cacheWrite || 0;
      dd.cost += (inp * pricing.input + out * pricing.output + cw * pricing.cacheWrite + cr * pricing.cacheRead) / 1000000;
    }
    dd.input_tokens += (usage.input || 0);
    dd.output_tokens += (usage.output || 0);
    dd.cache_read += (usage.cacheRead || 0);
    dd.cache_write += (usage.cacheWrite || 0);
  }
  return dayData;
}

// ─── Parser: Claude Code / Desktop / Cursor / Windsurf format ────
function parseClaudeCodeFormat(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const dayData = {};
  let fallbackDate = null;
  try { fallbackDate = toLocalDate(fs.statSync(filePath).mtimeMs); } catch {}

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const msg = entry.message;
    const usage = (msg && msg.usage) || entry.usage;
    if (!usage) continue;

    const inputTok = usage.input_tokens || 0;
    const outputTok = usage.output_tokens || 0;
    const cacheWrite = usage.cache_creation_input_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;
    if (inputTok === 0 && outputTok === 0 && cacheRead === 0 && cacheWrite === 0) continue;

    let tsMs = parseTimestamp(entry.timestamp) || parseTimestamp(msg && msg.timestamp);
    let date = tsMs ? toLocalDate(tsMs) : fallbackDate;
    let time = tsMs ? toLocalTime(tsMs) : '00:00';
    if (!date) continue;

    if (!dayData[date]) dayData[date] = makeDayEntry();
    const dd = dayData[date];
    if (time) dd.times.push(time);

    const model = (msg && msg.model) || entry.model || '';
    if (model) dd.models.add(model);

    dd.input_tokens += inputTok;
    dd.output_tokens += outputTok;
    dd.cache_read += cacheRead;
    dd.cache_write += cacheWrite;

    const pricing = getPricing(model);
    dd.cost += (inputTok * pricing.input + outputTok * pricing.output + cacheWrite * pricing.cacheWrite + cacheRead * pricing.cacheRead) / 1000000;
  }
  return dayData;
}

// ─── Parser: Aider format ────────────────────────────────
function parseAiderFormat(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const dayData = {};
  let fallbackDate = null;
  try { fallbackDate = toLocalDate(fs.statSync(filePath).mtimeMs); } catch {}

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }

    const usage = entry.usage || entry.response?.usage;
    if (!usage) continue;

    const inputTok = usage.prompt_tokens || usage.input_tokens || 0;
    const outputTok = usage.completion_tokens || usage.output_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;
    const cacheWrite = usage.cache_creation_input_tokens || 0;
    if (inputTok === 0 && outputTok === 0) continue;

    let tsMs = parseTimestamp(entry.timestamp) || parseTimestamp(entry.created);
    // Aider uses Unix epoch seconds.
    if (entry.created && typeof entry.created === 'number' && entry.created < 2000000000) {
      tsMs = entry.created * 1000;
    }
    let date = tsMs ? toLocalDate(tsMs) : fallbackDate;
    let time = tsMs ? toLocalTime(tsMs) : '00:00';
    if (!date) continue;

    if (!dayData[date]) dayData[date] = makeDayEntry();
    const dd = dayData[date];
    if (time) dd.times.push(time);

    const model = entry.model || '';
    if (model && model.includes('claude')) dd.models.add(model);

    dd.input_tokens += inputTok;
    dd.output_tokens += outputTok;
    dd.cache_read += cacheRead;
    dd.cache_write += cacheWrite;

    const pricing = getPricing(model);
    dd.cost += (inputTok * pricing.input + outputTok * pricing.output + cacheWrite * pricing.cacheWrite + cacheRead * pricing.cacheRead) / 1000000;
  }
  return dayData;
}

// ─── Parser: Continue.dev format ─────────────────────────
function parseContinueFormat(filePath) {
  const dayData = {};
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const steps = data.steps || data.history || [];
    for (const step of steps) {
      const usage = step.usage || step.promptTokens ? { input_tokens: step.promptTokens || 0, output_tokens: step.completionTokens || 0 } : null;
      if (!usage && !step.tokens) continue;

      const inputTok = usage?.input_tokens || step.promptTokens || 0;
      const outputTok = usage?.output_tokens || step.completionTokens || 0;
      if (inputTok === 0 && outputTok === 0) continue;

      let tsMs = parseTimestamp(step.timestamp) || parseTimestamp(data.dateCreated);
      let date = tsMs ? toLocalDate(tsMs) : null;
      let time = tsMs ? toLocalTime(tsMs) : '00:00';
      if (!date) {
        try { date = toLocalDate(fs.statSync(filePath).mtimeMs); } catch { continue; }
      }

      if (!dayData[date]) dayData[date] = makeDayEntry();
      const dd = dayData[date];
      if (time) dd.times.push(time);

      const model = step.model || data.model || '';
      if (model && model.includes('claude')) dd.models.add(model);

      dd.input_tokens += inputTok;
      dd.output_tokens += outputTok;

      const pricing = getPricing(model);
      dd.cost += (inputTok * pricing.input + outputTok * pricing.output) / 1000000;
    }
  } catch {}
  return dayData;
}

// ─── Parser: Codex CLI format (~/.codex/sessions/**/rollout-*.jsonl) ────
function parseCodexFormat(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const dayData = {};
  let fallbackDate = null;
  try { fallbackDate = toLocalDate(fs.statSync(filePath).mtimeMs); } catch {}
  let currentModel = '';
  let lastCumulative = null;

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const payload = entry.payload;
    if (!payload || typeof payload !== 'object') continue;

    if (entry.type === 'turn_context' && payload.model) {
      currentModel = payload.model;
      continue;
    }

    if (entry.type !== 'event_msg' || payload.type !== 'token_count') continue;
    const info = payload.info;
    if (!info) continue;

    let usage = info.last_token_usage;
    if (!usage && info.total_token_usage) {
      // Diff against cumulative; clamp to 0 on mid-session resets.
      const total = info.total_token_usage;
      if (lastCumulative) {
        usage = {
          input_tokens: Math.max(0, (total.input_tokens || 0) - (lastCumulative.input_tokens || 0)),
          cached_input_tokens: Math.max(0, (total.cached_input_tokens || 0) - (lastCumulative.cached_input_tokens || 0)),
          output_tokens: Math.max(0, (total.output_tokens || 0) - (lastCumulative.output_tokens || 0)),
          reasoning_output_tokens: Math.max(0, (total.reasoning_output_tokens || 0) - (lastCumulative.reasoning_output_tokens || 0)),
        };
      } else {
        usage = {
          input_tokens: total.input_tokens || 0,
          cached_input_tokens: total.cached_input_tokens || 0,
          output_tokens: total.output_tokens || 0,
          reasoning_output_tokens: total.reasoning_output_tokens || 0,
        };
      }
      lastCumulative = total;
    } else if (info.total_token_usage) {
      lastCumulative = info.total_token_usage;
    }
    if (!usage) continue;

    const inputTok = usage.input_tokens || 0;
    const cachedTok = usage.cached_input_tokens || 0;
    const outputTok = usage.output_tokens || 0;
    const reasoningTok = usage.reasoning_output_tokens || 0;
    if (inputTok === 0 && outputTok === 0 && cachedTok === 0) continue;

    let tsMs = parseTimestamp(entry.timestamp);
    let date = tsMs ? toLocalDate(tsMs) : fallbackDate;
    let time = tsMs ? toLocalTime(tsMs) : '00:00';
    if (!date) continue;

    if (!dayData[date]) dayData[date] = makeDayEntry();
    const dd = dayData[date];
    if (time) dd.times.push(time);
    if (currentModel) dd.models.add(currentModel);

    // OpenAI's input_tokens already includes cached; bill non-cached at full input rate.
    const nonCached = Math.max(0, inputTok - cachedTok);
    dd.input_tokens += inputTok;
    dd.output_tokens += outputTok;
    dd.cache_read += cachedTok;
    dd.reasoning_tokens += reasoningTok;

    const pricing = getCodexPricing(currentModel);
    // Output already includes reasoning per OpenAI — do NOT add reasoning separately.
    dd.cost += (nonCached * pricing.input + cachedTok * pricing.cacheRead + outputTok * pricing.output) / 1_000_000;
  }
  return dayData;
}

// Returns { title, sessionId, cwd, source } — source is one of
// "Codex CLI" / "Codex Exec" / "Codex Review" / "Codex".
function extractCodexMeta(filePath) {
  const meta = { title: '', sessionId: '', cwd: '', source: 'Codex' };
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let foundTitle = false;
    for (const line of lines) {
      if (!line.trim()) continue;
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }
      const payload = entry.payload;
      if (!payload) continue;

      if (entry.type === 'session_meta') {
        if (!meta.sessionId && payload.id) meta.sessionId = payload.id;
        if (!meta.cwd && payload.cwd) meta.cwd = payload.cwd;
        const src = payload.source;
        const subagent = (src && typeof src === 'object' && src.subagent)
          || (payload.subagent);
        if (subagent === 'review') {
          meta.source = 'Codex Review';
        } else if (src === 'cli' || (src && src.kind === 'cli')) {
          meta.source = 'Codex CLI';
        } else if (src === 'exec' || (src && src.kind === 'exec')) {
          meta.source = 'Codex Exec';
        } else {
          meta.source = 'Codex';
        }
      }

      if (!foundTitle && entry.type === 'response_item'
          && payload.type === 'message' && payload.role === 'user'
          && Array.isArray(payload.content)) {
        for (const block of payload.content) {
          if (!block) continue;
          const text = typeof block === 'string'
            ? block
            : (block.text || '');
          if (!text || !text.trim()) continue;
          if (/^<environment_context>/i.test(text.trim())) continue;
          if (/^<permissions instructions>/i.test(text.trim())) continue;
          const cleaned = cleanMessageText(text).trim();
          if (!cleaned) continue;
          meta.title = cleaned.length > 80 ? cleaned.substring(0, 77) + '...' : cleaned;
          foundTitle = true;
          break;
        }
      }

      if (foundTitle && meta.sessionId && meta.cwd) break;
    }
  } catch {}
  if (!meta.sessionId) {
    const base = path.basename(filePath, '.jsonl');
    const m = base.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);
    if (m) meta.sessionId = m[1];
  }
  return meta;
}

// ─── Source Collectors ───────────────────────────────────

function collectOpenClaw() {
  const sessions = [];
  const seenFiles = new Set();
  for (const dirName of ['openclaw', 'clawdbot']) {
    const sessDir = path.join(HOME, `.${dirName}/agents/main/sessions`);
    if (!fs.existsSync(sessDir)) continue;
    const source = dirName === 'openclaw' ? 'OpenClaw' : 'Clawdbot';
    const files = fs.readdirSync(sessDir).filter(f => f.endsWith('.jsonl'));
    for (const file of files) {
      if (seenFiles.has(file)) continue;
      seenFiles.add(file);
      processJsonlFile(sessions, source, path.join(sessDir, file), parseOpenClawFormat);
    }
  }
  return sessions;
}

function collectClaudeCode() {
  const sessions = [];
  const claudeDir = path.join(HOME, '.claude/projects');
  if (!fs.existsSync(claudeDir)) return sessions;
  for (const filePath of findJsonl(claudeDir)) {
    processJsonlFile(sessions, 'Claude Code', filePath, parseClaudeCodeFormat);
  }
  return sessions;
}

function collectClaudeDesktop() {
  const sessions = [];
  const baseDir = path.join(HOME, 'Library/Application Support/Claude/local-agent-mode-sessions');
  if (!fs.existsSync(baseDir)) return sessions;
  for (const filePath of findJsonl(baseDir)) {
    processJsonlFile(sessions, 'Claude Desktop', filePath, parseClaudeCodeFormat);
  }
  return sessions;
}

function collectCursor() {
  const sessions = [];
  const searchDirs = [
    path.join(HOME, '.cursor/projects'),
    path.join(HOME, 'Library/Application Support/Cursor/User/workspaceStorage'),
  ];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const filePath of findJsonl(dir)) {
      processJsonlFile(sessions, 'Cursor', filePath, parseClaudeCodeFormat);
    }
  }
  return sessions;
}

function collectWindsurf() {
  const sessions = [];
  const searchDirs = [
    path.join(HOME, '.windsurf/projects'),
    path.join(HOME, '.windsurf'),
    path.join(HOME, 'Library/Application Support/Windsurf/User/workspaceStorage'),
  ];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const filePath of findJsonl(dir)) {
      processJsonlFile(sessions, 'Windsurf', filePath, parseClaudeCodeFormat);
    }
  }
  return sessions;
}

function collectCline() {
  const sessions = [];
  const searchDirs = [
    path.join(HOME, '.cline'),
    path.join(HOME, 'Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev'),
    path.join(HOME, 'Library/Application Support/Code/User/globalStorage/cline.cline'),
  ];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const filePath of findJsonl(dir)) {
      processJsonlFile(sessions, 'Cline', filePath, parseClaudeCodeFormat);
    }
  }
  return sessions;
}

function collectRooCode() {
  const sessions = [];
  const searchDirs = [
    path.join(HOME, '.roo-code'),
    path.join(HOME, 'Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline'),
  ];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const filePath of findJsonl(dir)) {
      processJsonlFile(sessions, 'Roo Code', filePath, parseClaudeCodeFormat);
    }
  }
  return sessions;
}

function collectAider() {
  const sessions = [];
  const searchDirs = [
    path.join(HOME, '.aider'),
    path.join(HOME, '.aider/logs'),
  ];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    let entries;
    try { entries = fs.readdirSync(dir); } catch { continue; }
    for (const f of entries) {
      if (!f.endsWith('.jsonl') && !f.endsWith('.json')) continue;
      processJsonlFile(sessions, 'Aider', path.join(dir, f), parseAiderFormat);
    }
  }
  return sessions;
}

function collectContinue() {
  const sessions = [];
  const sessDir = path.join(HOME, '.continue/sessions');
  if (!fs.existsSync(sessDir)) return sessions;
  let entries;
  try { entries = fs.readdirSync(sessDir); } catch { return sessions; }
  for (const f of entries) {
    if (!f.endsWith('.json')) continue;
    processJsonlFile(sessions, 'Continue', path.join(sessDir, f), parseContinueFormat);
  }
  return sessions;
}

function collectCodex() {
  const sessions = [];
  const sessDir = path.join(HOME, '.codex/sessions');
  if (!fs.existsSync(sessDir)) return sessions;
  for (const filePath of findJsonl(sessDir)) {
    if (!path.basename(filePath).startsWith('rollout-')) continue;
    processJsonlFile(sessions, 'Codex', filePath, parseCodexFormat, {
      provider: 'codex',
      metaExtractor: extractCodexMeta,
    });
  }
  return sessions;
}

// ─── Main ────────────────────────────────────────────────

console.log('AI Usage Collector v4');
console.log('======================\n');

const sources = [
  { name: 'OpenClaw / Clawdbot', fn: collectOpenClaw },
  { name: 'Claude Code CLI',     fn: collectClaudeCode },
  { name: 'Claude Desktop',      fn: collectClaudeDesktop },
  { name: 'Cursor',              fn: collectCursor },
  { name: 'Windsurf',            fn: collectWindsurf },
  { name: 'Cline',               fn: collectCline },
  { name: 'Roo Code',            fn: collectRooCode },
  { name: 'Aider',               fn: collectAider },
  { name: 'Continue.dev',        fn: collectContinue },
  { name: 'Codex',               fn: collectCodex },
];

let allSessions = [];
const sourceResults = {};

const cachedSessions = loadCache();
_scanIndex = loadScanIndex();
_newScanIndex = {};
_cachedByFilePath = new Map();
for (const s of cachedSessions) {
  if (!s.filePath) continue;
  const arr = _cachedByFilePath.get(s.filePath);
  if (arr) { arr.push(s); } else { _cachedByFilePath.set(s.filePath, [s]); }
}

const scanStartedAt = Date.now();
for (const { name, fn } of sources) {
  process.stdout.write(`Scanning ${name}... `);
  const sessions = fn();
  if (sessions.length > 0) {
    console.log(`✅ ${sessions.length} session-day entries`);
    sourceResults[name] = sessions.length;
  } else {
    console.log(`— not found or empty`);
  }
  allSessions.push(...sessions);
}

const scanMs = Date.now() - scanStartedAt;
console.log(`\n⚡ Scan: ${_parseCount} parsed, ${_skipCount} skipped (unchanged) in ${scanMs}ms`);

// Preserve historical / cross-machine imported entries whose filePath isn't
// resolvable on this run.
let preservedHistorical = 0;
for (const s of cachedSessions) {
  if (!s.filePath || !_seenFilePaths.has(s.filePath)) {
    allSessions.push(s);
    preservedHistorical++;
  }
}
if (preservedHistorical > 0) {
  console.log(`📦 Preserved ${preservedHistorical} historical/imported entries`);
}

const dedupedMap = new Map();
for (const s of allSessions) {
  const p = s.provider || 'claude';
  dedupedMap.set(`${p}|${s.source}|${s.file}|${s.date}`, s);
}
allSessions = [...dedupedMap.values()];
console.log(`📊 Total after merge: ${allSessions.length} session-day entries\n`);

saveScanIndex(_newScanIndex);

const today = toLocalDate(Date.now());
const currentMonth = today.substring(0, 7);

const sourceTotals = {};
const sourceCounts = {};
const providerTotals = { claude: 0, codex: 0 };
allSessions.forEach(s => {
  sourceTotals[s.source] = (sourceTotals[s.source] || 0) + s.cost;
  sourceCounts[s.source] = (sourceCounts[s.source] || 0) + 1;
  const p = s.provider || 'claude';
  providerTotals[p] = (providerTotals[p] || 0) + s.cost;
});
const grandTotal = allSessions.reduce((s, x) => s + x.cost, 0);

for (const key of Object.keys(sourceTotals)) {
  sourceTotals[key] = parseFloat(sourceTotals[key].toFixed(2));
}
for (const key of Object.keys(providerTotals)) {
  providerTotals[key] = parseFloat(providerTotals[key].toFixed(2));
}

const todayCost = allSessions.filter(s => s.date === today).reduce((s, x) => s + x.cost, 0);
const monthCost = allSessions.filter(s => s.date.startsWith(currentMonth)).reduce((s, x) => s + x.cost, 0);

const summary = {
  generated_at: new Date().toISOString(),
  today,
  current_month: currentMonth,
  totals: {
    ...sourceTotals,
    grand_total: parseFloat(grandTotal.toFixed(2))
  },
  provider_totals: providerTotals,
  today_cost: parseFloat(todayCost.toFixed(2)),
  month_cost: parseFloat(monthCost.toFixed(2)),
  session_counts: {
    ...sourceCounts,
    total: allSessions.length
  }
};

const codexSessions = allSessions.filter(s => s.provider === 'codex');
const claudeOnly = allSessions.filter(s => s.provider !== 'codex');
const openclawSessions = claudeOnly.filter(s => s.source === 'OpenClaw' || s.source === 'Clawdbot');
const otherSessions = claudeOnly.filter(s => s.source !== 'OpenClaw' && s.source !== 'Clawdbot');

saveCache(allSessions);

let pricingChanged = false;
for (const s of allSessions) {
  const m = s.model;
  if (m && !customPricing[m] && !m.startsWith('claude') && !m.startsWith('gpt')) {
    customPricing[m] = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, display: m.toUpperCase(), family: 'GLM', color: '#f59e0b' };
    pricingChanged = true;
  }
}
if (pricingChanged) {
  const savePricing = { _comment: "Цены за 1M токенов в USD. Редактируйте вручную или через UI дашборда. Модели с ценами 0 — неизвестные, заполните сами.", ...customPricing };
  fs.writeFileSync(PRICING_FILE, JSON.stringify(savePricing, null, 2) + '\n');
  console.log(`Updated pricing.json with ${Object.keys(customPricing).length} model(s)`);
}

const dataJs = `// Auto-generated by collect-usage.js v4 — ${new Date().toISOString()}
window.__SUMMARY__ = ${JSON.stringify(summary, null, 2)};
window.__PRICING__ = ${JSON.stringify(customPricing)};
window.__OPENCLAW_SESSIONS__ = ${JSON.stringify(openclawSessions)};
window.__CLAUDE_SESSIONS__ = ${JSON.stringify(otherSessions)};
window.__CODEX_SESSIONS__ = ${JSON.stringify(codexSessions)};
`;
fs.writeFileSync(path.join(OUTPUT_DIR, 'data.js'), dataJs);
console.log(`📄 Data written to: ${path.join(OUTPUT_DIR, 'data.js')}`);

console.log('\n✅ Done!');
console.log('================================');
console.log(JSON.stringify(summary, null, 2));
