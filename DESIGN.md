# DESK — Design Language
# Covers visual language, layout, feel, colors, typography for the frontend.
# Rule: NEVER exceed 100 lines. Observer never modifies this file.

## Visual Reference
Dark-themed knowledge graph tool.
Reference feel: Linear.app (clean, dark, focused) + VirusTotal (risk-first UI) + network topology diagrams.
Not a dashboard. Not a search engine. A graph you explore.

## Feel
The user should feel like they are looking at an X-ray of the internet's hidden infrastructure.
Every interaction should surface a small moment of — "I never knew this existed."
Gravity in the design. This is a risk tool. It must feel serious.

## Layout Philosophy
- Single search bar, centered, prominent, above the fold. Nothing else on first load.
- After search: graph canvas takes 70% of screen width. Full breathing room. No crowding.
- Risk panel docked right — score label, numeric, trend arrow, maintainer card. Scrollable.
- No navbar clutter. No marketing copy. No hero sections. Tool-first, not landing page.
- Searched package always centered and highlighted in the graph.
- Desktop only for MVP. Mobile is post-MVP.

## Graph Visual Language (React Flow)
- Node size     = blast radius — bigger node = more dependents = more dangerous
- Node color    = risk label — RED (CRITICAL), ORANGE (HIGH), YELLOW (MEDIUM), GREEN (LOW)
- Edge thickness = dependency type — thick = direct dependency, thin = transitive
- Center node   = searched package — white ring, always highlighted, always centered
- Hover on node = tooltip: package name, risk score, maintainer count, last commit date
- Click on node = expand that package's subgraph one level deeper

## Risk Score Card Layout (right panel)
Line 1: Risk label — CRITICAL / HIGH / MEDIUM / LOW (large, bold, color-coded)
Line 2: Numeric score — 7.8 / 10 (smaller, monospace, underneath label)
Line 3: Trend arrow — ↑ rising (red) / ↓ falling (green) / → stable (muted)
Line 4: Blast radius count — "340 packages depend on this"
Below: Maintainer card, 12-month trend sparkline

## Color Language
| Element | Hex |
|---|---|
| Background | #0D1117 |
| Surface | #161B22 |
| Border | #30363D |
| CRITICAL risk | #FF4444 |
| HIGH risk | #FF8C00 |
| MEDIUM risk | #FFD700 |
| LOW risk | #3FB950 |
| Text primary | #E6EDF3 |
| Text muted | #8B949E |
| Accent (links, active) | #58A6FF |
| Trend up (bad) | #FF4444 |
| Trend down (good) | #3FB950 |
| Trend stable | #8B949E |

## Typography
| Use | Font | Size | Weight |
|---|---|---|---|
| Package name | Inter | 18px | Semibold |
| Risk label | Inter | 14px | Bold, uppercase |
| Score number | Inter Mono | 32px | Bold |
| Body text | Inter | 14px | Regular |
| Tooltip | Inter | 12px | Regular |
| Trend arrow | Inter | 20px | Bold |

Fallback: -apple-system, BlinkMacSystemFont, sans-serif

## What It Must NOT Look Like
- A BI dashboard — no bar charts, pie charts, or data tables as the primary UI
- A security compliance tool — no audit report layout, no checkbox lists
- A package search engine — not a discovery tool, not an npm/PyPI search page
- Colorful or playful — gravity only. No gradients for decoration. No rounded bubbles.
- Cluttered with numbers — maximum 5 data points visible at once in the risk panel
- A landing page pretending to be a tool — no hero text, no CTA buttons, no feature lists
- A loading spinner app — graph must render progressively, not blank then all-at-once
