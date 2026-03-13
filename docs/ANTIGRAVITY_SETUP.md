# Antigravity Integration Guide

This project is fully compatible with the **Antigravity** coding harness (the environment powering Google AI Studio Build). If you are porting this code to GitHub and plan to import it back into AI Studio or a similar Antigravity-based environment, follow these guidelines.

## Seamless Compatibility Features

This repository has been structured to work out-of-the-box with Antigravity:

1. **Port 3000 Requirement:** 
   Antigravity requires the development server to run on port `3000` and bind to `0.0.0.0`. This is handled automatically by Vite's default behavior in this environment, and explicitly exposed in our `Dockerfile` for production.
   
2. **HMR (Hot Module Replacement) Disabled:**
   Antigravity disables HMR to prevent flickering during agent-driven code edits. This is explicitly handled in `vite.config.ts`:
   ```typescript
   server: {
     hmr: process.env.DISABLE_HMR !== 'true',
   }
   ```

3. **Environment Variables:**
   Antigravity automatically injects `GEMINI_API_KEY` and `APP_URL` at runtime. 
   * Do **not** hardcode these into your repository.
   * They are documented in `.env.example` so the harness knows they are expected.
   * `vite.config.ts` is configured to pass `GEMINI_API_KEY` to the client securely if needed via `define`.

## Importing from GitHub to AI Studio

When you import this GitHub repository into a new AI Studio Build project:

1. **Initial Build:** The Antigravity harness will automatically detect the `package.json`, run `npm install`, and execute `npm run dev`.
2. **Secrets Management:** If you add new API keys (like `OPENROUTER_API_KEY`), add them to `.env.example`. When the project loads in AI Studio, the UI will prompt you to enter the actual secret values via the Secrets panel.
3. **Iframe Constraints:** The AI Studio preview runs in an iframe. Ensure any OAuth flows (if added later) use popup-based authentication that opens the provider URL directly, rather than redirecting the iframe.

## Modifying the Architecture in Antigravity

If you ask the AI agent to modify this project later:
* **Frontend Changes:** The agent will edit the React components in `src/` and you will see the preview update immediately.
* **Backend/n8n Changes:** Since n8n runs in a separate Docker container on your VPS, the AI Studio agent cannot directly edit live n8n workflows. Instead, ask the agent to "Update the n8n workflow JSON blueprints in the `n8n-workflows/` folder." You can then export those updated JSON files and import them into your live n8n instance.
