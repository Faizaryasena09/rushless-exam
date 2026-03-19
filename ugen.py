import requests
import json
import time
import random
import sys
from datetime import datetime

# --- CONFIGURATION ---
BASE_URL = "https://rush.sensrvr.my.id"
ADMIN_USER = "admin"
ADMIN_PASS = "admin"

# ANSI Colors
C_GREEN = "\033[92m"
C_RED = "\033[91m"
C_CYAN = "\033[96m"
C_RESET = "\033[0m"

def color_wrap(text, color):
    return f"{color}{text}{C_RESET}"

def login(session_obj, username, password):
    url = f"{BASE_URL}/api/login"
    payload = {"username": username, "password": password}
    try:
        response = session_obj.post(url, json=payload, timeout=15)
        if response.status_code == 200:
            return True, 200, "Login Success"
        else:
            return False, response.status_code, response.text[:100]
    except Exception as e:
        return False, 0, str(e)

def admin_cleanup(admin_session):
    print(f"[*] Cleaning up existing users (excluding 'admin')...")
    try:
        resp = admin_session.get(f"{BASE_URL}/api/users", timeout=12)
        if resp.status_code == 200:
            all_users = resp.json()
            deleted_count = 0
            for u in all_users:
                if u['username'] not in ['admin']:
                    admin_session.request("DELETE", f"{BASE_URL}/api/users", json={"id": u['id']}, timeout=12)
                    deleted_count += 1
            print(color_wrap(f" [+] Deleted {deleted_count} users.", C_GREEN))
            return True
    except Exception as e:
        print(color_wrap(f" [!] Error during cleanup: {e}", C_RED))
    return False

def create_mass_users(admin_session, count=50):
    print(f"[*] Creating {count} users (user1 to user{count})...")
    
    # Get class_id
    class_id = 1
    try:
        resp = admin_session.get(f"{BASE_URL}/api/classes", timeout=12)
        if resp.status_code == 200:
            classes = resp.json()
            if classes:
                class_id = classes[0]['id']
    except:
        pass

    created = 0
    for i in range(1, count + 1):
        username = f"user{i}"
        payload = {
            "username": username, "name": f"Student {i}", "password": username,
            "role": "student", "class_id": class_id
        }
        try:
            resp = admin_session.post(f"{BASE_URL}/api/users", json=payload, timeout=12)
            if resp.status_code == 201:
                created += 1
                if created % 10 == 0:
                    print(f"  [>] Progress: {created}/{count}...")
            else:
                print(color_wrap(f"  [!] Failed to create {username}: {resp.status_code}", C_RED))
        except Exception as e:
            print(color_wrap(f"  [!] Error creating {username}: {e}", C_RED))
            
    print(color_wrap(f" [+] Done. Created {created} users in Class ID {class_id}.", C_CYAN))

def main():
    if len(sys.argv) < 2:
        print("Usage: python ugen.py <user_count>")
        print("Example: python ugen.py 500")
        return

    try:
        user_count = int(sys.argv[1])
    except ValueError:
        print(" [!] Please provide a valid number for user count.")
        return

    print(f"--- RUSHLESS-EXAM USER GENERATOR ---")
    print(f"Target: {BASE_URL}")
    
    admin_session = requests.Session()
    success, status, msg = login(admin_session, ADMIN_USER, ADMIN_PASS)
    
    if not success:
        print(color_wrap(f" [!] Admin login failed: {status} | {msg}", C_RED))
        return

    print(color_wrap(" [OK] Admin Logged In.", C_GREEN))
    
    # Run setup
    admin_cleanup(admin_session)
    create_mass_users(admin_session, user_count)

if __name__ == "__main__":
    main()
