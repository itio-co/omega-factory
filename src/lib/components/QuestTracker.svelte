<script lang="ts">
  import { Check, Flag, Coins } from '@lucide/svelte';
  import type { Session } from '../session.svelte';
  import { claimQuest, questStatus, trackedQuest, QUESTS } from '../game/quests';
  import QuestObjectives from './QuestObjectives.svelte';
  let { session }: { session: Session } = $props();
  const quest = $derived(trackedQuest(session.game));
  const completed = $derived(
    QUESTS.filter((q) => questStatus(session.game, q.id) === 'completed').length,
  );
</script>

<div class="sidebar-top"><span class="eyebrow">QUEST TRACKER</span><Flag size={16} /></div>
<div class="contract-card">
  {#if quest}
    <span class="eyebrow">{quest.category.toUpperCase()} QUEST · {quest.chapter}</span>
    <h2>{quest.title}</h2>
    <p>{quest.description}</p>
    <QuestObjectives game={session.game} id={quest.id} />
    <div class="reward"><Coins size={15} />{quest.reward} credits <span>REWARD</span></div>
    <div class="unlock">{quest.unlock}</div>
    {#if questStatus(session.game, quest.id) === 'ready'}<button
        class="primary full"
        onclick={() =>
          session.act((g) => claimQuest(g, quest.id), 'Quest completed. Reward claimed.')}
        ><Check size={16} />Claim reward</button
      >{/if}
  {:else}<h2>A factory of possibilities.</h2>
    <p>All quests completed. Keep building and experimenting.</p>{/if}
  <button class="secondary full" onclick={() => (session.panel = 'quests')}
    ><Flag size={15} />Open quest board · {completed}/{QUESTS.length}</button
  >
</div>
