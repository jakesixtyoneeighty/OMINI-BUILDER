# Bolt.new

StackBlitz AI Agent — Remix app targeting Cloudflare Pages, with WebContainer-based in-browser dev environment.

## Stack
- Remix (Vite) + React 18 + UnoCSS
- TypeScript, pnpm 9 (Node 18+)
- Cloudflare Pages / Workers (wrangler)

## Dev
- Workflow `Start application` runs `pnpm run dev` (Vite/Remix dev server) on `0.0.0.0:5000`.
- `vite.config.ts` is configured with `server.allowedHosts: true` so the Replit proxy iframe works.

## Deploy
- Autoscale deployment: builds with `pnpm run build`, runs `wrangler pages dev ./build/client` bound to `0.0.0.0:5000`.
- Requires Cloudflare bindings via `.env.local` (e.g. `ANTHROPIC_API_KEY=...`). The `bindings.sh` script converts them to wrangler `--binding` flags. An empty `.env.local` is auto-created if missing.
