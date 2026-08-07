# Handoff: CogniTree Redesign (Organic design system)

## Overview
A visual redesign of CogniTree's core screens — Dashboard, Visual Tree canvas, Node Detail drawer, Resource Vault, and the "New Tree" creation modal — moving the app from its current Tailwind indigo/slate look to the **Organic** design system (warm cream ground, rounded shapes, Caprasimo/Figtree type), with the accent recolored to a mature slate-blue per product direction (not Organic's default terracotta).

This redesign targets the existing repo **`yanidv-lab/CongiTree`** (React + TypeScript + Vite). It is meant to **replace** the current visual treatment of:
- `src/components/DashboardView.tsx`
- `src/components/Header.tsx`
- `src/components/VisualTreeGraph.tsx`
- `src/components/NodeDetailDrawer.tsx`
- `src/components/ResourceVaultView.tsx`
- `src/components/TopicInputModal.tsx`

without changing their underlying data model, state, or behavior (see `src/types.ts`, `src/lib/treeStore.ts`, `src/App.tsx` — unchanged).

## About the Design Files
The bundled file `CogniTree_Mockups.dc.html` is a **design reference built in HTML**, not production code to copy in verbatim. It shows the intended look, layout, and interaction states. Your task is to **recreate this design inside the existing CongiTree React + TypeScript + Tailwind codebase**, wiring it to the app's real state (`LearningTree`, `TreeNode`, `Resource` from `src/types.ts`) and real handlers (`App.tsx`), rather than shipping this HTML file directly. Where Tailwind utility classes currently encode the old indigo/slate look, replace them with the new tokens below (either new Tailwind theme values or CSS custom properties — whichever the team prefers).

To view the reference: open `CogniTree_Mockups.dc.html` in a browser. It's a static, self-contained mockup with mock data — click nav tabs (Projects / Visual Tree / Resource Vault), click a tree card to jump to the canvas, click a branch card to open the Node Detail drawer, and click "New Tree" to see the creation modal.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, and shadows below are final values, not placeholders. Copy/microcopy shown is close to final tone (professional/serious) but can be swapped for the team's actual voice.

## Screens / Views

### 1. Dashboard (`DashboardView.tsx` + `Header.tsx` nav)
**Purpose:** Landing view listing all saved learning trees with progress at a glance.
**Layout:**
- Top nav bar: brand mark (circular icon badge, 38px, accent-filled) + "CogniTree" wordmark (Caprasimo) + "AI Learning Trees" outline tag, a pill-shaped segmented tab group (Projects / Visual Tree / Resource Vault) centered-ish, and a primary "+ New Tree" button on the right.
- Page header: H1 "Your learning trees" + one-line muted subtitle.
- Stats banner: one full-width rounded card, `display:flex; flex-direction:row`, split into 3 equal columns divided by 1px hairlines: (a) Average progress — 56px SVG progress ring + label, (b) Completed trees — icon badge (sage-tinted circle, checkmark) + count "X / Y", (c) Tasks & resources done — icon badge (accent-tinted) + count "X / Y".
- Tree grid: CSS grid, 3 columns (comfortable) or 4 columns (compact — see Design Tokens/props), 20px gap. Each card:
  - Header row: small icon badge (34px) + "Active" tag (accent-tinted pill, only on the currently-open tree) on the left; a 46px progress ring on the right.
  - Title (card-title, ~17px Caprasimo), 2-line clamp description (13px, 80% opacity).
  - "Tasks completed" row: label left, "done/total" bold right.
  - 6px thin progress bar, rounded, filled proportionally, color keyed to progress band (see tokens).
  - Footer row (top hairline divider): calendar icon + created date on the left; ghost icon-buttons (Export PDF, Delete) on the right.
  - Active tree's card gets a 1px accent-colored border.

### 2. Visual Tree canvas (`VisualTreeGraph.tsx`)
**Purpose:** Explore a single learning tree as a branching diagram; click any branch to inspect it.
**Layout:** An org-chart style diagram, absolutely positioned within a 1400×~600px canvas, horizontally scrollable on small viewports:
- Root card (280px wide, accent-100 tinted background, accent-300 border) centered at the top, tagged "Root topic" (outline tag).
- A single vertical connector drops from the root to a horizontal "bus" line, which drops to 4 core-branch cards (260px wide) evenly spaced in a row below.
- Each branch card: a level tag (see tag color mapping below), title, 1-line description, a small "X/Y tasks · N resources" stat row, and a 5px progress bar. Cards with no children yet (leaf branches) show a dashed-border ghost button "+ Grow this branch" instead.
- Two of the four branches have their own second-tier bus + 2 child cards (180px wide, more compact — title + stat line only), demonstrating deeper expansion.
- All connector lines are 2px, colored with the divider token, drawn as plain absolutely-positioned divs (no SVG needed) — vertical stems, horizontal buses, and drops to each child's top-center.
- Every branch/child card is clickable and opens the Node Detail drawer.

### 3. Node Detail drawer (`NodeDetailDrawer.tsx`)
**Purpose:** Inspect and work a single branch's checklist, resources, and notes; take branch actions.
**Layout:** A right-side slide-over panel, 420px wide, full height, over a dimmed backdrop (35% dark scrim) that closes the drawer on click.
- Header: level tag, H3 title, muted 1-line description, close (X) icon-button — all with padding 22px/24px and a bottom hairline.
- Body (scrollable, 20px/24px padding, 22px vertical gap between sections):
  - **Checklist** — h6 label, then rows of: 20px rounded-square checkbox (accent-2/sage fill + white check when done) + item text (line-through + 55% opacity when done). Whole row is clickable.
  - **Resources** — h6 label, then a card per resource: 30px icon badge (accent-tinted, document icon) + title (13px, bold, single-line ellipsis) + provider (11px, muted).
  - **Notes** — a labeled textarea, 3 rows, placeholder copy.
- Footer (top hairline, 16px/24px padding): primary "Grow branch" button (flex:1, bookmark-style icon), secondary "Split off" button, and a ghost icon-button for "Prune branch" (trash icon).

### 4. Resource Vault (`ResourceVaultView.tsx`)
**Purpose:** Browse every resource collected across the active tree in one flat list, filterable by type.
**Layout:**
- H2 "Resource vault" + muted subtitle.
- A row of pill filter buttons (All / Video / Book / Course / Article / Paper) — active filter filled accent, inactive transparent.
- A vertical stack (10px gap) of resource rows, each a card: 34px accent-tinted icon badge, title (14px bold) + "{provider} · from {node title}" (12px muted), a neutral type tag, and a 20px checkbox toggle on the right.

### 5. New Tree modal (`TopicInputModal.tsx`)
**Purpose:** Kick off generating a new learning tree.
**Layout:** Standard dialog-on-scrim pattern, dialog max-width 440px, rounded-lg, contains:
- Dialog title "Start a new learning tree".
- Topic text input (full width).
- "Depth" field using a 3-way segmented control: Basic / Comprehensive / Mastery (Basic selected by default).
- "Custom instructions (optional)" 2-row textarea.
- Actions row (right-aligned): Cancel (secondary), Generate tree (primary, sparkle icon).

## Interactions & Behavior
- Nav tabs switch between Dashboard / Visual Tree / Resource Vault views (no route change needed — can stay client-side state, matching current `viewMode` state in `App.tsx`).
- Clicking a dashboard tree card opens that tree in the Visual Tree canvas.
- Clicking any branch/child card in the canvas opens the Node Detail drawer for that node; clicking the scrim or the close (X) button closes it.
- Checklist items and vault resources toggle completed/incomplete on click (optimistic, local state in the mock — wire to `onToggleItem` / `onToggleResource` in the real app).
- Vault filter pills are single-select; clicking one filters the resource list by type.
- "New Tree" button (nav) opens the creation modal from any screen; Cancel/Generate both close it in the mock (wire Generate to the real `onSubmit`/`handleGenerateTree` flow).
- All interactive elements should get the Organic system's standard hover/pressed/focus-visible treatment (see Design Tokens → Interaction states) — do not leave default browser focus rings or hovers.

## State Management
No new state shapes are needed — this redesign is presentational. Reuse the existing app state:
- `viewMode` ('dashboard' | 'graph' | 'list' | 'vault') from `App.tsx` — rename/reuse for the 3 nav destinations shown here (note: this redesign does not include a dedicated "Steps/List" screen; confirm with product whether to keep, merge into Vault, or drop it).
- `selectedNode` (open/close the drawer) — existing.
- `stagingBranchApproval` / `isNewModalOpen` — existing, drives the New Tree modal.
- Node checklist/resource completion — existing `handleToggleItem` / `handleToggleResource`.

## Design Tokens

### Colors
Base ground/text/dividers and the sage secondary accent are **unchanged from Organic's default tokens** — only the primary accent was recolored from Organic's default terracotta to a mature slate-blue:

```
--color-bg:        #f5ead8
--color-surface:   #ebddc5
--color-text:      #201e1d
--color-divider:   color-mix(in srgb, #201e1d 16%, transparent)

--color-accent:     #3b5266   /* was Organic default #c67139 (terracotta) */
--color-accent-100: #eef1f5
--color-accent-200: #dbe3ea
--color-accent-300: #b7c6d3
--color-accent-400: #8aa1b6
--color-accent-500: #5c7791
--color-accent-600: #455f78
--color-accent-700: #33485f
--color-accent-800: #243444
--color-accent-900: #16212c

--color-accent-2:     #7a8a5e   /* sage, unchanged — secondary voice (used for "done"/completed states) */
--color-accent-2-100..900: see Organic's styles.css (unchanged)

--color-neutral-100..900: see Organic's styles.css (unchanged)
```

**Progress color bands** (dashboard rings/bars, tree branch bars):
- 100% complete → `--color-accent-2-500` (sage)
- ≥40% complete → `--color-accent-500` (slate-blue)
- <40% complete → `--color-neutral-500`

**Level tag → tag class mapping** (tree canvas / drawer):
- Foundation → `tag-accent-2` (sage)
- Core → `tag-accent` (slate-blue)
- Advanced → `tag-neutral`
- Specialization → `tag-outline`
- Root topic → `tag-outline`

### Typography
- Headings: **Caprasimo** (400 weight only), body: **Figtree** (400/600/700).
- Scale: h1 42px / h2 32px / h3 25px / h4 20px / h5 16px / h6 13px (uppercase, 0.08em tracking).
- Body copy: 15px / 1.55 line-height. Card titles ~17px. Muted/meta text 11–13px.

### Spacing scale
`4.4 / 8.8 / 13.2 / 17.6 / 26.4 / 35.2px` (Organic's `--space-1` … `--space-8`).

### Radius
`--radius-sm: 8px`, `--radius-md: 16px`, `--radius-lg: 28px`. Cards and dialogs round further still (`--radius-lg * 1.15`); buttons, tags, inputs, and segmented controls are fully pill-shaped (`border-radius: 999px`).

### Shadows
`--shadow-sm`, `--shadow-md`, `--shadow-lg` — soft, ink-tinted, already tuned to the cream ground (see Organic's `styles.css`). Used as: `elev-sm` on cards, `elev-md` on the root tree node, `elev-lg` on the drawer/dialog.

### Interaction states
- Buttons/tags/inputs: hover = one step darker on the accent ramp; active/pressed = two steps darker.
- Focus-visible: `2px solid var(--color-accent)` outline, `2px` offset — never the browser default.
- Disabled: 45% opacity.

## Assets
No photography or custom illustration in this redesign — icons are simple inline SVGs (stroke-based, 2.75 stroke-width, rounded caps/joins, 24×24 viewBox) standing in for Lucide icons; swap for the actual Lucide React icon set already used in the codebase (`lucide-react`) rather than shipping the inline SVGs.

## Files
- `CogniTree_Mockups.dc.html` — the full interactive design reference (open directly in a browser). Contains all 5 screens described above with mock data; view source for exact markup/structure and inline styles to reference while rebuilding in React/Tailwind.
