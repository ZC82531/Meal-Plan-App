import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../components/GlassCard'
import { GlassButton } from '../components/GlassButton'
import Navbar from '../components/Navbar'
import './CameraPage.css'
import { api } from '../components/api'
import { getTimeOfDay, getRecommendedMealType, type MealType } from '../utils/timeOfDay'

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png'
])

const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png'])

const INVALID_FORMAT_MESSAGE = 'Only JPG or PNG images are supported.'

export const CameraPage = () => {
  const navigate = useNavigate()
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectedItems, setDetectedItems] = useState<string[]>([])
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [originalImage, setOriginalImage] = useState<string | null>(null)
  const [predictions, setPredictions] = useState<{name: string, confidence: number, bbox?: number[]}[]>([])
  const [suggestions, setSuggestions] = useState<{name: string, confidence: number, bbox?: number[]}[]>([])
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set())
  const [deselectedPredictions, setDeselectedPredictions] = useState<Set<string>>(new Set())
  const [hasDetected, setHasDetected] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [imageKey, setImageKey] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [showMealTypeModal, setShowMealTypeModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timeOfDay = getTimeOfDay()
    const recommendedMeal = getRecommendedMealType(timeOfDay)
    setMealType(recommendedMeal)
    console.log(`[CameraPage] Detected ${timeOfDay}, suggesting ${recommendedMeal}`)
  }, [])

  const isAllowedFile = (file: File) => {
    const mimeType = file.type?.toLowerCase()
    if (mimeType && ALLOWED_IMAGE_TYPES.has(mimeType)) {
      return true
    }
    const extension = file.name?.split('.').pop()?.toLowerCase()
    return extension ? ALLOWED_IMAGE_EXTENSIONS.has(extension) : false
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (!isAllowedFile(file)) {
        setUploadError(INVALID_FORMAT_MESSAGE)
        event.target.value = ''
        return
      }
      setUploadError('')
      const reader = new FileReader()
      reader.onloadend = () => {
        const imageData = reader.result as string
        setUploadedImage(imageData)
        setOriginalImage(imageData)
        setDetectedItems([])
        setHasDetected(false)
        setPredictions([])
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (!file.type || !file.type.startsWith('image/')) {
      setUploadError('Please drop an image file.')
      return
    }
    if (!isAllowedFile(file)) {
      setUploadError(INVALID_FORMAT_MESSAGE)
      return
    }
    setUploadError('')
    const reader = new FileReader()
    reader.onloadend = () => {
      const imageData = reader.result as string
      setUploadedImage(imageData)
      setOriginalImage(imageData)
      setDetectedItems([])
      setHasDetected(false)
      setPredictions([])
    }
    reader.readAsDataURL(file)
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const detectIngredients = async () => {
    if (!uploadedImage) return
    setIsDetecting(true)
    setHasDetected(true)
    try {
      const result = await api.detectIngredients(originalImage || uploadedImage)
      
      console.log('[CameraPage] Detection result:', result)
      console.log('[CameraPage] Predictions (high conf):', result.predictions)
      console.log('[CameraPage] Suggestions (low conf):', result.suggestions)
      
      setPredictions(result.predictions || [])
      setSuggestions(result.suggestions || [])
      setSelectedSuggestions(new Set())
      setDeselectedPredictions(new Set())
      const highConfNames = (result.predictions || []).map(p => p.name)
      console.log('[CameraPage] High confidence item names:', highConfNames)
      setDetectedItems(highConfNames)
      if (result.image_with_boxes) {
        console.log('[CameraPage] Using image with all boxes from backend')
        console.log('[CameraPage] Image data length:', result.image_with_boxes.length)
        setUploadedImage(result.image_with_boxes)
        setImageKey(prev => prev + 1)
      }
      
      if (highConfNames.length > 0 || (result.suggestions || []).length > 0) {
        sessionStorage.setItem('detectedIngredients', JSON.stringify(highConfNames))
      }
    } catch (err: any) {
      console.error('Error detecting ingredients:', err)
      if (err.message === 'Authentication required') {
        setShowAuthModal(true)
        setIsDetecting(false)
        return
      }
      setDetectedItems([])
    } finally {
      setIsDetecting(false)
    }
  }

  const toggleSuggestion = (name: string) => {
    const newSelected = new Set(selectedSuggestions)
    if (newSelected.has(name)) {
      newSelected.delete(name)
    } else {
      newSelected.add(name)
    }
    setSelectedSuggestions(newSelected)
    console.log('[CameraPage] Toggled suggestion:', name, 'Now selected:', Array.from(newSelected))
  }

  const togglePrediction = (name: string) => {
    const newDeselected = new Set(deselectedPredictions)
    if (newDeselected.has(name)) {
      newDeselected.delete(name)
    } else {
      newDeselected.add(name)
    }
    setDeselectedPredictions(newDeselected)
    console.log('[CameraPage] Toggled prediction:', name, 'Now deselected:', Array.from(newDeselected))
  }

  const generateRecipes = async () => {
    const selectedPredictions = detectedItems.filter(name => !deselectedPredictions.has(name))
    const selectedLowConf = Array.from(selectedSuggestions)
    const allIngredients = [...selectedPredictions, ...selectedLowConf]
    
    if (allIngredients.length > 0 && uploadedImage) {
      try {
        setIsGenerating(true)
        
        console.log('[CameraPage] Generating recipes with ingredients:', allIngredients)
        console.log('[CameraPage] Meal type:', mealType)
        const imageUrl = await api.uploadImage(uploadedImage)
        console.log('[CameraPage] Image uploaded:', imageUrl)
        
        navigate('/recipes', { 
          state: { 
            ingredients: allIngredients,
            imageUrl: imageUrl,
            mealType: mealType
          } 
        })
      } catch (err) {
        console.error('Error uploading image:', err)
        navigate('/recipes', { 
          state: { 
            ingredients: allIngredients,
            mealType: mealType
          } 
        })
      } finally {
        setIsGenerating(false)
      }
    } else {
      const saved = sessionStorage.getItem('detectedIngredients')
      const parsed = saved ? (JSON.parse(saved) as string[]) : []
      navigate('/recipes', { 
        state: { 
          ingredients: parsed,
          mealType: mealType
        } 
      })
    }
  }

  return (
    <div className="camera-page">
      <Navbar />
      
      <div className="camera-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h1 className="camera-title">Upload Ingredients</h1>
        <div className="spacer"></div>
      </div>

      <motion.div 
        className="meal-type-selector-container"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <button 
          className="meal-type-selector-btn"
          onClick={() => setShowMealTypeModal(true)}
        >
          <span className="current-meal-type">
            {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
          </span>
          <span className="change-text">Click to change meal type</span>
        </button>
      </motion.div>

      <div className="camera-content">
        <GlassCard className="camera-container">
          {uploadError && (
            <div className="upload-error" role="alert">
              {uploadError}
            </div>
          )}
          <div className="camera-view">
            {!uploadedImage ? (
              <motion.div 
                className="upload-placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: isDragging ? '2px dashed rgba(139, 92, 246, 0.8)' : '2px dashed rgba(255, 255, 255, 0.2)',
                  backgroundColor: isDragging ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                  transition: 'all 0.3s ease'
                }}
              >
                <div className="upload-icon-container">
                  <svg className="upload-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M17 8L12 3L7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 3V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h2>{isDragging ? 'Drop your image here!' : 'Upload Your Ingredients Photo'}</h2>
                <p>{isDragging ? 'Release to upload' : 'Take a photo of your fridge or pantry'}</p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  capture="environment"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
                
                <div className="upload-buttons">
                  <GlassButton onClick={triggerFileInput} size="large">
                    📷 Take Photo / Upload
                  </GlassButton>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                className="image-preview"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                key={imageKey}
              >
                {uploadedImage && (
                  <img src={uploadedImage} alt="Uploaded ingredients" className="uploaded-img" />
                )}
                <div className="image-overlay">
                  {!isDetecting && !hasDetected && (
                    <GlassButton 
                      onClick={detectIngredients}
                      size="large"
                    >
                      Detect Ingredients
                    </GlassButton>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {(isDetecting || isGenerating) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="detecting-overlay"
            >
              <div className="spinner-container">
                <div className="gold-spinner"></div>
              </div>
              <p className="detecting-text">
                {isGenerating ? 'Preparing recipes...' : 'Analyzing ingredients...'}
              </p>
            </motion.div>
          )}
        </GlassCard>

        {hasDetected && detectedItems.length === 0 && suggestions.length === 0 && !isDetecting && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <GlassCard>
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <p style={{ fontSize: '16px', opacity: 0.8 }}>
                  No ingredients detected. Try uploading a clearer image with visible food items.
                </p>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {(detectedItems.length > 0 || suggestions.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="detected-section"
          >
            <GlassCard>
              {detectedItems.length > 0 && (
                <>
                  <h2 className="detected-title">✅ High Confidence Ingredients</h2>
                  <div className="detected-grid">
                    {detectedItems.map((item, idx) => {
                      const isSelected = !deselectedPredictions.has(item)
                      return (
                        <motion.div
                          key={item}
                          className={`detected-item ${isSelected ? 'selected' : 'unselected'}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.1 }}
                          onClick={() => togglePrediction(item)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="item-icon">
                            <div className="ingredient-badge">
                              {item.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <span className="item-name">
                            {item}
                            {(() => {
                              const p = predictions.find(pr => pr.name === item)
                              return p ? `  ${(p.confidence*100).toFixed(1)}%` : ''
                            })()}
                          </span>
                          {isSelected && <span className="checkmark">✓</span>}
                        </motion.div>
                      )
                    })}
                  </div>
                </>
              )}

              {suggestions.length > 0 && (
                <div className="suggestions-section">
                  <div className="suggestions-header">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="#F59E0B" strokeWidth="2"/>
                      <path d="M12 8V12" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
                      <circle cx="12" cy="16" r="1.5" fill="#F59E0B"/>
                    </svg>
                    <h3 className="suggestions-title">
                      Possible Additional Items
                    </h3>
                  </div>
                  <p className="suggestions-description">
                    🟡 These items were detected with lower confidence. Click to select ones you have.
                  </p>
                  <div className="detected-grid">
                    {suggestions.map((sug, idx) => {
                      const isSelected = selectedSuggestions.has(sug.name)
                      return (
                        <motion.div
                          key={sug.name}
                          className={`detected-item suggestion-item ${isSelected ? 'selected' : ''}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.1 }}
                          onClick={() => toggleSuggestion(sug.name)}
                        >
                          <div className="item-icon">
                            <div className="ingredient-badge">
                              {sug.name.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <span className="item-name">
                            {sug.name}
                            {` ${(sug.confidence * 100).toFixed(1)}%`}
                          </span>
                          {isSelected && (
                            <svg 
                              style={{ 
                                position: 'absolute', 
                                top: '8px', 
                                right: '8px', 
                                width: '20px', 
                                height: '20px',
                                stroke: '#F59E0B'
                              }} 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="action-buttons">
                <GlassButton
                  variant="secondary"
                  onClick={() => {
                    setDetectedItems([])
                    setUploadedImage(null)
                    setOriginalImage(null)
                    setPredictions([])
                    setSuggestions([])
                    setSelectedSuggestions(new Set())
                    setDeselectedPredictions(new Set())
                    setHasDetected(false)
                  }}
                >
                  Upload New Photo
                </GlassButton>
                <GlassButton
                  onClick={generateRecipes}
                  size="large"
                >
                  Generate Recipes →
                </GlassButton>
              </div>
            </GlassCard>
          </motion.div>
        )}
        {uploadedImage && !isDetecting && detectedItems.length === 0 && hasDetected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="detected-section"
          >
            <GlassCard>
              <h2 className="detected-title">Nothing Detected</h2>
              <p style={{ marginTop: '8px', opacity: 0.8 }}>Try a clearer photo or different angle. Make sure the food is well lit.</p>
              <div className="action-buttons" style={{ marginTop: '16px' }}>
                <GlassButton
                  variant="secondary"
                  onClick={() => {
                    setDetectedItems([])
                    setUploadedImage(null)
                    setOriginalImage(null)
                    setPredictions([])
                    setSuggestions([])
                    setSelectedSuggestions(new Set())
                    setDeselectedPredictions(new Set())
                    setHasDetected(false)
                  }}
                >
                  Upload New Photo
                </GlassButton>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </div>

      {showMealTypeModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowMealTypeModal(false)}
        >
          <motion.div
            className="meal-type-modal"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">Select Meal Type</h2>
              <p className="modal-subtitle">
                It's currently <span className="time-badge">{getTimeOfDay()}</span>
              </p>
            </div>

            <div className="meal-options-grid">
              <button
                className={`meal-option-card ${mealType === 'breakfast' ? 'active' : ''}`}
                onClick={() => {
                  setMealType('breakfast')
                  setShowMealTypeModal(false)
                }}
              >
                <div className="meal-option-content">
                  <div className="meal-emoji">🍳</div>
                  <div className="meal-text">
                    <span className="meal-label">Breakfast</span>
                    <span className="meal-description">Morning meals</span>
                  </div>
                  {mealType === 'breakfast' && (
                    <div className="selected-indicator">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
              </button>

              <button
                className={`meal-option-card ${mealType === 'lunch' ? 'active' : ''}`}
                onClick={() => {
                  setMealType('lunch')
                  setShowMealTypeModal(false)
                }}
              >
                <div className="meal-option-content">
                  <div className="meal-emoji">🥗</div>
                  <div className="meal-text">
                    <span className="meal-label">Lunch</span>
                    <span className="meal-description">Midday meals</span>
                  </div>
                  {mealType === 'lunch' && (
                    <div className="selected-indicator">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
              </button>

              <button
                className={`meal-option-card ${mealType === 'dinner' ? 'active' : ''}`}
                onClick={() => {
                  setMealType('dinner')
                  setShowMealTypeModal(false)
                }}
              >
                <div className="meal-option-content">
                  <div className="meal-emoji">🍽️</div>
                  <div className="meal-text">
                    <span className="meal-label">Dinner</span>
                    <span className="meal-description">Evening meals</span>
                  </div>
                  {mealType === 'dinner' && (
                    <div className="selected-indicator">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            </div>

            <button 
              className="modal-close-btn"
              onClick={() => setShowMealTypeModal(false)}
            >
              Cancel
            </button>
          </motion.div>
        </div>
      )}

      {showAuthModal && (
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
          onClick={() => setShowAuthModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(20, 20, 40, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}
          >
            <h2 style={{ 
              fontSize: '24px', 
              marginBottom: '16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Authentication Required
            </h2>
            <p style={{ 
              color: 'rgba(255, 255, 255, 0.8)', 
              marginBottom: '24px',
              lineHeight: '1.6'
            }}>
              You need to be logged in to use this feature. Please log in or create an account to continue.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
              <div style={{ width: '100%' }}>
                <GlassButton
                  onClick={() => navigate('/login')}
                >
                  Log In
                </GlassButton>
              </div>
              <div style={{ width: '100%' }}>
                <GlassButton
                  variant="secondary"
                  onClick={() => navigate('/signup')}
                >
                  Sign Up
                </GlassButton>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
