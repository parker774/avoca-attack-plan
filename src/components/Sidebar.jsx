import { useState, useMemo } from 'react';
import { Download, ChevronDown, X } from 'lucide-react';
import { OWNER_MAP, US_REGIONS } from '../utils/constants.js';
import { exportToExcel } from '../utils/exportExcel.js';

const SLIDER_CONFIG = [
  { key: 'tierA', label: 'Tier A', min: 0, max: 100 },
  { key: 'tierB', label: 'Tier B', min: 0, max: 100 },
  { key: 'emp100plus', label: '100+ emp', min: 0, max: 50 },
  { key: 'emp50to99', label: '50-99 emp', min: 0, max: 50 },
  { key: 'emp20to49', label: '20-49 emp', min: 0, max: 50 },
  { key: 'emp10to19', label: '10-19 emp', min: 0, max: 50 },
  { key: 'icpTier1', label: 'ICP T1', min: 0, max: 30 },
  { key: 'icpTier2', label: 'ICP T2', min: 0, max: 30 },
  { key: 'openDeal', label: 'Open Deal', min: 0, max: 50 },
  { key: 'childLocations', label: 'Multi-Loc', min: 0, max: 30 },
  { key: 'stalePenalty', label: 'Stale Pen.', min: -30, max: 0 },
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

function MultiStateSelect({ selected, onChange, activeRegions }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // When regions are selected, only show states within those regions
  const availableStates = useMemo(() => {
    if (!activeRegions || activeRegions.length === 0) return US_STATES;
    const regionStateSet = new Set();
    activeRegions.forEach(rName => {
      const region = US_REGIONS.find(r => r.name === rName);
      if (region) region.states.forEach(s => regionStateSet.add(s));
    });
    return US_STATES.filter(s => regionStateSet.has(s));
  }, [activeRegions]);

  const filtered = search
    ? availableStates.filter(s => s.includes(search.toUpperCase()))
    : availableStates;

  const toggle = (st) => {
    if (selected.includes(st)) {
      onChange(selected.filter(s => s !== st));
    } else {
      onChange([...selected, st]);
    }
  };

  return (
    <div className="multi-select-wrapper">
      <div className="multi-select-trigger" onClick={() => setOpen(!open)}>
        {selected.length === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>All States</span>
        ) : (
          <div className="multi-select-tags">
            {selected.map(st => (
              <span key={st} className="multi-select-tag">
                {st}
                <span className="multi-select-tag-x" onClick={e => { e.stopPropagation(); toggle(st); }}>×</span>
              </span>
            ))}
          </div>
        )}
        <ChevronDown size={14} style={{ flexShrink: 0, opacity: 0.5 }} />
      </div>
      {open && (
        <>
          <div className="multi-select-backdrop" onClick={() => setOpen(false)} />
          <div className="multi-select-dropdown">
            <input
              type="text"
              className="multi-select-search"
              placeholder="Search states..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {selected.length > 0 && (
              <div
                className="multi-select-clear"
                onClick={() => { onChange([]); setOpen(false); }}
              >
                Clear all
              </div>
            )}
            <div className="multi-select-options">
              {filtered.map(st => (
                <label key={st} className="multi-select-option">
                  <input
                    type="checkbox"
                    checked={selected.includes(st)}
                    onChange={() => toggle(st)}
                  />
                  <span>{st}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MultiCrmSelect({ selected, onChange, companies }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Build CRM options dynamically from actual data, sorted by count
  const crmOptions = useMemo(() => {
    const counts = {};
    (companies || []).forEach(c => {
      const crm = (c.crm_dropdown || '').trim();
      if (crm) counts[crm] = (counts[crm] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [companies]);

  const filtered = search
    ? crmOptions.filter(o => o.name.toLowerCase().includes(search.toLowerCase()))
    : crmOptions;

  const toggle = (crm) => {
    if (selected.includes(crm)) {
      onChange(selected.filter(s => s !== crm));
    } else {
      onChange([...selected, crm]);
    }
  };

  return (
    <div className="multi-select-wrapper">
      <div className="multi-select-trigger" onClick={() => setOpen(!open)}>
        {selected.length === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>All CRMs</span>
        ) : (
          <div className="multi-select-tags">
            {selected.map(crm => (
              <span key={crm} className="multi-select-tag">
                {crm}
                <span className="multi-select-tag-x" onClick={e => { e.stopPropagation(); toggle(crm); }}>×</span>
              </span>
            ))}
          </div>
        )}
        <ChevronDown size={14} style={{ flexShrink: 0, opacity: 0.5 }} />
      </div>
      {open && (
        <>
          <div className="multi-select-backdrop" onClick={() => setOpen(false)} />
          <div className="multi-select-dropdown">
            <input
              type="text"
              className="multi-select-search"
              placeholder="Search CRMs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {selected.length > 0 && (
              <div
                className="multi-select-clear"
                onClick={() => { onChange([]); setOpen(false); }}
              >
                Clear all
              </div>
            )}
            <div className="multi-select-options">
              {filtered.map(o => (
                <label key={o.name} className="multi-select-option">
                  <input
                    type="checkbox"
                    checked={selected.includes(o.name)}
                    onChange={() => toggle(o.name)}
                  />
                  <span>{o.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>{o.count.toLocaleString()}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MultiRegionSelect({ selected, onChange, companies }) {
  const [open, setOpen] = useState(false);

  // Count companies per region using normalizedState
  const regionCounts = useMemo(() => {
    const counts = {};
    US_REGIONS.forEach(r => { counts[r.name] = 0; });
    const stateToRegion = {};
    US_REGIONS.forEach(r => r.states.forEach(s => { stateToRegion[s] = r.name; }));
    (companies || []).forEach(c => {
      const st = c.normalizedState || '';
      if (stateToRegion[st]) counts[stateToRegion[st]]++;
    });
    return counts;
  }, [companies]);

  const toggle = (name) => {
    if (selected.includes(name)) {
      onChange(selected.filter(s => s !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  return (
    <div className="multi-select-wrapper">
      <div className="multi-select-trigger" onClick={() => setOpen(!open)}>
        {selected.length === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>All Regions</span>
        ) : (
          <div className="multi-select-tags">
            {selected.map(r => (
              <span key={r} className="multi-select-tag">
                {r}
                <span className="multi-select-tag-x" onClick={e => { e.stopPropagation(); toggle(r); }}>×</span>
              </span>
            ))}
          </div>
        )}
        <ChevronDown size={14} style={{ flexShrink: 0, opacity: 0.5 }} />
      </div>
      {open && (
        <>
          <div className="multi-select-backdrop" onClick={() => setOpen(false)} />
          <div className="multi-select-dropdown">
            {selected.length > 0 && (
              <div className="multi-select-clear" onClick={() => { onChange([]); setOpen(false); }}>
                Clear all
              </div>
            )}
            <div className="multi-select-options">
              {US_REGIONS.map(r => (
                <label key={r.name} className="multi-select-option">
                  <input
                    type="checkbox"
                    checked={selected.includes(r.name)}
                    onChange={() => toggle(r.name)}
                  />
                  <span>{r.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>{(regionCounts[r.name] || 0).toLocaleString()}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Sidebar({ weights, setWeights, filters, setFilters, companies, deals, owners }) {
  const handleSlider = (key, value) => {
    setWeights(prev => ({ ...prev, [key]: parseInt(value) }));
  };

  const handleFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Build owner list from dynamic owners prop, falling back to OWNER_MAP
  const ownerList = useMemo(() => {
    if (owners && owners.length > 0) {
      return owners.map(o => ({
        id: o.id,
        name: [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || `Owner ${o.id}`,
      })).sort((a, b) => a.name.localeCompare(b.name));
    }
    return Object.entries(OWNER_MAP).map(([id, name]) => ({ id, name }));
  }, [owners]);

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <h3>Score Weights</h3>
        {SLIDER_CONFIG.map(s => (
          <div key={s.key} className="slider-row">
            <span className="slider-label">{s.label}</span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              value={weights[s.key]}
              onChange={e => handleSlider(s.key, e.target.value)}
            />
            <span className="slider-value">{weights[s.key]}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-section">
        <h3>Filters</h3>

        <div className="filter-group">
          <div className="filter-label">Owner</div>
          <select value={filters.owner} onChange={e => handleFilter('owner', e.target.value)}>
            <option value="all">All Owners</option>
            {ownerList.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">Region</div>
          <MultiRegionSelect
            selected={filters.regions}
            onChange={val => {
              handleFilter('regions', val);
              // Clear state selections that are no longer in the active regions
              if (val.length > 0) {
                const validStates = new Set();
                val.forEach(rName => {
                  const region = US_REGIONS.find(r => r.name === rName);
                  if (region) region.states.forEach(s => validStates.add(s));
                });
                const cleaned = (filters.states || []).filter(s => validStates.has(s));
                if (cleaned.length !== (filters.states || []).length) {
                  handleFilter('states', cleaned);
                }
              }
            }}
            companies={companies}
          />
        </div>

        <div className="filter-group">
          <div className="filter-label">State</div>
          <MultiStateSelect
            selected={filters.states}
            onChange={val => handleFilter('states', val)}
            activeRegions={filters.regions}
          />
        </div>

        <div className="filter-group">
          <div className="filter-label">CRM System</div>
          <MultiCrmSelect
            selected={filters.crm}
            onChange={val => handleFilter('crm', val)}
            companies={companies}
          />
        </div>

        <div className="filter-group">
          <div className="filter-label">Tier</div>
          <select value={filters.tier} onChange={e => handleFilter('tier', e.target.value)}>
            <option value="all">All Tiers</option>
            <option value="A">Tier A</option>
            <option value="B">Tier B</option>
            <option value="C">Tier C</option>
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">Lead Status</div>
          <select value={filters.leadStatus} onChange={e => handleFilter('leadStatus', e.target.value)}>
            <option value="all">All</option>
            <option value="NEW">New</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="OPEN_DEAL">Open Deal</option>
            <option value="UNQUALIFIED">Unqualified</option>
            <option value="ATTEMPTED_TO_CONTACT">Attempted</option>
            <option value="CONNECTED">Connected</option>
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">Lifecycle Stage</div>
          <select value={filters.lifecycle} onChange={e => handleFilter('lifecycle', e.target.value)}>
            <option value="all">All</option>
            <option value="subscriber">Subscriber</option>
            <option value="lead">Lead</option>
            <option value="marketingqualifiedlead">MQL</option>
            <option value="salesqualifiedlead">SQL</option>
            <option value="opportunity">Opportunity</option>
            <option value="customer">Customer</option>
            <option value="evangelist">Evangelist</option>
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">ICP Tier</div>
          <select value={filters.icpTier} onChange={e => handleFilter('icpTier', e.target.value)}>
            <option value="all">All</option>
            <option value="tier_1">Tier 1</option>
            <option value="tier_2">Tier 2</option>
            <option value="tier_3">Tier 3</option>
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">Last Activity</div>
          <select value={filters.activity} onChange={e => handleFilter('activity', e.target.value)}>
            <option value="all">Any</option>
            <option value="active">Active (&lt;60d)</option>
            <option value="warm">Warm (60-119d)</option>
            <option value="cold">Cold (120d+)</option>
            <option value="never">Never</option>
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">PE/Holding</div>
          <select value={filters.pe} onChange={e => handleFilter('pe', e.target.value)}>
            <option value="all">All</option>
            <option value="pe">PE Only</option>
            <option value="non-pe">Non-PE</option>
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">Min Employees</div>
          <input
            type="number"
            min="0"
            value={filters.minEmployees}
            onChange={e => handleFilter('minEmployees', e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <button className="export-btn" onClick={() => exportToExcel(companies, deals)}>
        <Download size={14} />
        Export Excel
      </button>
    </aside>
  );
}
