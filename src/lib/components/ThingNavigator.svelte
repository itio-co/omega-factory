<script lang="ts">
  import type { Session } from '../session.svelte';
  let { session }: { session: Session } = $props();
  let categoryName = $state(''),
    template = $state<'world' | 'factory'>('factory'),
    worldCategory = $state('world');
</script>

<div class="thing-navigator">
  <label
    >World Thing<select
      aria-label="World Thing"
      value={session.collection.activeWorld}
      onchange={(e) => {
        const world = session.collection.worlds.find((w) => w.id === e.currentTarget.value)!;
        session.focusThing(world.id, world.factories[0].id);
      }}
      >{#each session.collection.worlds as world}<option value={world.id}>{world.name}</option
        >{/each}</select
    ></label
  >
  <label
    >Factory Thing<select
      aria-label="Factory Thing"
      value={session.collection.activeFactory}
      onchange={(e) => session.focusThing(session.collection.activeWorld, e.currentTarget.value)}
      >{#each session.worldThing.factories as factory}<option value={factory.id}
          >{factory.name}</option
        >{/each}</select
    ></label
  >
  <details>
    <summary>Things & categories</summary>
    <div class="thing-category-menu">
      <strong>Create a World Thing</strong>
      <label
        >Category<select aria-label="New World category" bind:value={worldCategory}
          >{#each session.collection.categories.filter((c) => c.template === 'world') as category}<option
              value={category.id}>{category.name}</option
            >{/each}</select
        ></label
      >
      <button class="secondary" onclick={() => session.createWorld(worldCategory)}
        >Create World</button
      >
      <small>A separate sandbox with its own factories and progress.</small>
      <hr />
      <strong>Define a category</strong>
      <label
        >Name<input aria-label="Category name" maxlength="40" bind:value={categoryName} /></label
      >
      <label
        >Enclosure behavior<select aria-label="Category behavior" bind:value={template}
          ><option value="factory">Factory · Interior plane</option><option value="world"
            >World · World plane</option
          ></select
        ></label
      >
      <button
        class="secondary"
        disabled={!categoryName.trim()}
        onclick={() => {
          session.createCategory(categoryName, template);
          categoryName = '';
        }}>Create category</button
      >
    </div>
  </details>
</div>
