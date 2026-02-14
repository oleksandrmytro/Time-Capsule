const defaultApiBase = 'http://localhost:8080'

function getApiBase() {
  return import.meta.env.VITE_API_BASE || defaultApiBase
}

export async function apiRequest(path, { method = 'POST', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch (e) {
    data = text
  }
  if (!res.ok) {
    const message = data?.message || data?.error || text || `HTTP ${res.status}`
    const details = data?.errors || data?.trace
    throw { status: res.status, message, details }
  }
  return data
}

export function oauthLinks() {
  const base = getApiBase()
  return [
    { provider: 'Google', href: `${base}/oauth2/authorization/google` },
    { provider: 'GitHub', href: `${base}/oauth2/authorization/github` },
  ]
}

