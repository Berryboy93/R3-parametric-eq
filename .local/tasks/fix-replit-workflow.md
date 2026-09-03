# Fix run-button workflow wiring

## What & Why
The "Project" workflow (bound to the Replit Run button) is configured as
`mode = "parallel"` but only lists the "Backend API" sub-workflow — the
"Dev Server" (Vite on port 5000) task is missing from it. As a result,
clicking Run starts the Express server on port 3001 but never starts Vite,
so every `/api/*` proxy request fails with ECONNREFUSED because there is no
frontend server to proxy from either, and users see a blank page.

## Done looks like
- Clicking the Run button starts **both** the Vite dev server (port 5000)
  and the Express API server (port 3001) in parallel.
- `/api/presets` requests succeed and the EQ preset list loads normally.
- No ECONNREFUSED errors appear in the Vite log.

## Out of scope
- Changing port numbers, proxy config, or any application code.
- Adding new workflows beyond wiring the existing two together.

## Steps
1. **Add the missing workflow task** — In `.replit`, add a second
   `[[workflows.workflow.tasks]]` entry under the `"Project"` workflow that
   references `"Dev Server"` (via `task = "workflow.run"`, `args = "Dev Server"`),
   so the parallel block runs both `"Backend API"` and `"Dev Server"` when
   the Run button is pressed.

## Relevant files
- `.replit`
