# Student Reality Lab — Rent Burden Prototype

> **IS219 · Track B: Rent Burden / Moving Out**
> An interactive data story that answers a real, verifiable question: can a student working part-time at state minimum wage afford rent in 2026 without becoming rent-burdened?

**Live Demo:** `((https://rentburdenlab2026-ea5lm3rrc-faccendataryn-5845s-projects.vercel.app?_vercel_share=40DeY524GyEgrCfz2s2VCBpdYDN4QiPC))`
**Repo:** `https://github.com/tmf24-ctrl/Rent_Burden_Lab`

---

## Essential Question

Given a U.S. state and a target monthly rent, does a student working part-time at that state's minimum wage cross the 30% rent-burden threshold — and what does their full monthly budget actually look like?

---

## Claim

Most students working part-time at state minimum wage in 2026 spend more than 30% of their monthly income on rent, making them rent-burdened by the federal definition — but the severity varies enough by state that where you live is one of the highest-leverage financial decisions a student can make.

---

## Audience

- Undergraduate and graduate students planning to move off-campus or relocate for a first job or internship
- First-generation students and their families navigating independent housing for the first time
- Financial aid advisors looking for a shareable, evidence-backed affordability tool

---

## STAR Draft

**S — Situation**
Rent as a share of income has hit a 30-year high nationally. More than half of renters aged 18–29 are classified as rent-burdened (paying >30% of income on housing). Students routinely make housing decisions without any verified, interactive comparison tool.

**T — Task**
The viewer should be able to set their state, hours worked per week, and a target rent tier, then immediately see whether they are rent-burdened, by how much, and what a realistic monthly budget looks like — backed by live-crawled listings from Craigslist, Apartments.com, and Zillow.

**A — Action**
Two panels + one crawler section:
- Panel 1 ("Set Your Scenario"): state dropdown, hours-worked slider, rent-tier dropdown
- Panel 2 ("Live Snapshot"): real-time income bar chart with 30% threshold annotation that turns red when burdened
- Crawler section ("Affordable Living Crawler"): on-demand parallel scrape of three housing sources, three grocery strategies, a full monthly budget draft, and three Claude-generated affordability recommendations

**R — Result**
At 20 hours/week, a student in most states crosses the rent-burden line at every rent tier except the lowest. States like California, Hawaii, and New York require 35+ hours/week at minimum wage just to reach the safe zone at average U.S. rent ($1,800). The budget draft makes the leftover number — often negative — impossible to ignore.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite |
| Styling | Custom CSS (dark theme) |
| Backend / API | Express (local dev), Vercel Serverless Functions (deployed) |
| Web Scraping | ScrapingBee API (JS rendering + stealth proxy) |
| AI Layer | Anthropic Claude API (`claude-3-5-sonnet-latest`) |
| Deployment | Vercel |

---

## Project Structure

```
Rent_Burden_Lab/
├── api/
│   └── crawl.ts              # Vercel serverless handler — scraping + Claude recommendations
├── src/
│   ├── components/
│   │   └── RentCalculator.tsx # Main UI component (all views)
│   ├── services/
│   │   └── livingCrawler.ts   # Local fallback crawler (no API keys required)
│   ├── constants.ts           # Slider bounds, thresholds, defaults
│   ├── App.tsx
│   └── index.css
├── server.ts                  # Local Express wrapper for Vercel-style handler
├── vercel.json                # Vercel routing config
├── vite.config.ts
├── package.json
└── .env.local                 # API keys — never committed
```

---

## How It Works

### Frontend (RentCalculator.tsx)

Three controls drive all calculations in real time:

- **State dropdown** — all 50 states + Federal, each carrying its 2026 minimum wage estimate. Changing state immediately updates `hourlyWage` and recomputes all income/burden figures.
- **Hours slider** — adjustable across the range defined in `constants.ts`. Monthly income = `hourlyWage × hoursPerWeek × 4.33`.
- **Rent dropdown** — six preset tiers from $1,200 (low-cost city) to $3,500 (expensive market).

The income bar fills proportionally against monthly income. The rent portion turns **red** when `rent / monthlyIncome > 0.30` and **green** within the safe zone. The annotation below reports the exact percentage live.

Clicking **"Generate Living Plan"** fires a `GET /api/crawl` request with all five parameters. If the serverless endpoint is unreachable (local dev without keys), the app silently falls back to `livingCrawler.ts` and displays a source-mode notice.

### Backend (api/crawl.ts)

The handler runs four scrapers and one AI call in parallel via `Promise.all`:

**Housing scrapers (ScrapingBee):**
- **Craigslist** — maps each state to its regional subdomain (e.g., NJ → `newjersey.craigslist.org`), scrapes `/search/apa?max_price=…` with JS rendering, parses JSON-LD structured data first, falls back to HTML `cl-search-result` pattern matching. Standard proxy, ~5 credits.
- **Apartments.com** — uses stealth proxy mode (~75 credits), attempts to extract `listingModels` JSON from embedded script tags, falls back to `article.placard` HTML parsing.
- **Zillow** — uses stealth proxy mode (~75 credits), locates the `listResults` JSON array in the embedded page state, parses unit-level pricing to surface the cheapest available unit per building.

**Food data (static + regional):**
Returns three grocery strategies (Aldi, Walmart Grocery Pickup, Costco bulk) with state-personalized descriptions and editorial monthly cost estimates ($150–$200). Grocery sites block scrapers, so this layer is intentionally static. Internet cost is estimated regionally: $45 low-cost states, $75 high-cost states, $55 average.

**Budget calculation** uses the cheapest scraped housing price and cheapest food estimate to build a full monthly breakdown: income, housing, food, transport ($150 fixed), utilities ($100 fixed), phone/internet (regional), savings (10% of income), and leftover (can be negative).

**Claude recommendations** via `claude-3-5-sonnet-latest`: a constrained prompt requests exactly 3 one-sentence tips starting with a verb, no numbering, plain text. `max_tokens: 220`, `temperature: 0.2` for consistency.

### Local Dev Server (server.ts)

`server.ts` wraps the Vercel-style handler in an Express app on port 3001, shaping `req`/`res` to match the Vercel interface so the same `api/crawl.ts` runs identically in both environments. Vite proxies `/api/*` to `localhost:3001` in development.

---

## Dataset & Provenance

| Data | Source | How It Enters the App | Notes |
|---|---|---|---|
| State minimum wages | 2026 estimates researched from DOL state wage schedules | Hard-coded array in `RentCalculator.tsx` | All 50 states + Federal; reflects scheduled 2026 rates |
| Rent tiers | Six editorial presets ($1,200–$3,500) | Dropdown constants | Represent low-cost city through expensive market; not tied to HUD FMR |
| Apartment listings | Craigslist, Apartments.com, Zillow — scraped at request time via ScrapingBee | `/api/crawl` response | Point-in-time snapshots; listings may already be leased |
| Grocery cost estimates | Editorial monthly estimates for Aldi, Walmart, Costco | Static in `api/crawl.ts` | $150–$200/month range; grocery sites block automated scraping |
| Internet cost | Regional lookup (low/average/high cost state tiers) | Computed per request | Static tiers; not from a live ISP API |
| AI recommendations | Anthropic Claude API (`claude-3-5-sonnet-latest`) | Generated per crawl request | Conditioned on state, wage, hours, and rent; `temperature: 0.2` |

---

## Data Dictionary

| Field | Meaning | Units / Type | Source |
|---|---|---|---|
| `stateCode` | Two-letter state abbreviation or `FED` for federal baseline | String | Query param |
| `hourlyWage` | 2026 minimum wage for selected state | USD/hr, float | `STATE_MINIMUM_WAGES` in `RentCalculator.tsx` |
| `hoursWorkedPerWeek` | User-selected hours | Integer | Slider |
| `weeksPerMonth` | Fixed income multiplier | Float, `4.33` | `constants.ts` |
| `selectedRent` | Monthly rent from preset dropdown | USD/month, integer | Dropdown |
| `monthlyIncome` | `hourlyWage × hoursWorkedPerWeek × 4.33` | USD/month, float | Derived in component |
| `rentBurden` | `selectedRent / monthlyIncome` | Ratio, float | Derived in component |
| `RENT_BURDEN_THRESHOLD` | Federal rent-burden definition | Ratio, `0.30` | `constants.ts` |
| `housingListings[].source` | Which scraper returned this listing | Enum: `Craigslist` / `Apartments.com` / `Zillow` | API response |
| `housingListings[].monthlyCost` | Parsed monthly rent for the listing | USD/month, integer | Scraped HTML/JSON |
| `housingListings[].affordable` | `monthlyCost ≤ selectedRent` | Boolean | Computed in `api/crawl.ts` |
| `budget.leftover` | Income minus all modeled expense categories | USD/month, integer (can be negative) | Computed in `api/crawl.ts` |
| `aiRecommendations` | 3 one-sentence affordability tips from Claude | String[], max 3 items | Claude API |

---

## Data Viability Audit

### What this data can prove
- Whether a student's hours + state combination puts them above or below the 30% threshold at any preset rent tier
- What a plausible full monthly budget looks like, anchored to the cheapest available scraped listing
- That affordability varies meaningfully by state — 20 hours/week produces very different outcomes in Mississippi vs. California

### What this data cannot prove
- **Actual market availability** — scraped listings are point-in-time and may be leased. The crawler surfaces leads, not live inventory.
- **Utility costs** — the budget uses a fixed $100/month. True housing cost is typically 15–25% higher than listed rent.
- **Roommate scenarios** — all calculations assume single occupancy. The app does not model shared rent.
- **Above-minimum wages** — the app uses state minimum wage. Students earning more will see an artificially pessimistic burden ratio.
- **Geographic granularity** — each state maps to one Craigslist subdomain (e.g., all of California → `sfbay`). Inland and rural listings are underrepresented.
- **Grocery accuracy** — food costs are static editorial estimates. Actual spend depends on diet, household size, and local prices.

### Known gaps

| Gap | Effect | Mitigation in app |
|---|---|---|
| Scrapers may return 0 results (blocked or rate-limited) | Budget falls back to `selectedRent` as housing cost | Source-mode badge shows `Serverless API` vs `Local Fallback` |
| No live grocery scraping | Food costs are static | Descriptions are state-personalized; all sources are linked |
| Wages are hard-coded 2026 estimates | May drift from enacted rates | Documented as estimates; DOL source is the reference |
| Apartments.com + Zillow use stealth proxy (~75 credits each) | May exhaust free ScrapingBee tier | Craigslist uses standard proxy (~5 credits); local fallback always available |

---

## Environment Variables

Create `.env.local` in the project root (do not commit):

```
FIRECRAWL_API_KEY=your_firecrawl_api_key
```

The app runs without this key, but live scraping will use generated fallback estimates. Startup logs confirm whether the Firecrawl key is loaded.

---

## Running Locally

```bash
# Install dependencies
npm install

# Runs both Vite frontend (5173) and API server (3001)
npm run dev
```

Vite proxies `/api/*` to `localhost:3001`. If the API server is not running, the UI falls back to the local crawler automatically.

```bash
# Production build
npm run build
```

---

## Deployment

Deployed on Vercel. `vercel.json` routes `/api/*` to the serverless functions in `/api/`. Push to `main` to trigger a redeploy.

Add `CLAUDE_API_KEY` and `SCRAPINGBEE_API_KEY` in the Vercel project dashboard under **Settings → Environment Variables**.

---

## Interaction Design

| Interaction | What changes |
|---|---|
| Hours slider | Monthly income recalculates live; bar redraws; annotation updates rent % and burden color |
| State dropdown | Minimum wage updates; all income and burden figures recompute immediately |
| Rent dropdown | Bar rent portion updates; burden status updates; affordable flag recalculates |
| "Generate Living Plan" | Fires parallel scrapers; populates housing cards, food cards, budget draft, and Claude tips |
| Listing cards (horizontal scroll) | Each card links to the live source listing; affordable/over-budget badge is color-coded |

---

## Limits & What I'd Do Next

**Known limits:**
- Wage data is hard-coded; no live DOL API integration
- Rent presets are editorial — not pulled from HUD Fair Market Rent by state
- No roommate mode; single occupant only
- Utility costs are a fixed $100 estimate, not regional
- ScrapingBee credit burn is high for Apartments.com and Zillow on the free tier

**What I'd build next:**
- Custom wage input so the app works for students earning above minimum wage
- HUD FMR integration to replace editorial rent presets with real state-level data
- Roommate toggle that divides rent by 2, 3, or 4 and recalculates burden
- Historical rent trend line using Zillow Research public CSV data
- Utility cost estimator using EIA average residential rates by state
