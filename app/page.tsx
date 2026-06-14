"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import './globals.css';

export default function Home() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  
  const router = useRouter();

  // Load user session and balances
  const loadData = async (groupId?: string) => {
    try {
      // Load current user
      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const userData = await userRes.json();
        setCurrentUser(userData.user);
      } else {
        router.push('/login');
        return;
      }

      // Load balances scoped to group
      const url = groupId ? `/api/balances?groupId=${groupId}` : '/api/balances';
      const balancesRes = await fetch(url);
      const balancesData = await balancesRes.json();
      setData(balancesData);
      
      if (balancesData.selectedGroupId) {
        setSelectedGroupId(balancesData.selectedGroupId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGroupChange = (groupId: string) => {
    setLoading(true);
    setSelectedGroupId(groupId);
    loadData(groupId);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  if (loading) return <div className="container"><div className="header"><h1 className="title">Loading Dashboard...</h1></div></div>;

  const groups = data?.groups || [];
  const activeGroup = groups.find((g: any) => g.id === selectedGroupId);

  return (
    <div className="container animate-fade-in">
      <header className="header" style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ textAlign: 'left' }}>
          <h1 className="title" style={{ fontSize: '2.5rem', margin: 0 }}>Shared Expenses</h1>
          <p className="subtitle">Real-time balances and net settlements for roommates</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {currentUser && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Logged in as</div>
              <strong>{currentUser.name}</strong>
            </div>
          )}
          <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main navigation controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Active Group:</label>
          {groups.length === 0 ? (
            <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>No Billing Groups</span>
          ) : (
            <select
              value={selectedGroupId}
              onChange={e => handleGroupChange(e.target.value)}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '8px',
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid var(--border)',
                color: 'var(--primary)',
                fontWeight: '600',
                fontSize: '1rem',
                outline: 'none'
              }}
            >
              {groups.map((g: any) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href="/expenses/new" className="btn btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>+ Add Expense</Link>
          <Link href="/settlements/new" className="btn btn-outline" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>Record Payback</Link>
          <Link href="/groups" className="btn btn-outline" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>Manage Groups</Link>
          <Link href="/import" className="btn btn-outline" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', borderColor: 'var(--secondary)', color: 'var(--secondary)' }}>Import CSV</Link>
          <Link href="/anomalies" className="btn btn-outline" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>Import Report</Link>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="glass-card animate-fade-in" style={{ padding: '4rem', textAlign: 'center', maxWidth: '700px', margin: '0 auto' }}>
          <h2 style={{ borderBottom: 'none' }}>No billing groups configured</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem' }}>
            To start tracking expenses, you need to create a billing group or import the original flat spreadsheet.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
            <Link href="/groups" className="btn btn-primary">Create a Group</Link>
            <Link href="/import" className="btn btn-outline">Import expenses_export.csv</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-2 animate-fade-in delay-1">
          
          {/* Net Balances - Aisha's Request */}
          <div className="glass-card">
            <h2>Who Owes Whom ({activeGroup?.name})</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Aisha's Request: "I just want one number per person. Who pays whom, how much, done."
            </p>
            <ul className="list">
              {data.breakdown.length === 0 ? (
                <li className="list-item" style={{ color: 'var(--text-muted)' }}>No members in this group.</li>
              ) : (
                data.breakdown.map((b: any) => (
                  <li key={b.user} className="list-item" onClick={() => setSelectedUser(b)} style={{ cursor: 'pointer' }}>
                    <span style={{ fontSize: '1.2rem' }}>{b.user}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div className={`value ${b.netBalance > 0.01 ? 'positive' : b.netBalance < -0.01 ? 'negative' : ''}`}>
                        {b.netBalance > 0.01 ? `Owes ₹${b.netBalance.toFixed(2)}` : b.netBalance < -0.01 ? `Gets back ₹${Math.abs(b.netBalance).toFixed(2)}` : 'Settled up'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Click for breakdown</div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Suggested Settlements */}
          <div className="glass-card animate-fade-in delay-2">
            <h2>Suggested Debt Paybacks ({activeGroup?.name})</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Optimized direct transactions to settle all roommate debts.
            </p>
            <ul className="list">
              {data.transactions.length === 0 ? (
                <li className="list-item" style={{ color: 'var(--success)' }}>✓ Everyone is completely settled up!</li>
              ) : (
                data.transactions.map((t: any, i: number) => (
                  <li key={i} className="list-item">
                    <span><strong>{t.from}</strong> pays <strong>{t.to}</strong></span>
                    <span className="value pill" style={{ color: 'var(--primary)', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      ₹{t.amount.toFixed(2)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>

        </div>
      )}

      {/* Detailed breakdown modal (Rohan's Request) */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedUser(null)}>×</button>
            <h2>{selectedUser.user}'s Expense Audit Trail</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Rohan's Request: "No magic numbers. If the app says I owe ₹2,300, I want to see exactly which expenses make that up."
            </p>
            
            <div style={{ marginBottom: '2.5rem' }}>
              <h3>Expenses Paid by {selectedUser.user} (Total: ₹{selectedUser.totalPaid.toFixed(2)})</h3>
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
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
                        <td>
                          {e.originalAmt ? (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              ${e.originalAmt} (₹{e.amount})
                            </span>
                          ) : `₹${e.amount}`}
                        </td>
                      </tr>
                    ))}
                    {selectedUser.expenses.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Did not pay for any expenses.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginBottom: '2.5rem' }}>
              <h3>Their Share of Expenses (Total Owed: ₹{selectedUser.totalShareOwed.toFixed(2)})</h3>
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Total Expense</th>
                      <th>Their Split Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUser.shares.map((e: any) => (
                      <tr key={e.id}>
                        <td>{new Date(e.date).toLocaleDateString()}</td>
                        <td>{e.description}</td>
                        <td>₹{e.amount}</td>
                        <td><strong>₹{e.myShare.toFixed(2)}</strong></td>
                      </tr>
                    ))}
                    {selectedUser.shares.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No shared expenses.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h3>Settlement Records</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Direct Paybacks Sent</div>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--success)' }}>
                    ₹{selectedUser.settlementsPaid.reduce((sum: number, s: any) => sum + s.amount, 0).toFixed(2)}
                  </strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Direct Paybacks Received</div>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>
                    ₹{selectedUser.settlementsRcvd.reduce((sum: number, s: any) => sum + s.amount, 0).toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>
            
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Net Scoped Balance:</strong>
              <div className={`value ${selectedUser.netBalance > 0.01 ? 'positive' : selectedUser.netBalance < -0.01 ? 'negative' : ''}`} style={{ fontSize: '1.5rem' }}>
                {selectedUser.netBalance > 0.01 ? `Owes ₹${selectedUser.netBalance.toFixed(2)}` : selectedUser.netBalance < -0.01 ? `Gets back ₹${Math.abs(selectedUser.netBalance).toFixed(2)}` : 'Fully Settled Up'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

