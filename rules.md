# Project Rules

This document defines the business, layout, rendering, API, and deployment rules for KOHLER AI Bathroom Designer.

## Product Selection Rules

1. Product data must come from `data/catalog_expanded_100.csv`.
2. The optimizer may select at most one product from each catalog category.
3. The current user interface does not provide a must-have product selector.
4. Product selection must respect the requested budget.
5. Product selection must respect the room's maximum allocated floor area.
6. A valid result should contain at least one fixture when the room and budget allow a feasible selection.
7. Catalog records must retain their source dimensions, price, category, water usage, material, aesthetic, and eco fields.

## Room And Space Rules

1. Room length and width must be between 4 and 40 feet.
2. Budget must be zero or greater.
3. Maximum allocated floor area is 70% of room area:

   ```text
   maximum allocated area = room length x room width x 0.70
   ```

4. Fixture footprints must be calculated from catalog dimensions.
5. Fixtures should remain inside room boundaries whenever a feasible placement exists.
6. Fixtures must maintain the configured placement gap.
7. Toilet placement must include the required centerline clearance used by the optimizer.
8. Mirrors should be placed above a vanity when a vanity is present.
9. Wall-first placement takes priority over arbitrary central placement.

## Layout Rules

The supported layout styles are:

- `Zoned Wet/Dry`: wet fixtures are anchored toward the wet zone and dry fixtures toward the opposite wall.
- `Linear Single-Wall`: fixtures are arranged along one wall and must fit the available wall length.
- `Parallel Galley`: wet and dry fixtures are placed on opposing sides of the room.

Unsupported layout values use the linear single-wall fallback behavior.

Removed layout modes must not be reintroduced without updating the product requirements and architecture documents:

- Island Focal Point
- Symmetry Axis

## Design Language Rules

The user-facing design language choices are:

- Minimalist Modern
- Japanese Zen
- Classic Luxury
- Mediterranean Coastal
- Biophilic Sanctuary

The selected design language must be sent to the optimizer and applied to the Three.js room through floor, wall, grout, and lighting properties.

## 3D Scene Rules

1. Each resolved layout must clear the previous room group before rebuilding the scene.
2. Every selectable fixture mesh must retain a reference to its fixture group through `userData.fixtureGroup`.
3. Known OBJ assets should be normalized to the catalog fixture dimensions.
4. Procedural geometry should be used when a model asset cannot load and a fixture fallback exists.
5. Fixture labels must remain associated with their fixture group.
6. The room must include floor, walls, lighting, and theme-specific surface treatment.
7. Shower enclosure geometry must not use oversized full-height planes that obscure the room or bathtub.
8. The 3D scene must remain usable with orbit, zoom, and click-to-inspect interactions.

## Water Simulation Rules

1. Water simulations may only be attached to compatible fixture groups.
2. Water must remain inside the configured sink or bathtub surface.
3. Water surfaces must use inset fixture geometry rather than extending beyond the fixture boundary.
4. Particle systems must be constrained to the basin radius when a radius is configured.
5. Bubble and foam effects must remain disabled.
6. Ripples, caustics, steam, vortex motion, and splash droplets may be enabled.
7. Every optional water effect must be null-safe when disabled.
8. Turning a simulation off must hide its effects and reset the pool level.
9. Water must automatically stop when the camera is outside the configured interaction distance.
10. Water simulation failures must not prevent the rest of the room from rendering.

## API Rules

1. `GET /api/health` must return service status with HTTP 200.
2. `POST /api/optimize` must validate input through Pydantic.
3. API errors must return an explicit HTTP error response with a useful detail message.
4. The optimize response must include room data, fixtures, total cost, allocated space, space limit, water demand, power demand, and catalog count.
5. The frontend must send `length_ft`, `width_ft`, `budget`, `theme`, and `layout_style`.
6. The frontend must not send or expose a must-have product selector.
7. `GET /api/catalog` may remain available for integrations and inspection.
8. API response values must be JSON serializable.

## Optimizer Rules

1. Use PuLP/CBC when available.
2. If the solver is unavailable or cannot find an optimal result, use deterministic greedy selection.
3. Theme preference may affect scoring but must not bypass budget, category, or area constraints.
4. Linear single-wall feasibility calculations must use the same along-wall dimension rule as actual placement.
5. Selection and placement must be deterministic for identical inputs and catalog data.
6. Power demand may be calculated for API consumers but must not be shown as a primary frontend metric.

## Frontend Rules

1. The solve button must show a working state while an optimization request is pending.
2. The solve button must return to an enabled state after success or failure.
3. Failed requests must show an unresolved-room error state.
4. Metrics must update from the latest resolved layout.
5. The bill of materials must reflect the latest fixture collection.
6. Selecting a fixture must open its inspection HUD.
7. Material finish controls must apply only to the active fixture.
8. Preliminary specifications must reflect the latest room dimensions, budget, flow, and fixture count.
9. The interface must remain usable on desktop and mobile widths.
10. Reduced-motion preferences must be respected by CSS transitions and animations.

## Asset And Dependency Rules

1. Backend dependencies belong in `requirements.txt`.
2. Runtime assets belong under `frontend/assets/`.
3. The backend must serve frontend assets through FastAPI routes or the `/static` mount.
4. The browser requires WebGL support.
5. The current frontend loads Tailwind CSS, fonts, and Three.js from public CDNs, so the browser needs network access to those resources.
6. Do not add generated build output or local virtual-environment files to the source tree.

## Deployment Rules

1. Local development uses a Python virtual environment.
2. The application is started with Uvicorn on port 8000 by default.
3. Docker must use the repository `Dockerfile` and expose container port 8000.
4. The Docker image must include the backend, frontend, and catalog data.
5. Deployment instructions must remain synchronized with `README.md`.

## Validation Rules

Run from the `deliverable` directory after installing dependencies:

```bash
python -m pytest -q
python smoke_test.py
```

Before submitting a change:

1. Run the relevant automated tests.
2. Run editor diagnostics on changed source files.
3. Check that new frontend effects are null-safe.
4. Confirm that changed selectors, API fields, and documentation agree.
5. Confirm that water remains visually confined and does not introduce bubbles or foam.
