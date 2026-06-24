# Deploying the ZSR Research Navigator

The whole app runs as **one Node web service** — the Express server serves both
the API and the built React frontend. So deployment is simple.

## Option A — Render (recommended, durable URL)

A `render.yaml` blueprint is included.

1. **Put the code on GitHub** (private is fine):
   ```bash
   cd "ZSR AI Assistant"
   git init && git add -A && git commit -m "ZSR Research Navigator"
   # create a repo on github.com, then:
   git remote add origin https://github.com/<you>/zsr-research-navigator.git
   git push -u origin main
   ```
   (The `.gitignore` already excludes `.env`, `node_modules`, `dist`, and `data/`.)

2. **Create the service on Render** (https://render.com):
   - New → **Blueprint** → connect the repo → it reads `render.yaml`.
   - (Or New → **Web Service**: build `npm install && npm run build`, start `npm start`.)

3. **Add your key:** in the service's **Environment** tab, set
   `GEMINI_API_KEY` to your `AIza…`/`AQ.` key. Deploy.

4. You'll get a public URL like `https://zsr-research-navigator.onrender.com`.

Notes:
- Free tier **sleeps after ~15 min idle** (first request after that takes ~30s to wake). Fine for a demo; upgrade for always-on.
- Free tier egress IPs rotate, so **don't IP-restrict the API key** — leave application restrictions off and rely on the key staying secret + the API restriction (Generative Language API only).
- Rate limiting is in-memory (per instance), which is correct for the single free instance.

## Option B — Instant temporary link (no deploy)

To share a link for a quick live demo while your machine runs the app:
```bash
npm run dev                      # app on http://localhost:5173
npx cloudflared tunnel --url http://localhost:5173   # prints a public https URL
```
The URL works only while your machine and the tunnel are running.

## Before going beyond a demo
- Move billing to the **ZSR "Gemini Project"** (currently using a personal/Drone project key) so usage is self-contained.
- Get institutional sign-off on the ZSR branding and on query-topic logging (`LOG_QUERIES=off` disables it).
