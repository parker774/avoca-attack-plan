import { useState, useEffect } from 'react';
import { X, Loader2, Printer } from 'lucide-react';
import { generateBrief } from '../utils/api.js';

export default function BriefModal({ company, calls, deal, onClose }) {
  const [brief, setBrief] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const callData = (calls || []).map(c => ({
          date: c.date || c.created_at,
          score: c.score || c.scorecard_score,
          summary: c.summary,
          objection: c.objection || c.main_objection,
          nextStep: c.next_step || c.agreed_next_step,
          actionItems: c.action_items || c.actionItems,
        }));

        const result = await generateBrief(company, callData, deal);
        setBrief(result.brief);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [company, calls, deal]);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Pre-Call Brief: ${company.name}</title>
      <style>body{font-family:Inter,sans-serif;max-width:700px;margin:40px auto;line-height:1.7;color:#1a1a1a;}
      h1{font-size:20px;} pre{white-space:pre-wrap;font-family:Inter,sans-serif;}</style></head>
      <body><h1>Pre-Call Brief: ${company.name}</h1><pre>${brief}</pre></body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div className="modal-title">Pre-Call Brief: {company.name}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {brief && (
              <button className="btn btn-ghost btn-sm" onClick={handlePrint}>
                <Printer size={14} /> Print
              </button>
            )}
            <button className="side-panel-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="no-data">
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
            <div>Generating brief with Claude...</div>
          </div>
        ) : error ? (
          <div className="no-data">
            <div style={{ color: 'var(--red)' }}>Error: {error}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Make sure your ANTHROPIC_API_KEY is set in .env
            </div>
          </div>
        ) : (
          <div className="brief-content">{brief}</div>
        )}
      </div>
    </div>
  );
}
