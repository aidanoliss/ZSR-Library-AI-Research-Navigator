# Live Demo Deployment

## Recommended path: Render

This project is easiest to share as a Render Web Service because it has an Express backend. Static-only hosting such as Netlify or Vercel is not enough unless the API is converted to serverless functions or hosted separately.

## Render settings

Use the included `render.yaml`, or configure manually:

- Service type: Web Service
- Runtime: Node
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment variables:
  - `GEMINI_API_KEY`: required, server-side only
  - `GEMINI_MODEL`: optional, default currently `gemini-2.5-flash`
  - `LOG_QUERIES`: use `off` for privacy-sensitive demos
  - `PRIMO_LIVE`: optional, use `off` if Primo lookup is slow/unavailable

## GitHub-to-Render flow

1. Push this repo to GitHub under `aidanoliss`.
2. In Render, choose New -> Blueprint or Web Service.
3. Connect the GitHub repo.
4. Add `GEMINI_API_KEY` in Render's Environment tab.
5. Deploy.
6. Test the public URL with the demo prompts in `docs/demo-script.md`.

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
