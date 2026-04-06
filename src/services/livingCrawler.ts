export interface HousingListing {
  title: string;
  source: 'Zillow' | 'Web';
  monthlyCost: number;
  location: string;
  url: string;
  affordable: boolean;
  imageUrl?: string; // Optional image for visual appeal
  description?: string; // Optional description for richer UI
}

export interface FoodDeal {
  title: string;
  source: 'Web';
  estimatedMonthlyCost: number;
  url: string;
  imageUrl?: string; // Optional image for visual appeal
  description?: string; // Optional description for richer UI
}

export interface BudgetBreakdown {
  income: number;
  housing: number;
  food: number;
  transport: number;
  utilities: number;
  phoneInternet: number;
  savings: number;
  leftover: number;
}

export interface LivingCrawlerResult {
  housingListings: HousingListing[];
  foodDeals: FoodDeal[];
  budget: BudgetBreakdown;
  searchLinks: {
    zillow: string;
    foodWeb: string;
  };
}


const FOOD_COST_BY_STATE: Record<string, number> = {
  CA: 420,
  NY: 390,
  MA: 370,
  WA: 360,
  HI: 470,
  AK: 430,
  default: 310,
};

const TRANSPORT_BY_STATE: Record<string, number> = {
  NY: 140,
  DC: 145,
  CA: 210,
  default: 170,
};

const HOUSING_PRESSURE_BY_STATE: Record<string, number> = {
  CA: 1.2,
  NY: 1.18,
  MA: 1.15,
  WA: 1.12,
  HI: 1.25,
  NJ: 1.12,
  CO: 1.08,
  TX: 0.92,
  OH: 0.9,
  IA: 0.88,
  KS: 0.88,
  KY: 0.87,
  MS: 0.85,
  WV: 0.86,
  default: 1,
};

function getStateSearchTerm(stateCode: string): string {
  // Use the full state name for broader search, fallback to 'united states' for FED
  const stateNames: Record<string, string> = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
    CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
    IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
    ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
    MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
    NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
    OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
    TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
    WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', FED: 'united states',
  };
  return stateNames[stateCode] ?? 'united states';
}

function getFoodBaseline(stateCode: string): number {
  return FOOD_COST_BY_STATE[stateCode] ?? FOOD_COST_BY_STATE.default;
}

function getTransportBaseline(stateCode: string): number {
  return TRANSPORT_BY_STATE[stateCode] ?? TRANSPORT_BY_STATE.default;
}

function getHousingPressure(stateCode: string): number {
  return HOUSING_PRESSURE_BY_STATE[stateCode] ?? HOUSING_PRESSURE_BY_STATE.default;
}

function buildFoodWebUrl(city: string): string {
  const query = encodeURIComponent(`${city} affordable groceries student budget meal prep`);
  return `https://duckduckgo.com/?q=${query}`;
}

function buildZillowUrl(stateCode: string, stateName: string): string {
  const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');
  return `https://www.zillow.com/${stateSlug}-${stateCode.toLowerCase()}/rentals/`;
}

export function crawlAffordableLiving(params: {
  stateCode: string;
  hourlyWage: number;
  hoursWorkedPerWeek: number;
  weeksPerMonth: number;
  selectedRent: number;
  rentBurdenThreshold: number;
}): LivingCrawlerResult {
  const {
    stateCode,
    hourlyWage,
    hoursWorkedPerWeek,
    weeksPerMonth,
    selectedRent,
    rentBurdenThreshold,
  } = params;

  const searchTerm = getStateSearchTerm(stateCode);
  const monthlyIncome = hourlyWage * hoursWorkedPerWeek * weeksPerMonth;
  const targetMaxHousing = monthlyIncome * rentBurdenThreshold;

  const zillowUrl = buildZillowUrl(stateCode, searchTerm);
  const foodWebUrl = buildFoodWebUrl(searchTerm);
  const housingPressure = getHousingPressure(stateCode);

  // Generate Zillow-only estimated listings
  const studioRent = Math.round(selectedRent * 0.75 * housingPressure);
  const oneBedRent = Math.round(selectedRent * 0.9 * housingPressure);
  const twoBedRent = Math.round(selectedRent * 1.1 * housingPressure);

  const generatedHousing: HousingListing[] = [
    {
      title: `Studio apartment in ${searchTerm}`,
      source: 'Zillow' as const,
      monthlyCost: studioRent,
      location: searchTerm,
      url: zillowUrl,
      affordable: studioRent <= targetMaxHousing,
    },
    {
      title: `1-bedroom rental in ${searchTerm}`,
      source: 'Zillow' as const,
      monthlyCost: oneBedRent,
      location: searchTerm,
      url: zillowUrl,
      affordable: oneBedRent <= targetMaxHousing,
    },
    {
      title: `2-bedroom rental in ${searchTerm}`,
      source: 'Zillow' as const,
      monthlyCost: twoBedRent,
      location: searchTerm,
      url: zillowUrl,
      affordable: twoBedRent <= targetMaxHousing,
    },
  ].sort((a, b) => a.monthlyCost - b.monthlyCost);

  const baselineFood = getFoodBaseline(stateCode);
  const generatedFoodDeals: FoodDeal[] = [
    {
      title: 'Aldi + Walmart meal-prep basket',
      source: 'Web' as const,
      estimatedMonthlyCost: baselineFood,
      url: foodWebUrl,
    },
    {
      title: 'Discount produce co-op + bulk grains',
      source: 'Web' as const,
      estimatedMonthlyCost: Math.round(baselineFood * 0.85),
      url: foodWebUrl,
    },
    {
      title: 'Community pantry + low-cost meal plan',
      source: 'Web' as const,
      estimatedMonthlyCost: Math.round(baselineFood * 0.72),
      url: foodWebUrl,
    },
  ].sort((a, b) => a.estimatedMonthlyCost - b.estimatedMonthlyCost);

  const housingBudget = generatedHousing[0]?.monthlyCost ?? selectedRent;
  const foodBudget = generatedFoodDeals[0]?.estimatedMonthlyCost ?? baselineFood;
  const transportBudget = getTransportBaseline(stateCode);
  const utilities = 120;
  const phoneInternet = 90;
  const savings = Math.round(monthlyIncome * 0.08);

  const totalPlanned = housingBudget + foodBudget + transportBudget + utilities + phoneInternet + savings;

  return {
    housingListings: generatedHousing,
    foodDeals: generatedFoodDeals,
    budget: {
      income: Math.round(monthlyIncome),
      housing: housingBudget,
      food: foodBudget,
      transport: transportBudget,
      utilities,
      phoneInternet,
      savings,
      leftover: Math.round(monthlyIncome - totalPlanned),
    },
    searchLinks: {
      zillow: zillowUrl,
      foodWeb: foodWebUrl,
    },
  };
}
