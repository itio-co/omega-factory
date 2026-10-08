<script lang="ts">
  import { Truck } from '@lucide/svelte';
  import type { Session } from '../session.svelte';
  import { CATALOG, RESOURCES } from '../game/catalog';
  import {
    diagnoseLink,
    factoryLinks,
    inTransit,
    linkError,
    linkStalled,
    removalLoss,
  } from '../game/transport';
  import {
    LINK_LEVELS,
    linkCapacity,
    transportUnlocked,
    type LinkEnd,
    type TransportLink,
  } from '../game/transport-model';
  let { session }: { session: Session } = $props();

  const CARD = 230,
    GAP = 220,
    ROW = 36,
    TOP = 92;
  const world = $derived(session.worldThing);
  const factories = $derived(world.factories);
  const ports = (i: number, port: 'inlet' | 'outlet') =>
    factories[i].game.definition.nodes.filter((n) => CATALOG[n.kind].scopePort === port);
  const height = $derived(
    TOP +
      40 +
      Math.max(
        1,
        ...factories.map((_, i) => Math.max(ports(i, 'inlet').length, ports(i, 'outlet').length)),
      ) *
        ROW,
  );
  const width = $derived(20 + factories.length * (CARD + GAP));
  function anchor(end: LinkEnd, port: 'inlet' | 'outlet') {
    const i = factories.findIndex((f) => f.id === end.factory);
    const j = ports(i, port).findIndex((n) => n.id === end.node);
    return { x: 20 + i * (CARD + GAP) + (port === 'outlet' ? CARD : 0), y: TOP + j * ROW + 15 };
  }
  function path(link: TransportLink) {
    const a = anchor(link.from, 'outlet'),
      b = anchor(link.to, 'inlet'),
      bend = Math.max(60, Math.abs(b.x - a.x) / 2);
    return `M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${b.x - bend} ${b.y}, ${b.x} ${b.y}`;
  }
  function mid(link: TransportLink) {
    const a = anchor(link.from, 'outlet'),
      b = anchor(link.to, 'inlet');
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  const live = (id: string) => world.links.find((l) => l.id === id);
  function linkState(link: TransportLink) {
    const current = live(link.id);
    if (!current) return { tone: 'draft', label: 'Draft · applies on Apply' };
    const d = diagnoseLink(world, current);
    const label =
      d.label === 'Link stalled'
        ? 'Stalled · Inlet full'
        : d.label === 'Link outage'
          ? `Outage · holding ${inTransit(current)}`
          : `${linkCapacity(current.level)}/tick · ${inTransit(current)} in transit`;
    return { tone: d.label.replace('Link ', ''), label, detail: d.detail };
  }
  const refusal = (to: LinkEnd) =>
    session.linkFrom ? linkError(world, session.links, session.linkFrom, to) : null;
  function tryLink(to: LinkEnd) {
    if (!session.linkFrom) return;
    const error = refusal(to);
    if (error) {
      session.notify(`Link refused: ${error}`);
      session.linkFrom = null;
    } else session.addLink(session.linkFrom, to);
  }
  let board = $state<HTMLDivElement>();
  let rubber = $state<{ x: number; y: number } | null>(null);
  let start = { x: 0, y: 0 };
  function down(event: PointerEvent, from: LinkEnd) {
    if (event.button !== 0) return;
    session.linkFrom = from;
    session.selectedLink = null;
    start = { x: event.clientX, y: event.clientY };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (!session.linkFrom || !board || !(event.buttons & 1)) return;
    const box = board.getBoundingClientRect();
    rubber = { x: event.clientX - box.left, y: event.clientY - box.top };
  }
  function up(event: PointerEvent) {
    rubber = null;
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-inlet]');
    if (target) tryLink({ factory: target.dataset.factory!, node: target.dataset.inlet! });
    else if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6)
      session.linkFrom = null;
  }
  const selected = $derived(session.links.find((l) => l.id === session.selectedLink));
  const name = (id: string) => factories.find((f) => f.id === id)?.name ?? id;
</script>

<section class="transport-network" aria-label="Transport network">
  <header>
    <span class="eyebrow"><Truck size={14} /> TRANSPORT NETWORK</span>
    <p>
      {#if session.linkFrom}Drop on a highlighted Inlet (or click it). Dimmed Inlets can't take this
        link.{:else}Drag from a factory's Outlet to another factory's Inlet. Links cost {LINK_LEVELS[0]
          .cost} CR from the source factory.{/if}
    </p>
  </header>
  {#if !transportUnlocked(world)}
    <p class="transport-locked" data-testid="transport-locked">
      Transport locked · build a second factory in this World to link Outlets to Inlets.
    </p>
  {:else}
    <div class="transport-scroll">
      <div
        class="transport-board"
        bind:this={board}
        style:width="{width}px"
        style:height="{height}px"
      >
        <svg {width} {height} aria-hidden="true">
          {#each session.links as link (link.id)}
            {@const s = linkState(link)}
            <path id="route-{link.id}" class="transport-link {s.tone}" d={path(link)} />
            {#if s.tone === 'moving'}
              <circle class="transport-pulse" r="5"
                ><animateMotion
                  dur="{Math.max(0.6, link.delay * 0.25)}s"
                  repeatCount="indefinite"
                  path={path(link)}
                /></circle
              >
            {/if}
          {/each}
          {#if rubber && session.linkFrom}
            {@const a = anchor(session.linkFrom, 'outlet')}
            <line class="transport-rubber" x1={a.x} y1={a.y} x2={rubber.x} y2={rubber.y} />
          {/if}
        </svg>
        {#each factories as factory, i (factory.id)}
          {@const io = factoryLinks(session.links, factory.id)}
          <article
            class="transport-factory"
            style:left="{20 + i * (CARD + GAP)}px"
            style:width="{CARD}px"
            data-factory-card={factory.id}
          >
            <strong>{factory.name}</strong>
            <small data-testid="factory-io-{factory.id}"
              >Imports {io.imports
                .map((l) => `${l.resource} ← ${name(l.from.factory)}`)
                .join(', ') || 'none'} · Exports
              {io.exports.map((l) => `${l.resource} → ${name(l.to.factory)}`).join(', ') ||
                'none'}</small
            >
            {#each ports(i, 'inlet') as node, j (node.id)}
              {@const end = { factory: factory.id, node: node.id }}
              {@const blocked = session.linkFrom ? refusal(end) : null}
              <button
                class="transport-port inlet"
                class:dim={!!blocked}
                class:target={session.linkFrom && !blocked}
                style:top="{TOP + j * ROW}px"
                data-inlet={node.id}
                data-factory={factory.id}
                aria-label="Inlet {node.id} of {factory.name}"
                title={blocked ?? ''}
                onclick={() => tryLink(end)}
                >IN · {RESOURCES[node.resource].name} · {factory.game.state.nodes[node.id]
                  .inventory[node.resource]}</button
              >
            {/each}
            {#each ports(i, 'outlet') as node, j (node.id)}
              {@const end = { factory: factory.id, node: node.id }}
              <button
                class="transport-port outlet"
                class:active={session.linkFrom?.factory === factory.id &&
                  session.linkFrom.node === node.id}
                style:top="{TOP + j * ROW}px"
                aria-label="Outlet {node.id} of {factory.name}"
                onpointerdown={(event) => down(event, end)}
                onpointermove={move}
                onpointerup={up}
                >{RESOURCES[node.resource].name} · {factory.game.state.nodes[node.id].inventory[
                  node.resource
                ]} · OUT</button
              >
            {/each}
          </article>
        {/each}
        {#each session.links as link (link.id)}
          {@const s = linkState(link)}
          {@const m = mid(link)}
          <button
            class="transport-label {s.tone}"
            class:selected={session.selectedLink === link.id}
            style:left="{m.x}px"
            style:top="{m.y}px"
            aria-label="Link {link.id}"
            title={s.detail ?? ''}
            onclick={() => (session.selectedLink = link.id)}>{s.label}</button
          >
        {/each}
      </div>
    </div>
    {#if selected}
      {@const current = live(selected.id)}
      {@const loss = current ? removalLoss(world, current) : 0}
      <aside class="link-inspector" aria-label="Link inspector">
        <strong>{selected.id} · {name(selected.from.factory)} → {name(selected.to.factory)}</strong>
        <dl>
          <dt>Resource</dt>
          <dd>{RESOURCES[selected.resource].name}</dd>
          <dt>Capacity</dt>
          <dd>{linkCapacity(selected.level)}/tick (level {selected.level})</dd>
          <dt>Delay</dt>
          <dd>{selected.delay} ticks</dd>
          <dt>In transit</dt>
          <dd>{current ? inTransit(current) : 0}</dd>
          <dt>Cost</dt>
          <dd>
            {current ? `Paid · ${LINK_LEVELS[0].cost} CR` : `${LINK_LEVELS[0].cost} CR on Apply`}
          </dd>
          <dt>Status</dt>
          <dd>{current ? diagnoseLink(world, current).detail : 'Draft'}</dd>
        </dl>
        {#if current && inTransit(current)}
          <p class="link-warning" role="alert">
            Removing returns {inTransit(current) - loss} goods to the Outlet{loss
              ? ` and loses ${loss} that don't fit`
              : ''}.
          </p>
        {/if}
        <div>
          <button class="secondary" onclick={() => session.removeLink(selected.id)}
            >Remove link</button
          >
          <button class="text-button" onclick={() => (session.selectedLink = null)}>Close</button>
        </div>
      </aside>
    {/if}
  {/if}
</section>

<style>
  .transport-network {
    margin-top: 14px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: #fff;
    box-shadow: var(--shadow);
  }
  header p,
  .transport-locked {
    margin: 4px 0 10px;
    color: var(--muted);
    font-size: 13px;
  }
  .eyebrow {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  .transport-scroll {
    overflow-x: auto;
  }
  .transport-board {
    position: relative;
  }
  svg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  }
  .transport-link {
    fill: none;
    stroke: #859575;
    stroke-width: 3;
  }
  .transport-link.draft {
    stroke-dasharray: 6 5;
    stroke: var(--muted);
  }
  .transport-link.stalled,
  .transport-link.outage {
    stroke: #c9783f;
  }
  .transport-link.idle {
    stroke: var(--line);
  }
  .transport-pulse {
    fill: var(--gold);
  }
  .transport-rubber {
    stroke: var(--gold);
    stroke-width: 2;
    stroke-dasharray: 4 4;
  }
  .transport-factory {
    position: absolute;
    top: 0;
    bottom: 0;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--paper);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .transport-factory small {
    color: var(--muted);
    font-size: 11px;
  }
  .transport-port {
    position: absolute;
    z-index: 2;
    font-size: 11px;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: #fff;
    color: var(--ink);
    cursor: pointer;
  }
  .transport-port.inlet {
    left: -14px;
  }
  .transport-port.outlet {
    right: -14px;
    touch-action: none;
    cursor: grab;
  }
  .transport-port.active,
  .transport-port.target {
    border-color: var(--gold);
    box-shadow: 0 0 0 2px #e6b45655;
  }
  .transport-port.dim {
    opacity: 0.35;
  }
  .transport-label {
    position: absolute;
    z-index: 3;
    transform: translate(-50%, -50%);
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: #fff;
    color: var(--ink);
    white-space: nowrap;
    cursor: pointer;
  }
  .transport-label.stalled,
  .transport-label.outage {
    border-color: #c9783f;
    color: #a65a24;
  }
  .transport-label.selected {
    box-shadow: 0 0 0 2px var(--gold);
  }
  .link-inspector {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--paper);
    max-width: 460px;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    font-size: 13px;
    margin: 8px 0;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
  }
  .link-warning {
    color: #a65a24;
    font-size: 13px;
  }
</style>
