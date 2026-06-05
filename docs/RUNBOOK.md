# Deployment Runbook

## Architecture

```
GitHub (source)
  ↓ push to main
GitHub Actions CI  ──────────────────────────────────────────────────
  backend-ci.yml   → lint, unit tests, integration tests, build
  frontend-ci.yml  → lint, type-check, tests, build
  docker.yml       → push api:latest and web:latest to GHCR
  deploy-backend.yml → trigger Render deploy hook
  deploy-frontend.yml → vercel deploy --prod
                    ──────────────────────────────────────────────────
                                  ↓
                    Render (NestJS API) + Neon/Railway (Postgres)
                    Vercel (React frontend)
```

---

## Environments

| Environment | Backend                        | Frontend                      | Database     |
|-------------|--------------------------------|-------------------------------|--------------|
| Local       | `localhost:3000`               | `localhost:5173`              | Docker Postgres |
| Production  | `https://your-api.onrender.com` | `https://your-app.vercel.app` | Neon / Railway Postgres |

---

## One-time Setup

### 1. GitHub Secrets

Go to **GitHub → Settings → Secrets and variables → Actions**.

| Secret | Where to get it |
|--------|----------------|
| `RENDER_DEPLOY_HOOK_URL` | Render dashboard → Service → Settings → Deploy Hook |
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens → Create |
| `VERCEL_ORG_ID` | Run `vercel whoami` or check `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | Run `vercel link` inside `frontend/`, then check `.vercel/project.json` |

### 2. GitHub Variables

Go to **GitHub → Settings → Secrets and variables → Variables**.

| Variable | Example value |
|----------|--------------|
| `VITE_API_URL` | `https://your-api.onrender.com` |
| `BACKEND_URL` | `https://your-api.onrender.com` |

### 3. Render (Backend)

1. Create a new **Web Service** in Render and connect this repo.
2. Set **Root Directory** to `.` (repo root).
3. Set **Build Command**: `npm ci && npm run build`
4. Set **Start Command**: `node dist/db/migrate.js && node dist/main`
5. Add environment variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Connection string from your Postgres provider |
| `JWT_SECRET` | A random string ≥ 32 characters |
| `JWT_EXPIRES_IN` | `7d` |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |

6. Copy the **Deploy Hook URL** into the `RENDER_DEPLOY_HOOK_URL` GitHub secret.

### 4. Neon (Postgres — recommended free tier)

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string (with `?sslmode=require`).
3. Paste it as `DATABASE_URL` in Render.

### 5. Vercel (Frontend)

```bash
cd frontend
npx vercel login
npx vercel link          # creates .vercel/project.json
npx vercel env add VITE_API_URL production   # set to your Render URL
```

Copy `orgId` and `projectId` from `.vercel/project.json` into GitHub secrets.

---

## Deploying

### Automatic (normal flow)

Push to `main`. The pipeline runs automatically:

```
lint + tests → docker push → render deploy hook → health check
```

### Manual deploy (emergency)

```bash
# Backend — trigger the Render deploy hook directly
curl -X POST "$(gh secret get RENDER_DEPLOY_HOOK_URL)" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": false}'

# Frontend — deploy from your machine
cd frontend
npx vercel deploy --prod --yes
```

---

## Rollback

### Backend (Render)

1. Go to Render dashboard → Service → **Deploys** tab.
2. Find the last known-good deploy.
3. Click **Redeploy**.

Or use the Render CLI:
```bash
render deploys create <service-id> --image ghcr.io/disha707/task-management-api/api:<good-sha>
```

### Frontend (Vercel)

1. Go to Vercel dashboard → Project → **Deployments**.
2. Find the last known-good deployment.
3. Click the three-dot menu → **Promote to Production**.

---

## Database Migrations

Migrations run **automatically on deploy** via the `CMD` in the Dockerfile:

```dockerfile
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/main"]
```

To run migrations manually against production:
```bash
DATABASE_URL="<production-url>" npm run db:migrate
```

To generate a new migration after schema changes:
```bash
npm run db:generate     # creates a new SQL file in drizzle/
git add drizzle/
git commit -m "feat: add migration for <description>"
```

---

## Health Check

```bash
# Quick check
curl https://your-api.onrender.com/health

# Expected response
# {"status":"ok"}

# Full pipeline check (local)
docker compose up -d
curl http://localhost:3000/health
```

---

## Monitoring & Uptime

### UptimeRobot (free)

1. Sign up at [uptimerobot.com](https://uptimerobot.com).
2. Add a new **HTTP(s)** monitor:
   - URL: `https://your-api.onrender.com/health`
   - Interval: **5 minutes**
   - Alert contacts: your email
3. Get a status badge and add it to `README.md`:
   ```markdown
   ![Uptime](https://img.shields.io/uptimerobot/status/<monitor-id>)
   ```

### Render built-in health checks

In Render → Service → Settings → **Health Check Path**, set:
```
/health
```
Render will restart the service if the endpoint stops responding.

---

## Troubleshooting

### Tests fail in CI but pass locally

- **Unit tests**: check for hardcoded values that differ from the CI env variables (`JWT_SECRET`, `NODE_ENV`).
- **Integration tests**: confirm the migration ran before the tests. Look for `npm run db:migrate` step output.
- **Postgres service not ready**: the `--health-cmd pg_isready` options in the workflow handle this, but if tests still fail with connection errors, increase `--health-retries`.

### Docker build fails

```bash
# Reproduce locally
docker build --target production -t api-test .
docker run --rm -e DATABASE_URL=... -e JWT_SECRET=... api-test
```

### Render deploy succeeds but health check fails

1. Check Render **Logs** tab for startup errors.
2. Common cause: missing environment variable — compare the table above against what's set in Render.
3. Migration errors: the `node dist/db/migrate.js` command logs to stdout — check the logs.

### Vercel build fails

```bash
cd frontend
npm run build   # reproduce locally first
```

Most common cause: `VITE_API_URL` not set. In Vercel dashboard, go to **Settings → Environment Variables**.
