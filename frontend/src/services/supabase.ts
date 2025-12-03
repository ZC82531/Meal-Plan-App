
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5001'

export interface AuthUser {
  id: string
  email: string
}

interface AuthResponse {
  user: AuthUser
  session: {
    access_token: string
    refresh_token: string
    expires_at?: number
  }
}

function notifyAuthChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth-changed'))
  }
}

function setTokens(accessToken: string, refreshToken: string, expiresAt?: number) {
  localStorage.setItem('access_token', accessToken)
  localStorage.setItem('refresh_token', refreshToken)
  if (expiresAt) {
    localStorage.setItem('token_expires_at', expiresAt.toString())
  } else {
    const defaultExpiresAt = Date.now() + (3600 * 1000)
    localStorage.setItem('token_expires_at', defaultExpiresAt.toString())
  }
  notifyAuthChanged()
}

export function getAccessToken(): string | null {
  return localStorage.getItem('access_token')
}

function getRefreshToken(): string | null {
  return localStorage.getItem('refresh_token')
}

function getTokenExpiresAt(): number | null {
  const expiresAt = localStorage.getItem('token_expires_at')
  return expiresAt ? parseInt(expiresAt, 10) : null
}

function clearTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('token_expires_at')
  notifyAuthChanged()
}

export function isTokenExpiringSoon(): boolean {
  const expiresAt = getTokenExpiresAt()
  if (!expiresAt) return true
  
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000
  return (expiresAt - now) < fiveMinutes
}

export async function refreshToken(): Promise<boolean> {
  const refresh = getRefreshToken()
  
  if (!refresh) {
    clearTokens()
    return false
  }
  
  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh })
    })
    
    const data = await response.json()
    
    if (data.status === 'success' && data.data?.session) {
      const { access_token, refresh_token } = data.data.session
      setTokens(access_token, refresh_token)
      
      window.dispatchEvent(new Event('storage'))
      
      return true
    }
    
    clearTokens()
    return false
  } catch (error) {
    console.error('Token refresh failed:', error)
    clearTokens()
    return false
  }
}

export async function ensureValidToken(): Promise<boolean> {
  const token = getAccessToken()
  
  if (!token) {
    return false
  }
  
  if (isTokenExpiringSoon()) {
    return await refreshToken()
  }
  
  return true
}

export async function signUp(email: string, password: string) {
  const response = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  
  const data = await response.json()
  
  if (data.status !== 'success') {
    throw new Error(data.message || 'Sign up failed')
  }
  
  const authData = data.data as AuthResponse
  if (authData.session?.access_token) {
    setTokens(authData.session.access_token, authData.session.refresh_token)
  }
  
  return authData
}

export async function signIn(email: string, password: string) {
  const response = await fetch(`${BASE_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  
  const data = await response.json()
  
  console.log('Sign in response:', data)
  
  if (data.status !== 'success') {
    throw new Error(data.message || 'Sign in failed')
  }
  
  const authData = data.data as AuthResponse
  console.log('Auth data:', authData)
  console.log('Access token:', authData.session?.access_token)
  
  if (authData.session?.access_token) {
    setTokens(authData.session.access_token, authData.session.refresh_token)
    console.log('Tokens stored in localStorage')
  } else {
    console.error('No access token in response!')
  }
  
  return authData
}

export async function signOut() {
  const token = getAccessToken()
  
  if (token) {
    await fetch(`${BASE_URL}/auth/signout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
  }
  
  clearTokens()
}

export async function resetPassword(email: string) {
  const response = await fetch(`${BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
  
  const data = await response.json()
  
  if (data.status !== 'success') {
    throw new Error(data.message || 'Password reset failed')
  }
  
  return data
}

export function getSession() {
  const token = getAccessToken()
  return token ? { access_token: token } : null
}

export function isAuthenticated(): boolean {
  return !!getAccessToken()
}

export const supabase = null
export async function getCurrentUser() { return null }
export function onAuthStateChange() { return { data: { subscription: { unsubscribe: () => {} } } } }
