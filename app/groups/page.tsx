"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import '../globals.css';

export default function GroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create group form state
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit members state
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [newMemberId, setNewMemberId] = useState('');
  const [memberJoinDate, setMemberJoinDate] = useState('');
  const [memberLeaveDate, setMemberLeaveDate] = useState('');
  const [memberError, setMemberError] = useState('');

  // Fetch groups and users
  const loadData = async () => {
    try {
      const [groupsRes, usersRes] = await Promise.all([
        fetch('/api/groups'),
        fetch('/api/users')
      ]);
      const groupsData = await groupsRes.json();
      const usersData = await usersRes.json();
      
      if (Array.isArray(groupsData)) setGroups(groupsData);
      if (Array.isArray(usersData)) {
        setAllUsers(usersData);
        if (usersData.length > 0) setNewMemberId(usersData[0].id);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!newGroupName.trim()) return;

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName, memberIds: selectedMembers })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create group');

      setNewGroupName('');
      setSelectedMembers([]);
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      setCreateError(err.message);
    }
  };

  const handleToggleMemberSelection = (userId: string) => {
    setSelectedMembers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError('');
    if (!editingGroup || !newMemberId) return;

    try {
      const res = await fetch(`/api/groups/${editingGroup.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newMemberId,
          joinedAt: memberJoinDate || null,
          leftAt: memberLeaveDate || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update member');

      setMemberJoinDate('');
      setMemberLeaveDate('');
      // Refresh editing group info
      const updatedGroupsRes = await fetch('/api/groups');
      const updatedGroups = await updatedGroupsRes.json();
      setGroups(updatedGroups);
      const updatedGroup = updatedGroups.find((g: any) => g.id === editingGroup.id);
      setEditingGroup(updatedGroup);
    } catch (err: any) {
      setMemberError(err.message);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      const res = await fetch(`/api/groups/${editingGroup.id}/members?userId=${userId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to remove member');

      // Refresh editing group info
      const updatedGroupsRes = await fetch('/api/groups');
      const updatedGroups = await updatedGroupsRes.json();
      setGroups(updatedGroups);
      const updatedGroup = updatedGroups.find((g: any) => g.id === editingGroup.id);
      setEditingGroup(updatedGroup);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="container"><h1 className="title">Loading...</h1></div>;

  return (
    <div className="container animate-fade-in">
      <header className="header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link href="/" className="btn btn-outline" style={{ marginBottom: '1rem', display: 'inline-block' }}>← Back to Dashboard</Link>
          <h1 className="title" style={{ textAlign: 'left', margin: 0 }}>Groups Management</h1>
          <p className="subtitle" style={{ textAlign: 'left' }}>Create shared billing groups and manage active membership timelines</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>+ New Group</button>
      </header>

      <div className="grid grid-2">
        {/* Left Side: Groups List */}
        <div className="glass-card">
          <h2>Your Groups</h2>
          <ul className="list">
            {groups.length === 0 ? (
              <li className="list-item" style={{ color: 'var(--text-muted)' }}>No groups found. Create one to get started!</li>
            ) : (
              groups.map(g => (
                <li key={g.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => setEditingGroup(g)}>
                  <div>
                    <strong style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>{g.name}</strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {g.members.length} member(s) • Created {new Date(g.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="btn btn-outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}>Manage Members</span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Right Side: Group Membership Details / Timeline */}
        {editingGroup ? (
          <div className="glass-card animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              <h2 style={{ borderBottom: 'none', margin: 0 }}>Timeline: {editingGroup.name}</h2>
              <button className="close-btn" style={{ float: 'none' }} onClick={() => setEditingGroup(null)}>×</button>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Define when roommates join or leave the group. Expenses are split only among members who are active on the expense date.
            </p>

            <table style={{ marginBottom: '2rem' }}>
              <thead>
                <tr>
                  <th>Roommate</th>
                  <th>Joined Date</th>
                  <th>Left Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {editingGroup.members.map((m: any) => {
                  const isActive = (!m.joinedAt || new Date(m.joinedAt) <= new Date()) && 
                                   (!m.leftAt || new Date(m.leftAt) >= new Date());
                  return (
                    <tr key={m.id}>
                      <td><strong>{m.name}</strong></td>
                      <td>{m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : 'Always'}</td>
                      <td>{m.leftAt ? new Date(m.leftAt).toLocaleDateString() : 'Active Member'}</td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isActive ? 'var(--success)' : 'var(--danger)'
                        }}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button 
                          onClick={() => {
                            setNewMemberId(m.id);
                            setMemberJoinDate(m.joinedAt ? new Date(m.joinedAt).toISOString().split('T')[0] : '');
                            setMemberLeaveDate(m.leftAt ? new Date(m.leftAt).toISOString().split('T')[0] : '');
                          }}
                          className="btn btn-outline" 
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', marginRight: '0.5rem' }}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleRemoveMember(m.id)}
                          className="btn btn-outline" 
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Add/Edit Timeline Form */}
            <form onSubmit={handleUpdateMember} style={{ background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>Add or Edit Member Timeline</h3>
              
              {memberError && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{memberError}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Select Member</label>
                  <select 
                    value={newMemberId} 
                    onChange={e => setNewMemberId(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    {allUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Join Date (Joined)</label>
                  <input 
                    type="date" 
                    value={memberJoinDate} 
                    onChange={e => setMemberJoinDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Leave Date (Optional)</label>
                  <input 
                    type="date" 
                    value={memberLeaveDate} 
                    onChange={e => setMemberLeaveDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Save Membership Timeline</button>
            </form>
          </div>
        ) : (
          <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', color: 'var(--text-muted)' }}>
            Select a group from the list to manage membership timelines.
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            <h2>Create New Group</h2>
            
            {createError && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{createError}</div>}
            
            <form onSubmit={handleCreateGroup}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Group Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Goa Trip, Flat Expenses" 
                  value={newGroupName} 
                  onChange={e => setNewGroupName(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '1rem' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Initial Members</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {allUsers.map(u => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedMembers.includes(u.id)}
                        onChange={() => handleToggleMemberSelection(u.id)}
                      />
                      {u.name}
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create Group</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
