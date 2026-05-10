# Lunar Security Web Panel (Next.js)

Role-based web dashboard for Lunar Security operations, connected to the existing backend API.

## Roles and Access

- `Admin` (backend role `admin`): full admin console
- `Manager` (backend role `supervisor`): operations + leave review
- `Staff` (backend role `guard`): self-service workspace

## What is implemented

- Login with backend auth (`/auth/login`) and 2FA continuation (`/auth/login/2fa`)
- Secure session cookie for web panel authentication
- Route-level role guard middleware:
  - `/admin` -> admin only
  - `/manager` -> admin or supervisor
  - `/staff` -> guard only
- First dashboard pages wired to live backend data:
  - Admin: KPIs, users, audit logs
  - Manager: KPIs, shifts, pending leave requests
  - Staff: profile, own shifts, notifications
- Expanded module screens with live API integration:
  - Admin: users, sites, checkpoints, payroll runs, report export jobs
  - Manager: shift assignment, incidents/SOS status updates, leave approvals, certifications
  - Staff: leave submission/cancel, incident creation, SOS trigger
- Incident detail screens with attachment preview for Manager and Staff
- Command center map page (`/manager/command-center`) for Admin/Manager roles
- Attachment gallery modal with metadata + confirm-delete actions
- Command center filter set (site/status/time window) with optional auto-refresh (off/10s/30s)
- Branding route serves the transparent repository logo from `logo-without-bg.png`.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Ensure backend is running on the configured API base (`BACKEND_API_BASE`).

4. Start the app:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `BACKEND_API_BASE` | No | `http://127.0.0.1:4000/api/v1` | Base URL of Lunar backend API |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Map only | empty | Google Maps JS API key for command center map |

## Next development targets

- Complete update/edit workflows for each module (currently focused on create/list/core status updates)
- Add richer bulk actions and saved filter presets for incident/shift operations
- Real-time map and live incident command center
- Advanced reporting filters and historical analytics
