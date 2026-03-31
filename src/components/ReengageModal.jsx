import { useState, useEffect } from 'react';
import { X, Loader2, Copy, Check } from 'lucide-react';
import { generateReengageEmail } from '../utils/api.js';

export default function ReengageModal({ company, lastCallDaysAgo, objection, nextStep, onClose }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const result = await generateReengageEmail(
          company,
          lastCallDaysAgo || 'unknown',
          objection || 'not recorded',
          nextStep || 'not recorded'
        );
        setEmail(result.email);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [company, lastCallDaysAgo, objection, nextStep]);

  const handleCopy = () => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div className="modal-title">Re-Engagement Email: {company}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {email && (
              <button className="btn btn-primary btn-sm" onClick={handleCopy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
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
            <div>Generating email with Claude...</div>
          </div>
        ) : error ? (
          <div className="no-data">
            <div style={{ color: 'var(--red)' }}>Error: {error}</div>
          </div>
        ) : (
          <div style={{
            background: 'var(--bg-dark)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 20,
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
          }}>
            {email}
          </div>
        )}
      </div>
    </div>
  );
}
