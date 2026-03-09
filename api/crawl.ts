// Firecrawl API helper function
async function scrapeWithFirecrawl(url: string, options: { timeout?: number; stealth?: boolean } = {}): Promise<{ markdown?: string; html?: string; links?: string[] } | null> {
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
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'links'],
        waitFor: options.timeout || 10000,
        timeout: 60000,
        // Enable JavaScript rendering
        actions: [
          { type: 'wait', milliseconds: options.timeout || 10000 }
        ]
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

    console.log('Firecrawl: Got markdown length', data.data?.markdown?.length || 0, 'links:', data.data?.links?.length || 0);
    return {
      markdown: data.data?.markdown,
      html: data.data?.html,
      links: data.data?.links,
    };
  } catch (err) {
    console.log('Firecrawl: Exception', err);
    return null;
  }
}

// State to Craigslist subdomain mapping
function getCraigslistSubdomain(stateCode: string): string {
  const subdomains: Record<string, string> = {
    AL: 'bham', AK: 'anchorage', AZ: 'phoenix', AR: 'littlerock', CA: 'sfbay',
    CO: 'denver', CT: 'hartford', DE: 'delaware', FL: 'miami', GA: 'atlanta',
    HI: 'honolulu', ID: 'boise', IL: 'chicago', IN: 'indianapolis', IA: 'desmoines',
    KS: 'kansascity', KY: 'louisville', LA: 'neworleans', ME: 'maine', MD: 'baltimore',
    MA: 'boston', MI: 'detroit', MN: 'minneapolis', MS: 'jackson', MO: 'stlouis',
    MT: 'billings', NE: 'omaha', NV: 'lasvegas', NH: 'nh', NJ: 'newjersey',
    NM: 'albuquerque', NY: 'newyork', NC: 'charlotte', ND: 'fargo', OH: 'columbus',
    OK: 'okc', OR: 'portland', PA: 'philadelphia', RI: 'providence', SC: 'charleston',
    SD: 'siouxfalls', TN: 'nashville', TX: 'dallas', UT: 'saltlakecity', VT: 'vermont',
    VA: 'norfolk', WA: 'seattle', WV: 'charleston', WI: 'milwaukee', WY: 'wyoming',
    FED: 'newyork'
  };
  return subdomains[stateCode] || 'newyork';
}

// Housing pressure multiplier by state (affects estimated rent)
const HOUSING_PRESSURE_BY_STATE: Record<string, number> = {
  CA: 1.35, NY: 1.30, MA: 1.25, WA: 1.20, HI: 1.40, NJ: 1.22, CO: 1.15,
  CT: 1.18, MD: 1.15, OR: 1.12, VA: 1.10, FL: 1.08, AZ: 1.05,
  TX: 0.92, OH: 0.88, IA: 0.85, KS: 0.85, KY: 0.84, MS: 0.80, WV: 0.82,
  default: 1.0,
};

function getHousingPressure(stateCode: string): number {
  return HOUSING_PRESSURE_BY_STATE[stateCode] ?? HOUSING_PRESSURE_BY_STATE.default;
}

// Generate fallback housing listings when scraping fails
function generateFallbackHousingListings(
  searchTerm: string,
  maxRent: number,
  stateCode: string
): any[] {
  const pressure = getHousingPressure(stateCode);
  const subdomain = getCraigslistSubdomain(stateCode);
  const stateSlug = searchTerm.toLowerCase().replace(/\s+/g, '-');

  const roomRent = Math.round(maxRent * 0.40 * pressure);
  const sharedApt = Math.round(maxRent * 0.55 * pressure);
  const studioRent = Math.round(maxRent * 0.75 * pressure);
  const oneBedRent = Math.round(maxRent * 0.90 * pressure);

  return [
    {
      title: `Room in shared house in ${searchTerm}`,
      source: 'Craigslist' as const,
      monthlyCost: roomRent,
      location: searchTerm,
      url: `https://${subdomain}.craigslist.org/search/roo?max_price=${maxRent}`,
      affordable: roomRent <= maxRent,
      description: `Estimated room rental - sharing with roommates is the most affordable option in ${searchTerm}.`,
    },
    {
      title: `Shared apartment in ${searchTerm}`,
      source: 'Craigslist' as const,
      monthlyCost: sharedApt,
      location: searchTerm,
      url: `https://${subdomain}.craigslist.org/search/apa?max_price=${maxRent}`,
      affordable: sharedApt <= maxRent,
      description: `Estimated shared apartment cost - splitting a 2-3 bedroom with roommates.`,
    },
    {
      title: `Studio apartment in ${searchTerm}`,
      source: 'Apartments.com' as const,
      monthlyCost: studioRent,
      location: searchTerm,
      url: `https://www.apartments.com/${stateSlug}/?bb=&max-price=${maxRent}`,
      affordable: studioRent <= maxRent,
      description: `Estimated studio apartment - compact living option for single occupants.`,
    },
    {
      title: `1-bedroom rental in ${searchTerm}`,
      source: 'Zillow' as const,
      monthlyCost: oneBedRent,
      location: searchTerm,
      url: `https://www.zillow.com/${stateSlug}-${stateCode.toLowerCase()}/rentals/`,
      affordable: oneBedRent <= maxRent,
      description: `Estimated 1-bedroom apartment - typical entry-level standalone unit.`,
    },
  ].sort((a, b) => a.monthlyCost - b.monthlyCost);
}

// Parse housing listings from Firecrawl markdown content
function parseHousingFromMarkdown(markdown: string, source: string, maxRent: number, searchTerm: string, baseUrl: string, externalLinks?: string[]): any[] {
  const listings: any[] = [];
  
  // Collect listing URLs from external links array
  const listingUrls: string[] = [];
  if (externalLinks && externalLinks.length > 0) {
    for (const link of externalLinks) {
      // More lenient patterns for listing URLs
      const isListingUrl = (
        (source === 'Apartments.com' && link.includes('apartments.com/') && !link.endsWith('/new-york/') && !link.includes('?') && link.split('/').length > 4) ||
        (source === 'Zillow' && link.includes('zillow.com/apartments/') && !link.includes('#')) ||
        (source === 'Craigslist' && link.includes('craigslist.org') && link.match(/\/\d+\.html/))
      );
      if (isListingUrl) {
        listingUrls.push(link);
      }
    }
    if (listingUrls.length > 0) {
      console.log(`${source}: Found ${listingUrls.length} listing URLs`);
    }
  }
  
  // First, extract all URLs from the markdown that look like listing URLs
  const urlMap = new Map<string, string>(); // price -> url
  
  // Look for markdown links: [text](url) that contain listing URLs
  const linkPattern = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/gi;
  let linkMatch;
  while ((linkMatch = linkPattern.exec(markdown)) !== null) {
    const linkText = linkMatch[1];
    const url = linkMatch[2];
    
    // Check if this is a listing URL (not navigation, filters, etc.)
    const isListingUrl = (
      (source === 'Apartments.com' && url.includes('apartments.com/') && !url.endsWith('/new-york/') && !url.includes('?') && url.split('/').length > 4) ||
      (source === 'Zillow' && url.includes('zillow.com/apartments/') && !url.includes('#')) ||
      (source === 'Craigslist' && url.includes('craigslist.org') && url.match(/\/\d+\.html/))
    );
    
    if (isListingUrl) {
      // Try to associate with a price from nearby text
      const priceInText = linkText.match(/\$(\d{1,2}[,.]?\d{3})/);
      if (priceInText) {
        const price = parseInt(priceInText[1].replace(/[,.]/g, ''));
        if (price >= 400 && price <= maxRent * 1.5) {
          urlMap.set(String(price), url);
        }
      }
    }
  }
  
  // Split markdown into sections that might represent listings
  // Look for patterns like "$X,XXX" or "$XXXX" followed by property info
  const listingPattern = /\$(\d{1,2}[,.]?\d{3})(?:\s*[-–—\/]\s*\$\d{1,2}[,.]?\d{3})?(?:\/mo(?:nth)?)?[^\n]*(?:\n[^\n$]*){0,8}/gi;
  const matches = markdown.match(listingPattern) || [];
  
  const seenPrices = new Set<number>();
  
  for (const match of matches) {
    // Extract price
    const priceMatch = match.match(/\$(\d{1,2}[,.]?\d{3})/);
    if (!priceMatch) continue;
    
    const price = parseInt(priceMatch[1].replace(/[,.]/g, ''));
    
    // Skip invalid prices or duplicates
    if (price < 400 || price > maxRent * 1.5 || seenPrices.has(price)) continue;
    seenPrices.add(price);
    
    // Try to extract a URL from this match section
    let listingUrl = urlMap.get(String(price)) || '';
    
    // If no URL found yet, look for one in the match text
    if (!listingUrl) {
      const urlInMatch = match.match(/\((https?:\/\/(?:www\.)?(?:apartments\.com|zillow\.com|craigslist\.org)[^)]+)\)/);
      if (urlInMatch) {
        listingUrl = urlInMatch[1];
      }
    }
    
    // For Apartments.com, try to extract property name for URL
    if (!listingUrl && source === 'Apartments.com') {
      const nameMatch = match.match(/\[([A-Za-z0-9\s'-]+(?:Apartments?|Residences?|Lofts?|Flats?|Place|Manor|Heights|Village|Park|Gardens?|Towers?|Commons?|Pointe?|Square)?)\]/i);
      if (nameMatch) {
        const slug = nameMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const stateSlug = searchTerm.toLowerCase().replace(/\s+/g, '-');
        listingUrl = `https://www.apartments.com/${slug}/${stateSlug}/`;
      }
    }
    
    // If still no URL, try to use one from external links (round-robin)
    if (!listingUrl && listingUrls.length > 0) {
      listingUrl = listingUrls[listings.length % listingUrls.length];
    }
    
    // Fall back to search URL if no specific listing URL found
    if (!listingUrl) {
      listingUrl = baseUrl;
    }
    
    // Clean up the text to extract a title
    let text = match
      .replace(/https?:\/\/[^\s)]+/gi, '') // Remove URLs
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert markdown links to text
      .replace(/\$\d{1,2}[,.]?\d{3}(?:\s*[-–—\/]\s*\$\d{1,2}[,.]?\d{3})?(?:\/mo(?:nth)?)?/gi, '') // Remove price patterns
      .replace(/[#*\[\]()]/g, '') // Remove markdown formatting
      .replace(/No Max|Beds x Baths|BEDS|BATHS|Price Range|Filter/gi, '') // Remove filter UI text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Extract bed/bath info if present
    const bedMatch = text.match(/(\d+)\s*(?:bed(?:room)?s?|br|bd)/i);
    const bathMatch = text.match(/(\d+(?:\.\d)?)\s*(?:bath(?:room)?s?|ba)/i);
    const beds = bedMatch ? bedMatch[1] : null;
    const baths = bathMatch ? bathMatch[1] : null;
    
    // Try to extract property/complex name
    let title = '';
    const propertyNameMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Apartments?|Residences?|Lofts?|Flats?|Place|Manor|Heights|Village|Park|Gardens?|Towers?|Commons?|Pointe?|Square))?)/);
    if (propertyNameMatch && propertyNameMatch[1].length > 5) {
      title = propertyNameMatch[1];
    }
    
    // Add bed/bath info
    if (beds || baths) {
      const bedBath = `${beds || '?'} bed, ${baths || '?'} bath`;
      title = title ? `${title} - ${bedBath}` : bedBath;
    }
    
    // If no structured info found, try to extract first meaningful phrase
    if (!title) {
      const cleanLines = text.split(/[|\n]/).filter(l => 
        l.trim().length > 5 && 
        !l.includes('http') && 
        !l.match(/^\d+$/) &&
        !l.match(/^[\s\-–—]+$/)
      );
      title = cleanLines[0]?.substring(0, 60).trim() || `${source} listing`;
    }
    
    // Final cleanup
    title = title.replace(/^\s*[-–—:,]+\s*/, '').replace(/\s*[-–—:,]+\s*$/, '').trim();
    if (title.length < 5) title = `${source} rental - $${price}/mo`;
    
    listings.push({
      title,
      price,
      source,
      location: searchTerm,
      url: listingUrl,
      beds,
      baths,
      description: `$${price.toLocaleString()}/month ${beds ? beds + ' bed' : ''} ${baths ? baths + ' bath' : ''} rental in ${searchTerm}`.trim(),
    });
  }
  
  // Sort by price and return top 5
  return listings.sort((a, b) => a.price - b.price).slice(0, 5);
}

// Fetch Craigslist listings using Firecrawl
async function fetchCraigslistListings(searchTerm: string, maxRent: number, stateCode: string): Promise<any[]> {
  const subdomain = getCraigslistSubdomain(stateCode);
  const url = `https://${subdomain}.craigslist.org/search/apa?max_price=${Math.round(maxRent)}&availabilityMode=0`;
  
  const result = await scrapeWithFirecrawl(url, { timeout: 8000 });
  if (!result?.markdown) {
    console.log('Craigslist: No content returned');
    return [];
  }
  
  const listings = parseHousingFromMarkdown(result.markdown, 'Craigslist', maxRent, searchTerm, url, result.links);
  console.log('Craigslist: Found', listings.length, 'listings');
  return listings;
}

// Fetch Apartments.com listings using Firecrawl
async function fetchApartmentsListings(searchTerm: string, maxRent: number): Promise<any[]> {
  const stateSlug = searchTerm.toLowerCase().replace(/\s+/g, '-');
  // Use search endpoint with price filter for better results
  const url = `https://www.apartments.com/${stateSlug}/?bb=&rent=${Math.min(maxRent, 2000)}`;
  
  const result = await scrapeWithFirecrawl(url, { timeout: 15000 });
  if (!result?.markdown) {
    console.log('Apartments.com: No content returned');
    return [];
  }
  
  const listings = parseHousingFromMarkdown(result.markdown, 'Apartments.com', maxRent, searchTerm, url, result.links);
  console.log('Apartments.com: Found', listings.length, 'listings');
  return listings;
}

// Fetch Zillow listings using Firecrawl
async function fetchZillowListings(searchTerm: string, maxRent: number, stateCode: string): Promise<any[]> {
  const stateSlug = searchTerm.toLowerCase().replace(/\s+/g, '-');
  const url = `https://www.zillow.com/${stateSlug}-${stateCode.toLowerCase()}/rentals/`;
  
  const result = await scrapeWithFirecrawl(url, { timeout: 10000 });
  if (!result?.markdown) {
    console.log('Zillow: No content returned');
    return [];
  }
  
  const listings = parseHousingFromMarkdown(result.markdown, 'Zillow', maxRent, searchTerm, url, result.links);
  console.log('Zillow: Found', listings.length, 'listings');
  return listings;
}

// Static food deals (grocery sites typically block scrapers)
function getFoodDeals(searchTerm: string): any[] {
  return [
    {
      title: 'Aldi Budget Groceries',
      estimatedMonthlyCost: 150,
      source: 'Aldi',
      url: 'https://www.aldi.us/weekly-specials/our-weekly-ads/',
      description: `Aldi offers the lowest grocery prices. Plan meals around their weekly specials for ${searchTerm}. Stock up on staples like rice, beans, and frozen vegetables.`
    },
    {
      title: 'Walmart Grocery Pickup',
      estimatedMonthlyCost: 200,
      source: 'Walmart',
      url: 'https://www.walmart.com/cp/food/976759',
      description: `Use Walmart Grocery Pickup to avoid impulse buys in ${searchTerm}. Their Great Value brand is significantly cheaper than name brands.`
    },
    {
      title: 'Costco Bulk Shopping',
      estimatedMonthlyCost: 175,
      source: 'Costco',
      url: 'https://www.costco.com/grocery-household.html',
      description: `If you have roommates in ${searchTerm}, split a Costco membership. Bulk staples like rice, chicken, and produce save 30-40% vs regular stores.`
    }
  ];
}

// Estimate internet prices by region
function getInternetPrice(searchTerm: string): number {
  const lowCostStates = ['mississippi', 'arkansas', 'alabama', 'west virginia', 'kentucky'];
  const highCostStates = ['california', 'new york', 'massachusetts', 'connecticut', 'hawaii'];
  const state = searchTerm.toLowerCase();
  
  if (lowCostStates.some(s => state.includes(s))) {
    return 45;
  } else if (highCostStates.some(s => state.includes(s))) {
    return 75;
  }
  return 55;
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

// Generate smart recommendations based on scraped data
function generateRecommendations(input: {
  stateCode: string;
  hourlyWage: number;
  hoursWorkedPerWeek: number;
  selectedRent: number;
  monthlyIncome: number;
  housingListings: any[];
}): string[] {
  const recommendations: string[] = [];
  const { monthlyIncome, selectedRent, housingListings, stateCode, hourlyWage, hoursWorkedPerWeek } = input;

  const cheapestListing = housingListings.length > 0
    ? Math.min(...housingListings.map(l => l.monthlyCost).filter(c => c > 0))
    : selectedRent;

  const rentToIncome = selectedRent / monthlyIncome;
  const cheapestRatio = cheapestListing / monthlyIncome;
  const pressure = getHousingPressure(stateCode);

  // Recommendation based on rent burden
  if (rentToIncome > 0.50) {
    recommendations.push(`Consider finding 1-2 roommates to split rent and reduce your housing cost to under 30% of income.`);
  } else if (rentToIncome > 0.30) {
    recommendations.push(`Look for shared housing options on Craigslist to keep rent below the recommended 30% of income.`);
  } else {
    recommendations.push(`Your target rent is within the healthy 30% threshold - prioritize building an emergency fund.`);
  }

  // Recommendation based on housing pressure
  if (pressure > 1.2) {
    recommendations.push(`${STATE_NAMES[stateCode] || stateCode} has high housing costs - explore nearby suburbs or consider remote work options.`);
  } else if (pressure < 0.9) {
    recommendations.push(`${STATE_NAMES[stateCode] || stateCode} has below-average housing costs - use savings to pay down debt or invest.`);
  } else {
    recommendations.push(`Research neighborhoods near public transit to reduce transportation costs and expand housing options.`);
  }

  // Recommendation based on income potential
  if (hoursWorkedPerWeek < 30) {
    recommendations.push(`Increasing work hours to 30+ per week would add $${Math.round(hourlyWage * (30 - hoursWorkedPerWeek) * 4.33)} monthly to your budget.`);
  } else if (cheapestRatio > 0.40) {
    recommendations.push(`Apply for income-based assistance programs or look into subsidized housing in your area.`);
  } else {
    recommendations.push(`Set up automatic transfers to save at least 10% of each paycheck for emergencies and future goals.`);
  }

  console.log('Generated', recommendations.length, 'recommendations');
  return recommendations;
}

// State names lookup
const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', FED: 'United States',
};

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

    console.log(`Crawling for ${searchTerm}, max rent $${maxRent}`);

    // Scrape all sources in parallel using Firecrawl
    const [craigslistListings, apartmentsListings, zillowListings] = await Promise.all([
      fetchCraigslistListings(searchTerm, maxRent, stateCode),
      fetchApartmentsListings(searchTerm, maxRent),
      fetchZillowListings(searchTerm, maxRent, stateCode),
    ]);

    // Combine all housing listings
    const housingListings: any[] = [];
    const pressure = getHousingPressure(stateCode);
    const subdomain = getCraigslistSubdomain(stateCode);
    const stateSlug = searchTerm.toLowerCase().replace(/\s+/g, '-');

    // Add Craigslist listings or fallback
    if (craigslistListings.length > 0) {
      for (const item of craigslistListings) {
        housingListings.push({
          title: item.title,
          source: 'Craigslist' as const,
          monthlyCost: item.price || 0,
          location: item.location || searchTerm,
          url: item.url,
          affordable: (item.price || 0) <= maxRent,
          description: item.description || '',
        });
      }
    } else {
      // Add Craigslist fallback estimates
      const roomRent = Math.round(maxRent * 0.40 * pressure);
      const sharedApt = Math.round(maxRent * 0.55 * pressure);
      housingListings.push({
        title: `Room in shared house in ${searchTerm}`,
        source: 'Craigslist' as const,
        monthlyCost: roomRent,
        location: searchTerm,
        url: `https://${subdomain}.craigslist.org/search/roo?max_price=${maxRent}`,
        affordable: roomRent <= maxRent,
        description: `Estimated room rental - sharing with roommates is the most affordable option.`,
      });
      housingListings.push({
        title: `Shared apartment in ${searchTerm}`,
        source: 'Craigslist' as const,
        monthlyCost: sharedApt,
        location: searchTerm,
        url: `https://${subdomain}.craigslist.org/search/apa?max_price=${maxRent}`,
        affordable: sharedApt <= maxRent,
        description: `Estimated shared apartment cost - splitting a 2-3 bedroom with roommates.`,
      });
    }

    // Add Apartments.com listings
    for (const item of apartmentsListings) {
      housingListings.push({
        title: item.title,
        source: 'Apartments.com' as const,
        monthlyCost: item.price || 0,
        location: item.location || searchTerm,
        url: item.url,
        affordable: (item.price || 0) <= maxRent,
        description: item.description || '',
      });
    }

    // Add Zillow listings or fallback
    if (zillowListings.length > 0) {
      for (const item of zillowListings) {
        housingListings.push({
          title: item.title,
          source: 'Zillow' as const,
          monthlyCost: item.price || 0,
          location: item.location || searchTerm,
          url: item.url,
          affordable: (item.price || 0) <= maxRent,
          description: item.description || '',
        });
      }
    } else {
      // Add Zillow fallback estimates
      const studioRent = Math.round(maxRent * 0.75 * pressure);
      const oneBedRent = Math.round(maxRent * 0.90 * pressure);
      housingListings.push({
        title: `Studio apartment in ${searchTerm}`,
        source: 'Zillow' as const,
        monthlyCost: studioRent,
        location: searchTerm,
        url: `https://www.zillow.com/${stateSlug}-${stateCode.toLowerCase()}/rentals/`,
        affordable: studioRent <= maxRent,
        description: `Estimated studio apartment - compact living option for single occupants.`,
      });
      housingListings.push({
        title: `1-bedroom rental in ${searchTerm}`,
        source: 'Zillow' as const,
        monthlyCost: oneBedRent,
        location: searchTerm,
        url: `https://www.zillow.com/${stateSlug}-${stateCode.toLowerCase()}/rentals/`,
        affordable: oneBedRent <= maxRent,
        description: `Estimated 1-bedroom apartment - typical entry-level standalone unit.`,
      });
    }

    // Use full fallback if still no listings found
    if (housingListings.length === 0) {
      console.log('No scraped listings found, using fallback estimates');
      const fallbackListings = generateFallbackHousingListings(searchTerm, maxRent, stateCode);
      housingListings.push(...fallbackListings);
    }

    // Sort by price
    housingListings.sort((a, b) => a.monthlyCost - b.monthlyCost);

    // Get food deals and internet price
    const foodDeals = getFoodDeals(searchTerm);
    const internetPrice = getInternetPrice(searchTerm);

    // Calculate budget
    const validHousingPrices = housingListings.map(l => l.monthlyCost).filter(c => c > 0);
    const cheapestHousing = validHousingPrices.length > 0
      ? Math.min(...validHousingPrices)
      : selectedRent;
    const cheapestFood = Math.min(...foodDeals.map(f => f.estimatedMonthlyCost));

    const budget = {
      income: Math.round(monthlyIncome),
      housing: cheapestHousing,
      food: cheapestFood,
      transport: 150,
      utilities: 100,
      phoneInternet: internetPrice,
      savings: Math.round(monthlyIncome * 0.1),
      leftover: Math.round(monthlyIncome - cheapestHousing - cheapestFood - 150 - 100 - internetPrice - monthlyIncome * 0.1),
    };

    // Format food deals for response
    const formattedFoodDeals = foodDeals.map(item => ({
      title: item.title,
      source: 'Web' as const,
      estimatedMonthlyCost: item.estimatedMonthlyCost,
      url: item.url,
      description: item.description,
    }));

    // Build search links
    const searchLinks = {
      craigslist: `https://${subdomain}.craigslist.org/search/apa?max_price=${maxRent}`,
      apartments: `https://www.apartments.com/${stateSlug}/?bb=&max-price=${maxRent}`,
      zillow: `https://www.zillow.com/${stateSlug}-${stateCode.toLowerCase()}/rentals/`,
      foodWeb: `https://duckduckgo.com/?q=${encodeURIComponent(searchTerm + ' affordable groceries student budget meal prep')}`,
    };

    // Generate smart recommendations based on scraped data
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
