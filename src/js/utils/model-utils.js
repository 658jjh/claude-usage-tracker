// Per-million-token pricing in USD.
//
// Claude rates: platform.claude.com/docs/en/about-claude/pricing (verified 2026-09-19).
//   cacheWrite is the 5-minute write (1.25x input); cacheRead is a cache hit (0.1x input).
//   The 1-hour write (2x input) is not tracked separately — transcripts don't record the TTL.
//   Fable/Mythos 5.1 are an exception: cache hits are 0.025x input ($0.25/MTok).
// OpenAI rates: developers.openai.com/api/docs/pricing (verified 2026-09-19).
//   OpenAI cache writes are included for completeness; Codex transcripts expose cached
//   input tokens but not cache-write tokens, so the collector only bills cache reads.
//
// Version-family fallbacks use *current* tier pricing, not an escalation curve: Anthropic's
// per-token prices have trended down across releases (Opus 15 -> 5, Sonnet 3 -> 2), so an
// unreleased "opus-6" is far likelier to match today's Opus rate than to exceed it.

// Normalize `4.5`, `4_5` and `4-5` to a single form so each rule needs only one spelling.
const normalize = (model) => model.toLowerCase().replace(/[._]/g, '-');

export function getPricingForModel(model) {
    if (!model) return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
    const m = normalize(model);

    // ── OpenAI / Codex ────────────────────────────────────────────────────
    if (m.startsWith('gpt-') || m.includes('codex')) return getCodexPricing(m);

    // ── Claude: top tier ──────────────────────────────────────────────────
    if (m.includes('fable-5-1') || m.includes('mythos-5-1') || m.includes('mythos-preview'))
        return { input: 10, output: 50, cacheWrite: 12.50, cacheRead: 0.25 };
    if (m.includes('fable') || m.includes('mythos'))
        return { input: 10, output: 50, cacheWrite: 12.50, cacheRead: 1.00 };

    // ── Claude 3.x (version prefixes the family name) ─────────────────────
    if (m.includes('3-opus'))
        return { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 };
    if (m.includes('3-7-sonnet') || m.includes('3-5-sonnet') || m.includes('3-sonnet'))
        return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
    if (m.includes('3-5-haiku'))
        return { input: 0.80, output: 4, cacheWrite: 1.00, cacheRead: 0.08 };
    if (m.includes('3-haiku'))
        return { input: 0.25, output: 1.25, cacheWrite: 0.30, cacheRead: 0.03 };

    // ── Opus: 4.5 and later dropped to $5/$25; 4.0/4.1 stayed at $15/$75 ──
    if (/opus-4-[5-9]/.test(m))
        return { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.50 };
    if (m.includes('opus-4'))
        return { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 };
    if (m.includes('opus')) // Opus 5 and later
        return { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.50 };

    // ── Sonnet: 5 cut the rate to $2/$10; 4.x and earlier are $3/$15 ──────
    if (m.includes('sonnet-4') || m.includes('sonnet-3'))
        return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
    if (m.includes('sonnet')) // Sonnet 5 and later
        return { input: 2, output: 10, cacheWrite: 2.50, cacheRead: 0.20 };

    // ── Haiku ─────────────────────────────────────────────────────────────
    if (m.includes('haiku-3-5'))
        return { input: 0.80, output: 4, cacheWrite: 1.00, cacheRead: 0.08 };
    if (m.includes('haiku-3'))
        return { input: 0.25, output: 1.25, cacheWrite: 0.30, cacheRead: 0.03 };
    if (m.includes('haiku')) // Haiku 4.5 and later
        return { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.10 };

    // Unrecognized — assume a mid-tier Sonnet-class rate.
    return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
}

// `m` is already normalized by getPricingForModel.
function getCodexPricing(m) {
    if (m.includes('gpt-6-astra')) return { input: 10.00, output: 50.00, cacheWrite: 12.50, cacheRead: 1.00 };
    if (m.includes('gpt-5-6-terra')) return { input: 2.00, output: 12.00, cacheWrite: 2.50, cacheRead: 0.20 };
    if (m.includes('gpt-5-6-luna')) return { input: 0.20, output: 1.20, cacheWrite: 0.25, cacheRead: 0.02 };
    if (m.includes('gpt-5-6-sol') || m === 'gpt-5-6' || m.startsWith('gpt-5-6-')) return { input: 4.00, output: 20.00, cacheWrite: 5.00, cacheRead: 0.40 };

    if (m.includes('codex-mini-latest')) return { input: 1.50, output: 6.00, cacheWrite: 0, cacheRead: 0.375 };

    if (m.includes('gpt-5-5-pro')) return { input: 30.00, output: 180.00, cacheWrite: 0, cacheRead: 0 };
    if (m.includes('gpt-5-5')) return { input: 5.00, output: 30.00, cacheWrite: 0, cacheRead: 0.50 };

    if (m.includes('gpt-5-4-pro')) return { input: 30.00, output: 180.00, cacheWrite: 0, cacheRead: 0 };
    if (m.includes('gpt-5-4-nano')) return { input: 0.20, output: 1.25, cacheWrite: 0, cacheRead: 0.02 };
    if (m.includes('gpt-5-4-mini')) return { input: 0.75, output: 4.50, cacheWrite: 0, cacheRead: 0.075 };
    if (m.includes('gpt-5-4')) return { input: 2.50, output: 15.00, cacheWrite: 0, cacheRead: 0.25 };

    if (m.includes('gpt-5-3-codex')) return { input: 1.75, output: 14.00, cacheWrite: 0, cacheRead: 0.175 };

    if (m.includes('gpt-5-2-pro')) return { input: 21.00, output: 168.00, cacheWrite: 0, cacheRead: 0 };
    if (m.includes('gpt-5-2')) return { input: 1.75, output: 14.00, cacheWrite: 0, cacheRead: 0.175 };

    if (m.includes('gpt-5-mini')) return { input: 0.25, output: 2.00, cacheWrite: 0, cacheRead: 0.025 };
    if (m.includes('gpt-5-nano')) return { input: 0.05, output: 0.40, cacheWrite: 0, cacheRead: 0.005 };

    // Unknown variant — price by suffix tier, then fall back to the flagship rate.
    if (m.includes('-pro')) return { input: 30.00, output: 180.00, cacheWrite: 0, cacheRead: 0 };
    if (m.includes('-nano')) return { input: 0.20, output: 1.25, cacheWrite: 0, cacheRead: 0.02 };
    if (m.includes('-mini')) return { input: 0.75, output: 4.50, cacheWrite: 0, cacheRead: 0.075 };
    return { input: 5.00, output: 30.00, cacheWrite: 0, cacheRead: 0.50 };
}

// Most-specific matches first — order matters.
export function getModelInfo(model) {
    if (!model) return { name: 'Unknown', cls: 'model-sonnet' };
    const m = normalize(model);

    // ── OpenAI / Codex ────────────────────────────────────────────────────
    if (m.includes('gpt-6-astra')) return { name: 'GPT-6 Astra', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-6-terra')) return { name: 'GPT-5.6 Terra', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-6-luna')) return { name: 'GPT-5.6 Luna', cls: 'model-gpt-mini' };
    if (m.includes('gpt-5-6-sol') || m === 'gpt-5-6' || m.startsWith('gpt-5-6-')) return { name: 'GPT-5.6 Sol', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-5-pro')) return { name: 'GPT-5.5 Pro', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-5')) return { name: 'GPT-5.5', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-4-pro')) return { name: 'GPT-5.4 Pro', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-4-nano')) return { name: 'GPT-5.4 Nano', cls: 'model-gpt-mini' };
    if (m.includes('gpt-5-4-mini')) return { name: 'GPT-5.4 Mini', cls: 'model-gpt-mini' };
    if (m.includes('gpt-5-4')) return { name: 'GPT-5.4', cls: 'model-gpt-frontier' };
    if (m.includes('codex-mini-latest')) return { name: 'Codex Mini Latest', cls: 'model-codex' };
    if (m.includes('gpt-5-3-codex')) return { name: 'GPT-5.3 Codex', cls: 'model-codex' };
    if (m.includes('gpt-5-2-pro')) return { name: 'GPT-5.2 Pro', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-2')) return { name: 'GPT-5.2', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-mini')) return { name: 'GPT-5 Mini', cls: 'model-gpt-mini' };
    if (m.includes('gpt-5-nano')) return { name: 'GPT-5 Nano', cls: 'model-gpt-mini' };
    if (m.startsWith('gpt-')) return { name: model, cls: 'model-gpt-frontier' };
    if (m.includes('codex')) return { name: model, cls: 'model-codex' };

    // ── Claude top tier ───────────────────────────────────────────────────
    if (m.includes('mythos-preview')) return { name: 'Mythos Preview', cls: 'model-fable' };
    if (m.includes('mythos-5-1')) return { name: 'Mythos 5.1', cls: 'model-fable' };
    if (m.includes('mythos')) return { name: 'Mythos 5', cls: 'model-fable' };
    if (m.includes('fable-5-1')) return { name: 'Fable 5.1', cls: 'model-fable' };
    if (m.includes('fable')) return { name: 'Fable 5', cls: 'model-fable' };

    // ── Claude 3.x (version prefixes the family name) ─────────────────────
    if (m.includes('3-opus')) return { name: 'Opus 3', cls: 'model-opus' };
    if (m.includes('3-7-sonnet')) return { name: 'Sonnet 3.7', cls: 'model-sonnet' };
    if (m.includes('3-5-sonnet')) return { name: 'Sonnet 3.5', cls: 'model-sonnet' };
    if (m.includes('3-sonnet')) return { name: 'Sonnet 3', cls: 'model-sonnet' };
    if (m.includes('3-5-haiku')) return { name: 'Haiku 3.5', cls: 'model-haiku' };
    if (m.includes('3-haiku')) return { name: 'Haiku 3', cls: 'model-haiku' };

    // ── Claude 4.x and later: "<family>-<major>[-<minor>][-<date>]" ───────
    // The (?!\d) guard stops an 8-digit date suffix being read as a minor version,
    // so `claude-sonnet-4-20250514` resolves to "Sonnet 4", not "Sonnet 4.20".
    const v = m.match(/(opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/);
    if (v) {
        const family = v[1][0].toUpperCase() + v[1].slice(1);
        return {
            name: v[3] ? `${family} ${v[2]}.${v[3]}` : `${family} ${v[2]}`,
            cls: `model-${v[1]}`,
        };
    }

    if (m.includes('opus')) return { name: 'Opus', cls: 'model-opus' };
    if (m.includes('sonnet')) return { name: 'Sonnet', cls: 'model-sonnet' };
    if (m.includes('haiku')) return { name: 'Haiku', cls: 'model-haiku' };

    if (m.includes('claude-2-1')) return { name: 'Claude 2.1', cls: 'model-sonnet' };
    if (m.includes('claude-2')) return { name: 'Claude 2', cls: 'model-sonnet' };
    if (m.includes('claude-1')) return { name: 'Claude 1', cls: 'model-sonnet' };
    if (m.includes('instant')) return { name: 'Instant', cls: 'model-haiku' };

    return { name: model, cls: 'model-sonnet' };
}

export function getModelFamily(model) {
    if (!model) return 'Unknown';
    const m = normalize(model);
    if (m.includes('fable') || m.includes('mythos')) return 'Fable';
    if (m.includes('opus')) return 'Opus';
    if (m.includes('sonnet')) return 'Sonnet';
    if (m.includes('haiku')) return 'Haiku';
    if (m.includes('codex')) return 'Codex';
    if (m.startsWith('gpt-')) return 'GPT';
    return 'Unknown';
}
