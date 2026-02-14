import React from 'react'

export function OAuthButtons({ links }) {
  return (
    <div className="oauth">
      <span className="muted">Or continue with</span>
      <div className="oauth-buttons">
        {links.map((link) => (
          <a key={link.provider} className="oauth-btn" href={link.href}>
            <span className="icon" aria-hidden>
              {link.provider === 'Google' ? 'G' : 'GH'}
            </span>
            Continue with {link.provider}
          </a>
        ))}
      </div>
    </div>
  )
}

export function LoginForm({ form, onChange, onLogin, onGoHome, onGoRegister, disabled, oauth }) {
  return (
    <section className="panel form-card">
      <div className="form-header">
        <h2>Login</h2>
        <button className="ghost" onClick={onGoRegister}>
          Need an account?
        </button>
      </div>
      <div className="form-grid">
        <label>
          Email
          <input name="email" value={form.email} onChange={onChange} placeholder="user@example.com" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={onChange}
            placeholder="••••••••"
          />
        </label>
      </div>
      <div className="actions">
        <button onClick={onLogin} disabled={disabled}>
          Sign in
        </button>
        <button className="ghost" onClick={onGoHome}>
          Back
        </button>
      </div>
      <OAuthButtons links={oauth} />
    </section>
  )
}

export function RegisterForm({ form, onChange, onSignup, onGoHome, onGoLogin, disabled, oauth }) {
  return (
    <section className="panel form-card">
      <div className="form-header">
        <h2>Create account</h2>
        <button className="ghost" onClick={onGoLogin}>
          Have an account?
        </button>
      </div>
      <div className="form-grid">
        <label>
          Email
          <input name="email" value={form.email} onChange={onChange} placeholder="user@example.com" />
        </label>
        <label>
          Username
          <input name="username" value={form.username} onChange={onChange} placeholder="TimeTraveler" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={onChange}
            placeholder="StrongPass123"
          />
        </label>
      </div>
      <div className="actions">
        <button onClick={onSignup} disabled={disabled}>
          Register
        </button>
        <button className="ghost" onClick={onGoHome}>
          Back
        </button>
      </div>
      <OAuthButtons links={oauth} />
    </section>
  )
}

export function VerifyForm({ form, onChange, onVerify, onResend, onGoLogin }) {
  return (
    <section className="panel form-card">
      <div className="form-header">
        <h2>Verify email</h2>
        <button className="ghost" onClick={onGoLogin}>
          Go to login
        </button>
      </div>
      <p className="muted">We sent a code to {form.email}. Enter it to activate your account.</p>
      <div className="form-grid">
        <label>
          Verification code
          <input
            name="verificationCode"
            value={form.verificationCode}
            onChange={onChange}
            placeholder="From email"
          />
        </label>
      </div>
      <div className="actions">
        <button onClick={onVerify} disabled={!form.email || !form.verificationCode}>
          Submit code
        </button>
        <button className="ghost" onClick={onResend} disabled={!form.email}>
          Resend code
        </button>
      </div>
    </section>
  )
}

