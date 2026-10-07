<script lang="ts">
  import {
    capacity,
    CATALOG,
    duration,
    inputResource,
    outputResource,
    RESOURCES,
    total,
    RECIPES,
  } from '../game/catalog';
  import { isFactorySlot } from '../game/factory';
  import { diagnose } from '../game/engine';
  import type { Game, Node } from '../game/types';
  import NodeIcon from './NodeIcon.svelte';
  let {
    game,
    node,
    selected,
    connecting,
    onselect,
    ondrag,
    onport,
  }: {
    game: Game;
    node: Node;
    selected: boolean;
    connecting: string | null;
    onselect: () => void;
    ondrag: (event: PointerEvent) => void;
    onport: (side: 'in' | 'out') => void;
  } = $props();
  const data = $derived(CATALOG[node.kind]);
  const state = $derived(game.state.nodes[node.id]);
  const status = $derived(diagnose(game, node.id));
  const input = $derived(inputResource(node));
  const output = $derived(outputResource(node));
</script>

<article
  class:selected
  class:disabled={!node.enabled}
  class="node-card"
  class:factory-slot={isFactorySlot(node.kind)}
  style:left="{game.layout.positions[node.id].x}px"
  style:top="{game.layout.positions[node.id].y}px"
  style:--node-color={data.color}
  data-node-id={node.id}
>
  {#if isFactorySlot(node.kind)}
    <button
      class="slot-heading"
      aria-label="Select {data.name}"
      onpointerdown={ondrag}
      onclick={onselect}
      title="Enclosure port · drag vertically to reposition"
    >
      <small>{node.kind === 'import' ? 'INLET' : 'OUTLET'}</small>
      <NodeIcon kind={node.kind} size={18} />
      <strong>{RESOURCES[node.resource].short}</strong>
    </button>
    <span class="slot-count">{total(state.inventory)} / {capacity(node)}</span>
  {:else}
    <button
      class="node-heading"
      aria-label="Select {data.name}"
      onpointerdown={ondrag}
      onclick={onselect}
    >
      <span class="node-icon"><NodeIcon kind={node.kind} /></span>
      <span
        ><strong>{data.name}</strong><small
          >{data.plane === 'world' ? 'World · External' : 'Factory interior'}
          <span>· Lv. {node.level}</span></small
        ></span
      >
      <span class="node-drag">⠿</span>
    </button>
    <div class="node-art" aria-hidden="true">
      <span class="fallback-model"><NodeIcon kind={node.kind} size={38} /></span>
    </div>
    <div class="node-recipe">
      {#if RECIPES[node.kind]}
        <span class="resource-dot" style:background={RESOURCES[input!].color}></span>
        {RECIPES[node.kind]!.amount}
        {RESOURCES[input!].short}
        <span class="recipe-arrow">→</span><span
          class="resource-dot"
          style:background={RESOURCES[output!].color}
        ></span>
        1 {RESOURCES[output!].short}
      {:else}<span class="resource-dot" style:background={RESOURCES[node.resource].color}
        ></span>{RESOURCES[node.resource].name}<span class="recipe-count"
          >{total(state.inventory)} / {capacity(node)}</span
        >{/if}
    </div>
    <div class="node-meter">
      <i
        style:width="{state.jobRemaining
          ? (1 - state.jobRemaining / (duration(node) + 1)) * 100
          : (total(state.inventory) / capacity(node)) * 100}%"
      ></i>
    </div>
    <div class="node-status {status.tone}">
      <span></span>{status.label}<small>{state.completed > 0 ? state.completed : ''}</small>
    </div>
  {/if}
  {#if input}<button
      class="port input"
      class:available={!!connecting && connecting !== node.id}
      aria-label="Connect {data.name} input"
      title="{RESOURCES[input].name} input"
      onclick={() => onport('in')}><i style:background={RESOURCES[input].color}></i></button
    >{/if}
  {#if output}<button
      class="port output"
      class:connecting={connecting === node.id}
      aria-label="Connect {data.name} output"
      title="{RESOURCES[output].name} output"
      onclick={() => onport('out')}><i style:background={RESOURCES[output].color}></i></button
    >{/if}
</article>
