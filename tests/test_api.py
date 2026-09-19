from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_optimize_contract_and_constraints() -> None:
    response = client.post(
        "/api/optimize",
        json={"length_ft": 10, "width_ft": 8, "budget": 8000, "theme": "Minimalist Modern"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["catalog_count"] == 100
    assert body["total_cost"] <= 8000
    assert body["space_allocated_sqft"] <= body["space_limit_sqft"]
    assert body["fixtures"]
    assert {fixture["category"] for fixture in body["fixtures"]} <= {
        "Toilet",
        "Vanity",
        "Shower",
        "Bathtub",
        "Mirror",
        "Sensor",
    }

    fixtures = [fixture for fixture in body["fixtures"] if fixture["category"] not in {"Mirror", "Sensor"}]
    for left_index, left in enumerate(fixtures):
        for right in fixtures[left_index + 1 :]:
            separated = (
                left["x_ft"] + left["footprint_width_ft"] + 0.18 <= right["x_ft"]
                or right["x_ft"] + right["footprint_width_ft"] + 0.18 <= left["x_ft"]
                or left["y_ft"] + left["footprint_depth_ft"] + 0.18 <= right["y_ft"]
                or right["y_ft"] + right["footprint_depth_ft"] + 0.18 <= left["y_ft"]
            )
            assert separated
