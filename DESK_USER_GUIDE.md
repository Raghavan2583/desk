# DESK — User Guide
### DEpendency riSK · PyPI Ecosystem Risk Intelligence

---

## What is DESK?

Every Python project you build depends on open-source packages maintained by volunteers.
When a package goes unmaintained, gets compromised, or quietly accumulates security holes —
**you find out too late.**

DESK watches the **top 1,000 most-downloaded PyPI packages** and answers one question:

> *"How risky is this package, and what breaks if it fails?"*

---

## How to Use It

**1. Open the tool**
→ https://frontend-sand-seven-57.vercel.app

**2. Type any Python package name in the search bar**
Examples: `django`, `requests`, `numpy`, `cryptography`, `flask`

**3. That's it.** Results load in under 1 second.

---

## What You See

### Risk Score Card *(right panel)*
| Field | What it means |
|---|---|
| **CRITICAL / HIGH / MEDIUM / LOW** | Overall risk label — the headline |
| **Score (x.x / 10)** | Numeric score — higher = riskier |
| **↑ ↓ →** | Trend arrow — is the risk rising, falling, or stable? |
| **N packages depend on this** | Blast radius — how many other packages break if this one fails |

### Maintainer Health
Shows the human behind the package:
- **Last commit** — days since anyone touched the code
- **Commits (90d)** — activity level in the past 3 months
- **Contributors** — how many people maintain it
- **Status badge** — ACTIVE / SLOW / STALE / ABANDONED

### CVE List
All known security vulnerabilities (CRITICAL → HIGH → MEDIUM → LOW), with fix version where available.

### Dependency Graph *(left panel)*
A live network showing which packages this one depends on and which depend on it.
Click any node to pivot to that package.

### 12-Month Trend Line
Sparkline chart showing how the risk score has moved over the past year.

---

## How the Risk Score is Calculated

| Component | Weight | What it measures |
|---|---|---|
| Maintainer activity | **40%** | How recently and actively the repo is maintained |
| CVE count | **30%** | Number and severity of known vulnerabilities |
| Blast radius | **20%** | How many packages depend on this one |
| Download trend | **10%** | Whether adoption is growing or declining |

---

## What the Labels Mean

| Label | Score | Plain English |
|---|---|---|
| 🔴 **CRITICAL** | 7.5 – 10 | Abandoned or heavily exploited. Avoid or replace. |
| 🟠 **HIGH** | 5.0 – 7.4 | Significant risk. Monitor closely. |
| 🟡 **MEDIUM** | 3.0 – 4.9 | Moderate risk. Worth reviewing. |
| 🟢 **LOW** | 0 – 2.9 | Actively maintained, few issues. Safe to use. |

---

## Quick Example

Search **`cryptography`** and you will see:
- Risk score and severity label
- 28 CVEs listed (with which ones have patches)
- How many packages in the top-1,000 depend on it
- Whether the maintainers are active on GitHub

Search **`pandas`** and compare — you will see a much lower score because it has an active maintainer team, regular commits, and fewer critical CVEs.

---

## Data Freshness

DESK refreshes every day at 02:07 UTC automatically.
Data sources: PyPI · GitHub · OSV.dev (CVE database)

---

*Built with Python · DuckDB · dbt · React · React Flow · Vercel*
