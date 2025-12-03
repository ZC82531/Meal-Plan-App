import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { GlassCard } from '../components/GlassCard'
import { GlassButton } from '../components/GlassButton'
import RecipeCard from '../components/RecipeCard'
import Navbar from '../components/Navbar'
import './RecipesPage.css'
import { api, type Recipe } from '../components/api'

export const RecipesPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [ingredients, setIngredients] = useState<string[]>([])
  const [, setImageUrl] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const previousRecipeCount = useRef(0)
  const hasStartedStreaming = useRef(false)

  useEffect(() => {
    const fetchRecipes = async () => {
      if (hasStartedStreaming.current) {
        return
      }
      hasStartedStreaming.current = true
      
      try {
        const state = location.state as any
        const fromState = state?.ingredients as string[] | undefined
        const imageUrlFromState = state?.imageUrl as string | undefined
        const mealTypeFromState = state?.mealType as string | undefined
        const fromStorage = sessionStorage.getItem('detectedIngredients')
        const parsed = fromStorage ? (JSON.parse(fromStorage) as string[]) : undefined
        const ingredientsToUse = (fromState && fromState.length > 0)
          ? fromState
          : (parsed && parsed.length > 0)
            ? parsed
            : []
        setIngredients(ingredientsToUse)
        setImageUrl(imageUrlFromState || null)
        
        if (ingredientsToUse.length > 0) {
          setIsStreaming(true)
          setRecipes([])
          let buffer = ''
          let processedUpTo = 0
          const parsedRecipes: Recipe[] = []
          let lastChunkTime = Date.now()
          let backendStreamClosed = false
          
          try {
            console.log('🚀 Starting to receive chunks from backend...')
            console.log('🍽️ Meal type:', mealTypeFromState)
            for await (const chunk of api.generateRecipesStream(ingredientsToUse, imageUrlFromState || undefined, mealTypeFromState)) {
              buffer += chunk
              lastChunkTime = Date.now()
              
              const cleanBuffer = buffer.trim()
                .replace(/^```json\n?/, '')
                .replace(/^```\n?/, '')
              
              if (processedUpTo === 0) {
                const recipesArrayMatch = cleanBuffer.match(/"recipes"\s*:\s*\[/)
                if (recipesArrayMatch) {
                  processedUpTo = recipesArrayMatch.index! + recipesArrayMatch[0].length
                }
              }
              
              if (processedUpTo > 0) {
                let pos = processedUpTo
                let depth = 0
                let objectStart = -1
                let inString = false
                let escapeNext = false
                
                while (pos < cleanBuffer.length) {
                  const char = cleanBuffer[pos]
                  
                  if (escapeNext) {
                    escapeNext = false
                    pos++
                    continue
                  }
                  
                  if (char === '\\') {
                    escapeNext = true
                    pos++
                    continue
                  }
                  
                  if (char === '"') {
                    inString = !inString
                    pos++
                    continue
                  }
                  
                  if (!inString) {
                    if (char === '{') {
                      if (depth === 0) {
                        objectStart = pos
                      }
                      depth++
                    } else if (char === '}') {
                      depth--
                      if (depth === 0 && objectStart >= 0) {
                        const objectStr = cleanBuffer.substring(objectStart, pos + 1)
                        try {
                          const recipe = JSON.parse(objectStr) as Recipe
                          
                          if (recipe.title && 
                              Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 &&
                              Array.isArray(recipe.steps) && recipe.steps.length > 0) {
                            
                            parsedRecipes.push(recipe)
                            setRecipes([...parsedRecipes])
                            console.log(`✨ Recipe #${parsedRecipes.length}: "${recipe.title}"`)
                            
                            processedUpTo = pos + 1
                          }
                        } catch (e) {
                          console.log('Parse attempt failed, waiting for more data...')
                        }
                        objectStart = -1
                      }
                    }
                  }
                  
                  pos++
                }
                
              }
            }
            
            backendStreamClosed = true
            const timeSinceLastChunk = Date.now() - lastChunkTime
            console.log(`✅ CONDITION 1: Backend stream closed. Last chunk was ${timeSinceLastChunk}ms ago`)
            console.log('⏳ Now frontend will process buffer and decide when to stop animation...')
            if (!backendStreamClosed) {
              console.error('❌ Stream should be closed but flag not set!')
            }
            console.log('⏳ Waiting 1000ms to ensure all data received...')
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            console.log(`🔍 Processing remaining buffer (${buffer.length} chars)...`)
            console.log(`🔍 Currently have ${parsedRecipes.length} recipes from incremental parsing`)
            
            let cleanJson = buffer
              .replace(/^```json\n?/, '')
              .replace(/^```\n?/, '')
              .replace(/\n?```$/, '')
              .trim()

            const firstBrace = cleanJson.indexOf('{')
            if (firstBrace > 0) {
              cleanJson = cleanJson.slice(firstBrace)
            }

            if (!cleanJson.endsWith(']}')) {
              if (!cleanJson.endsWith(']')) {
                cleanJson = `${cleanJson}]`
              }
              if (!cleanJson.endsWith(']}')) {
                cleanJson = `${cleanJson}}`
              }
            }
            
            console.log(`🔍 Clean buffer for final parse: ${cleanJson.substring(0, 200)}...`)
            
            let finalRecipes = parsedRecipes
            let foundNewRecipes = false
            
            try {
              const data = JSON.parse(cleanJson)
              if (data.recipes && Array.isArray(data.recipes)) {
                const validRecipes = data.recipes.filter((r: any) => 
                  r.title && 
                  Array.isArray(r.ingredients) && r.ingredients.length > 0 &&
                  Array.isArray(r.steps) && r.steps.length > 0
                )
                
                if (validRecipes.length > parsedRecipes.length) {
                  console.log(`✅ Final parse found ${validRecipes.length} total recipes (was ${parsedRecipes.length})`)
                  finalRecipes = validRecipes
                  foundNewRecipes = true
                  setRecipes(validRecipes)
                } else {
                  console.log(`ℹ️ Final parse had ${validRecipes.length} recipes, keeping ${parsedRecipes.length} from incremental parsing`)
                  finalRecipes = parsedRecipes
                }
              }
            } catch (e) {
              console.log(`⚠️ Final parse failed: ${e}. Using ${parsedRecipes.length} incrementally parsed recipes`)
              finalRecipes = parsedRecipes
            }
            
            if (foundNewRecipes) {
              console.log('⏳ Waiting 800ms for new recipes to animate in...')
              await new Promise(resolve => setTimeout(resolve, 800))
            }
            
            console.log('⏳ Final 400ms buffer before closing animation...')
            await new Promise(resolve => setTimeout(resolve, 400))
            
            console.log(`✅ CONDITION 2: Frontend processing complete - ${finalRecipes.length} recipes displayed.`)
            console.log('🎬 Both conditions met (backend closed + frontend processed). Stopping animation.')
            setIsStreaming(false)
            
          } catch (err: any) {
            console.error('Stream error:', err)
            if (err.message === 'Authentication required') {
              setShowAuthModal(true)
              setIsStreaming(false)
              return
            }
            const result = await api.generateRecipes(ingredientsToUse)
            const fallbackRecipes = result.recipes || []
            setRecipes(fallbackRecipes)
            setIsStreaming(false)
          }
        } else {
          setRecipes([])
        }
      } catch (error: any) {
        console.error('Error:', error)
        if (error.message === 'Authentication required') {
          setShowAuthModal(true)
        }
        setIsStreaming(false)
      }
    }

    fetchRecipes()
  }, [location.state])

  useEffect(() => {
    previousRecipeCount.current = recipes.length
  }, [recipes])

  return (
    <div className="recipes-page">
      <Navbar />
      
      <div className="recipes-header">
        <button className="back-button" onClick={() => navigate('/camera')}>
          ← Back
        </button>
        <h1 className="recipes-title">Your Recipes</h1>
        <div className="spacer"></div>
      </div>

      <div className="recipes-content">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <GlassCard className="ingredients-card">
            <h2 className="section-title">📦 Your Ingredients</h2>
            <div className="ingredients-tags">
              {ingredients.map((ingredient, idx) => (
                <motion.span
                  key={ingredient}
                  className="ingredient-tag"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  {ingredient}
                </motion.span>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {recipes.length > 0 && (
          <div className="recipes-list">
            {recipes.map((recipe, idx) => {
              const isNewRecipe = idx >= previousRecipeCount.current
              
              return (
                <motion.div
                  key={`recipe-${idx}`}
                  initial={isNewRecipe ? { opacity: 0, y: 60, scale: 0.9 } : false}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 120,
                    damping: 18,
                    mass: 0.8
                  }}
                >
                  <RecipeCard recipe={recipe} />
                </motion.div>
              )
            })}
          </div>
        )}

        {isStreaming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="streaming-indicator"
          >
            <GlassCard>
              <div className="generating-message">
                <div className="thinking-dots">
                  <motion.span
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                  >●</motion.span>
                  <motion.span
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                  >●</motion.span>
                  <motion.span
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                  >●</motion.span>
                </div>
                <p>Crafting more recipes...</p>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {!isStreaming && recipes.length === 0 && ingredients.length === 0 && (
          <div className="no-recipes">
            <p>No ingredients detected. Please take a photo first!</p>
          </div>
        )}
      </div>

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
