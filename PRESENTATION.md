# PRESENTATION.md — STAR Narrative

> **Project:** Student Reality Lab — Rent Burden Prototype
> **Course:** IS219
> **Format:** 3–5 minute live demo
> **Claim:** Most students working part-time at state minimum wage in 2026 are rent-burdened — and this app lets you verify that claim for your exact state and hours worked, live, in under 60 seconds.

---

## S — Situation (20–30 seconds)

Right now, more than half of renters aged 18 to 29 in the United States are rent-burdened — meaning they spend over 30% of their income on housing. That's the federal definition of a financial danger zone.

But students making off-campus housing decisions almost never know what their actual burden percentage is. They pick a number that feels affordable. They don't know what their state's minimum wage is, or how many hours a week they'd need to work to clear the threshold, or whether any real apartments even exist under that budget in their target state.

This app makes all of that answerable in real time, with live data.

---

## T — Task (10–15 seconds)

The essential question I set out to answer:

> *Given a U.S. state and a target monthly rent, does a student working part-time at that state's minimum wage cross the 30% rent-burden threshold — and what does their full monthly budget actually look like?*

After using this app, a viewer should be able to name:
1. Their exact rent-burden percentage at their current hours and state
2. How many hours per week they'd need to work to reach the safe zone
3. Real apartment listings in their state within their budget, right now

---

## A — Action (60–90 seconds)

The app has two live panels and one crawler section.

**Panel 1 — Set Your Scenario**

Three controls: a state dropdown, an hours-worked slider, and a rent-tier dropdown with six presets from $1,200 to $3,500 a month. Every state carries its own 2026 minimum wage, so changing the state immediately changes the income baseline. All the math is reactive — nothing requires a page reload.

**Panel 2 — Live Snapshot**

This is where the claim becomes visual. A horizontal bar fills proportionally — the red portion is rent, the remaining portion is everything else. The bar turns green when the student is in the safe zone and red when they've crossed 30%. Below it, an annotation fires the exact percentage: *"At 20 hours/week, rent consumes 47% of monthly income. This is rent-burdened."*

The key engineering decision here: the 30% threshold isn't a static line drawn on a chart — it's baked into the conditional styling of the bar itself, so it physically changes what the viewer sees rather than just labeling a number.

**Crawler Section — Affordable Living Crawler**

Pressing "Generate Living Plan" triggers the backend. Four scrapers run in parallel using ScrapingBee: Craigslist (mapped to each state's regional subdomain), Apartments.com, and Zillow — all filtered to the user's selected rent ceiling. The results come back as scrollable listing cards with price, source, location, and an affordable/over-budget badge.

There's also a full monthly budget draft — income, housing, food, transport, utilities, phone/internet, savings at 10%, and leftover. The leftover figure is often negative, and that's intentional. That's the honest result the app is designed to surface.

Finally, Claude generates three personalized, one-sentence affordability recommendations conditioned on the specific state, wage, hours, and rent. Temperature is set to 0.2, so the output is consistent and practical, not creative.

One important architecture decision: the same `api/crawl.ts` file runs both as a Vercel serverless function in production and locally via an Express wrapper in `server.ts`. This means the app degrades gracefully — if the API keys aren't present, it falls back to a local estimate generator and tells the user exactly which mode it's running in.

---

## R — Result (60–90 seconds)

### Headline Numbers

At 20 hours per week — a typical part-time student workload — a student in most states crosses the 30% rent-burden line at every rent tier except the lowest ($1,200/month). In states like California, Hawaii, and New York, they'd need to work 35+ hours a week at minimum wage just to reach the safe zone at average U.S. rent.

The most dramatic result is in the budget draft's **leftover** field. At 20 hours/week in New York at $1,800/month rent, after housing, food, transport, utilities, internet, and a 10% savings target, the leftover is typically **negative** — meaning the budget doesn't close without either more hours, less rent, or cutting savings entirely.

### What Changes When You Interact

Drag the hours slider from 20 to 35 in California: the bar shifts from red to green. That's the break-even point made visible. Switch the state from California ($18.50/hr) to Pennsylvania ($10.50/hr) at the same hours and rent: the bar goes deep red and the leftover collapses. Same rent. Same hours. 43% different outcome.

When the crawler runs, some listings come back as "Over Budget" even when you scraped at max-rent — that's because the scraper accepts up to 120–130% of the selected rent to surface nearby options, and flags them honestly rather than hiding them.

### One Honest Limitation

The budget uses a fixed $100 for utilities. Real utility costs vary by climate, unit size, and season — in states like Minnesota or Maine, winter heating alone can double that figure. The true rent-burden number for a student in a cold-weather state is worse than what this app shows. That's a gap I'd close in the next version by integrating EIA average residential energy costs by state.

### Actionable Takeaway

Before you sign a lease: open this app, pick your state, set your actual hours, and find the rent tier where the bar turns green. If no tier turns green at your hours, that's not a housing problem — it's an income problem, and the app shows you exactly how many more hours a week would fix it.

---

*Demo order: State → California, Hours → 20, Rent → Average US ($1,800) → show red bar → drag hours to 35 → bar turns green → switch state to Pennsylvania at 35 hours → bar goes red again → press Generate Living Plan → walk through listing cards → show budget leftover → show Claude tips*
