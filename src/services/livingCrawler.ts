export interface HousingListing {
  title: string;
  source: 'Craigslist' | 'Apartments.com' | 'Zillow' | 'Web';
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
    craigslist: string;
    apartments: string;
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

function buildCraigslistUrl(city: string, maxRent: number): string {
  const encodedCity = encodeURIComponent(city);
  return `https://www.craigslist.org/search/apa?query=${encodedCity}&max_price=${Math.round(maxRent)}`;
}

function buildFoodWebUrl(city: string): string {
  const query = encodeURIComponent(`${city} affordable groceries student budget meal prep`);
  return `https://duckduckgo.com/?q=${query}`;
}

function buildApartmentsUrl(city: string, maxRent: number): string {
  const cityPath = encodeURIComponent(city.toLowerCase().replace(/\s+/g, '-'));
  return `https://www.apartments.com/${cityPath}/?bb=&max-price=${Math.round(maxRent)}`;
}

function buildZillowUrl(city: string, maxRent: number): string {
  const encoded = encodeURIComponent(city);
  return `https://www.zillow.com/homes/for_rent/${encoded}_rb/?searchQueryState=%7B%22filterState%22%3A%7B%22mp%22%3A%7B%22max%22%3A${Math.round(maxRent)}%7D%7D%7D`;
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

  const craigslistUrl = buildCraigslistUrl(searchTerm, targetMaxHousing);
  const apartmentsUrl = buildApartmentsUrl(searchTerm, targetMaxHousing);
  const zillowUrl = buildZillowUrl(searchTerm, targetMaxHousing);
  const foodWebUrl = buildFoodWebUrl(searchTerm);
  const housingPressure = getHousingPressure(stateCode);

  const roomRent = Math.round(Math.max(targetMaxHousing * 0.8, selectedRent * 0.42 * housingPressure));
  const sharedApartmentRent = Math.round(
    Math.max(targetMaxHousing * 0.92, selectedRent * 0.56 * housingPressure),
  );
  const studioRent = Math.round(
    Math.max(targetMaxHousing * 1.05, selectedRent * 0.72 * housingPressure),
  );
  const apartmentsComRent = Math.round(
    Math.max(targetMaxHousing * 1.02, selectedRent * 0.67 * housingPressure),
  );
  const zillowRent = Math.round(Math.max(targetMaxHousing * 1.08, selectedRent * 0.7 * housingPressure));

  const generatedHousing: HousingListing[] = [
    {
      title: `Shared apartment in ${searchTerm}`,
      source: 'Craigslist' as const,
      monthlyCost: sharedApartmentRent,
      location: searchTerm,
      url: craigslistUrl,
      affordable: sharedApartmentRent <= targetMaxHousing,
    },
    {
      title: `Room in shared house in ${searchTerm}`,
      source: 'Craigslist' as const,
      monthlyCost: roomRent,
      location: searchTerm,
      url: craigslistUrl,
      affordable: roomRent <= targetMaxHousing,
    },
    {
      title: `Studio / sublet option in ${searchTerm}`,
      source: 'Web' as const,
      monthlyCost: studioRent,
      location: searchTerm,
      url: craigslistUrl,
      affordable: studioRent <= targetMaxHousing,
    },
    {
      title: `Apartment listing match in ${searchTerm}`,
      source: 'Apartments.com' as const,
      monthlyCost: apartmentsComRent,
      location: searchTerm,
      url: apartmentsUrl,
      affordable: apartmentsComRent <= targetMaxHousing,
    },
    {
      title: `Rental listing match in ${searchTerm}`,
      source: 'Zillow' as const,
      monthlyCost: zillowRent,
      location: searchTerm,
      url: zillowUrl,
      affordable: zillowRent <= targetMaxHousing,
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
      craigslist: craigslistUrl,
      apartments: apartmentsUrl,
      zillow: zillowUrl,
      foodWeb: foodWebUrl,
    },
  };
}
