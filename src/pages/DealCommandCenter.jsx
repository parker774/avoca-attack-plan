import { useState, useMemo } from 'react';
import { ExternalLink, FileText, Mail, X, Filter, TrendingUp, TrendingDown } from 'lucide-react';
import { DEAL_STAGE_MAP, DEAL_STAGE_ORDER, OWNER_MAP, hubspotDealUrl } from '../utils/constants.js';
import BriefModal from '../components/BriefModal.jsx';
import ReengageModal from '../components/ReengageModal.jsx';

const MONTHLY_QUOTA_PER_REP = 150000; // $150K per rep per month

function formatCurrency(n) {
  if (!n && n !== 0) return '—';
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatCompact(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return '$' + (n / 1000).toFixed(0) + 'K';
  return '$' + n.toFixed(0);
}

function DealDetailPanel({ deal, onClose, onBrief, onReengage }) {
  return (
    <>
      <div className="side-panel-overlay" onClick={onClose} />
      <div className="side-panel">
        <div className="side-panel-header">
          <div>
            <div className="side-panel-title">{deal.dealname || 'Untitled Deal'}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
              {deal.stageName} · {deal.probability ? `${(deal.probability * 100).toFixed(0)}%` : '—'} probability
            </div>
          </div>
          <button className="side-panel-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="deal-detail-section">
          <h3>Deal Info</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Amount</div>
              <div style={{ fontSize: 18, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: deal.amount ? 'var(--text)' : 'var(--red)' }}>
                {deal.amount ? formatCurrency(deal.amount) : 'NOT SET'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Close Date</div>
              <div style={{ fontSize: 18, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: (deal.daysToClose !== null && deal.daysToClose < 14) ? 'var(--red)' : 'var(--text)' }}>
                {deal.closedate ? new Date(deal.closedate).toLocaleDateString() : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Days Since Created</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>{deal.daysSinceCreate ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Days in Stage</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>{deal.daysInStage ?? '—'}</div>
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <a href={hubspotDealUrl(deal.id)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              <ExternalLink size={14} /> HubSpot Deal
            </a>
          </div>
        </div>
        <div className="deal-detail-section">
          <h3>Call Intelligence</h3>
          <div className="no-data" style={{ padding: 20 }}>
            <div className="no-data-icon">📞</div>
            <div>No recorded calls for this deal</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Log calls in Attention to see intelligence here</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => onBrief(deal)}><FileText size={14} /> Generate Pre-Call Brief</button>
          <button className="btn btn-ghost" onClick={() => onReengage(deal)}><Mail size={14} /> Re-Engagement Email</button>
        </div>
      </div>
    </>
  );
}

export default function DealCommandCenter({ openDeals, closedLostDeals, deals, rawCalls, pipelineStats, loading, addToast, owners, selectedRepIds }) {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [briefDeal, setBriefDeal] = useState(null);
  const [reengageDeal, setReengageDeal] = useState(null);
  const [ownerFilter, setOwnerFilter] = useState('all');

  const filteredOpenDeals = useMemo(() => {
    if (ownerFilter === 'all') return openDeals;
    return openDeals.filter(d => d.hubspot_owner_id === ownerFilter);
  }, [openDeals, ownerFilter]);

  const filteredClosedLost = useMemo(() => {
    if (ownerFilter === 'all') return closedLostDeals;
    return closedLostDeals.filter(d => d.hubspot_owner_id === ownerFilter);
  }, [closedLostDeals, ownerFilter]);

  // Owner options — only show selected reps
  const ownerOptions = useMemo(() => {
    const repSet = new Set(selectedRepIds || []);
    const ids = new Set();
    [...openDeals, ...closedLostDeals].forEach(d => {
      if (d.hubspot_owner_id && (repSet.size === 0 || repSet.has(d.hubspot_owner_id))) {
        ids.add(d.hubspot_owner_id);
      }
    });
    return Array.from(ids)
      .map(id => ({ id, name: OWNER_MAP[id] || `Owner ${id}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [openDeals, closedLostDeals, selectedRepIds]);

  // ── Manager Metrics ──
  const ms = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(now.getDate() - 90);

    const allDeals = deals || [];
    const activeRepCount = ownerFilter === 'all' ? (ownerOptions.length || 1) : 1;
    const teamQuota = MONTHLY_QUOTA_PER_REP * activeRepCount;

    const scopedDeals = ownerFilter === 'all' ? allDeals : allDeals.filter(d => d.hubspot_owner_id === ownerFilter);

    // Closed Won MTD
    const closedWonMTD = scopedDeals
      .filter(d => d.dealstage === 'closedwon' && d.closedate && new Date(d.closedate) >= monthStart)
      .reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);

    // Pacing
    const proRatedQuota = teamQuota * (dayOfMonth / daysInMonth);
    const pacingPct = proRatedQuota > 0 ? Math.round((closedWonMTD / proRatedQuota) * 100) : 0;

    // Pipeline created this month
    const pipeCreatedDeals = filteredOpenDeals.filter(d => d.createdate && new Date(d.createdate) >= monthStart);
    const pipelineCreatedMTD = pipeCreatedDeals.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
    const dealsCreatedMTD = pipeCreatedDeals.length;

    // Open & Weighted
    const openPipeline = filteredOpenDeals.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
    const weightedPipeline = filteredOpenDeals.reduce((s, d) => s + (parseFloat(d.amount) || 0) * (d.probability || 0), 0);

    // At risk
    const atRiskDeals = filteredOpenDeals.filter(d => {
      const noAmt = !d.amount || parseFloat(d.amount) === 0;
      const closeSoon = d.daysToClose !== null && d.daysToClose < 14;
      const stuck = d.daysInStage !== null && d.daysInStage > 30;
      return (closeSoon && noAmt) || stuck;
    });

    // Close rate (90d, qualified)
    const closedRecently = scopedDeals.filter(d => {
      if (!d.closedate || new Date(d.closedate) < ninetyDaysAgo) return false;
      if (d.dealstage === 'closedwon') return true;
      if (d.dealstage === 'closedlost' && d.hs_v2_date_entered_1041142962) return true;
      return false;
    });
    const won90d = closedRecently.filter(d => d.dealstage === 'closedwon').length;
    const lost90d = closedRecently.filter(d => d.dealstage === 'closedlost').length;
    const closeRate = closedRecently.length > 0 ? Math.round((won90d / closedRecently.length) * 100) : null;

    const noAmount = filteredOpenDeals.filter(d => !d.amount || parseFloat(d.amount) === 0).length;

    // Per-rep breakdown
    const perRep = ownerOptions.map(o => {
      const repOpen = openDeals.filter(d => d.hubspot_owner_id === o.id);
      const repAll = allDeals.filter(d => d.hubspot_owner_id === o.id);
      const repWonMTD = repAll
        .filter(d => d.dealstage === 'closedwon' && d.closedate && new Date(d.closedate) >= monthStart)
        .reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
      const repPipeline = repOpen.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
      const repAtRisk = repOpen.filter(d => {
        const noA = !d.amount || parseFloat(d.amount) === 0;
        const cs = d.daysToClose !== null && d.daysToClose < 14;
        const st = d.daysInStage !== null && d.daysInStage > 30;
        return (cs && noA) || st;
      }).length;
      const repPacing = (MONTHLY_QUOTA_PER_REP * (dayOfMonth / daysInMonth));
      return {
        ...o, wonMTD: repWonMTD, quota: MONTHLY_QUOTA_PER_REP,
        pacingPct: repPacing > 0 ? Math.round((repWonMTD / repPacing) * 100) : 0,
        openDeals: repOpen.length, pipeline: repPipeline, atRisk: repAtRisk,
      };
    });

    return {
      teamQuota, closedWonMTD, pacingPct, proRatedQuota,
      pipelineCreatedMTD, dealsCreatedMTD, openPipeline, weightedPipeline,
      atRiskCount: atRiskDeals.length, closeRate, won90d, lost90d, noAmount,
      perRep, dayOfMonth, daysInMonth,
    };
  }, [filteredOpenDeals, deals, ownerFilter, ownerOptions, openDeals]);

  // Risk alerts — include rep name so Nick can see whose deal it is
  const riskAlerts = useMemo(() => {
    const alerts = [];
    filteredOpenDeals.forEach(d => {
      const amt = parseFloat(d.amount) || 0;
      const rep = OWNER_MAP[d.hubspot_owner_id] || '';
      const repTag = rep ? ` [${rep}]` : '';
      if (d.daysToClose !== null && d.daysToClose < 14 && amt === 0)
        alerts.push({ type: 'critical', icon: '🔴', text: `${d.dealname}${repTag}: Closing in ${d.daysToClose}d with no amount set` });
      if (d.daysToClose !== null && d.daysToClose < 30 && d.dealstage === '1041142961')
        alerts.push({ type: 'warning', icon: '⚠️', text: `${d.dealname}${repTag}: Closing in ${d.daysToClose}d still at Demo Scheduled` });
    });
    if (ms.noAmount > 0)
      alerts.push({ type: 'warning', icon: '⚠️', text: `${ms.noAmount} deal(s) with no amount set` });
    return alerts;
  }, [filteredOpenDeals, ms.noAmount]);

  // Kanban
  const kanbanColumns = useMemo(() => {
    return DEAL_STAGE_ORDER.map(stageId => {
      const stageInfo = DEAL_STAGE_MAP[stageId];
      const stageDeals = filteredOpenDeals
        .filter(d => d.dealstage === stageId)
        .sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0));
      return { id: stageId, name: stageInfo.name, probability: stageInfo.probability, deals: stageDeals };
    });
  }, [filteredOpenDeals]);

  const handleBrief = (deal) => {
    setBriefDeal({ name: deal.dealname, industry: '', numberofemployees: '', city: '', state: '', hs_lead_status: '', lifecyclestage: '', hs_ideal_customer_profile: '', annualrevenue: '', ...deal });
  };

  const tabs = [
    { key: 'pipeline', label: 'Pipeline Board' },
    { key: 'closedlost', label: `Closed Lost (${filteredClosedLost.length})` },
    { key: 'actions', label: 'Action Items' },
  ];

  const pacingColor = ms.pacingPct >= 100 ? '#3fb950' : ms.pacingPct >= 70 ? '#d29922' : '#f85149';

  return (
    <div style={{ height: 'calc(100vh - 56px - 46px)', overflowY: 'auto' }}>

      {/* Owner Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
        <Filter size={14} style={{ color: 'var(--text-muted)' }} />
        <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', color: 'var(--text)', fontSize: 13, minWidth: 200 }}>
          <option value="all">All Reps ({openDeals.length} deals)</option>
          {ownerOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Showing {filteredOpenDeals.length} open deal{filteredOpenDeals.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Manager Dashboard ── */}
      <div className="manager-dashboard">
        <div className="manager-dashboard-row">
          {/* Hero: Quota Pacing */}
          <div className="manager-hero-stat">
            <div className="manager-hero-label">QUOTA PACING</div>
            <div className="manager-hero-value" style={{ color: pacingColor }}>
              {ms.pacingPct}%
              {ms.pacingPct >= 100
                ? <TrendingUp size={20} style={{ marginLeft: 6 }} />
                : <TrendingDown size={20} style={{ marginLeft: 6 }} />}
            </div>
            <div className="manager-hero-sub">
              {formatCurrency(ms.closedWonMTD)} won / {formatCurrency(ms.teamQuota)} quota
            </div>
            <div className="pacing-bar">
              <div className="pacing-bar-target" style={{ left: `${Math.min((ms.dayOfMonth / ms.daysInMonth) * 100, 100)}%` }} />
              <div className="pacing-bar-fill" style={{ width: `${Math.min((ms.closedWonMTD / ms.teamQuota) * 100, 100)}%`, background: pacingColor }} />
            </div>
          </div>

          {/* Stats grid */}
          <div className="manager-stats-grid">
            <div className="pipeline-stat">
              <div className="pipeline-stat-label">Closed Won MTD</div>
              <div className="pipeline-stat-value" style={{ color: '#3fb950' }}>{formatCurrency(ms.closedWonMTD)}</div>
            </div>
            <div className="pipeline-stat">
              <div className="pipeline-stat-label">Pipeline Created MTD</div>
              <div className="pipeline-stat-value">{formatCurrency(ms.pipelineCreatedMTD)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{ms.dealsCreatedMTD} deals</div>
            </div>
            <div className="pipeline-stat">
              <div className="pipeline-stat-label">Open Pipeline</div>
              <div className="pipeline-stat-value">{formatCurrency(ms.openPipeline)}</div>
            </div>
            <div className="pipeline-stat">
              <div className="pipeline-stat-label">Weighted Pipeline</div>
              <div className="pipeline-stat-value">{formatCurrency(ms.weightedPipeline)}</div>
            </div>
            <div className="pipeline-stat">
              <div className="pipeline-stat-label">Close Rate (90d)</div>
              <div className="pipeline-stat-value">
                {ms.closeRate != null ? `${ms.closeRate}%` : '--'}
                {ms.closeRate != null && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>({ms.won90d}W/{ms.lost90d}L)</span>}
              </div>
            </div>
            <div className="pipeline-stat">
              <div className="pipeline-stat-label">At Risk</div>
              <div className="pipeline-stat-value" style={{ color: ms.atRiskCount > 0 ? '#f85149' : 'var(--text)' }}>{ms.atRiskCount}</div>
            </div>
          </div>
        </div>

        {/* Per-rep breakdown */}
        {ownerFilter === 'all' && ms.perRep.length > 1 && (
          <div className="manager-rep-breakdown">
            <div className="manager-rep-breakdown-title">REP BREAKDOWN</div>
            <div className="manager-rep-rows">
              {ms.perRep.map(rep => {
                const rc = rep.pacingPct >= 100 ? '#3fb950' : rep.pacingPct >= 70 ? '#d29922' : '#f85149';
                return (
                  <div key={rep.id} className="manager-rep-row" onClick={() => setOwnerFilter(rep.id)} title="Click to filter">
                    <div className="manager-rep-name">{rep.name}</div>
                    <div className="manager-rep-stats">
                      <span><span style={{ color: '#3fb950' }}>{formatCompact(rep.wonMTD)}</span><span style={{ color: 'var(--text-muted)' }}> / {formatCompact(rep.quota)}</span></span>
                      <span style={{ color: rc, fontWeight: 700 }}>{rep.pacingPct}%</span>
                      <span>{rep.openDeals} deals</span>
                      <span>{formatCompact(rep.pipeline)} pipe</span>
                      {rep.atRisk > 0 && <span style={{ color: '#f85149' }}>{rep.atRisk} at risk</span>}
                    </div>
                    <div className="pacing-bar pacing-bar-sm">
                      <div className="pacing-bar-fill" style={{ width: `${Math.min((rep.wonMTD / rep.quota) * 100, 100)}%`, background: rc }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Risk Alerts */}
      {riskAlerts.length > 0 && (
        <div className="risk-alerts">
          {riskAlerts.map((a, i) => <div key={i} className={`risk-alert ${a.type}`}><span>{a.icon}</span><span>{a.text}</span></div>)}
        </div>
      )}

      {/* Tabs */}
      <div className="dcc-tabs">
        {tabs.map(t => <button key={t.key} className={`sub-tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>{t.label}</button>)}
      </div>

      {/* Pipeline Board */}
      {activeTab === 'pipeline' && (loading.deals ? (
        <div className="no-data"><div style={{ animation: 'spin 1s linear infinite', fontSize: 24 }}>⟳</div><div>Loading pipeline...</div></div>
      ) : (
        <div className="kanban-board">
          {kanbanColumns.map(col => (
            <div key={col.id} className="kanban-column">
              <div className="kanban-column-header">
                <span>{col.name} ({(col.probability * 100).toFixed(0)}%)</span>
                <span className="count">{col.deals.length}</span>
              </div>
              <div className="kanban-cards">
                {col.deals.map(deal => (
                  <div key={deal.id} className="deal-card" onClick={() => setSelectedDeal(deal)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div className="deal-card-name" style={{ flex: 1 }}>{deal.dealname || 'Untitled'}</div>
                      <a href={hubspotDealUrl(deal.id)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" onClick={e => e.stopPropagation()} style={{ flexShrink: 0, marginLeft: 6 }} title="Open in HubSpot"><ExternalLink size={12} /></a>
                    </div>
                    <div className="deal-card-row"><span>Amount</span><span className={`mono ${!deal.amount ? 'danger' : ''}`}>{deal.amount ? formatCurrency(deal.amount) : 'NOT SET'}</span></div>
                    <div className="deal-card-row"><span>Close</span><span className={`mono ${deal.daysToClose !== null && deal.daysToClose < 14 ? 'danger' : ''}`}>{deal.closedate ? new Date(deal.closedate).toLocaleDateString() : '—'}</span></div>
                    <div className="deal-card-row"><span>In Stage</span><span className="mono">{deal.daysInStage ?? '—'}d</span></div>
                    {ownerFilter === 'all' && deal.hubspot_owner_id && (
                      <div className="deal-card-row" style={{ marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
                        <span>Rep</span><span style={{ fontSize: 11, fontWeight: 600 }}>{OWNER_MAP[deal.hubspot_owner_id] || '—'}</span>
                      </div>
                    )}
                  </div>
                ))}
                {col.deals.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No deals</div>}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Closed Lost */}
      {activeTab === 'closedlost' && (
        <div className="data-table-wrapper">
          {filteredClosedLost.length === 0 ? (
            <div className="no-data"><div className="no-data-icon">🎉</div><div>No closed-lost deals</div></div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Company / Deal</th><th>Amount</th><th>Date Lost</th><th>Days to Lost</th>{ownerFilter === 'all' && <th>Rep</th>}<th>HubSpot</th><th>Re-Engage</th></tr></thead>
              <tbody>
                {filteredClosedLost.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.dealname || '—'}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{d.amount ? formatCurrency(d.amount) : '—'}</td>
                    <td style={{ fontSize: 12 }}>{d.closedate ? new Date(d.closedate).toLocaleDateString() : '—'}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{d.daysSinceCreate ?? '—'}</td>
                    {ownerFilter === 'all' && <td style={{ fontSize: 12 }}>{OWNER_MAP[d.hubspot_owner_id] || '—'}</td>}
                    <td><a href={hubspotDealUrl(d.id)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={12} /></a></td>
                    <td><button className="btn btn-primary btn-sm" onClick={() => setReengageDeal(d)}><Mail size={12} /> Re-Engage</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Action Items */}
      {activeTab === 'actions' && (
        <div className="data-table-wrapper">
          <div className="no-data"><div className="no-data-icon">✅</div><div>Action items will populate from Attention call data</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Connect your Attention API key to see action items across all deals</div></div>
        </div>
      )}

      {selectedDeal && <DealDetailPanel deal={selectedDeal} onClose={() => setSelectedDeal(null)} onBrief={handleBrief} onReengage={d => setReengageDeal(d)} />}
      {briefDeal && <BriefModal company={briefDeal} calls={[]} deal={briefDeal} onClose={() => setBriefDeal(null)} />}
      {reengageDeal && <ReengageModal company={reengageDeal.dealname || 'Unknown'} lastCallDaysAgo={null} objection={null} nextStep={null} onClose={() => setReengageDeal(null)} />}
    </div>
  );
}
