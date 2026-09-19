# Project Tasks

## Completed Baseline

- [x] Create FastAPI application and static frontend routes.
- [x] Add catalog-backed fixture optimization.
- [x] Enforce one fixture per category.
- [x] Enforce budget and 70% maximum allocated floor area.
- [x] Add wall-first, non-overlapping fixture placement.
- [x] Add five design languages.
- [x] Add three supported layout styles:
  - [x] Zoned Wet/Dry
  - [x] Linear Single-Wall
  - [x] Parallel Galley
- [x] Remove the must-have products UI and frontend request wiring.
- [x] Remove Island Focal Point and Symmetry Axis layout modes.
- [x] Add responsive project brief controls.
- [x] Add Three.js room, fixture, lighting, and camera setup.
- [x] Add OBJ asset loading with procedural fixture fallbacks.
- [x] Add fixture selection and inspection HUD.
- [x] Add material finish controls.
- [x] Add preliminary room specifications panel.
- [x] Add cost, space, water-demand, and fixture-count displays.
- [x] Remove the primary power metric from the UI.
- [x] Add bill-of-materials rendering.
- [x] Add confined sink and bathtub water surfaces.
- [x] Disable foam and bubble effects.
- [x] Keep ripples, caustics, steam, vortex motion, and splash droplets null-safe.
- [x] Remove oversized shower glass planes that obstruct the room view.
- [x] Add local Python and Docker setup documentation.
- [x] Add `README.md`, `prd.md`, `Architecture.md`, and `rules.md`.

## Immediate Validation

- [ ] Install the dependencies from `requirements.txt` in a clean Python environment.
- [ ] Run the API tests:

  ```bash
  python -m pytest -q
  ```

- [ ] Run the smoke test:

  ```bash
  python smoke_test.py
  ```

- [ ] Build the Docker image:

  ```bash
  docker build -t kohler-ai-designer .
  ```

- [ ] Start the Docker container and open the application in a browser.
- [ ] Confirm `GET /api/health` returns HTTP 200.
- [ ] Confirm the default layout resolves with fixtures.
- [ ] Confirm budget and allocated-space values remain within limits.
- [ ] Confirm each supported layout produces a valid response.
- [ ] Confirm each visible design language changes the room treatment.
- [ ] Confirm fixture selection opens the HUD.
- [ ] Confirm material finish changes affect only the selected fixture.
- [ ] Start and stop water simulation on a sink or bathtub.
- [ ] Confirm water remains inside the fixture boundary.
- [ ] Confirm bubbles and foam are not rendered.
- [ ] Confirm splash, ripple, steam, caustic, and vortex effects do not throw browser errors.
- [ ] Confirm the room remains visible without shower glass obstruction.
- [ ] Test the layout at desktop and mobile viewport widths.

## Quality And Maintenance

- [ ] Add browser-level tests for solve, fixture selection, and water toggling.
- [ ] Add visual regression screenshots for the default room and each design language.
- [ ] Add a test for the deterministic greedy optimizer fallback.
- [ ] Add tests for invalid dimensions, invalid budget, and unsupported layout values.
- [ ] Add tests for fixture placement at the smallest supported room size.
- [ ] Add a browser test that verifies water particle positions remain within the configured basin boundary.
- [ ] Add local asset bundling for offline operation instead of relying on public CDNs.
- [ ] Review model scaling and orientation for every OBJ asset in the catalog.
- [ ] Add structured logging for API failures and optimizer fallback events.
- [ ] Add a production deployment configuration with health checks and restart policy.

## Product Enhancements

- [ ] Add saved projects and named layout variations.
- [ ] Add side-by-side layout comparison.
- [ ] Add image or PDF export for resolved layouts and bills of materials.
- [ ] Add accessibility and code-compliance checks beyond current clearance rules.
- [ ] Add fixture category filters without reintroducing a must-have selector.
- [ ] Add catalog search and product detail links.
- [ ] Add richer material libraries with theme-aware finish recommendations.
- [ ] Add undo and reset controls for interactive finish changes.

## Documentation Maintenance

- [ ] Update `README.md` when setup commands or API fields change.
- [ ] Update `prd.md` when product scope or acceptance criteria change.
- [ ] Update `Architecture.md` when module boundaries or runtime flow change.
- [ ] Update `rules.md` when optimizer, placement, water, or deployment rules change.
- [ ] Keep this task list synchronized with completed work before releases.

## Release Checklist

- [ ] All automated tests pass.
- [ ] Smoke test passes.
- [ ] Docker image builds successfully.
- [ ] Local Python startup works from a clean virtual environment.
- [ ] API health endpoint responds.
- [ ] Default layout renders in a supported browser.
- [ ] No console errors occur during solve, fixture selection, or water simulation.
- [ ] Mobile layout remains usable.
- [ ] Documentation reflects the released behavior.
