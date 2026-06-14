"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import '../../globals.css';

export default function NewExpensePage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<any[]>([]);

  // Form fields
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [payerId, setPayerId] = useState('');
  const [splitType, setSplitType] = useState('equal');
  
  // Splits values for members: { [userId]: value }
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [includedMembers, setIncludedMembers] = useState<Set<string>>(new Set());

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
          if (usersData.length > 0) setPayerId(usersData[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Fetch members when group changes
  useEffect(() => {
    if (!selectedGroupId) return;

    fetch(`/api/groups/${selectedGroupId}/members`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setGroupMembers(data);
        }
      })
      .catch(err => console.error(err));
  }, [selectedGroupId]);

  // Filter members in real-time based on selected date and their active timelines
  useEffect(() => {
    if (!date) return;
    const selectedDate = new Date(date);

    const filtered = groupMembers.filter(m => {
      // Find global user timeline limits if defined, or group membership limits
      const user = allUsers.find(u => u.id === m.id);
      if (user) {
        if (user.moveOutDate && selectedDate > new Date(user.moveOutDate)) return false;
        if (user.moveInDate && selectedDate < new Date(user.moveInDate)) return false;
      }

      // Check group-specific timeline limits
      if (m.joinedAt && selectedDate < new Date(m.joinedAt)) return false;
      if (m.leftAt && selectedDate > new Date(m.leftAt)) return false;

      return true;
    });

    setFilteredMembers(filtered);

    // Reset split inputs and selections
    const initialSplit: Record<string, string> = {};
    const initialIncluded = new Set<string>();

    filtered.forEach(m => {
      initialIncluded.add(m.id);
      if (splitType === 'equal') initialSplit[m.id] = '1';
      else if (splitType === 'percentage') initialSplit[m.id] = (100 / filtered.length).toFixed(1);
      else if (splitType === 'shares') initialSplit[m.id] = '1';
      else if (splitType === 'unequal') initialSplit[m.id] = '0';
    });

    setSplitValues(initialSplit);
    setIncludedMembers(initialIncluded);
  }, [groupMembers, date, splitType, allUsers]);

  const handleToggleInclude = (userId: string) => {
    setIncludedMembers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleValueChange = (userId: string, val: string) => {
    setSplitValues(prev => ({ ...prev, [userId]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (!desc.trim()) {
      setError('Description is required.');
      setSubmitting(false);
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid expense amount.');
      setSubmitting(false);
      return;
    }
    if (includedMembers.size === 0) {
      setError('At least one member must be selected for the split.');
      setSubmitting(false);
      return;
    }

    // Prepare shares array
    const sharesPayload = Array.from(includedMembers).map(userId => {
      const member = filteredMembers.find(m => m.id === userId);
      return {
        userId,
        userName: member?.name || '',
        value: parseFloat(splitValues[userId] || '0')
      };
    });

    // Verification check for percentages and unequal sums
    const numericAmount = parseFloat(amount);
    if (splitType === 'percentage') {
      const totalPct = sharesPayload.reduce((sum, s) => sum + s.value, 0);
      if (Math.abs(totalPct - 100) > 0.1) {
        setError(`Percentages must sum to 100%. Current sum: ${totalPct.toFixed(1)}%`);
        setSubmitting(false);
        return;
      }
    } else if (splitType === 'unequal') {
      const totalSum = sharesPayload.reduce((sum, s) => sum + s.value, 0);
      if (Math.abs(totalSum - numericAmount) > 0.01) {
        setError(`Individual shares (₹${totalSum.toFixed(2)}) must sum up to the total amount (₹${numericAmount.toFixed(2)}).`);
        setSubmitting(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: desc,
          amount: numericAmount,
          currency,
          date,
          payerId,
          groupId: selectedGroupId,
          splitType,
          shares: sharesPayload
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit expense');

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
    <div className="container animate-fade-in" style={{ maxWidth: '700px' }}>
      <Link href="/" className="btn btn-outline" style={{ marginBottom: '2rem' }}>← Back to Dashboard</Link>
      
      <div className="glass-card" style={{ padding: '2.5rem' }}>
        <h1 className="title" style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>Add Expense</h1>
        <p className="subtitle" style={{ marginBottom: '2rem' }}>Record a new expense split among roommate groups</p>

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

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Description</label>
            <input
              type="text"
              placeholder="e.g. Swiggy dinner, Electricity bill"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '1rem' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '1rem', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Total Amount</label>
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
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Currency</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '1rem' }}
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Who Paid?</label>
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
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Split Strategy</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['equal', 'percentage', 'shares', 'unequal'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSplitType(type)}
                  className={`btn ${splitType === type ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1, padding: '0.5rem 0.25rem', fontSize: '0.85rem' }}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Configure Split Beneficiaries</label>
            
            {filteredMembers.length === 0 ? (
              <div style={{ color: 'var(--accent)', fontSize: '0.85rem', padding: '1rem', background: 'rgba(0,0,0,0.1)', borderRadius: '6px' }}>
                No active group members found on this date. Please adjust the expense date or add members to the group.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                {filteredMembers.map(m => {
                  const isChecked = includedMembers.has(m.id);
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: isChecked ? 1 : 0.5 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleInclude(m.id)}
                        />
                        <strong>{m.name}</strong>
                      </label>

                      {isChecked && splitType !== 'equal' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="number"
                            step="any"
                            value={splitValues[m.id] || ''}
                            onChange={e => handleValueChange(m.id, e.target.value)}
                            style={{ width: '80px', padding: '0.3rem', borderRadius: '4px', background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text)', textAlign: 'right' }}
                            required
                          />
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {splitType === 'percentage' ? '%' : splitType === 'shares' ? 'share(s)' : '₹'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || filteredMembers.length === 0}
            style={{ width: '100%', marginTop: '1rem' }}
          >
            {submitting ? 'Creating Expense...' : 'Create Expense'}
          </button>
        </form>
      </div>
    </div>
  );
}
