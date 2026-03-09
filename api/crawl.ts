// Firecrawl API helper function
async function scrapeWithFirecrawl(
  url: string,
  options: { timeout?: number } = {}
): Promise<{ markdown?: string; links?: string[] } | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.log('Firecrawl: No API key');
    return null;
  }

  try {
    console.log('Firecrawl: Scraping', url);
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'links'],
        waitFor: options.timeout || 10000,
        timeout: 60000,
        actions: [{ type: 'wait', milliseconds: options.timeout || 10000 }],
      }),
    });

    if (!response.ok) {
      console.log('Firecrawl: Error status', response.status);
      return null;
    }

    const data = await response.json();
    if (!data.success) {
      console.log('Firecrawl: Scrape failed', data.error);
      return null;
    }

    console.log(
      'Firecrawl: Got markdown length',
      data.data?.markdown?.length || 0,
      'links:',
      data.data?.links?.length || 0
    );
    return {
      markdown: data.data?.markdown,
      links: data.data?.links,
    };
  } catch (err) {
    console.log('Firecrawl: Exception', err);
    return null;
  }
}

// Housing pressure multiplier by state
const HOUSING_PRESSURE_BY_STATE: Record<string, number> = {
  CA: 1.35, NY: 1.3, MA: 1.25, WA: 1.2, HI: 1.4, NJ: 1.22, CO: 1.15,
  CT: 1.18, MD: 1.15, OR: 1.12, VA: 1.1, FL: 1.08, AZ: 1.05,
  TX: 0.92, OH: 0.88, IA: 0.85, KS: 0.85, KY: 0.84, MS: 0.8, WV: 0.82,
  default: 1.0,
};

function getHousingPressure(stateCode: string): number {
  return HOUSING_PRESSURE_BY_STATE[stateCode] ?? HOUSING_PRESSURE_BY_STATE.default;
}

// State names lookup
const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  FED: 'United States',
};

// Parse housing listings from Firecrawl markdown content
function parseZillowListings(
  markdown: string,
  maxRent: number,
  searchTerm: string,
  baseUrl: string,
  externalLinks?: string[]
): any[] {
  const listings: any[] = [];

  // Collect Zillow listing URLs from external links
  const listingUrls: string[] = [];
  if (externalLinks && externalLinks.length > 0) {
    for (const link of externalLinks) {
      if (link.includes('zillow.com/apartments/') && !link.includes('#')) {
        listingUrls.push(link);
      }
    }
    if (listingUrls.length > 0) {
      console.log(`Zillow: Found ${listingUrls.length} listing URLs`);
    }
  }

  // Extract prices from markdown
  const listingPattern =
    /\$(\d{1,2}[,.]?\d{3})(?:\s*[-–—\/]\s*\$\d{1,2}[,.]?\d{3})?(?:\/mo(?:nth)?)?[^\n]*(?:\n[^\n$]*){0,8}/gi;
  const matches = markdown.match(listingPattern) || [];

  const seenPrices = new Set<number>();

  for (const match of matches) {
    const priceMatch = match.match(/\$(\d{1,2}[,.]?\d{3})/);
    if (!priceMatch) continue;

    const price = parseInt(priceMatch[1].replace(/[,.]/g, ''));
    if (price < 400 || price > maxRent * 2 || seenPrices.has(price)) continue;
    seenPrices.add(price);

    // Get a listing URL
    let listingUrl = '';
    if (listingUrls.length > 0) {
      listingUrl = listingUrls[listings.length % listingUrls.length];
    }
    if (!listingUrl) listingUrl = baseUrl;

    // Extract bed/bath info
    const bedMatch = match.match(/(\d+)\s*(?:bed(?:room)?s?|br|bd)/i);
    const bathMatch = match.match(/(\d+(?:\.\d)?)\s*(?:bath(?:room)?s?|ba)/i);
    const beds = bedMatch ? bedMatch[1] : null;
    const baths = bathMatch ? bathMatch[1] : null;

    // Build title
    let title = '';
    if (beds || baths) {
      title = `${beds || '?'} bed, ${baths || '?'} bath`;
    }
    if (!title) {
      title = match.includes('Studio') ? 'Studio' : `Zillow rental - $${price}/mo`;
    }

    listings.push({
      title,
      price,
      source: 'Zillow',
      location: searchTerm,
      url: listingUrl,
      beds,
      baths,
      description: `$${price.toLocaleString()}/month ${beds ? beds + ' bed' : ''} ${baths ? baths + ' bath' : ''} rental in ${searchTerm}`.trim(),
    });
  }

  return listings.sort((a, b) => a.price - b.price).slice(0, 10);
}

// Fetch Zillow listings using Firecrawl
async function fetchZillowListings(
  searchTerm: string,
  maxRent: number,
  stateCode: string
): Promise<any[]> {
  const stateSlug = searchTerm.toLowerCase().replace(/\s+/g, '-');
  const url = `https://www.zillow.com/${stateSlug}-${stateCode.toLowerCase()}/rentals/`;

  const result = await scrapeWithFirecrawl(url, { timeout: 12000 });
  if (!result?.markdown) {
    console.log('Zillow: No content returned');
    return [];
  }

  const listings = parseZillowListings(
    result.markdown,
    maxRent,
    searchTerm,
    url,
    result.links
  );
  console.log('Zillow: Found', listings.length, 'listings');
  return listings;
}

// Generate fallback listings when Zillow fails
function generateFallbackListings(searchTerm: string, maxRent: number, stateCode: string): any[] {
  const pressure = getHousingPressure(stateCode);
  const stateSlug = searchTerm.toLowerCase().replace(/\s+/g, '-');
  const baseUrl = `https://www.zillow.com/${stateSlug}-${stateCode.toLowerCase()}/rentals/`;

  const studioRent = Math.round(maxRent * 0.75 * pressure);
  const oneBedRent = Math.round(maxRent * 0.9 * pressure);
  const twoBedRent = Math.round(maxRent * 1.1 * pressure);

  return [
    {
      title: `Studio apartment in ${searchTerm}`,
      source: 'Zillow',
      monthlyCost: studioRent,
      location: searchTerm,
      url: baseUrl,
      affordable: studioRent <= maxRent,
      description: `Estimated studio apartment - compact living option.`,
    },
    {
      title: `1-bedroom rental in ${searchTerm}`,
      source: 'Zillow',
      monthlyCost: oneBedRent,
      location: searchTerm,
      url: baseUrl,
      affordable: oneBedRent <= maxRent,
      description: `Estimated 1-bedroom apartment.`,
    },
    {
      title: `2-bedroom rental in ${searchTerm}`,
      source: 'Zillow',
      monthlyCost: twoBedRent,
      location: searchTerm,
      url: baseUrl,
      affordable: twoBedRent <= maxRent,
      description: `Estimated 2-bedroom - good for roommates.`,
    },
  ];
}

// Static food deals
function getFoodDeals(searchTerm: string): any[] {
  return [
    {
      title: 'Aldi Budget Groceries',
      estimatedMonthlyCost: 150,
      source: 'Aldi',
      url: 'https://www.aldi.us/weekly-specials/our-weekly-ads/',
      description: `Aldi offers the lowest grocery prices. Plan meals around their weekly specials for ${searchTerm}.`,
    },
    {
      title: 'Walmart Grocery Pickup',
      estimatedMonthlyCost: 200,
      source: 'Walmart',
      url: 'https://www.walmart.com/cp/food/976759',
      description: `Use Walmart Grocery Pickup to avoid impulse buys in ${searchTerm}.`,
    },
    {
      title: 'Costco Bulk Shopping',
      estimatedMonthlyCost: 175,
      source: 'Costco',
      url: 'https://www.costco.com/grocery-household.html',
      description: `If you have roommates in ${searchTerm}, split a Costco membership.`,
    },
  ];
}

// Estimate internet prices by region
function getInternetPrice(searchTerm: string): number {
  const lowCostStates = ['mississippi', 'arkansas', 'alabama', 'west virginia', 'kentucky'];
  const highCostStates = ['california', 'new york', 'massachusetts', 'connecticut', 'hawaii'];
  const state = searchTerm.toLowerCase();

  if (lowCostStates.some((s) => state.includes(s))) return 45;
  if (highCostStates.some((s) => state.includes(s))) return 75;
  return 55;
}

// Generate recommendations based on data
function generateRecommendations(input: {
  stateCode: string;
  hourlyWage: number;
  hoursWorkedPerWeek: number;
  selectedRent: number;
  monthlyIncome: number;
  housingListings: any[];
}): string[] {
  const recommendations: string[] = [];
  const { monthlyIncome, selectedRent, stateCode, hourlyWage, hoursWorkedPerWeek } = input;

  const rentToIncome = selectedRent / monthlyIncome;
  const pressure = getHousingPressure(stateCode);

  if (rentToIncome > 0.5) {
    recommendations.push(
      `Consider finding 1-2 roommates to split rent and reduce your housing cost to under 30% of income.`
    );
  } else if (rentToIncome > 0.3) {
    recommendations.push(
      `Look for shared housing options to keep rent below the recommended 30% of income.`
    );
  } else {
    recommendations.push(
      `Your target rent is within the healthy 30% threshold - prioritize building an emergency fund.`
    );
  }

  if (pressure > 1.2) {
    recommendations.push(
      `${STATE_NAMES[stateCode] || stateCode} has high housing costs - explore nearby suburbs or consider remote work.`
    );
  } else if (pressure < 0.9) {
    recommendations.push(
      `${STATE_NAMES[stateCode] || stateCode} has below-average housing costs - use savings to pay down debt.`
    );
  } else {
    recommendations.push(
      `Research neighborhoods near public transit to reduce transportation costs.`
    );
  }

  if (hoursWorkedPerWeek < 30) {
    recommendations.push(
      `Increasing work hours to 30+ per week would add $${Math.round(hourlyWage * (30 - hoursWorkedPerWeek) * 4.33)} monthly.`
    );
  } else {
    recommendations.push(
      `Set up automatic transfers to save at least 10% of each paycheck for emergencies.`
    );
  }

  return recommendations;
}

// Types
interface CrawlerRequestQuery {
  stateCode?: string;
  hourlyWage?: string;
  hoursWorkedPerWeek?: string;
  weeksPerMonth?: string;
  selectedRent?: string;
}

interface VercelLikeRequest {
  method?: string;
  query: CrawlerRequestQuery;
}

interface VercelLikeResponse {
  status: (code: number) => VercelLikeResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

function toNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Main API handler
export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stateCode = (req.query.stateCode ?? 'FED').toUpperCase();
  const hourlyWage = toNumber(req.query.hourlyWage, 15);
  const hoursWorkedPerWeek = toNumber(req.query.hoursWorkedPerWeek, 20);
  const weeksPerMonth = toNumber(req.query.weeksPerMonth, 4.33);
  const selectedRent = toNumber(req.query.selectedRent, 1800);

  try {
    const searchTerm = STATE_NAMES[stateCode] ?? 'United States';
    const maxRent = selectedRent;
    const monthlyIncome = hourlyWage * hoursWorkedPerWeek * weeksPerMonth;
    const stateSlug = searchTerm.toLowerCase().replace(/\s+/g, '-');

    console.log(`Crawling for ${searchTerm}, max rent $${maxRent}`);

    // Fetch Zillow listings
    const zillowListings = await fetchZillowListings(searchTerm, maxRent, stateCode);

    // Build housing listings
    const housingListings: any[] = [];

    if (zillowListings.length > 0) {
      for (const item of zillowListings) {
        housingListings.push({
          title: item.title,
          source: 'Zillow',
          monthlyCost: item.price || 0,
          location: item.location || searchTerm,
          url: item.url,
          affordable: (item.price || 0) <= maxRent,
          description: item.description || '',
        });
      }
    } else {
      // Use fallback estimates
      console.log('No Zillow listings found, using fallback estimates');
      const fallbackListings = generateFallbackListings(searchTerm, maxRent, stateCode);
      housingListings.push(...fallbackListings);
    }

    // Sort by price
    housingListings.sort((a, b) => a.monthlyCost - b.monthlyCost);

    // Get food deals and internet price
    const foodDeals = getFoodDeals(searchTerm);
    const internetPrice = getInternetPrice(searchTerm);

    // Calculate budget
    const validHousingPrices = housingListings.map((l) => l.monthlyCost).filter((c) => c > 0);
    const cheapestHousing = validHousingPrices.length > 0 ? Math.min(...validHousingPrices) : selectedRent;
    const cheapestFood = Math.min(...foodDeals.map((f) => f.estimatedMonthlyCost));

    const budget = {
      income: Math.round(monthlyIncome),
      housing: cheapestHousing,
      food: cheapestFood,
      transport: 150,
      utilities: 100,
      phoneInternet: internetPrice,
      savings: Math.round(monthlyIncome * 0.1),
      leftover: Math.round(
        monthlyIncome - cheapestHousing - cheapestFood - 150 - 100 - internetPrice - monthlyIncome * 0.1
      ),
    };

    // Format food deals
    const formattedFoodDeals = foodDeals.map((item) => ({
      title: item.title,
      source: 'Web' as const,
      estimatedMonthlyCost: item.estimatedMonthlyCost,
      url: item.url,
      description: item.description,
    }));

    // Build search links
    const searchLinks = {
      zillow: `https://www.zillow.com/${stateSlug}-${stateCode.toLowerCase()}/rentals/`,
      foodWeb: `https://duckduckgo.com/?q=${encodeURIComponent(searchTerm + ' affordable groceries budget')}`,
    };

    // Generate recommendations
    const aiRecommendations = generateRecommendations({
      stateCode,
      hourlyWage,
      hoursWorkedPerWeek,
      selectedRent,
      monthlyIncome,
      housingListings,
    });

    const data = {
      housingListings,
      foodDeals: formattedFoodDeals,
      budget,
      searchLinks,
    };

    return res.status(200).json({
      mode: 'serverless',
      firecrawlConfigured: Boolean(process.env.FIRECRAWL_API_KEY),
      aiRecommendations,
      data,
    });
  } catch (error) {
    console.error('Crawler error:', error);
    const message = error instanceof Error ? error.message : 'Unknown crawler failure';
    return res.status(500).json({ error: message });
  }
}
