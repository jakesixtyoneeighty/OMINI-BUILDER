<div align="center">

<img src="public/omini-favicon.png" alt="Mojo Builder" width="80" height="80" />

# Mojo Builder

### AI-powered full-stack web app builder

Build, edit, run, and deploy web applications in the browser — no local setup required.

Based on the open-source [Bolt.new](https://github.com/stackblitz/bolt.new) project by [StackBlitz](https://stackblitz.com/)

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Remix](https://img.shields.io/badge/Remix-2.x-blue.svg)](https://remix.run/)
[![Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare_Pages-orange.svg)](https://pages.cloudflare.com/)
[![WebContainers](https://img.shields.io/badge/WebContainers-StackBlitz-green.svg)](https://webcontainers.io/)

</div>

---

## About Mojo Builder

**Mojo Builder** is an open-source AI web development platform. Describe what you want in chat, and the AI generates code in real time with a live preview, integrated terminal, and one-click deploy.

Agent Mojo is full of features, multiple preview modes, GitHub and cloud deploy integrations, project persistence, a community gallery, **Mojo DB** (built-in database), and **Agent Mojo** (free default AI model when the server key is configured).

## Features

### AI development

- Chat with multiple AI providers (Anthropic, Google Gemini, OpenRouter, and more)
- **Agent Mojo** — default free model powered by the server-side API key
- Full code generation with automatic file creation and editing
- Prompt enhancement before sending
- Plan mode — review the AI plan before code is applied

### Preview modes

| Mode | Description |
|------|-------------|
| **WebContainer** | Full preview with dev server, terminal, and hot reload |
| **Sandpack** | Fast in-browser preview for React, Vue, and HTML |
| **Iframe SrcDoc** | Lightweight iframe rendering with React/JSX support |
| **React Live** | Live React component preview via react-live |
| **PlayCode** | CodeSandbox embed for complex builds |
| **New Tab** | Open the preview as a standalone page |

### Project import and storage

- Import from **GitHub** repositories
- Import **ZIP** archives or local **folders**
- Save projects to the cloud (Supabase-backed)
- Export to **Google Drive** under a `mojo/` folder
- Auto-save and project snapshots

### Mojo DB

Built-in document database for each project:

- 100 MB free storage per app
- No external database setup required
- REST API with collections and auth helpers
- AI configures schemas and integration code automatically

### Deploy

- **Cloudflare Pages** — free deploy, no API key required
- **Netlify**, **Vercel**, and **Google Cloud Run** with your tokens
- **Deploy with AI** — let the assistant prepare and publish
- **Mojo Builder preview** — share a live WebContainer deploy link
- Push to **GitHub** (public or private repos)

### Workbench

- **CodeMirror** editor with syntax highlighting and autocomplete
- Integrated terminal (Node.js via WebContainer)
- Visual file tree
- Light and dark themes
- Project settings: env vars, preview mode, deploy providers, AI rules, security tests
- Community **gallery** to publish and explore projects

## Architecture

| Layer | Stack |
|-------|--------|
| Frontend | [Remix](https://remix.run/) + [React](https://react.dev/) + [UnoCSS](https://unocss.dev/) |
| Sandbox | [WebContainers](https://webcontainers.io/) + [Sandpack](https://sandpack.codesandbox.io/) |
| AI | [Vercel AI SDK](https://sdk.vercel.ai/) |
| Deploy target | [Cloudflare Pages](https://pages.cloudflare.com/) + Workers |
| State | [Nanostores](https://github.com/nanostores/nanostores) |
| Editor | [CodeMirror 6](https://codemirror.net/) |


## Getting started

### Requirements

- Node.js 18.18+
- [pnpm](https://pnpm.io/) 9.4+

### Clone and install

```bash
git clone https://github.com/jakesixtyoneeighty/OMINI-BUILDER.git
cd OMINI-BUILDER
pnpm install
```

### Environment variables

Create `.env.local` in the project root:

```env
# Required for AI chat (at least one provider)
ANTHROPIC_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
OPENAI_API_KEY

# Optional: cloud auth and storage (Supabase)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: debug logging
VITE_LOG_LEVEL=debug
```

Never commit `.env.local` or real API keys to version control.

Users can also add their own API keys in the in-app **Settings** dialog; keys are stored in the browser localStorage only.

### Development

```bash
pnpm run dev
```

Open the URL printed in the terminal (typically `http://localhost:5173`).

### Build and preview

```bash
pnpm run build
pnpm run preview
```

### Deploy to Cloudflare Pages

```bash
pnpm run deploy
```

Configure `wrangler.toml` and Cloudflare credentials for your account.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start the development server |
| `pnpm run build` | Production build |
| `pnpm run start` | Serve the build locally with Wrangler Pages |
| `pnpm run preview` | Build and preview locally |
| `pnpm test` | Run Vitest tests |
| `pnpm run typecheck` | TypeScript check |
| `pnpm run typegen` | Generate Wrangler types |
| `pnpm run deploy` | Build and deploy to Cloudflare Pages |
| `pnpm run lint` | ESLint |

## Project structure (high level)

```
app/
  components/     # UI: chat, header, workbench, sidebar
  lib/            # Stores, i18n, LLM helpers, persistence
  routes/         # Remix routes and API endpoints
public/           # Static assets, PWA manifest, Mojo DB SDK
```



## Credits
- **WebContainers**: StackBlitz — run Node.js in the browser
- **Sandpack**: CodeSandbox — in-browser code sandbox
- **Remix**: Remix Run — full-stack React framework
- **AI SDK**: Vercel — LLM integration layer

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

<div align="center">

**Mojo Builder** — www.sixtyoneeighty.com [Bolt.new](https://www.sixtyoneeighty.com)

</div>
