import random
from openai_service import OpenAIService

class RecipeGenerator:
    def __init__(self, openai_service=None):
        self.openai_service = openai_service or OpenAIService()
    
    def detect_food_items_mock(self):
        possible_ingredient_sets = [
            ["banana", "apple", "bread"],
            ["chicken", "broccoli", "rice", "garlic"],
            ["pasta", "tomato", "basil", "cheese"],
            ["egg", "milk", "flour", "butter", "sugar"],
            ["potato", "carrot", "onion", "beef"],
            ["salmon", "lemon", "dill", "asparagus"]
        ]
        return random.choice(possible_ingredient_sets)
    
    def generate_recipes(self, ingredients=None):
        if ingredients is None:
            ingredients = self.detect_food_items_mock()
        
        try:
            recipes_list = self.openai_service.generate_recipes_from_ingredients(ingredients)
            
            return {
                "ingredients": ingredients,
                "recipes": recipes_list
            }
        
        except ValueError as e:
            raise ValueError(str(e))
        except Exception as e:
            raise Exception(f"Error generating recipes: {str(e)}")