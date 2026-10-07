# Kubernetes ingress deployment implementation plan

> Execute inline using executing-plans; validate each deliverable before checkpointing.

**Goal:** Serve the game at the approved `/omega-factory/` dev ingress.
**Architecture:** A pinned multi-stage image serves static files with nginx as a non-root user. A Deployment and Service expose it through the existing nginx ingress in kind-dev.
**Tech stack:** Docker, nginx, Kubernetes, Python standard library smoke verification.
**Spec:** Project-root brain `omega-factory/202610/20261007101804_kubernetes-ingress-deployment/implement.md` (approved).

## Constraints and review focus
- Explicit kind-dev context and omega-factory-dev namespace; no production changes.
- Immutable source-tagged images; preserve rollback image identity.
- Verify slashless redirects, actual JS/CSS MIME types, missing assets returning 404, health endpoint, and dirty-source rejection.
- No secrets; gateway owns TLS. Wish integration waits for an implemented server and durable storage contract.

## Tasks
- [x] Image/runtime: Dockerfile, .dockerignore, deploy/nginx.conf; verify local container health and game/asset URLs using scripts/verify-deployment.py, including failing pre-implementation probe.
- [x] Kubernetes: deploy/kubernetes.yaml with Namespace, Deployment, Service, Ingress; render a concrete image through kubectl local set image and server-side dry-run.
- [x] Deploy entry: scripts/deploy-dev.sh and .kido/deploy.yaml; explicit context, clean-source gate, build/load/apply/wait/verify, previous image receipt. Document invocation and rollback in deploy/README.md.
- [x] Verification: app checks/unit tests/build, local runtime smoke and browser check, manifest dry-run, independent branch review. Commit and push implementation.
- [ ] Authorized rollout: obtain approval for concrete command/revision, run once, save receipt, verify actual ingress and update brain.

## Execution rulings
- Use native nginx prefix serving instead of ingress regex rewriting. This permits a relative slashless redirect without optional controller snippets, avoids affecting other hostless ingress routes, and keeps missing assets as 404. The public path and behavior are unchanged.
- User approved the concrete design and requested development; execute inline without an additional process-only approval.

## Verification results
61 unit tests passed; Svelte check 0 errors/warnings; build passed (existing large-chunk warning). Image ran non-root/read-only and passed HTTP smoke (5 assets), browser rendered game without page errors. Server dry-run passed in default namespace because target namespace is not created yet. Dirty checkout refused before mutations. Independent review found repeat-build tag ambiguity; deployed tags now combine full source SHA and image content hash. Browser used existing libraries at /tmp/omega-browser-libs.
