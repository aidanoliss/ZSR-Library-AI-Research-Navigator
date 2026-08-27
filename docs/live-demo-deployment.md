# Live Demo Deployment

## Recommended path: Render

This project is easiest to share as a Render Web Service because it has a Node API server. Static-only hosting such as Netlify or Vercel is not enough unless the API is converted to serverless functions or hosted separately.

The currently circulated production URL is `https://zsr-library-ai-research-navigator-1.onrender.com/`. Preserve it by deploying to that existing Render service. `render.yaml` describes a service named `zsr-research-navigator`; creating a new Blueprint from it may create a different service and hostname. The file does not reserve or guarantee the circulated URL.

## Render settings

Use the included `render.yaml`, or configure manually:

- Service type: Web Service
- Runtime: Node
- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm start`
- Environment variables:
  - `GEMINI_API_KEY`: required, server-side only
  - `GEMINI_MODEL`: optional, default currently `gemini-2.5-flash`
  - `NODE_VERSION`: `22.16.0`
  - `NODE_ENV`: `production`
  - `HOST`: `0.0.0.0`
  - `PORT`: `10000`
  - `LOG_QUERIES`: `off` for privacy-sensitive demos
  - `HANDOFF_STORE_CONTACT`: `off` unless ZSR approves retaining contact details
  - `PRIMO_LIVE`: optional, use `off` if Primo lookup is slow/unavailable
  - `ASK_ZSR_EMAIL`: default `askzsr@wfu.edu`

Render's Web Service runtime expects the app to bind to `0.0.0.0` on the configured port. This app reads `HOST` and `PORT` in `server/native.js`, and `render.yaml` sets those explicitly.

## GitHub-to-Render flow

1. Push this repo to GitHub under `aidanoliss`.
2. In Render, choose New -> Blueprint or Web Service.
3. Connect the GitHub repo.
4. Add `GEMINI_API_KEY` in Render's Environment tab. Do not commit it to the repo.
5. Confirm `LOG_QUERIES=off` and `HANDOFF_STORE_CONTACT=off` before sharing the first link.
6. Deploy.
7. Test the public URL with the demo prompts in `docs/demo-script.md`.

For ongoing releases, create a separate staging service, verify the release there, then deploy the exact reviewed commit to the existing production service. Run health, chat safe-failure, static-asset, and hostname smoke checks after promotion. Keep the prior deploy available for rollback.

## Backup plan

Keep local backup running:

```bash
npm install
npm run build
PORT=3002 npm start
```

Open:

```text
http://localhost:3002
```

Also keep screenshots or a short recording ready in case the hosted URL is asleep, the network is slow, or the Gemini quota is unavailable.

## Important note for sharing

Do not share a `localhost` URL as the meeting link. `localhost` works only on your machine.
