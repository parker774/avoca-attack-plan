/**
 * State Normalizer
 *
 * Resolves a company's US state from multiple messy HubSpot fields into a
 * single, consistent 2-letter abbreviation (e.g. "CA").
 *
 * Priority waterfall:
 *   1. states_dropdown  — ChiliPiper form, full state names (most reliable)
 *   2. state            — free-text, could be "CA", "California", "Ca", etc.
 *   3. hs_state_code    — HubSpot auto-detected (sometimes wrong for franchises)
 *   4. city             — last resort, infer from known city→state mapping
 */

// ── Full name → 2-letter code ──────────────────────────────────────────────
const STATE_NAME_TO_ABBREV = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'district of columbia': 'DC', 'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI',
  'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME',
  'maryland': 'MD', 'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN',
  'mississippi': 'MS', 'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE',
  'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX',
  'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA',
  'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
};

// Valid 2-letter codes (for fast validation)
const VALID_ABBREVS = new Set(Object.values(STATE_NAME_TO_ABBREV));

// ── City → State mapping (major US cities for fallback) ────────────────────
// This catches the common case where state is blank but city is populated.
const CITY_TO_STATE = {
  // California
  'los angeles': 'CA', 'san francisco': 'CA', 'san diego': 'CA', 'san jose': 'CA',
  'sacramento': 'CA', 'fresno': 'CA', 'oakland': 'CA', 'long beach': 'CA',
  'bakersfield': 'CA', 'anaheim': 'CA', 'santa ana': 'CA', 'riverside': 'CA',
  'stockton': 'CA', 'irvine': 'CA', 'chula vista': 'CA', 'fremont': 'CA',
  'san bernardino': 'CA', 'modesto': 'CA', 'moreno valley': 'CA', 'fontana': 'CA',
  'glendale': 'CA', 'huntington beach': 'CA', 'santa clarita': 'CA', 'garden grove': 'CA',
  'oceanside': 'CA', 'rancho cucamonga': 'CA', 'ontario': 'CA', 'santa rosa': 'CA',
  'elk grove': 'CA', 'corona': 'CA', 'lancaster': 'CA', 'palmdale': 'CA',
  'salinas': 'CA', 'pomona': 'CA', 'hayward': 'CA', 'escondido': 'CA',
  'sunnyvale': 'CA', 'torrance': 'CA', 'pasadena': 'CA', 'orange': 'CA',
  'fullerton': 'CA', 'thousand oaks': 'CA', 'roseville': 'CA', 'concord': 'CA',
  'simi valley': 'CA', 'santa clara': 'CA', 'victorville': 'CA', 'vallejo': 'CA',
  'berkeley': 'CA', 'el monte': 'CA', 'downey': 'CA', 'costa mesa': 'CA',
  'inglewood': 'CA', 'carlsbad': 'CA', 'san buenaventura': 'CA', 'ventura': 'CA',
  'fairfield': 'CA', 'west covina': 'CA', 'murrieta': 'CA', 'richmond': 'CA',
  'norwalk': 'CA', 'antioch': 'CA', 'temecula': 'CA', 'burbank': 'CA',
  'daly city': 'CA', 'rialto': 'CA', 'el cajon': 'CA', 'san mateo': 'CA',
  'clovis': 'CA', 'compton': 'CA', 'jurupa valley': 'CA', 'vista': 'CA',
  'south gate': 'CA', 'mission viejo': 'CA', 'vacaville': 'CA', 'carson': 'CA',
  'hesperia': 'CA', 'santa maria': 'CA', 'redding': 'CA', 'westminster': 'CA',
  'santa monica': 'CA', 'chico': 'CA', 'newport beach': 'CA', 'san leandro': 'CA',
  'san marcos': 'CA', 'whittier': 'CA', 'hawthorne': 'CA', 'citrus heights': 'CA',
  'alhambra': 'CA', 'tracy': 'CA', 'livermore': 'CA', 'buena park': 'CA',
  'menifee': 'CA', 'hemet': 'CA', 'lakewood': 'CA', 'merced': 'CA',
  'chino': 'CA', 'indio': 'CA', 'redwood city': 'CA', 'lake forest': 'CA',
  'napa': 'CA', 'tustin': 'CA', 'bellflower': 'CA', 'mountain view': 'CA',
  'chino hills': 'CA', 'baldwin park': 'CA', 'alameda': 'CA', 'upland': 'CA',
  'san ramon': 'CA', 'folsom': 'CA', 'pleasanton': 'CA', 'lynwood': 'CA',
  'union city': 'CA', 'apple valley': 'CA', 'redlands': 'CA', 'turlock': 'CA',
  'perris': 'CA', 'manteca': 'CA', 'milpitas': 'CA', 'lodi': 'CA',
  'san rafael': 'CA', 'petaluma': 'CA', 'rocklin': 'CA', 'palo alto': 'CA',
  'walnut creek': 'CA', 'gilroy': 'CA', 'morgan hill': 'CA', 'santa cruz': 'CA',
  'danville': 'CA', 'martinez': 'CA', 'rohnert park': 'CA', 'auburn': 'CA',
  'carmichael': 'CA', 'newark': 'CA',
  // Texas
  'houston': 'TX', 'san antonio': 'TX', 'dallas': 'TX', 'austin': 'TX',
  'fort worth': 'TX', 'el paso': 'TX', 'arlington': 'TX', 'corpus christi': 'TX',
  'plano': 'TX', 'laredo': 'TX', 'lubbock': 'TX', 'garland': 'TX',
  'irving': 'TX', 'amarillo': 'TX', 'grand prairie': 'TX', 'brownsville': 'TX',
  'mckinney': 'TX', 'frisco': 'TX', 'pasadena': 'TX', 'mesquite': 'TX',
  'killeen': 'TX', 'mcallen': 'TX', 'midland': 'TX', 'waco': 'TX',
  'denton': 'TX', 'round rock': 'TX', 'lewisville': 'TX', 'tyler': 'TX',
  'college station': 'TX', 'beaumont': 'TX', 'abilene': 'TX', 'allen': 'TX',
  'league city': 'TX', 'sugar land': 'TX', 'edinburg': 'TX', 'mission': 'TX',
  'san angelo': 'TX', 'temple': 'TX', 'flower mound': 'TX', 'new braunfels': 'TX',
  'conroe': 'TX', 'cedar park': 'TX', 'pflugerville': 'TX',
  // Arizona
  'phoenix': 'AZ', 'tucson': 'AZ', 'mesa': 'AZ', 'chandler': 'AZ',
  'scottsdale': 'AZ', 'glendale': 'AZ', 'gilbert': 'AZ', 'tempe': 'AZ',
  'peoria': 'AZ', 'surprise': 'AZ', 'yuma': 'AZ', 'avondale': 'AZ',
  'goodyear': 'AZ', 'flagstaff': 'AZ', 'buckeye': 'AZ', 'lake havasu city': 'AZ',
  'casa grande': 'AZ', 'maricopa': 'AZ', 'sierra vista': 'AZ', 'prescott': 'AZ',
  'bullhead city': 'AZ', 'apache junction': 'AZ', 'queen creek': 'AZ',
  // Florida
  'jacksonville': 'FL', 'miami': 'FL', 'tampa': 'FL', 'orlando': 'FL',
  'st. petersburg': 'FL', 'saint petersburg': 'FL', 'hialeah': 'FL',
  'tallahassee': 'FL', 'fort lauderdale': 'FL', 'port st. lucie': 'FL',
  'cape coral': 'FL', 'pembroke pines': 'FL', 'hollywood': 'FL',
  'gainesville': 'FL', 'miramar': 'FL', 'coral springs': 'FL',
  'clearwater': 'FL', 'palm bay': 'FL', 'lakeland': 'FL', 'pompano beach': 'FL',
  'west palm beach': 'FL', 'davie': 'FL', 'boca raton': 'FL', 'naples': 'FL',
  'sarasota': 'FL', 'pensacola': 'FL', 'ocala': 'FL', 'fort myers': 'FL',
  'daytona beach': 'FL', 'kissimmee': 'FL', 'bradenton': 'FL',
  // New York
  'new york': 'NY', 'new york city': 'NY', 'manhattan': 'NY', 'brooklyn': 'NY',
  'queens': 'NY', 'bronx': 'NY', 'staten island': 'NY', 'buffalo': 'NY',
  'rochester': 'NY', 'yonkers': 'NY', 'syracuse': 'NY', 'albany': 'NY',
  'new rochelle': 'NY', 'mount vernon': 'NY', 'schenectady': 'NY',
  'utica': 'NY', 'binghamton': 'NY', 'white plains': 'NY',
  // Illinois
  'chicago': 'IL', 'aurora': 'IL', 'naperville': 'IL', 'joliet': 'IL',
  'rockford': 'IL', 'springfield': 'IL', 'elgin': 'IL', 'peoria': 'IL',
  'champaign': 'IL', 'waukegan': 'IL', 'cicero': 'IL', 'bloomington': 'IL',
  'evanston': 'IL', 'schaumburg': 'IL', 'decatur': 'IL',
  // Georgia
  'atlanta': 'GA', 'augusta': 'GA', 'columbus': 'GA', 'savannah': 'GA',
  'athens': 'GA', 'sandy springs': 'GA', 'roswell': 'GA', 'macon': 'GA',
  'johns creek': 'GA', 'alpharetta': 'GA', 'marietta': 'GA', 'valdosta': 'GA',
  'smyrna': 'GA', 'dunwoody': 'GA', 'kennesaw': 'GA',
  // Colorado
  'denver': 'CO', 'colorado springs': 'CO', 'aurora': 'CO', 'fort collins': 'CO',
  'lakewood': 'CO', 'thornton': 'CO', 'arvada': 'CO', 'westminster': 'CO',
  'pueblo': 'CO', 'centennial': 'CO', 'boulder': 'CO', 'greeley': 'CO',
  'longmont': 'CO', 'loveland': 'CO', 'grand junction': 'CO', 'broomfield': 'CO',
  // North Carolina
  'charlotte': 'NC', 'raleigh': 'NC', 'greensboro': 'NC', 'durham': 'NC',
  'winston-salem': 'NC', 'fayetteville': 'NC', 'cary': 'NC', 'wilmington': 'NC',
  'high point': 'NC', 'concord': 'NC', 'greenville': 'NC', 'asheville': 'NC',
  'gastonia': 'NC', 'jacksonville': 'NC', 'chapel hill': 'NC',
  // Ohio
  'columbus': 'OH', 'cleveland': 'OH', 'cincinnati': 'OH', 'toledo': 'OH',
  'akron': 'OH', 'dayton': 'OH', 'parma': 'OH', 'canton': 'OH',
  'youngstown': 'OH', 'lorain': 'OH', 'hamilton': 'OH', 'springfield': 'OH',
  // Pennsylvania
  'philadelphia': 'PA', 'pittsburgh': 'PA', 'allentown': 'PA', 'erie': 'PA',
  'reading': 'PA', 'scranton': 'PA', 'bethlehem': 'PA', 'lancaster': 'PA',
  'harrisburg': 'PA', 'york': 'PA', 'wilkes-barre': 'PA',
  // Michigan
  'detroit': 'MI', 'grand rapids': 'MI', 'warren': 'MI', 'sterling heights': 'MI',
  'ann arbor': 'MI', 'lansing': 'MI', 'flint': 'MI', 'dearborn': 'MI',
  'livonia': 'MI', 'troy': 'MI', 'westland': 'MI', 'kalamazoo': 'MI',
  'michigan city': 'IN', // Note: Michigan City is in Indiana!
  // Virginia
  'virginia beach': 'VA', 'norfolk': 'VA', 'chesapeake': 'VA', 'richmond': 'VA',
  'newport news': 'VA', 'alexandria': 'VA', 'hampton': 'VA', 'roanoke': 'VA',
  'portsmouth': 'VA', 'lynchburg': 'VA', 'charlottesville': 'VA',
  // Tennessee
  'nashville': 'TN', 'memphis': 'TN', 'knoxville': 'TN', 'chattanooga': 'TN',
  'clarksville': 'TN', 'murfreesboro': 'TN', 'franklin': 'TN', 'gallatin': 'TN',
  // Washington
  'seattle': 'WA', 'spokane': 'WA', 'tacoma': 'WA', 'vancouver': 'WA',
  'bellevue': 'WA', 'kent': 'WA', 'everett': 'WA', 'renton': 'WA',
  'spokane valley': 'WA', 'federal way': 'WA', 'yakima': 'WA', 'bellingham': 'WA',
  'kirkland': 'WA', 'redmond': 'WA', 'olympia': 'WA',
  // Indiana
  'indianapolis': 'IN', 'fort wayne': 'IN', 'evansville': 'IN', 'south bend': 'IN',
  'carmel': 'IN', 'fishers': 'IN', 'bloomington': 'IN', 'hammond': 'IN',
  'gary': 'IN', 'lafayette': 'IN', 'muncie': 'IN', 'terre haute': 'IN',
  // Massachusetts
  'boston': 'MA', 'worcester': 'MA', 'springfield': 'MA', 'cambridge': 'MA',
  'lowell': 'MA', 'brockton': 'MA', 'new bedford': 'MA', 'quincy': 'MA',
  'lynn': 'MA', 'fall river': 'MA', 'newton': 'MA', 'somerville': 'MA',
  // New Jersey
  'newark': 'NJ', 'jersey city': 'NJ', 'paterson': 'NJ', 'elizabeth': 'NJ',
  'trenton': 'NJ', 'clifton': 'NJ', 'camden': 'NJ', 'passaic': 'NJ',
  'union city': 'NJ', 'east orange': 'NJ', 'phillipsburg': 'NJ',
  // Connecticut
  'bridgeport': 'CT', 'new haven': 'CT', 'stamford': 'CT', 'hartford': 'CT',
  'waterbury': 'CT', 'norwalk': 'CT', 'danbury': 'CT', 'new britain': 'CT',
  'bristol': 'CT', 'meriden': 'CT', 'stonington': 'CT',
  // Minnesota
  'minneapolis': 'MN', 'saint paul': 'MN', 'st. paul': 'MN', 'rochester': 'MN',
  'duluth': 'MN', 'bloomington': 'MN', 'brooklyn park': 'MN', 'plymouth': 'MN',
  'maple grove': 'MN', 'woodbury': 'MN', 'eagan': 'MN', 'eden prairie': 'MN',
  // Maryland
  'baltimore': 'MD', 'frederick': 'MD', 'rockville': 'MD', 'gaithersburg': 'MD',
  'bowie': 'MD', 'hagerstown': 'MD', 'annapolis': 'MD', 'college park': 'MD',
  // Missouri
  'kansas city': 'MO', 'st. louis': 'MO', 'saint louis': 'MO', 'springfield': 'MO',
  'columbia': 'MO', 'independence': 'MO', "lee's summit": 'MO', "o'fallon": 'MO',
  // Nevada
  'las vegas': 'NV', 'henderson': 'NV', 'reno': 'NV', 'north las vegas': 'NV',
  'sparks': 'NV', 'carson city': 'NV',
  // Oregon
  'portland': 'OR', 'salem': 'OR', 'eugene': 'OR', 'gresham': 'OR',
  'hillsboro': 'OR', 'beaverton': 'OR', 'bend': 'OR', 'medford': 'OR',
  'corvallis': 'OR', 'springfield': 'OR',
  // South Carolina
  'charleston': 'SC', 'columbia': 'SC', 'north charleston': 'SC',
  'mount pleasant': 'SC', 'rock hill': 'SC', 'greenville': 'SC',
  'summerville': 'SC', 'goose creek': 'SC', 'hilton head': 'SC',
  // Alabama
  'birmingham': 'AL', 'montgomery': 'AL', 'huntsville': 'AL', 'mobile': 'AL',
  'tuscaloosa': 'AL', 'hoover': 'AL', 'dothan': 'AL', 'auburn': 'AL',
  // Louisiana
  'new orleans': 'LA', 'baton rouge': 'LA', 'shreveport': 'LA', 'metairie': 'LA',
  'lafayette': 'LA', 'lake charles': 'LA', 'kenner': 'LA', 'bossier city': 'LA',
  // Utah
  'salt lake city': 'UT', 'west valley city': 'UT', 'provo': 'UT', 'west jordan': 'UT',
  'orem': 'UT', 'sandy': 'UT', 'ogden': 'UT', 'st. george': 'UT',
  'saint george': 'UT', 'layton': 'UT', 'lehi': 'UT',
  // Kentucky
  'louisville': 'KY', 'lexington': 'KY', 'bowling green': 'KY', 'owensboro': 'KY',
  'covington': 'KY', 'frankfort': 'KY',
  // Oklahoma
  'oklahoma city': 'OK', 'tulsa': 'OK', 'norman': 'OK', 'broken arrow': 'OK',
  'edmond': 'OK', 'lawton': 'OK', 'moore': 'OK',
  // Wisconsin
  'milwaukee': 'WI', 'madison': 'WI', 'green bay': 'WI', 'kenosha': 'WI',
  'racine': 'WI', 'appleton': 'WI', 'waukesha': 'WI', 'oshkosh': 'WI',
  // Iowa
  'des moines': 'IA', 'cedar rapids': 'IA', 'davenport': 'IA', 'sioux city': 'IA',
  'iowa city': 'IA', 'waterloo': 'IA', 'council bluffs': 'IA',
  // Kansas
  'wichita': 'KS', 'overland park': 'KS', 'kansas city': 'KS', 'olathe': 'KS',
  'topeka': 'KS', 'lawrence': 'KS',
  // New Mexico
  'albuquerque': 'NM', 'las cruces': 'NM', 'rio rancho': 'NM', 'santa fe': 'NM',
  'roswell': 'NM', 'farmington': 'NM',
  // Mississippi
  'jackson': 'MS', 'gulfport': 'MS', 'southaven': 'MS', 'biloxi': 'MS',
  'hattiesburg': 'MS', 'tupelo': 'MS',
  // Nebraska
  'omaha': 'NE', 'lincoln': 'NE', 'bellevue': 'NE', 'grand island': 'NE',
  // Arkansas
  'little rock': 'AR', 'fort smith': 'AR', 'fayetteville': 'AR',
  'springdale': 'AR', 'jonesboro': 'AR', 'north little rock': 'AR',
  // Idaho
  'boise': 'ID', 'meridian': 'ID', 'nampa': 'ID', 'idaho falls': 'ID',
  'pocatello': 'ID', 'caldwell': 'ID', 'coeur d\'alene': 'ID', 'twin falls': 'ID',
  // Montana
  'billings': 'MT', 'missoula': 'MT', 'great falls': 'MT', 'bozeman': 'MT',
  'butte': 'MT', 'helena': 'MT', 'kalispell': 'MT',
  // Wyoming
  'cheyenne': 'WY', 'casper': 'WY', 'laramie': 'WY', 'gillette': 'WY',
  'rock springs': 'WY', 'sheridan': 'WY', 'jackson': 'WY',
  // Other small states
  'wilmington': 'DE', 'dover': 'DE', // Delaware
  'honolulu': 'HI', 'pearl city': 'HI', // Hawaii
  'anchorage': 'AK', 'fairbanks': 'AK', 'juneau': 'AK', // Alaska
  'burlington': 'VT', 'south burlington': 'VT', // Vermont
  'portland': 'ME', 'lewiston': 'ME', 'bangor': 'ME', // Maine
  'manchester': 'NH', 'nashua': 'NH', 'concord': 'NH', // New Hampshire
  'providence': 'RI', 'warwick': 'RI', 'cranston': 'RI', // Rhode Island
  'sioux falls': 'SD', 'rapid city': 'SD', // South Dakota
  'fargo': 'ND', 'bismarck': 'ND', 'grand forks': 'ND', // North Dakota
  'washington': 'DC', 'washington dc': 'DC', 'washington d.c.': 'DC',
};


/**
 * Attempt to parse a raw value into a valid 2-letter state code.
 * Handles: "CA", "Ca", "california", "CALIFORNIA", etc.
 */
function parseStateValue(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Check if it's already a valid 2-letter abbreviation
  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && VALID_ABBREVS.has(upper)) {
    return upper;
  }

  // Try full name lookup
  const lower = trimmed.toLowerCase();
  if (STATE_NAME_TO_ABBREV[lower]) {
    return STATE_NAME_TO_ABBREV[lower];
  }

  return null;
}

/**
 * Resolve state for a company using the priority waterfall.
 * Returns { code: 'CA', source: 'states_dropdown' } or { code: null, source: null }
 */
export function resolveState(company) {
  const props = company.properties || company;

  // 1. states_dropdown (most reliable — standardized ChiliPiper form)
  const fromDropdown = parseStateValue(props.states_dropdown);
  if (fromDropdown) return { code: fromDropdown, source: 'states_dropdown' };

  // 2. state field (free-text, could be name or abbreviation)
  const fromState = parseStateValue(props.state);
  if (fromState) return { code: fromState, source: 'state' };

  // 3. hs_state_code (auto-detected, can be wrong for franchises)
  const fromHsCode = parseStateValue(props.hs_state_code);
  if (fromHsCode) return { code: fromHsCode, source: 'hs_state_code' };

  // 4. Infer from city (last resort)
  const city = (props.city || '').trim().toLowerCase();
  if (city && CITY_TO_STATE[city]) {
    return { code: CITY_TO_STATE[city], source: 'city_inferred' };
  }

  return { code: null, source: null };
}

/**
 * Convenience: just returns the 2-letter code or null.
 */
export function normalizeState(company) {
  return resolveState(company).code;
}

// Re-export for use in constants/filtering
export { VALID_ABBREVS, STATE_NAME_TO_ABBREV };
