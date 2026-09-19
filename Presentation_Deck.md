# KOHLER AI Bathroom Designer

## Slide 1: From Brief To Bathroom

### Core approach

Turn a small set of human decisions into a feasible, visual bathroom plan:

- Room length and width
- Budget
- Design language
- Layout strategy

### The product promise

**A considered room, resolved through intelligence.**

The system combines catalog intelligence, spatial constraints, and a real-time 3D digital twin so users can move from a rough brief to an inspectable bathroom collection in seconds.

### Current experience

1. Define the room.
2. Resolve a collection.
3. Explore the 3D room.
4. Inspect fixtures and finishes.
5. Review water demand, space, cost, and BOM.

---

## Slide 2: Architecture That Keeps Decisions Explainable

### System flow

```text
User brief
   |
   v
FastAPI request validation
   |
   v
Catalog scoring + PuLP constraints
   |
   v
Wall-aware fixture placement
   |
   +--> JSON layout --> Metrics + BOM
   |
   +--> Room + fixtures --> Three.js digital twin
```

### Core boundaries

- **FastAPI** owns HTTP validation, routes, static assets, and errors.
- **Optimizer** owns scoring, budget, category, clearance, and placement logic.
- **Catalog CSV** remains the source of truth for product data.
- **Three.js** owns room geometry, fixture models, interaction, and simulation.
- **Documentation** keeps product, architecture, design, rules, and task decisions synchronized.

### Resilience

PuLP/CBC is the preferred solver. A deterministic greedy fallback keeps the application usable when the solver is unavailable.

---

## Slide 3: Practical Stack, Rich Interaction

### Technology stack

| Layer | Technology | Role |
| --- | --- | --- |
| API | FastAPI + Pydantic | Typed request boundary and JSON API |
| Optimization | PuLP + Pandas | Catalog scoring and constrained selection |
| Frontend | HTML + CSS + JavaScript | Responsive planning workflow |
| 3D | Three.js + OBJLoader | Digital twin, camera, selection, assets |
| Data | CSV catalog | Product dimensions, pricing, water, material, eco data |
| Delivery | Docker + Uvicorn | Reproducible local and container runtime |
| Quality | Pytest + smoke test | API contract and constraint checks |

### Interaction principles

- The first screen is the working tool, not a marketing page.
- Fixture selection opens a focused inspection HUD.
- Finish swatches change the active fixture only.
- Water stays inside basin boundaries.
- Bubbles and foam are intentionally excluded.
- The interface remains usable across desktop and mobile widths.

---

## Slide 4: Innovation Pitch

### The opportunity

Bathroom planning is usually split across spreadsheets, product pages, floor-plan sketches, and disconnected visualizers. That fragmentation hides tradeoffs until late in the process.

### The innovation

**Constraint-aware generative merchandising:** the application does not merely recommend attractive products. It resolves a collection that is simultaneously:

- Budget-aware
- Space-aware
- Category-aware
- Placement-aware
- Theme-aware
- Water-aware

### Why it matters

The result is a bridge between computational planning and human judgment. Users can understand *why* a collection works, then immediately experience it spatially through the digital twin.

### Expansion path

- Saved and comparable layouts
- PDF/image export for clients
- Accessibility and code-compliance checks
- Offline-bundled frontend assets
- Catalog search and richer finish intelligence

### Closing line

**Design intent in. A buildable bathroom direction out.**
