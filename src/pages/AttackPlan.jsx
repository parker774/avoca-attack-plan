import { useState, useMemo, useCallback, useRef } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import CompanyTable from '../components/CompanyTable.jsx';
import CallPanel from '../components/CallPanel.jsx';
import BriefModal from '../components/BriefModal.jsx';
import { OWNER_MAP, US_REGIONS, DEAL_STAGE_ORDER } from '../utils/constants.js';

function formatCurrency(n) {
  if (!n && n !== 0) return '$0';
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

const DEFAULT_FILTERS = {
  owner: 'all',
  regions: [],
  states: [],
  crm: [],
  tier: 'all',
  leadStatus: 'all',
  lifecycle: 'all',
  icpTier: 'all',
  activity: 'all',
  pe: 'all',
  minEmployees: '',
};

// Build a flat Set of all states included by selected regions
function getRegionStates(selectedRegions) {
  if (!selectedRegions || selectedRegions.length === 0) return null;
  const states = new Set();
  selectedRegions.forEach(r => {
    const region = US_REGIONS.find(reg => reg.name === r);
    if (region) region.states.forEach(s => states.add(s));
  });
  return states;
}

function applyFilters(companies, filters) {
  const regionStates = getRegionStates(filters.regions);

  return companies.filter(c => {
    if (filters.owner !== 'all' && c.hubspot_owner_id !== filters.owner) return false;

    // Region filter: company state must be in one of the selected regions
    const companyState = c.normalizedState || '';
    if (regionStates && !regionStates.has(companyState)) return false;

    // State filter: additional drill-down within regions (or standalone)
    if (filters.states.length > 0 && !filters.states.includes(companyState)) return false;
    if (filters.crm.length > 0 && !filters.crm.includes((c.crm_dropdown || '').trim())) return false;
    if (filters.tier !== 'all' && c.tier !== filters.tier) return false;
    if (filters.leadStatus !== 'all' && (c.hs_lead_status || '').toUpperCase() !== filters.leadStatus.toUpperCase()) return false;
    if (filters.lifecycle !== 'all' && (c.lifecyclestage || '').toLowerCase() !== filters.lifecycle.toLowerCase()) return false;
    if (filters.icpTier !== 'all' && (c.hs_ideal_customer_profile || '').toLowerCase() !== filters.icpTier.toLowerCase()) return false;

    if (filters.activity !== 'all') {
      const days = c.daysSinceTouch;
      if (filters.activity === 'active' && (days === null || days >= 60)) return false;
      if (filters.activity === 'warm' && (days === null || days < 60 || days >= 120)) return false;
      if (filters.activity === 'cold' && (days !== null && days < 120)) return false;
      if (filters.activity === 'never' && days !== null) return false;
    }

    if (filters.pe === 'pe' && !c.hasPE) return false;
    if (filters.pe === 'non-pe' && c.hasPE) return false;

    if (filters.minEmployees) {
      const min = parseInt(filters.minEmployees) || 0;
      if ((parseInt(c.numberofemployees) || 0) < min) return false;
    }

    return true;
  });
}

export default function AttackPlan({ companies, deals, rawCalls, owners, weights, setWeights, loading, addToast }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState('master');
  const [callsPanel, setCallsPanel] = useState(null);
  const [briefModal, setBriefModal] = useState(null);
  const debounceRef = useRef(null);

  // Debounced weight updates
  const handleSetWeights = useCallback((updater) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setWeights(updater);
    }, 300);
    // Also set immediately for responsive UI
    setWeights(updater);
  }, [setWeights]);

  const filtered = useMemo(() => applyFilters(companies, filters), [companies, filters]);

  // Tab-specific views
  const tabData = useMemo(() => {
    const master = filtered;
    const upsell = filtered.filter(c => c.isCustomer)
      .sort((a, b) => (b.daysSinceTouch ?? 9999) - (a.daysSinceTouch ?? 9999));
    const cold = filtered.filter(c =>
      (c.tier === 'A' || c.tier === 'B') &&
      (c.daysSinceTouch === null || c.daysSinceTouch >= 90) &&
      !c.hasOpenDeal
    );
    const multiLoc = filtered.filter(c => c.childCount > 0)
      .sort((a, b) => b.childCount - a.childCount);
    const peHolding = filtered.filter(c => c.hasPE);

    // ── Time boundaries ──
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(now.getDate() - 90);

    // ── Pre-group deals by owner ID for O(n) lookups ──
    const dealsByOwnerId = {};
    (deals || []).forEach(d => {
      const oid = d.hubspot_owner_id;
      if (!oid) return;
      if (!dealsByOwnerId[oid]) dealsByOwnerId[oid] = [];
      dealsByOwnerId[oid].push(d);
    });

    // ── Map call userEmail → HubSpot owner ID, then group ──
    const ownerEmailMap = {};
    (owners || []).forEach(o => {
      if (o.email) ownerEmailMap[o.email.toLowerCase().trim()] = o.id;
    });
    const callsByOwnerId = {};
    (rawCalls || []).forEach(c => {
      const email = (c.userEmail || '').toLowerCase().trim();
      const oid = ownerEmailMap[email];
      if (oid) {
        if (!callsByOwnerId[oid]) callsByOwnerId[oid] = [];
        callsByOwnerId[oid].push(c);
      }
    });

    // ── Leaderboard: group companies by owner, then enrich with deal/call metrics ──
    const ownerGroups = {};
    filtered.forEach(c => {
      const oid = c.hubspot_owner_id || 'unknown';
      const name = OWNER_MAP[oid] || oid;
      if (!ownerGroups[oid]) ownerGroups[oid] = { name, ownerId: oid, companies: [], totalScore: 0 };
      ownerGroups[oid].companies.push(c);
      ownerGroups[oid].totalScore += c.score;
    });

    const leaderboard = Object.values(ownerGroups).map(g => {
      const repDeals = dealsByOwnerId[g.ownerId] || [];
      const repCalls = callsByOwnerId[g.ownerId] || [];

      // Meetings = calls (from Attention)
      const meetingsThisWeek = repCalls.filter(c => {
        const d = new Date(c.date || c.created_at);
        return !isNaN(d) && d >= weekStart;
      }).length;
      const meetingsThisMonth = repCalls.filter(c => {
        const d = new Date(c.date || c.created_at);
        return !isNaN(d) && d >= monthStart;
      }).length;

      // New deals created in window
      const newDealsThisWeek = repDeals.filter(d =>
        d.createdate && new Date(d.createdate) >= weekStart
      ).length;
      const newDealsThisMonth = repDeals.filter(d =>
        d.createdate && new Date(d.createdate) >= monthStart
      ).length;
      const scoredCalls = repCalls.filter(c => c.score != null && c.score > 0);
      const avgCallScore = scoredCalls.length > 0
        ? Math.round(scoredCalls.reduce((s, c) => s + c.score, 0) / scoredCalls.length)
        : null;

      // Pipeline
      const openRepDeals = repDeals.filter(d => d.dealstage !== 'closedwon' && d.dealstage !== 'closedlost');
      const pipelineValue = openRepDeals.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
      const weightedPipeline = openRepDeals.reduce((s, d) => s + (parseFloat(d.amount) || 0) * (d.probability || 0), 0);
      const activeDealCount = openRepDeals.length;

      // Close rate (90-day rolling) — only count deals that reached SQL (stage 2+)
      // closedwon always counts; closedlost only if hs_v2_date_entered_1041142962 is set
      const closedRecently = repDeals.filter(d => {
        if (!d.closedate || new Date(d.closedate) < ninetyDaysAgo) return false;
        if (d.dealstage === 'closedwon') return true;
        if (d.dealstage === 'closedlost' && d.hs_v2_date_entered_1041142962) return true;
        return false;
      });
      const won90d = closedRecently.filter(d => d.dealstage === 'closedwon').length;
      const lost90d = closedRecently.filter(d => d.dealstage === 'closedlost').length;
      const closeRate = closedRecently.length > 0
        ? Math.round((won90d / closedRecently.length) * 100)
        : null;

      // Won revenue
      const wonDeals = repDeals.filter(d => d.dealstage === 'closedwon');
      const wonRevenue = wonDeals.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
      const wonRevenueMTD = wonDeals
        .filter(d => d.closedate && new Date(d.closedate) >= monthStart)
        .reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);

      return {
        ...g,
        meetingsThisWeek, meetingsThisMonth,
        newDealsThisWeek, newDealsThisMonth,
        callsTotal: repCalls.length, avgCallScore,
        pipelineValue, weightedPipeline, activeDealCount,
        closeRate, won90d, lost90d,
        wonRevenue, wonRevenueMTD,
      };
    }).sort((a, b) => b.totalScore - a.totalScore);

    // ── Team summary ──
    const teamSummary = {
      totalReps: leaderboard.length,
      totalAccounts: leaderboard.reduce((s, l) => s + l.companies.length, 0),
      totalMeetingsWeek: leaderboard.reduce((s, l) => s + l.meetingsThisWeek, 0),
      totalMeetingsMonth: leaderboard.reduce((s, l) => s + l.meetingsThisMonth, 0),
      totalNewDealsWeek: leaderboard.reduce((s, l) => s + l.newDealsThisWeek, 0),
      totalNewDealsMonth: leaderboard.reduce((s, l) => s + l.newDealsThisMonth, 0),
      totalPipeline: leaderboard.reduce((s, l) => s + l.pipelineValue, 0),
      totalWeightedPipeline: leaderboard.reduce((s, l) => s + l.weightedPipeline, 0),
      totalWonMTD: leaderboard.reduce((s, l) => s + l.wonRevenueMTD, 0),
      teamCloseRate: (() => {
        const totalClosed = leaderboard.reduce((s, l) => s + l.won90d + l.lost90d, 0);
        const totalWon = leaderboard.reduce((s, l) => s + l.won90d, 0);
        return totalClosed > 0 ? Math.round((totalWon / totalClosed) * 100) : null;
      })(),
    };

    // Territory: group by normalized state
    const stateGroups = {};
    filtered.forEach(c => {
      const st = c.normalizedState || 'Unknown';
      if (!stateGroups[st]) stateGroups[st] = { state: st, companies: [], tierA: 0, tierB: 0 };
      stateGroups[st].companies.push(c);
      if (c.tier === 'A') stateGroups[st].tierA++;
      if (c.tier === 'B') stateGroups[st].tierB++;
    });
    const territory = Object.values(stateGroups).sort((a, b) => b.companies.length - a.companies.length);

    return { master, upsell, cold, multiLoc, peHolding, leaderboard, teamSummary, territory };
  }, [filtered, deals, rawCalls, owners]);

  const tabs = [
    { key: 'master', label: '📋 Master', count: tabData.master.length },
    { key: 'leaderboard', label: '🏆 Leaderboard', count: tabData.leaderboard.length },
    { key: 'territory', label: '🗺️ Territory', count: tabData.territory.length },
    { key: 'pe', label: '🏢 PE/Holding', count: tabData.peHolding.length },
    { key: 'upsell', label: '💰 Upsell', count: tabData.upsell.length },
    { key: 'cold', label: '🧊 Cold', count: tabData.cold.length },
    { key: 'multi', label: '🏗️ Multi-Location', count: tabData.multiLoc.length },
  ];

  const renderTabContent = () => {
    if (loading.companies) {
      return (
        <div className="data-table-wrapper">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-row" />
          ))}
        </div>
      );
    }

    switch (activeTab) {
      case 'leaderboard': {
        const ts = tabData.teamSummary;
        return (
          <div>
            {/* ── Team Summary Banner ── */}
            <div className="team-summary-banner">
              <div className="team-summary-title">TEAM SNAPSHOT</div>
              <div className="team-summary-stats">
                <div className="pipeline-stat">
                  <div className="pipeline-stat-label">Meetings This Week</div>
                  <div className="pipeline-stat-value">{ts.totalMeetingsWeek}</div>
                </div>
                <div className="pipeline-stat">
                  <div className="pipeline-stat-label">Meetings This Month</div>
                  <div className="pipeline-stat-value">{ts.totalMeetingsMonth}</div>
                </div>
                <div className="pipeline-stat">
                  <div className="pipeline-stat-label">New Deals This Week</div>
                  <div className="pipeline-stat-value">{ts.totalNewDealsWeek}</div>
                </div>
                <div className="pipeline-stat">
                  <div className="pipeline-stat-label">New Deals This Month</div>
                  <div className="pipeline-stat-value">{ts.totalNewDealsMonth}</div>
                </div>
                <div className="pipeline-stat">
                  <div className="pipeline-stat-label">Open Pipeline</div>
                  <div className="pipeline-stat-value">{formatCurrency(ts.totalPipeline)}</div>
                </div>
                <div className="pipeline-stat">
                  <div className="pipeline-stat-label">Won MTD</div>
                  <div className="pipeline-stat-value" style={{ color: '#3fb950' }}>
                    {formatCurrency(ts.totalWonMTD)}
                  </div>
                </div>
                <div className="pipeline-stat">
                  <div className="pipeline-stat-label">Team Close Rate (90d)</div>
                  <div className="pipeline-stat-value">
                    {ts.teamCloseRate != null ? `${ts.teamCloseRate}%` : '--'}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Per-Rep Cards ── */}
            <div className="leaderboard-grid">
              {tabData.leaderboard.map((leader, i) => (
                <div key={leader.ownerId} className="leader-card">
                  <div className="leader-card-header">
                    <div className="leader-card-rank">#{i + 1}</div>
                    <div className="leader-card-name">{leader.name}</div>
                  </div>

                  {/* Activity */}
                  <div className="leader-card-section">
                    <div className="leader-card-section-title">Activity</div>
                    <div className="leader-stat-row">
                      <div>
                        <div className="leader-stat-label">Meetings (wk / mo)</div>
                        <div className="leader-stat-value">
                          {leader.meetingsThisWeek} <span className="stat-sep">/</span> {leader.meetingsThisMonth}
                        </div>
                      </div>
                      <div>
                        <div className="leader-stat-label">New Deals (wk / mo)</div>
                        <div className="leader-stat-value">
                          {leader.newDealsThisWeek} <span className="stat-sep">/</span> {leader.newDealsThisMonth}
                        </div>
                      </div>
                      <div>
                        <div className="leader-stat-label">Avg Call Score</div>
                        <div className="leader-stat-value" style={{
                          color: leader.avgCallScore != null
                            ? leader.avgCallScore >= 70 ? '#3fb950' : leader.avgCallScore >= 50 ? '#d29922' : '#f85149'
                            : '#8b949e'
                        }}>
                          {leader.avgCallScore != null ? leader.avgCallScore : '--'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pipeline */}
                  <div className="leader-card-section">
                    <div className="leader-card-section-title">Pipeline</div>
                    <div className="leader-stat-row">
                      <div>
                        <div className="leader-stat-label">Open Pipeline</div>
                        <div className="leader-stat-value">{formatCurrency(leader.pipelineValue)}</div>
                      </div>
                      <div>
                        <div className="leader-stat-label">Weighted</div>
                        <div className="leader-stat-value">{formatCurrency(leader.weightedPipeline)}</div>
                      </div>
                      <div>
                        <div className="leader-stat-label">Active Deals</div>
                        <div className="leader-stat-value">{leader.activeDealCount}</div>
                      </div>
                    </div>
                  </div>

                  {/* Performance */}
                  <div className="leader-card-section">
                    <div className="leader-card-section-title">Performance (90d)</div>
                    <div className="leader-stat-row">
                      <div>
                        <div className="leader-stat-label">Close Rate</div>
                        <div className="leader-stat-value" style={{
                          color: leader.closeRate != null
                            ? leader.closeRate >= 40 ? '#3fb950' : leader.closeRate >= 25 ? '#d29922' : '#f85149'
                            : '#8b949e'
                        }}>
                          {leader.closeRate != null ? `${leader.closeRate}%` : '--'}
                        </div>
                        {leader.closeRate != null && (
                          <div className="close-rate-bar">
                            <div className="close-rate-bar-fill" style={{
                              width: `${leader.closeRate}%`,
                              background: leader.closeRate >= 40 ? '#3fb950' : leader.closeRate >= 25 ? '#d29922' : '#f85149',
                            }} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="leader-stat-label">Won / Lost</div>
                        <div className="leader-stat-value">
                          <span style={{ color: '#3fb950' }}>{leader.won90d}</span>
                          <span className="stat-sep"> / </span>
                          <span style={{ color: '#f85149' }}>{leader.lost90d}</span>
                        </div>
                      </div>
                      <div>
                        <div className="leader-stat-label">Won Revenue</div>
                        <div className="leader-stat-value" style={{ color: '#3fb950' }}>
                          {formatCurrency(leader.wonRevenue)}
                        </div>
                        {leader.wonRevenueMTD > 0 && (
                          <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>
                            MTD: {formatCurrency(leader.wonRevenueMTD)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Territory */}
                  <div className="leader-card-section">
                    <div className="leader-card-section-title">Territory</div>
                    <div className="leader-stat-row">
                      <div>
                        <div className="leader-stat-label">Accounts</div>
                        <div className="leader-stat-value">{leader.companies.length}</div>
                      </div>
                      <div>
                        <div className="leader-stat-label">Tier A</div>
                        <div className="leader-stat-value">
                          {leader.companies.filter(c => c.tier === 'A').length}
                        </div>
                      </div>
                      <div>
                        <div className="leader-stat-label">Avg Score</div>
                        <div className="leader-stat-value">
                          {leader.companies.length > 0 ? Math.round(leader.totalScore / leader.companies.length) : 0}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'territory':
        return (
          <div className="territory-grid">
            {tabData.territory.map(t => (
              <div key={t.state} className="territory-card">
                <div className="territory-card-state">{t.state}</div>
                <div className="territory-card-count">{t.companies.length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                  Tier A: {t.tierA} · Tier B: {t.tierB}
                </div>
              </div>
            ))}
          </div>
        );

      case 'pe':
        return <CompanyTable companies={tabData.peHolding} onCallsClick={setCallsPanel} onBriefClick={setBriefModal} />;
      case 'upsell':
        return <CompanyTable companies={tabData.upsell} onCallsClick={setCallsPanel} onBriefClick={setBriefModal} />;
      case 'cold':
        return <CompanyTable companies={tabData.cold} onCallsClick={setCallsPanel} onBriefClick={setBriefModal} />;
      case 'multi':
        return <CompanyTable companies={tabData.multiLoc} onCallsClick={setCallsPanel} onBriefClick={setBriefModal} />;
      default:
        return <CompanyTable companies={tabData.master} onCallsClick={setCallsPanel} onBriefClick={setBriefModal} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        weights={weights}
        setWeights={handleSetWeights}
        filters={filters}
        setFilters={setFilters}
        companies={filtered}
        deals={deals}
        owners={owners}
      />

      <div className="main-content">
        <div className="sub-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`sub-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              <span className="count">{tab.count}</span>
            </button>
          ))}
        </div>

        {renderTabContent()}
      </div>

      {callsPanel && (
        <CallPanel
          company={callsPanel}
          onClose={() => setCallsPanel(null)}
        />
      )}

      {briefModal && (
        <BriefModal
          company={briefModal}
          calls={[]}
          deal={null}
          onClose={() => setBriefModal(null)}
        />
      )}
    </div>
  );
}
