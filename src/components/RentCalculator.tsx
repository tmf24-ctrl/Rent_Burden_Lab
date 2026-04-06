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
import { RentChatbot } from './RentChatbot';

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

const RENT_BURDEN_FACTS = [
  'Housing experts often use 30% of income as the affordability guideline for rent.',
  'When rent crosses 50% of income, households are usually considered severely rent-burdened.',
  'High rent burden can reduce emergency savings and make unexpected costs much harder to absorb.',
  'Pairing realistic rent targets with transportation and food planning improves long-term stability.',
];

const LEASE_CHECKLIST = [
  'Ask for a complete fee breakdown (application, admin, parking, pet, utilities, internet).',
  'Confirm renewal terms and how much rent can increase after the first lease term.',
  'Review maintenance response policies and after-hours emergency contacts.',
  'Verify subletting, early termination, and roommate replacement rules in writing.',
];

const AFFORDABLE_HOUSING_RESOURCES = [
  { label: 'HUD Resource Locator', href: 'https://resources.hud.gov/' },
  { label: 'AffordableHousing.com Listings', href: 'https://www.affordablehousing.com/' },
  { label: '2-1-1 Housing Assistance', href: 'https://www.211.org/' },
  {
    label: 'Public Housing Authority Contacts',
    href: 'https://www.hud.gov/program_offices/public_indian_housing/pha/contacts',
  },
  { label: 'NLIHC Rental Assistance Guide', href: 'https://nlihc.org/rental-assistance' },
];

const PERSONALIZATION_STORAGE_KEY = 'rent-planner-profile-v1';

const TRANSPORT_OPTIONS = [
  { value: 'walk-bike', label: 'Walk / Bike First', estimatedCost: 35 },
  { value: 'transit', label: 'Public Transit', estimatedCost: 90 },
  { value: 'car-share', label: 'Car / Rideshare', estimatedCost: 260 },
];

const MOVE_TIMELINE_OPTIONS = [
  'ASAP (0-1 month)',
  'Soon (1-3 months)',
  'Flexible (3-6 months)',
  'Planning Ahead (6+ months)',
];

type PersonalizationProfile = {
  userName: string;
  selectedState: string;
  hoursWorked: number;
  monthlyRent: number;
  roommates: number;
  sideIncome: number;
  monthlySavingsGoal: number;
  targetBurden: number;
  transportMode: string;
  moveInTimeline: string;
};

export function RentCalculator() {
  const [hoursWorked, setHoursWorked] = useState(SLIDER_DEFAULT);
  const [monthlyRent, setMonthlyRent] = useState(AVERAGE_MONTHLY_RENT);
  const [selectedState, setSelectedState] = useState('FED');
  const [userName, setUserName] = useState('');
  const [roommates, setRoommates] = useState(1);
  const [sideIncome, setSideIncome] = useState(0);
  const [monthlySavingsGoal, setMonthlySavingsGoal] = useState(250);
  const [targetBurden, setTargetBurden] = useState(30);
  const [transportMode, setTransportMode] = useState('transit');
  const [moveInTimeline, setMoveInTimeline] = useState('Flexible (3-6 months)');
  const [crawlerResult, setCrawlerResult] = useState<LivingCrawlerResult | null>(null);
  const [crawlerLoading, setCrawlerLoading] = useState(false);
  const [crawlerMode, setCrawlerMode] = useState<'serverless' | 'local' | null>(null);
  const [crawlerError, setCrawlerError] = useState<string | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<string[] | null>(null);
  const [hasRunCrawler, setHasRunCrawler] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PERSONALIZATION_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<PersonalizationProfile>;
      if (typeof parsed.userName === 'string') setUserName(parsed.userName);
      if (typeof parsed.selectedState === 'string') setSelectedState(parsed.selectedState);
      if (typeof parsed.hoursWorked === 'number') setHoursWorked(Math.min(Math.max(parsed.hoursWorked, SLIDER_MIN), SLIDER_MAX));
      if (typeof parsed.monthlyRent === 'number') setMonthlyRent(parsed.monthlyRent);
      if (typeof parsed.roommates === 'number') setRoommates(Math.min(Math.max(parsed.roommates, 1), 4));
      if (typeof parsed.sideIncome === 'number') setSideIncome(Math.max(parsed.sideIncome, 0));
      if (typeof parsed.monthlySavingsGoal === 'number') setMonthlySavingsGoal(Math.max(parsed.monthlySavingsGoal, 0));
      if (typeof parsed.targetBurden === 'number') setTargetBurden(Math.min(Math.max(parsed.targetBurden, 22), 40));
      if (typeof parsed.transportMode === 'string') setTransportMode(parsed.transportMode);
      if (typeof parsed.moveInTimeline === 'string') setMoveInTimeline(parsed.moveInTimeline);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    const profile: PersonalizationProfile = {
      userName,
      selectedState,
      hoursWorked,
      monthlyRent,
      roommates,
      sideIncome,
      monthlySavingsGoal,
      targetBurden,
      transportMode,
      moveInTimeline,
    };

    localStorage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify(profile));
  }, [
    userName,
    selectedState,
    hoursWorked,
    monthlyRent,
    roommates,
    sideIncome,
    monthlySavingsGoal,
    targetBurden,
    transportMode,
    moveInTimeline,
  ]);

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

  const selectedTransport = TRANSPORT_OPTIONS.find((option) => option.value === transportMode) || TRANSPORT_OPTIONS[1];
  const personalMonthlyIncome = monthlyIncome + sideIncome;
  const personalRentShare = monthlyRent / Math.max(roommates, 1);
  const personalRentBurden = personalMonthlyIncome > 0 ? personalRentShare / personalMonthlyIncome : 0;
  const personalRentPercentage = Math.round(personalRentBurden * 100);
  const targetBurdenRatio = targetBurden / 100;
  const targetRentShare = personalMonthlyIncome * targetBurdenRatio;
  const baselineFood = crawlerResult?.budget.food ?? 175;
  const estimatedUtilities = 100;
  const personalLeftover = Math.round(
    personalMonthlyIncome - personalRentShare - baselineFood - selectedTransport.estimatedCost - estimatedUtilities - monthlySavingsGoal,
  );

  const personalizedActionPlan: string[] = [];
  if (personalRentBurden > targetBurdenRatio) {
    personalizedActionPlan.push(
      `Your rent-share is above your ${targetBurden}% target. Aim for about ${formatCurrency(targetRentShare)} or less each month.`,
    );
  } else {
    personalizedActionPlan.push(
      `Your current rent-share is within your ${targetBurden}% goal. Keep a buffer so you stay stable when expenses spike.`,
    );
  }

  if (roommates === 1) {
    personalizedActionPlan.push('Exploring a roommate setup could significantly reduce your monthly housing pressure.');
  } else {
    personalizedActionPlan.push('Keep a roommate agreement for utilities, cleaning, and payment timing to avoid conflict costs.');
  }

  if (sideIncome < 250) {
    personalizedActionPlan.push('Consider adding at least $250 in side income monthly to strengthen your savings and move-in flexibility.');
  } else {
    personalizedActionPlan.push('Your side income is helping. Protect it with a simple monthly cashflow plan and automatic transfers.');
  }

  if (personalLeftover < 0) {
    personalizedActionPlan.push('Your personalized monthly budget is negative. Lower rent-share, transport costs, or savings target before signing.');
  } else {
    personalizedActionPlan.push(`Projected leftover after essentials and savings is ${formatCurrency(personalLeftover)}.`);
  }

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

  const resetPersonalization = () => {
    setUserName('');
    setRoommates(1);
    setSideIncome(0);
    setMonthlySavingsGoal(250);
    setTargetBurden(30);
    setTransportMode('transit');
    setMoveInTimeline('Flexible (3-6 months)');
  };

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

      <section className="panel personalization-panel">
        <div className="personalization-head">
          <h2>Personalized Planner</h2>
          <button type="button" className="crawler-button" onClick={resetPersonalization}>Reset Profile</button>
        </div>

        <div className="personalization-grid">
          <article className="info-card">
            <h3>About You</h3>
            <div className="profile-grid">
              <label className="profile-field" htmlFor="name-input">
                <span className="slider-label">Name (optional)</span>
                <input
                  id="name-input"
                  className="rent-dropdown"
                  type="text"
                  value={userName}
                  placeholder="Alex"
                  onChange={(event) => setUserName(event.target.value)}
                />
              </label>

              <label className="profile-field" htmlFor="roommates-select">
                <span className="slider-label">People Sharing Rent</span>
                <select
                  id="roommates-select"
                  className="rent-dropdown"
                  value={roommates}
                  onChange={(event) => setRoommates(Number(event.target.value))}
                >
                  <option value={1}>1 (living solo)</option>
                  <option value={2}>2 people</option>
                  <option value={3}>3 people</option>
                  <option value={4}>4 people</option>
                </select>
              </label>

              <label className="profile-field" htmlFor="side-income-input">
                <span className="slider-label">Side Income / Month</span>
                <input
                  id="side-income-input"
                  className="rent-dropdown"
                  type="number"
                  min={0}
                  step={25}
                  value={sideIncome}
                  onChange={(event) => setSideIncome(Math.max(Number(event.target.value), 0))}
                />
              </label>

              <label className="profile-field" htmlFor="timeline-select">
                <span className="slider-label">Move Timeline</span>
                <select
                  id="timeline-select"
                  className="rent-dropdown"
                  value={moveInTimeline}
                  onChange={(event) => setMoveInTimeline(event.target.value)}
                >
                  {MOVE_TIMELINE_OPTIONS.map((timeline) => (
                    <option key={timeline} value={timeline}>
                      {timeline}
                    </option>
                  ))}
                </select>
              </label>

              <label className="profile-field" htmlFor="transport-select">
                <span className="slider-label">Transport Style</span>
                <select
                  id="transport-select"
                  className="rent-dropdown"
                  value={transportMode}
                  onChange={(event) => setTransportMode(event.target.value)}
                >
                  {TRANSPORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({formatCurrency(option.estimatedCost)}/mo)
                    </option>
                  ))}
                </select>
              </label>

              <label className="profile-field" htmlFor="savings-goal-input">
                <span className="slider-label">Savings Goal / Month</span>
                <input
                  id="savings-goal-input"
                  className="rent-dropdown"
                  type="number"
                  min={0}
                  step={25}
                  value={monthlySavingsGoal}
                  onChange={(event) => setMonthlySavingsGoal(Math.max(Number(event.target.value), 0))}
                />
              </label>
            </div>

            <label className="slider-label" htmlFor="target-burden-slider">
              Personalized Rent-Burden Goal: {targetBurden}%
            </label>
            <input
              id="target-burden-slider"
              type="range"
              min={22}
              max={40}
              step={1}
              value={targetBurden}
              onChange={(event) => setTargetBurden(Number(event.target.value))}
              aria-label={`Personalized rent burden target ${targetBurden} percent`}
            />
          </article>

          <article className="info-card">
            <h3>{userName.trim() ? `${userName.trim()}'s` : 'Your'} Personalized Snapshot</h3>
            <div className="chips personalized-chips">
              <div className="chip">
                <span className="chip-label">Personal Income</span>
                <span className="chip-value">{formatCurrency(personalMonthlyIncome)}</span>
              </div>
              <div className="chip">
                <span className="chip-label">Rent Share</span>
                <span className="chip-value">{formatCurrency(personalRentShare)}</span>
              </div>
              <div className="chip">
                <span className="chip-label">Target Rent Share</span>
                <span className="chip-value">{formatCurrency(targetRentShare)}</span>
              </div>
              <div className="chip">
                <span className="chip-label">Projected Leftover</span>
                <span className={`chip-value ${personalLeftover >= 0 ? 'status-good' : 'status-bad'}`}>
                  {formatCurrency(personalLeftover)}
                </span>
              </div>
            </div>
            <p className={`annotation ${personalRentBurden <= targetBurdenRatio ? 'safe' : ''}`}>
              Your personalized burden is <strong>{personalRentPercentage}%</strong> with roommates, side income, and transport choices included.
              {personalRentBurden <= targetBurdenRatio
                ? ' You are currently inside your own affordability target.'
                : ' You are above your own affordability target right now.'}
            </p>
          </article>
        </div>
      </section>

      <section className="panel long-read">
        <h2>Personal Action Plan</h2>
        <div className="info-grid">
          <article className="info-card">
            <h3>Next 30 Days</h3>
            <ul className="info-list">
              {personalizedActionPlan.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="info-card">
            <h3>Move Readiness</h3>
            <p className="resource-copy">
              Timeline: <strong>{moveInTimeline}</strong>
            </p>
            <p className="resource-copy">
              Transport strategy: <strong>{selectedTransport.label}</strong> ({formatCurrency(selectedTransport.estimatedCost)}/month)
            </p>
            <p className="resource-copy">
              Savings target: <strong>{formatCurrency(monthlySavingsGoal)}</strong> per month.
            </p>
            <p className="resource-copy">
              Use this profile with the crawler results to compare neighborhoods that fit your personal rent-share target.
            </p>
          </article>
        </div>
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
                <span className="platform-badge">Zillow Rentals</span>
                <span className="platform-badge">Grocery Deals</span>
              </div>
            </div>

            <div className="result-card">
              <h3>Housing Opportunities</h3>
              <p className="widget-subtitle">Generated leads adjusted to your state and affordability target.</p>
              <div className="widget-scroll">
                {crawlerResult.housingListings.map((listing) => (
                  <div key={`${listing.source}-${listing.title}`} className="widget-card">
                    <div>
                      <p className="widget-title">
                        <a href={listing.url} target="_blank" rel="noopener noreferrer" className="widget-link">
                          {listing.title}
                        </a>
                      </p>
                      <p className="widget-meta">
                        {listing.source} • {listing.location}
                      </p>
                      <p className="widget-detail">
                        <strong>Monthly Cost:</strong> {formatCurrency(listing.monthlyCost)}
                      </p>
                      <p className="widget-detail">
                        <strong>Status:</strong> <span className={listing.affordable ? 'status-good' : 'status-bad'}>{listing.affordable ? 'Affordable' : 'Over Budget'}</span>
                      </p>
                      {listing.description && (
                        <p className="widget-description">
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
              <div className="widget-scroll">
                {crawlerResult.foodDeals.map((deal) => (
                  <div key={deal.title} className="widget-card">
                    <div>
                      <p className="widget-title">
                        <a href={deal.url} target="_blank" rel="noopener noreferrer" className="widget-link">
                          {deal.title}
                        </a>
                      </p>
                      <p className="widget-meta">{deal.source}</p>
                      <p className="widget-detail">
                        <strong>Estimated Monthly Cost:</strong> {formatCurrency(deal.estimatedMonthlyCost)}
                      </p>
                      {deal.description && (
                        <p className="widget-description">
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
                    <span className="data-value">
                      {formatCurrency(budget.phoneInternet)} <span className="inline-hint">(live estimate)</span>
                    </span>
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

      <section className="panel long-read">
        <h2>Understanding Rent Burden</h2>
        <p className="long-read-intro">
          Rent burden matters because housing cost controls what remains for food, transportation, healthcare, and savings. The 30%
          guideline is not perfect for every household, but it is a useful benchmark for stress-testing your monthly budget.
        </p>
        <div className="info-grid">
          <article className="info-card">
            <h3>Quick Facts</h3>
            <ul className="info-list">
              {RENT_BURDEN_FACTS.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </article>

          <article className="info-card">
            <h3>Your Current Scenario</h3>
            <p>
              In <strong>{currentState.state}</strong>, working <strong>{hoursWorked} hours/week</strong> at{' '}
              <strong>${minimumWage.toFixed(2)}/hr</strong> gives an estimated monthly income of{' '}
              <strong>{formatCurrency(monthlyIncome)}</strong>. With rent at <strong>{formatCurrency(monthlyRent)}</strong>,
              your rent burden is <strong>{rentPercentage}%</strong>.
            </p>
            <p>
              {isSafe
                ? 'This scenario is currently under the standard 30% threshold, which usually leaves more room for essentials and savings.'
                : 'This scenario is above the standard 30% threshold, which often increases financial pressure and reduces budget flexibility.'}
            </p>
          </article>
        </div>
      </section>

      <section className="panel long-read">
        <h2>Renting Smarter: What to Check Before Signing</h2>
        <div className="info-grid">
          <article className="info-card">
            <h3>Lease Checklist</h3>
            <ul className="info-list">
              {LEASE_CHECKLIST.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="info-card">
            <h3>Affordable Housing Resources</h3>
            <p className="resource-copy">
              Use trusted directories and assistance networks to find lower-cost units, voucher options, and local rental support.
            </p>
            <ul className="resource-links">
              {AFFORDABLE_HOUSING_RESOURCES.map((resource) => (
                <li key={resource.href}>
                  <a href={resource.href} target="_blank" rel="noopener noreferrer">
                    {resource.label}
                  </a>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <RentChatbot
        userName={userName}
        stateName={currentState.state}
        hourlyWage={minimumWage}
        monthlyIncome={monthlyIncome}
        monthlyRent={monthlyRent}
        personalMonthlyIncome={personalMonthlyIncome}
        rentShare={personalRentShare}
        rentPercentage={rentPercentage}
        personalRentPercentage={personalRentPercentage}
        isSafe={isSafe}
        targetBurden={targetBurden}
        roommates={roommates}
        sideIncome={sideIncome}
        monthlySavingsGoal={monthlySavingsGoal}
        transportMode={selectedTransport.label}
        moveInTimeline={moveInTimeline}
        formatCurrency={formatCurrency}
      />
    </main>
  );
}