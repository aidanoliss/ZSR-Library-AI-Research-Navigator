# Canonical Deploy Path

The canonical ZSR Research Navigator app is the repository root:

```text
/Users/aidanoliss/Desktop/ZSR AI Assistant
```

Use the root `package.json`, `server/`, `src/`, `config/`, `docs/`, and `render.yaml` for development and deployment.

`ZSR-Clean-Deploy/` is an older duplicate deploy copy. It is ignored by Git so searches, status checks, and builds do not crawl duplicate source or generated folders. Do not add new work there.

Preview commands:

```bash
npm run build
PORT=3002 npm start
```

Development commands:

```bash
npm run dev
```
