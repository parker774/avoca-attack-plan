import { useState, useEffect } from 'react';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import { fetchCalls } from '../utils/api.js';

function scoreBadgeStyle(score) {
  const n = parseInt(score) || 0;
  if (n >= 70) return { background: 'rgba(63,185,80,0.15)', color: 'var(--green)' };
  if (n >= 40) return { background: 'rgba(210,153,34,0.15)', color: 'var(--amber)' };
  return { background: 'rgba(248,81,73,0.15)', color: 'var(--red)' };
}

export default function CallPanel({ company, onClose }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Try to match calls by company. Attention links calls via CRM records.
        const data = await fetchCalls();
        const allCalls = data.calls || [];
        // Filter by company ID in CRM records if available
        const matched = allCalls.filter(c => {
          const crmRecords = c.crm_records || c.crmRecords || [];
          return crmRecords.some(r =>
            r.includes && r.includes(`companies:${company.id}`)
          ) || (c.company_name || '').toLowerCase().includes((company.name || '').toLowerCase());
        });
        setCalls(matched);
      } catch (err) {
        console.error('Error loading calls:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [company.id, company.name]);

  return (
    <>
      <div className="side-panel-overlay" onClick={onClose} />
      <div className="side-panel">
        <div className="side-panel-header">
          <div>
            <div className="side-panel-title">Calls: {company.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
              {calls.length} recorded call{calls.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button className="side-panel-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="no-data">
            <Loader2 size={24} className="spinning" style={{ animation: 'spin 1s linear infinite' }} />
            <div>Loading calls...</div>
          </div>
        ) : calls.length === 0 ? (
          <div className="no-data">
            <div className="no-data-icon">📞</div>
            <div>No recorded calls for this company</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Make sure calls are logged in Attention
            </div>
          </div>
        ) : (
          calls.map((call, i) => (
            <div key={call.id || i} className="call-entry">
              <div className="call-entry-header">
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {call.date || call.created_at || 'Unknown date'}
                  {call.duration && ` · ${Math.round(call.duration / 60)}min`}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {(call.score || call.scorecard_score) && (
                    <span
                      className="call-score-badge"
                      style={scoreBadgeStyle(call.score || call.scorecard_score)}
                    >
                      {call.score || call.scorecard_score}/100
                    </span>
                  )}
                  {(call.url || call.attention_url) && (
                    <a
                      href={call.url || call.attention_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                    >
                      <ExternalLink size={12} /> Attention
                    </a>
                  )}
                </div>
              </div>

              {call.summary && (
                <div className="call-entry-detail">
                  <strong>Summary:</strong> {call.summary}
                </div>
              )}
              {(call.objection || call.main_objection) && (
                <div className="call-entry-detail">
                  <strong>Objection:</strong> {call.objection || call.main_objection}
                </div>
              )}
              {(call.next_step || call.agreed_next_step) && (
                <div className="call-entry-detail">
                  <strong>Next Step:</strong> {call.next_step || call.agreed_next_step}
                </div>
              )}
              {(call.action_items || call.actionItems) && (
                <div className="call-entry-detail">
                  <strong>Action Items:</strong> {call.action_items || call.actionItems}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
