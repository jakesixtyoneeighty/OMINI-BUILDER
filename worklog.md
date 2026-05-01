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
