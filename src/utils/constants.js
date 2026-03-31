export const PORTAL_ID = '47270154';

export const DEAL_STAGE_MAP = {
  '1041142961': { name: 'Demo Scheduled', probability: 0.20 },
  '1041142962': { name: 'SQL', probability: 0.35 },
  '1041142963': { name: 'Validation', probability: 0.60 },
  '1041142964': { name: 'Negotiation', probability: 0.75 },
  '1041142965': { name: 'Contracting', probability: 0.90 },
  'closedwon': { name: 'Closed Won', probability: 1.00 },
  'closedlost': { name: 'Closed Lost', probability: 0.00 },
};

export const DEAL_STAGE_ORDER = [
  '1041142961', '1041142962', '1041142963', '1041142964', '1041142965',
];

export const NORCAL_CITIES = [
  'San Francisco', 'Oakland', 'Berkeley', 'San Jose', 'Fremont', 'Hayward',
  'Concord', 'Walnut Creek', 'Pleasanton', 'Livermore', 'Richmond', 'Santa Rosa',
  'Petaluma', 'Napa', 'Vallejo', 'Fairfield', 'Vacaville', 'Stockton', 'Modesto',
  'Fresno', 'Clovis', 'Redding', 'Chico', 'Sacramento', 'Elk Grove', 'Roseville',
  'Rocklin', 'Auburn', 'Santa Cruz', 'Gilroy', 'Morgan Hill', 'Santa Clara',
  'Sunnyvale', 'Mountain View', 'Palo Alto', 'San Mateo', 'Redwood City',
  'Milpitas', 'Newark', 'Antioch', 'San Ramon', 'Danville', 'Martinez',
  'San Rafael', 'Rohnert Park', 'Lodi', 'Tracy', 'Manteca', 'Turlock',
];

export const EXCLUDED_DOMAINS = ['freschiserviceexperts', 'canyonstateserviceexperts', 'tmlservice'];

// US Planning Regions (Census Bureau divisions)
export const US_REGIONS = [
  { name: 'Northeast', states: ['CT','ME','MA','NH','NJ','NY','PA','RI','VT'] },
  { name: 'Southeast', states: ['AL','AR','DE','FL','GA','KY','LA','MD','MS','NC','SC','TN','VA','WV','DC'] },
  { name: 'Midwest', states: ['IL','IN','IA','KS','MI','MN','MO','NE','ND','OH','SD','WI'] },
  { name: 'Southwest', states: ['AZ','NM','OK','TX'] },
  { name: 'West', states: ['AK','CA','CO','HI','ID','MT','NV','OR','UT','WA','WY'] },
];

export const TIER_A_KEYWORDS = [
  // Core trades
  'plumbing', 'plumber', 'hvac', 'heating', 'cooling', 'air conditioning',
  'electrical', 'electric', 'mechanical', 'rooter', 'drain', 'sewer',
  'repipe', 'furnace', 'boiler', 'pipe', 'piping',
  // Air/AC variations
  'air', 'a/c', 'ac ', ' ac', 'conditioning', 'comfort',
  // Home services
  'home service', 'home improvement', 'handyman', 'contractor',
  'garage door', 'water heater', 'tankless', 'septic',
  'insulation', 'duct', 'ventilation', 'refriger',
  // Roofing/exterior
  'roofing', 'roofer', 'roof ', 'gutter', 'siding', 'solar',
  'window', 'door ', 'doors',
  // General service company signals
  'service', 'services', 'repair', 'maintenance', 'installation',
  'pro ', 'pros', 'solutions', 'specialists', 'expert',
  'home pro', 'home team',
];

export const TIER_A_NAMES = [
  // Major brands / franchise names
  'one hour', 'benjamin franklin', 'atlas home pro', 'advanced plumbing',
  'dutton', 'pacific aire', 'we care plumbing', 'service genius', 'adeedo',
  'nexgen', 'mauzy', 'howard air', 'penguin air', 'four seasons',
  'swan plumbing', 'curoso', 'allen service', 'anderson plumbing', 'wighton',
  'strongbuilt', 'fix-it 24/7', 'rite way', 'a.b. may', 'a-abel',
  'mr. rooter', 'roto-rooter', 'rescue air', 'baker brothers',
  'bonney', 'bell brothers', 'goettl', 'day & night',
  'tiger', 'radiant', 'bardi', 'john c. flood', 'horizon',
  'michael & son', 'parker & sons', 'chas roberts',
  'any hour', 'abc home', 'jack nelson', 'coolray',
  'ideal service', 'hiller', 'peterman', 'len the plumber',
  'sam nugent', 'hero plumbing', 'schneller', 'john henry',
  'trust 1', 'uptown', 'aztec', 'pioneer', 'champion',
  // Common franchise patterns
  '1-tom-plumber', '1 tom plumber', '1-800-plumber',
];

// CRM systems that auto-qualify as Tier A (core home services platforms)
export const TIER_A_CRMS = [
  'ServiceTitan',
];

// CRM systems that qualify as at least Tier B (home/field services platforms)
export const TIER_B_CRMS = [
  'Housecall Pro', 'Jobber', 'Payzer', 'Workiz', 'CompanyCam',
  'FieldRoutes', 'PestPac', 'GorillaDesk', 'AccuLynx', 'Job Nimbus',
  'FieldEdge',
];

export const TIER_B_KEYWORDS = [
  'pest', 'exterminator', 'termite', 'landscap', 'lawn', 'tree service',
  'window clean', 'pressure wash', 'junk', 'restoration', 'carpet clean', 'mold',
  'cleaning', 'chimney', 'fireplace', 'pool', 'sprinkler', 'irrigation',
  'foundation', 'concrete', 'paving', 'fencing', 'painting', 'flooring',
  'remodel', 'renovation', 'construction', 'general contractor',
  'appliance', 'locksmith',
];

export const VALID_STATES = ['CA', 'AZ', 'CO', 'WY', 'MT'];

export const DEFAULT_WEIGHTS = {
  tierA: 50,
  tierB: 30,
  emp100plus: 30,
  emp50to99: 20,
  emp20to49: 12,
  emp10to19: 6,
  icpTier1: 15,
  icpTier2: 7,
  openDeal: 25,
  childLocations: 10,
  stalePenalty: -10,
};

// Dynamic — populated from HubSpot owners API at runtime
// Fallback for known IDs
export let OWNER_MAP = {
  '88733834': 'Parker Witte',
  '87243635': 'US Planning',
};

export function setOwnerMap(owners) {
  const map = {};
  owners.forEach(o => {
    const name = [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || `Owner ${o.id}`;
    map[o.id] = name;
  });
  OWNER_MAP = { ...map, ...OWNER_MAP };
  // Override with API data where available
  owners.forEach(o => {
    const name = [o.firstName, o.lastName].filter(Boolean).join(' ');
    if (name) OWNER_MAP[o.id] = name;
  });
}

export function hubspotCompanyUrl(companyId) {
  return `https://app.hubspot.com/contacts/${PORTAL_ID}/record/0-2/${companyId}`;
}

export function hubspotDealUrl(dealId) {
  return `https://app.hubspot.com/contacts/${PORTAL_ID}/record/0-3/${dealId}`;
}
