import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv

load_dotenv()

supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not supabase_url or not supabase_key:
    print("❌ Supabase credentials not found")
    exit(1)

from supabase import create_client
supabase = create_client(supabase_url, supabase_key)

try:
    result = supabase.auth.admin.list_users()
    
    if result and len(result) > 0:
        print("Found users in your Supabase:")
        print()
        for i, user in enumerate(result, 1):
            print(f"{i}. Email: {user.email}")
            print(f"   User ID: {user.id}")
            print()
        
        print("Copy one of these user IDs to use in test_save_logic.py")
    else:
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        print(f"No users found. Please sign up first at {frontend_url}")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
