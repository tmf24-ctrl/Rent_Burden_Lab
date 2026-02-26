import { useState } from 'react';
import {
  AVERAGE_MONTHLY_RENT,
  WEEKS_PER_MONTH,
  RENT_BURDEN_THRESHOLD,
  SLIDER_MIN,
  SLIDER_MAX,
  SLIDER_DEFAULT,
  SLIDER_STEP,
} from '../constants';

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

  return (
    <div className="container">
      {/* Title */}
      <header>
        <h1>Student Reality Lab</h1>
        <h2 style={{ marginBottom: '0.5rem', marginTop: '-3rem', fontSize: '1.1rem', fontWeight: 400 }}>
          Rent Burden Prototype
        </h2>

        {/* Claim */}
        <p className="claim-banner">
          In most U.S. cities, a student working 20 hours per week at minimum wage cannot afford average rent
          without exceeding the 30% rent burden threshold.
        </p>
      </header>

      {/* Slider Section */}
      <section className="slider-section">
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
      </section>

      {/* Rent Dropdown Section */}
      <section className="slider-section">
        <label className="slider-label" htmlFor="rent-dropdown">
          Select Rent Amount
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
      </section>

      {/* State Dropdown Section */}
      <section className="slider-section">
        <label className="slider-label" htmlFor="state-dropdown">
          Select Your State (Minimum Wage)
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
      </section>

      {/* Quick Stats */}
      <section style={{ marginBottom: 'calc(var(--spacing-unit) * 8)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'calc(var(--spacing-unit) * 4)' }}>
          <div className="data-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <span className="data-label">Min Wage ({currentState.code})</span>
            <span className="data-value">${minimumWage.toFixed(2)}/hr</span>
          </div>
          <div className="data-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <span className="data-label">Monthly Income</span>
            <span className="data-value">{formatCurrency(monthlyIncome)}</span>
          </div>
          <div className="data-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <span className="data-label">Monthly Rent</span>
            <span className="data-value">{formatCurrency(monthlyRent)}</span>
          </div>
        </div>
      </section>

      {/* Chart Section */}
      <section className="chart-section">
        <div className="chart-wrapper">
          {/* Income Bar Chart */}
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

          {/* Chart Labels */}
          <div className="chart-labels">
            <span>$0</span>
            <span>Monthly Income: {formatCurrency(monthlyIncome)}</span>
          </div>
        </div>

        {/* Annotation */}
        <div className={`annotation ${isSafe ? 'safe' : ''}`}>
          At {hoursWorked} hours/week, rent consumes <strong>{rentPercentage}%</strong> of monthly income.
          {isSafe ? ' ✓ Within safe threshold.' : ' ✗ Exceeds 30% threshold.'}
        </div>
      </section>

      {/* Story Text */}
      <section className="story-text">
        <h2>What You're Seeing</h2>
        <p>
          The 30% rent burden threshold comes from housing economists and financial advisors who recommend that
          rent should not exceed 30% of gross monthly income. This keeps housing affordable and leaves income for
          food, transportation, utilities, and education expenses.
        </p>
        <p>
          Minimum wage varies dramatically across states. In 2026, it ranges from $10.50 in states like Texas, Wyoming,
          and North Carolina up to $18.50 in California and higher in some markets. At the federal baseline of $15/hour,
          a student working 20 hours per week earns approximately $1,298 per month. With average rent at $1,800, that
          student faces a 138% rent burden—meaning rent alone exceeds their entire income.
        </p>
        <p>
          Use the state dropdown to see how geography impacts affordability. Try California versus Kentucky. Select
          different neighborhoods via the rent dropdown. Adjust hours worked to explore scenarios. The visualization
          exposes a fundamental mismatch in the 2026 economy between student wages and housing costs across America.
        </p>
      </section>
    </div>
  );
}