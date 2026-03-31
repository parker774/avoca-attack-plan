import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const app = express();
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '5mb' }));

const PORT = process.env.PORT || 3001;
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const ATTENTION_API_KEY = process.env.ATTENTION_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

let anthropic = null;
try {
  if (ANTHROPIC_API_KEY && ANTHROPIC_API_KEY !== 'your_key_here') {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
} catch (e) {
  console.warn('Anthropic SDK not available:', e.message);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CALLS_DATA_PATH = join(__dirname, '..', 'data', 'calls.json');

let cache = { companies: null, deals: null, calls: null, owners: null, lastRefresh: null };
let callsFetchPromise = null;

async function hubspotSearch(objectType, body) {
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/' + objectType + '/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + HUBSPOT_TOKEN },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const text = await res.text(); throw new Error('HubSpot search failed: ' + res.status + ' ' + text); }
  return res.json();
}

async function fetchAllCompanies() {
  const properties = ['name','domain','phone','city','state','zip','numberofemployees','industry','hs_lead_status','lifecyclestage','hubspot_owner_id','hs_parent_company_id','notes_last_updated','hs_ideal_customer_profile','hs_num_child_companies','annualrevenue','num_associated_deals','hs_num_open_deals','crm_dropdown','states_dropdown','hs_state_code','territory_region','address'];
  let all = [], after, hasMore = true;
  while (hasMore) {
    const url = new URL('https://api.hubapi.com/crm/v3/objects/companies');
    url.searchParams.set('limit', '100');
    url.searchParams.set('properties', properties.join(','));
    if (after) url.searchParams.set('after', after);
    const res = await fetch(url.toString(), { headers: { Authorization: 'Bearer ' + HUBSPOT_TOKEN } });
    if (!res.ok) { const t = await res.text(); throw new Error('Companies failed: ' + res.status + ' ' + t); }
    const data = await res.json();
    all = all.concat(data.results || []);
    after = data.paging?.next?.after;
    if (!after) hasMore = false;
  }
  return all;
}

async function fetchAllDeals() {
  const properties = ['dealname','dealstage','amount','closedate','createdate','hs_deal_stage_probability','hs_lastmodifieddate','hs_mrr','hs_acv','hubspot_owner_id','hs_v2_date_entered_1041142962'];
  let all = [], after, hasMore = true;
  while (hasMore) {
    const url = new URL('https://api.hubapi.com/crm/v3/objects/deals');
    url.searchParams.set('limit', '100');
    url.searchParams.set('properties', properties.join(','));
    url.searchParams.set('associations', 'companies');
    if (after) url.searchParams.set('after', after);
    const res = await fetch(url.toString(), { headers: { Authorization: 'Bearer ' + HUBSPOT_TOKEN } });
    if (!res.ok) { const t = await res.text(); throw new Error('Deals failed: ' + res.status + ' ' + t); }
    const data = await res.json();
    all = all.concat(data.results || []);
    after = data.paging?.next?.after;
    if (!after) hasMore = false;
  }
  return all;
}

const ATTENTION_CONFIGURED = ATTENTION_API_KEY && ATTENTION_API_KEY !== 'your_key_here';

async function attentionFetch(path, params) {
  if (!ATTENTION_CONFIGURED) throw new Error('Attention API key not configured.');
  const url = new URL('https://api.attention.tech' + path);
  if (params) Object.entries(params).forEach(function(e) { if (e[1] != null) url.searchParams.set(e[0], e[1]); });
  const res = await fetch(url.toString(), { headers: { Authorization: 'Bearer ' + ATTENTION_API_KEY } });
  if (!res.ok) { const t = await res.text(); throw new Error('Attention failed: ' + res.status + ' ' + t); }
  return res.json();
}

function loadCachedCalls() {
  try {
    if (existsSync(CALLS_DATA_PATH)) {
      const data = JSON.parse(readFileSync(CALLS_DATA_PATH, 'utf8'));
      return data;
    }
  } catch (err) { /* ignore */ }
  return [];
}

app.use(express.static(join(__dirname, '..', 'dist')));

app.get('/api/companies', async function(req, res) {
  try {
    if (req.query.refresh === 'true' || !cache.companies) { cache.companies = await fetchAllCompanies(); cache.lastRefresh = new Date().toISOString(); }
    res.json({ companies: cache.companies, lastRefresh: cache.lastRefresh });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/deals', async function(req, res) {
  try {
    if (req.query.refresh === 'true' || !cache.deals) { cache.deals = await fetchAllDeals(); cache.lastRefresh = new Date().toISOString(); }
    res.json({ deals: cache.deals, lastRefresh: cache.lastRefresh });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const TEAM_EMAILS = new Set(['parker@avoca.ai','corbin@avoca.ai','brian@avoca.ai']);

function slimCall(raw) {
  const a = raw.attributes || raw;
  const id = raw.id || a.uuid;
  return { id: id, title: a.title || null, date: a.createdAt || a.date || null, created_at: a.createdAt || null, score: (a.scorecardResults && a.scorecardResults[0] && a.scorecardResults[0].score) || a.score || null, summary: a.summary || null, objection: a.objection || a.main_objection || null, nextStep: a.nextStep || null, actionItems: a.action_items || a.actionItems || null, deal_ids: (a.linkedCrmRecords || []).filter(function(r) { return r.code === 'companies'; }).map(function(r) { return r.id; }), dealUUID: a.dealUUID || null, externalOpportunity: a.externalOpportunity || null, userUUID: a.userUUID || null, userEmail: (a.user && a.user.email) || null, attendees: a.attendees || [], participants: a.participants || [] };
}

function lightCall(c) {
  return { id: c.id, title: c.title, date: c.date, created_at: c.created_at, score: c.score, summary: c.summary, objection: c.objection, nextStep: c.nextStep, actionItems: c.actionItems, deal_ids: c.deal_ids, dealUUID: c.dealUUID, userUUID: c.userUUID, userEmail: c.userEmail };
}

app.get('/api/calls', async function(req, res) {
  try {
    if (!cache.calls) cache.calls = loadCachedCalls();
    var teamCalls = cache.calls.filter(function(c) { return c.userEmail && TEAM_EMAILS.has(c.userEmail.toLowerCase()); }).map(lightCall);
    res.json({ calls: teamCalls });
  } catch (err) { res.json({ calls: [] }); }
});

app.get('/api/calls/pull', async function(req, res) {
  if (!ATTENTION_CONFIGURED) return res.status(503).json({ error: 'Attention API key not configured.' });
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  var send = function(data) { res.write('data: ' + JSON.stringify(data) + '\n\n'); };
  try {
    if (callsFetchPromise) {
      send({ status: 'progress', message: 'Fetch already in progress' });
      cache.calls = await callsFetchPromise;
      callsFetchPromise = null;
      send({ status: 'done', total: cache.calls.length });
      return res.end();
    }
    callsFetchPromise = (async function() {
      var allCalls = [], page = 1, totalRecords = 0;
      var ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      while (true) {
        var data = await attentionFetch('/v2/conversations', { page: page, size: 50, fromDateTime: ninetyDaysAgo.toISOString(), toDateTime: new Date().toISOString() });
        var calls = data.data || [];
        var teamCalls = calls.map(slimCall).filter(function(c) { return c.userEmail && TEAM_EMAILS.has(c.userEmail.toLowerCase()); });
        allCalls = allCalls.concat(teamCalls);
        totalRecords = (data.meta && data.meta.totalRecords) || totalRecords;
        var pageCount = (data.meta && data.meta.pageCount) || 1;
        if (page % 25 === 0 || page === 1) send({ status: 'progress', loaded: allCalls.length, total: totalRecords, page: page, pageCount: pageCount });
        if (page >= pageCount || calls.length < 50) break;
        page++;
      }
      try { var fs2 = await import('fs'); fs2.writeFileSync(CALLS_DATA_PATH, JSON.stringify(allCalls)); } catch (e) { /* ignore */ }
      return allCalls;
    })();
    cache.calls = await callsFetchPromise;
    callsFetchPromise = null;
    send({ status: 'done', total: cache.calls.length });
  } catch (err) { callsFetchPromise = null; send({ status: 'error', message: err.message }); }
  res.end();
});

app.get('/api/calls/:dealId', async function(req, res) {
  try {
    if (!ATTENTION_CONFIGURED) {
      var cached = loadCachedCalls();
      var filtered = cached.filter(function(c) { return (c.deal_ids || []).includes(req.params.dealId); });
      return res.json({ calls: filtered });
    }
    var data = await attentionFetch('/v2/conversations', { page: 1, size: 50 });
    var calls = (data.data || []).filter(function(c) { var ids = (c.externalIdentifiers && c.externalIdentifiers.dealIds) || c.deal_ids || []; return ids.includes(req.params.dealId); });
    res.json({ calls: calls });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/call/:callId', async function(req, res) {
  try { var data = await attentionFetch('/v2/conversations/' + req.params.callId); res.json(data); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/brief', async function(req, res) {
  try {
    var body = req.body;
    var callSummaries = (body.calls || []).map(function(c, i) { return 'Call ' + (i+1) + ' (' + (c.date || 'unknown') + '): Score ' + (c.score || 'N/A') + '. Summary: ' + (c.summary || 'None') + '. Objections: ' + (c.objection || 'None') + '. Next steps: ' + (c.nextStep || 'None'); }).join('\n');
    var dealInfo = body.deal ? 'Active deal: ' + body.deal.dealname + ' at ' + body.deal.stageName + ' stage' : 'No active deal.';
    var prompt = 'Company: ' + body.company.name + '\n' + dealInfo + '\n\nCall History:\n' + (callSummaries || 'No recorded calls.') + '\n\nGenerate a pre-call brief with sections: Company Snapshot, Call History Summary, Key Objections, Outstanding Action Items, Recommended Talk Track, 3 Questions to Ask';
    if (!anthropic) return res.status(503).json({ error: 'Anthropic API key not configured.' });
    var msg = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, system: 'You are an elite sales coach for Avoca AI. Generate a sharp pre-call brief.', messages: [{ role: 'user', content: prompt }] });
    res.json({ brief: (msg.content[0] && msg.content[0].text) || 'Failed.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reengage', async function(req, res) {
  try {
    var body = req.body;
    var prompt = 'Write a short re-engagement email for Parker Witte at Avoca AI to send to ' + body.company + '. Last call was ' + body.lastCallDaysAgo + ' days ago. Main objection: ' + (body.objection || 'not recorded') + '. Next step: ' + (body.nextStep || 'not recorded') + '. Keep under 100 words.';
    if (!anthropic) return res.status(503).json({ error: 'Anthropic API key not configured.' });
    var msg = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 500, system: 'Write a warm re-engagement email. No corporate jargon.', messages: [{ role: 'user', content: prompt }] });
    res.json({ email: (msg.content[0] && msg.content[0].text) || 'Failed.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/ask-calls', async function(req, res) {
  try {
    if (!ATTENTION_CONFIGURED) return res.status(503).json({ error: 'Attention API key not configured.' });
    var data = await attentionFetch('/v2/conversations', { page: 1, size: 20 });
    res.json({ calls: data.data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/owners', async function(req, res) {
  try {
    if (cache.owners && !req.query.refresh) return res.json({ owners: cache.owners });
    var all = [], after, hasMore = true;
    while (hasMore) {
      var url = new URL('https://api.hubapi.com/crm/v3/owners');
      url.searchParams.set('limit', '100');
      if (after) url.searchParams.set('after', after);
      var r = await fetch(url.toString(), { headers: { Authorization: 'Bearer ' + HUBSPOT_TOKEN } });
      if (!r.ok) throw new Error('Owners failed: ' + r.status);
      var data = await r.json();
      all = all.concat(data.results || []);
      after = data.paging && data.paging.next && data.paging.next.after;
      if (!after) hasMore = false;
    }
    cache.owners = all;
    res.json({ owners: all });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/refresh', async function(req, res) {
  try {
    var results = await Promise.all([fetchAllCompanies(), fetchAllDeals()]);
    cache.companies = results[0];
    cache.deals = results[1];
    cache.calls = null;
    cache.lastRefresh = new Date().toISOString();
    res.json({ success: true, lastRefresh: cache.lastRefresh });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/{*path}', function(req, res) {, function(req, res) {
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, function() { console.log('Server running on port ' + PORT); });
