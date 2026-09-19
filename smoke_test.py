from fastapi.testclient import TestClient

from backend.main import app

payload = {"length_ft": 10, "width_ft": 8, "budget": 8000, "theme": "Minimalist Modern"}
response = TestClient(app).post("/api/optimize", json=payload)
response.raise_for_status()
body = response.json()
print("status:", response.status_code)
print("fixtures:", len(body["fixtures"]))
print("total_cost:", body["total_cost"])
print("space_allocated_sqft:", body["space_allocated_sqft"], "/", body["space_limit_sqft"])
print("water_demand_gpm:", body["water_demand_gpm"])
for fixture in body["fixtures"]:
    print(f"{fixture['product_id']} {fixture['category']} @ ({fixture['x_ft']}, {fixture['y_ft']})")
