<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import type { RouteAnchor } from '../geometry';
  import { alongRoute } from '../geometry';
  let {
    from,
    to,
    color,
    active,
  }: { from: RouteAnchor; to: RouteAnchor; color: string; active: boolean } = $props();
  let phase = $state(0);
  useTask(
    (delta) => {
      phase = (phase + Math.min(delta, 0.05) * 1.4) % 1;
    },
    { running: () => active },
  );
  const point = $derived(alongRoute(from, to, phase));
</script>

<T.Mesh position={[point.x, -point.y, 2]} visible={active}>
  <T.SphereGeometry args={[4.5, 10, 8]} />
  <T.MeshBasicMaterial {color} />
</T.Mesh>
