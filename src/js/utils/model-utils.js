// Per-million-token pricing in USD.
//
// Claude rates: platform.claude.com/docs/en/about-claude/pricing (verified 2026-10-14).
//   cacheWrite is the 5-minute write (1.25x input), cacheWrite1h the 1-hour write (2x input),
//   cacheRead a cache hit (0.1x input). Exceptions: Opus/Sonnet 5.5 hits are 0.05x and
//   Fable/Mythos 5.1 hits are 0.025x. Haiku 5.5 bills the whole request at 5x once its
//   prompt (input + cache reads + cache writes) passes 100K tokens.
// OpenAI rates: developers.openai.com/api/docs/pricing (verified 2026-10-14).
//   OpenAI cache writes are included for completeness; Codex transcripts expose cached
//   input tokens but not cache-write tokens, so the collector only bills cache reads.
//   Models with a long-context tier bill the whole request at it past 272K input tokens.
//
// Version-family fallbacks use *current* tier pricing, not an escalation curve: Anthropic's
// per-token prices have trended down across releases (Opus 15 -> 5 -> 4, Sonnet 3 -> 2), so an
// unreleased "opus-6" is far likelier to match today's Opus rate than to exceed it.

// Normalize `4.5`, `4_5` and `4-5` to a single form so each rule needs only one spelling.
const normalize = (model) => model.toLowerCase().replace(/[._]/g, '-');

const claudeRates = (input, output, readMultiplier = 0.1) => ({
    input, output, cacheWrite: input * 1.25, cacheWrite1h: input * 2, cacheRead: input * readMultiplier,
});

// "opus-5-5" -> 5.5, "sonnet-4-20250514" -> 4 (the (?!\d) guard skips 8-digit date
// suffixes). An unversioned name like "opus" is treated as the newest release.
function familyVersion(m, family) {
    const v = m.match(new RegExp(`${family}-(\\d+)(?:-(\\d{1,2})(?!\\d))?`));
    return v ? Number(v[1]) + (v[2] ? Number(v[2]) / 10 : 0) : Infinity;
}

// `promptTokens` is one request's input + cache reads + cache writes (Haiku 5.5 tiers on it);
// `inputTokens` is one Codex request's input, cached included (long-context tiers use it).
export function getPricingForModel(model, { promptTokens = 0, inputTokens = 0 } = {}) {
    if (!model) return claudeRates(3, 15);
    const m = normalize(model);

    // ── OpenAI / Codex ────────────────────────────────────────────────────
    if (m.startsWith('gpt-') || m.includes('codex')) return getCodexPricing(m, inputTokens);

    // ── Claude: top tier ──────────────────────────────────────────────────
    if (m.includes('mythos-preview')) return claudeRates(25, 125);
    if (m.includes('fable-5-1') || m.includes('mythos-5-1')) return claudeRates(10, 50, 0.025);
    if (m.includes('fable') || m.includes('mythos')) return claudeRates(10, 50);

    // ── Claude 3.x (version prefixes the family name) ─────────────────────
    if (m.includes('3-opus')) return claudeRates(15, 75);
    if (m.includes('3-7-sonnet') || m.includes('3-5-sonnet') || m.includes('3-sonnet')) return claudeRates(3, 15);
    if (m.includes('3-5-haiku')) return claudeRates(0.80, 4);
    // Haiku 3's cache prices aren't the usual multiples of input.
    if (m.includes('3-haiku')) return { input: 0.25, output: 1.25, cacheWrite: 0.30, cacheWrite1h: 0.50, cacheRead: 0.03 };

    // ── Claude 4.x and later ──────────────────────────────────────────────
    if (m.includes('opus')) {
        const v = familyVersion(m, 'opus');
        if (v < 4.5) return claudeRates(15, 75);  // Opus 4.0 / 4.1
        if (v < 5.5) return claudeRates(5, 25);   // Opus 4.5 – 5
        return claudeRates(4, 20, 0.05);          // Opus 5.5 and later
    }
    if (m.includes('sonnet')) {
        const v = familyVersion(m, 'sonnet');
        if (v < 5) return claudeRates(3, 15);     // Sonnet 4.x and earlier
        if (v < 5.5) return claudeRates(2, 10);   // Sonnet 5
        return claudeRates(2, 10, 0.05);          // Sonnet 5.5 and later
    }
    if (m.includes('haiku')) {
        const v = familyVersion(m, 'haiku');
        if (v < 4) return claudeRates(0.80, 4);   // Haiku 3.5
        if (v < 5) return claudeRates(1, 5);      // Haiku 4.5
        return promptTokens > 100_000 ? claudeRates(0.50, 2.50) : claudeRates(0.10, 0.50); // Haiku 5.5 and later
    }

    // Unrecognized — assume a mid-tier Sonnet-class rate.
    return claudeRates(3, 15);
}

// `m` is already normalized by getPricingForModel.
function getCodexPricing(m, inputTokens) {
    const tier = (short, long) => (inputTokens > 272_000 ? long : short);

    if (m.includes('gpt-6-astra')) return tier({ input: 10.00, output: 50.00, cacheWrite: 12.50, cacheRead: 1.00 }, { input: 20.00, output: 75.00, cacheWrite: 25.00, cacheRead: 2.00 });
    if (m.includes('gpt-6-1-sol')) return tier({ input: 2.00, output: 10.00, cacheWrite: 2.50, cacheRead: 0.10 }, { input: 4.00, output: 15.00, cacheWrite: 5.00, cacheRead: 0.20 });
    if (m.includes('gpt-6-sol')) return tier({ input: 2.00, output: 10.00, cacheWrite: 2.50, cacheRead: 0.20 }, { input: 4.00, output: 15.00, cacheWrite: 5.00, cacheRead: 0.40 });
    if (m.includes('gpt-6-luna')) return tier({ input: 0.10, output: 0.50, cacheWrite: 0.125, cacheRead: 0.01 }, { input: 0.20, output: 0.75, cacheWrite: 0.25, cacheRead: 0.02 });

    if (m.includes('gpt-5-6-terra')) return tier({ input: 2.00, output: 12.00, cacheWrite: 2.50, cacheRead: 0.20 }, { input: 4.00, output: 18.00, cacheWrite: 5.00, cacheRead: 0.40 });
    if (m.includes('gpt-5-6-luna')) return tier({ input: 0.20, output: 1.20, cacheWrite: 0.25, cacheRead: 0.02 }, { input: 0.40, output: 1.80, cacheWrite: 0.50, cacheRead: 0.04 });
    // GPT-5.6 Sol is on promotional pricing through at least 2026-11-21.
    if (m.includes('gpt-5-6-sol') || m === 'gpt-5-6' || m.startsWith('gpt-5-6-')) return tier({ input: 4.00, output: 20.00, cacheWrite: 5.00, cacheRead: 0.40 }, { input: 8.00, output: 30.00, cacheWrite: 10.00, cacheRead: 0.80 });

    // Plain GPT-5 and gpt-5-codex, dated snapshots included — before the gpt-5.N rules,
    // which would otherwise read "gpt-5-2025-08-07" as GPT-5.2.
    if (/^gpt-5(-codex)?(-\d{4}-\d{2}-\d{2})?$/.test(m)) return { input: 1.25, output: 10.00, cacheWrite: 0, cacheRead: 0.125 };

    if (m.includes('codex-mini-latest')) return { input: 1.50, output: 6.00, cacheWrite: 0, cacheRead: 0.375 };

    if (m.includes('gpt-5-5-pro')) return { input: 30.00, output: 180.00, cacheWrite: 0, cacheRead: 0 };
    if (m.includes('gpt-5-5')) return tier({ input: 5.00, output: 30.00, cacheWrite: 0, cacheRead: 0.50 }, { input: 10.00, output: 45.00, cacheWrite: 0, cacheRead: 1.00 });

    if (m.includes('gpt-5-4-pro')) return tier({ input: 30.00, output: 180.00, cacheWrite: 0, cacheRead: 0 }, { input: 60.00, output: 270.00, cacheWrite: 0, cacheRead: 0 });
    if (m.includes('gpt-5-4-nano')) return { input: 0.20, output: 1.25, cacheWrite: 0, cacheRead: 0.02 };
    if (m.includes('gpt-5-4-mini')) return { input: 0.75, output: 4.50, cacheWrite: 0, cacheRead: 0.075 };
    if (m.includes('gpt-5-4')) return tier({ input: 2.50, output: 15.00, cacheWrite: 0, cacheRead: 0.25 }, { input: 5.00, output: 22.50, cacheWrite: 0, cacheRead: 0.50 });

    if (m.includes('gpt-5-3-codex')) return { input: 1.75, output: 14.00, cacheWrite: 0, cacheRead: 0.175 };

    if (m.includes('gpt-5-2-pro')) return { input: 21.00, output: 168.00, cacheWrite: 0, cacheRead: 0 };
    if (m.includes('gpt-5-2')) return { input: 1.75, output: 14.00, cacheWrite: 0, cacheRead: 0.175 }; // incl. gpt-5.2-codex

    // gpt-5.1-codex(-max/-mini) and gpt-5-codex are no longer listed; last published rates.
    if (m.includes('gpt-5-1-codex-mini')) return { input: 0.25, output: 2.00, cacheWrite: 0, cacheRead: 0.025 };
    if (m.includes('gpt-5-1')) return { input: 1.25, output: 10.00, cacheWrite: 0, cacheRead: 0.125 };

    if (m.includes('gpt-5-pro')) return { input: 15.00, output: 120.00, cacheWrite: 0, cacheRead: 0 };
    if (m.includes('gpt-5-mini')) return { input: 0.25, output: 2.00, cacheWrite: 0, cacheRead: 0.025 };
    if (m.includes('gpt-5-nano')) return { input: 0.05, output: 0.40, cacheWrite: 0, cacheRead: 0.005 };

    // Unknown variant — price by suffix tier, then fall back to the flagship rate.
    if (m.includes('-pro')) return { input: 30.00, output: 180.00, cacheWrite: 0, cacheRead: 0 };
    if (m.includes('-nano')) return { input: 0.20, output: 1.25, cacheWrite: 0, cacheRead: 0.02 };
    if (m.includes('-mini')) return { input: 0.75, output: 4.50, cacheWrite: 0, cacheRead: 0.075 };
    return { input: 4.00, output: 20.00, cacheWrite: 5.00, cacheRead: 0.40 };
}

// Most-specific matches first — order matters.
export function getModelInfo(model) {
    if (!model) return { name: 'Unknown', cls: 'model-sonnet' };
    const m = normalize(model);

    // ── OpenAI / Codex ────────────────────────────────────────────────────
    if (m.includes('gpt-6-astra')) return { name: 'GPT-6 Astra', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-6-1-sol')) return { name: 'GPT-6.1 Sol', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-6-sol')) return { name: 'GPT-6 Sol', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-6-luna')) return { name: 'GPT-6 Luna', cls: 'model-gpt-mini' };
    if (m.includes('gpt-5-6-terra')) return { name: 'GPT-5.6 Terra', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-6-luna')) return { name: 'GPT-5.6 Luna', cls: 'model-gpt-mini' };
    if (m.includes('gpt-5-6-sol') || m === 'gpt-5-6' || m.startsWith('gpt-5-6-')) return { name: 'GPT-5.6 Sol', cls: 'model-gpt-frontier' };
    if (/^gpt-5-codex(-\d{4}-\d{2}-\d{2})?$/.test(m)) return { name: 'GPT-5 Codex', cls: 'model-codex' };
    if (/^gpt-5(-\d{4}-\d{2}-\d{2})?$/.test(m)) return { name: 'GPT-5', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-5-pro')) return { name: 'GPT-5.5 Pro', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-5')) return { name: 'GPT-5.5', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-4-pro')) return { name: 'GPT-5.4 Pro', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-4-nano')) return { name: 'GPT-5.4 Nano', cls: 'model-gpt-mini' };
    if (m.includes('gpt-5-4-mini')) return { name: 'GPT-5.4 Mini', cls: 'model-gpt-mini' };
    if (m.includes('gpt-5-4')) return { name: 'GPT-5.4', cls: 'model-gpt-frontier' };
    if (m.includes('codex-mini-latest')) return { name: 'Codex Mini Latest', cls: 'model-codex' };
    if (m.includes('gpt-5-3-codex')) return { name: 'GPT-5.3 Codex', cls: 'model-codex' };
    if (m.includes('gpt-5-2-pro')) return { name: 'GPT-5.2 Pro', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-2-codex')) return { name: 'GPT-5.2 Codex', cls: 'model-codex' };
    if (m.includes('gpt-5-2')) return { name: 'GPT-5.2', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-1-codex-max')) return { name: 'GPT-5.1 Codex Max', cls: 'model-codex' };
    if (m.includes('gpt-5-1-codex-mini')) return { name: 'GPT-5.1 Codex Mini', cls: 'model-codex' };
    if (m.includes('gpt-5-1-codex')) return { name: 'GPT-5.1 Codex', cls: 'model-codex' };
    if (m.includes('gpt-5-1')) return { name: 'GPT-5.1', cls: 'model-gpt-frontier' };
    if (m.includes('gpt-5-pro')) return { name: 'GPT-5 Pro', cls: 'model-gpt-frontier' };
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
