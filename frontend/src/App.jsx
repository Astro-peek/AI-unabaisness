import React, { useState } from 'react';
import Landing from './components/Landing';
import UploadDashboard from './components/UploadDashboard';
import MetricsDashboard from './components/MetricsDashboard';

export default function App() {
  const [currentStep, setCurrentStep] = useState('landing'); // landing, upload, metrics
  const [datasetData, setDatasetData] = useState(null); 
  const [metricsData, setMetricsData] = useState(null); 
  const [auditHistory, setAuditHistory] = useState([]);

  const buildSummary = (metrics = {}) => {
    const attributes = Object.values(metrics);
    if (!attributes.length) {
      return { worst_di_ratio: null, num_biased_attributes: 0 };
    }
    let worst = 1;
    let biased = 0;
    attributes.forEach((entry) => {
      const values = Object.values(entry.disparate_impact || {});
      if (!values.length) return;
      const minVal = Math.min(...values);
      worst = Math.min(worst, minVal);
      if (minVal < 0.8) biased += 1;
    });
    return {
      worst_di_ratio: Number.isFinite(worst) ? Number(worst.toFixed(3)) : null,
      num_biased_attributes: biased
    };
  };

  return (
    <div className="app-container">
      {currentStep === 'landing' && <Landing onStart={() => setCurrentStep('upload')} />}
      
      {currentStep === 'upload' && (
        <UploadDashboard 
          onDatasetReady={(data) => setDatasetData(data)}
          onStartAnalysis={(data) => {
            setMetricsData(data);
            setAuditHistory((prev) => [
              ...prev,
              {
                timestamp: new Date().toISOString(),
                filename: data?.file?.name || datasetData?.filename || "dataset.csv",
                summary: buildSummary(data?.metrics || {})
              }
            ]);
            setCurrentStep('metrics');
          }}
          datasetData={datasetData}
        />
      )}
      
      {currentStep === 'metrics' && (
        <MetricsDashboard 
          metricsData={metricsData} 
          auditHistory={auditHistory}
          onRestart={() => {
            setDatasetData(null);
            setMetricsData(null);
            setCurrentStep('upload');
          }}
        />
      )}
    </div>
  );
}
