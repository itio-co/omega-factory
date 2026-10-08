# Player Wishes

The game’s **Make a Wish** button submits an idea to a separate Node server. The
server saves it to YAML, creates a pending Kido story immediately, and returns both
identities only after that story is pushed. An optional worker later develops the
existing story, validates its exact commit, and deploys to dev.

## Run submission locally

Requirements: Node 24+, Linux with `flock` (util-linux), Python 3, the installed Kido
skill and its Python dependencies, and Git access to the project’s brain remote.
Use one server per local persistent volume. The kernel lock prevents simultaneous
writers and releases automatically after a process crash; it is not a multi-host
or network-filesystem lock.

```sh
npm ci
# In one terminal:
WISH_KIDO_ROOT=/path/to/kido-skill npm run server
# In another terminal:
npm run dev
```

The server defaults to `127.0.0.1:8787`; Vite forwards `/api/wishes` to it. It does
not start a model session or deploy anything by default. Use a dedicated writable
brain checkout on branch `omega-factory`, with a configured Git author and remote
credentials. A freshly initialized Git submodule may be detached; switch that
checkout to its project branch before running the service.

| Variable                 | Default / meaning                                                               |
| ------------------------ | ------------------------------------------------------------------------------- |
| `WISH_PROJECT_ROOT`      | Current directory, the game repository                                          |
| `WISH_PROJECT`           | `omega-factory`, also the brain branch                                          |
| `WISH_BRAINS`            | `<project-root>/.kido/brains`                                                   |
| `WISH_KIDO_ROOT`         | `~/.codex/skills/kido`, the complete installed skill                            |
| `WISH_STORE`             | `<project-root>/var/wishes.yaml`                                                |
| `WISH_HOST`, `WISH_PORT` | `127.0.0.1`, `8787`                                                             |
| `WISH_ORIGINS`           | Comma-separated exact origins; defaults to localhost and 127.0.0.1 on port 5173 |
| `WISH_RATE_LIMIT`        | 10 new submissions per connection address per minute; memory-only               |
| `WISH_PROXY_TARGET`      | Vite only: `http://127.0.0.1:8787`                                              |
| `VITE_WISH_API_URL`      | Client build: `/api/wishes`, or an absolute endpoint URL                        |

For a hosted game, proxy `/api/wishes` to the server and set the exact public game
origin. Rate limits use the connection address; forwarded IP headers are not
trusted. Apply per-client limits at a trusted reverse proxy if needed. The endpoint
is anonymous; origins are browser restrictions, not authentication. IP addresses
are used only in the in-memory limiter, never stored with Wishes.

For Electron builds, set an absolute `VITE_WISH_API_URL` at build time. A `file://`
client has the origin `null`; supporting it requires explicitly adding `null` to
`WISH_ORIGINS`. There is no server or credential bundled into the desktop client.

## API and durable data

`POST /api/wishes`, `Content-Type: application/json`:

```json
{
  "requestId": "83f712a7-1b07-4f74-bb47-dd06b3c9b792",
  "text": "I wish conveyors could cross rivers. 🌱"
}
```

Text must be nonblank and at most 4000 UTF-16 code units, with a 32 KiB request
limit. Unicode, whitespace and newlines are preserved. `requestId` is a UUID, normalized to lowercase.
Repeating the same identity and text reconciles the same Wish; changing the text
under that identity returns 409. The form saves text and identity locally, retains
them across reload/retry, and locks the text after attempting submission.

- **201**: newly submitted, with `id`, `status: submitted`, and `story` containing
  its `id`, `slug` and brain-relative `path`.
- **200**: the same confirmed submission on retry.
- **202**: Wish durably saved, `status: pending`, `story: null`; retry the same
  request. This is not a story-creation success.
- **400 / 413 / 415**: invalid input / body too large / wrong content type.
- **403 / 429 / 503**: disallowed origin / rate limit / confirmation unavailable.

`GET /healthz` reports process health. No public listing or worker-control endpoint
is exposed. Pending stories are reconciled when their original request is retried.

The YAML document has `version: 1` and a `wishes` array. Each row has `id`, `text`,
`createdAt`, `updatedAt`, submission `status`, `story`, and `worker`. Writes serialize,
flush to disk, rename atomically and flush the directory. Invalid existing storage
fails startup without replacing the file. If a rename succeeds but its directory flush fails,
the server refuses further writes until restart and reloads the durable file. Keep the directory private and back it
up. There is no automatic expiry: deleting entries removes their retry history.
Mount the whole directory persistently before Kubernetes rollout; that deployment
is a separate story. Use a single server replica with the same process namespace.

Story slugs are `wish-<requestId>`. The Kido writer receives structured arguments,
with the suggestion encoded as untrusted JSON data. Each story contains `wish.json`
for provenance. Only that story’s files are committed. Independent remote brain
changes are merged without rewriting history. A conflicting merge or incomplete
brain stops confirmation; repair it in the dedicated checkout and retry the same
Wish. Never delete the partial story merely to create another one.

## Enable the worker on a supported host

The implementation includes a Claude Code launcher. It requires a host with the
installed Kido skill, its `/kido code` remote transport, Claude authentication, Git
credentials, and the project’s dev deployment entry point. These are operator
configuration, not settings accepted from a Wish. Do not enable this on a
Codex-only host. Live model execution/deployment is not part of the test suite.

Use an isolated worker account/host for generated code, with access limited to
this project and dev deployment. Validation executes the candidate’s npm scripts;
those scripts are code, so the account must not carry unrelated or production
credentials. Configure Claude’s normal permissions for the Kido commands; the
launcher does not bypass permission checks.

```sh
WISH_WORKER_ENABLED=1 \
WISH_WORKER_HOST=claude-code \
WISH_DEPLOY_DEV=1 \
WISH_DEV_DEPLOY_COMMAND='your exact reviewed dev deployment command' \
WISH_KIDO_ROOT=/path/to/kido-skill \
npm run server
```

The command above is a configuration example, not a deployment command to copy
unchanged. First resolve the real command with Kido’s deployment dry run; place
that exact `command` value in `WISH_DEV_DEPLOY_COMMAND`. The worker rejects a
candidate whose resolved dev command differs. It only requests environment `dev`.
The candidate repository must actually declare that deployment entry point.

Additional settings: `WISH_CLAUDE_BIN` (default `claude`), `WISH_PYTHON` (`python3`),
`WISH_RECEIPTS` (`var/worker-receipts`), `WISH_WORKSPACES` (`var/worker-checkouts`),
and `WISH_E2E_PORT` (`5197`). Keep receipts persistent with the YAML store. Install
the browser and OS libraries required by `npm run test:e2e` on the worker host.

Every submitted row is eligible, oldest first. One row advances at a time:

1. Persist a claim, lease, stage and operation ID before dispatch.
2. Ask Claude to run `/kido code <existing-story-id>` exactly once. Require the
   matching pushed Kido dispatch artifact and remote session URL as evidence.
3. Poll the story’s pushed tasks and lock. Wait until its checklist is complete
   and its lock is released/expired; fetch its feature branch commit.
4. Create a separate checkout at that exact commit. Run `npm ci --ignore-scripts`,
   `npm run check`, `npm test`, `npm run test:e2e`, and `npm run build`. Require a
   clean checkout before and after checks.
5. Resolve and compare the approved dev command, then run Kido’s `deploy dev`
   backing script. Persist its receipt locally, in YAML, and in the linked brain’s
   `artifacts/wish-deploy-<operationId>.json` before advancing.

The application branch containing this feature and any needed deployment files
must be integrated before newly created stories can use them as their base.

## Recovery and failure handling

Worker state includes `status`, `stage`, `operationId`, `owner`, `leaseUntil`,
`attempts`, `inFlight`, `receipts`, and a stage/timestamp error summary. States are
`queued`, `running`, `failed`, `attention`, and `deployed`.

A crash with a saved receipt resumes that same story. Development polling and
validation can repeat; subprocess guardians terminate local child process groups
on timeout or server death. A fresh claim owned by another worker is respected.
Git contention waits; transient development polling errors retain the active item.

A definite check/deploy failure becomes `failed`, and the next queued item may
proceed. Failed items are not retried automatically. An uncertain dispatch/deploy
becomes `attention` and blocks the queue until its matching receipt appears. A
remote agent can continue after the launcher disconnects, so absence of a response
is never permission to dispatch another one. There is no automatic remote-job
cancellation; inspect its Kido session if progress stalls.

For manual recovery, stop the server, inspect its protected logs and the operation
receipt, and verify the actual remote/deployed state. Resolve Git conflicts or
repair a partial story in the brain checkout. Restore a missing deployment receipt
only from verified evidence, preserving its Wish ID, story ID, operation ID, exact
commit and environment. On restart the worker validates that identity and resumes.
To retry a definitely failed validation after repairing the environment, keep its
receipts, set `worker.status: running`, `stage: validate`, `inFlight: false`, and
an expired `leaseUntil`. Do not reset an uncertain dispatch/deploy to queued.

## Verification

```sh
npm run check
npm test
npm run test:e2e
npm run build
```

Server tests use real temporary YAML files, HTTP requests, Git repositories and
remotes. Claude/deployment boundaries use fixture executables: they do not consume
model credentials or change a live environment. Browser tests cover Unicode,
confirmation, lost response, pending creation, retries, reload and keyboard focus.
