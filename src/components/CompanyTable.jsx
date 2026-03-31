import { useState, useMemo } from 'react';
import { ExternalLink, Phone, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { hubspotCompanyUrl, OWNER_MAP } from '../utils/constants.js';

const PAGE_SIZE = 50;

function getRowClass(c) {
  if (c.hasPE) return 'row-pe';
  if (c.hasOpenDeal || (c.lifecyclestage || '').toLowerCase() === 'opportunity') return 'row-deal';
  if ((c.hs_lead_status || '').toUpperCase() === 'WORKING' || (c.hs_lead_status || '').toUpperCase() === 'IN_PROGRESS') return 'row-working';
  if (c.tier === 'A' && !c.hasOpenDeal) return 'row-tier-a';
  return '';
}

function scoreColor(tier) {
  if (tier === 'A') return 'var(--tier-a)';
  if (tier === 'B') return 'var(--tier-b)';
  return 'var(--tier-c)';
}

export default function CompanyTable({ companies, onCallsClick, onBriefClick }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  // Reset page when companies or search changes
  const searched = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q) ||
      (c.domain || '').toLowerCase().includes(q) ||
      (c.crm_dropdown || '').toLowerCase().includes(q)
    );
  }, [companies, search]);

  const totalPages = Math.ceil(searched.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(0, totalPages - 1));
  const pageData = searched.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  if (!companies.length) {
    return (
      <div className="no-data">
        <div className="no-data-icon">📋</div>
        <div>No companies match your filters</div>
      </div>
    );
  }

  return (
    <div className="data-table-wrapper">
      {/* Search + pagination bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border)', gap: 12 }}>
        <input
          type="text"
          placeholder="Search companies..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 12px',
            color: 'var(--text)',
            fontSize: 13,
            width: 250,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>{searched.length.toLocaleString()} companies</span>
          <span>·</span>
          <span>Page {currentPage + 1} of {totalPages || 1}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Score</th>
            <th>Company</th>
            <th>Tier</th>
            <th>CRM</th>
            <th>Owner</th>
            <th>City</th>
            <th>St</th>
            <th>Emp</th>
            <th>ICP</th>
            <th>Touch</th>
            <th>Status</th>
            <th>PE</th>
            <th>HS</th>
            <th>Calls</th>
            <th>Brief</th>
          </tr>
        </thead>
        <tbody>
          {pageData.map((c, i) => (
            <tr key={c.id} className={getRowClass(c)}>
              <td style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                {currentPage * PAGE_SIZE + i + 1}
              </td>
              <td>
                <div className="score-bar">
                  <div className="score-bar-track">
                    <div
                      className="score-bar-fill"
                      style={{
                        width: `${c.score}%`,
                        background: scoreColor(c.tier),
                      }}
                    />
                  </div>
                  <span className="score-bar-value">{c.score}</span>
                </div>
              </td>
              <td style={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.name || '—'}
              </td>
              <td>
                <span className={`tier-badge tier-${c.tier.toLowerCase()}`}>{c.tier}</span>
              </td>
              <td style={{ fontSize: 12, color: c.crm_dropdown ? 'var(--text)' : 'var(--text-muted)' }}>
                {c.crm_dropdown || '—'}
              </td>
              <td style={{ fontSize: 12 }}>
                {OWNER_MAP[c.hubspot_owner_id] || '—'}
              </td>
              <td style={{ fontSize: 12 }}>{c.city || '—'}</td>
              <td style={{ fontSize: 12 }} title={c.stateSource ? `Source: ${c.stateSource}` : ''}>{c.normalizedState || '—'}</td>
              <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                {c.numberofemployees || '—'}
              </td>
              <td>
                {c.icp.tier ? (
                  <span className="icp-badge" style={{ color: c.icp.color }} title={`ICP Tier ${c.icp.tier}`}>
                    {c.icp.label}
                  </span>
                ) : '—'}
              </td>
              <td>
                <span className="staleness-badge" style={{ color: c.staleness.color }}>
                  {c.staleness.emoji} {c.staleness.label}
                </span>
              </td>
              <td style={{ fontSize: 12 }}>{c.hs_lead_status || '—'}</td>
              <td style={{ fontSize: 12, color: c.hasPE ? 'var(--red)' : 'var(--text-muted)' }}>
                {c.hasPE ? 'PE' : '—'}
              </td>
              <td>
                <a
                  href={hubspotCompanyUrl(c.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                  title="Open in HubSpot"
                >
                  <ExternalLink size={12} />
                </a>
              </td>
              <td>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => onCallsClick(c)}
                  title="View calls"
                >
                  <Phone size={12} />
                </button>
              </td>
              <td>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onBriefClick(c)}
                  title="Generate brief"
                >
                  <FileText size={12} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', gap: 4, borderTop: '1px solid var(--border)' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPage(0)}
            disabled={currentPage === 0}
            style={{ fontSize: 11 }}
          >
            First
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft size={14} />
          </button>
          {/* Page number buttons */}
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 7) {
              pageNum = i;
            } else if (currentPage < 4) {
              pageNum = i;
            } else if (currentPage > totalPages - 5) {
              pageNum = totalPages - 7 + i;
            } else {
              pageNum = currentPage - 3 + i;
            }
            return (
              <button
                key={pageNum}
                className={`btn btn-sm ${pageNum === currentPage ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setPage(pageNum)}
                style={{ minWidth: 32, fontSize: 12 }}
              >
                {pageNum + 1}
              </button>
            );
          })}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
          >
            <ChevronRight size={14} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPage(totalPages - 1)}
            disabled={currentPage >= totalPages - 1}
            style={{ fontSize: 11 }}
          >
            Last
          </button>
        </div>
      )}
    </div>
  );
}
