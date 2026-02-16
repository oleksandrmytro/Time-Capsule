import React from 'react'

export default function Header({ apiBase, isAuthenticated, onGo, onAccount, onLogout }) {
  return (
    <header className="header">
      <div>
        <h1>TimeCapsule</h1>
        <p className="muted">API base: {apiBase}</p>
      </div>
      <div className="actions">
        <button className="ghost" onClick={() => onGo('login')}>Login</button>
        <button className="ghost" onClick={() => onGo('register')}>Register</button>
        {isAuthenticated && <button className="ghost" onClick={onAccount}>Account</button>}
        <button className="ghost" onClick={onLogout} disabled={!isAuthenticated}>
          Logout
        </button>
      </div>
    </header>
  )
}

