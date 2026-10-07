<script lang="ts">
  import {
    ArrowRight,
    Check,
    ChevronRight,
    CircleHelp,
    Coins,
    Flag,
    Lightbulb,
    LockKeyhole,
    Package,
    Play,
    Sparkles,
    Trash2,
    TrendingUp,
    X,
    Zap,
  } from '@lucide/svelte';
  import type { Session } from '../session.svelte';
  import { capacity, CATALOG, CONTRACTS, RESOURCES, RECIPES, total } from '../game/catalog';
  import {
    claimContract,
    connect,
    configureNode,
    diagnose,
    disconnect,
    removeNode,
    upgradeCost,
    upgradeNode,
  } from '../game/engine';
  import type { Resource } from '../game/types';
  import NodeIcon from './NodeIcon.svelte';
  import QuestTracker from './QuestTracker.svelte';
  let { session }: { session: Session } = $props();
  const game = $derived(session.editorGame);
  const node = $derived(
    game.definition.nodes.find(
      (n) =>
        n.id === session.selected &&
        (session.view === 'interior' || CATALOG[n.kind].plane === 'world'),
    ),
  );
  const contract = $derived(CONTRACTS[game.state.contractIndex]);
  const complete = $derived(contract && game.state.contractProgress >= contract.amount);
  const status = $derived(node ? diagnose(game, node.id) : null);
  let confirmDelete = $state(false);
  $effect(() => {
    session.selected;
    confirmDelete = false;
  });
</script>

<aside class="sidebar">
  {#if node && status}
    <div class="sidebar-top">
      <span class="eyebrow"
        >{CATALOG[node.kind].scopePort
          ? 'FACTORY SCOPE · BOUNDARY PORT'
          : CATALOG[node.kind].plane === 'world'
            ? 'WORLD · EXTERNAL PARTNER'
            : 'INTERIOR THING'}</span
      ><button
        class="icon-button"
        aria-label="Close inspector"
        onclick={() => (session.selected = null)}><X size={17} /></button
      >
    </div>
    <div class="inspector-title">
      <span style:color={CATALOG[node.kind].color}><NodeIcon kind={node.kind} size={28} /></span>
      <div>
        <h2>{CATALOG[node.kind].name}</h2>
        <p>{node.id} · Level {node.level}</p>
      </div>
    </div>
    <div class="diagnosis {status.tone}">
      <strong><span class="status-dot"></span>{status.label}</strong>
      <p>{status.detail}</p>
    </div>
    <div class="inspector-section">
      <span class="eyebrow">INVENTORY</span>
      {#each Object.entries(RESOURCES) as [resource, info]}<div class="inventory-row">
          <span><i style:background={info.color}></i>{info.name}</span><strong
            >{game.state.nodes[node.id].inventory[resource as Resource]}</strong
          >
        </div>{/each}
      <div class="progress-track">
        <i style:width="{(total(game.state.nodes[node.id].inventory) / capacity(node)) * 100}%"></i>
      </div>
      <small>{total(game.state.nodes[node.id].inventory)} of {capacity(node)} capacity</small>
    </div>
    <div class="inspector-section">
      <span class="eyebrow">OPERATING RULES</span>
      {#if node.kind !== 'supplier' && !RECIPES[node.kind]}
        <label class="field-label"
          >Resource<select
            aria-label="Node resource"
            disabled={total(game.state.nodes[node.id].inventory) > 0}
            value={node.resource}
            onchange={(e) =>
              session.edit((g) =>
                configureNode(g, node.id, { resource: e.currentTarget.value as Resource }),
              )}
            >{#each Object.entries(RESOURCES) as [value, info]}<option {value}>{info.name}</option
              >{/each}</select
          ></label
        >
        <small
          >Changing resource requires an empty inventory and disconnects this node’s routes.</small
        >
      {:else}<p class="muted">{CATALOG[node.kind].description}</p>{/if}
      <button
        class="secondary full"
        onclick={() => session.edit((g) => configureNode(g, node.id, { enabled: !node.enabled }))}
        >{node.enabled ? 'Pause this node' : 'Enable this node'}</button
      >
      <button
        class="secondary full"
        disabled={node.level >= 3 || game.state.credits < upgradeCost(node)}
        onclick={() => session.edit((g) => upgradeNode(g, node.id), 'Building upgraded')}
        ><Zap size={15} />{node.level >= 3
          ? 'Fully upgraded'
          : `Upgrade · ${upgradeCost(node)} credits`}</button
      >
      <small>Upgrades increase capacity and speed up production recipes and suppliers.</small>
    </div>
    {#if CATALOG[node.kind].plane === 'world'}
      <div class="inspector-section">
        <label class="field-label"
          >Connect to factory boundary
          <select
            aria-label="Connect external partner to boundary"
            value=""
            onchange={(event) => {
              const slot = event.currentTarget.value;
              if (!slot) return;
              session.edit(
                (g) =>
                  node.kind === 'supplier' ? connect(g, node.id, slot) : connect(g, slot, node.id),
                'Boundary route connected',
              );
              event.currentTarget.value = '';
            }}
          >
            <option value=""
              >Choose a compatible {node.kind === 'supplier' ? 'Inlet' : 'Outlet'}</option
            >
            {#each game.definition.nodes.filter((n) => n.kind === (node.kind === 'supplier' ? 'import' : 'export') && n.resource === node.resource && !game.definition.connections.some( (e) => (node.kind === 'supplier' ? e.from === node.id && e.to === n.id : e.from === n.id && e.to === node.id) )) as slot}
              <option value={slot.id}>{slot.id} · {RESOURCES[slot.resource].name}</option>
            {/each}
          </select>
        </label>
      </div>
    {/if}
    <div class="inspector-section">
      <span class="eyebrow">CONNECTED ROUTES</span>
      {#each game.definition.connections.filter((e) => e.from === node.id || e.to === node.id) as edge}<div
          class="route-row"
        >
          <span
            >{edge.from === node.id ? 'To' : 'From'}
            {CATALOG[
              game.definition.nodes.find(
                (n) => n.id === (edge.from === node.id ? edge.to : edge.from),
              )!.kind
            ].name}</span
          ><button
            aria-label="Disconnect {edge.id}"
            title="Disconnect route"
            onclick={() => session.edit((g) => disconnect(g, edge.id), 'Route disconnected')}
            ><X size={14} /></button
          >
        </div>{:else}<p class="muted">No routes connected yet.</p>{/each}
    </div>
    {#if confirmDelete}<div class="delete-confirm">
        <p>
          Remove this node and discard its inventory? Salvage returns {Math.floor(
            CATALOG[node.kind].cost / 2,
          )} credits.
        </p>
        <button
          class="danger"
          onclick={() => session.edit((g) => removeNode(g, node.id), 'Node salvaged')}
          >Confirm removal</button
        ><button class="text-button" onclick={() => (confirmDelete = false)}>Cancel</button>
      </div>{:else}<button class="text-button danger-text" onclick={() => (confirmDelete = true)}
        ><Trash2 size={14} /> Salvage node</button
      >{/if}
  {:else}
    <QuestTracker {session} />
    <div class="guide-card">
      <div><Lightbulb size={17} /><span class="eyebrow">A LITTLE DIRECTION</span></div>
      {#if game.state.tick === 0}<h3>Make your first connection.</h3>
        <p>
          Select the <strong>Smelter’s output</strong>, then the
          <strong>Export gate’s input</strong>. Apply the draft, then production resumes after the
          service cooldown.
        </p>
      {:else if game.state.contractIndex === 1}<h3>Discover another possibility.</h3>
        <p>
          Add an assembler after the smelter. Use an empty export gate and customer set to <strong
            >Precision gear</strong
          >.
        </p>
      {:else}<h3>Follow the flow.</h3>
        <p>
          Select any node to see its inventory and why it’s waiting. Try more storage or a second
          production line.
        </p>{/if}
      <button class="text-button" onclick={() => (session.panel = 'help')}
        >Field guide <ChevronRight size={15} /></button
      >
    </div>
    <button class="discovery-link" onclick={() => (session.panel = 'lab')}
      ><span><Sparkles size={19} /></span>
      <div>
        <strong>There’s more than one way.</strong><small>Rediscover a rule in the Logic Lab</small>
      </div>
      <ChevronRight size={17} /></button
    >
    <div class="journey-note">
      <span class="tiny-omega">Ω</span>
      <p>Model. Build. Simulate.<br />Understand. Improve. Realize.</p>
    </div>
  {/if}
</aside>
