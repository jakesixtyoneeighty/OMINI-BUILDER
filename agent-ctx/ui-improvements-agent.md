# Task: Multiple UI Improvements for Omni-Builder

## Summary
All 5 UI improvement tasks have been completed successfully. The build passes with `pnpm remix vite:build`.

## Changes Made

### 1. Menu.client.tsx — Collapsible Sidebar + Improved Buttons + Projects Nav Item
**File:** `app/components/sidebar/Menu.client.tsx`

- **Collapsible sidebar**: Added `collapsed` state persisted to `localStorage` (key: `omni-builder.sidebar.collapsed`)
  - When collapsed: width = 60px, shows only icons (no text labels)
  - When expanded: width = 240px, shows icons + text labels
  - Smooth CSS transition on width change (`transition-[width] duration-200 ease-in-out`)
  - Toggle button at the bottom using `i-ph:caret-line-left` icon (flips 180° when collapsed)
  - Desktop sidebar uses inline `style={{ width }}` instead of CSS variable for dynamic sizing
  - All sidebar sections properly handle collapsed state (user info, nav items, chat history, social links, theme switch)
  - Mobile sidebar unchanged (still uses framer-motion slide-in/out at 280px width)

- **Improved sidebar buttons**:
  - Better hover effects with `transition-all duration-150`
  - Active state indicator: left border accent (3px rounded bar) using `before:` pseudo-element
  - Proper icon sizing: `text-lg` when collapsed, `text-base` when expanded
  - `title` attributes on all items when collapsed for tooltip hints

- **Projects nav item**: Changed from `{ icon: 'i-ph:folder', label: 'Projects', onClick: ... }` to `{ icon: 'i-ph:folder-open', label: 'Projects', href: '/projects' }` — now links directly to `/projects` route instead of switching to chats section

### 2. Header.tsx — Removed Tabs (Chat/Code/Preview) and URL Bar
**File:** `app/components/header/Header.tsx`

- Removed `TabType` type definition
- Removed `activeTab` computed value and `setActiveTab` callback
- Removed `TabButton` sub-component entirely
- Removed tab navigation section (Chat/Code/Preview buttons)
- Removed URL bar section (back/forward/refresh buttons + URL display for preview mode)
- Removed `showWorkbench`, `showChat`, `selectedView`, `previews` store subscriptions (no longer needed)
- Header now shows: LEFT (logo) | CENTER (chat description only) | RIGHT (action buttons)
- HomepageHeader remains unchanged
- Removed unused `useMemo` import (was only for `activeTab`)

### 3. projects.tsx — New Route with Grid Layout
**File:** `app/routes/projects.tsx`

- New route at `/projects` with same layout as `_index.tsx` (sidebar + header + content)
- Uses `ClientOnly` wrapper for client-side IndexedDB access
- `ProjectsContent` component:
  - Loads all chat history from IndexedDB via `getAll(db)`
  - Filters items with valid `urlId` and `description`
  - Search bar to filter projects by description
  - Responsive grid layout (1/2/3/4 columns at sm/md/lg/xl breakpoints)
  - Each project card: gradient visual header with icon, title, timestamp, message count
  - "New Project" button navigates to home
  - Empty states for: no projects, no search results
  - Loading skeleton for server-side render fallback
- Metadata: title "Projects — Omni-Builder"

### 4. AuthButton.client.tsx — Avatar Image
**File:** `app/components/header/AuthButton.client.tsx`

- When user is logged in with avatar: shows circular `<img>` (20x20px) next to display name
- When user is logged in without avatar: shows circular initial letter badge
- When not logged in: shows just "Sign in" text
- Button styling changed from accent-colored to subtle border/bg style matching the theme
- Dropdown menu now shows larger avatar (36x36px) with user info
- Better visual hierarchy in the dropdown with proper spacing

### 5. Build Verification
- `pnpm remix vite:build` passes successfully
- Only warnings are pre-existing: Sass deprecation warnings, UnoCSS icon loading warning, chunk size warnings
- No new errors introduced

## Files Modified
1. `app/components/sidebar/Menu.client.tsx` — Major rewrite for collapsible sidebar + improved nav
2. `app/components/header/Header.tsx` — Removed tabs and URL bar
3. `app/components/header/AuthButton.client.tsx` — Added avatar display
4. `app/routes/projects.tsx` — New file for projects page
