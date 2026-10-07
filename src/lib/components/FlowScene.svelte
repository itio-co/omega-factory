<script lang="ts">
  import { T } from '@threlte/core';
  import type { Game } from '../game/types';
  import { routeAnchor } from '../geometry';
  import { isFactorySlot } from '../game/factory';
  import { CATALOG } from '../game/catalog';
  import FlowPulse from './FlowPulse.svelte';
  import MachineModel from './MachineModel.svelte';
  import RouteModel from './RouteModel.svelte';
  let {
    game,
    width,
    height,
    running,
    reducedMotion,
  }: { game: Game; width: number; height: number; running: boolean; reducedMotion: boolean } =
    $props();
</script>

<T.OrthographicCamera makeDefault position={[0, 0, 100]} />
<T.AmbientLight intensity={2} />
<T.DirectionalLight position={[-100, 200, 300]} intensity={3} />
<T.Group
  position={[game.layout.pan.x - width / 2, height / 2 - game.layout.pan.y, 0]}
  scale={[game.layout.zoom, game.layout.zoom, 1]}
>
  {#each game.definition.nodes.filter((node) => !isFactorySlot(node.kind)) as node (node.id)}
    <T.Group
      position={[game.layout.positions[node.id].x + 108, -game.layout.positions[node.id].y - 94, 0]}
    >
      <MachineModel kind={node.kind} color={CATALOG[node.kind].color} />
    </T.Group>
  {/each}
  {#each game.definition.connections as edge (edge.id)}
    <RouteModel
      from={routeAnchor(game, edge.from)}
      to={routeAnchor(game, edge.to)}
      active={running && game.state.transfers.includes(edge.id)}
    />
    <FlowPulse
      from={routeAnchor(game, edge.from)}
      to={routeAnchor(game, edge.to)}
      color={CATALOG[game.definition.nodes.find((n) => n.id === edge.from)!.kind].color}
      active={running && !reducedMotion && game.state.transfers.includes(edge.id)}
    />
  {/each}
</T.Group>
