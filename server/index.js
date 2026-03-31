import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

import compression from 'compression';

const app = express();
app.use(cors());
app.use(compression()); // gzip all responses
app.use(express.json({ limit: '5mb' }));

const PORT = process.env.PORT || 3001;
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const ATTENTION_API_KEY = process.env.ATTENTION_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const anthropic = ANTHROPIC_API_KEY && ANTHROPIC_API_KEY !== 'your_key_here'
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null;

// ── In-memory cache ──
let cache = {
  companies: null,
  deals: null,
  calls: null,
  owners: null,
  lastRefresh: null,
};

// Fetch lock — prevents duplicate long-running fetches when multiple
// requests hit the server while calls are still loading
let callsFetchPromise = null;

// ── HubSpot helpers ──
async function hubspotSearch(objectType, body) {
  const res = await fetch(`https://api.hubapi.com/crm/v3/objects/${objectType}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot ${objectType} search failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function fetchAllCompanies() {
  const properties = [
    'name', 'domain', 'phone', 'city', 'state', 'zip', 'numberofemployees',
    'industry', 'hs_lead_status', 'lifecyclestage', 'hubspot_owner_id',
    'hs_parent_company_id', 'notes_last_updated', 'hs_ideal_customer_profile',
    'hs_num_child_companies', 'annualrevenue', 'num_associated_deals',
    'hs_num_open_deals', 'crm_dropdown',
    // Additional location fields for robust state resolution
    'states_dropdown', 'hs_state_code', 'territory_region', 'address',
  ];

  let allCompanies = [];
  let after = undefined;
  let hasMore = true;

  while (hasMore) {
    const url = new URL('https://api.hubapi.com/crm/v3/objects/companies');
    url.searchParams.set('limit', '100');
    url.searchParams.set('properties', properties.join(','));
    if (after) url.searchParams.set('after', after);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HubSpot companies list failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    allCompanies = allCompanies.concat(data.results || []);
    if (data.paging?.next?.after) {
      after = data.paging.next.after;
    } else {
      hasMore = false;
    }
    console.log(`  Companies fetched so far: ${allCompanies.length}`);
  }

  return allCompanies;
}

async function fetchAllDeals() {
  const properties = [
    'dealname', 'dealstage', 'amount', 'closedate', 'createdate',
    'hs_deal_stage_probability', 'hs_lastmodifieddate', 'hs_mrr', 'hs_acv',
    'hubspot_owner_id',
    // Stage history — used to determine if a deal ever reached SQL for close rate calc
    'hs_v2_date_entered_1041142962',
  ];

  let allDeals = [];
  let after = undefined;
  let hasMore = true;

  while (hasMore) {
    const url = new URL('https://api.hubapi.com/crm/v3/objects/deals');
    url.searchParams.set('limit', '100');
    url.searchParams.set('properties', properties.join(','));
    url.searchParams.set('associations', 'companies');
    if (after) url.searchParams.set('after', after);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HubSpot deals list failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    allDeals = allDeals.concat(data.results || []);
    if (data.paging?.next?.after) {
      after = data.paging.next.after;
    } else {
      hasMore = false;
    }
    console.log(`  Deals fetched so far: ${allDeals.length}`);
  }

  return allDeals;
}

// ── Attention helpers ──
const ATTENTION_CONFIGURED = ATTENTION_API_KEY && ATTENTION_API_KEY !== 'your_key_here';

async function attentionFetch(path, params = {}) {
  if (!ATTENTION_CONFIGURED) {
    throw new Error('Attention API key not configured. Add your key to .env');
  }
  const url = new URL(`https://api.attention.tech${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${ATTENTION_API_KEY}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Attention API failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Load cached calls from data file if available
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CALLS_DATA_PATH = join(__dirname, '..', 'data', 'calls.json');

function loadCachedCalls() {
  try {
    if (existsSync(CALLS_DATA_PATH)) {
      const data = JSON.parse(readFileSync(CALLS_DATA_PATH, 'utf8'));
      console.log(`  Loaded ${data.length} cached calls from data/calls.json`);
      return data;
    }
  } catch (err) {
    console.warn('Could not load cached calls:', err.message);
  }
  return [];
}

// ── Serve frontend build ──
app.use(express.static(join(__dirname, '..', 'dist')));

// ── Routes ──

// GET /api/companies
app.get('/api/companies', async (req, res) => {
  try {
    if (req.query.refresh === 'true' || !cache.companies) {
      cache.companies = await fetchAllCompanies();
      cache.lastRefresh = new Date().toISOString();
    }
    res.json({ companies: cache.companies, lastRefresh: cache.lastRefresh });
  } catch (err) {
    console.error('Error fetching companies:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/deals
app.get('/api/deals', async (req, res) => {
  try {
    if (req.query.refresh === 'true' || !cache.deals) {
      cache.deals = await fetchAllDeals();
      cache.lastRefresh = new Date().toISOString();
    }
    res.json({ deals: cache.deals, lastRefresh: cache.lastRefresh });
  } catch (err) {
    console.error('Error fetching deals:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Team email whitelist — only keep calls from these reps ──
const TEAM_EMAILS = new Set([
  'parker@avoca.ai',
  'corbin@avoca.ai',
  'brian@avoca.ai',
]);

// Slim a raw Attention call object down to only the fields the frontend uses.
function slimCall(raw) {
  const a = raw.attributes || raw;
  const id = raw.id || a.uuid;
  return {
    id,
    title: a.title || null,
    date: a.createdAt || a.date || null,
    created_at: a.createdAt || null,
    score: a.scorecardResults?.[0]?.score ?? a.score ?? null,
    summary: a.summary || null,
    objection: a.objection || a.main_objection || null,
    nextStep: a.nextStep || null,
    actionItems: a.action_items || a.actionItems || null,
    deal_ids: (a.linkedCrmRecords || [])
      .filter(r => r.code === 'companies')
      .map(r => r.id),
    dealUUID: a.dealUUID || null,
    externalOpportunity: a.externalOpportunity || null,
    userUUID: a.userUUID || null,
    userEmail: a.user?.email || null,
    attendees: a.attendees || [],
    participants: a.participants || [],
  };
}

// Core fetch function for all Attention calls (shared via lock)
async function fetchAllCalls() {
  let allCalls = [];
  let page = 1;
  const MAX_PAGES = 700;
  let totalRecords = '?';

  console.log('  📞 Fetching all historical calls from Attention API...');
  while (page <= MAX_PAGES) {
    const data = await attentionFetch('/v2/conversations', {
      page,
      size: 50,
    });
    const calls = data.data || [];
    allCalls = allCalls.concat(calls.map(slimCall));
    totalRecords = data.meta?.totalRecords || totalRecords;
    const pageCount = data.meta?.pageCount || 1;

    if (page % 50 === 0 || page === 1) {
      console.log(`  Attention API page ${page}/${pageCount}: ${allCalls.length}/${totalRecords} calls`);
    }

    if (page >= pageCount || calls.length < 50) break;
    page++;
  }

  console.log(`  ✅ Loaded ${allCalls.length} calls from Attention API (all history)`);

  // Persist to disk so next cold start is instant
  try {
    const { writeFileSync } = await import('fs');
    writeFileSync(CALLS_DATA_PATH, JSON.stringify(allCalls));
    console.log(`  💾 Saved ${allCalls.length} calls to data/calls.json`);
  } catch (writeErr) {
    console.warn('  Could not persist calls cache:', writeErr.message);
  }

  return allCalls;
}

// Lighten call objects for the browser (strip fields only used for pull/storage)
function lightCall(c) {
  return {
    id: c.id,
    title: c.title,
    date: c.date,
    created_at: c.created_at,
    score: c.score,
    summary: c.summary,
    objection: c.objection,
    nextStep: c.nextStep,
    actionItems: c.actionItems,
    deal_ids: c.deal_ids,
    dealUUID: c.dealUUID,
    userUUID: c.userUUID,
    userEmail: c.userEmail,
    // Drop: participants, attendees, externalOpportunity (saves ~70% payload)
  };
}

// GET /api/calls — returns cached calls only (from memory or disk).
// Filtered to team members only. Use /api/calls/pull to refresh from Attention.
app.get('/api/calls', async (req, res) => {
  try {
    if (!cache.calls) {
      cache.calls = loadCachedCalls();
    }
    // Filter to team + lighten for browser
    const teamCalls = cache.calls
      .filter(c => c.userEmail && TEAM_EMAILS.has(c.userEmail.toLowerCase()))
      .map(lightCall);
    res.json({ calls: teamCalls });
  } catch (err) {
    console.error('Error fetching calls:', err.message);
    res.json({ calls: [] });
  }
});

// POST /api/calls/pull — on-demand full pull from Attention API.
// Streams progress via SSE so the frontend can show a progress bar.
app.get('/api/calls/pull', async (req, res) => {
  if (!ATTENTION_CONFIGURED) {
    return res.status(503).json({ error: 'Attention API key not configured.' });
  }

  // SSE headers for streaming progress
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    // If already in progress, attach to existing fetch
    if (callsFetchPromise) {
      send({ status: 'progress', message: 'Fetch already in progress, waiting...' });
      cache.calls = await callsFetchPromise;
      callsFetchPromise = null;
      send({ status: 'done', total: cache.calls.length });
      return res.end();
    }

    // Start fresh fetch — last 90 days, filter to team only
    callsFetchPromise = (async () => {
      let allCalls = [];
      let page = 1;
      let totalRecords = 0;

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      while (true) {
        const data = await attentionFetch('/v2/conversations', {
          page,
          size: 50,
          fromDateTime: ninetyDaysAgo.toISOString(),
          toDateTime: new Date().toISOString(),
        });
        const calls = data.data || [];
        const teamCalls = calls
          .map(slimCall)
          .filter(c => c.userEmail && TEAM_EMAILS.has(c.userEmail.toLowerCase()));
        allCalls = allCalls.concat(teamCalls);
        totalRecords = data.meta?.totalRecords || totalRecords;
        const pageCount = data.meta?.pageCount || 1;

        // Stream progress every 25 pages
        if (page % 25 === 0 || page === 1) {
          send({ status: 'progress', loaded: allCalls.length, total: totalRecords, page, pageCount });
        }

        if (page >= pageCount || calls.length < 50) break;
        page++;
      }

      // Persist to disk
      try {
        const { writeFileSync } = await import('fs');
        writeFileSync(CALLS_DATA_PATH, JSON.stringify(allCalls));
        console.log(`  💾 Saved ${allCalls.length} calls to data/calls.json`);
      } catch (writeErr) {
        console.warn('  Could not persist calls cache:', writeErr.message);
      }

      return allCalls;
    })();

    cache.calls = await callsFetchPromise;
    callsFetchPromise = null;
    send({ status: 'done', total: cache.calls.length });
    console.log(`  ✅ Pull complete: ${cache.calls.length} calls`);
  } catch (err) {
    callsFetchPromise = null;
    send({ status: 'error', message: err.message });
    console.error('Error pulling calls:', err.message);
  }
  res.end();
});

// GET /api/calls/:dealId — Attention calls linked to a deal
app.get('/api/calls/:dealId', async (req, res) => {
  try {
    if (!ATTENTION_CONFIGURED) {
      // Fall back to cached calls filtered by dealId
      const cached = loadCachedCalls();
      const filtered = cached.filter(c => (c.deal_ids || []).includes(req.params.dealId));
      return res.json({ calls: filtered });
    }
    const data = await attentionFetch('/v2/conversations', {
      page: 1,
      size: 50,
    });
    // Filter by deal association from response
    const calls = (data.data || []).filter(c => {
      const dealIds = c.externalIdentifiers?.dealIds || c.deal_ids || [];
      return dealIds.includes(req.params.dealId);
    });
    res.json({ calls });
  } catch (err) {
    console.error('Error fetching deal calls:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/call/:callId — full call details
app.get('/api/call/:callId', async (req, res) => {
  try {
    const data = await attentionFetch(`/v2/conversations/${req.params.callId}`);
    res.json(data);
  } catch (err) {
    console.error('Error fetching call detail:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/brief — generate pre-call brief
app.post('/api/brief', async (req, res) => {
  try {
    const { company, calls, deal } = req.body;
    const callSummaries = (calls || []).map((c, i) =>
      `Call ${i + 1} (${c.date || 'unknown date'}): Score ${c.score || 'N/A'}/100. ` +
      `Summary: ${c.summary || 'No summary'}. Objections: ${c.objection || 'None'}. ` +
      `Next steps: ${c.nextStep || 'None'}. Action items: ${c.actionItems || 'None'}.`
    ).join('\n');

    const dealInfo = deal
      ? `Active deal: "${deal.dealname}" at ${deal.stageName} stage, amount $${deal.amount || 'not set'}, close date ${deal.closedate || 'not set'}.`
      : 'No active deal.';

    const prompt = `Company: ${company.name}
Industry: ${company.industry || 'Unknown'}
Employees: ${company.numberofemployees || 'Unknown'}
City: ${company.city || ''}, ${company.state || ''}
Lead Status: ${company.hs_lead_status || 'Unknown'}
Lifecycle: ${company.lifecyclestage || 'Unknown'}
ICP: ${company.hs_ideal_customer_profile || 'Unknown'}
Revenue: ${company.annualrevenue || 'Unknown'}
${dealInfo}

Call History:
${callSummaries || 'No recorded calls.'}

Generate a pre-call brief with these sections:
🏢 Company Snapshot
📞 Call History Summary
⚠️ Key Objections Raised
✅ Outstanding Action Items (what Parker owes them)
🎯 Recommended Talk Track for This Call
💬 3 Specific Questions to Ask`;

    if (!anthropic) {
      return res.status(503).json({ error: 'Anthropic API key not configured. Add your ANTHROPIC_API_KEY to .env' });
    }

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: 'You are an elite sales coach for Avoca AI, an AI-powered call answering platform for home services companies. Generate a sharp, actionable pre-call brief. Be concise and specific. Use the call history and company data to make recommendations highly relevant.',
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0]?.text || 'Failed to generate brief.';
    res.json({ brief: text });
  } catch (err) {
    console.error('Error generating brief:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reengage — generate re-engagement email
app.post('/api/reengage', async (req, res) => {
  try {
    const { company, lastCallDaysAgo, objection, nextStep } = req.body;

    const prompt = `Write a short, human, non-salesy re-engagement email for Parker Witte at Avoca AI to send to ${company}. Last call was ${lastCallDaysAgo} days ago. Main objection was "${objection || 'not recorded'}". Agreed next step was "${nextStep || 'not recorded'}". Keep it under 100 words. Sound like a real person not a robot. Reference something specific from the last conversation.`;

    if (!anthropic) {
      return res.status(503).json({ error: 'Anthropic API key not configured. Add your ANTHROPIC_API_KEY to .env' });
    }

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: 'You are writing a re-engagement email for a B2B SaaS sales rep. Be warm, brief, and reference specifics from prior conversations. No corporate jargon.',
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0]?.text || 'Failed to generate email.';
    res.json({ email: text });
  } catch (err) {
    console.error('Error generating re-engagement email:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ask-calls — ask Attention AI about calls
app.post('/api/ask-calls', async (req, res) => {
  try {
    const { dealId, prompt } = req.body;
    if (!ATTENTION_CONFIGURED) {
      return res.status(503).json({ error: 'Attention API key not configured.' });
    }
    // v2 may not have an ask endpoint — return structured call data instead
    const data = await attentionFetch('/v2/conversations', {
      page: 1,
      size: 20,
    });
    res.json({ calls: data.data || [] });
  } catch (err) {
    console.error('Error asking about calls:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/owners — fetch all HubSpot owners
app.get('/api/owners', async (req, res) => {
  try {
    if (cache.owners && !req.query.refresh) {
      return res.json({ owners: cache.owners });
    }
    let allOwners = [];
    let after = undefined;
    let hasMore = true;
    while (hasMore) {
      const url = new URL('https://api.hubapi.com/crm/v3/owners');
      url.searchParams.set('limit', '100');
      if (after) url.searchParams.set('after', after);
      const r = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
      });
      if (!r.ok) throw new Error(`HubSpot owners failed: ${r.status}`);
      const data = await r.json();
      allOwners = allOwners.concat(data.results || []);
      if (data.paging?.next?.after) {
        after = data.paging.next.after;
      } else {
        hasMore = false;
      }
    }
    cache.owners = allOwners;
    res.json({ owners: allOwners });
  } catch (err) {
    console.error('Error fetching owners:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/refresh — invalidate cache and refetch
app.get('/api/refresh', async (req, res) => {
  try {
    const [companies, deals] = await Promise.all([
      fetchAllCompanies(),
      fetchAllDeals(),
    ]);
    cache.companies = companies;
    cache.deals = deals;
    cache.calls = null; // will lazy-load
    cache.lastRefresh = new Date().toISOString();
    res.json({ success: true, lastRefresh: cache.lastRefresh });
  } catch (err) {
    console.error('Error refreshing:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Catch-all: serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Avoca Attack Plan API running on port ${PORT}`);
});
