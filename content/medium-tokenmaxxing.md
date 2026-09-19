# Meta Built a Leaderboard for Burning AI Tokens. You Still Don't Know Your Own Number.

### Tokenmaxxing is a bad metric. Refusing to measure anything is worse.

In April, someone at Meta shipped an internal dashboard called **Claudeonomics**. It ranked employees by how many AI tokens they consumed. Top burners collected titles: *Token Legend*, *Cache Wizard*.

The numbers that leaked were hard to read with a straight face. Sixty trillion tokens across the company in thirty days. The highest-ranked individual averaged 281 billion tokens in that window, which [Fortune](https://fortune.com/2026/04/09/meta-killed-employee-ai-token-dashboard/) put at roughly $1.4 million even on the cheapest Claude tier. Mark Zuckerberg didn't crack the top 250. Neither did CTO Andrew Bosworth.

Then the data got passed around outside the company, and the dashboard was gone within days. The shutdown notice read: *"It was meant to be a fun way for people to look at tokens, but due to data from this dashboard being shared externally, we've made the decision to shutter Claudeonomics for now."*

Most people read this as a story about corporate absurdity. Engineers were reportedly leaving models running idle to climb the board, which is funny in the way that lines-of-code contests were funny in 1998.

I think the more interesting part got missed. Eighty-five thousand people at Meta could look up exactly what they consumed last month. Most developers reading this cannot answer that question about themselves.

That asymmetry is the story.

---

## The pendulum swung twice in six months

Nvidia's Jensen Huang is widely credited with lighting the fuse, saying he'd be *deeply alarmed* if a $500,000 engineer hadn't spent $200,000 on tokens. The logic is clean enough: compute is cheaper than payroll, so an engineer hoarding compute is an engineer wasting the expensive resource to conserve the cheap one.

That idea moved fast. Internal leaderboards appeared. Consumption became a signal of seriousness.

Then the bills arrived.

Uber burned through its **entire 2026 budget** for agentic coding tools in four months. CTO Praveen Neppalli Naga said so publicly. Around 5,000 engineers were running at 84–95% monthly usage, with individual bills landing anywhere from $150 to $2,000 a month. Neppalli reportedly went through $1,200 of tokens during a two-hour internal demo.

Uber's response was a **$1,500 monthly cap per engineer, per tool**. As [Simon Willison noted](https://simonwillison.net/2026/Jun/3/uber-caps-usage/), for a company where median SWE compensation runs around $330,000, a $36,000 annual ceiling across two tools is not stingy. It's a real number attached to a real belief about value.

Six months. From *burn more* to *here's your ceiling*. Meta went from gamifying consumption to [capping it](https://cryptobriefing.com/meta-crackdown-employee-token-use/) as internal costs climbed toward the billions.

If your read on this industry is that the free-money phase of agentic coding is winding down, you're reading it correctly.

---

## Tokenmaxxing earned its backlash

The metric deserves to die, and the data is not subtle about why.

[Faros AI](https://www.faros.ai/blog/tokenmaxxing) analyzed two years of activity from 22,000 developers across 4,000 teams. In high-adoption environments, throughput genuinely improved: tasks completed up 34%, epics per developer up 66%.

Then the other column:

- Bugs per developer: **up 54%**
- Median review time: **up 5x**
- PRs merged without review: **up 31%**
- Code churn: **up 861%**

Incident-to-PR ratio more than tripled. More things shipped. Fewer of them survived contact with production.

Token consumption is an input. Ranking people on inputs corrupts them, every time, without exception. We learned this with lines of code, with commit counts, with story points. Anyone who has watched a team optimize for a number they didn't choose already knows how the Meta idle-model story ends.

So: leaderboards are bad. Manager-visible consumption rankings are worse. Zapier reportedly investigates employees whose usage runs 5x their peers, which is defensible as anomaly detection and indefensible the moment it lands in a calibration packet.

Fine. That's the easy consensus, and by now it's most of what gets written about this.

---

## "Stop measuring" is the wrong lesson

Here's where I expect to lose some of you.

The backlash has curdled into something lazier than the original mistake. *Tokens don't measure productivity, therefore stop looking at tokens.* That conclusion does not follow, and it leaves you standing outside a conversation that's already happening about you.

On June 24, [Gartner predicted](https://www.gartner.com/en/newsroom/press-releases/2026-06-24-gartner-predicts-ai-coding-costs-will-surpass-average-developer-salary-by-2028-as-token-consumption-surges) that AI coding costs will surpass the average developer's salary by 2028. That's against a global average of roughly $2,000/month, not a Bay Area number, but the direction is what matters. Today, about a quarter of technology leaders already spend $200–500 per developer per month on tokens. Roughly 6% are past $2,000.

And the economics are genuinely strange. Per-token prices have collapsed. Blended cost fell from about $18.40 to $6.07 per million tokens between Q1 2025 and Q1 2026, a 67% drop in a year. Enterprise AI bills over the same period rose by an estimated 320%, because agentic workflows pushed per-developer consumption up something like 18x. A single agentic task can trigger dozens of model calls. The unit got cheap and the units-per-task went vertical.

Every finance org on earth is now looking at that line. In 2025, 31% of FinOps practitioners had AI spend in scope. In 2026 it's basically all of them.

So the question was never *should token consumption be measured.* It's being measured. Uber gives every employee a dashboard and a formal process to request more. Meta ranked 85,000 people. The question is narrower and more uncomfortable:

**Does the number reach you before it reaches someone else?**

---

## The asymmetry

Three situations, all of which are already happening:

**Your team gets a cap.** A per-engineer ceiling shows up in Slack. You have no idea whether it's generous or crippling for how you actually work, because you've never seen your own monthly figure. You either accept a bad constraint quietly or argue from vibes. The person who shows up with twelve months of their own data wins that conversation and it isn't close.

**Your usage gets flagged.** You're 5x your peers. Maybe that's waste. Maybe you're the one person running large refactors across a legacy service while everyone else writes CRUD endpoints. Without your own breakdown by project, by model, by session, you cannot tell the difference, and neither can the person reviewing you.

**Nobody flags anything, and you're just spending badly.** This is the common one and it's the least discussed. You have a session that quietly cost more than your entire previous week. You have a project where the agent loops on a problem it will not solve. You're on Opus for work Haiku would handle. Nobody is going to find that for you.

The Meta leaderboard was a genuinely dumb idea. But notice what the alternative has been for most developers: no number at all, until one arrives from above with a policy attached.

I'd rather be the one holding the data.

---

## What's actually worth looking at

Consumption alone tells you nothing. Consumption in context tells you a lot. What I've found worth watching:

- **Cost per project, not cost per day.** Aggregate spend is noise. Spend attached to a working directory tells you which codebase is expensive to change, and that's an architecture signal, not an AI signal.
- **Your model mix.** Cache read and write ratios especially. Most surprise bills I've seen trace back to cache behavior nobody was looking at.
- **The outlier session.** Not the average. The single most expensive session of the month, opened up and read. There's usually a specific bad pattern in there.
- **When you spend.** Hour-by-hour, the expensive hours are frequently not the productive ones. Late-night sessions where you're steering badly are visible in the data before they're visible to you.
- **Trend against shipped work.** The only ratio that means anything. Rising spend with rising throughput is an investment. Rising spend with flat throughput is churn, and per the Faros numbers, churn is what's actually rising.

Measure spend against outcomes. Never rank humans on inputs. Those two things are compatible, and the current discourse treats them as if they're not.

---

## Disclosure, because it matters here

I build a tool in this space, so read the rest with that in mind.

It's called [AI Usage Tracker](https://github.com/658jjh/claude-usage-tracker). It scans the local data directories that Claude Code, Codex, Cursor, Windsurf, Cline, Aider, Continue and a handful of others already write to your disk, parses the JSONL, applies per-model pricing, and renders it as a dashboard. Cost by project, by model, by source. Token breakdown including cache reads, cache writes and Codex reasoning tokens. An hour-by-day heatmap. Your most expensive session, one click away.

The part I care about: **it never sends anything anywhere.** No cloud, no account, no telemetry. It reads files that are already on your machine and renders them in a window on that same machine. There is no server for me to run and no data for me to have.

That's a deliberate position, not a shortcut. Every well-funded product in this category is a dashboard your employer buys and points at you. This one is the opposite artifact: the same visibility, owned by the person generating the tokens. Source is MIT on GitHub. Build it yourself in one command, or pay $9 for a signed macOS build if you'd rather not.

If you don't want my tool, use someone else's, or write forty lines of Python against `~/.claude/projects`. The tool is not the argument.

---

## The number is going to exist either way

Meta's mistake wasn't building a dashboard. It was building a *leaderboard* — turning a personal operating metric into a public ranking, then acting surprised when people optimized for the ranking.

But the correction isn't blindness. Between now and 2028, per-developer AI cost goes from a line item to a number that shows up in headcount conversations. Caps are coming to your team if they haven't arrived. Some of that will be reasonable and some of it will be set by people who have never watched an agent burn $40 failing to fix a flaky test.

When that lands, there will be a number attached to your name.

The only real choice is whether you've seen it first.

---

*What does your team do about token spend — caps, dashboards, or deliberately not looking? I'm genuinely interested in the third answer, since it seems to be the most common one nobody admits to.*

---

**Sources**

- [Fortune — Meta killed the employee AI token dashboard](https://fortune.com/2026/04/09/meta-killed-employee-ai-token-dashboard/)
- [Gartner — AI coding costs will surpass average developer salary by 2028](https://www.gartner.com/en/newsroom/press-releases/2026-06-24-gartner-predicts-ai-coding-costs-will-surpass-average-developer-salary-by-2028-as-token-consumption-surges)
- [Simon Willison — Uber caps usage of AI tools like Claude Code](https://simonwillison.net/2026/Jun/3/uber-caps-usage/)
- [Faros AI — Tokenmaxxing: why token consumption isn't engineering productivity](https://www.faros.ai/blog/tokenmaxxing)
- [The Register — AI coding agents could soon cost more than the developers using them](https://www.theregister.com/ai-and-ml/2026/06/24/ai-coding-agents-could-soon-cost-more-than-the-developers-using-them/5260864)
- [LeadDev — Tokenmaxxing and the search for AI metrics that matter](https://leaddev.com/ai/tokenmaxxing-and-the-search-for-ai-metrics-that-matter)
- [Inc. — Uber blew through its 2026 AI budget in four months](https://www.inc.com/lucia-auerbach/uber-blew-through-2026-ai-budget-in-four-months-now-it-is-capping-employee-use/91355199)
