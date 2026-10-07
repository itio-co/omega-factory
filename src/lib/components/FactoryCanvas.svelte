<script lang="ts">
  import { onMount } from 'svelte';
  import { Canvas } from '@threlte/core';
  import { Minus, Plus, Maximize, MousePointer2, Hand, Unplug, X } from '@lucide/svelte';
  import type { Game, Point } from '../game/types';
  import { routeAnchor, routeLabelPoint, routePath, NODE_HEIGHT, NODE_WIDTH } from '../geometry';
  import { CATALOG } from '../game/catalog';
  import { factoryBounds, placeComponent } from '../game/factory';
  import { routeFlowRate } from '../game/flow';
  import PlaneControls from './PlaneControls.svelte';
  import NodeCard from './NodeCard.svelte';
  import FlowScene from './FlowScene.svelte';
  let {
    game,
    selected,
    connecting,
    running,
    onselect,
    onport,
    onlayout,
    oneditstart,
    ondisconnect,
    oncancel,
  }: {
    game: Game;
    selected: string | null;
    connecting: string | null;
    running: boolean;
    onselect: (id: string | null) => void;
    onport: (id: string, side: 'in' | 'out') => void;
    onlayout: (layout: Game['layout']) => void;
    oneditstart: () => void;
    ondisconnect: (id: string) => void;
    oncancel: () => void;
  } = $props();
  let viewport: HTMLDivElement;
  let width = $state(900),
    height = $state(600),
    webgl = $state(false),
    reducedMotion = $state(false);
  const scopedGame = $derived.by(() => {
    const nodes = game.definition.nodes.filter((n) => CATALOG[n.kind].plane !== 'world');
    const ids = new Set(nodes.map((n) => n.id));
    return {
      ...game,
      definition: {
        ...game.definition,
        nodes,
        connections: game.definition.connections.filter((e) => ids.has(e.from) && ids.has(e.to)),
      },
    };
  });
  const bounds = $derived(factoryBounds(game));
  let activeEdge = $state<string | null>(null);
  const activeRoute = $derived(game.definition.connections.find((edge) => edge.id === activeEdge));
  let drag: {
    id: string | null;
    client: Point;
    original: Point;
    pointer: number;
    editing: boolean;
  } | null = null;
  let panMode = $state(false);
  onMount(() => {
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      webgl = !!gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      webgl = false;
    }
    requestAnimationFrame(fit);
  });
  function fit() {
    const points = [
      ...scopedGame.definition.nodes.map((n) => game.layout.positions[n.id]),
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width - NODE_WIDTH, y: bounds.y + bounds.height - NODE_HEIGHT },
    ];
    if (!points.length) return;
    const minX = Math.min(...points.map((p) => p.x)) - 55,
      minY = Math.min(...points.map((p) => p.y)) - 100;
    const spanX = Math.max(...points.map((p) => p.x)) + NODE_WIDTH + 55 - minX;
    const spanY = Math.max(...points.map((p) => p.y)) + NODE_HEIGHT + 80 - minY;
    const zoom = Math.max(0.3, Math.min(1, (width - 48) / spanX, (height - 100) / spanY));
    onlayout({
      ...game.layout,
      zoom,
      pan: {
        x: (width - spanX * zoom) / 2 - minX * zoom,
        y: (height - spanY * zoom) / 2 - minY * zoom,
      },
    });
  }
  function zoomAt(factor: number, at: Point = { x: width / 2, y: height / 2 }) {
    const zoom = Math.max(0.3, Math.min(1.8, game.layout.zoom * factor));
    const ratio = zoom / game.layout.zoom;
    onlayout({
      ...game.layout,
      zoom,
      pan: {
        x: at.x - (at.x - game.layout.pan.x) * ratio,
        y: at.y - (at.y - game.layout.pan.y) * ratio,
      },
    });
  }
  function startDrag(event: PointerEvent, id: string | null) {
    if (event.button !== 0 && event.button !== 1) return;
    event.stopPropagation();
    if (id && !panMode) {
      onselect(id);
    }
    const target = panMode ? null : id;
    drag = {
      id: target,
      client: { x: event.clientX, y: event.clientY },
      original: { ...(target ? game.layout.positions[target] : game.layout.pan) },
      pointer: event.pointerId,
      editing: false,
    };
    viewport.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const dx = event.clientX - drag.client.x,
      dy = event.clientY - drag.client.y;
    const bound = (n: number) => Math.max(-90000, Math.min(90000, n));
    if (drag.id) {
      if (!drag.editing && Math.hypot(dx, dy) < 3) return;
      const kind = game.definition.nodes.find((node) => node.id === drag!.id)!.kind;
      const position = placeComponent(
        game,
        kind,
        {
          x: bound(drag.original.x + dx / game.layout.zoom),
          y: bound(drag.original.y + dy / game.layout.zoom),
        },
        drag.id,
      );
      const current = game.layout.positions[drag.id];
      if (position.x === current.x && position.y === current.y) return;
      if (!drag.editing) {
        oneditstart();
        drag.editing = true;
      }
      onlayout({ ...game.layout, positions: { ...game.layout.positions, [drag.id]: position } });
    } else
      onlayout({
        ...game.layout,
        pan: { x: bound(drag.original.x + dx), y: bound(drag.original.y + dy) },
      });
  }
</script>

<div
  class="factory-canvas"
  role="application"
  aria-label="Factory graph editor"
  class:has-webgl={webgl}
  bind:this={viewport}
  bind:clientWidth={width}
  bind:clientHeight={height}
  style:background-size="{24 * game.layout.zoom}px {24 * game.layout.zoom}px"
  style:background-position="{game.layout.pan.x}px {game.layout.pan.y}px"
  onpointerdown={(e) => {
    const target = e.target as Element;
    if (target.closest('button, .route-hit')) return;
    const nodeId = target.closest<HTMLElement>('.node-card')?.dataset.nodeId ?? null;
    if (!nodeId) onselect(null);
    startDrag(e, nodeId);
  }}
  onpointermove={move}
  onpointerup={() => (drag = null)}
  onpointercancel={() => (drag = null)}
  onwheel={(e) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.001), { x: e.clientX - rect.left, y: e.clientY - rect.top });
  }}
>
  <div class="canvas-heading">
    <span class="eyebrow">YOUR FIRST SYSTEM</span>
    <h1>First Light<span> / 01</span></h1>
    <p>Small connections. Endless possibilities.</p>
  </div>
  <div class="map-label">
    <span class:live={running}></span>{running ? 'SYSTEM RUNNING' : 'DESIGN MODE'}
  </div>
  <div
    class="graph-world"
    style:transform="translate({game.layout.pan.x}px, {game.layout.pan.y}px) scale({game.layout
      .zoom})"
  >
    <div
      class="factory-boundary"
      style:left="{bounds.x}px"
      style:top="{bounds.y}px"
      style:width="{bounds.width}px"
      style:height="{bounds.height}px"
    >
      <span>Ω &nbsp; MY FACTORY <small>ENCLOSURE · SCOPE I/O</small></span>
    </div>

    <svg class="connections" aria-label="Factory routes">
      {#each scopedGame.definition.connections as edge (edge.id)}
        {@const path = routePath(routeAnchor(game, edge.from), routeAnchor(game, edge.to))}
        <path d={path} class="route-shadow" />
        <path
          d={path}
          class="route"
          class:flowing={running && game.state.transfers.includes(edge.id)}
        />
        <path
          d={path}
          class="route-hit"
          class:selected={activeEdge === edge.id}
          role="button"
          tabindex="0"
          aria-label="Select route {edge.id}"
          onclick={() => (activeEdge = edge.id)}
          onkeydown={(e) => {
            if (e.key === 'Enter') activeEdge = edge.id;
          }}
        />
      {/each}
    </svg>
    {#each scopedGame.definition.connections as edge (edge.id)}
      {@const labelPoint = routeLabelPoint(
        routeAnchor(game, edge.from),
        routeAnchor(game, edge.to),
      )}
      {@const rate = routeFlowRate(game, edge.id)}
      <button
        class="route-rate"
        class:flowing={rate > 0 && running}
        class:selected={activeEdge === edge.id}
        style:left="{labelPoint.x}px"
        style:top="{labelPoint.y}px"
        aria-label="Flow rate for route {edge.id}: {rate.toFixed(1)} items per simulation second"
        title="{rate.toFixed(2)} items / simulation s · 5-second moving average{running
          ? ''
          : ' · Paused'}"
        onclick={() => (activeEdge = edge.id)}>{rate.toFixed(1)}/s</button
      >
    {/each}
    {#each scopedGame.definition.nodes as node (node.id)}
      <NodeCard
        {game}
        {node}
        {connecting}
        selected={selected === node.id}
        onselect={() => onselect(node.id)}
        ondrag={(e) => startDrag(e, node.id)}
        onport={(side) => onport(node.id, side)}
      />
    {/each}
  </div>
  {#if webgl}
    <div class="flow-layer" aria-hidden="true">
      <svelte:boundary
        onerror={() => {
          webgl = false;
        }}
      >
        <Canvas dpr={[1, 1.5]}
          ><FlowScene game={scopedGame} {width} {height} {running} {reducedMotion} /></Canvas
        >
      </svelte:boundary>
    </div>
  {/if}
  {#if connecting}<div class="connection-notice">
      Select a matching input port to connect <button
        aria-label="Cancel connection"
        onclick={oncancel}><X size={15} /></button
      >
    </div>{/if}
  {#if activeRoute}<div class="connection-notice route-details">
      <div class="route-reading">
        <strong>{routeFlowRate(game, activeRoute.id).toFixed(2)} items / simulation s</strong>
        <span>5-second moving average</span>
        <small>{running ? 'Live throughput' : 'Paused · last measured rate'}</small>
      </div>
      <button
        onclick={() => {
          ondisconnect(activeRoute.id);
          activeEdge = null;
        }}><Unplug size={15} /> Disconnect selected route</button
      ><button aria-label="Close route selection" onclick={() => (activeEdge = null)}
        ><X size={15} /></button
      >
    </div>{/if}
  <div class="canvas-bottom">
    <span>Drag Things to arrange <span class="hint-divider">·</span> Connect the colored ports</span
    >
    <PlaneControls
      zoom={game.layout.zoom}
      {panMode}
      onPanChange={(value) => (panMode = value)}
      onZoom={zoomAt}
      onFit={fit}
      fitLabel="Fit factory"
    />
  </div>
</div>
