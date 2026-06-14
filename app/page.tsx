"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import './globals.css';

export default function Home() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  useEffect(() => {
    fetch('/api/balances')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="container"><div className="header"><h1 className="title">Loading...</h1></div></div>;

  return (
    <div className="container">
      <header className="header animate-fade-in">
        <h1 className="title">Shared Expenses</h1>
        <p className="subtitle">Real-time balances and settlements for the flat</p>
        <div style={{ marginTop: '2rem' }}>
          <Link href="/anomalies" className="btn btn-outline">View Import Report</Link>
        </div>
      </header>

      <div className="grid grid-2 animate-fade-in delay-1">
        
        <div className="glass-card">
          <h2>Who Owes What (Net Balances)</h2>
          <p style={{color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem'}}>Aisha's Request: "One number per person. Who pays whom, how much, done."</p>
          <ul className="list">
            {data.breakdown.map((b: any) => (
              <li key={b.user} className="list-item" onClick={() => setSelectedUser(b)} style={{cursor: 'pointer'}}>
                <span style={{fontSize: '1.2rem'}}>{b.user}</span>
                <div style={{textAlign: 'right'}}>
                  <div className={`value ${b.netBalance > 0 ? 'positive' : b.netBalance < 0 ? 'negative' : ''}`}>
                    {b.netBalance > 0 ? `Owes ₹${b.netBalance}` : b.netBalance < 0 ? `Gets back ₹${Math.abs(b.netBalance)}` : 'Settled up'}
                  </div>
                  <div style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem'}}>Click for breakdown</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-card animate-fade-in delay-2">
          <h2>Suggested Settlements</h2>
          <ul className="list">
            {data.transactions.length === 0 ? (
              <li className="list-item">Everyone is settled up!</li>
            ) : (
              data.transactions.map((t: any, i: number) => (
                <li key={i} className="list-item">
                  <span><strong>{t.from}</strong> pays <strong>{t.to}</strong></span>
                  <span className="value pill">₹{t.amount}</span>
                </li>
              ))
            )}
          </ul>
        </div>

      </div>

      {/* Breakdown Modal - Rohan's Request */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedUser(null)}>×</button>
            <h2>{selectedUser.user}'s Expense Breakdown</h2>
            <p style={{color: 'var(--text-muted)', marginBottom: '1rem'}}>Rohan's Request: "No magic numbers. If the app says I owe ₹2,300, I want to see exactly which expenses make that up."</p>
            
            <div style={{marginBottom: '2rem'}}>
              <h3>Paid For Group (Total: ₹{Math.round(selectedUser.totalPaid*100)/100})</h3>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedUser.expenses.map((e: any) => (
                    <tr key={e.id}>
                      <td>{new Date(e.date).toLocaleDateString()}</td>
                      <td>{e.description}</td>
                      <td>₹{e.amount}</td>
                    </tr>
                  ))}
                  {selectedUser.expenses.length === 0 && <tr><td colSpan={3}>Nothing paid.</td></tr>}
                </tbody>
              </table>
            </div>

            <div style={{marginBottom: '2rem'}}>
              <h3>Their Share (Total Owed: ₹{Math.round(selectedUser.totalShareOwed*100)/100})</h3>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Their Share</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedUser.shares.map((e: any) => (
                    <tr key={e.id}>
                      <td>{new Date(e.date).toLocaleDateString()}</td>
                      <td>{e.description}</td>
                      <td>₹{Math.round(e.myShare*100)/100}</td>
                    </tr>
                  ))}
                  {selectedUser.shares.length === 0 && <tr><td colSpan={3}>No shares.</td></tr>}
                </tbody>
              </table>
            </div>

            <div style={{marginBottom: '2rem'}}>
              <h3>Settlements</h3>
              <p>Paid: ₹{selectedUser.settlementsPaid.reduce((sum: number, s: any) => sum + s.amount, 0)}</p>
              <p>Received: ₹{selectedUser.settlementsRcvd.reduce((sum: number, s: any) => sum + s.amount, 0)}</p>
            </div>
            
            <div style={{borderTop: '1px solid var(--border)', paddingTop: '1rem', textAlign: 'right'}}>
              <h3>Net Balance: <span className={`value ${selectedUser.netBalance > 0 ? 'positive' : selectedUser.netBalance < 0 ? 'negative' : ''}`}>{selectedUser.netBalance > 0 ? `Owes ₹${selectedUser.netBalance}` : selectedUser.netBalance < 0 ? `Gets back ₹${Math.abs(selectedUser.netBalance)}` : '₹0'}</span></h3>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
