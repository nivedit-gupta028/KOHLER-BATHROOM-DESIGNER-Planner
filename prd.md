# Product Requirements Document

## Product

**KOHLER AI Bathroom Designer** is a browser-based bathroom planning tool that converts room dimensions, budget, and design intent into an optimized fixture collection and an interactive 3D room view.

## Status

This document describes the current product scope and the behavior implemented in the repository.

## Problem

Bathroom planning requires balancing fixture selection, budget, available floor area, clearances, layout logic, materials, and visual intent. Users need a fast way to explore viable room arrangements without manually comparing every catalog item or drawing each option.

## Goals

- Generate a feasible bathroom fixture collection from a structured catalog.
- Keep the selected collection within the user's budget.
- Keep allocated fixture clearance within 70% of the room floor area.
- Place fixtures using wall-aware, non-overlapping coordinates.
- Let users compare a small set of coherent design languages and layout strategies.
- Make the result inspectable through a responsive 3D digital twin.
- Show clear cost, area, water-demand, and bill-of-materials information.
- Provide a lightweight water simulation that remains visually confined to compatible fixtures.
- Support local Python development and Docker deployment.

## Users

- Homeowners exploring bathroom renovation concepts.
- Interior designers testing early room arrangements.
- Retail or showroom staff demonstrating fixture collections.
- Developers integrating bathroom optimization into another workflow.

## User Flow

1. User opens the application.
2. User enters room length, room width, and budget.
3. User chooses a design language.
4. User chooses a layout style.
5. User selects **Solve & Generate Layout**.
6. The optimizer returns a fixture collection and placement plan.
7. The 3D room renders with the selected collection.
8. User orbits and zooms the room, selects fixtures, reviews specifications, and changes material finishes.
9. User can open preliminary specifications and run or stop water simulation.
10. User reviews the bill of materials and total cost.

## Functional Requirements

### FR-1: Project brief

The interface must accept:

- Length in feet, from 4 to 40.
- Width in feet, from 4 to 40.
- Budget in USD, zero or greater.
- One design language.
- One layout style.

The planning area must update as length and width change.

### FR-2: Design languages

The interface must provide these five design languages:

- Minimalist Modern
- Japanese Zen
- Classic Luxury
- Mediterranean Coastal
- Biophilic Sanctuary

The selected language must be included in the optimization request and applied to room colors, materials, grout, and lighting.

### FR-3: Layout styles

The interface must provide these three layout styles:

- Zoned Wet/Dry
- Linear Single-Wall
- Parallel Galley

The selected style must influence fixture placement. Unsupported API values must fall back to the linear single-wall placement behavior.

### FR-4: Catalog optimization

The optimizer must:

- Load product records from `data/catalog_expanded_100.csv`.
- Score products using aesthetic and eco criteria.
- Select no more than one product per category.
- Stay within the requested budget.
- Stay within 70% of the room floor area based on required clearance.
- Use PuLP/CBC when available.
- Use deterministic greedy selection if the solver is unavailable.

Supported catalog categories include Toilet, Vanity, Shower, Bathtub, Mirror, and Sensor.

### FR-5: Placement

The placement engine must:

- Calculate fixture footprints from catalog dimensions.
- Keep fixtures inside the room bounds when feasible.
- Apply wall-first placement rules.
- Maintain a placement gap between fixtures.
- Account for toilet centerline clearance.
- Return fixture coordinates, orientation, wall orientation, and footprint dimensions.

### FR-6: 3D visualization

The application must render:

- Room floor, walls, grout/seam guides, and lighting.
- Procedural or catalog-backed fixture geometry.
- Fixture labels and selectable fixture groups.
- OrbitControls for orbit and zoom.
- A selected fixture HUD with price, dimensions, category, water rate, and material finish controls.
- A bill of materials below the viewport.

The scene must not use oversized shower enclosure planes that obscure the room or bathtub.

### FR-7: Water simulation

Compatible water fixtures must support an interactive simulation that can be toggled from the fixture HUD or preliminary panel.

Enabled effects may include:

- Water stream
- Confined water surface
- Ripples
- Caustics
- Steam
- Drain vortex
- Splash droplets

Bubble and foam effects must remain disabled. Water surfaces and particles must remain within the fixture boundary or the configured basin radius.

### FR-8: Metrics and specifications

The interface must display:

- Total cost
- Allocated space
- Space limit and progress
- Water demand
- Fixture count
- Preliminary room dimensions
- Circulation ratio
- Budget variance
- Peak water flow

Power demand may remain available in the API response but must not be shown as a primary UI metric.

### FR-9: Error handling

The application must show an actionable error state when the optimizer request fails or the backend is unavailable. The solve button must return to an enabled state after a request completes or fails.

## API Requirements

### Health

`GET /api/health` must return an HTTP 200 response with service status.

### Optimize

`POST /api/optimize` accepts:

```json
{
  "length_ft": 10,
  "width_ft": 8,
  "budget": 8000,
  "theme": "Minimalist Modern",
  "layout_style": "Zoned Wet/Dry"
}
```

The response must include:

- `room`
- `fixtures`
- `total_cost`
- `space_allocated_sqft`
- `space_limit_sqft`
- `water_demand_gpm`
- `power_demand_w`
- `catalog_count`

Each fixture must preserve catalog fields and include placement coordinates, orientation, footprint data, and telemetry defaults where available.

### Catalog

`GET /api/catalog` returns the catalog records for integrations and inspection. The current frontend does not expose a must-have product selector.

## Non-Functional Requirements

- The application must run with Python 3.12 and the dependencies in `requirements.txt`.
- The application must run in the provided Docker image on port 8000.
- The frontend must support modern browsers with WebGL.
- The UI must remain usable on desktop and mobile viewport sizes.
- The optimizer must return deterministic fallback results when CBC is unavailable.
- Catalog data must remain external to the optimizer code.
- Browser access to the public CDN resources used by the frontend is required for the complete visual experience.

## Acceptance Criteria

- A valid default request renders a room with at least one fixture.
- Total cost does not exceed the requested budget.
- Allocated space does not exceed the 70% room-space limit.
- Fixtures returned by the optimizer do not overlap under the placement rules.
- Changing theme changes the room aesthetic.
- Changing layout style changes the placement strategy.
- Selecting a fixture opens its inspection HUD.
- Material finish controls update the selected fixture where supported.
- Water simulation can start and stop without a browser exception.
- Bubble and foam particles are not rendered.
- Water does not visibly spill outside the sink or bathtub basin.
- The API health test, optimizer contract test, and smoke test pass in an installed environment.
- The application can be started through both local Python and Docker workflows documented in `README.md`.

## Validation Commands

Run from the `deliverable` directory after installing dependencies:

```bash
python -m pytest -q
python smoke_test.py
```

## Out Of Scope

- User accounts, saved projects, and cloud persistence.
- Real-time multi-user editing.
- Final construction drawings or permit documentation.
- Manufacturer inventory, ordering, shipping, or checkout.
- Automatic import of arbitrary bathroom floor plans.
- Native mobile applications.
- A must-have product selection UI.
- Island Focal Point and Symmetry Axis layout modes.

## Future Opportunities

- Save and compare multiple generated layouts.
- Export a layout summary as PDF or image.
- Add accessibility and code-compliance checks beyond the current clearance rules.
- Add fixture filtering and category preference controls.
- Replace CDN dependencies with locally bundled frontend assets for offline deployments.
- Add browser-level visual regression tests for the 3D scene.
