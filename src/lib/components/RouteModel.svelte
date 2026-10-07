<script lang="ts">
  import { T } from '@threlte/core';
  import { CubicBezierCurve3, Vector3 } from 'three';
  import { routePoints } from '../geometry';
  import type { RouteAnchor } from '../geometry';
  let { from, to, active }: { from: RouteAnchor; to: RouteAnchor; active: boolean } = $props();
  const curve = $derived.by(() => {
    const [a, b, c, d] = routePoints(from, to).map((p) => new Vector3(p.x, -p.y, 0));
    return new CubicBezierCurve3(a, b, c, d);
  });
</script>

<T.Mesh
  ><T.TubeGeometry args={[curve, 40, 1.7, 5, false]} /><T.MeshBasicMaterial
    color={active ? '#899875' : '#b8b9a9'}
  /></T.Mesh
>
