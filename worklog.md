---
Task ID: 1
Agent: Main Agent
Task: Fix Sandpack preview, add preview modes, private/public repos, Netlify deploy

Work Log:
- Read and analyzed Preview.tsx, SandpackPreview.tsx, project.ts, GitHubPush.client.tsx, AppSettingsDialog.client.tsx, Header.tsx, api.github-push.ts
- Updated project.ts: Added 'iframe' and 'newtab' to PreviewMode type, added netlify settings (token, siteId)
- Rewrote SandpackPreview.tsx: Fixed srcdoc rendering to properly build HTML from workspace files (index.html, CSS, JS injection, Tailwind CDN)
- Rewrote Preview.tsx: Added 4 preview modes (WebContainer, Sandpack, Iframe SrcDoc, New Tab) each with color-coded toolbar badges, proper fullscreen and refresh support
- Updated AppSettingsDialog: Added 4th "Deploy" tab with Netlify token/site config and deploy button, updated preview tab to show all 4 modes with distinct colors
- Updated GitHubPush: Added private/public toggle buttons, repo existence check (shows "will be updated" vs "will be created"), passes visibility to API
- Created api.netlify-deploy.ts: New API route that validates Netlify token, creates site if needed, uploads files as deploy
- Updated Header.tsx: Deploy button now opens AppSettingsDialog directly to Deploy tab

Stage Summary:
- Build successful with no errors
- Pushed to GitHub: https://github.com/Pedro21062014/Opensouce-App-builder.-Omini-builder.
- All 4 preview modes functional with proper file rendering
- GitHub push supports both creating new repos (private/public) and updating existing ones
- Netlify deploy fully integrated with token-based authentication

---
Task ID: 1
Agent: Main Agent
Task: Add Save to Google Drive feature

Work Log:
- Explored project structure (Remix + Cloudflare Pages + nanostores)
- Added `googleDrive: { clientId: string }` to ProjectSettings type and defaults
- Added `googleDrive` merge in `updateActiveProjectSettings()`
- Created `app/components/chat/SaveToDrive.client.tsx` — full component with:
  - Dynamic Google Identity Services script loading
  - OAuth2 token client initialization with Drive scope
  - Google sign-in popup flow
  - Folder creation in Google Drive (searches for existing first)
  - Individual file upload preserving directory structure
  - Progress bar and status steps (idle → auth → creating → uploading → done/error)
  - Inline Client ID configuration in the modal
  - Google official sign-in button SVG
- Added SaveToDrive button to BaseChat.tsx chat bar (next to Settings + ThemeSwitch)
- Added Google Drive section in AppSettingsDialog General tab with OAuth Client ID field
- Build verified successful
- Pushed to GitHub

Stage Summary:
- Feature: Save project files to Google Drive via OAuth2
- Files modified: project.ts, BaseChat.tsx, AppSettingsDialog.client.tsx
- Files created: SaveToDrive.client.tsx
- Build: OK | Push: OK
---
Task ID: 1
Agent: Main Agent
Task: Add Plan Mode toggle to chat input field

Work Log:
- Analyzed chat components: BaseChat.tsx, Chat.client.tsx, chatStore, api.chat.ts, prompts.ts
- Added `planMode` boolean to `chatStore` (nanostore map)
- Added Plan Mode toggle button (i-ph:list-checks icon) in BaseChat.tsx input bar
- Implemented plan instruction injection in Chat.client.tsx sendMessage function
- Added visual feedback: blue border on input area when plan mode is active
- Added dynamic Portuguese placeholder text when plan mode is on
- Passed planMode and onTogglePlanMode props from ChatImpl to BaseChat
- Build passed, committed and pushed to GitHub

Stage Summary:
- Feature implemented: Plan Mode toggle in chat input area
- When active, the AI receives structured instructions to create a step-by-step execution plan before coding
- Visual indicators: blue border, "Plano" label, dynamic placeholder
- Commit: d37f260 - "feat: add Plan Mode toggle to chat input"
- Pushed to main branch successfully


---
Task ID: deploy-fix
Agent: Main Agent
Task: Force redeployment to fix live syntax error
Work Log:
- Verified all source files are syntactically correct
- Clean rebuild: all JS chunks pass node -c validation
- Pushing to trigger fresh Cloudflare Pages deployment

---
Task ID: 1
Agent: Main Agent
Task: Fix TOKEN_USAGE stream parsing error

Work Log:
- Investigated the error "Failed to parse stream string. Invalid code TOKEN_USAGE"
- Found root cause: server injects custom \\x00TOKEN_USAGE:...\\x00 into AI SDK data protocol stream, but useChat parser only recognizes codes 0-9 and a-e
- Fixed api.chat.ts: changed from custom TOKEN_USAGE format to AI SDK data stream part (code "2")
- Fixed Chat.client.tsx: reads token usage from useChat data array instead of regex-parsing message content
- Cleaned up AssistantMessage.tsx: removed TOKEN_USAGE regex stripping since it no longer appears in content
- Built and pushed (commit da86f38)

Stage Summary:
- Error fixed by using proper AI SDK streaming protocol
- Token counter + price display feature still works, just uses correct protocol now
- Deployed to https://opensouce-app-builder--omini-builder.pages.dev/
---
Task ID: 2
Agent: Main Agent
Task: Fix database settings, modal triggers, plan mode, add AI questions

Work Log:
- Fixed database type reverting: saveDatabaseSettings now accepts overrideType parameter to avoid stale React state
- Fixed modal tags showing as text: updated system prompt to allow special HTML tags, added tags to markdown allowedHTMLElements, stripped tags from rendered content in AssistantMessage
- Fixed Plan Mode: moved instructions from user message injection to server-side system prompt, AI now presents plan and waits for user approval before coding
- Added AI Questions feature: new <user_question> tag in system prompt, UserQuestionCard component with clickable options + custom text input, detection in Chat.client.tsx, rendering in Messages.client.tsx
- Built and pushed (commit b201be9)

Stage Summary:
- 4 issues fixed/implemented, all deployed
- Files changed: 10 files, 276 insertions, 25 deletions
- New component: UserQuestionCard.tsx
- Key fixes in: api.chat.ts, Chat.client.tsx, prompts.ts, AppSettingsDialog.client.tsx, AssistantMessage.tsx, Messages.client.tsx, BaseChat.tsx, markdown.ts, stream-text.ts


---
Task ID: 1
Agent: Main Agent
Task: Fix circular dependencies + Update templates with GitHub + Improve action display

Work Log:
- Fixed 3 circular dependencies causing "Cannot access 'Oe' before initialization":
  1. db.ts ↔ useChatHistory.ts: Moved ChatHistoryItem interface from useChatHistory.ts to db.ts
  2. CodeMirrorEditor.tsx ↔ cm-theme.ts: Moved EditorSettings interface to cm-theme.ts
  3. auth.ts ↔ llm.ts: Changed to dynamic import() in both directions
- Updated all 22 templates with real GitHub repository URLs and star counts
- Templates page now shows GitHub repo info (name, stars) on each card
- Added "Importar Repo" primary button that navigates to /?import=<githubUrl>
- Kept "Gerar com IA" secondary button that uses the prompt
- Improved Artifact action display:
  - Green "Criado" badge for new files
  - Amber "Editado" badge for modified files
  - Blue "Comando" badge for shell commands
  - Cleaner, more minimal design
  - File directory shown on hover
- Added isNewFile tracking to ActionRunner (checks if file exists before write)
- Added ?import= parameter detection in Chat.client.tsx
- Build passed successfully
- Pushed to GitHub

Stage Summary:
- All 3 circular dependencies fixed (madge shows 1 false positive from dynamic imports)
- Templates now link to real GitHub repos with import functionality
- Action display is cleaner with Criado/Editado/Comando badges
- Files modified: auth.ts, llm.ts, db.ts, useChatHistory.ts, cm-theme.ts, CodeMirrorEditor.tsx, templates.ts, templates.tsx, Artifact.tsx, action-runner.ts, Chat.client.tsx
---
Task ID: 1
Agent: Main Agent
Task: Replace logos in Omni-Builder - header logo, README logo, and favicon

Work Log:
- Read Header.tsx, README.md, root.tsx, _index.tsx to understand current logo placement
- Saved black full SVG (OB monogram + OMNI BUILDER text, viewBox 0 0 1024 544) as public/omni-builder-logo.svg
- Saved white standalone SVG (OB monogram only, viewBox 0 0 490 532) as public/logo.svg (replaces existing)
- Copied white SVG to public/favicon.svg (replaces existing) for site title/tab icon
- Updated Header.tsx: Replaced old `<img src="/logo.svg">` + `<span>Omni-Builder</span>` with new `<img src="/omni-builder-logo.svg" className="h-8 omni-logo-themed">`
- Added CSS rule in app/styles/index.scss: dark theme inverts the black logo to white via `filter: brightness(0) invert(1)` on `[data-theme="dark"] .omni-logo-themed`
- README.md already references public/logo.svg (line 3) - no changes needed since file was replaced in-place

Stage Summary:
- Header logo: Replaced with user's black SVG (OB monogram + OMNI BUILDER text)
- README logo: Replaced with user's white standalone OB SVG (was already referenced)
- Favicon: Replaced with user's white standalone OB SVG
- Dark theme support: Added CSS filter inversion so logo is visible on both light and dark themes
- Files modified: Header.tsx, index.scss, logo.svg, favicon.svg
- Files created: omni-builder-logo.svg

## AI Rules Feature Implementation

**Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)

### Summary
Implemented a full-stack "AI Rules" feature that allows users to write custom instructions for the AI assistant. These rules are injected into the system prompt on every request, hidden from the user in the chat interface.

### Files Modified (5)

#### 1. `app/components/header/AppSettingsDialog.client.tsx`
- Added "AI Rules" tab (`rules`) to the TABS array with brain icon
- Added `customRules` state variable initialized from project settings
- Added `setCustomRules` reset in the dialog open useEffect
- Added tab description for the rules tab
- Added `saveCustomRules()` function that persists rules via `updateActiveProjectSettings`
- Added full AI Rules tab UI with: header with icon, description text, examples panel, textarea with save-on-blur, character counter, and clear button

#### 2. `app/components/chat/Chat.client.tsx`
- Added `customRules` to the `chatBody` useMemo object, reading from `projects[projectId]?.settings?.customRules`
- Added `projects` and `projectId` to the dependency array

#### 3. `app/routes/api.chat.ts`
- Added `customRules?: string` to the `ChatRequest` interface
- Extracted `customRules` from the request body in `chatAction`
- Passed `customRules` to both `streamText` calls (initial + continuation)

#### 4. `app/lib/.server/llm/stream-text.ts`
- Added `customRules?: string` parameter to the `streamText` function signature
- Passed `customRules` to `getSystemPrompt` call

#### 5. `app/lib/.server/llm/prompts.ts`
- Added `customRules?: string` parameter to `getSystemPrompt` function signature
- Added conditional `<project_custom_rules>` XML block injection before the examples section, which wraps user-defined rules with instructions that they take priority over default behavior

### Data Flow
```
AppSettingsDialog (UI) → project store (customRules) → Chat.client.tsx (chatBody) 
→ api.chat.ts (request body) → stream-text.ts (function param) → prompts.ts (system prompt injection)
```
