
export type TimeOfDay = 'morning' | 'afternoon' | 'evening'
export type MealType = 'breakfast' | 'lunch' | 'dinner'

export const getTimeOfDay = (): TimeOfDay => {
  const hour = new Date().getHours()
  
  if (hour >= 5 && hour < 12) {
    return 'morning'
  } else if (hour >= 12 && hour < 17) {
    return 'afternoon'
  } else {
    return 'evening'
  }
}

export const getRecommendedMealType = (timeOfDay?: TimeOfDay): MealType => {
  const tod = timeOfDay || getTimeOfDay()
  
  switch (tod) {
    case 'morning':
      return 'breakfast'
    case 'afternoon':
      return 'lunch'
    case 'evening':
      return 'dinner'
  }
}

export const getTimeGreeting = (timeOfDay?: TimeOfDay): string => {
  const tod = timeOfDay || getTimeOfDay()
  
  switch (tod) {
    case 'morning':
      return 'Good morning'
    case 'afternoon':
      return 'Good afternoon'
    case 'evening':
      return 'Good evening'
  }
}
