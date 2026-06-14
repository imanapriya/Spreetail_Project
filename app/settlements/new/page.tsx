"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import '../../globals.css';

export default function NewSettlementPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Form fields
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [payerId, setPayerId] = useState('');
  const [payeeId, setPayeeId] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [groupsRes, usersRes] = await Promise.all([
          fetch('/api/groups'),
          fetch('/api/users')
        ]);
        const groupsData = await groupsRes.json();
        const usersData = await usersRes.json();

        if (Array.isArray(groupsData)) {
          setGroups(groupsData);
          if (groupsData.length > 0) setSelectedGroupId(groupsData[0].id);
        }
        if (Array.isArray(usersData)) {
          setAllUsers(usersData);
          if (usersData.length > 1) {
            setPayerId(usersData[0].id);
            setPayeeId(usersData[1].id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid repayment amount.');
      setSubmitting(false);
      return;
    }
    if (payerId === payeeId) {
      setError('Payer and Payee cannot be the same person.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId,
          payeeId,
          amount: parseFloat(amount),
          date,
          groupId: selectedGroupId
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record settlement');

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="container"><h1 className="title">Loading...</h1></div>;

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '600px' }}>
      <Link href="/" className="btn btn-outline" style={{ marginBottom: '2rem' }}>← Back to Dashboard</Link>
      
      <div className="glass-card" style={{ padding: '2.5rem' }}>
        <h1 className="title" style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>Record Settlement</h1>
        <p className="subtitle" style={{ marginBottom: '2rem' }}>Log a direct payback between roommates in a group</p>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Shared Group</label>
              {groups.length === 0 ? (
                <div style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>
                  No groups. <Link href="/groups" style={{ textDecoration: 'underline' }}>Create one</Link>
                </div>
              ) : (
                <select
                  value={selectedGroupId}
                  onChange={e => setSelectedGroupId(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.95rem' }}
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.95rem' }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Who Paid? (Debtor)</label>
              <select
                value={payerId}
                onChange={e => setPayerId(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '1rem' }}
              >
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Who Received? (Creditor)</label>
              <select
                value={payeeId}
                onChange={e => setPayeeId(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '1rem' }}
              >
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Amount Paid (₹)</label>
            <input
              type="number"
              step="any"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '1rem' }}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || groups.length === 0}
            style={{ width: '100%', marginTop: '1rem' }}
          >
            {submitting ? 'Recording Settlement...' : 'Record Settlement'}
          </button>
        </form>
      </div>
    </div>
  );
}
