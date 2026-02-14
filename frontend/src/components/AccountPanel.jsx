import React from 'react'

export default function AccountPanel({ profile, onProfileChange, onSave, onLogout, onHome, tokens }) {
  return (
    <section className="panel form-card">
      <div className="form-header">
        <h2>My account</h2>
        <button className="ghost" onClick={onHome}>
          Home
        </button>
      </div>
      {profile ? (
        <>
          <div className="form-grid">
            <label>
              Username
              <input
                name="username"
                value={profile.username || ''}
                onChange={(e) => onProfileChange({ ...profile, username: e.target.value })}
              />
            </label>
            <label>
              Email
              <input
                name="email"
                value={profile.email || ''}
                onChange={(e) => onProfileChange({ ...profile, email: e.target.value })}
              />
            </label>
            <label>
              Avatar URL
              <input
                name="avatarUrl"
                value={profile.avatarUrl || ''}
                onChange={(e) => onProfileChange({ ...profile, avatarUrl: e.target.value })}
              />
            </label>
          </div>
          <div className="actions">
            <button onClick={onSave} disabled={!tokens}>Save</button>
            <button className="ghost" onClick={onLogout}>Logout</button>
          </div>
          <p className="muted">Role: {profile.role} | Enabled: {String(profile.enabled)}</p>
        </>
      ) : (
        <p className="muted">No profile loaded</p>
      )}
    </section>
  )
}

