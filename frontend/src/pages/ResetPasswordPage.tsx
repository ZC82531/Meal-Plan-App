import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import './AuthPages.css'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5001'

export const ResetPasswordPage = () => {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash
    const params = new URLSearchParams(hash.substring(1))
    const token = params.get('access_token')
    const refresh = params.get('refresh_token')
    
    if (token) {
      setAccessToken(token)
      setRefreshToken(refresh)
    } else {
      setError('Invalid or expired reset link')
    }
  }, [])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (!accessToken) {
      setError('Invalid reset token')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${BASE_URL}/auth/update-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ 
          password,
          access_token: accessToken,
          refresh_token: refreshToken
        })
      })

      const data = await response.json()

      if (data.status !== 'success') {
        throw new Error(data.message || 'Failed to update password')
      }

      setSuccess(true)
      
      setTimeout(() => {
        navigate('/login')
      }, 2000)

    } catch (err: any) {
      console.error('Reset password error:', err)
      setError(err.message || 'Failed to reset password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <Navbar />
      
      <div className="auth-container">
        <motion.div 
          className="auth-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="auth-header">
            <h1 className="auth-title">Set New Password</h1>
            <p className="auth-subtitle">
              {success 
                ? 'Password updated successfully!' 
                : 'Enter your new password below'
              }
            </p>
          </div>

          {!success ? (
            <form className="auth-form" onSubmit={handleResetPassword}>
              {error && (
                <motion.div 
                  className="auth-error"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.div>
              )}

              <div className="auth-field">
                <label htmlFor="password" className="auth-label">New Password</label>
                <input
                  id="password"
                  type="password"
                  className="auth-input"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  disabled={!accessToken}
                />
              </div>

              <div className="auth-field">
                <label htmlFor="confirmPassword" className="auth-label">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="auth-input"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  disabled={!accessToken}
                />
              </div>

              <button 
                type="submit" 
                className="auth-button"
                disabled={loading || !accessToken}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          ) : (
            <motion.div 
              className="auth-success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <svg className="auth-success-icon" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p className="auth-success-text">
                Your password has been updated successfully. Redirecting to login...
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
