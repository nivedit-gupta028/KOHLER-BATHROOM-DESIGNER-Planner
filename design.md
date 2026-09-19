# Design Specification

## Design Direction

KOHLER AI Bathroom Designer uses a restrained editorial interface inspired by premium bathroom materials and architectural planning tools. The visual language should feel precise, calm, tactile, and useful for repeated planning work.

The experience prioritizes:

- Clear hierarchy over decoration.
- Dense but readable planning controls.
- Strong contrast between the brief, resolved room, and bill of materials.
- Material-inspired color accents instead of loud gradients.
- The 3D room as the primary visual experience.

## Visual Language

### Color Roles

| Role | Current direction |
| --- | --- |
| Ink background | Near-black page and viewport foundation |
| Panel background | Slightly lifted charcoal surfaces |
| Brass accent | Primary action, selected state, labels, and progress |
| Ivory text | Primary headings and important values |
| Muted text | Supporting copy, metadata, and secondary labels |
| Water blue | Water rates and simulation controls |
| Warning amber | Solver warnings and budget-related notices |

Color should communicate hierarchy and state. Brass is reserved for emphasis and actions rather than being applied to every surface.

### Typography

- Display headings use `Playfair Display` for a considered, editorial character.
- Interface controls and body copy use `DM Sans` for compact readability.
- Eyebrow labels use uppercase text with increased letter spacing.
- Metric values use display typography with compact units in the interface font.
- Do not use oversized hero typography inside compact panels or HUDs.

## Page Structure

The application is organized into three primary areas:

1. **Project Brief**: fixed-width sidebar on desktop, stacked above the workspace on smaller screens.
2. **Resolved Layout**: title, result metrics, interactive 3D viewport, and inspection overlays.
3. **Selected Fixtures**: bill-of-materials table for scanning and comparison.

```text
Header
├── KOHLER identity
└── Engine status

Main
├── Project brief
│   ├── Room dimensions
│   ├── Budget
│   ├── Design language
│   ├── Layout style
│   ├── Planning area
│   └── Solve action
└── Workspace
    ├── Resolved layout heading
    ├── Metrics
    ├── 3D viewport
    │   ├── Viewport controls/status
    │   ├── Preliminary specifications
    │   ├── Fixture HUD
    │   └── Scene badge
    └── Bill of materials
```

## Project Brief

The brief is a focused form for repeated use.

- Group related numeric inputs together.
- Show units beside labels instead of hiding them in placeholder text.
- Keep select controls consistent in height and border treatment.
- Use the planning-area readout as a quiet summary, not another primary card.
- The solve button is the strongest action on the page.
- The current brief includes five design languages and three layout styles.
- Do not reintroduce the removed must-have product selector without updating the product requirements.

## Metrics

The result area presents three primary metric cards:

- Total cost
- Space allocated
- Water demand

The allocated-space card includes a progress track against the maximum allowed space. Metric cards use restrained borders, a dark material surface, a brass value, and muted supporting text.

Power demand may exist in the API response for integrations but is not a primary visual metric.

## 3D Viewport

The viewport is the main product surface rather than a decorative preview.

- Use a stable height so the surrounding layout does not shift.
- Keep the viewport header readable over the scene.
- Support orbit, zoom, and click-to-inspect behavior.
- Keep fixture labels legible without dominating the room.
- Use the lower scene badge for theme and room dimensions.
- Keep overlays anchored to the viewport edges and constrained on mobile.
- Avoid full-height opaque or oversized transparent planes that hide the room.
- Preserve clear sight lines to the bathtub, sink, shower, and floor.

## Fixture HUD

The fixture HUD is a compact inspection panel for the selected item.

It should show:

- Fixture name
- Price
- Category and product identifier
- Dimensions
- Water rate when applicable
- Material finish swatches
- Water toggle when applicable

The panel should appear near the viewport edge and never cover the primary fixture being inspected more than necessary. The close action must be keyboard accessible and visually identifiable.

## Preliminary Specifications Panel

The preliminary panel is an optional engineering summary overlay. It contains:

- Spatial layout
- Circulation ratio
- Financial variance
- Peak water flow
- Fixture allocation
- Water simulation action
- Camera reset action

This panel uses smaller type and tighter spacing than the main result area. It should remain readable over the 3D scene through a dark, translucent surface and clear border.

## Water Visuals

Water effects should communicate activity without overwhelming the room.

Allowed effects:

- Confined water surface
- Stream
- Ripples
- Caustic shimmer
- Steam
- Drain vortex
- Splash droplets

Disallowed effects:

- Bubbles
- Foam bursts
- Overflow foam rings
- Water surfaces extending beyond the sink or bathtub
- Effects that obscure the fixture or room boundary

All optional effect systems must be safe when disabled and must not cause a browser exception when the simulation is toggled.

## Materials And Finishes

Finish controls use small circular swatches because the user is selecting a material, not a text option.

Finish behavior:

- Swatches must have visible borders against both dark and light finishes.
- Hover and focus states should use the brass accent.
- Applying a finish must affect only the active fixture.
- Transparent water materials must not be replaced by opaque finish materials.
- Finish names should be available through button tooltips or accessible labels.

## Tables And Data Density

The bill of materials is optimized for scanning:

- Use uppercase compact table headers.
- Keep fixture names visually prominent.
- Use category pills for quick classification.
- Align prices to the right.
- Keep dimensions and materials in consistent columns.
- Preserve horizontal scrolling on small screens rather than compressing unreadable columns.

## Motion

Motion should clarify state and spatial behavior.

- Use a short eased transition when HUDs and specification panels appear.
- Animate water only while its system is active.
- Use the solve-button loading state during API requests.
- Avoid unnecessary continuous UI animations outside the 3D simulation.
- Respect `prefers-reduced-motion` by minimizing transitions and animation duration.

## Responsive Behavior

### Desktop

- Use a two-column layout with a project sidebar and flexible workspace.
- Keep the sidebar readable without requiring horizontal scrolling.
- Let the viewport and BOM use the available workspace width.

### Tablet

- Allow the sidebar to stack above the workspace when the two-column layout becomes cramped.
- Preserve metric card grouping and viewport overlays.

### Mobile

- Stack the project brief before the resolved layout.
- Use one metric per row or a compact two-column arrangement where it remains readable.
- Keep the viewport at a stable reduced height.
- Hide nonessential viewport instruction text while preserving controls and status.
- Constrain HUD and preliminary panels to the viewport width.
- Allow the BOM table to scroll horizontally.

## Accessibility

- Use semantic labels for all form controls.
- Keep visible focus states on inputs, selects, buttons, and swatches.
- Use accessible names for close, reset, camera, and water controls.
- Do not rely on color alone to communicate warnings or selected states.
- Maintain readable contrast for muted text against panel surfaces.
- Preserve keyboard access to the form and overlay actions.
- Respect reduced-motion preferences.
- Provide a meaningful `aria-label` for the interactive 3D viewport.

## Interaction States

Every major action should have a clear state:

- **Idle**: controls are ready and the room may be awaiting a result.
- **Solving**: solve button is disabled and communicates progress.
- **Resolved**: metrics, viewport, and BOM show the latest layout.
- **Selected**: fixture HUD is visible and the active fixture is emphasized.
- **Water active**: water controls indicate the running state and effects animate.
- **Error**: the viewport presents a clear failure message while the form becomes usable again.

## Design Guardrails

- Do not add marketing-style hero sections; the tool should open directly into the planning workflow.
- Do not add nested cards or decorative card stacks.
- Do not use rounded text pills where a familiar icon or simple control is clearer.
- Do not use a single dominant purple, blue, or beige palette.
- Do not sacrifice room visibility for decorative glass, steam, or water effects.
- Do not introduce new layout modes without updating `prd.md`, `Architecture.md`, `rules.md`, and `task.md`.
- Keep visible labels and control text within their containers at desktop and mobile widths.
