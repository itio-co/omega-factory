<script lang="ts">
  import { X, Flag, Check, LockKeyhole, Coins } from '@lucide/svelte';
  import type { Session } from '../session.svelte';
  import {
    QUESTS,
    claimQuest,
    questStatus,
    questClaimed,
    trackQuest,
    trackedQuest,
    getQuest,
  } from '../game/quests';
  import { modal } from '../modal';
  import QuestObjectives from './QuestObjectives.svelte';
  let { session }: { session: Session } = $props();
  let selected = $state<string | null>(null);
  let filter = $state('All');
  const quest = $derived(getQuest(selected ?? trackedQuest(session.game)?.id ?? 'foundation'));
  const status = $derived(questStatus(session.game, quest.id));
  const visible = $derived(
    QUESTS.filter(
      (q) =>
        filter === 'All' ||
        (filter === 'Completed'
          ? questStatus(session.game, q.id) === 'completed'
          : filter === 'Ready'
            ? questStatus(session.game, q.id) === 'ready'
            : ['active', 'ready'].includes(questStatus(session.game, q.id))),
    ),
  );
  const completed = $derived(QUESTS.filter((q) => questClaimed(session.game, q.id)).length);
</script>

<div class="panel-backdrop">
  <div
    class="workbench quest-board"
    use:modal
    role="dialog"
    aria-modal="true"
    aria-label="Quest board"
    tabindex="-1"
  >
    <header class="workbench-header">
      <span class="eyebrow">FACTORY JOURNEY · {completed} / {QUESTS.length} COMPLETE</span><button
        class="icon-button"
        aria-label="Close quest board"
        onclick={() => (session.panel = 'factory')}><X size={20} /></button
      >
    </header>
    <div class="workbench-title">
      <Flag size={28} />
      <div>
        <h2>Your next possibility</h2>
        <p>Main quests build the factory. Side quests reward exploration.</p>
      </div>
    </div>
    <div class="quest-filters">
      {#each ['All', 'Active', 'Ready', 'Completed'] as item}<button
          class:active={filter === item}
          aria-pressed={filter === item}
          onclick={() => (filter = item)}>{item}</button
        >{/each}
    </div>
    <div class="quest-board-columns">
      <nav class="quest-list" aria-label="Quests">
        {#each visible as entry}{@const state = questStatus(session.game, entry.id)}<button
            class:selected={quest.id === entry.id}
            onclick={() => (selected = entry.id)}
            aria-label="View quest {entry.title}"
            ><span class="eyebrow"
              >{entry.category} · {state === 'ready' ? 'Ready to claim' : state}</span
            ><strong>{entry.title}</strong>{#if state === 'completed'}<Check
                size={14}
              />{:else if state === 'locked'}<LockKeyhole size={14} />{/if}</button
          >{:else}<p class="muted">No quests in this view yet.</p>{/each}
      </nav>
      <article class="quest-detail">
        <span class="eyebrow"
          >{quest.chapter} · {status === 'ready' ? 'Ready to claim' : status}</span
        >
        <h3>{quest.title}</h3>
        <p>{quest.description}</p>
        {#if quest.prerequisites.length}<div class="quest-prerequisites">
            <strong>Requires</strong>{#each quest.prerequisites as id}<span
                class:complete={questClaimed(session.game, id)}
                >{questClaimed(session.game, id) ? '✓' : '○'} {getQuest(id).title}</span
              >{/each}
          </div>{/if}
        <QuestObjectives game={session.game} id={quest.id} />
        <p class="quest-counting">
          New production quests count lifetime deliveries, including before unlock. The first three
          commissions count deliveries toward the current commission. Building objectives require
          ownership until the reward is claimed.
        </p>
        <div class="reward"><Coins size={16} />{quest.reward} credits</div>
        <p class="unlock">{quest.unlock}</p>
        {#if status === 'ready'}<button
            class="primary full"
            onclick={() =>
              session.act((g) => claimQuest(g, quest.id), 'Quest completed. Reward claimed.')}
            >Claim quest reward</button
          >{/if}
        {#if status === 'active' || status === 'ready'}<button
            class="secondary full"
            onclick={() =>
              session.act((g) => trackQuest(g, quest.id), 'Quest pinned to your factory')}
            disabled={trackedQuest(session.game)?.id === quest.id}
            >{trackedQuest(session.game)?.id === quest.id
              ? 'Tracking this quest'
              : 'Track this quest'}</button
          >{/if}
        {#if status === 'completed'}<p class="journey-complete">
            <Check size={18} />Reward claimed
          </p>{/if}
      </article>
    </div>
  </div>
</div>
