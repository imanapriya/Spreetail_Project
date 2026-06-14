"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/anomalies')
      .then(res => res.json())
      .then(data => {
        setAnomalies(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="container"><h1 className="title">Loading...</h1></div>;

  return (
    <div className="container animate-fade-in">
      <Link href="/" className="btn btn-outline" style={{marginBottom: '2rem'}}>← Back to Dashboard</Link>
      <h1 className="title">Import Report</h1>
      <p className="subtitle" style={{marginBottom: '2rem'}}>Log of all data anomalies detected in the CSV and actions taken by the ingestion engine.</p>
      
      <div className="glass-card">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Description</th>
              <th>Action Taken</th>
              <th>Raw Row Data</th>
            </tr>
          </thead>
          <tbody>
            {anomalies.map((a, i) => (
              <tr key={a.id} className={`delay-${i % 3}`}>
                <td style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>{new Date(a.createdAt).toLocaleString()}</td>
                <td style={{color: 'var(--accent)'}}>{a.description}</td>
                <td style={{color: 'var(--success)'}}>{a.actionTaken}</td>
                <td style={{fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)'}}>{a.rowData}</td>
              </tr>
            ))}
            {anomalies.length === 0 && (
              <tr>
                <td colSpan={4} style={{textAlign: 'center'}}>No anomalies detected!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
