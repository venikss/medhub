import requests

BASE_URL = "http://localhost:8000/api/v1"

def test_frontdesk_data():
    # 1. Login
    login_data = {
        "email": "frontdesk@medhub.io",
        "password": "password",  # Assuming 'password' is the default if not changed
        "role": "front_desk"
    }
    print(f"Trying to login as {login_data['email']}...")
    resp = requests.post(f"{BASE_URL}/auth/login/", json=login_data)
    if resp.status_code != 200:
        print(f"Login failed: {resp.status_code} {resp.text}")
        # Try admin123
        login_data["password"] = "admin123"
        print(f"Trying with 'admin123'...")
        resp = requests.post(f"{BASE_URL}/auth/login/", json=login_data)
        if resp.status_code != 200:
            print(f"Login failed again: {resp.status_code}")
            return

    token = resp.json().get("access") or resp.json().get("token")
    headers = {"Authorization": f"Bearer {token}"}
    print(f"Login successful. Token: {token[:10]}...")

    endpoints = [
        "/admin/users?role=doctor",
        "/admin/departments",
        "/patients/wards",
        "/patients/beds"
    ]

    for ep in endpoints:
        print(f"Fetching {ep}...")
        r = requests.get(f"{BASE_URL}{ep}", headers=headers)
        if r.status_code == 200:
            data = r.json()
            count = 0
            if isinstance(data, dict):
                items = data.get("data", []) or data.get("results", [])
                count = len(items)
            elif isinstance(data, list):
                count = len(data)
            print(f"  Result: 200 OK, count: {count}")
            # If count is 0, print the whole response
            if count == 0:
                print(f"  Response: {data}")
        else:
            print(f"  Result: {r.status_code} {r.text}")

if __name__ == "__main__":
    test_frontdesk_data()
