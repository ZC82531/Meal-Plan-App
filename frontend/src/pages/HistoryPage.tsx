import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../components/GlassCard'
import RecipeCard from '../components/RecipeCard'
import Navbar from '../components/Navbar'
import { ensureValidToken } from '../services/supabase'
import './RecipesPage.css'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5001'

interface RecipeSearch {
  id: string
  image_url: string
  ingredients: string[]
  created_at: string
  recipes: Array<{
    title: string
    ingredients: string[]
    steps: string[]
    cooking_time?: string
    difficulty?: string
    servings?: string
    calories?: string
  }>
}

export const HistoryPage = () => {
  const navigate = useNavigate()
  const [searches, setSearches] = useState<RecipeSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedSearch, setExpandedSearch] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const isValid = await ensureValidToken()
        if (!isValid) {
          navigate('/login')
          return
        }

        const token = localStorage.getItem('access_token')
        if (!token) {
          navigate('/login')
          return
        }

        const response = await fetch(`${BASE_URL}/api/recipe-history`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        const data = await response.json()
        
        if (data.status === 'success') {
          setSearches(data.data)
        } else {
          setError(data.message || 'Failed to load history')
        }
      } catch (err) {
        console.error('Error fetching history:', err)
        setError('Failed to load recipe history')
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [navigate])

  const toggleSearch = (searchId: string) => {
    setExpandedSearch(expandedSearch === searchId ? null : searchId)
  }

  const deleteSearch = async (searchId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    setDeleteConfirmId(searchId)
  }

  const confirmDelete = async (searchId: string) => {
    try {
      setDeletingId(searchId)
      setDeleteConfirmId(null)
      
      const isValid = await ensureValidToken()
      if (!isValid) {
        navigate('/login')
        return
      }
      
      const token = localStorage.getItem('access_token')
      
      const response = await fetch(`${BASE_URL}/api/delete-recipe-search/${searchId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      const data = await response.json()
      
      if (data.status === 'success') {
        setSearches(searches.filter(s => s.id !== searchId))
      } else {
        alert(data.message || 'Failed to delete')
      }
    } catch (err) {
      console.error('Error deleting search:', err)
      alert('Failed to delete recipe search')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="recipes-page">
      <Navbar />
      
      <div className="recipes-header">
        <button className="back-button" onClick={() => navigate('/camera')}>
          ← Back
        </button>
        <h1 className="recipes-title">Recipe History</h1>
        <div className="spacer"></div>
      </div>

      <div className="recipes-content">
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="streaming-indicator"
          >
            <GlassCard>
              <div className="generating-message">
                <p>Loading your recipe history...</p>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <GlassCard>
              <div className="generating-message">
                <p style={{ color: '#ff6b6b' }}>{error}</p>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {!loading && !error && searches.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <GlassCard>
              <div className="generating-message">
                <p>No recipe history yet.</p>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {!loading && searches.length > 0 && (
          <div className="history-list">
            {searches.map((search, idx) => (
              <motion.div
                key={search.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <GlassCard className="history-search-card">
                  <div 
                    className="history-search-header"
                    onClick={() => toggleSearch(search.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div 
                      className="history-image-preview"
                      onClick={(e) => {
                        e.stopPropagation()
                        setZoomedImage(search.image_url)
                      }}
                      style={{ cursor: 'zoom-in' }}
                    >
                      <img 
                        src={search.image_url} 
                        alt="Ingredients" 
                        style={{
                          width: '100%',
                          height: '150px',
                          objectFit: 'contain',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(0, 0, 0, 0.2)',
                          transition: 'transform 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.02)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)'
                        }}
                      />
                    </div>
                    
                    <div className="history-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <p className="history-date">
                          {new Date(search.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        
                        <div className="ingredients-tags" style={{ marginTop: '8px', position: 'relative' }}>
                          {search.ingredients.slice(0, 5).map((ingredient, i) => (
                            <span key={i} className="ingredient-tag">
                              {ingredient}
                            </span>
                          ))}
                          {search.ingredients.length > 5 && (
                            <span 
                              className="ingredient-tag"
                              style={{ cursor: 'pointer', position: 'relative' }}
                              onMouseEnter={(e) => {
                                const tooltip = e.currentTarget.querySelector('.ingredients-tooltip') as HTMLElement
                                if (tooltip) tooltip.style.display = 'block'
                              }}
                              onMouseLeave={(e) => {
                                const tooltip = e.currentTarget.querySelector('.ingredients-tooltip') as HTMLElement
                                if (tooltip) tooltip.style.display = 'none'
                              }}
                            >
                              +{search.ingredients.length - 5} more
                              <div 
                                className="ingredients-tooltip"
                                style={{
                                  display: 'none',
                                  position: 'absolute',
                                  bottom: '100%',
                                  left: '0',
                                  marginBottom: '8px',
                                  background: 'rgba(30, 30, 50, 0.98)',
                                  backdropFilter: 'blur(20px)',
                                  border: '1px solid rgba(255, 255, 255, 0.2)',
                                  borderRadius: '12px',
                                  padding: '12px',
                                  minWidth: '200px',
                                  maxWidth: '300px',
                                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                                  zIndex: 100,
                                  pointerEvents: 'none'
                                }}
                              >
                                <div style={{ 
                                  fontSize: '11px', 
                                  fontWeight: '600', 
                                  color: 'rgba(255, 255, 255, 0.6)',
                                  marginBottom: '8px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px'
                                }}>
                                  Remaining Ingredients
                                </div>
                                {search.ingredients.slice(5).map((ingredient, i) => (
                                  <div 
                                    key={i}
                                    style={{
                                      padding: '6px 0',
                                      borderBottom: i < search.ingredients.length - 6 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                                      color: 'rgba(255, 255, 255, 0.9)',
                                      fontSize: '13px'
                                    }}
                                  >
                                    {ingredient}
                                  </div>
                                ))}
                              </div>
                            </span>
                          )}
                        </div>
                        
                        <p style={{ marginTop: '12px', fontSize: '14px', opacity: 0.8 }}>
                          {search.recipes.length} recipe{search.recipes.length !== 1 ? 's' : ''} generated
                        </p>
                      </div>
                    </div>
                    
                    <div className="expand-icon">
                      {expandedSearch === search.id ? '▼' : '▶'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <button
                      onClick={(e) => deleteSearch(search.id, e)}
                      disabled={deletingId === search.id}
                      style={{
                        background: 'rgba(255, 107, 107, 0.15)',
                        border: '1px solid rgba(255, 107, 107, 0.4)',
                        borderRadius: '6px',
                        padding: '8px 16px',
                        color: '#ff6b6b',
                        cursor: deletingId === search.id ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        backdropFilter: 'blur(10px)',
                        transition: 'all 0.2s ease',
                        opacity: deletingId === search.id ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (deletingId !== search.id) {
                          e.currentTarget.style.background = 'rgba(255, 107, 107, 0.3)'
                          e.currentTarget.style.transform = 'scale(1.05)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 107, 107, 0.15)'
                        e.currentTarget.style.transform = 'scale(1)'
                      }}
                    >
                      {deletingId === search.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>

                  {expandedSearch === search.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="history-recipes"
                      style={{ marginTop: '20px' }}
                    >
                      {search.recipes.map((recipe, recipeIdx) => (
                        <div key={recipeIdx} style={{ marginBottom: '16px' }}>
                          <RecipeCard recipe={{
                            title: recipe.title,
                            meal_type: '',
                            cook_time: parseInt(recipe.cooking_time || '0'),
                            servings: parseInt(recipe.servings || '0'),
                            difficulty: recipe.difficulty || 'Medium',
                            ingredients: recipe.ingredients,
                            steps: recipe.steps,
                            tags: []
                          }} />
                        </div>
                      ))}
                    </motion.div>
                  )}
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {deleteConfirmId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setDeleteConfirmId(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(20, 20, 40, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
            }}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', color: '#fff' }}>
              Delete Recipe Search?
            </h2>
            <p style={{ margin: '0 0 24px 0', color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px', lineHeight: '1.5' }}>
              This will permanently delete the image and all associated recipes. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(deleteConfirmId)}
                style={{
                  background: 'rgba(255, 107, 107, 0.2)',
                  border: '1px solid rgba(255, 107, 107, 0.5)',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: '#ff6b6b',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 107, 107, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 107, 107, 0.2)'
                }}
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {zoomedImage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            cursor: 'zoom-out',
            padding: '20px'
          }}
          onClick={() => setZoomedImage(null)}
        >
          <motion.img
            src={zoomedImage}
            alt="Zoomed ingredients"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setZoomedImage(null)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              width: '44px',
              height: '44px',
              color: '#fff',
              fontSize: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
              e.currentTarget.style.transform = 'scale(1.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
