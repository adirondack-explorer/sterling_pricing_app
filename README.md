# Sterling Finned Tube Pricing App

A React + TypeScript pricing tool for configuring and quoting Sterling finned tube radiation products. Built for TriState HVAC reps to build room-by-room job estimates with accurate zone-based pricing.

## Features

- **Job management** — Create and manage multiple pricing jobs from a central list
- **Room-by-room configuration** — Build out jobs with individual rooms, each with its own product selections
- **Element selection** — Choose from Sterling's full catalog of finned tube elements
- **Enclosure configurator** — Select from multiple enclosure lines (Classic Standard, Classic J, Dura-Vane, Guardian, JVA, JVB, JVK, LCS10-LB2, X-Expanded)
- **Modifications and accessories** — Add pipe enclosures, rough-in components, and product modifications
- **Zone-based multipliers** — Automatic pricing adjustments based on Sterling zone locations
- **Standard multiplier list** — Configurable discount multipliers per Sterling price sheet
- **Job summary bar** — Running totals across all rooms in a job
- **TriState branded** with Montserrat typography and Daikin group logo

## Tech Stack

- **React 19** with TypeScript
- **Vite 7** for dev server and builds
- **Tailwind CSS 4** for styling
- **React Router 7** for job/room navigation
- **ESLint** with TypeScript and React hooks plugins

## File Structure

```
src/
├── App.tsx                  # Router setup — JobList and JobDetail pages
├── components/
│   ├── Layout.tsx           # App shell with header and navigation
│   ├── JobSummaryBar.tsx    # Running totals across rooms
│   ├── RoomBuilder.tsx      # Room configuration interface
│   └── RoomCard.tsx         # Room summary cards on job detail
├── context/
│   └── JobContext.tsx        # Job state management
├── data/
│   ├── catalog-registry.ts  # Data loader for all product catalogs
│   ├── elements.json        # Finned tube element catalog
│   ├── enclosures/          # Per-enclosure-line pricing (9 JSON files)
│   ├── modifications.json   # Product modifications
│   ├── multipliers.json     # Standard multiplier list
│   ├── pipe-enclosures.json # Pipe enclosure options
│   ├── rough-in.json        # Rough-in components
│   └── zones.json           # Zone-based pricing multipliers
├── pages/
│   ├── JobList.tsx           # Job management list
│   └── JobDetail.tsx         # Room builder for a specific job
├── pricing/
│   └── engine.ts            # Pricing calculation engine
└── types/
    └── index.ts             # TypeScript type definitions
```

## Getting Started

```bash
npm install
npm run dev
```

Opens the dev server at `http://localhost:5173`.

### Build for Production

```bash
npm run build
```

Output goes to `dist/`.

## Reference Documents

- `1 - Sterling Standard Multiplier List (2).pdf` — Discount multiplier reference
- `Sterling Commercial Finned Tube Price Sheet C35 08 01 22_4.xlsm` — Source price sheet
- `Sterling Finned Tube C35R_1.pdf` — Product catalog
- `Sterling Zone Locations_1.pdf` — Zone map for pricing multipliers
