# Mobile Responsiveness Implementation

## Task ID: mobile-responsive
## Agent: main
## Date: 2025-03-05

## Summary
Made the Omini Builder app fully responsive and usable on mobile devices (< 768px). The core Chat + Workbench + Editor layout was completely broken on mobile; now it works with tab-switching between chat and workbench views.

## Files Modified

1. **app/lib/stores/layout.ts** - Added `mobileViewStore` atom ('chat' | 'workbench') for mobile view switching
2. **app/utils/mobile.ts** - Added `useIsMobile()` React hook with matchMedia listener; changed `isMobile()` breakpoint from 640px to 768px
3. **app/styles/variables.scss** - Added `@media (max-width: 767px)` overrides for CSS variables (header height, sidebar width, chat widths)
4. **app/styles/index.scss** - Added global mobile utilities (overscroll-behavior, touch scrolling, iOS font-size fix)
5. **app/components/chat/BaseChat.tsx** - Major changes:
   - Imported `useIsMobile` and `mobileViewStore`
   - Container switches to flex-col on mobile when chat started
   - Chat panel takes full width on mobile, hidden when workbench view selected
   - Workbench panel takes full width on mobile when selected, hidden otherwise
   - Resize handle hidden on mobile
   - Added bottom tab bar (Chat/Preview) on mobile when chat started
   - Landing page toolbar wraps on mobile, mode button text hidden (icons only)
6. **app/components/header/Header.tsx** - Chat header:
   - Separators hidden on mobile (hidden sm:block)
   - ModelPicker hidden on mobile (hidden md:block)
   - Project name section hidden on mobile (hidden sm:flex)
   - Action buttons more compact on mobile (gap-0.5 sm:gap-1, px-1 sm:px-2)
   - DeployButton and ShareButton hidden on mobile (hidden sm:block)
   - Homepage header: logo text hidden on mobile, compact padding
7. **app/components/workbench/Workbench.client.tsx** - Compact padding on mobile, terminal toggle text hidden on mobile
8. **app/components/workbench/WorkbenchTabs.tsx** - Smaller padding on mobile, tab labels hidden on mobile (icons only)
9. **app/components/workbench/EditorPanel.tsx** - Added `useIsMobile`, fileTree panel ref, auto-collapse FileTree on mobile
10. **app/components/workbench/Preview.tsx** - All preview mode toolbars made responsive:
    - Compact padding (px-2 sm:px-3, py-1 sm:py-1.5)
    - Smaller gaps (gap-1 sm:gap-2)
    - Overflow-x-auto for scrolling
    - Mode labels hidden on mobile (hidden sm:inline)
    - URL bar hidden on mobile (hidden sm:flex / hidden sm:block)
    - Description text hidden on mobile

## Key Design Decisions
- Mobile breakpoint: 768px (matching md: in UnoCSS/Tailwind)
- Tab-based navigation on mobile instead of side-by-side panels
- Bottom tab bar with 48px height for touch targets
- Progressive disclosure: hide labels on mobile, show only icons
- FileTree auto-collapses on mobile to maximize editor space
- All changes are additive with responsive classes - desktop layout unchanged
