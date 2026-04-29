---
Task ID: 2
Agent: Omni-Builder Feature Update Agent
Task: Add AI provider settings, import, functional terminal, and improved markdown

Work Log:
- Installed AI SDK dependencies: openai, @google/generative-ai
- Created /src/services/ai-providers.ts with 4 provider definitions (OpenRouter, Google AI, OpenAI, Claude)
- Created /src/store/ai-provider.ts with Zustand store + localStorage persistence
- Rewrote /src/app/api/generate/route.ts to support all 4 providers with streaming
- Created /src/app/api/models/route.ts to fetch available models from providers
- Created SettingsDialog component with provider grid, API key input, model dropdown
- Updated Header with settings button, import/export, provider indicator badge
- Updated ChatPanel with provider warning banner, improved artifact badges (colored icons)
- Updated system prompt for markdown tables, links, file tracking format
- Built functional TerminalPanel with 20+ commands (ls, cat, tree, grep, wc, head, etc.)
- Added project import (.omni.json and raw .json files)
- Re-exported useAIProviderStore from main store index

Stage Summary:
- AI Provider system fully functional with 4 providers
- Settings persisted to localStorage
- Live model fetching from OpenRouter and OpenAI APIs
- Project import supports .omni.json and .json formats
- Terminal with command history, colorful output, project-aware commands
- Improved markdown rendering with tables, links, blockquotes
- File artifacts show colored badges (green=create, blue=modify, red=delete)
