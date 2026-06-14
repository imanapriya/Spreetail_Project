"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import '../globals.css';

export default function LoginPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUsers(data);
          if (data.length > 0) setSelectedUserId(data[0].id);
        }
      })
      .catch(err => console.error('Error fetching users:', err));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, passcode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to login');
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '1rem',
      backgroundImage: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.15) 0px, transparent 60%)'
    }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
        <h1 className="title" style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '0.5rem' }}>Roommates</h1>
        <p className="subtitle" style={{ textAlign: 'center', marginBottom: '2rem' }}>Select your profile to sign in</p>
        
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
            padding: '0.75rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Roommate</label>
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: '1rem',
                outline: 'none'
              }}
            >
              {users.map(u => (
                <option key={u.id} value={u.id} style={{ background: '#0f172a' }}>{u.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Passcode</label>
            <input
              type="password"
              placeholder="Enter 4-digit passcode"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              maxLength={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: '1rem',
                outline: 'none',
                textAlign: 'center',
                letterSpacing: '0.5em'
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem', textAlign: 'center' }}>
              Tip: The default passcode is <strong>1234</strong>
            </span>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
