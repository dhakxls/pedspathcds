# PedsPath-CDS

> Synthetic-data pediatric bronchiolitis pathway support & QI analytics prototype. Uses synthetic data only, is not connected to production Epic, and is not intended for clinical use.

## Overview
- Homelab-first, Dockerized full-stack app combining FastAPI + SQLite/json storage with a Vite/React dashboard.
- Demonstrates bronchiolitis pathway eligibility, workflow prompts, low-value-care flagging, SmartPhrase generation, QI dashboarding, and FHIR-aware data mapping using synthetic patients.
- Future-facing Epic SMART-on-FHIR roadmap documented but **no** real EHR integration.

## Safety disclaimer
- Synthetic data only, no PHI.
- Not a medical device, not for bedside decision making.
- All outputs are phrased as “review/consider” for clinician oversight.

## Tech stack
- **Backend:** FastAPI, Pydantic, YAML-configurable pathway engine, SQLite-like JSON store, pytest.
- **Frontend:** React 18 + TypeScript + Vite, Tailwind, Recharts.
- **Data:** JSON files for synthetic patients/encounters, YAML configs.
- **Deployment:** Docker & Docker Compose (frontend Nginx, backend Uvicorn), homelab friendly.

## Project structure
```
backend/
  app/
    adapters/fhir_adapter.py
    config/*.yaml
    data/synthetic_*.json
    pathway_engine/bronchiolitis.py
    tests/
  Dockerfile
frontend/
  src/
  Dockerfile + nginx.conf
 docs/local_adaptation_checklist.md
 docker-compose.yml
 .env / .env.example
```

## Homelab SSH deployment workflow
```
mkdir -p /home/martinvo/peds-path-cds
cd /home/martinvo/peds-path-cds
ss -tulpn
docker ps --format "table {{.Names}}\t{{.Ports}}"
cp .env.example .env
# edit .env with unused ports + LAN IP
npm --prefix frontend install   # optional for local dev
python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt  # optional for local tests
npm --prefix frontend run build # optional check
sudo docker compose up -d --build
sudo docker compose ps
curl http://localhost:${BACKEND_HOST_PORT}/health
# tail logs when needed
sudo docker compose logs -f --tail=100
```
**Warnings**
1. Do **not** run commands that stop all Docker containers on this homelab.
2. Do **not** run `docker system prune` or similar destructive commands unless explicitly approved.
3. Do **not** remove unrelated volumes, networks, containers, or images.

## Port selection guidance
1. Run `ss -tulpn` and `docker ps --format "table {{.Names}}\t{{.Ports}}"` to see current listeners.
2. Pick two unused host ports for FRONTEND/BACKEND (defaulted to 9075/9076 in `.env`).
3. Update `.env` with the chosen values **before** running Compose.

## Environment variables
| Variable | Description |
| --- | --- |
| `SERVER_LAN_IP` | LAN IP used for composing URLs + LAN access.
| `FRONTEND_HOST_PORT` | Host port mapped to Nginx (serving Vite build).
| `BACKEND_HOST_PORT` | Host port mapped to FastAPI.
| `VITE_API_BASE_URL` | Base URL the frontend calls for API requests. Use a relative path (e.g., `/peds/api`) when fronting the stack with a reverse proxy so requests stay same-origin.
| `CORS_ORIGINS` | Comma-separated origins allowed by FastAPI.
| `VITE_BASE_PATH` | Subpath where the frontend is served (e.g., `/peds`). Set to `/` for root hosting.

## Docker Compose quick start
```
cp .env.example .env
# edit .env with LAN IP + unused ports
sudo docker compose up -d --build
sudo docker compose ps
curl http://localhost:${BACKEND_HOST_PORT}/health
```
- Frontend: `http://${SERVER_LAN_IP}:${FRONTEND_HOST_PORT}`
- Backend health: `curl http://localhost:${BACKEND_HOST_PORT}/health`

### Lifecycle commands
- Restart services: `sudo docker compose restart`
- Stop stack: `sudo docker compose down`
- View logs: `sudo docker compose logs -f --tail=100`
- Rebuild after updates: `sudo docker compose up -d --build`

## LAN access
- Exposed ports are bound on the host only on the specified ports—ensure firewall allows LAN traffic.
- For WAN or cross-site exposure, front with an existing reverse proxy (Caddy, Nginx Proxy Manager, or Traefik) and apply authentication.

## Reverse proxy tips
1. **Nginx Proxy Manager:** create two proxy hosts pointing to backend/frontend ports; enable Access List (basic auth) plus SSL terminator.
2. **Caddy:** simple `reverse_proxy` directives per subdomain, leverage automatic HTTPS, keep upstreams on 9075/9076.
3. **Traefik:** define `http` routers with TLS + middleware for basic auth or rate limits; label the compose services when integrating.

### Hosting under a subpath (e.g., `/peds`)
- Set `VITE_BASE_PATH` to the desired path (must start with `/`).
- Set `VITE_API_BASE_URL` to `<base_path>/api` so the frontend calls the backend through the same origin.
- Rebuild the frontend image (`sudo docker compose up -d --build frontend`).
- Update your reverse proxy so `/peds/` is forwarded to the frontend container and `/peds/api/` is proxied to the backend.
- For Tailscale Funnel, point it at the HTTPS listener (e.g., `https+insecure://localhost:8443`) so WAN traffic inherits the same nginx routing.

## Remote access recommendations
- Use free options like **Tailscale**, **WireGuard**, or **Cloudflare Tunnel/Access** to protect services instead of exposing raw ports.
- Document who has access and how identity is verified.

## Synthetic data model
- `backend/app/data/synthetic_patients.json`: 8 bronchiolitis-focused pediatric encounters with demographics, respiratory status, orders, scenario narratives.
- `backend/app/data/synthetic_encounters.json`: 60 encounters for dashboard metrics (eligible counts, therapy utilization, returns, ICU transfers).
- All IDs prefixed `SYN-` / `ENC-`, no linkage to real patients.

## Pathway engine
- Configurable via `backend/app/config/bronchiolitis.yaml` (age range, exclusion triggers, discharge readiness, clinical flag definitions).
- Eligibility: age 1–23 mo, bronchiolitis diagnosis, no major exclusion triggers (cardiac disease, chronic lung disease, immunocompromised, HFNC/severe WOB, focal findings, etc.).
- Clinical flags highlight albuterol without asthma history, steroids in typical cases, CXRs without focal findings, antibiotics without indication, missing pathway/order-set usage, missing discharge checklist.
- Discharge readiness scoring explains “likely ready / needs review / not ready” reasons.

## QI dashboard
- `/dashboard/metrics` surfaces synthetic rates (pathway use, imaging, meds, checklist, returns, ICU transfers).
- Frontend uses cards + run chart + bar chart plus encounter table to visualize variation.

## SmartPhrase generator
- `/patients/{id}/smartphrase` returns a `.BRONCHIPATHWAY` template summarizing assessment, flags, plan, discharge readiness, and reminder that clinician review is required.

## FHIR mapping
- `/patients/{id}/fhir` synthesizes Patient, Encounter, Condition, Observation, MedicationRequest, ServiceRequest, and DocumentReference-style objects via adapter.
- Frontend page displays mapping summary + JSON bundle preview per synthetic patient.

## Epic SMART-on-FHIR roadmap
- `/epic` page documents future steps: SMART registration, Epic sandbox launch, adapter pipeline.
- Placeholder buttons intentionally disabled; production integration would require institutional governance, Epic App Orchard enrollment (paid), and security review—**not included in this MVP**.
- `/epic` UI now includes a SMART launch tester: review discovery metadata, craft authorize URLs (including dropdown to pick a synthetic patient), and submit returned codes against the synthetic token endpoint. Successful exchange automatically calls `/smart/context` to display the synthetic patient + FHIR bundle tied to the issued token, surfaces token TTL/expiration status, renders an Epic-style storyboard preview (orders, severity, discharge notes), and exposes a one-click refresh workflow.
- Backend exposes SMART metadata at `/peds/api/smart/.well-known/smart-configuration` with configurable issuer via `SMART_BASE_URL`/`SMART_ISSUER`.
- Synthetic auth flow: `/smart/authorize` issues a demo code (302 redirect) and `/smart/token` returns Bearer/refresh tokens tied to `SMART_PATIENT_ID`. Refresh grants are supported: exchanging a refresh token rotates both the access and refresh token, preserving the same patient scope. Access tokens expire after `SMART_ACCESS_TOKEN_TTL_SECONDS` (default 300s) and refresh tokens after `SMART_REFRESH_TOKEN_TTL_SECONDS` (default 1800s); expired tokens are rejected by `/smart/context` and `/smart/token`. Configure the client via env vars:
  - `SMART_CLIENT_ID` (default `peds-path-demo-client`)
  - `SMART_REDIRECT_URI` (default `https://example.org/smart-redirect`)
  - `SMART_BASE_URL` / `SMART_ISSUER`
  - `SMART_PATIENT_ID` (default patient if a launch-specific override is not supplied)
  - `SMART_ACCESS_TOKEN_TTL_SECONDS` (defaults to `300`)
  - `SMART_REFRESH_TOKEN_TTL_SECONDS` (defaults to `1800`)
  - `/epic` step 4 now includes a SMART Health IT sandbox inspector: paste any public SMART-on-FHIR base URL (e.g., https://launch.smarthealthit.org/v/r4/sim/.../fhir) to fetch its `.well-known/smart-configuration` for reference before enrolling in Epic Nexus/App Orchard.
  Example launch:
  ```bash
  # Step 1: initiate authorize request
  curl -I "http://localhost:9076/smart/authorize?response_type=code&client_id=${SMART_CLIENT_ID}&redirect_uri=${SMART_REDIRECT_URI}&scope=launch%20patient/*.read&state=test&smart_patient_id=SYN-002"

  # Step 2: exchange returned code
  curl -X POST http://localhost:9076/smart/token \
    -d grant_type=authorization_code \
    -d code=REPLACE_WITH_CODE \
    -d redirect_uri=${SMART_REDIRECT_URI} \
    -d client_id=${SMART_CLIENT_ID}

  # Step 3: use issued Bearer token to retrieve the linked synthetic patient + bundle
  curl http://localhost:9076/smart/context -H "Authorization: Bearer REPLACE_WITH_ACCESS_TOKEN"

  # Step 4 (optional): rotate tokens via refresh grant
  curl -X POST http://localhost:9076/smart/token \
    -d grant_type=refresh_token \
    -d refresh_token=REPLACE_WITH_REFRESH_TOKEN \
    -d client_id=${SMART_CLIENT_ID}
  ```

## Local adaptation checklist
- See [`docs/local_adaptation_checklist.md`](docs/local_adaptation_checklist.md) for stakeholder + policy questions (pathway ownership, oxygen thresholds, order-set governance, data availability, IRB, privacy).

## LAN + reverse proxy notes
- Always terminate TLS at the proxy and restrict access using VPN/basic auth.
- Keep Compose stack bound to LAN IP only; rely on proxy for external exposure.

## Testing
- Backend unit + FHIR verification tests: `docker compose exec backend env PYTHONPATH=/app pytest app/tests`
- Local (optional): `python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt && backend/.venv/bin/pytest`
- End-to-end UI demo: `frontend/tests/playwright-demo.spec.ts` automates the clinician flow against https://homelab.taild08007.ts.net/peds/. Install Playwright via `npm i -D @playwright/test && npx playwright install`, then run `cd frontend && npx playwright test --config=playwright.demo.config.ts`. Update `FRONTEND_BASE_URL` in the script if your deployment hostname differs.

## Not included (requires paid/institutional resources)
- Real Epic integration, SMART launch contexts, App Orchard enrollment.
- Real patient data ingestion or PHI handling.
- Enterprise monitoring / commercial SaaS tooling.

## Troubleshooting
- Ensure Docker host ports are unused; change `.env` if conflicts arise.
- If Compose can’t reach backend, verify `.env` values and that `VITE_API_BASE_URL` matches backend exposure.
- Synthetic data edits require rebuilding Docker images.

## Homelab automation (optional)
- `~/bin/peds_tailserve.sh` + `~/.config/systemd/user/peds-tailserve.service` keep `tailscale serve`/`funnel` mappings alive after reboots. The guard enforces:
  - `/` → `http://127.0.0.1:8099` (OVM, untouched)
  - `/peds` → `http://127.0.0.1:9075/peds`
  - `/peds/` → `http://127.0.0.1:9075/peds/`
  Run `tailscale serve status` to confirm those handlers if access drifts.
- `~/bin/peds_health_check.sh` + `peds-health.timer` curl `http://localhost:9075/peds/` and `/peds/api/health` every 5 minutes, appending `OK/FAIL` lines to `~/logs/peds_health.log`.
  - Enable with `systemctl --user enable --now peds-health.timer`.
  - Inspect schedules: `systemctl --user list-timers peds-health.timer`.
  - Review history: `tail -n 100 ~/logs/peds_health.log`.
  - Extend by wiring the log to your alerting channel (email/Slack) if failures appear.

Stay mindful of homelab resource sharing; do not disrupt existing services while experimenting.

## License
- Copyright 2024 Martin Vo.
- Released under the [Apache License 2.0](LICENSE).
- Contributions are welcome via pull requests; submitting changes implies agreement to the Apache-2.0 terms.
