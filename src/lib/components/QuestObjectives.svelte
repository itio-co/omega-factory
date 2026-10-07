<script lang="ts">
  import { Check } from '@lucide/svelte';
  import type { Game } from '../game/types';
  import { questObjectives } from '../game/quests';
  let { game, id }: { game: Game; id: string } = $props();
</script>

<div class="quest-objectives">
  {#each questObjectives(game, id) as goal}
    <div class="quest-objective" class:complete={goal.complete}>
      <div>
        <span
          >{#if goal.complete}<Check size={13} />{/if}{goal.label}</span
        ><strong>{goal.current} / {goal.target}</strong>
      </div>
      <div class="progress-track"><i style:width="{(goal.current / goal.target) * 100}%"></i></div>
    </div>
  {/each}
</div>
