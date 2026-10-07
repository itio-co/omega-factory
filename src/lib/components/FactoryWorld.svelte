<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { ArrowRight, Factory, Zap, Minus, Plus, Maximize, Mountain, Store } from '@lucide/svelte';
  import type { Session } from '../session.svelte';
  import { factoryUpgradeCost, placeComponent, upgradeFactory } from '../game/factory';
  import { CATALOG, RESOURCES, total } from '../game/catalog';
  import { routeFlowRate } from '../game/flow';
  import PlaneControls from './PlaneControls.svelte';
  import FactoryWorldScene from './FactoryWorldScene.svelte';
  let { session }: { session: Session } = $props();
  let panMode = $state(false);
  let viewport: HTMLDivElement;
  let panDrag: { x: number; y: number; left: number; top: number } | null = null;
  let zoom = $state(0.8);
  let viewportWidth = $state(1000);
  const partners = $derived(
    session.editorGame.definition.nodes.filter((n) => CATALOG[n.kind].plane === 'world'),
  );
  const mapHeight = $derived(
    Math.max(
      720 + (session.worldThing.factories.length - 1) * 110,
      ...partners.map((n) => partnerY(n.id) + 200),
    ),
  );
  function partnerX(id: string) {
    const node = partners.find((n) => n.id === id)!;
    return session.editorGame.layout.positions[id].x - (node.kind === 'customer' ? 360 : 0);
  }
  function partnerY(id: string) {
    const node = partners.find((n) => n.id === id)!;
    return session.editorGame.layout.positions[id].y + (node.kind === 'customer' ? -220 : 30);
  }
  let drag: {
    id: string;
    x: number;
    y: number;
    original: { x: number; y: number };
    started: boolean;
  } | null = null;
  function startDrag(event: PointerEvent, id: string) {
    if (event.button !== 0 || panMode) return;
    session.selected = id;
    drag = {
      id,
      x: event.clientX,
      y: event.clientY,
      original: { ...session.editorGame.layout.positions[id] },
      started: false,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function moveDrag(event: PointerEvent) {
    if (!drag || Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 3) return;
    const node = partners.find((n) => n.id === drag!.id)!;
    const point = placeComponent(session.editorGame, node.kind, {
      x: Math.max(
        node.kind === 'customer' ? 1310 : 0,
        Math.min(
          node.kind === 'customer' ? 1360 : 84,
          drag.original.x + (event.clientX - drag.x) / zoom,
        ),
      ),
      y: Math.max(
        node.kind === 'customer' ? 300 : 80,
        Math.min(89000, drag.original.y + (event.clientY - drag.y) / zoom),
      ),
    });
    const current = session.editorGame.layout.positions[node.id];
    if (point.x === current.x && point.y === current.y) return;
    if (!drag.started) {
      session.remember();
      drag.started = true;
    }
    session.layout({
      ...session.editorGame.layout,
      positions: { ...session.editorGame.layout.positions, [node.id]: point },
    });
  }
  function routes(id: string) {
    return session.editorGame.definition.connections.filter((e) => e.from === id || e.to === id);
  }
  function rate(id: string) {
    return routes(id).reduce((sum, edge) => sum + routeFlowRate(session.game, edge.id), 0);
  }
  const factory = $derived(session.game.state.factory);
</script>

<section class="factory-world" aria-label="World view">
  <div class="world-map-toolbar">
    <div>
      <span class="eyebrow"
        >ITIOVERSE · {session.worldThing.name.toUpperCase()} · {session.collection.categories.find(
          (c) => c.id === session.worldThing.category,
        )?.name}</span
      >
      <p>External supply → Factory → Customers</p>
    </div>
    <PlaneControls
      {zoom}
      {panMode}
      onPanChange={(value) => (panMode = value)}
      onZoom={(factor) => (zoom = Math.max(0.3, Math.min(1.8, zoom * factor)))}
      onFit={() => (zoom = Math.min(1, (viewportWidth - 30) / 1200))}
      fitLabel="Fit world map"
    />
  </div>
  <div
    class="world-map-viewport"
    bind:this={viewport}
    bind:clientWidth={viewportWidth}
    role="region"
    aria-label="World canvas"
    onpointerdown={(event) => {
      if (event.button !== 0 || (!panMode && (event.target as HTMLElement).closest('button')))
        return;
      panDrag = {
        x: event.clientX,
        y: event.clientY,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
      };
      viewport.setPointerCapture(event.pointerId);
    }}
    onpointermove={(event) => {
      if (panDrag) {
        viewport.scrollLeft = panDrag.left - (event.clientX - panDrag.x);
        viewport.scrollTop = panDrag.top - (event.clientY - panDrag.y);
      }
    }}
    onpointerup={() => (panDrag = null)}
    onpointercancel={() => (panDrag = null)}
  >
    <div style:width="{1200 * zoom}px" style:height="{mapHeight * zoom}px">
      <div
        class="world-map-board"
        role="region"
        aria-label="World map"
        style:height="{mapHeight}px"
        style:transform="scale({zoom})"
      >
        <div class="map-zone supply-zone">SUPPLY DISTRICT</div>
        <div class="map-zone factory-zone">FACTORY DISTRICT</div>
        <div class="map-zone customer-zone">CUSTOMER DISTRICT</div>
        <svg
          class="world-map-routes"
          width="1200"
          height={mapHeight}
          aria-label="World transport routes"
        >
          <defs
            ><marker
              id="world-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#859575" /></marker
            ></defs
          >
          {#each partners as node}
            {@const y = partnerY(node.id) + 55}
            {#if routes(node.id).length}
              <path
                d={node.kind === 'supplier'
                  ? `M ${partnerX(node.id) + 200} ${y} C 330 ${y}, 330 320, 400 320`
                  : `M 830 320 C 890 320, 890 ${y}, ${partnerX(node.id)} ${y}`}
                fill="none"
                stroke="#859575"
                stroke-width="3"
                marker-end="url(#world-arrow)"
              />
              <text x={node.kind === 'supplier' ? 285 : 867} y={y - 15}
                >{rate(node.id).toFixed(1)}/s</text
              >
            {/if}
          {/each}
        </svg>
        <section class="map-partners" aria-label="External world partners">
          {#each partners as node}
            <button
              class="world-partner"
              class:selected={session.selected === node.id}
              data-world-node-id={node.id}
              onpointerdown={(event) => startDrag(event, node.id)}
              onpointermove={moveDrag}
              onpointerup={() => (drag = null)}
              onpointercancel={() => (drag = null)}
              style:left="{partnerX(node.id)}px"
              style:top="{partnerY(node.id)}px"
              onclick={() => {
                session.selected = node.id;
              }}
            >
              {#if node.kind === 'supplier'}<Mountain size={28} />{:else}<Store size={28} />{/if}
              <strong>{CATALOG[node.kind].name}</strong><small>WORLD · EXTERNAL</small>
              <span>{RESOURCES[node.resource].name} · {routes(node.id).length} boundary routes</span
              >
            </button>
          {/each}
        </section>
        <article class="world-factory" data-testid="world-factory">
          <header>
            <span class="eyebrow">{session.factoryThing.name.toUpperCase()}</span><span
              class="factory-level">LEVEL {factory.level}</span
            >
          </header>
          <div class="world-factory-scene">
            <svelte:boundary>
              <Canvas
                ><FactoryWorldScene level={factory.level} offline={factory.downtime > 0} /></Canvas
              >{#snippet failed()}<Factory size={100} />{/snippet}
            </svelte:boundary>
          </div>
          <div class="world-slots">
            <span
              >IN · {session.game.definition.nodes.filter((n) => n.kind === 'import').length} inlet slots</span
            ><span
              >{session.game.definition.nodes.filter((n) => n.kind === 'export').length} outlet slots
              · OUT</span
            >
          </div>
          <div
            class="factory-service"
            class:offline={factory.downtime > 0}
            data-testid="factory-service"
          >
            {#if factory.downtime > 0}<strong
                >Out of service · {Math.ceil(factory.downtime / 4)}s</strong
              ><span>Applying update. Production resumes automatically.</span>{:else}<strong
                >In service · running automatically</strong
              ><span
                >{session.editorGame.definition.nodes.filter(
                  (n) => CATALOG[n.kind].plane !== 'world',
                ).length} installed Things · {total(session.game.state.delivered)} delivered</span
              >{/if}
          </div>
          <button class="primary full" onclick={() => session.openFactory()}
            >Open factory interior <ArrowRight size={17} /></button
          >
          <button
            class="secondary full"
            disabled={factory.level >= 3 ||
              factory.downtime > 0 ||
              session.game.state.credits < factoryUpgradeCost(factory.level)}
            onclick={() => session.act(upgradeFactory, 'Factory upgrade started')}
            ><Zap size={16} />{factory.level >= 3
              ? 'Factory fully upgraded'
              : `Upgrade factory · ${factoryUpgradeCost(factory.level)} CR`}</button
          >
          <small class="world-cooldown"
            >Update downtime: level 1 · 30s / level 2 · 20s / level 3 · 10s of simulation time.</small
          >
        </article>
        {#each session.worldThing.factories.filter((f) => f.id !== session.collection.activeFactory) as thing, i}
          <button
            class="other-factory-thing"
            style:top="{650 + i * 110}px"
            onclick={() => {
              session.focusThing(session.collection.activeWorld, thing.id);
              session.openFactory();
            }}
          >
            <Factory size={28} /><strong>{thing.name}</strong><span
              >{session.collection.categories.find((c) => c.id === thing.category)?.name} · {thing
                .game.definition.nodes.length} Things · {thing.game.state.factory.downtime > 0
                ? 'Out of service'
                : 'Running'}</span
            ><small>Open enclosure →</small>
          </button>
        {/each}
        <div class="map-compass">N ↑<small>LOCAL WORLD · Scroll to explore</small></div>
      </div>
    </div>
  </div>
</section>
