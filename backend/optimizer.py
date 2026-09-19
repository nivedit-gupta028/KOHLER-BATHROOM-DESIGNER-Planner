"""Bathroom fixture optimization and wall-aware placement."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

try:
    import pulp
except ImportError:  # pragma: no cover
    pulp = None

CATALOG_PATH = Path(__file__).resolve().parents[1] / "data" / "catalog_expanded_100.csv"
MAX_SPACE_RATIO = 0.70
PLACEMENT_GAP_FT = 0.18


def load_catalog(path: Path = CATALOG_PATH) -> pd.DataFrame:
    """Load the source catalog without dropping any engineered fields."""
    return pd.read_csv(path)


def _score_catalog(catalog: pd.DataFrame, theme: str) -> pd.DataFrame:
    scored = catalog.copy()
    scored["preference_score"] = scored["aesthetic_score"] + scored["eco_score"]
    scored.loc[scored["aesthetic_tag"].str.casefold() == theme.casefold(), "preference_score"] += 3
    return scored


def _greedy_selection(catalog: pd.DataFrame, budget: float, max_space: float, must_have: list[str]) -> pd.DataFrame:
    """Deterministic fallback if CBC is unavailable in a deployment image."""
    chosen: list[dict[str, Any]] = []
    spent = 0.0
    used_space = 0.0
    categories: set[str] = set()
    
    # First, force must-have products
    for _, row in catalog.iterrows():
        if str(row["product_id"]) in must_have:
            category = str(row["category"])
            clearance = float(row["clearance_required_sqft"])
            price = float(row["base_price_usd"])
            if category not in categories:
                chosen.append(row.to_dict())
                categories.add(category)
                spent += price
                used_space += clearance

    for _, row in catalog.sort_values("preference_score", ascending=False).iterrows():
        category = str(row["category"])
        clearance = float(row["clearance_required_sqft"])
        price = float(row["base_price_usd"])
        if category in categories or spent + price > budget or used_space + clearance > max_space:
            continue
        chosen.append(row.to_dict())
        categories.add(category)
        spent += price
        used_space += clearance
    return pd.DataFrame(chosen).drop(columns=["preference_score"], errors="ignore")


def _calculate_initial_power(item: dict) -> float:
    p = float(item.get("power_watts", 0))
    if not p:
        return 0.0
    cat = item.get("category")
    t = item.get("telemetry_defaults", {})
    if cat == "Toilet":
        power = 0.0
        if t.get("seat_heater_active", False): power += p * 0.7
        if t.get("uv_wand_active", False): power += p * 0.3
        return power
    elif cat == "Shower":
        power = p * 0.2  # Base digital controller power
        if t.get("steam_mode", False): power += p * 0.8
        return power
    elif cat == "Mirror":
        return p * (t.get("brightness_pct", 100) / 100.0)
    return p

def optimize_layout(constraints: dict[str, Any], catalog: pd.DataFrame | None = None) -> pd.DataFrame:
    """Select at most one product per category within budget and 70% floor clearance."""
    catalog = load_catalog() if catalog is None else catalog.copy()
    budget = max(float(constraints.get("budget_usd", 15000)), 0.0)
    room_length = max(float(constraints.get("length_ft", constraints.get("room_length_ft", 10))), 4.0)
    room_width = max(float(constraints.get("width_ft", constraints.get("room_width_ft", 8))), 4.0)
    max_space = room_length * room_width * MAX_SPACE_RATIO
    theme = str(constraints.get("theme", constraints.get("aesthetic", "Minimalist Modern")))
    catalog = _score_catalog(catalog, theme)

    must_have = [str(p) for p in constraints.get("must_have_products", [])]

    if pulp is None:
        return _greedy_selection(catalog, budget, max_space, must_have)

    problem = pulp.LpProblem("BathroomLayout", pulp.LpMaximize)
    variables = {i: pulp.LpVariable(f"item_{i}", cat="Binary") for i in catalog.index}
    problem += pulp.lpSum(variables[i] * float(catalog.loc[i, "preference_score"]) for i in catalog.index)
    problem += pulp.lpSum(variables[i] * float(catalog.loc[i, "base_price_usd"]) for i in catalog.index) <= budget
    problem += pulp.lpSum(variables[i] * float(catalog.loc[i, "clearance_required_sqft"]) for i in catalog.index) <= max_space
    for category in catalog["category"].unique():
        problem += pulp.lpSum(variables[i] for i in catalog.index if catalog.loc[i, "category"] == category) <= 1

    if str(constraints.get("layout_style")) == "Linear Single-Wall":
        # Additional constraint: sum of along-wall widths (+ gaps) must not exceed room_length.
        # This must use the same "which dimension sits along the wall" rule as
        # _fixture_footprint, or the optimizer can select a collection that
        # physically cannot be lined up on one wall.
        def _along_wall_ft(i: int) -> float:
            if catalog.loc[i, "category"] in ("Toilet", "Sensor"):
                return float(catalog.loc[i, "width_in"]) / 12.0
            return float(catalog.loc[i, "length_in"]) / 12.0

        problem += pulp.lpSum(variables[i] * (_along_wall_ft(i) + 0.5) for i in catalog.index) <= room_length

    if must_have:
        for i in catalog.index:
            if str(catalog.loc[i, "product_id"]) in must_have:
                problem += variables[i] == 1
    try:
        problem.solve(pulp.PULP_CBC_CMD(msg=False, timeLimit=5))
    except (OSError, PermissionError, pulp.PulpSolverError):
        return _greedy_selection(catalog, budget, max_space, must_have)
    if problem.status != pulp.LpStatusOptimal:
        return _greedy_selection(catalog, budget, max_space, must_have)
    selected = catalog[[variables[i].value() == 1 for i in catalog.index]]
    return selected.drop(columns=["preference_score"], errors="ignore")



def _fixture_footprint(row: dict[str, Any]) -> tuple[float, float]:
    """Return footprint (x width, y depth) in feet."""
    if row["category"] in ("Toilet", "Sensor"):
        return float(row["width_in"]) / 12.0, float(row["length_in"]) / 12.0
    return float(row["length_in"]) / 12.0, float(row["width_in"]) / 12.0

def _overlaps(candidate: dict, placed: list[dict]) -> bool:
    c_x, c_y, c_w, c_d = candidate["x"], candidate["y"], candidate["w"], candidate["d"]
    c_cat = candidate["category"]
    
    for p in placed:
        p_x, p_y, p_w, p_d = p["x"], p["y"], p["w"], p["d"]
        p_cat = p["category"]
        
        # Calculate gaps, including 15-inch centerline clearance for toilets
        # 15 inches = 1.25 feet from center.
        
        gap_x = PLACEMENT_GAP_FT
        c_min_x, c_max_x = c_x, c_x + c_w
        p_min_x, p_max_x = p_x, p_x + p_w
        
        if c_cat == "Toilet":
            c_center = c_x + c_w / 2.0
            c_min_x = min(c_min_x, c_center - 1.25)
            c_max_x = max(c_max_x, c_center + 1.25)
        if p_cat == "Toilet":
            p_center = p_x + p_w / 2.0
            p_min_x = min(p_min_x, p_center - 1.25)
            p_max_x = max(p_max_x, p_center + 1.25)
            
        separated = (
            c_max_x + gap_x <= p_min_x
            or p_max_x + gap_x <= c_min_x
            or c_y + c_d + gap_x <= p_y
            or p_y + p_d + gap_x <= c_y
        )
        if not separated:
            return True
    return False

def _get_telemetry_defaults(row: dict) -> dict:
    if not int(row.get("iot_enabled", 0)):
        return {}
    cat = row["category"]
    if cat == "Toilet":
        return {"seat_heater_active": True, "seat_temp_f": 101, "uv_wand_active": False, "led_color": "Pure White"}
    elif cat == "Shower":
        return {"water_flow_gpm": 2.2, "temp_f": 102, "steam_mode": False, "outlets": ["Rainhead"]}
    elif cat == "Mirror":
        return {"color_temp_k": 3000, "brightness_pct": 80}
    elif cat == "Sensor":
        return {"pressure_psi": 55, "leak_detected": False, "valve_open": True}
    return {}

def place_fixtures(selection: pd.DataFrame, room_length: float, room_width: float, layout_style: str) -> list[dict[str, Any]]:
    """Place selected fixtures based on layout_style and zoning rules."""
    placed_boxes: list[dict] = []
    fixtures: list[dict[str, Any]] = []
    
    # Priority: Bathtub, Shower, Vanity, Toilet, Mirror, Sensor
    order = {"Bathtub": 0, "Shower": 1, "Vanity": 2, "Toilet": 3, "Mirror": 4, "Sensor": 5}
    rows = sorted(selection.to_dict("records"), key=lambda row: order.get(str(row["category"]), 9))
    
    for row in rows:
        width, depth = _fixture_footprint(row)
        cat = row["category"]
        
        # Mirror is a wall-mounted fixture, we can place it above the vanity
        if cat == "Mirror":
            # Find a vanity to place it above
            vanity = next((p for p in placed_boxes if p["category"] == "Vanity"), None)
            if vanity:
                x = vanity["x"] + vanity["w"]/2 - width/2
                y = vanity["y"]
                z_rot = vanity.get("z_rot", 0)
                wall = vanity.get("wall", "front")
            else:
                x, y, z_rot, wall = 0, 0, 0, "front"
            
            chosen = {"x": x, "y": y, "w": width, "d": depth, "category": cat, "z_rot": z_rot, "wall": wall}
            placed_boxes.append(chosen)
            fixtures.append(_build_fixture_payload(row, chosen, width, depth))
            continue
            
        if cat == "Sensor":
            # Sensors are small, let them go through normal placement
            pass

        # Determine y anchors based on layout style
        # Backend coords: x in [0, room_length], y in [0, room_width]
        # Front wall: y = 0
        # Rear wall: y = room_width
        
        candidates = []
        is_wet = cat in ("Shower", "Bathtub")
        
        if layout_style == "Zoned Wet/Dry":
            y_anchor = max(room_width - depth, 0.0) if is_wet else 0.0
            z_rot = 3.14159 if is_wet else 0
            wall = "front" if is_wet else "back"
            candidates = [(x, y_anchor, z_rot, wall) for x in [i * 0.25 for i in range(int(room_length * 4)) if i * 0.25 + width <= room_length]]
        elif layout_style == "Parallel Galley":
            y_anchor_wet = max(room_width - depth, 0.0)
            y_anchor_dry = 0.0
            
            if is_wet:
                candidates = [(x, y_anchor_wet, 3.14159, "front") for x in [i * 0.25 for i in range(int(room_length * 4)) if i * 0.25 + width <= room_length]]
            else:
                candidates = [(x, y_anchor_dry, 0, "back") for x in [i * 0.25 for i in range(int(room_length * 4)) if i * 0.25 + width <= room_length]]
        else:
            # Linear Single-Wall (force all to back wall so they face forward)
            y_anchor = 0.0
            candidates = [(x, y_anchor, 0, "back") for x in [i * 0.25 for i in range(int(room_length * 4)) if i * 0.25 + width <= room_length]]
            
        chosen = None
        for x, y, z_rot, wall in candidates:
            cand_dict = {"x": x, "y": y, "w": width, "d": depth, "category": cat, "z_rot": z_rot, "wall": wall}
            if not _overlaps(cand_dict, placed_boxes):
                chosen = cand_dict
                break
                
        if chosen is None:
            # Shift x safely instead of overlapping at 0,0
            shift_x = sum(p["w"] for p in placed_boxes) % (room_length - width) if room_length > width else 0.0
            chosen = {"x": shift_x, "y": 0.0, "w": width, "d": depth, "category": cat, "z_rot": 0, "wall": "back"}
            
        placed_boxes.append(chosen)
        fixtures.append(_build_fixture_payload(row, chosen, width, depth))
        
    return fixtures

def _build_fixture_payload(row: dict, chosen: dict, width: float, depth: float) -> dict:
    fixture = {key: _json_value(value) for key, value in row.items() if key != "preference_score"}
    fixture.update({
        "x_ft": round(chosen["x"], 3), 
        "y_ft": round(chosen["y"], 3), 
        "z_rotation": round(chosen.get("z_rot", 0), 3),
        "wall_orientation": chosen.get("wall", "rear"),
        "footprint_width_ft": round(width, 3), 
        "footprint_depth_ft": round(depth, 3),
        "dimensions": {"width": round(width, 3), "depth": round(depth, 3), "height": round(float(row.get("height_in", 0)) / 12.0, 3)},
        "telemetry_defaults": _get_telemetry_defaults(row)
    })
    return fixture

def _json_value(value: Any) -> Any:
    if hasattr(value, "item"):
        return value.item()
    return value

def build_layout(constraints: dict[str, Any]) -> dict[str, Any]:
    """Run the optimizer and return a JSON-ready layout response."""
    length_ft = max(float(constraints.get("length_ft", 10)), 4.0)
    width_ft = max(float(constraints.get("width_ft", 8)), 4.0)
    budget = max(float(constraints.get("budget", 15000)), 0.0)
    theme = str(constraints.get("theme", "Minimalist Modern"))
    layout_style = str(constraints.get("layout_style", "Zoned Wet/Dry"))
    must_have_products = [str(p) for p in constraints.get("must_have_products", [])]

    selected = optimize_layout({
        "length_ft": length_ft,
        "width_ft": width_ft,
        "budget_usd": budget,
        "theme": theme,
        "layout_style": layout_style,
        "must_have_products": must_have_products,
    })
    fixtures = place_fixtures(selected, length_ft, width_ft, layout_style)

    requested_but_missing = sorted(
        set(must_have_products) - {str(item.get("product_id")) for item in fixtures}
    )
    
    total_cost = sum(float(item["base_price_usd"]) for item in fixtures)
    space = sum(float(item["clearance_required_sqft"]) for item in fixtures)
    water = sum(float(item.get("water_usage_gpm", 0)) for item in fixtures)
    power = sum(_calculate_initial_power(item) for item in fixtures)
    
    return {
        "room": {"length_ft": length_ft, "width_ft": width_ft, "theme": theme, "budget": budget, "layout_style": layout_style},
        "fixtures": fixtures,
        "total_cost": round(total_cost, 2),
        "space_allocated_sqft": round(space, 2),
        "space_limit_sqft": round(length_ft * width_ft * MAX_SPACE_RATIO, 2),
        "water_demand_gpm": round(water, 2),
        "power_demand_w": round(power, 2),
        "catalog_count": int(len(load_catalog())),
        "unmet_must_haves": requested_but_missing,
    }
