# Data Notes — /data/

This file documents every data source in the app, how it enters the codebase, and what it cannot be used to prove.

---

## Source Inventory

### 1. State Minimum Wages
**Where it lives:** Hard-coded `STATE_MINIMUM_WAGES` array in `src/components/RentCalculator.tsx`

**What it is:** A 51-row array (50 states + Federal) mapping each state to its 2026 minimum wage estimate. Values reflect scheduled increases from enacted state legislation as of early 2025.

**Reference source:** U.S. Department of Labor, Wage and Hour Division — State Minimum Wage Laws
https://www.dol.gov/agencies/whd/minimum-wage/state

**How to verify a value:** Visit the DOL page above, find the state, and check the "Effective Date" column for the rate in effect during 2026.

**Caveats:**
- Labeled "2026 estimates" in the component. Some states have mid-year increases scheduled; the app uses the rate in effect at the start of 2026.
- States that set their own wage below federal are rare and handled by using the higher federal floor in practice, though all 50 states have their own listed value.
- The Federal baseline (`FED`) is set to $15.00, which is the Biden-era federal contractor rate, not the statutory federal minimum of $7.25. This is an editorial choice to use a more realistic floor for student scenarios; it should be disclosed in any public-facing version.

---

### 2. Rent Tiers
**Where it lives:** `RENT_OPTIONS` array in `src/components/RentCalculator.tsx`

**What it is:** Six editorial monthly rent presets ranging from $1,200 to $3,500, labeled by cost-of-living tier (Low Cost City, Mid-Tier City, Average US, High Cost City, Major Metro, Expensive Market).

**Reference basis:** The $1,800 "Average US" figure is broadly consistent with Zillow's national median rent for 1-bedroom units in 2024–2025. The other tiers are editorial.

**Caveats:**
- These are not HUD Fair Market Rents. They are not calculated from any dataset — they are fixed presets chosen to represent meaningful affordability scenarios.
- There is no state-level variation in the rent tiers. A student in Mississippi and a student in California see the same six options.
- "Average US" at $1,800 may overstate costs for rural markets and understate costs for major coastal metros.

---

### 3. Live Apartment Listings (Craigslist, Apartments.com, Zillow)
**Where it lives:** Scraped at request time in `api/crawl.ts` via ScrapingBee

**What it is:** Point-in-time apartment listing data returned from three platforms, filtered to the user's selected rent ceiling (with up to 120–130% tolerance to surface nearby options).

**Craigslist specifics:**
- URL pattern: `https://{subdomain}.craigslist.org/search/apa?max_price={maxRent}`
- State-to-subdomain mapping is hard-coded (e.g., NJ → `newjersey`, CA → `sfbay`, TX → `dallas`)
- Parsing priority: JSON-LD structured data in `<script id="ld_searchpage_results">` → HTML `cl-search-result` gallery fallback
- Uses ScrapingBee standard proxy with JS rendering (~5 credits per request)

**Apartments.com specifics:**
- URL pattern: `https://www.apartments.com/{state-slug}/`
- Uses ScrapingBee stealth proxy with JS rendering and 3-second wait (~75 credits per request)
- Parsing priority: `listingModels` JSON in embedded script tags → `article.placard` HTML fallback

**Zillow specifics:**
- URL pattern: `https://www.zillow.com/{state-slug}-{stateCode}/rentals/`
- Uses ScrapingBee stealth proxy with JS rendering and 3-second wait (~75 credits per request)
- Parsing: locates `"listResults"` JSON array in embedded page state, bracket-counts to extract the array, parses unit-level pricing to find cheapest available unit per building

**Caveats:**
- All listings are point-in-time. A listing returned at 2:00 PM may be leased by 3:00 PM.
- Craigslist maps each state to a single metro subdomain. All of California routes to `sfbay`; listings in Los Angeles, San Diego, or inland areas are not captured.
- Apartments.com and Zillow actively resist scraping. The stealth proxy works but is not guaranteed. A zero-listing result is a data gap, not proof that no apartments exist.
- ScrapingBee credit consumption: Craigslist ~5 credits, Apartments.com ~75, Zillow ~75. A single full crawl costs ~155 credits. The free tier is 150 credits total, meaning live scraping on all three sources in a single request will exhaust a new free-tier account.
- The `affordable` flag on each listing is computed as `monthlyCost ≤ selectedRent`. Listings above the threshold are still returned and displayed with an "Over Budget" badge.

---

### 4. Grocery Cost Estimates
**Where it lives:** `fetchFoodDeals()` in `api/crawl.ts`

**What it is:** Three static grocery strategies (Aldi, Walmart Grocery Pickup, Costco bulk) with editorial monthly cost estimates and state-personalized descriptions.

**Estimated monthly costs:**
- Aldi: $150/month
- Walmart Grocery Pickup: $200/month
- Costco (bulk, split with roommates): $175/month

**Why it's static:** Major grocery chain websites (Kroger, Instacart, Walmart) actively block scraping and require authentication for cart/price data. There is no reliable public API for real-time grocery pricing. The static estimates are based on widely cited budget grocery benchmarks for single adults.

**Caveats:**
- These figures do not vary by state, city, or season.
- Actual grocery spend depends heavily on diet, cooking habits, household size, and local store availability. A student in rural Wyoming may not have an Aldi within 50 miles.
- Costco requires a membership (~$65/year). The Costco estimate assumes a shared membership split with roommates; the membership cost is not included in the monthly figure.

---

### 5. Internet Cost Estimates
**Where it lives:** `fetchInternetPrices()` in `api/crawl.ts`

**What it is:** A three-tier regional lookup returning a monthly internet cost estimate based on the state name.

**Tiers:**
- Low-cost states (Mississippi, Arkansas, Alabama, West Virginia, Kentucky): $45/month
- High-cost states (California, New York, Massachusetts, Connecticut, Hawaii): $75/month
- All other states: $55/month

**Reference basis:** Broadly consistent with BroadbandNow and FCC reports on average U.S. residential internet costs by state (2024).

**Caveats:**
- Uses a simple string match on state name, not a dataset join. Only the five states named in each tier receive non-average estimates.
- Does not account for bundled plans, subsidized access programs (e.g., ACP, which ended in 2024), student discounts, or shared Wi-Fi in apartments.

---

### 6. Claude AI Recommendations
**Where it lives:** `getClaudeRecommendations()` in `api/crawl.ts`

**What it is:** Three one-sentence affordability tips generated by `claude-3-5-sonnet-latest`, conditioned on state, hourly wage, hours per week, monthly rent, and monthly income.

**Prompt constraints:** Exactly 3 recommendations, each starting with a verb, no numbering, plain text, `max_tokens: 220`, `temperature: 0.2`.

**Caveats:**
- Output is generative. Recommendations are consistent at low temperature but are not sourced from a verified dataset.
- Claude recommendations should be treated as directional suggestions, not financial advice.
- If `CLAUDE_API_KEY` is not set, this section is silently omitted from the response.

---

## Budget Calculation Logic

The monthly budget draft in the API response is computed as follows:

```
monthlyIncome  = hourlyWage × hoursWorkedPerWeek × weeksPerMonth
housing        = cheapest scraped listing price (or selectedRent if no listings)
food           = cheapest food strategy estimatedMonthlyCost ($150)
transport      = 150  [fixed]
utilities      = 100  [fixed]
phoneInternet  = regional estimate ($45 / $55 / $75)
savings        = monthlyIncome × 0.10
leftover       = monthlyIncome − housing − food − transport − utilities − phoneInternet − savings
```

`leftover` can be negative. A negative leftover means the modeled budget does not close at the given income and expense assumptions.

**What this budget does not include:** taxes (the income figure is pre-tax gross), health insurance, student loan payments, clothing, personal care, or entertainment.

---

## Fallback Behavior

If the serverless API is unavailable or returns no data, `src/services/livingCrawler.ts` generates a local estimate using the same input parameters. The source-mode badge in the UI displays `Local Fallback` so the viewer knows they are seeing generated estimates rather than live scraped data.
