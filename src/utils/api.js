const BASE = '';

async function fetchJson(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function fetchCompanies(refresh = false) {
  return fetchJson(`/api/companies${refresh ? '?refresh=true' : ''}`);
}

export async function fetchDeals(refresh = false) {
  return fetchJson(`/api/deals${refresh ? '?refresh=true' : ''}`);
}

export async function fetchCalls(refresh = false) {
  return fetchJson(`/api/calls${refresh ? '?refresh=true' : ''}`);
}

export async function fetchDealCalls(dealId) {
  return fetchJson(`/api/calls/${dealId}`);
}

export async function fetchCallDetail(callId) {
  return fetchJson(`/api/call/${callId}`);
}

export async function generateBrief(company, calls, deal) {
  return fetchJson('/api/brief', {
    method: 'POST',
    body: JSON.stringify({ company, calls, deal }),
  });
}

export async function generateReengageEmail(company, lastCallDaysAgo, objection, nextStep) {
  return fetchJson('/api/reengage', {
    method: 'POST',
    body: JSON.stringify({ company, lastCallDaysAgo, objection, nextStep }),
  });
}

export async function fetchOwners() {
  return fetchJson('/api/owners');
}

export async function refreshAll() {
  return fetchJson('/api/refresh');
}

/**
 * Pull all historical calls from Attention API via SSE.
 * @param {function} onProgress - called with { status, loaded, total, page, pageCount }
 * @returns {Promise<number>} total calls loaded
 */
export function pullCalls(onProgress) {
  return new Promise((resolve, reject) => {
    const evtSource = new EventSource('/api/calls/pull');
    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onProgress) onProgress(data);
        if (data.status === 'done') {
          evtSource.close();
          resolve(data.total);
        } else if (data.status === 'error') {
          evtSource.close();
          reject(new Error(data.message));
        }
      } catch (err) {
        evtSource.close();
        reject(err);
      }
    };
    evtSource.onerror = () => {
      evtSource.close();
      reject(new Error('Connection to call pull stream lost'));
    };
  });
}
