import React from 'react';
import { ShieldAlert, BarChart3, Settings } from 'lucide-react';

export default function Landing({ onStart }) {
  return (
    <div className="animate-fade-in" style={{ padding: '80px 20px', textAlign: 'center', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '4rem', fontWeight: '700', marginBottom: '20px' }} className="text-gradient">
          Make AI Fair Before It Harms.
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>
          Instantly detect, measure, and mitigate bias in your datasets and ML models with our 100% free tool.
        </p>
      </div>

      <button className="btn-primary" onClick={onStart} style={{ fontSize: '1.1rem', padding: '16px 32px' }}>
        Start Free Audit
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginTop: '80px', textAlign: 'left' }}>
        <div className="glass-panel">
          <ShieldAlert size={32} color="var(--primary)" style={{ marginBottom: '16px' }} />
          <h3 style={{ marginBottom: '12px', fontSize: '1.25rem' }}>1. Upload & Detect</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>Upload your dataset (CSV) safely. Our AI automatically scans for sensitive attributes like gender or race.</p>
        </div>
        <div className="glass-panel">
          <BarChart3 size={32} color="var(--accent)" style={{ marginBottom: '16px' }} />
          <h3 style={{ marginBottom: '12px', fontSize: '1.25rem' }}>2. Measure Bias</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>Calculate demographic parity, equal opportunity, and disparate impact ratios across your demographic groups.</p>
        </div>
        <div className="glass-panel">
          <Settings size={32} color="var(--secondary)" style={{ marginBottom: '16px' }} />
          <h3 style={{ marginBottom: '12px', fontSize: '1.25rem' }}>3. Fix & Report</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>Get an AI-generated Bias Report with specific fix recommendations to build fair and transparent systems.</p>
        </div>
      </div>
    </div>
  );
}
