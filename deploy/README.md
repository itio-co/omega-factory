# Omega Factory dev deployment

The game runs at `https://grok-bot.tailbe69ab.ts.net/omega-factory/` (tailnet) after
rollout. The ingress has the same `/omega-factory` rule for hosts `grok-bot.itio.space`
and `grok-bot.tailbe69ab.ts.net`.
The target is explicitly `kind-dev` (kind cluster `dev`), namespace
`omega-factory-dev`, using the existing nginx ingress and gateway TLS.
No DNS entries, certificates or registry credentials are created.

## Deploy

From a clean committed checkout, run `bash scripts/deploy-dev.sh`, or use
`/kido deploy dev`. Required tools: Git, Docker (run as `sudo docker`; override with
`DOCKER=docker`), kubectl, Python 3.
The script builds only committed files, using pinned base images and `npm ci`,
imports `omega-factory:<full-commit-sha>-<image-config-sha>` into the kind node's containerd
(`docker save | docker exec -i ${KIND_CLUSTER:-dev}-control-plane ctr -n k8s.io images import --no-unpack -`;
containerd lists it as `docker.io/library/omega-factory:…`), applies the manifests, waits
for readiness, then checks local and public ingress including asset MIME types.
The ingress only has host rules, so the local check sends `Host: grok-bot.itio.space`
(`verify-deployment.py --host`).
It stops on failure. Receipts live in `git rev-parse --git-path omega-factory-deploy`;
Kido additionally stores its deployment receipt in the story brain.

Do not apply the raw manifest: its image is deliberately a non-existent
`render-required` placeholder. The script substitutes the commit-tagged image.
This dev-only image uses `imagePullPolicy: Never`; remote clusters need a registry.

nginx runs as UID 101 on port 8080 with a read-only root filesystem and temporary
storage only for nginx runtime files. `/omega-factory` redirects to the slash
form, the health endpoint is `/omega-factory/healthz`, missing assets return 404,
and hashed assets are cached. The ingress uses a native Prefix path with no
rewrite annotations. Every response, including redirects and errors, carries
`X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and `X-Content-Type-Options: nosniff`
(`deploy/security-headers.conf`, included in each location that sets its own headers). No CSP
yet. Saves remain in the player's browser.

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
python3 scripts/verify-deployment.py https://grok-bot.tailbe69ab.ts.net/omega-factory/
```

Alternatively `rollout undo deployment/omega-factory` restores the preceding
pod template if it is retained. First rollout has no previous image; record
that explicitly rather than claiming rollback was demonstrated. To withdraw a
failed first deployment, scale this deployment to zero and remove its ingress;
do not delete shared infrastructure.

## Wish follow-up

The game image bakes in its Wish endpoint at build time:
`ARG VITE_WISH_API_URL=/omega-factory/api/wishes` (the ingress is expected to route
`/omega-factory/api` to the Wish server, rewritten to `/api`). Override it with
`--build-arg VITE_WISH_API_URL=...`. The Wish server image, its Deployment/Service and
PVC are separate work. Do not put Wish YAML on the nginx temporary volume.

### Turning Wishes on (runtime flag)

The image serves `/omega-factory/config.json` with `{"features":{"wishes":false}}`,
so the Wish UI is hidden. To turn it on after approval, without rebuilding, mount a
ConfigMap over that one file. That manifest wiring isn't added yet.

```yaml
# ConfigMap omega-factory-config, data: config.json: '{"features":{"wishes":true}}'
volumeMounts:
  - name: config
    mountPath: /usr/share/nginx/html/omega-factory/config.json
    subPath: config.json
    readOnly: true
volumes:
  - name: config
    configMap: { name: omega-factory-config }
```

A `subPath` mount doesn't follow ConfigMap edits, so run `kubectl rollout restart
deployment/omega-factory` after changing it. nginx sends `config.json` as `no-cache`,
and the service worker never caches it, so players get the new value on their next
load. Offline, every feature is off. Turning Wishes off works the same way. The Wish server must also run with `WISH_ENABLED=1` for submissions to be
accepted.
