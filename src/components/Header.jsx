import { useState } from 'react';
import { RefreshCw, Building2, DollarSign, Phone, Users, Download } from 'lucide-react';
import { pullCalls, fetchCalls } from '../utils/api.js';

function formatCurrency(n) {
  if (!n && n !== 0) return '$0';
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function Header({
  lastRefresh, refreshing, onRefresh, companies, pipelineStats, rawCalls,
  selectedRepIds, owners, onChangeCowboys, onCallsUpdated, addToast
}) {
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(null); // { loaded, total }

  const callsThisWeek = Array.isArray(rawCalls) ? rawCalls.filter(c => {
    if (!c.date && !c.created_at) return false;
    const d = new Date(c.date || c.created_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  }).length : 0;

  const totalCalls = Array.isArray(rawCalls) ? rawCalls.length : 0;

  // Build cowboy names for tooltip
  const cowboyNames = (selectedRepIds || []).map(id => {
    const owner = (owners || []).find(o => o.id === id);
    if (!owner) return id;
    return [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email || id;
  });

  const handlePullCalls = async () => {
    if (pulling) return;
    setPulling(true);
    setPullProgress({ loaded: 0, total: 0 });

    try {
      const total = await pullCalls((data) => {
        if (data.status === 'progress') {
          setPullProgress({ loaded: data.loaded || 0, total: data.total || 0 });
        }
      });

      // Refresh the calls in the app
      const callData = await fetchCalls();
      if (onCallsUpdated) onCallsUpdated(callData.calls || []);
      if (addToast) addToast(`Pulled ${total.toLocaleString()} calls from Attention`, 'success');
    } catch (err) {
      if (addToast) addToast('Failed to pull calls: ' + err.message, 'error');
    } finally {
      setPulling(false);
      setPullProgress(null);
    }
  };

  const pullPct = pullProgress && pullProgress.total > 0
    ? Math.round((pullProgress.loaded / pullProgress.total) * 100)
    : 0;

  return (
    <header className="global-header">
      <div className="wordmark">
        AVOCA<span>.</span>
      </div>

      <div className="header-center">
        {/* Cowboys badge */}
        {onChangeCowboys && (
          <button
            className="cowboys-badge"
            onClick={onChangeCowboys}
            title={cowboyNames.length ? `Viewing: ${cowboyNames.join(', ')}` : 'All reps'}
          >
            <Users size={14} />
            <span style={{ fontFamily: "'Rye', serif", letterSpacing: '0.05em' }}>
              {selectedRepIds?.length || 0} Cowboy{selectedRepIds?.length !== 1 ? 's' : ''}
            </span>
          </button>
        )}

        {lastRefresh && (
          <span>Last refreshed: {new Date(lastRefresh).toLocaleTimeString()}</span>
        )}
        <button
          className={`refresh-btn ${refreshing ? 'spinning' : ''}`}
          onClick={onRefresh}
          title="Refresh data"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="header-badges">
        <div className="badge">
          <Building2 size={14} />
          <span className="label">Accounts</span>
          {companies?.length || 0}
        </div>
        <div className="badge">
          <DollarSign size={14} />
          <span className="label">Pipeline</span>
          {formatCurrency(pipelineStats?.total)}
        </div>
        <div className="badge">
          <Phone size={14} />
          <span className="label">Calls</span>
          {totalCalls.toLocaleString()}
        </div>

        {/* Pull Calls button */}
        <button
          className={`pull-calls-btn ${pulling ? 'pulling' : ''}`}
          onClick={handlePullCalls}
          disabled={pulling}
          title={pulling
            ? `Pulling... ${pullProgress?.loaded?.toLocaleString() || 0} / ${pullProgress?.total?.toLocaleString() || '?'}`
            : 'Pull all historical calls from Attention'
          }
        >
          <Download size={14} />
          {pulling ? (
            <span className="pull-calls-progress">
              {pullPct}%
            </span>
          ) : (
            <span>Pull Calls</span>
          )}
          {pulling && (
            <div className="pull-calls-bar" style={{ width: `${pullPct}%` }} />
          )}
        </button>
      </div>
    </header>
  );
}
