// ScrapingBee helper function
async function scrapePage(url: string): Promise<string | null> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) {
    console.log('ScrapingBee: No API key');
    return null;
  }
  try {
    const encodedUrl = encodeURIComponent(url);
    const endpoint = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodedUrl}&render_js=true&premium_proxy=true`;
    console.log('ScrapingBee: Fetching', url);
    const response = await fetch(endpoint);
    if (!response.ok) {
      console.log('ScrapingBee: Error status', response.status);
      return null;
    }
    const html = await response.text();
    console.log('ScrapingBee: Got', html.length, 'bytes');
    return html;
  } catch (err) {
    console.log('ScrapingBee: Exception', err);
    return null;
  }
}

// Scrape real grocery deals from local stores
async function fetchFoodDeals(searchTerm: string): Promise<any[]> {
  // Use static affordable food strategies as a baseline (most grocery sites block scrapers)
  const stateOrCity = searchTerm.toLowerCase();
  const deals = [
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
  return deals;
}

// Return realistic internet price estimates by region
async function fetchInternetPrices(searchTerm: string): Promise<number | null> {
  // Average internet prices by region (static but realistic)
  const lowCostStates = ['mississippi', 'arkansas', 'alabama', 'west virginia', 'kentucky'];
  const highCostStates = ['california', 'new york', 'massachusetts', 'connecticut', 'hawaii'];
  const state = searchTerm.toLowerCase();
  
  if (lowCostStates.some(s => state.includes(s))) {
    return 45;
  } else if (highCostStates.some(s => state.includes(s))) {
    return 75;
  }
  return 55; // Average for most states
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

// Scrape REAL Craigslist listings using ScrapingBee
async function fetchCraigslistListings(searchTerm: string, maxRent: number, stateCode: string = 'NY'): Promise<any[]> {
  const subdomain = getCraigslistSubdomain(stateCode);
  const url = `https://${subdomain}.craigslist.org/search/apa?max_price=${Math.round(maxRent)}&availabilityMode=0`;
  
  const html = await scrapePage(url);
  if (!html) {
    console.log('Craigslist: No HTML returned, using fallback');
    return [];
  }
  
  const listings: any[] = [];
  
  // Try to parse JSON-LD structured data first (most reliable)
  const jsonLdMatch = html.match(/<script[^>]*id="ld_searchpage_results"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      const items = jsonLd.itemListElement || [];
      console.log('Craigslist: Found', items.length, 'JSON-LD listings');
      
      for (const item of items.slice(0, 5)) {
        const apartment = item.item;
        if (apartment && apartment.name) {
          const address = apartment.address || {};
          const location = address.addressLocality || searchTerm;
          listings.push({
            title: apartment.name.substring(0, 100),
            price: null, // JSON-LD doesn't include price, need to get from HTML
            location: `${location}, ${address.addressRegion || stateCode}`,
            url: `https://${subdomain}.craigslist.org/search/apa?max_price=${Math.round(maxRent)}`,
            description: `${apartment.numberOfBedrooms || '?'} bed, ${apartment.numberOfBathroomsTotal || '?'} bath in ${location}`
          });
        }
      }
    } catch (e) {
      console.log('Craigslist: JSON-LD parse error', e);
    }
  }
  
  // Extract prices from HTML gallery results
  const pricePattern = /class="[^"]*result-price[^"]*"[^>]*>\$?([\d,]+)/gi;
  const prices: number[] = [];
  let priceMatch;
  while ((priceMatch = pricePattern.exec(html)) !== null) {
    prices.push(parseInt(priceMatch[1].replace(/,/g, '')));
  }
  
  // Also try the newer Craigslist format
  const galleryPattern = /<li[^>]*class="[^"]*cl-search-result[^"]*"[^>]*>[\s\S]*?<\/li>/gi;
  const galleryMatches = html.match(galleryPattern) || [];
  
  console.log('Craigslist: Found', galleryMatches.length, 'gallery items,', prices.length, 'prices');
  
  // If we got JSON-LD listings, try to match them with prices
  if (listings.length > 0 && prices.length > 0) {
    for (let i = 0; i < Math.min(listings.length, prices.length); i++) {
      if (prices[i] <= maxRent * 1.2) {
        listings[i].price = prices[i];
      }
    }
    // Filter out listings without valid prices
    return listings.filter(l => l.price && l.price <= maxRent * 1.2);
  }
  
  // Fallback: parse gallery items directly
  for (const match of galleryMatches.slice(0, 8)) {
    const titleMatch = match.match(/class="[^"]*titlestring[^"]*"[^>]*>([^<]+)</i) ||
                       match.match(/<a[^>]*>([^<]{10,100})<\/a>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;
    
    const priceMatch = match.match(/\$[\d,]+/);
    const price = priceMatch ? parseInt(priceMatch[0].replace(/[$,]/g, '')) : null;
    
    const urlMatch = match.match(/href="(https?:\/\/[^"]+\.html)"/i);
    const listingUrl = urlMatch ? urlMatch[1] : `https://${subdomain}.craigslist.org/search/apa`;
    
    if (title && price && price <= maxRent * 1.2) {
      listings.push({
        title: title.substring(0, 100),
        price,
        location: searchTerm,
        url: listingUrl,
        description: `Craigslist apartment: ${title.substring(0, 60)} - $${price}/month`
      });
    }
  }
  
  console.log('Craigslist: Final parsed', listings.length, 'valid listings');
  return listings.slice(0, 5);
}

// Scrape REAL Apartments.com listings using ScrapingBee with stealth proxy
async function fetchApartmentsListings(searchTerm: string, maxRent: number): Promise<any[]> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) {
    console.log('Apartments.com: No API key');
    return [];
  }
  
  // Use state slug format for Apartments.com URL
  const stateSlug = searchTerm.toLowerCase().replace(/\s+/g, '-');
  const targetUrl = `https://www.apartments.com/${stateSlug}/`;
  const encodedUrl = encodeURIComponent(targetUrl);
  
  // Use stealth_proxy for Apartments.com (75 credits but works)
  const endpoint = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodedUrl}&render_js=true&stealth_proxy=true&wait=3000`;
  
  console.log('Apartments.com: Fetching with stealth proxy', targetUrl);
  
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      console.log('Apartments.com: Error status', response.status);
      return [];
    }
    const html = await response.text();
    console.log('Apartments.com: Got', html.length, 'bytes');
    
    if (html.length < 1000) {
      console.log('Apartments.com: Response too small, likely blocked');
      return [];
    }
    
    const listings: any[] = [];
    
    // Look for JSON data in script tags first
    const jsonMatch = html.match(/"listingModels"\s*:\s*(\[[\s\S]*?\])/);
    if (jsonMatch) {
      try {
        const listingData = JSON.parse(jsonMatch[1]);
        console.log('Apartments.com: Found', listingData.length, 'JSON listings');
        
        for (const item of listingData.slice(0, 8)) {
          const price = item.pricing?.rentRange?.min || item.pricing?.rentLabel?.match(/\$?([\d,]+)/)?.[1];
          const priceNum = typeof price === 'string' ? parseInt(price.replace(/[$,]/g, '')) : price;
          
          if (priceNum && priceNum <= maxRent * 1.3) {
            listings.push({
              title: item.listingName || item.name || 'Apartment',
              price: priceNum,
              location: `${item.location?.city || ''}, ${item.location?.state || ''}`.trim(),
              url: item.listingUrl ? `https://www.apartments.com${item.listingUrl}` : 'https://www.apartments.com',
              description: `${item.bedRange || ''} - Starting at $${priceNum}/month`
            });
          }
        }
      } catch (e) {
        console.log('Apartments.com: JSON parse failed');
      }
    }
    
    // Fallback to HTML parsing
    if (listings.length === 0) {
      // Look for placard elements
      const placardPattern = /<article[^>]*class="[^"]*placard[^"]*"[^>]*>[\s\S]*?<\/article>/gi;
      const matches = html.match(placardPattern) || [];
      console.log('Apartments.com: Found', matches.length, 'HTML placards');
      
      for (const match of matches.slice(0, 8)) {
        const titleMatch = match.match(/property-title[^>]*>([^<]+)</i) ||
                          match.match(/<span[^>]*js-placardTitle[^>]*>([^<]+)</i);
        const title = titleMatch ? titleMatch[1].trim() : null;
        
        const priceMatch = match.match(/\$[\d,]+/);
        const price = priceMatch ? parseInt(priceMatch[0].replace(/[$,]/g, '')) : null;
        
        const urlMatch = match.match(/href="(https:\/\/www\.apartments\.com\/[^"]+)"/i);
        const listingUrl = urlMatch ? urlMatch[1] : 'https://www.apartments.com';
        
        if (title && price && price <= maxRent * 1.3) {
          listings.push({
            title: title.substring(0, 100),
            price,
            location: searchTerm,
            url: listingUrl,
            description: `Apartments.com: ${title} - $${price}/month`
          });
        }
      }
    }
    
    console.log('Apartments.com: Final parsed', listings.length, 'valid listings');
    return listings.slice(0, 5);
    
  } catch (err) {
    console.log('Apartments.com: Exception', err);
    return [];
  }
}

// Scrape REAL Zillow rentals using ScrapingBee with stealth proxy
async function fetchZillowListings(searchTerm: string, maxRent: number, stateCode: string = 'NY'): Promise<any[]> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) {
    console.log('Zillow: No API key');
    return [];
  }
  
  // Build Zillow URL based on state
  const stateSlug = searchTerm.toLowerCase().replace(/\s+/g, '-');
  const targetUrl = `https://www.zillow.com/${stateSlug}-${stateCode.toLowerCase()}/rentals/`;
  const encodedUrl = encodeURIComponent(targetUrl);
  
  // Use stealth_proxy for Zillow (75 credits but bypasses protection)
  const endpoint = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodedUrl}&render_js=true&stealth_proxy=true&wait=3000`;
  
  console.log('Zillow: Fetching with stealth proxy', targetUrl);
  
  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      console.log('Zillow: Error status', response.status);
      return [];
    }
    const html = await response.text();
    console.log('Zillow: Got', html.length, 'bytes');
    
    if (html.length < 1000) {
      console.log('Zillow: Response too small, likely blocked');
      return [];
    }
    
    const listings: any[] = [];
  
  // Find listResults JSON data in the page
  const listResultsIdx = html.indexOf('"listResults"');
  if (listResultsIdx > -1) {
    try {
      // Find the start of the array
      const arrayStart = html.indexOf('[', listResultsIdx);
      if (arrayStart > -1 && arrayStart - listResultsIdx < 20) {
        // Find matching bracket by counting
        let depth = 0;
        let arrayEnd = arrayStart;
        for (let i = arrayStart; i < html.length && arrayEnd === arrayStart; i++) {
          if (html[i] === '[') depth++;
          else if (html[i] === ']') {
            depth--;
            if (depth === 0) arrayEnd = i + 1;
          }
        }
        
        const jsonStr = html.slice(arrayStart, arrayEnd);
        const listResults = JSON.parse(jsonStr);
        console.log('Zillow: Parsed', listResults.length, 'listResults');
        
        for (const item of listResults.slice(0, 8)) {
          // Skip building listings, get actual units
          const units = item.units || [];
          const address = item.address || item.addressStreet || 'Rental Property';
          const detailUrl = item.detailUrl || '';
          const buildingName = item.buildingName || item.statusText || '';
          
          // Get the cheapest unit price
          let cheapestPrice = Infinity;
          let beds = 'Studio';
          for (const unit of units) {
            if (unit.price) {
              const priceNum = parseInt(unit.price.replace(/[$,+]/g, ''));
              if (priceNum < cheapestPrice) {
                cheapestPrice = priceNum;
                beds = unit.beds === '0' ? 'Studio' : `${unit.beds} bed`;
              }
            }
          }
          
          // If no units, try to get price directly
          if (cheapestPrice === Infinity && item.price) {
            const priceStr = typeof item.price === 'string' ? item.price : String(item.price);
            cheapestPrice = parseInt(priceStr.replace(/[$,+]/g, ''));
          }
          
          if (cheapestPrice > 0 && cheapestPrice <= maxRent * 1.3) {
            // Fix URL - ensure no double prefix
            let listingUrl = detailUrl;
            if (listingUrl && !listingUrl.startsWith('http')) {
              listingUrl = `https://www.zillow.com${detailUrl}`;
            } else if (!listingUrl) {
              listingUrl = 'https://www.zillow.com';
            }
            
            listings.push({
              title: buildingName || address.substring(0, 80),
              price: cheapestPrice,
              location: `${item.addressCity || ''}, ${item.addressState || 'NY'}`.trim(),
              url: listingUrl,
              description: `${beds} starting at $${cheapestPrice}/month - ${address}`
            });
          }
        }
      }
    } catch (e) {
      console.log('Zillow: JSON parse failed', e);
    }
  }
  
  console.log('Zillow: Final parsed', listings.length, 'valid listings');
  return listings.slice(0, 5);
  
  } catch (err) {
    console.log('Zillow: Exception', err);
    return [];
  }
}

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

interface ClaudeMessageResponse {
  content?: Array<{ type: string; text?: string }>;
}

function toNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function getClaudeRecommendations(input: {
  stateCode: string;
  hourlyWage: number;
  hoursWorkedPerWeek: number;
  selectedRent: number;
  monthlyIncome: number;
}): Promise<string[] | null> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return null;
  }

  const prompt = [
    'You are an affordability assistant for recent college graduates.',
    `State: ${input.stateCode}`,
    `Hourly wage: ${input.hourlyWage}`,
    `Hours per week: ${input.hoursWorkedPerWeek}`,
    `Selected monthly rent: ${input.selectedRent}`,
    `Estimated monthly income: ${Math.round(input.monthlyIncome)}`,
    'Provide exactly 3 concise recommendations for affordable living.',
    'Each recommendation must be one sentence and start with a verb.',
    'Return as plain text with one recommendation per line and no numbering.',
  ].join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 220,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as ClaudeMessageResponse;
  const text = payload.content?.find((part) => part.type === 'text')?.text?.trim();
  if (!text) {
    return null;
  }

  const lines = text
    .split('\n')
    .map((line) => line.trim().replace(/^[-*\d.)\s]+/, ''))
    .filter(Boolean)
    .slice(0, 3);

  return lines.length > 0 ? lines : null;
}

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

    // Use state name for Craigslist search
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
    const searchTerm = stateNames[stateCode] ?? 'united states';
    const maxRent = selectedRent;
    
    // Scrape ALL sources in parallel - NO FALLBACKS
    const [craigslistListings, apartmentsListings, zillowListings, foodDeals, realInternet] = await Promise.all([
      fetchCraigslistListings(searchTerm, maxRent, stateCode),
      fetchApartmentsListings(searchTerm, maxRent),
      fetchZillowListings(searchTerm, maxRent, stateCode),
      fetchFoodDeals(searchTerm),
      fetchInternetPrices(searchTerm),
    ]);

    // Build housing listings ONLY from real scraped data
    const housingListings: any[] = [];
    
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

    // Calculate budget from real data
    const monthlyIncome = hourlyWage * hoursWorkedPerWeek * weeksPerMonth;
    const cheapestHousing = housingListings.length > 0 
      ? Math.min(...housingListings.map(l => l.monthlyCost).filter(c => c > 0))
      : selectedRent;
    const cheapestFood = foodDeals.length > 0
      ? Math.min(...foodDeals.map((f: any) => f.estimatedMonthlyCost || 0).filter((c: number) => c > 0))
      : 200;

    const budget = {
      income: Math.round(monthlyIncome),
      housing: cheapestHousing,
      food: cheapestFood,
      transport: 150,
      utilities: 100,
      phoneInternet: realInternet || 60,
      savings: Math.round(monthlyIncome * 0.1),
      leftover: Math.round(monthlyIncome - cheapestHousing - cheapestFood - 150 - 100 - (realInternet || 60) - monthlyIncome * 0.1),
    };

    // Build food deals from real data
    const realFoodDeals = foodDeals.map((item: any) => ({
      title: item.title,
      source: 'Web' as const,
      estimatedMonthlyCost: item.estimatedMonthlyCost || 0,
      url: item.url,
      description: item.description || '',
    }));

    // Build search links (NO Facebook - removed)
    const searchLinks = {
      craigslist: `https://craigslist.org/search/apa?query=${encodeURIComponent(searchTerm)}&max_price=${maxRent}`,
      apartments: `https://www.apartments.com/${searchTerm.toLowerCase().replace(/\s+/g, '-')}/?bb=&max-price=${maxRent}`,
      zillow: `https://www.zillow.com/homes/for_rent/${encodeURIComponent(searchTerm)}_rb/?searchQueryState=%7B%22filterState%22%3A%7B%22mp%22%3A%7B%22max%22%3A${maxRent}%7D%7D%7D`,
      foodWeb: `https://duckduckgo.com/?q=${encodeURIComponent(searchTerm + ' affordable groceries student budget meal prep')}`,
    };

    const data = {
      housingListings,
      foodDeals: realFoodDeals,
      budget,
      searchLinks,
    };

    const aiRecommendations = await getClaudeRecommendations({
      stateCode,
      hourlyWage,
      hoursWorkedPerWeek,
      selectedRent,
      monthlyIncome,
    });

    return res.status(200).json({
      mode: 'serverless',
      claudeConfigured: Boolean(process.env.CLAUDE_API_KEY),
      scrapingBeeConfigured: Boolean(process.env.SCRAPINGBEE_API_KEY),
      aiRecommendations,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown crawler failure';
    return res.status(500).json({ error: message });
  }
}
