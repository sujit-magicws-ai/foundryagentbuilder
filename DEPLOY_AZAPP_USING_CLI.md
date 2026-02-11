# Azure Deployment Reference — FOUNDRYSKILL

## Subscription & Resource Group
- **Subscription**: `3b7ef9f3-48fc-4d29-a9f8-3de02b79dac0`
- **Resource Group**: `rg-aif-sujit_s-test`
- **Region**: East US

## App Service Plan
- **Name**: `sujit_s_asp_0189`
- **SKU**: B1 (Basic) — upgraded from F1 (Free) due to QuotaExceeded
- **OS**: Linux
- **Hosts**: `foundryskill-platform`, `foundryskill-mock-apis`

---

## App 1: foundryskill-platform (Agent Builder Platform)

### Directory Structure (Critical)
```
platform/                  <-- deploy THIS directory (az webapp up runs from here)
├── requirements.txt       <-- references: -r backend/requirements.txt
├── frontend/              <-- static HTML/JS/CSS (served by FastAPI StaticFiles)
└── backend/               <-- FastAPI app lives here
    ├── main.py            <-- entry point (app = FastAPI())
    ├── requirements.txt   <-- actual pip dependencies
    ├── config.py
    ├── agents/
    ├── chat/
    └── tools/
```

**Why `cd backend` in startup command**: `az webapp up` deploys the `platform/` directory
as the app root. On Azure, the working directory is `/home/site/wwwroot/` which maps to
`platform/`. Since `main.py` is inside `backend/`, the startup command must `cd backend`
first. Without this, gunicorn can't find `main:app` and the container crashes.

**Why two requirements.txt**: Azure's Oryx build system looks for `requirements.txt` in
the deploy root (`platform/`). That file just forwards to `backend/requirements.txt` via
`-r backend/requirements.txt`. This keeps dependencies co-located with the backend code.

### Config
- **URL**: https://foundryskill-platform.azurewebsites.net
- **Runtime**: PYTHON|3.10
- **Startup command**: `cd backend && gunicorn main:app --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --timeout 120`
- **Deploy source**: Must `cd platform` before running `az webapp up` (NOT project root)
- **Entry point**: `platform/backend/main.py` (FastAPI app)
- **Docs**: https://foundryskill-platform.azurewebsites.net/docs

### App Settings (env vars)
| Setting | Description |
|---|---|
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `True` — Oryx builds on deploy |
| `WEBSITE_HTTPLOGGING_RETENTION_DAYS` | `3` |
| `AZURE_AI_PROJECT_ENDPOINT` | Foundry project endpoint |
| `AZURE_AI_MODEL_DEPLOYMENT_NAME` | Model name (e.g. `gpt-4.1`) |
| `AZURE_TENANT_ID` | Service Principal tenant |
| `AZURE_CLIENT_ID` | Service Principal client ID |
| `AZURE_CLIENT_SECRET` | Service Principal secret (do NOT log) |

### Deploy Command
```bash
cd platform
az webapp up --name foundryskill-platform \
  --resource-group rg-aif-sujit_s-test \
  --subscription 3b7ef9f3-48fc-4d29-a9f8-3de02b79dac0 \
  --runtime "PYTHON:3.10" \
  --sku B1 \
  --location eastus
```

### Set Startup Command (if needed)
```bash
az webapp config set --name foundryskill-platform \
  --resource-group rg-aif-sujit_s-test \
  --subscription 3b7ef9f3-48fc-4d29-a9f8-3de02b79dac0 \
  --startup-file "cd backend && gunicorn main:app --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --timeout 120"
```

---

## App 2: foundryskill-mock-apis (Mock REST APIs)

### Config
- **URL**: https://foundryskill-mock-apis.azurewebsites.net
- **Runtime**: PYTHON|3.10
- **Startup command**: `gunicorn main:app --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000`
- **Source**: `mock_apis/` directory
- **Entry point**: `mock_apis/main.py` (FastAPI app)

### Deploy Command
```bash
cd mock_apis
az webapp up --name foundryskill-mock-apis \
  --resource-group rg-aif-sujit_s-test \
  --subscription 3b7ef9f3-48fc-4d29-a9f8-3de02b79dac0 \
  --runtime "PYTHON:3.10" \
  --sku B1 \
  --location eastus
```

---

## Troubleshooting

### QuotaExceeded (app stopped)
Free (F1) tier has 60 min/day CPU limit. Fix:
```bash
az appservice plan update --name sujit_s_asp_0189 \
  --resource-group rg-aif-sujit_s-test \
  --subscription 3b7ef9f3-48fc-4d29-a9f8-3de02b79dac0 \
  --sku B1
```

### Application Error / 503 after scale-up
Container may fail with `startup.sh: No such file or directory`. Fix: **redeploy** the app
(see deploy commands above). A simple restart may not be enough — the Oryx build artifacts
may be missing.

### Startup command missing or wrong
If the container exits with code 127 and logs show `/opt/startup/startup.sh: No such file or directory`:
1. The startup command may not be set. Set it with `az webapp config set --startup-file "..."` (see above).
2. If deploying from the wrong directory (e.g., project root instead of `platform/`), the `cd backend` in the startup command will fail because `backend/` doesn't exist in the deployed files.
3. After setting/fixing the startup command, **redeploy** — don't just restart.

### Deployed from wrong directory
**Symptom**: App crashes, `ModuleNotFoundError`, or `main:app` not found.
**Cause**: `az webapp up` was run from the project root instead of `platform/`.
**Fix**: Always `cd platform` first, then run `az webapp up`. The project root contains
files with pre-1980 timestamps (causes ZIP error) and doesn't have the right structure.

### Check app status
```bash
az webapp show --name foundryskill-platform \
  --resource-group rg-aif-sujit_s-test \
  --subscription 3b7ef9f3-48fc-4d29-a9f8-3de02b79dac0 \
  --query "{name:name, state:state}" --output table
```

### View logs
```bash
az webapp log download --name foundryskill-platform \
  --resource-group rg-aif-sujit_s-test \
  --subscription 3b7ef9f3-48fc-4d29-a9f8-3de02b79dac0 \
  --log-file logs.zip
```

### ZIP timestamp error with `az webapp up`
If deploying from a directory with files that have timestamps before 1980, deploy from the
specific subdirectory (`platform/` or `mock_apis/`) instead of the project root.

### Restart app
```bash
az webapp restart --name foundryskill-platform \
  --resource-group rg-aif-sujit_s-test \
  --subscription 3b7ef9f3-48fc-4d29-a9f8-3de02b79dac0
```
