# Omega Factory dev deployment

The game runs at `https://kookkoog-wsl-1.itio.space/omega-factory/` after rollout.
The target is explicitly `kind-dev` (kind cluster `dev`), namespace
`omega-factory-dev`, using the existing nginx ingress and gateway TLS.
No DNS entries, certificates or registry credentials are created.

## Deploy

From a clean committed checkout, run `bash scripts/deploy-dev.sh`, or use
`/kido deploy dev`. Required tools: Git, Docker, kind, kubectl, Python 3.
The script builds only committed files, using pinned base images and `npm ci`,
loads `omega-factory:<full-commit-sha>-<image-config-sha>` into kind, applies the manifests, waits
for readiness, then checks local and public ingress including asset MIME types.
It stops on failure. Receipts live in `git rev-parse --git-path omega-factory-deploy`;
Kido additionally stores its deployment receipt in the story brain.

Do not apply the raw manifest: its image is deliberately a non-existent
`render-required` placeholder. The script substitutes the commit-tagged image.
This dev-only image uses `imagePullPolicy: Never`; remote clusters need a registry.

nginx runs as UID 101 on port 8080 with a read-only root filesystem and temporary
storage only for nginx runtime files. `/omega-factory` redirects to the slash
form, the health endpoint is `/omega-factory/healthz`, missing assets return 404,
and hashed assets are cached. The ingress uses a native Prefix path with no
rewrite annotations. Saves remain in the player's browser.

## Validate without deploying

Run `npm run check`, `npm test`, and `npm run build`.
Build `docker build -t omega-factory:validation .`, then:

```sh
docker run --rm --name omega-factory-validation -d \
  --read-only --tmpfs /tmp --cap-drop ALL \
  --security-opt no-new-privileges -p 127.0.0.1:18088:8080 omega-factory:validation
python3 scripts/verify-deployment.py http://127.0.0.1:18088/omega-factory/
docker stop omega-factory-validation
```

For manifest validation, substitute the image and run `kubectl --context kind-dev
apply --dry-run=server -f <rendered-file>`. On first deployment the target namespace
does not exist; dry-run cannot persist it for the remaining objects. Validate a
copy using an existing namespace, then validate the real target during rollout.

## Rollback

The receipt records `previous_image` before any apply. Keep that image loaded
in kind. Restore it explicitly, then verify:

```sh
kubectl --context kind-dev -n omega-factory-dev set image deployment/omega-factory web=<previous_image-from-receipt>
kubectl --context kind-dev -n omega-factory-dev rollout status deployment/omega-factory --timeout=180s
python3 scripts/verify-deployment.py https://kookkoog-wsl-1.itio.space/omega-factory/
```

Alternatively `rollout undo deployment/omega-factory` restores the preceding
pod template if it is retained. First rollout has no previous image; record
that explicitly rather than claiming rollback was demonstrated. To withdraw a
failed first deployment, scale this deployment to zero and remove its ingress;
do not delete shared infrastructure.

## Wish follow-up

This image serves only the game. The Wish API is a separate image built from
`Dockerfile.server` (see `docs/WISHES.md`, "Container image"). Its client endpoint
is a build argument: build the game with
`--build-arg VITE_WISH_API_URL=/omega-factory/api/wishes` when the ingress routes
`/omega-factory/api` to the server (rewritten to `/api`). `scripts/deploy-dev.sh`
does not pass it yet. Run the server as one replica with a PVC for its YAML and
verify data survives pod replacement. Do not put Wish YAML on the nginx temporary volume.
