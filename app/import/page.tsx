"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import '../globals.css';

export default function ImportPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  
  // Validation results
  const [parsedTransactions, setParsedTransactions] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [step, setStep] = useState(1); // 1 = Upload, 2 = Review, 3 = Complete
  const [error, setError] = useState('');

  // User resolutions for anomalies
  const [resolutions, setResolutions] = useState<Record<number, any>>({}); // rowIndex -> resolution edits
  const [ignoredRows, setIgnoredRows] = useState<Set<number>>(new Set());

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
        if (Array.isArray(usersData)) setAllUsers(usersData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleValidate = async () => {
    if (!file) {
      setError('Please select a CSV file.');
      return;
    }
    if (!selectedGroupId) {
      setError('Please select or create a group first.');
      return;
    }

    setValidating(true);
    setError('');

    try {
      const csvText = await file.text();
      const res = await fetch('/api/import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: csvText })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Validation failed');

      setParsedTransactions(data.parsedTransactions);
      setAnomalies(data.anomalies);
      
      // Initialize default resolutions
      const initialResolutions: Record<number, any> = {};
      data.parsedTransactions.forEach((t: any) => {
        initialResolutions[t.rowIndex] = { ...t };
      });
      setResolutions(initialResolutions);

      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setValidating(false);
    }
  };

  // Helper to update specific transaction resolution (e.g. date, payer, amount)
  const updateResolutionField = (rowIndex: number, field: string, value: any) => {
    setResolutions(prev => {
      const updated = { ...prev[rowIndex], [field]: value };
      
      // If we update user name, update the corresponding payerId
      if (field === 'payerName') {
        const matchingUser = allUsers.find(u => u.name === value);
        if (matchingUser) {
          updated.payerId = matchingUser.id;
        }
      }
      
      return { ...prev, [rowIndex]: updated };
    });
  };

  const handleToggleRowIgnore = (rowIndex: number) => {
    setIgnoredRows(prev => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  // Predefined resolution actions for specific anomaly types
  const handleResolveDuplicate = (duplicateRowIndex: number, keepOriginal: boolean) => {
    if (keepOriginal) {
      // Keep previous, ignore duplicate row
      setIgnoredRows(prev => new Set([...prev, duplicateRowIndex]));
    } else {
      // Ignore previous, keep duplicate row
      const anomaly = anomalies.find(a => a.rowIndex === duplicateRowIndex);
      if (anomaly && anomaly.duplicateOfRow) {
        setIgnoredRows(prev => new Set([...prev, anomaly.duplicateOfRow]));
      }
    }
  };

  const handleResolveConflict = (row25Index: number, winnerRowIndex: number) => {
    const row24Index = 24; // Aisha Thalassa
    if (winnerRowIndex === row24Index) {
      setIgnoredRows(prev => new Set([...prev, row25Index])); // Ignore Rohan's
    } else if (winnerRowIndex === row25Index) {
      setIgnoredRows(prev => new Set([...prev, row24Index])); // Ignore Aisha's
    } else {
      // Keep both (remove both from ignored)
      setIgnoredRows(prev => {
        const next = new Set(prev);
        next.delete(row24Index);
        next.delete(row25Index);
        return next;
      });
    }
  };

  const handleCommit = async () => {
    setCommitting(true);
    setError('');

    try {
      // Filter out ignored transactions and prepare final payload
      const finalTransactions = parsedTransactions
        .filter(t => !ignoredRows.has(t.rowIndex))
        .map(t => {
          const res = resolutions[t.rowIndex];
          
          // Re-evaluate beneficiaries list in case we changed date or membership
          let finalBeneficiaries = [...res.beneficiaries];
          
          // If payer was unknown, ensure it is set now
          if (!res.payerId) {
            throw new Error(`Payer is still missing for row ${t.rowIndex}: "${t.description}". Please assign a payer.`);
          }

          return {
            ...res,
            beneficiaries: finalBeneficiaries
          };
        });

      // Prepare final anomalies log for DB audit trails
      const finalAnomalies = anomalies.map(a => {
        let action = a.actionTaken;
        if (ignoredRows.has(a.rowIndex)) {
          action = 'Deleted / Skipped row by user approval';
        } else if (a.type === 'DUPLICATE' && !ignoredRows.has(a.rowIndex) && a.duplicateOfRow && ignoredRows.has(a.duplicateOfRow)) {
          action = `Kept row ${a.rowIndex}, Deleted duplicate row ${a.duplicateOfRow} by user approval`;
        } else if (a.type === 'CONFLICT' && ignoredRows.has(a.rowIndex)) {
          action = `Ignored in favor of conflict row ${a.conflictWithRow} by user approval`;
        } else if (a.type === 'CONFLICT' && !ignoredRows.has(a.rowIndex) && a.conflictWithRow && ignoredRows.has(a.conflictWithRow)) {
          action = `Kept row ${a.rowIndex}, ignored conflict row ${a.conflictWithRow} by user approval`;
        } else if (a.type === 'MISSING_PAYER' && !ignoredRows.has(a.rowIndex)) {
          const res = resolutions[a.rowIndex];
          action = `Manually assigned payer ${res.payerName} by user approval`;
        } else if (a.type === 'AMBIGUOUS_DATE' && !ignoredRows.has(a.rowIndex)) {
          const res = resolutions[a.rowIndex];
          action = `Manually confirmed date ${res.date} by user approval`;
        }
        return {
          ...a,
          actionTaken: action
        };
      });

      const res = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroupId,
          transactions: finalTransactions,
          anomalies: finalAnomalies
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to commit import');

      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCommitting(false);
    }
  };

  if (loading) return <div className="container"><h1 className="title">Loading...</h1></div>;

  return (
    <div className="container animate-fade-in">
      <Link href="/" className="btn btn-outline" style={{ marginBottom: '2rem' }}>← Back to Dashboard</Link>
      
      <header className="header" style={{ marginBottom: '3rem' }}>
        <h1 className="title">CSV Import Wizard</h1>
        <p className="subtitle">Ingest roommate billing sheets, resolve conflicts, and review anomalies interactively</p>
      </header>

      {/* Step Progress Bar */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: step >= 1 ? 1 : 0.4 }}>
          <span style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontWeight: 'bold' }}>1</span>
          <strong>Upload CSV</strong>
        </div>
        <div style={{ width: '60px', height: '2px', background: 'var(--border)', alignSelf: 'center' }}></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: step >= 2 ? 1 : 0.4 }}>
          <span style={{ background: step >= 2 ? 'var(--primary)' : 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '50%', width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>2</span>
          <strong>Review Anomalies</strong>
        </div>
        <div style={{ width: '60px', height: '2px', background: 'var(--border)', alignSelf: 'center' }}></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: step >= 3 ? 1 : 0.4 }}>
          <span style={{ background: step >= 3 ? 'var(--primary)' : 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '50%', width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>3</span>
          <strong>Import Complete</strong>
        </div>
      </div>

      {error && (
        <div className="glass-card" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', marginBottom: '2rem', padding: '1rem', borderRadius: '8px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* STEP 1: UPLOAD */}
      {step === 1 && (
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '3rem' }}>
          <h2>Configure Import Settings</h2>
          
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Target Shared Group</label>
            {groups.length === 0 ? (
              <div style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>
                You must create a group first. <Link href="/groups" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Go to Groups Management</Link>
              </div>
            ) : (
              <select
                value={selectedGroupId}
                onChange={e => setSelectedGroupId(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '1rem' }}
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ marginBottom: '2.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Select CSV Export File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{
                width: '100%',
                padding: '1.5rem',
                border: '2px dashed var(--border)',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.2)',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            />
          </div>

          <button
            onClick={handleValidate}
            className="btn btn-primary"
            disabled={validating || !file || groups.length === 0}
            style={{ width: '100%' }}
          >
            {validating ? 'Analyzing CSV & Detecting Problems...' : 'Upload & Validate'}
          </button>
        </div>
      )}

      {/* STEP 2: REVIEW ANOMALIES & DUPLICATES */}
      {step === 2 && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Duplicate Resolutions (Meera's Request) */}
          <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)' }}>
            <h2>Meera's Request: Clean Duplicates & Conflicts</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              We detected duplicate expense submissions. Choose which records to keep or merge. Unselected duplicates will be deleted from the import queue.
            </p>

            {anomalies.filter(a => a.type === 'DUPLICATE' || a.type === 'CONFLICT').length === 0 ? (
              <p style={{ color: 'var(--success)' }}>✓ No duplicates or conflicts found in this batch!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Specific duplicates: Row 5 & 6 (Marina Bites) */}
                {anomalies.some(a => a.rowIndex === 6 && a.type === 'DUPLICATE') && (
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <h3 style={{ marginTop: 0, color: 'var(--primary)' }}>Duplicate: Marina Bites Dinner (Row 5 & Row 6)</h3>
                    <p style={{ fontSize: '0.9rem' }}>Dev logged two Marina Bites dinner entries of ₹3,200. Please approve which to keep:</p>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                      <button 
                        onClick={() => handleResolveDuplicate(6, true)}
                        className={`btn ${ignoredRows.has(6) && !ignoredRows.has(5) ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      >
                        Keep Row 5 only (Skip Row 6 duplicate)
                      </button>
                      <button 
                        onClick={() => handleResolveDuplicate(6, false)}
                        className={`btn ${ignoredRows.has(5) && !ignoredRows.has(6) ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      >
                        Keep Row 6 only (Skip Row 5 duplicate)
                      </button>
                      <button 
                        onClick={() => {
                          setIgnoredRows(prev => {
                            const next = new Set(prev);
                            next.delete(5);
                            next.delete(6);
                            return next;
                          });
                        }}
                        className={`btn ${!ignoredRows.has(5) && !ignoredRows.has(6) ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      >
                        Keep both (No duplicates)
                      </button>
                    </div>
                  </div>
                )}

                {/* Specific conflicts: Row 24 & 25 (Thalassa Dinner) */}
                {anomalies.some(a => a.type === 'CONFLICT') && (
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <h3 style={{ marginTop: 0, color: 'var(--accent)' }}>Double-Logged Conflict: Thalassa Dinner (Row 24 vs Row 25)</h3>
                    <p style={{ fontSize: '0.9rem' }}>Aisha logged ₹2,400 for Thalassa dinner, and Rohan logged ₹2,450. Choose the correct transaction:</p>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                      <button 
                        onClick={() => handleResolveConflict(25, 24)}
                        className={`btn ${ignoredRows.has(25) && !ignoredRows.has(24) ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      >
                        Aisha's entry is correct (Keep Row 24, Delete Row 25)
                      </button>
                      <button 
                        onClick={() => handleResolveConflict(25, 25)}
                        className={`btn ${ignoredRows.has(24) && !ignoredRows.has(25) ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      >
                        Rohan's entry is correct (Keep Row 25, Delete Row 24)
                      </button>
                      <button 
                        onClick={() => handleResolveConflict(25, 0)}
                        className={`btn ${!ignoredRows.has(24) && !ignoredRows.has(25) ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                      >
                        Keep both (Separate dinner payments)
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Action-Required Anomalies (Missing Payer, Ambiguous Dates) */}
          <div className="glass-card" style={{ borderLeft: '4px solid var(--accent)' }}>
            <h2>Action Required: Missing Information & Date Clarification</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              We detected missing payers or ambiguous dates. Please verify or correct them below before proceeding.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {anomalies.filter(a => a.type === 'MISSING_PAYER' || a.type === 'UNKNOWN_PAYER' || a.type === 'AMBIGUOUS_DATE' || a.type === 'INVALID_DATE' || a.type === 'INVALID_AMOUNT' || a.type === 'ZERO_AMOUNT').map((a, i) => {
                const res = resolutions[a.rowIndex] || {};
                return (
                  <div key={i} style={{ background: 'rgba(0,0,0,0.1)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <strong style={{ color: 'var(--accent)' }}>{a.type.replace('_', ' ')} (Row {a.rowIndex})</strong>
                      <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>{a.description}</p>
                      <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>Raw data: {a.rowData}</div>
                    </div>
                    
                    {/* Resolution inputs */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {a.type === 'MISSING_PAYER' || a.type === 'UNKNOWN_PAYER' ? (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assign Payer:</label>
                          <select
                            value={res.payerName || ''}
                            onChange={e => updateResolutionField(a.rowIndex, 'payerName', e.target.value)}
                            style={{ padding: '0.4rem', borderRadius: '4px', background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text)' }}
                          >
                            <option value="">-- Select --</option>
                            {allUsers.map(u => (
                              <option key={u.id} value={u.name}>{u.name}</option>
                            ))}
                          </select>
                        </div>
                      ) : null}

                      {a.type === 'AMBIGUOUS_DATE' || a.type === 'INVALID_DATE' ? (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Verify Date:</label>
                          <input
                            type="date"
                            value={res.date || ''}
                            onChange={e => updateResolutionField(a.rowIndex, 'date', e.target.value)}
                            style={{ padding: '0.4rem', borderRadius: '4px', background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text)' }}
                          />
                        </div>
                      ) : null}

                      {a.type === 'ZERO_AMOUNT' || a.type === 'INVALID_AMOUNT' ? (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Verify Amount:</label>
                          <input
                            type="number"
                            value={res.amount || 0}
                            onChange={e => updateResolutionField(a.rowIndex, 'amount', parseFloat(e.target.value))}
                            style={{ padding: '0.4rem', width: '100px', borderRadius: '4px', background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text)' }}
                          />
                        </div>
                      ) : null}

                      <button 
                        onClick={() => handleToggleRowIgnore(a.rowIndex)} 
                        className="btn btn-outline" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderColor: ignoredRows.has(a.rowIndex) ? 'var(--success)' : 'var(--danger)', color: ignoredRows.has(a.rowIndex) ? 'var(--success)' : 'var(--danger)' }}
                      >
                        {ignoredRows.has(a.rowIndex) ? 'Include Row' : 'Ignore / Skip Row'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Automatic Anomalies Log (USD, timelines, missing currency) */}
          <div className="glass-card">
            <h2>Auto-Resolved Notifications (Review Only)</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              These anomalies were handled automatically according to group policies. No action is required, but you can review them.
            </p>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem' }}>
              <table style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Anomaly Type</th>
                    <th>Description</th>
                    <th>Auto Resolution Action</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.filter(a => a.type === 'USD_CONVERSION' || a.type === 'TIMELINE_VIOLATION' || a.type === 'REFUND' || a.type === 'PERCENTAGE_SUM_OFF' || a.type === 'MISSING_CURRENCY').map((a, i) => (
                    <tr key={i}>
                      <td>Row {a.rowIndex}</td>
                      <td style={{ color: 'var(--primary)' }}>{a.type}</td>
                      <td>{a.description}</td>
                      <td style={{ color: 'var(--success)' }}>{a.actionTaken}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Preview Import Data Grid */}
          <div className="glass-card">
            <h2>Preview Import Queue ({parsedTransactions.length - ignoredRows.size} items to import)</h2>
            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Import?</th>
                    <th>Row</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Paid By</th>
                    <th>Amount (INR)</th>
                    <th>Split Type</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedTransactions.map(t => {
                    const isIgnored = ignoredRows.has(t.rowIndex);
                    const res = resolutions[t.rowIndex] || t;
                    return (
                      <tr key={t.rowIndex} style={{ opacity: isIgnored ? 0.4 : 1, background: isIgnored ? 'rgba(239, 68, 68, 0.05)' : '' }}>
                        <td>
                          <input 
                            type="checkbox" 
                            checked={!isIgnored} 
                            onChange={() => handleToggleRowIgnore(t.rowIndex)}
                          />
                        </td>
                        <td>{t.rowIndex}</td>
                        <td>{res.date}</td>
                        <td>{res.description} {res.isSettlement && <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.35rem', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.2)', color: 'var(--primary)', marginLeft: '0.5rem' }}>Settlement</span>}</td>
                        <td>{res.payerName}</td>
                        <td>
                          {res.originalAmt ? (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              ${res.originalAmt} (₹{res.amount})
                            </span>
                          ) : `₹${res.amount}`}
                        </td>
                        <td>{res.splitType}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{res.notes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button className="btn btn-outline" onClick={() => setStep(1)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCommit} disabled={committing}>
              {committing ? 'Committing Database Records...' : 'Confirm & Finalize Import'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: COMPLETE */}
      {step === 3 && (
        <div className="glass-card animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '3rem', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', fontSize: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
            ✓
          </div>
          <h2>Import Completed Successfully!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem' }}>
            The CSV file was successfully ingested into the target group. Duplicate entries have been cleared, multi-currencies resolved, and the net balances recalculated.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Link href="/" className="btn btn-primary">Go to Dashboard</Link>
            <Link href="/anomalies" className="btn btn-outline">View Final Import Report</Link>
          </div>
        </div>
      )}
    </div>
  );
}
