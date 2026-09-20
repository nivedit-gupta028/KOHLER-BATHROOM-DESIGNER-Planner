# KOHLER AI Bathroom Designer

A FastAPI and Three.js bathroom planning application. The backend selects a coordinated fixture collection from the 100-item catalog, checks budget and floor-space constraints, and calculates non-overlapping placements. The frontend presents the result as an interactive 3D room with fixture inspection, finish controls, live water simulation, room metrics, and a bill of materials.

## Demonstration Video

[Watch the project demonstration video](demonstration.mp4)

The video is stored with Git LFS because it exceeds GitHub's standard file-size limit.

### Browser access

1. Open the [KOHLER Bathroom Designer repository](https://github.com/nivedit-gupta028/KOHLER-BATHROOM-DESIGNER-Planner).
2. Select `demonstration.mp4`.
3. Choose **Download** or **View raw**.

### Download with Command Prompt

Install [Git LFS](https://git-lfs.com/) first, then run:

```cmd
git clone https://github.com/nivedit-gupta028/KOHLER-BATHROOM-DESIGNER-Planner.git
cd KOHLER-BATHROOM-DESIGNER-Planner
git lfs install
git lfs pull
start demonstration.mp4
```

## Features

- Room planning inputs for length, width, and budget.
- Five design languages: Minimalist Modern, Japanese Zen, Classic Luxury, Mediterranean Coastal, and Biophilic Sanctuary.
- Three placement strategies: Zoned Wet/Dry, Linear Single-Wall, and Parallel Galley.
- PuLP optimization with at most one fixture per catalog category.
- Budget limit and 70% maximum floor-clearance allocation.
- Wall-first, non-overlapping fixture placement.
- Three.js digital twin with orbit, zoom, fixture selection, material finish controls, and preliminary specifications.
- Water simulation for compatible fixtures with confined surfaces, ripples, caustics, steam, vortex motion, and splash droplets. Bubble and foam effects are disabled.
- Bill of materials with dimensions, categories, materials, and pricing.

## Project Structure

```text
deliverable/
├── backend/
│   ├── main.py                 # FastAPI application and routes
│   └── optimizer.py            # Catalog scoring, optimization, and placement
├── data/
│   └── catalog_expanded_100.csv
├── frontend/
│   ├── index.html              # Application shell and controls
│   ├── app.js                  # Three.js scene and browser behavior
│   ├── styles.css              # Application styling
│   └── assets/                 # OBJ fixture models
├── tests/
│   └── test_api.py             # API and optimizer contract tests
├── Dockerfile
├── requirements.txt
└── smoke_test.py
```

## Requirements

For local development:

- Python 3.12 recommended
- `pip`
- A modern browser with WebGL support

The HTML page loads Tailwind CSS, fonts, and Three.js modules from public CDNs. The browser therefore needs network access to render the complete interface. The FastAPI server and catalog itself run locally or inside Docker.

## Run Locally With Python

Run these commands from the `deliverable` directory.

### Windows PowerShell

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### macOS or Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Open [http://localhost:8000](http://localhost:8000) after the server starts.

To stop the server, press `Ctrl+C`. To leave the virtual environment, run `deactivate`.

## Run With Docker

Run these commands from the `deliverable` directory.

### Build the image

```bash
docker build -t kohler-ai-designer .
```

### Start the application

```bash
docker run --rm --name kohler-ai-designer -p 8000:8000 kohler-ai-designer
```

Open [http://localhost:8000](http://localhost:8000). Stop the container with `Ctrl+C`.

On Windows PowerShell, the same Docker commands work unchanged. If port `8000` is already in use, map another host port:

```powershell
docker run --rm --name kohler-ai-designer -p 8080:8000 kohler-ai-designer
```

Then open [http://localhost:8080](http://localhost:8080).

## API

### Health check

```http
GET /api/health
```

Example response:

```json
{"status":"ok","service":"kohler-ai-designer"}
```

### Optimize a room

```bash
curl -X POST http://localhost:8000/api/optimize \
  -H "content-type: application/json" \
  -d '{"length_ft":10,"width_ft":8,"budget":8000,"theme":"Minimalist Modern","layout_style":"Zoned Wet/Dry"}'
```

The request fields are:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `length_ft` | number | `10` | Room length from 4 to 40 feet |
| `width_ft` | number | `8` | Room width from 4 to 40 feet |
| `budget` | number | `15000` | Maximum budget in USD |
| `theme` | string | `Minimalist Modern` | Aesthetic preference used for catalog scoring |
| `layout_style` | string | `Zoned Wet/Dry` | Placement strategy |

The response includes the resolved `room`, `fixtures`, `total_cost`, `space_allocated_sqft`, `space_limit_sqft`, `water_demand_gpm`, `power_demand_w`, and `catalog_count`. The frontend displays cost, allocated space, and water demand; power remains available in the API response for integrations.

Other available routes:

- `GET /api/catalog` returns the catalog records.
- `GET /` serves the frontend.
- `GET /app.js` and `GET /styles.css` serve the frontend assets.

## Tests And Validation

Install the requirements first, then run from `deliverable`:

```bash
python -m pytest -q
```

Run the API smoke test:

```bash
python smoke_test.py
```

The tests verify the health route, optimizer response contract, budget and space limits, supported fixture categories, and non-overlapping placement. The smoke test makes a real in-process API request and prints the selected fixtures and totals.

## Backend Notes

- `backend/main.py` mounts the frontend at `/`, exposes the API routes, and serves model assets under `/static`.
- `backend/optimizer.py` loads `data/catalog_expanded_100.csv`, scores products by aesthetic and eco criteria, applies PuLP when available, and falls back to deterministic greedy selection if the CBC solver is unavailable.
- The catalog is the source of truth for product dimensions, prices, water usage, categories, and material information.
- The Docker image uses Python 3.12, installs `requirements.txt`, copies the backend, frontend, and catalog, and starts Uvicorn on port `8000`.
