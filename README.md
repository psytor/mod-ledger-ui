# Mod Ledger UI

A React/TypeScript/Vite frontend for SWGOH mod analysis and management. This application provides a visual interface for viewing, filtering, and analyzing player mods with intelligent recommendations.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **CSS Modules** - Scoped styling
- **@psytor/astrogators-shared-ui v0.2.2** - Shared component library

## Features

- **Ally Code Management** - Select from saved ally codes or add new ones
- **Mod Display** - Responsive grid layout (5 columns → 1 column on mobile)
- **Mod Cards** - 4-section card design showing:
  - Primary stat
  - Mod sprite, level, tier, and pips
  - Secondary stats with efficiency
  - Character assignment, calibration, and lock status
- **Filtering** - Sliding filter panel for sets, slots, tiers, dots, primaries, characters, and lock status
- **Sorting** - Sort by character, set, slot, level, dots, tier, speed, or quality
- **Detail View** - Click any mod card to see detailed information in a modal

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Running instances of:
  - **astrogators-table** (port 8000) - For authentication
  - **mod-ledger** (port 8001) - For mod data API

### Environment Setup

1. **Configure environment variables**:
   ```bash
   # Copy from example
   cp .env.example .env

   # Or sync from root .env using the project script
   cd /home/psytor/projects/astro-table
   python3 scripts/env_update.py
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

   The app will be available at http://localhost:5174

### Development Workflow

You need **3 services running** for full functionality:

```bash
# Terminal 1: Docker services (PostgreSQL, Redis)
./scripts/docker_up.sh

# Terminal 2: astrogators-table (authentication API)
cd astrogators-table
source venv/bin/activate
uvicorn src.main:app --reload

# Terminal 3: mod-ledger (mod data API)
cd mod-ledger
source venv/bin/activate
uvicorn src.main:app --reload --port 8001

# Terminal 4: astrogators-hub (for login/auth UI)
cd astrogators-hub
npm run dev

# Terminal 5: mod-ledger-ui (THIS APP)
cd mod-ledger-ui
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server on port 5174
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run type-check` - TypeScript type checking
- `npm run lint` - ESLint code linting

## Project Structure

```
/src
├── main.tsx                    # Entry point with providers
├── App.tsx                     # Routing and protected routes
├── /contexts
│   ├── ModContext.tsx          # Mod data and API state
│   └── FilterContext.tsx       # Filter and sort state
├── /components
│   ├── /layout
│   │   └── Layout.tsx          # TopBar + Footer wrapper
│   ├── /mod
│   │   ├── ModCard.tsx         # 4-section mod card
│   │   ├── ModGrid.tsx         # Responsive grid
│   │   ├── ModDetailModal.tsx  # Detail view modal
│   │   ├── ModSprite.tsx       # Placeholder mod sprite
│   │   └── PipIndicator.tsx    # 7 dots for pips
│   └── /filter
│       └── FilterPanel.tsx     # Sliding filter sidebar
├── /pages
│   ├── AllyCodeSelectionPage.tsx  # Ally code input/selection
│   └── ModGridPage.tsx            # Main mod grid view
├── /services
│   └── modLedgerApi.ts         # API client for mod-ledger
└── /utils
    ├── modFilters.ts           # Filter logic
    └── modSorting.ts           # Sort logic
```

## API Integration

### Authentication

Uses `@psytor/astrogators-shared-ui` AuthProvider which connects to astrogators-table API for:
- User authentication
- Ally code management
- JWT token handling

### Mod Data

Connects to mod-ledger backend API for:
- **GET /api/v1/mod-ledger/player/{ally_code}** - Fetch parsed mods
- **POST /api/v1/mod-ledger/evaluate/{ally_code}** - Evaluate mods (future)

## Environment Variables

Required environment variables (synced from root `.env`):

```bash
# Astrogator's Table API (for authentication)
VITE_ASTROGATORS_TABLE_HOST=localhost
VITE_ASTROGATORS_TABLE_PORT=8000

# Mod Ledger API (for mod data)
VITE_MOD_LEDGER_HOST=localhost
VITE_MOD_LEDGER_PORT=8001
```

## Deployment

### Development

- Runs as **standalone app** on port 5174
- Requires 3 backend services (Docker, astrogators-table, mod-ledger)
- Access via http://localhost:5174 or through astrogators-hub

### Production

In production, this app should be served behind nginx reverse proxy:

1. **Build the app**:
   ```bash
   npm run build
   # Creates /dist folder with static files
   ```

2. **Nginx configuration** (example):
   ```nginx
   # Serve mod-ledger-ui at /mod-ledger
   location /mod-ledger {
     alias /var/www/mod-ledger-ui/dist;
     try_files $uri $uri/ /mod-ledger/index.html;
   }

   # Proxy API calls to mod-ledger backend
   location /api/v1/mod-ledger {
     proxy_pass http://localhost:8001;
     proxy_set_header Host $host;
     proxy_set_header X-Real-IP $remote_addr;
   }
   ```

3. **Update environment variable**:
   ```bash
   # In production .env
   VITE_MOD_LEDGER_UI_URL=/mod-ledger
   ```

This allows the hub to route to `/mod-ledger` instead of `http://localhost:5174`.

## Architecture Notes

- **Separate Git Repository**: mod-ledger-ui is a standalone repo, added as a submodule to astro-table
- **Independent Deployment**: Can be deployed and scaled independently from other frontends
- **Shared Component Library**: Uses @psytor/astrogators-shared-ui for consistent UI/UX
- **Stateless Frontend**: All state in React Context, no localStorage for mod data
- **Backend-Synced Ally Codes**: Ally codes stored in database, not localStorage

## Documentation

For detailed architecture and development patterns, see:
- `docs/MOD-LEDGER-UI_AI_GUIDE.md` - Complete AI developer guide (to be created)
- `/home/psytor/projects/astro-table/docs/FRONTEND_ARCHITECTURE_PLAN.md` - Overall frontend architecture
- `/home/psytor/projects/astro-table/docs/ASTROGATORS-SHARED-UI_AI_GUIDE.md` - Shared component library guide

## License

(Add your license here)
