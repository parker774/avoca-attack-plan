import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchCompanies, fetchDeals, fetchCalls, fetchOwners, refreshAll } from '../utils/api.js';
import { enrichCompany, isInTerritory } from '../utils/scoring.js';
import { DEFAULT_WEIGHTS, DEAL_STAGE_MAP, OWNER_MAP, setOwnerMap } from '../utils/constants.js';

export function useAppData(selectedRepIds = []) {
  const [rawCompanies, setRawCompanies] = useState([]);
  const [rawDeals, setRawDeals] = useState([]);
  const [rawCalls, setRawCalls] = useState([]);
  const [owners, setOwners] = useState([]);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [loading, setLoading] = useState({ companies: true, deals: true, calls: true });
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const loadData = useCallback(async (refresh = false) => {
    try {
      setLoading({ companies: true, deals: true, calls: true });

      // Load owners FIRST (instant) so rep selector shows immediately
      try {
        const ownerData = await fetchOwners();
        if (ownerData.owners) {
          setOwners(ownerData.owners);
          setOwnerMap(ownerData.owners);
        }
      } catch (err) {
        console.warn('Failed to load owners:', err.message);
      }

      // Then load the heavy data in parallel
      const [compData, dealData, callData] = await Promise.allSettled([
        fetchCompanies(refresh),
        fetchDeals(refresh),
        fetchCalls(refresh),
      ]);

      if (compData.status === 'fulfilled') {
        setRawCompanies(compData.value.companies || []);
        if (compData.value.lastRefresh) setLastRefresh(compData.value.lastRefresh);
      } else {
        addToast('Failed to load companies: ' + compData.reason?.message);
      }

      if (dealData.status === 'fulfilled') {
        setRawDeals(dealData.value.deals || []);
      } else {
        addToast('Failed to load deals: ' + dealData.reason?.message);
      }

      if (callData.status === 'fulfilled') {
        setRawCalls(callData.value.calls || []);
      } else {
        console.warn('Calls not loaded:', callData.reason?.message);
      }
    } finally {
      setLoading({ companies: false, deals: false, calls: false });
    }
  }, [addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData(true);
      addToast('Data refreshed successfully', 'success');
    } finally {
      setRefreshing(false);
    }
  }, [loadData, addToast]);

  // Create a set for fast lookups
  const repIdSet = useMemo(() => new Set(selectedRepIds), [selectedRepIds]);
  const hasRepFilter = repIdSet.size > 0;

  // Build deals map by company ID for scoring
  const dealsMap = useMemo(() => {
    const map = {};
    rawDeals.forEach(d => {
      const companyId = d.associations?.companies?.results?.[0]?.id;
      if (companyId) {
        if (!map[companyId]) map[companyId] = [];
        map[companyId].push(d);
      }
    });
    return map;
  }, [rawDeals]);

  // Enriched + territory-filtered companies, then filtered by selected reps
  const companies = useMemo(() => {
    let result = rawCompanies
      .map(c => enrichCompany(c, weights, dealsMap))
      .filter(c => c.inTerritory)
      .sort((a, b) => b.score - a.score);

    if (hasRepFilter) {
      result = result.filter(c => repIdSet.has(c.hubspot_owner_id));
    }

    return result;
  }, [rawCompanies, weights, dealsMap, hasRepFilter, repIdSet]);

  // Enriched deals with stage info, then filtered by selected reps
  const deals = useMemo(() => {
    let result = rawDeals.map(d => {
      const props = d.properties || d;
      const stageInfo = DEAL_STAGE_MAP[props.dealstage] || { name: props.dealstage, probability: 0 };
      const createDate = props.createdate ? new Date(props.createdate) : null;
      const closeDate = props.closedate ? new Date(props.closedate) : null;
      const now = new Date();
      const daysInStage = props.hs_lastmodifieddate
        ? Math.floor((now - new Date(props.hs_lastmodifieddate)) / (1000 * 60 * 60 * 24))
        : null;
      const daysSinceCreate = createDate ? Math.floor((now - createDate) / (1000 * 60 * 60 * 24)) : null;
      const daysToClose = closeDate ? Math.floor((closeDate - now) / (1000 * 60 * 60 * 24)) : null;

      return {
        id: d.id,
        ...props,
        stageName: stageInfo.name,
        probability: stageInfo.probability,
        daysInStage,
        daysSinceCreate,
        daysToClose,
      };
    });

    if (hasRepFilter) {
      result = result.filter(d => repIdSet.has(d.hubspot_owner_id));
    }

    return result;
  }, [rawDeals, hasRepFilter, repIdSet]);

  const openDeals = useMemo(() =>
    deals.filter(d => d.dealstage !== 'closedwon' && d.dealstage !== 'closedlost'),
    [deals]
  );

  const closedLostDeals = useMemo(() =>
    deals.filter(d => d.dealstage === 'closedlost')
      .sort((a, b) => new Date(b.closedate || 0) - new Date(a.closedate || 0)),
    [deals]
  );

  // Pipeline stats
  const pipelineStats = useMemo(() => {
    const total = openDeals.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    const weighted = openDeals.reduce((sum, d) =>
      sum + (parseFloat(d.amount) || 0) * (d.probability || 0), 0
    );
    const now = new Date();
    const thisMonth = openDeals.filter(d => {
      if (!d.closedate) return false;
      const cd = new Date(d.closedate);
      return cd.getMonth() === now.getMonth() && cd.getFullYear() === now.getFullYear();
    });
    const closedWonMTD = deals.filter(d => {
      if (d.dealstage !== 'closedwon' || !d.closedate) return false;
      const cd = new Date(d.closedate);
      return cd.getMonth() === now.getMonth() && cd.getFullYear() === now.getFullYear();
    }).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

    const noAmount = openDeals.filter(d => !d.amount || parseFloat(d.amount) === 0).length;
    const noRecentCall = openDeals.filter(d => {
      // Placeholder: we'd check Attention call dates per deal
      return false;
    }).length;

    return { total, weighted, closingThisMonth: thisMonth.length, closedWonMTD, noAmount, noRecentCall };
  }, [openDeals, deals]);

  return {
    companies,
    deals,
    openDeals,
    closedLostDeals,
    rawCalls,
    setRawCalls,
    owners,
    weights,
    setWeights,
    loading,
    lastRefresh,
    refreshing,
    handleRefresh,
    toasts,
    addToast,
    pipelineStats,
    dealsMap,
  };
}
