import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, Info, Loader2 } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const severityScale = [
  { label: 'Fair', min: 0.9, color: '#22c55e' },
  { label: 'Caution', min: 0.8, color: '#f59e0b' },
  { label: 'High Bias', min: 0.6, color: '#f97316' },
  { label: 'Critical Bias', min: -1, color: '#ef4444' }
];

const getSeverity = (ratio) => {
  if (ratio >= 0.9) return severityScale[0];
  if (ratio >= 0.8) return severityScale[1];
  if (ratio >= 0.6) return severityScale[2];
  return severityScale[3];
};

const statusColor = (status) => (status === 'PASS' ? 'var(--success)' : 'var(--danger)');

export default function MetricsDashboard({ metricsData, onRestart, auditHistory = [] }) {
  if (!metricsData) return null;

  const metrics = metricsData.metrics || {};
  const compliance = metricsData.compliance || {};
  const intersectional = metricsData.intersectional || {};
  const attributes = Object.keys(metrics);

  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportMarkdown, setReportMarkdown] = useState('');
  const [counterfactualLoading, setCounterfactualLoading] = useState(false);
  const [counterfactualError, setCounterfactualError] = useState('');
  const [counterfactualRows, setCounterfactualRows] = useState([]);
  const [showIntersectional, setShowIntersectional] = useState(false);
  const [aiHealth, setAiHealth] = useState({ status: 'checking', reason: '' });

  const hasIntersectional = useMemo(
    () => Object.keys(intersectional).length > 0,
    [intersectional]
  );

  useEffect(() => {
    let mounted = true;
    const loadHealth = async () => {
      try {
        const res = await axios.get('http://localhost:8000/ai-health');
        if (mounted) {
          setAiHealth({
            status: res.data?.status || 'degraded',
            reason: res.data?.reason || ''
          });
        }
      } catch (err) {
        if (mounted) {
          setAiHealth({
            status: 'degraded',
            reason: 'Unable to check AI service health.'
          });
        }
      }
    };
    loadHealth();
    return () => {
      mounted = false;
    };
  }, []);

  const handleGenerateReport = async () => {
    setReportLoading(true);
    setReportError('');
    try {
      const res = await axios.post('http://localhost:8000/report', metrics);
      setReportMarkdown(res.data.report || 'No report content returned.');
    } catch (err) {
      setReportError(err?.response?.data?.error || err.message || 'Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  };

  const handleCounterfactual = async () => {
    if (!metricsData.file) {
      setCounterfactualError('Original file not available for this session.');
      return;
    }
    setCounterfactualLoading(true);
    setCounterfactualError('');
    try {
      const formData = new FormData();
      formData.append('file', metricsData.file);
      const sensitive = (metricsData.sensitiveCols || []).join(',');
      const res = await axios.post(
        `http://localhost:8000/counterfactual?outcome_col=${encodeURIComponent(metricsData.outcomeCol)}&sensitive_cols=${encodeURIComponent(sensitive)}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      if (res.data.error) {
        setCounterfactualError(res.data.error);
        setCounterfactualRows([]);
      } else {
        setCounterfactualRows(res.data.counterfactuals || []);
      }
    } catch (err) {
      setCounterfactualError(err?.response?.data?.error || err.message || 'Failed to run counterfactual analysis');
    } finally {
      setCounterfactualLoading(false);
    }
  };

  const exportPdf = () => window.print();

  return (
    <div className="animate-fade-in fairlens-report-root" style={{ padding: '40px 20px', maxWidth: '1100px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', gap: '16px' }} className="no-print">
         <button onClick={onRestart} className="btn-secondary" style={{ padding: '8px 16px' }}><ArrowLeft size={16} /> Back</button>
         <h1 style={{ fontSize: '2rem', flex: 1 }}>FairLens Bias Audit Report</h1>
         <button className="btn-secondary" style={{ padding: '10px 16px' }} onClick={exportPdf}>Export PDF</button>
      </div>

      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px' }}>Severity Legend</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {severityScale.map((item) => (
            <span key={item.label} className="badge" style={{ borderColor: item.color, color: item.color }}>
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '10px' }}>AI Service Status</h3>
        <div>
          {aiHealth.status === 'ok' ? (
            <span className="badge green">Gemini Connected</span>
          ) : aiHealth.status === 'checking' ? (
            <span className="badge yellow">Checking...</span>
          ) : (
            <span className="badge red">Degraded (fallback mode)</span>
          )}
        </div>
        {aiHealth.reason && (
          <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            {aiHealth.reason}
          </p>
        )}
      </div>

      {auditHistory.length > 0 && (
        <div className="glass-panel" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '12px' }}>Audit History</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ paddingBottom: '8px' }}>Filename</th>
                <th style={{ paddingBottom: '8px' }}>Date</th>
                <th style={{ paddingBottom: '8px' }}>Worst DI</th>
                <th style={{ paddingBottom: '8px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {auditHistory.map((item, idx) => {
                const worst = item.summary?.worst_di_ratio;
                const sev = worst == null ? severityScale[0] : getSeverity(worst);
                return (
                  <tr key={`${item.timestamp}-${idx}`} style={{ borderTop: '1px solid var(--surface-border)' }}>
                    <td style={{ padding: '8px 0' }}>{item.filename}</td>
                    <td>{new Date(item.timestamp).toLocaleString()}</td>
                    <td>{worst == null ? 'N/A' : worst.toFixed(3)}</td>
                    <td style={{ color: sev.color, fontWeight: 600 }}>{sev.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {Object.keys(compliance).length > 0 && (
        <div className="glass-panel" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '14px' }}>Compliance Status</h3>
          {Object.entries(compliance).map(([attr, standards]) => (
            <div key={attr} style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '10px' }}>{attr}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                {Object.entries(standards).map(([name, result]) => (
                  <div key={name} style={{ border: `1px solid ${statusColor(result.status)}`, borderRadius: '10px', padding: '10px', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ fontSize: '0.9rem', marginBottom: '6px' }}>{name}</div>
                    <div style={{ color: statusColor(result.status), fontWeight: 700, marginBottom: '4px' }}>{result.status}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      DI {result.min_di_ratio} vs {result.threshold}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {attributes.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <h3>No suitable combinations found to calculate metrics.</h3>
        </div>
      ) : (
        attributes.map(attr => {
          const data = metrics[attr];
          const diValues = Object.values(data.disparate_impact || {});
          const minDi = diValues.length ? Math.min(...diValues) : 1;
          const severity = getSeverity(minDi);
          const pValue = data.chi_squared?.p_value;
          const significant = data.chi_squared?.significant;

          // Prepare chart data
          const chartData = {
            labels: Object.keys(data.demographic_parity),
            datasets: [
              {
                label: 'Positive Outcome Rate',
                data: Object.values(data.demographic_parity).map(v => v * 100),
                backgroundColor: 'rgba(139, 92, 246, 0.7)',
                borderColor: 'rgba(139, 92, 246, 1)',
                borderWidth: 1,
                borderRadius: 4
              }
            ]
          };

          const chartOptions = {
            responsive: true,
            plugins: {
              legend: { display: false },
              title: { display: false }
            },
             scales: {
              y: { 
                 beginAtZero: true, 
                 max: 100, 
                 ticks: { color: '#94a3b8', callback: (value) => value + '%' },
                 grid: { color: 'rgba(255,255,255,0.1)' }
              },
              x: {
                 ticks: { color: '#94a3b8' },
                 grid: { display: false }
              }
            }
          };

          return (
            <div key={attr} className="glass-panel" style={{ marginBottom: '32px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: '400' }}>Attribute:</span> {attr}
                  </h2>
                  <div className="badge" style={{ padding: '8px 16px', fontSize: '1rem', borderColor: severity.color, color: severity.color }}>
                    {severity.label}
                  </div>
               </div>
               <div style={{ marginBottom: '18px', fontSize: '0.9rem', color: significant ? 'var(--danger)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                 {pValue == null ? 'Statistical significance unavailable' : significant ? `Statistically significant bias (p=${pValue})` : `Not statistically significant (p=${pValue})`}
                 <span title="A p-value below 0.05 means the bias is unlikely due to random chance."><Info size={14} /></span>
               </div>

               <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1.5fr', gap: '32px' }}>
                  {/* Metrics Summary */}
                  <div>
                    <h3 style={{ marginBottom: '16px', fontSize: '1.2rem' }}>Metrics overview</h3>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                       {Object.entries(data.disparate_impact || {}).map(([group, ratio]) => {
                          const groupSeverity = getSeverity(ratio);
                          const groupSize = data.group_sizes?.[group];
                          return (
                            <li key={group} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', borderLeft: `4px solid ${groupSeverity.color}` }}>
                              <div>
                                <strong style={{ display: 'block', fontSize: '1.1rem' }}>
                                  Group: {group} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 400 }}>(n={groupSize ?? 0})</span>
                                </strong>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Disparate Impact Ratio</span>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: '600', color: groupSeverity.color }}>
                                  {ratio.toFixed(2)}
                                </div>
                                <span style={{ fontSize: '0.75rem', color: groupSeverity.color }}>{groupSeverity.label}</span>
                              </div>
                            </li>
                          )
                       })}
                    </ul>
                  </div>

                  {/* Chart */}
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
                     <h3 style={{ marginBottom: '16px', fontSize: '1rem', color: 'var(--text-muted)' }}>Demographic Parity (Positive Outcome %)</h3>
                     <Bar data={chartData} options={chartOptions} />
                  </div>
               </div>
            </div>
          );
        })
      )}

      {attributes.length > 0 && (
         <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '40px' }} className="no-print">
            <button className="btn-primary" style={{ padding: '16px 32px' }} onClick={handleGenerateReport} disabled={reportLoading}>
               {reportLoading ? <><Loader2 size={16} className="spin" /> Generating...</> : 'Generate AI Report'}
            </button>
            <button className="btn-secondary" style={{ padding: '16px 32px' }} onClick={handleCounterfactual} disabled={counterfactualLoading}>
               {counterfactualLoading ? <><Loader2 size={16} className="spin" /> Running...</> : 'Run Counterfactual Analysis'}
            </button>
         </div>
      )}

      {(reportMarkdown || reportError) && (
        <div className="glass-panel" style={{ marginTop: '24px' }}>
          <h3 style={{ marginBottom: '12px' }}>AI Bias Report</h3>
          {reportError ? (
            <p style={{ color: 'var(--danger)' }}>{reportError}</p>
          ) : (
            <pre style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55, fontFamily: 'Outfit, sans-serif' }}>{reportMarkdown}</pre>
          )}
        </div>
      )}

      <div className="glass-panel" style={{ marginTop: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          Counterfactual Fairness
          <span title="This shows whether changing only the sensitive attribute would change the outcome — a key sign of individual-level discrimination.">
            <Info size={14} />
          </span>
        </h3>
        {counterfactualError && <p style={{ color: 'var(--danger)', marginBottom: '10px' }}>{counterfactualError}</p>}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
              <th style={{ paddingBottom: '8px' }}>Row #</th>
              <th style={{ paddingBottom: '8px' }}>Attribute Changed</th>
              <th style={{ paddingBottom: '8px' }}>Original Value → New Value</th>
              <th style={{ paddingBottom: '8px' }}>Original Decision</th>
              <th style={{ paddingBottom: '8px' }}>New Decision</th>
              <th style={{ paddingBottom: '8px' }}>Changed?</th>
            </tr>
          </thead>
          <tbody>
            {counterfactualRows.map((row, idx) => (
              <tr key={`${row.row_index}-${row.attribute}-${idx}`} style={{ borderTop: '1px solid var(--surface-border)' }}>
                <td style={{ padding: '8px 0' }}>{row.row_index}</td>
                <td>{row.attribute}</td>
                <td>{row.original_value} → {row.flipped_value}</td>
                <td>{row.original_prediction}</td>
                <td>{row.new_prediction}</td>
                <td>{row.decision_changed ? '✅' : '❌'}</td>
              </tr>
            ))}
            {!counterfactualRows.length && (
              <tr>
                <td colSpan="6" style={{ color: 'var(--text-muted)', paddingTop: '10px' }}>
                  Run analysis to see counterfactual fairness evidence.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasIntersectional && (
        <div className="glass-panel" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3>Intersectional Analysis</h3>
            <button className="btn-secondary no-print" style={{ padding: '8px 14px' }} onClick={() => setShowIntersectional((prev) => !prev)}>
              {showIntersectional ? 'Hide' : 'Show'}
            </button>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>
            Intersectional analysis reveals how multiple attributes compound bias — invisible when attributes are analyzed in isolation.
          </p>
          {showIntersectional && Object.entries(intersectional).map(([pair, data]) => {
            const iChart = {
              labels: Object.keys(data.demographic_parity || {}),
              datasets: [{
                label: 'Selection rate',
                data: Object.values(data.demographic_parity || {}).map((v) => v * 100),
                backgroundColor: 'rgba(6, 182, 212, 0.7)',
                borderColor: 'rgba(6, 182, 212, 1)',
                borderWidth: 1,
                borderRadius: 4
              }]
            };
            return (
              <div key={pair} style={{ marginBottom: '20px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '12px' }}>
                <h4 style={{ marginBottom: '10px' }}>{pair}</h4>
                <Bar
                  data={iChart}
                  options={{
                    indexAxis: 'y',
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { beginAtZero: true, max: 100, ticks: { color: '#94a3b8', callback: (v) => `${v}%` }, grid: { color: 'rgba(255,255,255,0.08)' } },
                      y: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
