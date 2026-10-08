# Wish submission and development pipeline

The activated Kido story is the approved product scope: a player submits an idea,
the server durably saves it and immediately creates a pending Kido story. A later,
explicitly enabled worker develops that existing story and deploys validated work
to dev. Submitting a Wish is never permission to run arbitrary commands.

## Submission

A Node HTTP server listens on 127.0.0.1:8787 by default. Vite proxies `/api/wishes`;
packaged/hosted clients can set VITE_WISH_API_URL to the endpoint. Anonymous wishes
contain a UUID requestId and 1–4000 characters of nonblank text, preserved verbatim.
Bodies are limited to 32 KiB. Reusing a requestId with different text returns 409.
Allowed browser origins and per-address new-submission rate limits are configured
on the server. No personal identity is collected; IPs are transient rate-limit keys.

The server owns one YAML file under an operator-configured persistent directory.
A process lock excludes other servers; all mutations serialize and use fsync plus
atomic rename. A dead owner is recoverable; ambiguous locks require intervention.
Versioned records include timestamps, request identity, text, submission status,
linked story, and worker state. One server replica per local persistent volume.

Persist the Wish before invoking the installed Kido Python story writer with an
argument array and a deterministic `wish-<requestId>` slug. Resolve that slug before
creating anything. Require all brain files and verify identity/text before linking;
a partial brain is a retryable error, never a reason to create a second story.
Commit and push only that story's files before returning submitted. A failed push
is retryable and reconciliation reuses the local story. 201/200 mean submitted with
Wish and story identity; 202 means saved but story creation/sync needs retry.

The modal preserves draft text and request identity across retries/reloads. An
uncertain submission locks its text until reconciled; explicit new submissions
have new identities. Success requires a validated submitted response with the
matching Wish identity and story. Focus is trapped/restored and results are announced.

## Worker

Disabled by default. An explicitly configured supported Claude Code host runs one
Wish at a time. Persist claim owner, lease, attempt, stage and operation identity
before side effects. Dispatch `/kido code` for the linked story only. Validate the
resulting exact Git commit with the project's checks before `/kido deploy dev`.
Record development, validation and deployment receipts before selecting another.
Never replay an uncertain dispatch/deploy after a crash: reconcile an existing
receipt or pause that Wish for operator recovery. Known failed validation/deploy
records the failure; it does not block unrelated queued Wishes. Production is not
an accepted environment. Credentials and commands come from server configuration,
never from Wish text or HTTP input.

## Verification

Use real temporary files and HTTP requests for restart, concurrency, Unicode,
validation and duplicate retry tests; a temporary Git brain plus a fixture writer
for Kido's external boundary. Browser tests exercise retries and keyboard focus.
Worker tests replace only external execution, preserving real YAML transitions,
lease/recovery behavior and validation-before-deploy ordering. Live model execution
and deployment remain disabled during development.
