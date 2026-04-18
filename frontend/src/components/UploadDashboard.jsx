import React, { useState, useRef } from 'react';
import axios from 'axios';
import { UploadCloud, CheckCircle, AlertCircle } from 'lucide-react';

export default function UploadDashboard({ onDatasetReady, onStartAnalysis, datasetData }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedOutcome, setSelectedOutcome] = useState('');
  const [selectedSensitive, setSelectedSensitive] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      handleUpload(selected);
    }
  };

  const handleUpload = async (fileToUpload) => {
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', fileToUpload);

    try {
      const res = await axios.post('http://localhost:8000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.error) {
        setError(res.data.error);
      } else {
        onDatasetReady(res.data);
        setSelectedOutcome(res.data.suggested_outcome);
        setSelectedSensitive(res.data.detected_attributes);
      }
    } catch (err) {
      setError(err.message || 'Error uploading file');
    } finally {
      setLoading(false);
    }
  };

  const toggleAttribute = (attr) => {
    if (selectedSensitive.includes(attr)) {
      setSelectedSensitive(selectedSensitive.filter(a => a !== attr));
    } else {
      setSelectedSensitive([...selectedSensitive, attr]);
    }
  };

  const handleAnalyze = async () => {
    if (!file || !selectedOutcome || selectedSensitive.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await axios.post(`http://localhost:8000/analyze?outcome_col=${selectedOutcome}&sensitive_cols=${selectedSensitive.join(',')}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data.error) {
        setError(res.data.error);
        setLoading(false);
      } else {
         onStartAnalysis({
           ...res.data,
           file,
           outcomeCol: selectedOutcome,
           sensitiveCols: selectedSensitive
         });
      }
    } catch (err) {
      setError(err.message || 'Error analyzing dataset');
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
      
      {!datasetData ? (
        <div 
          className="glass-panel" 
          style={{ textAlign: 'center', padding: '60px 20px', borderStyle: 'dashed', borderWidth: '2px', cursor: 'pointer' }}
          onClick={() => fileInputRef.current.click()}
        >
          <UploadCloud size={64} color="var(--primary)" style={{ marginBottom: '20px' }} />
          <h2 style={{ marginBottom: '12px' }}>Upload your Dataset</h2>
          <p style={{ color: 'var(--text-muted)' }}>Drag and drop or click to upload a CSV (max 10MB)</p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".csv" 
            style={{ display: 'none' }} 
          />
          {loading && <p style={{ marginTop: '20px', color: 'var(--accent)' }}>Uploading and parsing...</p>}
          {error && <div style={{ color: 'var(--danger)', marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><AlertCircle size={20} /> {error}</div>}
        </div>
      ) : (
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
             <h2><CheckCircle size={24} color="var(--success)" style={{ verticalAlign: 'middle', marginRight: '8px' }}/> Data Parsed Successfully</h2>
             <span className="badge">{datasetData.rows.toLocaleString()} rows</span>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '12px', fontSize: '1.1rem', color: 'var(--text-muted)' }}>Target Outcome Column</h3>
            <select 
              value={selectedOutcome} 
              onChange={(e) => setSelectedOutcome(e.target.value)}
              style={{ width: '100%', padding: '12px' }}
            >
              <option value="">Select an outcome column...</option>
              {datasetData.columns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ marginBottom: '12px', fontSize: '1.1rem', color: 'var(--text-muted)' }}>Sensitive Attributes 
              <span className="badge" style={{ marginLeft: '12px', background: 'rgba(6, 182, 212, 0.2)', color: 'var(--accent)', borderColor: 'rgba(6, 182, 212, 0.4)' }}>✨ AI Detected</span>
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Toggle the columns to test for bias:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {datasetData.columns.map(col => {
                const isSelected = selectedSensitive.includes(col);
                return (
                  <button 
                    key={col}
                    onClick={() => toggleAttribute(col)}
                    className={isSelected ? `btn-primary` : `btn-secondary`}
                    style={{ padding: '8px 16px', borderRadius: '30px', fontSize: '0.9rem', width: 'auto' }}
                  >
                    {col}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <div style={{ color: 'var(--danger)', marginBottom: '20px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}><AlertCircle size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }}/> {error}</div>}

          <div style={{ textAlign: 'center' }}>
            <button 
              className="btn-primary" 
              onClick={handleAnalyze} 
              disabled={loading || !selectedOutcome || selectedSensitive.length === 0}
              style={{ width: '100%', padding: '16px', fontSize: '1.1rem', justifyContent: 'center' }}
            >
              {loading ? 'Analyzing Bias...' : 'Run Fairness Audit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
