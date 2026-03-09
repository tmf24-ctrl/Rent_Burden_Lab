import { useEffect, useState } from 'react';
import {
  AVERAGE_MONTHLY_RENT,
  WEEKS_PER_MONTH,
  RENT_BURDEN_THRESHOLD,
  SLIDER_MIN,
  SLIDER_MAX,
  SLIDER_DEFAULT,
  SLIDER_STEP,
} from '../constants';
import { crawlAffordableLiving, type LivingCrawlerResult } from '../services/livingCrawler';

// State minimum wage data (2026 estimates)
const STATE_MINIMUM_WAGES = [
  { state: 'Federal', code: 'FED', wage: 15.0 },
  { state: 'Alabama', code: 'AL', wage: 10.5 },
  { state: 'Alaska', code: 'AK', wage: 11.73 },
  { state: 'Arizona', code: 'AZ', wage: 16.5 },
  { state: 'Arkansas', code: 'AR', wage: 11.0 },
  { state: 'California', code: 'CA', wage: 18.5 },
  { state: 'Colorado', code: 'CO', wage: 15.5 },
  { state: 'Connecticut', code: 'CT', wage: 16.5 },
  { state: 'Delaware', code: 'DE', wage: 14.5 },
  { state: 'Florida', code: 'FL', wage: 15.0 },
  { state: 'Georgia', code: 'GA', wage: 10.5 },
  { state: 'Hawaii', code: 'HI', wage: 18.0 },
  { state: 'Idaho', code: 'ID', wage: 10.5 },
  { state: 'Illinois', code: 'IL', wage: 16.0 },
  { state: 'Indiana', code: 'IN', wage: 10.5 },
  { state: 'Iowa', code: 'IA', wage: 11.0 },
  { state: 'Kansas', code: 'KS', wage: 10.5 },
  { state: 'Kentucky', code: 'KY', wage: 10.5 },
  { state: 'Louisiana', code: 'LA', wage: 10.5 },
  { state: 'Maine', code: 'ME', wage: 16.0 },
  { state: 'Maryland', code: 'MD', wage: 17.5 },
  { state: 'Massachusetts', code: 'MA', wage: 18.0 },
  { state: 'Michigan', code: 'MI', wage: 12.0 },
  { state: 'Minnesota', code: 'MN', wage: 13.5 },
  { state: 'Mississippi', code: 'MS', wage: 10.5 },
  { state: 'Missouri', code: 'MO', wage: 13.1 },
  { state: 'Montana', code: 'MT', wage: 12.3 },
  { state: 'Nebraska', code: 'NE', wage: 14.0 },
  { state: 'Nevada', code: 'NV', wage: 14.5 },
  { state: 'New Hampshire', code: 'NH', wage: 10.5 },
  { state: 'New Jersey', code: 'NJ', wage: 17.13 },
  { state: 'New Mexico', code: 'NM', wage: 15.0 },
  { state: 'New York', code: 'NY', wage: 17.5 },
  { state: 'North Carolina', code: 'NC', wage: 10.5 },
  { state: 'North Dakota', code: 'ND', wage: 12.3 },
  { state: 'Ohio', code: 'OH', wage: 12.3 },
  { state: 'Oklahoma', code: 'OK', wage: 10.5 },
  { state: 'Oregon', code: 'OR', wage: 17.0 },
  { state: 'Pennsylvania', code: 'PA', wage: 10.5 },
  { state: 'Rhode Island', code: 'RI', wage: 17.0 },
  { state: 'South Carolina', code: 'SC', wage: 10.5 },
  { state: 'South Dakota', code: 'SD', wage: 14.5 },
  { state: 'Tennessee', code: 'TN', wage: 10.5 },
  { state: 'Texas', code: 'TX', wage: 10.5 },
  { state: 'Utah', code: 'UT', wage: 10.5 },
  { state: 'Vermont', code: 'VT', wage: 17.0 },
  { state: 'Virginia', code: 'VA', wage: 15.0 },
  { state: 'Washington', code: 'WA', wage: 17.27 },
  { state: 'West Virginia', code: 'WV', wage: 10.5 },
  { state: 'Wisconsin', code: 'WI', wage: 10.85 },
  { state: 'Wyoming', code: 'WY', wage: 10.5 },
];

// Rent options for different cities/scenarios
const RENT_OPTIONS = [
  { value: 1200, label: 'Low Cost City ($1,200)' },
  { value: 1500, label: 'Mid-Tier City ($1,500)' },
  { value: 1800, label: 'Average US ($1,800)' },
  { value: 2200, label: 'High Cost City ($2,200)' },
  { value: 2800, label: 'Major Metro ($2,800)' },
  { value: 3500, label: 'Expensive Market ($3,500)' },
];

export function RentCalculator() {
  const [hoursWorked, setHoursWorked] = useState(SLIDER_DEFAULT);
  const [monthlyRent, setMonthlyRent] = useState(AVERAGE_MONTHLY_RENT);
  const [selectedState, setSelectedState] = useState('FED');
  const [crawlerResult, setCrawlerResult] = useState<LivingCrawlerResult | null>(null);
  const [crawlerLoading, setCrawlerLoading] = useState(false);
  const [crawlerMode, setCrawlerMode] = useState<'serverless' | 'local' | null>(null);
  const [crawlerError, setCrawlerError] = useState<string | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<string[] | null>(null);
  const [hasRunCrawler, setHasRunCrawler] = useState(false);

  // Get the minimum wage for selected state
  const currentState = STATE_MINIMUM_WAGES.find(s => s.code === selectedState) || STATE_MINIMUM_WAGES[0];
  const minimumWage = currentState.wage;

  // Calculations
  const monthlyIncome = hoursWorked * minimumWage * WEEKS_PER_MONTH;
  const rentBurden = monthlyIncome > 0 ? monthlyRent / monthlyIncome : 0;
  const remainingIncome = monthlyIncome - monthlyRent;
  const rentPercentage = Math.round(rentBurden * 100);
  const isSafe = rentBurden <= RENT_BURDEN_THRESHOLD;

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate bar widths
  const rentWidth = monthlyIncome > 0 ? (monthlyRent / monthlyIncome) * 100 : 0;
  const remainingWidth = 100 - rentWidth;

  const runLivingCrawler = async () => {
    setCrawlerLoading(true);
    setCrawlerError(null);
    setHasRunCrawler(true);

    const localFallback = () => {
      const local = crawlAffordableLiving({
        stateCode: selectedState,
        hourlyWage: minimumWage,
        hoursWorkedPerWeek: hoursWorked,
        weeksPerMonth: WEEKS_PER_MONTH,
        selectedRent: monthlyRent,
        rentBurdenThreshold: RENT_BURDEN_THRESHOLD,
      });
      setCrawlerResult(local);
      setCrawlerMode('local');
      setAiRecommendations(null);
    };

    try {
      const params = new URLSearchParams({
        stateCode: selectedState,
        hourlyWage: String(minimumWage),
        hoursWorkedPerWeek: String(hoursWorked),
        weeksPerMonth: String(WEEKS_PER_MONTH),
        selectedRent: String(monthlyRent),
        rentBurdenThreshold: String(RENT_BURDEN_THRESHOLD),
      });

      // Use relative path - Vite proxy handles routing to backend in dev
      const response = await fetch(`/api/crawl?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Serverless crawler failed with ${response.status}`);
      }

      const payload = (await response.json()) as {
        mode?: 'serverless';
        data?: LivingCrawlerResult;
        aiRecommendations?: string[] | null;
      };

      if (payload.data) {
        setCrawlerResult(payload.data);
        setCrawlerMode('serverless');
        setAiRecommendations(payload.aiRecommendations ?? null);
      } else {
        localFallback();
      }
    } catch {
      localFallback();
      setCrawlerError('Serverless endpoint unavailable locally; showing local generated crawler results.');
    } finally {
      setCrawlerLoading(false);
    }
  };

  const budget = crawlerResult?.budget;

  useEffect(() => {
    if (!hasRunCrawler || crawlerLoading) {
      return;
    }

    void runLivingCrawler();
  }, [selectedState, monthlyRent, hoursWorked]);

  return (
    <main className="container">
      <header className="hero">
        <p className="eyebrow">Student Reality Lab</p>
        <h1>Rent Burden Prototype</h1>
        <p className="hero-claim">
          Most students working part-time at minimum wage still cross the 30% rent-burden line in 2026.
        </p>
      </header>

      <section className="layout-top">
        <article className="panel panel-controls">
          <h2>Set Your Scenario</h2>

          <div className="control-group">
            <label className="slider-label" htmlFor="hours-slider">
              Hours Worked Per Week
            </label>
            <div className="slider-container">
              <input
                id="hours-slider"
                type="range"
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                value={hoursWorked}
                step={SLIDER_STEP}
                onChange={(e) => setHoursWorked(Number(e.target.value))}
                aria-label={`Hours worked per week: ${hoursWorked}`}
              />
              <div className="slider-value">
                {hoursWorked}
                <span className="slider-value-unit"> hours/week</span>
              </div>
            </div>
          </div>

          <div className="control-group">
            <label className="slider-label" htmlFor="rent-dropdown">
              Target Rent Context
            </label>
            <select
              id="rent-dropdown"
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(Number(e.target.value))}
              className="rent-dropdown"
              aria-label="Select monthly rent amount"
            >
              {RENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label className="slider-label" htmlFor="state-dropdown">
              State You Live In
            </label>
            <select
              id="state-dropdown"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="rent-dropdown"
              aria-label="Select state for minimum wage"
            >
              {STATE_MINIMUM_WAGES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.state} (${state.wage.toFixed(2)}/hr)
                </option>
              ))}
            </select>
          </div>
        </article>

        <article className="panel panel-insight">
          <h2>Live Snapshot</h2>
          <div className="chips">
            <div className="chip">
              <span className="chip-label">Min Wage ({currentState.code})</span>
              <span className="chip-value">${minimumWage.toFixed(2)}/hr</span>
            </div>
            <div className="chip">
              <span className="chip-label">Monthly Income</span>
              <span className="chip-value">{formatCurrency(monthlyIncome)}</span>
            </div>
            <div className="chip">
              <span className="chip-label">Monthly Rent</span>
              <span className="chip-value">{formatCurrency(monthlyRent)}</span>
            </div>
          </div>

          <div className="chart-wrapper">
            <div className="income-bar">
              <div
                className={`income-bar-rent ${isSafe ? 'burden-safe' : 'burden-high'}`}
                style={{ width: `${Math.max(rentWidth, 5)}%` }}
                role="img"
                aria-label={`Rent portion: ${rentPercentage}% of income`}
              >
                {rentWidth > 15 && `${rentPercentage}%`}
              </div>
              <div className="income-bar-remaining">
                {remainingWidth > 15 && `Remaining: ${formatCurrency(Math.max(remainingIncome, 0))}`}
              </div>
            </div>

            <div className="chart-labels">
              <span>$0</span>
              <span>Monthly Income: {formatCurrency(monthlyIncome)}</span>
            </div>
          </div>

          <p className={`annotation ${isSafe ? 'safe' : ''}`}>
            At {hoursWorked} hours/week, rent consumes <strong>{rentPercentage}%</strong> of monthly income.
            {isSafe ? ' Within the safer range.' : ' This is rent-burdened.'}
          </p>
        </article>
      </section>

      {/* Removed 'What to Notice' section for a cleaner, less robotic UI */}

      <section className="crawler-section panel">
        <div className="crawler-head">
          <h2>Affordable Living Crawler</h2>
          <button className="crawler-button" type="button" onClick={runLivingCrawler} disabled={crawlerLoading}>
            {crawlerLoading ? 'Refreshing Suggestions...' : 'Generate Living Plan'}
          </button>
        </div>

        {crawlerMode ? (
          <p className="crawler-mode">Source mode: {crawlerMode === 'serverless' ? 'Serverless API' : 'Local Fallback'}</p>
        ) : null}
        {crawlerError ? <p className="crawler-error">{crawlerError}</p> : null}

        {crawlerResult ? (
          <div className="crawler-results">
            <div className="result-card">
              <h3>Source Coverage</h3>
              <div className="platform-badges">
                <span className="platform-badge">Craigslist</span>
                <span className="platform-badge">Apartments.com</span>
                <span className="platform-badge">Zillow</span>
                <span className="platform-badge">Food Search Web</span>
              </div>
            </div>

            <div className="result-card">
              <h3>Housing Opportunities</h3>
              <p className="widget-subtitle">Generated leads adjusted to your state and affordability target.</p>
              <div className="widget-scroll" style={{ display: 'flex', overflowX: 'auto', gap: '1rem', paddingBottom: 8 }}>
                {crawlerResult.housingListings.map((listing) => (
                  <div key={`${listing.source}-${listing.title}`} className="widget-card" style={{ minWidth: 260, background: '#181a1b', borderRadius: 12, boxShadow: '0 2px 12px #0003', padding: 16, flex: '0 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <p className="widget-title" style={{ fontWeight: 600, fontSize: 18, marginBottom: 4 }}>
                        <a href={listing.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                          {listing.title}
                        </a>
                      </p>
                      <p className="widget-meta" style={{ fontSize: 14, color: '#aaa', marginBottom: 8 }}>
                        {listing.source} • {listing.location}
                      </p>
                      <p style={{ fontSize: 15, marginBottom: 8 }}>
                        <strong>Monthly Cost:</strong> {formatCurrency(listing.monthlyCost)}
                      </p>
                      <p style={{ fontSize: 15, marginBottom: 8 }}>
                        <strong>Status:</strong> <span className={listing.affordable ? 'status-good' : 'status-bad'}>{listing.affordable ? 'Affordable' : 'Over Budget'}</span>
                      </p>
                      {listing.description && (
                        <p style={{ fontSize: 14, color: '#ccc', marginBottom: 8 }}>
                          <strong>Description:</strong> {listing.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="result-card">
              <h3>Affordable Food Ideas</h3>
              <p className="widget-subtitle">Low-cost options estimated for your selected state context.</p>
              <div className="widget-scroll" style={{ display: 'flex', overflowX: 'auto', gap: '1rem', paddingBottom: 8 }}>
                {crawlerResult.foodDeals.map((deal) => (
                  <div key={deal.title} className="widget-card" style={{ minWidth: 260, background: '#181a1b', borderRadius: 12, boxShadow: '0 2px 12px #0003', padding: 16, flex: '0 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <p className="widget-title" style={{ fontWeight: 600, fontSize: 18, marginBottom: 4 }}>
                        <a href={deal.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                          {deal.title}
                        </a>
                      </p>
                      <p className="widget-meta" style={{ fontSize: 14, color: '#aaa', marginBottom: 8 }}>{deal.source}</p>
                      <p style={{ fontSize: 15, marginBottom: 8 }}>
                        <strong>Estimated Monthly Cost:</strong> {formatCurrency(deal.estimatedMonthlyCost)}
                      </p>
                      {deal.description && (
                        <p style={{ fontSize: 14, color: '#ccc', marginBottom: 8 }}>
                          <strong>Description:</strong> {deal.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {budget ? (
              <div className="result-card">
                <h3>Monthly Budget Draft</h3>
                <div className="budget-grid">
                  <div className="data-row">
                    <span className="data-label">Income</span>
                    <span className="data-value">{formatCurrency(budget.income)}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Housing</span>
                    <span className="data-value">{formatCurrency(budget.housing)}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Food</span>
                    <span className="data-value">{formatCurrency(budget.food)}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Transport</span>
                    <span className="data-value">{formatCurrency(budget.transport)}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Utilities</span>
                    <span className="data-value">{formatCurrency(budget.utilities)}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Phone & Internet</span>
                    <span className="data-value">{formatCurrency(budget.phoneInternet)} <span style={{ fontSize: 12, color: '#aaa' }}>(live estimate)</span></span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Savings</span>
                    <span className="data-value">{formatCurrency(budget.savings)}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Leftover</span>
                    <span className={`data-value ${budget.leftover >= 0 ? 'status-good' : 'status-bad'}`}>
                      {formatCurrency(budget.leftover)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {aiRecommendations && aiRecommendations.length > 0 ? (
              <div className="result-card">
                <h3>Claude Recommendations</h3>
                <ul className="widget-list">
                  {aiRecommendations.map((tip) => (
                    <li key={tip} className="widget-item">
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="empty-state">Press “Generate Living Plan” to populate housing, food, and budget widgets.</div>
        )}
      </section>
    </main>
  );
}