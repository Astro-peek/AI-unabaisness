import React from 'react';
import { ArrowLeft, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function MetricsDashboard({ metricsData, onRestart }) {
  if (!metricsData) return null;

  const attributes = Object.keys(metricsData);

  return (
    <div className="animate-fade-in" style={{ padding: '40px 20px', maxWidth: '1000px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', gap: '16px' }}>
         <button onClick={onRestart} className="btn-secondary" style={{ padding: '8px 16px' }}><ArrowLeft size={16} /> Back</button>
         <h1 style={{ fontSize: '2rem', flex: 1 }}>Bias Analysis Report</h1>
      </div>

      {attributes.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <h3>No suitable combinations found to calculate metrics.</h3>
        </div>
      ) : (
        attributes.map(attr => {
          const data = metricsData[attr];
          const hasBias = Object.values(data.disparate_impact).some(val => val < 0.8 && val > 0);

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
                  {hasBias ? (
                     <div className="badge red" style={{ padding: '8px 16px', fontSize: '1rem' }}>
                        <AlertCircle size={16} style={{ verticalAlign: 'text-bottom', marginRight: '6px' }} /> Bias Detected
                     </div>
                  ) : (
                     <div className="badge green" style={{ padding: '8px 16px', fontSize: '1rem' }}>
                        <CheckCircle size={16} style={{ verticalAlign: 'text-bottom', marginRight: '6px' }} /> Seems Fair
                     </div>
                  )}
               </div>

               <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1.5fr', gap: '32px' }}>
                  {/* Metrics Summary */}
                  <div>
                    <h3 style={{ marginBottom: '16px', fontSize: '1.2rem' }}>Metrics overview</h3>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                       {Object.entries(data.disparate_impact).map(([group, ratio]) => {
                          const isLow = ratio < 0.8 && ratio > 0;
                          return (
                            <li key={group} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', borderLeft: isLow ? '4px solid var(--danger)' : '4px solid var(--success)' }}>
                              <div>
                                <strong style={{ display: 'block', fontSize: '1.1rem' }}>Group: {group}</strong>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Disparate Impact Ratio</span>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: '600', color: isLow ? 'var(--danger)' : 'var(--text-main)' }}>
                                  {ratio.toFixed(2)}
                                </div>
                                {isLow && <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>Below 0.8 Threshold</span>}
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
         <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '40px' }}>
            <button className="btn-primary" style={{ padding: '16px 32px' }}>
               Generate AI Report
            </button>
            <button className="btn-secondary" style={{ padding: '16px 32px' }}>
               Fix Bias
            </button>
         </div>
      )}

    </div>
  );
}
