import json
import os
from openai import OpenAI
from pydantic import BaseModel, Field, ValidationError
from typing import List, Literal

class Recipe(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    meal_type: Literal["breakfast", "lunch", "dinner", "snack", "dessert", "drink"]
    cook_time: int = Field(..., ge=1, le=300)
    servings: int = Field(..., ge=1, le=20)
    difficulty: Literal["easy", "medium", "hard"]
    ingredients: List[str] = Field(..., min_length=1)
    steps: List[str] = Field(..., min_length=1)
    tags: List[str] = Field(default_factory=list, max_length=10)

class RecipeList(BaseModel):
    recipes: List[Recipe] = Field(..., min_length=1, max_length=10)

class OpenAIService:
    SYSTEM_PROMPT = """You are an expert chef AI that creates recipes using only ingredients from the user's available pool.

Generate detailed, professional recipes as JSON matching this exact structure:
{
  "recipes": [
    {
      "title": "Recipe Name",
      "meal_type": "breakfast|lunch|dinner|snack|dessert|drink",
      "cook_time": 30,
      "servings": 4,
      "difficulty": "easy|medium|hard",
      "ingredients": ["2 cups all-purpose flour", "1 tsp salt", "3 large eggs"],
      "steps": ["Preheat oven to 350°F. Grease a 9x13 pan.", "In a large bowl, whisk together flour and salt.", "Add eggs one at a time, beating well after each addition."],
      "tags": ["vegetarian", "quick", "family-friendly"]
    }
  ]
}

CRITICAL INGREDIENT RESTRICTIONS:
- The user has provided a list of available ingredients - this is their COMPLETE pantry/fridge
- You can ONLY use ingredients from their list - treat it as their entire available ingredient pool
- Each recipe does NOT need to use ALL ingredients, but CANNOT use anything NOT on the list
- You MAY assume basic cooking essentials ONLY: salt, black pepper, cooking oil (olive/vegetable), water
- DO NOT assume butter, flour, sugar, eggs, milk, spices, herbs, or ANY other ingredients unless explicitly in the user's list
- If a recipe needs an ingredient not in the user's list or the 4 basics above, DO NOT create that recipe
- Be creative with combinations from their available pool

CRITICAL JSON REQUIREMENTS FOR STREAMING:
- Start IMMEDIATELY with { and "recipes": [
- Each recipe must be a COMPLETE, VALID JSON object
- Close each recipe object properly with }
- Separate recipes with commas
- End with ] } to close the structure
- DO NOT include markdown code blocks (no ```json or ```)
- DO NOT include any text before or after the JSON
- Ensure all strings are properly escaped
- Complete each recipe fully before starting the next one

RECIPE CONTENT REQUIREMENTS:
- Include PRECISE measurements in ingredients (cups, tbsp, oz, grams, etc.)
- Include DETAILED cooking temperatures and times in steps
- Make steps clear and specific (not just "mix ingredients")
- Add helpful cooking tips in steps when relevant
- Each step should be 1-2 sentences with actionable instructions
- Be creative but realistic with the available ingredients

Return ONLY valid JSON. Stream each complete recipe object as you generate it."""

    def __init__(self):
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")
        self.client = OpenAI(api_key=api_key)

    def generate_recipes_stream(self, ingredients, meal_type=None):
        meal_type_requirement = ""
        meal_type_json_field = ""
        
        if meal_type:
            meal_type_requirement = f"""

🚨 CRITICAL MEAL TYPE REQUIREMENT 🚨
- You MUST ONLY generate {meal_type.upper()} recipes
- Every single recipe must have "meal_type": "{meal_type}" in the JSON
- DO NOT create breakfast recipes if this is lunch or dinner
- DO NOT create lunch recipes if this is breakfast or dinner  
- DO NOT create dinner recipes if this is breakfast or lunch
- ONLY generate recipes appropriate for {meal_type}
- Think about what people traditionally eat for {meal_type} and the portion sizes appropriate for that meal
- Consider the time of day and energy needs for {meal_type}
- If you cannot create good {meal_type} recipes with these ingredients, create fewer recipes (even just 1-2) but ALL must be {meal_type}
- Recipes must be dishes that make sense for {meal_type} based on culinary tradition and common eating habits"""
            meal_type_json_field = f' and MUST have "meal_type": "{meal_type}"'
        
        prompt = f"""USER'S AVAILABLE INGREDIENT POOL: {', '.join(ingredients)}

These are ALL the ingredients the user has available. You can pick and choose from this pool.

CREATE 3-5 SUBSTANTIAL, REAL MEAL RECIPES using combinations from this ingredient pool.

🍽️ CRITICAL MEAL QUALITY REQUIREMENTS 🍽️
- Generate REAL, PROPER MEALS that people actually cook and eat
- Think like a professional chef creating a restaurant menu or home cooking recipes
- Each recipe should be a COMPLETE, SATISFYING, WELL-STRUCTURED MEAL
- Consider traditional meal composition: main component + supporting elements + proper cooking technique
- Build recipes around core ingredients (proteins, starches, or substantial vegetables) with complementary sides
- Avoid lazy combinations that just list ingredients without purpose or proper cooking technique
- Focus on recognized cooking methods and flavor profiles that work together
- Create dishes that are filling, balanced, and appetizing
- If the ingredient pool is limited, prioritize quality over quantity - 2-3 excellent recipes beat 5 mediocre ones
- Think about what would make someone actually excited to cook and eat this meal

ABSOLUTE INGREDIENT RESTRICTIONS:
- The list above is the user's COMPLETE available ingredients
- Each recipe can use SOME or MANY ingredients from the pool, but NOT ALL are required
- You may ONLY add these 4 basics: salt, black pepper, cooking oil (olive/vegetable), water
- DO NOT add butter, flour, sugar, milk, cream, eggs, spices, herbs, or ANY ingredient not in the user's list
- If an ingredient is NOT in the user's list above and NOT one of the 4 basics, you CANNOT use it
- Get creative with different combinations from their pool
- Each recipe should use a subset of ingredients that work well together{meal_type_requirement}

RECIPE REQUIREMENTS:
- Each recipe{meal_type_json_field}
- Include PRECISE measurements for all ingredients (cups, tbsp, oz, grams, etc.)
- Provide DETAILED step-by-step cooking instructions with temperatures and times
- Make steps clear and actionable
- Create realistic, delicious, SUBSTANTIAL recipes
- Each recipe should be complete and practical"""
        
        stream = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            stream=True,
            temperature=0.7
        )
        
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    def generate_recipes_from_ingredients(self, ingredients, meal_type=None):
        meal_type_requirement = ""
        meal_type_json_field = ""
        
        if meal_type:
            meal_type_requirement = f"""

🚨 CRITICAL MEAL TYPE REQUIREMENT 🚨
- You MUST ONLY generate {meal_type.upper()} recipes
- Every single recipe must have "meal_type": "{meal_type}" in the JSON
- DO NOT create breakfast recipes if this is lunch or dinner
- DO NOT create lunch recipes if this is breakfast or dinner  
- DO NOT create dinner recipes if this is breakfast or lunch
- ONLY generate recipes appropriate for {meal_type}
- Think about what people traditionally eat for {meal_type} and the portion sizes appropriate for that meal
- Consider the time of day and energy needs for {meal_type}
- If you cannot create good {meal_type} recipes with these ingredients, create fewer recipes (even just 1-2) but ALL must be {meal_type}
- Recipes must be dishes that make sense for {meal_type} based on culinary tradition and common eating habits"""
            meal_type_json_field = f' and MUST have "meal_type": "{meal_type}"'
        
        prompt = f"""USER'S AVAILABLE INGREDIENT POOL: {', '.join(ingredients)}

These are ALL the ingredients the user has available. You can pick and choose from this pool.

CREATE 3-5 SUBSTANTIAL, REAL MEAL RECIPES using combinations from this ingredient pool.

🍽️ CRITICAL MEAL QUALITY REQUIREMENTS 🍽️
- Generate REAL, PROPER MEALS that people actually cook and eat
- Think like a professional chef creating a restaurant menu or home cooking recipes
- Each recipe should be a COMPLETE, SATISFYING, WELL-STRUCTURED MEAL
- Consider traditional meal composition: main component + supporting elements + proper cooking technique
- Build recipes around core ingredients (proteins, starches, or substantial vegetables) with complementary sides
- Avoid lazy combinations that just list ingredients without purpose or proper cooking technique
- Focus on recognized cooking methods and flavor profiles that work together
- Create dishes that are filling, balanced, and appetizing
- If the ingredient pool is limited, prioritize quality over quantity - 2-3 excellent recipes beat 5 mediocre ones
- Think about what would make someone actually excited to cook and eat this meal

ABSOLUTE INGREDIENT RESTRICTIONS:
- The list above is the user's COMPLETE available ingredients
- Each recipe can use SOME or MANY ingredients from the pool, but NOT ALL are required
- You may ONLY add these 4 basics: salt, black pepper, cooking oil (olive/vegetable), water
- DO NOT add butter, flour, sugar, milk, cream, eggs, spices, herbs, or ANY ingredient not in the user's list
- If an ingredient is NOT in the user's list above and NOT one of the 4 basics, you CANNOT use it
- Get creative with different combinations from their pool
- Each recipe should use a subset of ingredients that work well together{meal_type_requirement}

RECIPE REQUIREMENTS:
- Each recipe{meal_type_json_field}
- Include PRECISE measurements for all ingredients (cups, tbsp, oz, grams, etc.)
- Provide DETAILED step-by-step cooking instructions with temperatures and times
- Make steps clear and actionable
- Create realistic, delicious, SUBSTANTIAL recipes
- Each recipe should be complete and practical"""
        
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        
        content = response.choices[0].message.content.strip()
        
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        try:
            data = json.loads(content)
            validated = RecipeList(**data)
            return [recipe.dict() for recipe in validated.recipes]
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON from OpenAI: {str(e)}")
        except ValidationError as e:
            raise ValueError(f"Schema validation failed: {str(e)}")
