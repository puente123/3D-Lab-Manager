# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

3D Lab Manager is a React-based web application for managing university lab equipment at UTA. The frontend provides inventory tracking, 3D lab visualization with Three.js, QR code scanning, and a comprehensive admin panel with role-based access control.

## Development Commands

```bash
# Start development server (runs on http://localhost:5173)
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Architecture

### Technology Stack
- **Framework**: React 19 with Vite
- **Routing**: React Router DOM v7
- **UI Library**: Material-UI (MUI) v7 + TailwindCSS v4
- **3D Visualization**: Three.js with @react-three/fiber and @react-three/drei
- **Backend**: Supabase (authentication, database, storage)
- **API Mocking**: MSW (Mock Service Worker) for development

### Project Structure

```
src/
├── components/          # Reusable UI components
│   └── admin/          # Admin-specific components (AdminLayout, AdminProtectedRoute)
├── contexts/           # React contexts (AuthContext)
├── pages/             # Route-based page components
│   └── admin/         # Admin panel pages
├── lib/               # Core utilities and API clients
│   ├── supabase.js          # Supabase client initialization
│   ├── supabaseItems.js     # Equipment CRUD operations
│   ├── supabaseLabs.js      # Lab data operations
│   ├── supabaseStorage.js   # File storage operations
│   ├── permissions.js       # Role-based permissions system
│   └── api.js              # Additional API utilities
├── config/            # Configuration files (labs.js)
├── mocks/             # MSW handlers and mock data
└── shared/            # Shared types and constants
```

### Key Architectural Patterns

#### Authentication & Authorization
- `AuthContext` (src/contexts/AuthContext.jsx) provides global authentication state using Supabase Auth
- Session is restored on page refresh via `supabase.auth.getSession()`
- Auth state changes are tracked with `supabase.auth.onAuthStateChange()`
- Two route protection patterns:
  - `ProtectedRoute` - for authenticated users
  - `AdminProtectedRoute` - for admin area access

#### Role-Based Permissions
The permission system (src/lib/permissions.js) defines four roles:
- **admin**: Full access (wildcard '*' permission)
- **labManager**: Can manage items, labs, issues, and reports
- **staff**: Can manage items and issues
- **viewer**: Read-only access with issue creation

Use `can(role, permission)` to check permissions throughout the app.

#### Supabase Integration
- **Client initialization**: src/lib/supabase.js reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment
- **Equipment operations**: src/lib/supabaseItems.js handles CRUD for equipment table
- **Labs operations**: src/lib/supabaseLabs.js manages lab data
- **Storage**: src/lib/supabaseStorage.js handles file uploads (thumbnails, 3D models)
- **Field mapping**: Database snake_case fields (e.g., `qr_code`, `thumbnail_url`) are mapped to camelCase for UI

#### 3D Visualization
Map3d.jsx renders interactive 3D lab models using:
- **@react-three/fiber**: React renderer for Three.js
- **@react-three/drei**: Helper components (OrbitControls, useGLTF, Environment)
- **Backface culling**: Materials use `THREE.FrontSide` except windows/glass
- **Ceiling clipping**: Dynamic clipping plane removes ceiling when camera is above a threshold
- **Model loading**: GLB files from `/public/models/labs/` defined in src/config/labs.js

#### Admin Layout
src/components/admin/AdminLayout.jsx provides:
- Persistent left drawer navigation (responsive, collapses on mobile)
- Top AppBar with user menu
- Nested routing via React Router's `<Outlet />`
- Menu visibility controlled by role permissions using `can()` helper

#### MSW for Development
- Mock Service Worker intercepts network requests in development
- src/mocks/browser.js initializes the worker
- src/mocks/handlers.js and src/mocks/adminHandlers.js define request handlers
- Auto-imported in App.jsx when `import.meta.env.DEV` is true

### Routing Structure

```
Public Routes (with TopNav + Footer):
  /                  → Home page
  /items             → Equipment list
  /item/:id          → Equipment detail
  /map3d             → Lab selection grid
  /map3d/:labId      → 3D lab viewer
  /scan              → QR code scanner
  /auth              → Login/signup

Admin Routes (with AdminLayout):
  /admin/items       → Equipment management
  /admin/users       → User management
  /admin/labs        → Lab management
  /admin/issues      → Issue tracking
  /admin/reports     → Reporting dashboard
  /admin/settings    → Settings
```

### Theme Configuration
Material-UI theme (App.jsx) uses UTA branding:
- **Primary**: Navy (#1e3a8a) and Blue (#2563eb)
- **Font**: Inter, Roboto, system-ui
- **Border radius**: 12px default, 8px for buttons, 16px for cards

## Environment Variables

Required in `.env` file:
```
VITE_SUPABASE_URL=<supabase-project-url>
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
```

## Common Development Tasks

### Adding a New Admin Page
1. Create page component in `src/pages/admin/`
2. Add route in `App.jsx` under the `/admin` Route
3. Add navigation item in `AdminLayout.jsx` with appropriate permission check
4. Define required permissions in `src/lib/permissions.js` if needed

### Adding Equipment Fields
1. Update database schema in Supabase
2. Modify field mapping in `src/lib/supabaseItems.js` (getEquipment, createEquipment, updateEquipment)
3. Update UI components to display/edit new fields

### Working with 3D Models
- Models are GLB format stored in `/public/models/labs/`
- Lab configurations are in `src/config/labs.js`
- Model loading uses `useGLTF.preload()` for performance
- Coordinate system assumes Y-up, clipping plane removes ceiling when camera is high

### Testing with MSW
- Add/modify handlers in `src/mocks/handlers.js` or `src/mocks/adminHandlers.js`
- Mock data is in `src/mocks/data.js` and `src/mocks/adminData.js`
- Worker runs automatically in dev mode; check console for "MSW Service Worker started successfully"
