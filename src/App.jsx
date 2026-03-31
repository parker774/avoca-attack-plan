import { useState, useCallback } from 'react';
import { useAppData } from './hooks/useAppData.js';
import Header from './components/Header.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import RepSelector from './components/RepSelector.jsx';
import AttackPlan from './pages/AttackPlan.jsx';
import DealCommandCenter from './pages/DealCommandCenter.jsx';
import Toast from './components/Toast.jsx';
import './App.css';

function App() {
  const [appPhase, setAppPhase] = useState('splash'); // splash → repSelect → dashboard
  const [selectedRepIds, setSelectedRepIds] = useState([]);
  const [activeNav, setActiveNav] = useState('attack');

  // Data loads immediately on mount (during splash), filtered once reps are selected
  const data = useAppData(selectedRepIds);

  const handleSplashComplete = useCallback(() => {
    setAppPhase('repSelect');
  }, []);

  const handleRepSelect = useCallback((repIds) => {
    setSelectedRepIds(repIds);
    setAppPhase('dashboard');
  }, []);

  const handleChangeCowboys = useCallback(() => {
    setAppPhase('repSelect');
  }, []);

  // ── Splash Screen ──
  if (appPhase === 'splash') {
    return (
      <>
        <SplashScreen onComplete={handleSplashComplete} />
        <Toast toasts={data.toasts} />
      </>
    );
  }

  // ── Rep Selector ──
  if (appPhase === 'repSelect') {
    return (
      <>
        <RepSelector
          owners={data.owners}
          onSelect={handleRepSelect}
          loading={data.loading.companies || data.loading.deals}
        />
        <Toast toasts={data.toasts} />
      </>
    );
  }

  // ── Dashboard ──
  return (
    <>
      <Header
        lastRefresh={data.lastRefresh}
        refreshing={data.refreshing}
        onRefresh={data.handleRefresh}
        companies={data.companies}
        openDeals={data.openDeals}
        rawCalls={data.rawCalls}
        pipelineStats={data.pipelineStats}
        selectedRepIds={selectedRepIds}
        owners={data.owners}
        onChangeCowboys={handleChangeCowboys}
        onCallsUpdated={data.setRawCalls}
        addToast={data.addToast}
      />

      <nav className="nav-tabs">
        <button
          className={`nav-tab ${activeNav === 'attack' ? 'active' : ''}`}
          onClick={() => setActiveNav('attack')}
        >
          ATTACK PLAN
        </button>
        <button
          className={`nav-tab ${activeNav === 'deals' ? 'active' : ''}`}
          onClick={() => setActiveNav('deals')}
        >
          DEAL COMMAND CENTER
        </button>
      </nav>

      {activeNav === 'attack' ? (
        <AttackPlan
          companies={data.companies}
          deals={data.deals}
          rawCalls={data.rawCalls}
          owners={data.owners}
          weights={data.weights}
          setWeights={data.setWeights}
          loading={data.loading}
          addToast={data.addToast}
        />
      ) : (
        <DealCommandCenter
          openDeals={data.openDeals}
          closedLostDeals={data.closedLostDeals}
          deals={data.deals}
          rawCalls={data.rawCalls}
          pipelineStats={data.pipelineStats}
          loading={data.loading}
          addToast={data.addToast}
          owners={data.owners}
          selectedRepIds={selectedRepIds}
        />
      )}

      <Toast toasts={data.toasts} />
    </>
  );
}

export default App;
