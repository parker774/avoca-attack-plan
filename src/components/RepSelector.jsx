import { useState, useMemo } from 'react';
import './RepSelector.css';

// ── Visible reps — only show these on the selector ──
// Add East Coast reps here later by adding their emails
const ALLOWED_REPS = new Set([
  'parker@avoca.ai',
  'corbin@avoca.ai',
  'brian@avoca.ai',
]);

// ── Team presets — one-click group selection for Nick ──
const TEAM_PRESETS = [
  {
    name: 'West',
    emoji: '🤠',
    emails: ['parker@avoca.ai', 'corbin@avoca.ai', 'brian@avoca.ai'],
  },
];

function getInitials(name) {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function buildRepName(owner) {
  const first = owner.firstName || '';
  const last = owner.lastName || '';
  const full = [first, last].filter(Boolean).join(' ');
  return full || owner.email || `Owner ${owner.id}`;
}

export default function RepSelector({ owners, onSelect, loading }) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Build rep list — only show allowed reps
  const reps = useMemo(() => {
    return owners
      .filter(o => o.email && ALLOWED_REPS.has(o.email.toLowerCase().trim()))
      .map(o => ({
        id: o.id,
        name: buildRepName(o),
        email: o.email || '',
        initials: getInitials(buildRepName(o)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [owners]);

  // Search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return reps;
    const q = search.toLowerCase();
    return reps.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q)
    );
  }, [reps, search]);

  const toggleRep = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filtered.map(r => r.id)));
  };

  const clearAll = () => {
    setSelectedIds(new Set());
  };

  // Resolve a preset to a set of owner IDs
  const resolvePreset = (preset) => {
    if (preset.emails) {
      // Match by email
      const emailSet = new Set(preset.emails.map(e => e.toLowerCase().trim()));
      return new Set(
        owners
          .filter(o => o.email && emailSet.has(o.email.toLowerCase().trim()))
          .map(o => o.id)
      );
    }
    if (preset.teamId) {
      // Match by HubSpot team
      return new Set(
        owners
          .filter(o => (o.teams || []).some(t => t.id === preset.teamId))
          .map(o => o.id)
      );
    }
    return new Set();
  };

  const selectPreset = (preset) => {
    const ids = resolvePreset(preset);
    setSelectedIds(ids);
  };

  const handleRideOut = () => {
    onSelect(Array.from(selectedIds));
  };

  return (
    <div className="rep-selector">
      <div className="rep-selector-header">
        <div className="rep-selector-title">ROUND UP YOUR COWBOYS</div>
        <div className="rep-selector-subtitle">
          Select reps to view their data {loading ? '(loading data...)' : ''}
        </div>
      </div>

      {/* Quick-select team presets */}
      <div className="rep-presets">
        {TEAM_PRESETS.map(preset => {
          const presetIds = resolvePreset(preset);
          const isActive = presetIds.size > 0 && [...presetIds].every(id => selectedIds.has(id));
          return (
            <button
              key={preset.name}
              className={`rep-preset-btn ${isActive ? 'active' : ''}`}
              onClick={() => selectPreset(preset)}
            >
              <span className="rep-preset-emoji">{preset.emoji}</span>
              <span>{preset.name}</span>
              <span className="rep-preset-count">{presetIds.size}</span>
            </button>
          );
        })}
      </div>

      {/* Controls bar */}
      <div className="rep-controls">
        <input
          type="text"
          className="rep-search"
          placeholder="Search reps by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="rep-btn-ghost" onClick={selectAll}>
          Select All
        </button>
        <button className="rep-btn-ghost" onClick={clearAll}>
          Clear
        </button>
        <span className="rep-selected-count">
          {selectedIds.size} selected
        </span>
      </div>

      {/* Rep grid */}
      <div className="rep-grid">
        {filtered.map((rep, i) => (
          <div
            key={rep.id}
            className={`rep-card ${selectedIds.has(rep.id) ? 'selected' : ''}`}
            onClick={() => toggleRep(rep.id)}
            style={{ animationDelay: `${Math.min(i * 0.02, 0.5)}s` }}
          >
            <div className="rep-card-check">
              {selectedIds.has(rep.id) ? '✓' : ''}
            </div>
            <div className="rep-card-avatar">
              {rep.initials}
            </div>
            <div className="rep-card-name">{rep.name}</div>
            <div className="rep-card-email">{rep.email}</div>
          </div>
        ))}
      </div>

      {/* No results */}
      {filtered.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: 40 }}>
          No reps match your search
        </div>
      )}

      {/* Ride Out bar */}
      <div className="ride-out-bar">
        <button
          className="ride-out-btn"
          onClick={handleRideOut}
          disabled={selectedIds.size === 0}
        >
          {selectedIds.size === 0
            ? 'SELECT YOUR COWBOYS'
            : `RIDE OUT (${selectedIds.size})`
          }
        </button>
      </div>
    </div>
  );
}
