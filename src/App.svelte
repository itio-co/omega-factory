<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    Activity,
    Flag,
    ArrowRight,
    BookOpen,
    Box,
    ChevronDown,
    CircleHelp,
    Coins,
    Download,
    FlaskConical,
    GitBranch,
    LockKeyhole,
    Pause,
    Play,
    Redo2,
    RotateCcw,
    Save,
    SkipForward,
    Sparkles,
    Undo2,
    Upload,
    X,
  } from '@lucide/svelte';
  import { modal } from './lib/modal';
  import WishForm from './lib/components/WishForm.svelte';
  import { ALL_OFF, loadFeatures } from './lib/features';
  // Runtime flags from config.json; everything stays hidden until they load as on.
  let features = $state.raw(ALL_OFF);
  void loadFeatures().then((loaded) => (features = loaded));
  let showWish = $state(false);
  let wishButton = $state<HTMLButtonElement>();
  async function closeWish() {
    showWish = false;
    await tick();
    wishButton?.focus();
  }
  import { Session } from './lib/session.svelte';
  import { addNode, connect, diagnose, disconnect } from './lib/game/engine';
  import { CATALOG, total } from './lib/game/catalog';
  import { SIMULATION_STEP_MS } from './lib/game/flow';
  import type { Kind } from './lib/game/types';
  import FactoryCanvas from './lib/components/FactoryCanvas.svelte';
  import FactorySidebar from './lib/components/FactorySidebar.svelte';
  import DiscoveryPanel from './lib/components/DiscoveryPanel.svelte';
  import NodeIcon from './lib/components/NodeIcon.svelte';
  import { availableThings } from './lib/game/things';
  import ThingNavigator from './lib/components/ThingNavigator.svelte';
  import FactoryWorld from './lib/components/FactoryWorld.svelte';
  import QuestBoard from './lib/components/QuestBoard.svelte';
  import { buildingUnlockReason } from './lib/game/quests';
  const session = new Session();
  let importInput: HTMLInputElement;
  let showFiles = $state(false),
    showReset = $state(false);
  const game = $derived(session.editorGame);
  let buildCategory = $state('All');
  $effect(() => {
    session.view;
    buildCategory = 'All';
  });
  const activeNodes = $derived(
    game.definition.nodes.filter((n) => diagnose(game, n.id).tone === 'good').length,
  );
  const warnings = $derived(
    game.definition.nodes.filter((n) => diagnose(game, n.id).tone === 'warn').length,
  );
  onMount(() => {
    session.initialize();
    let last = performance.now(),
      elapsed = 0;
    const timer = setInterval(() => {
      const now = performance.now();
      elapsed += now - last;
      last = now;
      if (session.welcome) {
        elapsed = 0;
        return;
      }
      const steps = Math.min(240, Math.floor(elapsed / SIMULATION_STEP_MS));
      elapsed -= steps * SIMULATION_STEP_MS;
      for (let i = 0; i < steps * session.speed; i++) session.step();
    }, SIMULATION_STEP_MS);
    const autosave = setInterval(() => {
      if (!session.welcome) session.save(true);
    }, 5000);
    const saveOnLeave = () => {
      if (!session.welcome) session.save(true);
    };
    const onHidden = () => {
      if (document.hidden) {
        saveOnLeave();
      }
    };
    window.addEventListener('pagehide', saveOnLeave);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      clearInterval(timer);
      clearInterval(autosave);
      session.dispose();
      window.removeEventListener('pagehide', saveOnLeave);
      document.removeEventListener('visibilitychange', onHidden);
    };
  });
  function onKey(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (event.key === 'Escape') {
      if (showWish) {
        void closeWish();
        return;
      }
      session.panel = 'factory';
      session.connecting = null;
      showFiles = false;
      showReset = false;
      return;
    }
    if (
      target.closest('input, textarea, select, button, [contenteditable=true]') ||
      session.welcome ||
      session.panel !== 'factory' ||
      showReset ||
      showWish
    )
      return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? session.redo() : session.undo();
    }
  }
  function port(id: string, side: 'in' | 'out') {
    if (side === 'out') {
      session.connecting = session.connecting === id ? null : id;
      return;
    }
    if (!session.connecting) {
      session.notify('Select an output port first, then connect it to this input.');
      return;
    }
    const from = session.connecting;
    session.edit((g) => connect(g, from, id), 'Route connected');
    session.connecting = null;
  }
  function build(kind: Kind) {
    if (CATALOG[kind].plane !== session.view) return;
    session.edit((g) => {
      const position = {
        x: Math.round((450 - g.layout.pan.x) / g.layout.zoom),
        y: Math.round((350 - g.layout.pan.y) / g.layout.zoom),
      };
      if (CATALOG[kind].plane === 'world') {
        position.x = kind === 'supplier' ? 50 : 1320;
        position.y =
          Math.max(
            kind === 'supplier' ? 10 : 260,
            ...g.definition.nodes
              .filter((n) => n.kind === kind)
              .map((n) => g.layout.positions[n.id].y),
          ) + 150;
      }
      const next = addNode(g, kind, position);
      session.selected = next.definition.nodes.at(-1)!.id;
      return next;
    }, `${CATALOG[kind].name} added`);
  }
</script>

<svelte:window onkeydown={onKey} />
{#if features.wishes}<WishForm open={showWish} onclose={closeWish} />{/if}
<div
  class="app-shell"
  inert={session.welcome || session.panel !== 'factory' || showReset || showWish}
>
  <header class="topbar">
    <div class="brand" aria-label="Omega Factory">
      <span class="brand-mark">Ω</span><span
        ><strong>OMEGA <b>FACTORY</b></strong><small>AN ITIOVERSE EXPERIENCE</small></span
      >
    </div>
    <div class="project-name">
      <span class="project-separator"></span><span
        >{session.factoryThing.name}<small
          >{session.worldThing.name} · {session.collection.categories.find(
            (c) => c.id === session.factoryThing.category,
          )?.name}</small
        ></span
      ><ChevronDown size={14} />
    </div>
    <div class="top-actions">
      {#if features.wishes}<button
          class="secondary"
          bind:this={wishButton}
          onclick={() => (showWish = true)}><Sparkles size={16} />Make a Wish</button
        >{/if}
      <span class="credits"
        ><Coins size={17} /><strong data-testid="credits"
          >{game.state.credits.toLocaleString()}</strong
        ><small>CR</small></span
      ><span class="top-separator"></span><button
        class="icon-button"
        aria-label="Save factory"
        title="Save factory"
        onclick={() => session.save()}><Save size={18} /></button
      ><button
        class="secondary file-toggle"
        aria-expanded={showFiles}
        onclick={() => (showFiles = !showFiles)}>Factory <ChevronDown size={14} /></button
      >
    </div>
    {#if showFiles}<div class="file-menu">
        <button
          onclick={() => {
            session.export();
            showFiles = false;
          }}><Download size={16} />Export save</button
        ><button
          onclick={() => {
            importInput.click();
            showFiles = false;
          }}><Upload size={16} />Import save</button
        ><button
          onclick={() => {
            showReset = true;
            showFiles = false;
          }}><RotateCcw size={16} />Start a new factory</button
        >
      </div>{/if}
  </header>
  <div class="main-body">
    <nav class="rail" aria-label="Main navigation">
      <div>
        <button
          class="active"
          aria-label="Factory view"
          title="Factory"
          onclick={() => {
            session.panel = 'factory';
            session.view = 'world';
            session.selected = null;
          }}><Box size={22} /><span>Factory</span></button
        ><button aria-label="Open quest board" onclick={() => (session.panel = 'quests')}
          ><Flag size={22} /><span>Quests</span></button
        ><button
          aria-label="Open Logic Lab"
          title="Logic Lab"
          onclick={() => {
            session.panel = 'lab';
          }}><FlaskConical size={22} /><span>Discover</span></button
        ><button
          aria-label="Open Insight Journal"
          title="Insight Journal"
          onclick={() => {
            session.panel = 'journal';
          }}
          ><BookOpen size={22} /><span>Journal</span>{#if game.state.journal.length}<i
              >{game.state.journal.length}</i
            >{/if}</button
        >
      </div>
      <div>
        <button
          aria-label="Open field guide"
          title="Field guide"
          onclick={() => (session.panel = 'help')}
          ><CircleHelp size={21} /><span>Guide</span></button
        ><span class="rail-footer">itio<span>verse</span></span>
      </div>
    </nav>
    <main class="workspace">
      <ThingNavigator {session} />
      <div class="factory-tabs">
        <button
          class:active={session.view === 'world'}
          onclick={() => {
            session.view = 'world';
            session.selected = null;
          }}>World</button
        ><button class:active={session.view === 'interior'} onclick={() => session.openFactory()}
          >Factory interior {session.dirty ? '· Draft' : ''}</button
        >
      </div>
      {#if session.view === 'interior' || session.dirty || session.linkDirty}
        <div class="draft-banner">
          <span
            ><strong>Layout draft</strong> · Live factory keeps running. Apply to update; unapplied drafts
            are not saved.</span
          >
          <div>
            <button
              class="text-button"
              onclick={() => session.discardDraft()}
              disabled={!session.dirty && !session.linkDirty}>Discard draft</button
            >{#if session.linkDirty}<button class="primary" onclick={() => session.applyLinks()}
                >Apply transport links · {session.linkCost} CR</button
              >{/if}<button
              class="primary"
              disabled={!session.dirty ||
                session.game.state.factory.downtime > 0 ||
                game.state.credits < 0}
              onclick={() => session.applyDraft()}>Apply factory update</button
            >
          </div>
        </div>
      {/if}
      <div class="workspace-toolbar">
        <div class="workspace-tab">
          <GitBranch size={16} /><strong
            >{session.view === 'world' ? 'World graph' : 'Factory graph'}</strong
          ><span>01</span>
        </div>
        <div class="edit-controls">
          <span>Changes stay in this draft</span><button
            class="icon-button"
            aria-label="Undo"
            title="Undo edit"
            disabled={!session.undoStack.length}
            onclick={() => session.undo()}><Undo2 size={17} /></button
          ><button
            class="icon-button"
            aria-label="Redo"
            title="Redo edit"
            disabled={!session.redoStack.length}
            onclick={() => session.redo()}><Redo2 size={17} /></button
          >
        </div>
      </div>
      {#if session.view === 'world'}<FactoryWorld {session} />{:else}
        <section class="scope-context" aria-label="Factory scope ports">
          <div>
            <strong>Factory scope</strong><small>Enclosure ports · World ↔ Interior</small>
          </div>
          <div class="scope-ports">
            {#each game.definition.nodes.filter((n) => CATALOG[n.kind].scopePort) as node}
              <button
                class="secondary"
                class:active={session.selected === node.id}
                onclick={() => (session.selected = node.id)}
              >
                {node.kind === 'import' ? 'Inlet' : 'Outlet'} · {node.resource}
              </button>
            {/each}
          </div>
          <button
            class="secondary"
            aria-label="Build Import gate"
            disabled={game.state.credits < CATALOG.import.cost}
            onclick={() => build('import')}>+ Inlet · {CATALOG.import.cost} CR</button
          >
          <button
            class="secondary"
            aria-label="Build Export gate"
            disabled={game.state.credits < CATALOG.export.cost}
            onclick={() => build('export')}>+ Outlet · {CATALOG.export.cost} CR</button
          >
        </section>
        <FactoryCanvas
          {game}
          selected={session.selected}
          connecting={session.connecting}
          running={session.running}
          onselect={(id) => (session.selected = id)}
          onport={port}
          onlayout={(layout) => session.layout(layout)}
          oneditstart={() => session.remember()}
          ondisconnect={(id) => session.edit((g) => disconnect(g, id), 'Route disconnected')}
          oncancel={() => (session.connecting = null)}
        />
      {/if}
      <section class="build-tray" aria-label="Build palette">
        <div class="build-label">
          <span class="eyebrow">THINGS · {session.view === 'world' ? 'WORLD' : 'INTERIOR'}</span>
          <div class="build-filters">
            {#each session.view === 'world' ? ['All', 'External'] : ['All', 'Production', 'Logistics'] as category}<button
                class:active={buildCategory === category}
                aria-pressed={buildCategory === category}
                onclick={() => (buildCategory = category)}>{category}</button
              >{/each}
          </div>
        </div>
        <div class="build-items">
          {#if session.view === 'world' && buildCategory === 'All'}
            {#each session.collection.categories.filter((c) => c.template === 'factory') as category}
              <button
                class="build-item"
                aria-label="Build {category.name}"
                title="500 CR to build + 1,000 CR transferred starting budget. Creates an empty enclosure immediately."
                disabled={game.state.credits < 1500 || session.worldThing.factories.length >= 16}
                onclick={() => session.createFactory(category.id)}
              >
                <span>Ω</span><strong>{category.name}</strong><small>1,500 CR · incl. budget</small>
              </button>
            {/each}
          {/if}
          {#each availableThings(session.view).filter(([, item]) => buildCategory === 'All' || item.category === buildCategory) as [kind, item]}{@const locked =
              buildingUnlockReason(session.game, kind as Kind)}<button
              class="build-item"
              aria-label="Build {item.name}"
              title={locked ?? `${item.description} · Placement: ${item.plane}`}
              disabled={!!locked || game.state.credits < item.cost}
              onclick={() => build(kind as Kind)}
              ><span style:color={item.color}
                ><NodeIcon kind={kind as Kind} size={24} />{#if locked}<LockKeyhole
                    class="lock-badge"
                    size={12}
                  />{/if}</span
              ><strong>{item.name}</strong><small
                >{locked ? 'Quest to unlock' : item.cost ? `${item.cost} CR` : 'FREE'}</small
              ></button
            >{/each}
        </div>
      </section>
    </main>
    <FactorySidebar {session} />
  </div>
  <footer class="controlbar">
    <div class="simulation-controls">
      <div class="automatic-status" data-testid="operation-status">
        <i class="metric-dot"></i>{session.game.state.factory.downtime > 0
          ? `Out of service · ${Math.ceil(session.game.state.factory.downtime / 4)}s`
          : 'Factory running'}
      </div>
      <div class="speed-controls">
        {#each [1, 2, 4] as speed}<button
            class:active={session.speed === speed}
            aria-label="{speed}× speed"
            aria-pressed={session.speed === speed}
            onclick={() => (session.speed = speed)}>{speed}×</button
          >{/each}
      </div>
    </div>
    <div class="live-metrics">
      <span
        ><i class="metric-dot"></i><strong>{activeNodes}</strong> active
        <small>/ <span data-testid="node-count">{game.definition.nodes.length}</span> nodes</small
        ></span
      ><span
        ><Activity size={14} /><strong data-testid="delivered-count"
          >{total(game.state.delivered)}</strong
        > delivered</span
      ><span class:has-warning={warnings > 0}
        ><span class="metric-dot warning"></span>{warnings}
        {warnings === 1 ? 'bottleneck' : 'bottlenecks'}</span
      >
    </div>
    <div class="save-state">
      <span><i></i>{session.lastSaved}</span><small
        >STEP <b data-testid="tick-count">{String(game.state.tick).padStart(4, '0')}</b></small
      >
    </div>
  </footer>
</div>
<input
  class="file-input"
  bind:this={importInput}
  type="file"
  accept=".json,application/json"
  aria-label="Import factory save"
  onchange={async (e) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (file) await session.import(file);
    input.value = '';
  }}
/>
{#if session.toast}<div class="toast" role="status">
    <span>Ω</span>{session.toast}<button
      aria-label="Dismiss notification"
      onclick={() => (session.toast = '')}><X size={15} /></button
    >
  </div>{/if}
{#if session.panel === 'quests'}<QuestBoard
    {session}
  />{:else if session.panel !== 'factory'}<DiscoveryPanel {session} />{/if}
{#if showReset}<div class="panel-backdrop">
    <div
      class="confirm-dialog"
      use:modal
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-label="Start a new factory"
    >
      <span class="eyebrow">A NEW BEGINNING</span>
      <h2>Start again?</h2>
      <p>Your current factory will be replaced. Export a copy first if you’d like to keep it.</p>
      <button class="secondary" onclick={() => session.export()}
        ><Download size={16} />Export current factory</button
      >
      <div>
        <button class="text-button" onclick={() => (showReset = false)}>Keep building</button
        ><button
          class="primary"
          onclick={() => {
            session.reset();
            showReset = false;
          }}>Start fresh</button
        >
      </div>
    </div>
  </div>{/if}
{#if session.welcome}<div class="welcome-backdrop">
    <div
      class="welcome"
      use:modal
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Omega Factory"
    >
      <div class="welcome-art">
        <div class="orbital orbital-one"></div>
        <div class="orbital orbital-two"></div>
        <div class="welcome-symbol">Ω</div>
        <span class="orbit-node n1"><Box size={26} /></span><span class="orbit-node n2"
          ><GitBranch size={26} /></span
        ><span class="orbit-node n3"><Sparkles size={26} /></span>
        <div class="welcome-art-caption">ITIOVERSE <span>FROM BITS TO STARS</span></div>
      </div>
      <div class="welcome-content">
        <span class="eyebrow">WELCOME TO OMEGA FACTORY</span>
        <h1>A little curiosity.<br />A world of possibility.</h1>
        <p>
          Build a system. Follow its flow. Discover how small connections can create something
          greater.
        </p>
        <div class="welcome-steps">
          <span><GitBranch size={18} />Connect your first factory</span><span
            ><Activity size={18} />Simulate, observe, improve</span
          ><span><Sparkles size={18} />Rediscover ideas in the Logic Lab</span>
        </div>
        <button
          class="primary"
          onclick={() => {
            session.welcome = false;
            session.save(true);
          }}>Enter the factory <ArrowRight size={18} /></button
        ><small>FIRST LIGHT · PLAYABLE DEMO · SAVED ON YOUR DEVICE</small>
      </div>
    </div>
  </div>{/if}
