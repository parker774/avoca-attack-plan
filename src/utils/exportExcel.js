import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { hubspotCompanyUrl, hubspotDealUrl, DEAL_STAGE_MAP, OWNER_MAP } from './constants.js';

function companyRow(c, rank) {
  return {
    Rank: rank,
    Score: c.score,
    Stars: c.tier === 'A' ? '⭐⭐⭐' : c.tier === 'B' ? '⭐⭐' : '⭐',
    Company: c.name || '',
    Tier: c.tier,
    CRM: c.lifecyclestage || '',
    'ICP Tier': c.icp?.tier ? `Tier ${c.icp.tier}` : '',
    Owner: OWNER_MAP[c.hubspot_owner_id] || c.hubspot_owner_id || '',
    City: c.city || '',
    State: c.state || '',
    Phone: c.phone || '',
    Employees: c.numberofemployees || '',
    Revenue: c.annualrevenue || '',
    Industry: c.industry || '',
    'Lead Status': c.hs_lead_status || '',
    Lifecycle: c.lifecyclestage || '',
    'Days Since Touch': c.daysSinceTouch ?? 'Never',
    'PE Flag': c.hasPE ? 'Yes' : '',
    'Child Locations': c.childCount || 0,
    'HubSpot Link': hubspotCompanyUrl(c.id),
    Notes: '',
  };
}

function dealRow(d) {
  const stage = DEAL_STAGE_MAP[d.dealstage] || {};
  return {
    'Deal Name': d.dealname || '',
    Stage: stage.name || d.dealstage || '',
    Amount: d.amount || '',
    'Close Date': d.closedate || '',
    'Days in Stage': '',
    Probability: stage.probability != null ? `${(stage.probability * 100).toFixed(0)}%` : '',
    'Last Call Score': '',
    'Last Call Date': '',
    'Main Objection': '',
    'Next Step': '',
    'HubSpot Link': hubspotDealUrl(d.id),
  };
}

export function exportToExcel(companies, deals) {
  const wb = XLSX.utils.book_new();

  // Master tab
  const masterData = companies.map((c, i) => companyRow(c, i + 1));
  const masterWs = XLSX.utils.json_to_sheet(masterData);
  XLSX.utils.book_append_sheet(wb, masterWs, '📋 Master');

  // Per-owner tabs
  const owners = {};
  companies.forEach(c => {
    const name = OWNER_MAP[c.hubspot_owner_id] || c.hubspot_owner_id || 'Unknown';
    if (!owners[name]) owners[name] = [];
    owners[name].push(c);
  });
  Object.entries(owners).forEach(([name, list]) => {
    const data = list.map((c, i) => companyRow(c, i + 1));
    const ws = XLSX.utils.json_to_sheet(data);
    const sheetName = name.substring(0, 28);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  // State tabs
  const stateEmojis = { CA: '🌴', AZ: '☀️', CO: '⛰️', WY: '🦬', MT: '🏔️' };
  ['CA', 'AZ', 'CO', 'WY', 'MT'].forEach(st => {
    const filtered = companies.filter(c => (c.state || '').toUpperCase() === st);
    if (filtered.length) {
      const data = filtered.map((c, i) => companyRow(c, i + 1));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, `${stateEmojis[st]} ${st}`);
    }
  });

  // Tier A
  const tierA = companies.filter(c => c.tier === 'A');
  if (tierA.length) {
    const ws = XLSX.utils.json_to_sheet(tierA.map((c, i) => companyRow(c, i + 1)));
    XLSX.utils.book_append_sheet(wb, ws, '⭐ Tier A');
  }

  // PE & Holding
  const pe = companies.filter(c => c.hasPE);
  if (pe.length) {
    const ws = XLSX.utils.json_to_sheet(pe.map((c, i) => companyRow(c, i + 1)));
    XLSX.utils.book_append_sheet(wb, ws, '🏢 PE & Holding');
  }

  // Upsell
  const upsell = companies.filter(c => c.isCustomer).sort((a, b) => (b.daysSinceTouch ?? 9999) - (a.daysSinceTouch ?? 9999));
  if (upsell.length) {
    const ws = XLSX.utils.json_to_sheet(upsell.map((c, i) => companyRow(c, i + 1)));
    XLSX.utils.book_append_sheet(wb, ws, '💰 Upsell');
  }

  // Cold
  const cold = companies.filter(c => (c.tier === 'A' || c.tier === 'B') && (c.daysSinceTouch === null || c.daysSinceTouch >= 90) && !c.hasOpenDeal);
  if (cold.length) {
    const ws = XLSX.utils.json_to_sheet(cold.map((c, i) => companyRow(c, i + 1)));
    XLSX.utils.book_append_sheet(wb, ws, '🧊 Cold');
  }

  // Multi-Location
  const multi = companies.filter(c => c.childCount > 0).sort((a, b) => b.childCount - a.childCount);
  if (multi.length) {
    const ws = XLSX.utils.json_to_sheet(multi.map((c, i) => companyRow(c, i + 1)));
    XLSX.utils.book_append_sheet(wb, ws, '🏗️ Multi-Location');
  }

  // Open Deals
  if (deals.length) {
    const openDeals = deals.filter(d => d.properties?.dealstage !== 'closedwon' && d.properties?.dealstage !== 'closedlost');
    const ws = XLSX.utils.json_to_sheet(openDeals.map(d => dealRow(d.properties || d)));
    XLSX.utils.book_append_sheet(wb, ws, '💼 Open Deals');
  }

  // Legend
  const legendData = [
    { Item: 'Tier A', Description: 'ServiceTitan verticals (plumbing, HVAC, electrical, etc.)' },
    { Item: 'Tier B', Description: 'HouseCall Pro verticals (pest, landscaping, etc.)' },
    { Item: 'Tier C', Description: 'Other home services' },
    { Item: 'ICP Tier 1', Description: 'Ideal Customer Profile - top tier' },
    { Item: 'ICP Tier 2', Description: 'Ideal Customer Profile - second tier' },
    { Item: 'PE Flag', Description: 'Company has a parent company (Private Equity / Holding)' },
    { Item: 'Staleness Green', Description: 'Contacted within 60 days' },
    { Item: 'Staleness Amber', Description: '60-119 days since last contact' },
    { Item: 'Staleness Red', Description: '120+ days since last contact' },
  ];
  const legendWs = XLSX.utils.json_to_sheet(legendData);
  XLSX.utils.book_append_sheet(wb, legendWs, '⚙️ Legend');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  saveAs(blob, `Avoca_Attack_Plan_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
