# AI Development Rules

This document outlines the tech stack and coding standards for this application. Adhering to these rules ensures consistency, maintainability, and performance.

## Tech Stack

- **Framework**: [Remix](https://remix.run/) (React) for full-stack application architecture and routing.
- **Language**: [TypeScript](https://www.typescriptlang.org/) for all code to ensure type safety and better developer experience.
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (via UnoCSS) for utility-first, responsive styling.
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) for accessible, pre-built, and customizable UI elements.
- **Icons**: [Lucide React](https://lucide.dev/) for a consistent and comprehensive icon set.
- **State Management**: [Nanostores](https://github.com/nanostores/nanostores) for lightweight, framework-agnostic state management.
- **Animations**: [Framer Motion](https://www.framer.com/motion/) for smooth UI transitions and interactive animations.
- **Runtime**: [WebContainer API](https://webcontainers.io/) for executing Node.js environments directly in the browser.

## Library Usage Rules

### 1. Styling & Layout
- **Rule**: Use Tailwind CSS classes exclusively for all styling.
- **Exception**: Only use custom CSS/SCSS for complex animations or third-party library overrides that cannot be handled by Tailwind.
- **Responsive Design**: Always build with a mobile-first approach using Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`, etc.).

### 2. UI Components
- **Rule**: Prioritize `shadcn/ui` components for common elements like Buttons, Dialogs, Inputs, and Menus.
- **Customization**: If a `shadcn/ui` component needs modification, create a new component in `src/components/` rather than editing the base library files.

### 3. Icons
- **Rule**: Use `lucide-react` for all iconography.
- **Consistency**: Maintain consistent icon sizes (usually `size={20}` or `size={24}`) across similar UI elements.

### 4. State Management
- **Rule**: Use `nanostores` for global state or state that needs to persist across different parts of the application.
- **Local State**: Use standard React `useState` or `useReducer` for state that is strictly local to a single component.

### 5. Animations
- **Rule**: Use `framer-motion` for any non-trivial transitions, entrance animations, or gesture-based interactions.
- **Performance**: Keep animations subtle and performant to avoid degrading the user experience.

### 6. Notifications
- **Rule**: Use `react-toastify` (already integrated) to provide feedback for user actions, errors, or background process completions.

### 7. Code Structure
- **Rule**: Keep components small and focused (ideally under 100 lines).
- **Modularity**: Extract reusable logic into custom hooks in `app/lib/hooks/` and utility functions in `app/utils/`.