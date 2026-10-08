#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -n "$(git status --porcelain --untracked-files=normal --ignore-submodules)" ]]; then
  echo 'Deployment requires a clean, committed source checkout.' >&2
  exit 1
fi
revision=$(git rev-parse HEAD)
build_image="omega-factory:build-$revision"
public_url=https://kookkoog-wsl-1.itio.space/omega-factory/
receipt_dir="$(git rev-parse --git-path omega-factory-deploy)"
mkdir -p "$receipt_dir"
receipt="$receipt_dir/$(date -u +%Y%m%dT%H%M%SZ)-$revision.log"
exec > >(tee "$receipt") 2>&1
trap 'result=$?; echo "exit=$result receipt=$receipt"' EXIT
printf 'revision=%s\ncontext=kind-dev\nnamespace=omega-factory-dev\nurl=%s\n' "$revision" "$public_url"
previous=$(kubectl --context kind-dev -n omega-factory-dev get deployment omega-factory --ignore-not-found -o jsonpath='{.spec.template.spec.containers[0].image}')
printf 'previous_image=%s\n' "${previous:-none (first deployment)}"
# Build exactly the committed source; untracked/ignored files never enter the image.
git archive HEAD | docker build -t "$build_image" -
image_id=$(docker image inspect "$build_image" --format '{{.Id}}')
image="omega-factory:$revision-${image_id#sha256:}"
docker tag "$build_image" "$image"
printf 'image=%s\nimage_id=%s\n' "$image" "$image_id"
kind load docker-image "$image" --name dev
rendered=$(mktemp)
trap 'result=$?; rm -f "$rendered"; echo "exit=$result receipt=$receipt"' EXIT
sed "s|omega-factory:render-required|$image|" deploy/kubernetes.yaml > "$rendered"
kubectl --context kind-dev apply -f "$rendered"
kubectl --context kind-dev -n omega-factory-dev rollout status deployment/omega-factory --timeout=180s
kubectl --context kind-dev -n omega-factory-dev get pods -l app=omega-factory -o jsonpath='{range .items[*]}{.metadata.name}{" image="}{.spec.containers[0].image}{" running_image_id="}{.status.containerStatuses[0].imageID}{"\n"}{end}'
python3 scripts/verify-deployment.py http://localhost/omega-factory/
python3 scripts/verify-deployment.py "$public_url"
kubectl --context kind-dev -n omega-factory-dev get pods -l app=omega-factory -o wide
