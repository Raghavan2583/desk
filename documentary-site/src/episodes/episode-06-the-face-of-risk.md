# DESK — A Documentary Series

## Episode 6: The Face of Risk

---

You can build the most accurate risk model in the world. If nobody can read it, you built nothing.

This is the part of engineering that gets the least respect and causes the most damage. The backend pipeline processes correctly, the scores are accurate, the data is fresh. Then the frontend is a table with numbers, and the person who looks at it walks away knowing no more than before they arrived.

DESK was always going to be a visualization. The knowledge graph was not the frontend — it was the architecture. The question was how to turn that architecture into something a non-technical executive could understand in 30 seconds and an engineer could go deep in for 10 minutes.

Here is how that happened.

---

### Why React Flow, Not D3

The first technical decision for the frontend: how to render the graph.

D3.js is the default answer. It is powerful, flexible, and widely documented. It can render any graph visualization you can describe mathematically. It is also a significant undertaking — to build a production-quality interactive graph in D3 requires custom code for node positioning, edge routing, zoom and pan behavior, hover interactions, and click handling. That is several hundred lines of code before any of the DESK-specific logic.

React Flow is purpose-built for node-edge graphs. It handles zoom, pan, edge rendering, node selection, and interactive state management out of the box. The API is declarative — you describe nodes and edges as data, and React Flow handles the rendering. The result is a production-quality interactive graph with a fraction of the code that D3 would require.

The trade-off is flexibility: React Flow is opinionated about how nodes and edges work. For DESK, that is fine. The graph is a dependency visualization, not a custom physics simulation. The constraints React Flow imposes are not constraints DESK needs to work around.

The choice was made: React Flow. Total frontend dependency list, including build tools: six packages. The bundle is lean and the graph is rich.

---

### The Layout Battle

The first version of the graph used Dagre — a directed acyclic graph layout engine that automatically computes node positions. You give it the nodes and edges, it calculates x and y coordinates.

Dagre works correctly. It produces a valid topological layout where dependencies flow from left to right. For the DESK use case — showing one focal package at the center with its dependencies and dependents — it also produces something that non-technical users find confusing.

The problem with automatic layout: the focal package ends up wherever the graph topology puts it. If the focal package has many upstream dependencies, it ends up far to the right. If it has many downstream dependents, it ends up far to the left. The visual position of the package you searched for is unpredictable. The graph looks different every time, even for similar packages.

The first manual alternative was a three-column horizontal layout: dependencies on the left, the focal package in the center, dependents on the right. This was an improvement over Dagre — the focal package was always centered, and the flow of information was consistent. But horizontal graphs have a specific readability problem: the edges cross each other when there are many nodes, creating a web of lines that experienced engineers parse but non-technical readers find overwhelming.

The final layout was vertical: dependencies above the focal package, the focal package in the center, dependents below. Edges flow top-to-bottom. This matches the mental model most people have for dependency chains — "this package depends on those packages above it, and those packages below depend on this one." The flow direction matches the reading direction.

After showing the vertical layout to a non-technical viewer — specifically a manager reviewing the project — the response was immediate: "this gives a much better big-picture view." That feedback confirmed the layout decision.

The vertical layout also has a hard constraint: a maximum of 15 visible neighbors in each direction. If a heavily-used package like `certifi` has 200 dependents, only the 15 with the highest blast radius counts are shown, with a note indicating the total. This keeps the graph readable without sacrificing the ability to explore further.

---

### The Homepage Problem

The first version of DESK's homepage was a search bar. Centered on the screen. Nothing else.

The search bar was not wrong — search is the primary interaction. But a blank page with a search bar communicates nothing before the user types anything. A first-time viewer arriving at DESK would see an empty input and have no idea what they were looking at, what the tool did, or why they should care.

The redesign started with a question: what is the most important thing DESK knows that is not obvious to a newcomer? The answer: DESK already knows which packages in the Python ecosystem are most critical. It does not need to wait for a user query to show something meaningful.

The homepage became a risk dashboard. A leaderboard of the 20 packages with the highest blast radius — the packages that, if they broke, would cause the most cascading failures. An ecosystem health ring showing the distribution of risk labels across all 1,000 packages. A stats strip at the top: how many packages are tracked, how many are CRITICAL right now, when the data was last refreshed.

Everything on the homepage is live data from the same pipeline that powers the graph. The leaderboard is not static — it updates daily as risk scores change. The health ring changes when packages are patched or when new CVEs are published.

The homepage communicates DESK's core insight before the user types a single character: *here are the packages your ecosystem depends on most, and here is how risky they are right now.*

---

### The Color Journey

DESK's visual identity went through three iterations before it was final.

**Iteration 1 — blue and orange:** The wordmark used a bright blue for `DE` and a burnt orange for `SK`. The colors were distinctive and readable, but they lacked presence on a dark background. Against deep navy (`#0D1117`), they looked flat.

**Iteration 2 — green and red:** Green for `DE`, red for `SK`. This felt immediately wrong — green and red together, in the context of a risk tool, read as a traffic light. Every time someone looked at the wordmark, they saw "safe/danger" rather than "DESK." The brand was accidentally mimicking a binary indicator it was not meant to be.

**Iteration 3 — indigo and rose:** `#818CF8` for `DE` (a medium indigo), `#F472B6` for `SK` (a rose-pink). This combination has good contrast against dark backgrounds, reads as distinctive rather than generic, and does not trigger any unintended semantic associations. It also aged well — looking at it across multiple sessions, it still felt right.

The color system extended beyond the wordmark. Risk levels each have a consistent color throughout the interface: CRITICAL is red (`#FF4444`), HIGH is orange (`#FF8C00`), MEDIUM is gold (`#FFD700`), LOW is green (`#3FB950`). These colors are defined in a single file — `utils/colors.js` — and used everywhere. Changing them for the entire application requires changing one file.

Trend direction also has consistent colors: RISING is red (risk getting worse), FALLING is green (risk decreasing), STABLE is grey. The trend arrow next to the risk score communicates direction at a glance.

---

### The Package Detail View

When a user finds a package and clicks into it, the detail view needs to serve two audiences simultaneously: the non-technical decision-maker who wants a verdict in 10 seconds, and the engineer who wants to understand exactly why the score is what it is.

The TL;DR panel at the top serves the first audience. Three sentences:

- What is this package's reach? ("Django is a direct or transitive dependency of 89 packages in the top 1,000.")
- What is the current risk state? ("It has 2 unpatched HIGH severity CVEs. The maintainer last committed 45 days ago.")
- What is the verdict? ("Current risk: HIGH, trend: STABLE.")

Below that, the full technical breakdown serves the second audience: the four factor scores, their individual contributions, a 12-month sparkline of the risk history, the full CVE list with severity and fix status, the maintainer card showing commit frequency and contributor count.

The CVE display was particularly important to get right. A list of CVE IDs with severity labels is not actionable. The actionable version shows two things: whether a fix exists, and if so, what version fixes it. DESK computes the safe version by finding the highest `fixed_in_version` across all open CVEs — the version that, if upgraded to, resolves the most vulnerabilities. It shows this prominently: "UPGRADE to v2.1.5 — fixes all 3 CVEs." That is a complete recommendation, not a data dump.

---

### The Animations That Are Not Decorative

The homepage has an orbital animation in the hero section: three rings of glowing dots rotating at different speeds around a central pulsing core. It looks decorative. It is also deliberate.

The three rings rotate at 18 seconds, 34 seconds, and 55 seconds per revolution. These are not round numbers. They are chosen specifically so the rings never synchronize — the animation never looks the same twice, which makes it feel organic rather than mechanical. If all three rings rotated at the same speed, the effect would be a single rotating pattern. With different speeds, the rings continuously form new configurations.

The floating cards in the hero section (displaying "1,000 Packages Tracked," "Critical Risk: N," "Daily Data Refresh") have animation durations of 5.5 seconds, 6.8 seconds, and 5.2 seconds. Again: different speeds, no synchronization. The cards float independently.

The focal package node in the graph pulses with a breathing glow — shadow expanding and contracting on a 1.6-second cycle. This serves a functional purpose: it immediately identifies which node is the subject of the current view without requiring a label or highlight.

The SAFE VERSION badge on packages with patchable CVEs also breathes — a slower, calmer pulse than the focal node. It draws the eye to the most actionable information: "there is a fix available."

None of these animations required a library. They are CSS keyframes and JavaScript `setInterval` calls. The total animation code across the frontend is a few dozen lines. The effect is substantial.

---

### The Scroll-Reveal Parallax

When a user navigates to a package — either by searching or clicking a leaderboard tile — the layout transitions into an explore mode. The dependency graph is sticky at the top of the viewport. The risk detail panel slides up from below.

As the user scrolls the detail panel upward, the graph scales down and fades out. The detail panel rises. This creates a sense of depth — the graph is behind the panel, not replaced by it. The user never loses awareness that the graph exists and can be returned to.

The technical implementation is simpler than it looks: a scroll event listener on the detail panel container, calculating the scroll progress as a fraction from 0 to 1, applying `transform: scale(1 - progress × 0.2)` and `opacity: 1 - progress × 1.6` to the graph container. No animation library. No spring physics. Just arithmetic applied on every scroll event.

The result is a UI that feels expensive without being expensive to build.

---

### What the Frontend Is

DESK's frontend is 1,871 lines of JavaScript across 8 files. It renders a dependency graph, a risk dashboard, a detailed package analysis view, and a searchable package index. It loads in under a second on any connection because the data is static JSON served from a CDN.

It is not the most sophisticated frontend I could have built. It is the right frontend for what DESK communicates. Every design decision — vertical layout, color system, homepage as risk dashboard, TL;DR panel, CVE remediation guidance — was made in service of the question DESK exists to answer: *how risky is this package, and what should I do about it?*

---

*Next: Episode 7 — Shipping and What Broke. Getting the pipeline to production was a different kind of engineering problem from building the pipeline. Here is what went wrong.*
