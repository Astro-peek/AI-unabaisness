import React, { useState } from 'react';
import Landing from './components/Landing';
import UploadDashboard from './components/UploadDashboard';
import MetricsDashboard from './components/MetricsDashboard';

export default function App() {
  const [currentStep, setCurrentStep] = useState('landing'); // landing, upload, metrics
  const [datasetData, setDatasetData] = useState(null); 
  const [metricsData, setMetricsData] = useState(null); 

  return (
    <div className="app-container">
      {currentStep === 'landing' && <Landing onStart={() => setCurrentStep('upload')} />}
      
      {currentStep === 'upload' && (
        <UploadDashboard 
          onDatasetReady={(data) => setDatasetData(data)}
          onStartAnalysis={(data) => {
            setMetricsData(data);
            setCurrentStep('metrics');
          }}
          datasetData={datasetData}
        />
      )}
      
      {currentStep === 'metrics' && (
        <MetricsDashboard 
          metricsData={metricsData} 
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
