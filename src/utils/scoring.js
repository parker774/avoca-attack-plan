import {
  TIER_A_KEYWORDS, TIER_A_NAMES, TIER_B_KEYWORDS,
  TIER_A_CRMS, TIER_B_CRMS,
  NORCAL_CITIES, EXCLUDED_DOMAINS, VALID_STATES,
} from './constants.js';
import { resolveState } from './stateNormalizer.js';

export function detectTier(company) {
  const name = (company.name || '').toLowerCase();
  const industry = (company.industry || '').toLowerCase();
  const crm = (company.crm_dropdown || '').trim();
  const combined = `${name} ${industry}`;

  // CRM-based tier: ServiceTitan = auto Tier A, supersedes everything
  if (TIER_A_CRMS.includes(crm)) return 'A';

  // Keyword-based Tier A
  for (const kw of TIER_A_KEYWORDS) {
    if (combined.includes(kw)) return 'A';
  }
  for (const n of TIER_A_NAMES) {
    if (name.includes(n)) return 'A';
  }

  // CRM-based Tier B (Housecall Pro, Jobber, FieldRoutes, PestPac, etc.)
  if (TIER_B_CRMS.includes(crm)) return 'B';

  // Keyword-based Tier B
  for (const kw of TIER_B_KEYWORDS) {
    if (combined.includes(kw)) return 'B';
  }

  return 'C';
}

export function isInTerritory(company) {
  const name = (company.name || '').toLowerCase();
  const domain = (company.domain || '').toLowerCase();

  // Exclude specific companies
  for (const excl of EXCLUDED_DOMAINS) {
    if (name.includes(excl) || domain.includes(excl)) return false;
  }

  // Include all companies (all 50 states)
  return true;
}

export function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

export function stalenessInfo(daysSinceTouch) {
  if (daysSinceTouch === null) return { label: 'Never', color: '#8b949e', emoji: '⬛' };
  if (daysSinceTouch < 60) return { label: `${daysSinceTouch}d`, color: '#3fb950', emoji: '✅' };
  if (daysSinceTouch < 120) return { label: `${daysSinceTouch}d`, color: '#d29922', emoji: '⚠️' };
  return { label: `${daysSinceTouch}d`, color: '#f85149', emoji: '🔥' };
}

export function icpBadge(icp) {
  if (!icp) return { label: '—', tier: null, color: '#8b949e' };
  const lower = icp.toLowerCase();
  if (lower === 'tier_1') return { label: '★', tier: 1, color: '#d29922' };
  if (lower === 'tier_2') return { label: '★', tier: 2, color: '#8b949e' };
  return { label: '★', tier: 3, color: '#484f58' };
}

export function scoreCompany(company, weights, dealsMap) {
  let score = 0;
  const tier = detectTier(company);

  if (tier === 'A') score += weights.tierA;
  else if (tier === 'B') score += weights.tierB;

  const emp = parseInt(company.numberofemployees || '0', 10);
  if (emp >= 100) score += weights.emp100plus;
  else if (emp >= 50) score += weights.emp50to99;
  else if (emp >= 20) score += weights.emp20to49;
  else if (emp >= 10) score += weights.emp10to19;

  const icp = (company.hs_ideal_customer_profile || '').toLowerCase();
  if (icp === 'tier_1') score += weights.icpTier1;
  else if (icp === 'tier_2') score += weights.icpTier2;

  const hasOpenDeal = parseInt(company.hs_num_open_deals || '0', 10) > 0
    || (dealsMap && dealsMap[company.id]);
  if (hasOpenDeal) score += weights.openDeal;

  const childCount = parseInt(company.hs_num_child_companies || '0', 10);
  if (childCount > 0) score += weights.childLocations;

  const days = daysSince(company.notes_last_updated);
  if (days !== null && days >= 120) score += weights.stalePenalty;

  return Math.max(0, Math.min(100, score));
}

export function enrichCompany(company, weights, dealsMap) {
  const props = company.properties || company;
  const tier = detectTier(props);
  const daysSinceTouch = daysSince(props.notes_last_updated);
  const staleness = stalenessInfo(daysSinceTouch);
  const icp = icpBadge(props.hs_ideal_customer_profile);
  const score = scoreCompany(props, weights, dealsMap);
  const childCount = parseInt(props.hs_num_child_companies || '0', 10);
  const hasPE = !!props.hs_parent_company_id;
  const hasOpenDeal = parseInt(props.hs_num_open_deals || '0', 10) > 0;
  const isCustomer = (props.lifecyclestage || '').toLowerCase() === 'customer';

  // Resolve state from multiple HubSpot fields (waterfall)
  const stateResolution = resolveState(props);

  return {
    id: company.id,
    ...props,
    tier,
    score,
    daysSinceTouch,
    staleness,
    icp,
    childCount,
    hasPE,
    hasOpenDeal,
    isCustomer,
    inTerritory: isInTerritory(props),
    // Normalized state — single source of truth for filtering & display
    normalizedState: stateResolution.code,
    stateSource: stateResolution.source,
  };
}
