#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -n "$(git status --porcelain --untracked-files=normal --ignore-submodules)" ]]; then
  echo 'Deployment requires a clean, committed source checkout.' >&2
  exit 1
fi
revision=$(git rev-parse HEAD)
build_image="omega-factory:build-$revision"
public_url=https://grok-bot.tailbe69ab.ts.net/omega-factory/
# Docker needs root on the dev host; set DOCKER=docker where the user is in the docker group.
read -r -a docker <<< "${DOCKER:-sudo docker}"
kind_node="${KIND_CLUSTER:-dev}-control-plane"
receipt_dir="$(git rev-parse --git-path omega-factory-deploy)"
mkdir -p "$receipt_dir"
receipt="$receipt_dir/$(date -u +%Y%m%dT%H%M%SZ)-$revision.log"
exec > >(tee "$receipt") 2>&1
trap 'result=$?; echo "exit=$result receipt=$receipt"' EXIT
printf 'revision=%s\ncontext=kind-dev\nnode=%s\nnamespace=omega-factory-dev\nurl=%s\n' "$revision" "$kind_node" "$public_url"
previous=$(kubectl --context kind-dev -n omega-factory-dev get deployment omega-factory --ignore-not-found -o jsonpath='{.spec.template.spec.containers[0].image}')
printf 'previous_image=%s\n' "${previous:-none (first deployment)}"
# Build exactly the committed source; untracked/ignored files never enter the image.
git archive HEAD | "${docker[@]}" build -t "$build_image" -
image_id=$("${docker[@]}" image inspect "$build_image" --format '{{.Id}}')
image="omega-factory:$revision-${image_id#sha256:}"
"${docker[@]}" tag "$build_image" "$image"
printf 'image=%s\nimage_id=%s\n' "$image" "$image_id"
# Import straight into the kind node's containerd (namespace k8s.io).
"${docker[@]}" save "$image" | "${docker[@]}" exec -i "$kind_node" ctr -n k8s.io images import --no-unpack -
# containerd stores the normalized ref; kubelet resolves the manifest's short name to it.
"${docker[@]}" exec "$kind_node" ctr -n k8s.io images ls -q "name==docker.io/library/$image" | grep -x "docker.io/library/$image" >/dev/null
printf 'imported=docker.io/library/%s node=%s\n' "$image" "$kind_node"
rendered=$(mktemp)
trap 'result=$?; rm -f "$rendered"; echo "exit=$result receipt=$receipt"' EXIT
sed "s|omega-factory:render-required|$image|" deploy/kubernetes.yaml > "$rendered"
kubectl --context kind-dev apply -f "$rendered"
kubectl --context kind-dev -n omega-factory-dev rollout status deployment/omega-factory --timeout=180s
# rollout status returns once the new pod is Ready, while the old pod may still be
# terminating behind the ingress. Wait for every other ReplicaSet's pods to be gone
# so the checks below only ever reach the new revision.
new_hash=$(kubectl --context kind-dev -n omega-factory-dev get pods -l app=omega-factory \
  -o jsonpath="{.items[?(@.spec.containers[0].image=='$image')].metadata.labels.pod-template-hash}" | awk '{print $1}')
[[ -n "$new_hash" ]] || { echo "No pod found for $image" >&2; exit 1; }
kubectl --context kind-dev -n omega-factory-dev wait --for=delete pod \
  -l "app=omega-factory,pod-template-hash!=$new_hash" --timeout=120s
kubectl --context kind-dev -n omega-factory-dev get pods -l app=omega-factory -o jsonpath='{range .items[*]}{.metadata.name}{" image="}{.spec.containers[0].image}{" running_image_id="}{.status.containerStatuses[0].imageID}{"\n"}{end}'
# The ingress only has host rules, so the local check must name one of its hosts.
python3 scripts/verify-deployment.py --host grok-bot.itio.space http://localhost/omega-factory/
python3 scripts/verify-deployment.py "$public_url"
kubectl --context kind-dev -n omega-factory-dev get pods -l app=omega-factory -o wide
