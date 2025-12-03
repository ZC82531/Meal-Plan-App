
export interface Recipe {
  title: string
  meal_type: string
  cook_time: number
  servings: number
  difficulty: string
  ingredients: string[]
  steps: string[]
  tags: string[]
}
export interface RecipeResult {
  recipes: Recipe[]
}

export interface PredictionWithConfidence {
  name: string
  confidence: number
  bbox?: number[]
}

export interface DetectedResult {
  ingredients: string[]
  predictions: PredictionWithConfidence[]
  suggestions?: PredictionWithConfidence[]
  message?: string
  image_with_boxes?: string
}

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5001'

let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

async function ensureValidToken(): Promise<boolean> {
  const { ensureValidToken: validateToken, refreshToken } = await import('../services/supabase')
  
  if (isRefreshing && refreshPromise) {
    return await refreshPromise
  }
  
  const needsRefresh = await validateToken()
  
  if (!needsRefresh) {
    isRefreshing = true
    refreshPromise = refreshToken()
    const result = await refreshPromise
    isRefreshing = false
    refreshPromise = null
    return result
  }
  
  return true
}

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  }
  
  const token = localStorage.getItem('access_token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return headers
}

async function handleResponse(res: Response, retryFn?: () => Promise<Response>): Promise<any> {
  if (res.status === 401) {
    if (retryFn) {
      const refreshed = await ensureValidToken()
      if (refreshed) {
        const newRes = await retryFn()
        if (newRes.ok) {
          const data = await newRes.json()
          if (data.status === 'success') {
            return data.data
          }
        }
      }
    }
    
    throw new Error('Authentication required')
  }
  
  let data: any
  try {
    data = await res.json()
  } catch (e) {
    throw new Error('Invalid JSON response')
  }
  if (!res.ok || data.status !== 'success') {
    throw new Error(data?.message || `Request failed (${res.status})`)
  }
  return data.data
}

async function detectIngredients(imageDataUrl: string): Promise<DetectedResult> {
  await ensureValidToken()
  
  const makeRequest = () => {
    const headers = getAuthHeaders()
    return fetch(`${BASE_URL}/detect-ingredients`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ image: imageDataUrl })
    })
  }
  
  const res = await makeRequest()
  const data = await handleResponse(res, makeRequest)
  return {
    ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
    predictions: Array.isArray(data.predictions) ? data.predictions : [],
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    message: data.message,
    image_with_boxes: data.image_with_boxes 
  }
}

async function createFinalImage(imageDataUrl: string, highConfCoords: any[] = [], lowConfCoords: any[] = []): Promise<string> {
  await ensureValidToken()
  
  console.log('[API] createFinalImage called with:')
  console.log('  - high confidence coords:', highConfCoords.length)
  console.log('  - low confidence coords:', lowConfCoords.length)
  
  const makeRequest = () => {
    const headers = getAuthHeaders()
    return fetch(`${BASE_URL}/create-final-image`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        image: imageDataUrl, 
        high_confidence: highConfCoords,
        low_confidence: lowConfCoords
      })
    })
  }
  
  const res = await makeRequest()
  const data = await handleResponse(res, makeRequest)
  console.log('[API] createFinalImage response received:', data)
  console.log('[API] createFinalImage image_with_boxes length:', data.image_with_boxes?.length)
  return data.image_with_boxes
}

async function generateRecipes(ingredients: string[]): Promise<RecipeResult> {
  await ensureValidToken()
  
  const makeRequest = () => {
    const headers = getAuthHeaders()
    return fetch(`${BASE_URL}/generate-recipes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ingredients })
    })
  }
  
  const res = await makeRequest()
  const data = await handleResponse(res, makeRequest)
  return data as RecipeResult
}

async function* generateRecipesStream(ingredients: string[], imageUrl?: string, mealType?: string): AsyncGenerator<string, void, unknown> {
  await ensureValidToken()
  
  console.log('[API] generateRecipesStream called with:', { ingredients, imageUrl, mealType })
  
  const headers = getAuthHeaders()
  const requestBody: any = { ingredients }
  if (imageUrl) requestBody.image_url = imageUrl
  if (mealType) requestBody.meal_type = mealType
  
  const res = await fetch(`${BASE_URL}/generate-recipes-stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody)
  })
  
  console.log('[API] Stream response status:', res.status)
  
  if (res.status === 401) {
    const refreshed = await ensureValidToken()
    if (refreshed) {
      const newHeaders = getAuthHeaders()
      const newRes = await fetch(`${BASE_URL}/generate-recipes-stream`, {
        method: 'POST',
        headers: newHeaders,
        body: JSON.stringify(requestBody)
      })
      if (newRes.ok && newRes.body) {
        yield* processStream(newRes)
        return
      }
    }
    throw new Error('Authentication required')
  }
  
  if (!res.ok || !res.body) {
    console.error('[API] Stream failed:', res.status, res.statusText)
    throw new Error(`Stream failed: ${res.status}`)
  }
  
  console.log('[API] Starting to process stream...')
  yield* processStream(res)
}

async function* processStream(res: Response): AsyncGenerator<string, void, unknown> {
  if (!res.body) return
  
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        console.log('📡 Stream connection closed')
        break
      }
      
      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.error) {
              console.error('Stream error:', data.error)
              throw new Error(data.error)
            }
            if (data.complete || data.done) {
              console.log('✅ Stream marked as complete by server (complete/done flag)')
              return
            }
            if (data.chunk) {
              yield data.chunk
            }
          } catch (e) {
            if (e instanceof Error && e.message.includes('Stream error')) {
              throw e
            }
            console.warn('Failed to parse SSE line:', line.slice(6))
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

async function getHeroImageDataURL(): Promise<string> {
  try {
    const res = await fetch('https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&q=80')
    if (!res.ok) throw new Error('Failed to fetch sample image')
    const blob = await res.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    throw new Error('Could not load sample image. Please upload your own image.')
  }
}

export const api = {
  detectIngredients,
  createFinalImage,
  generateRecipes,
  generateRecipesStream,
  getHeroImageDataURL,
  uploadImage,
  saveRecipes
}

async function uploadImage(imageDataUrl: string): Promise<string> {
  await ensureValidToken()
  
  console.log('[API] uploadImage called, image length:', imageDataUrl?.length)
  
  const makeRequest = () => {
    const headers = getAuthHeaders()
    return fetch(`${BASE_URL}/api/upload-image`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ image: imageDataUrl })
    })
  }
  
  const res = await makeRequest()
  const data = await handleResponse(res, makeRequest)
  console.log('[API] uploadImage response:', data)
  return data.image_url
}

async function saveRecipes(imageUrl: string, ingredients: string[], recipes: Recipe[]): Promise<void> {
  await ensureValidToken()
  
  const makeRequest = () => {
    const headers = getAuthHeaders()
    return fetch(`${BASE_URL}/api/save-recipes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        image_url: imageUrl,
        ingredients,
        recipes 
      })
    })
  }
  
  const res = await makeRequest()
  await handleResponse(res, makeRequest)
}
