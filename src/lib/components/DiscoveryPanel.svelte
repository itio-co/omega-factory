<script lang="ts">
  import {
    ArrowRight,
    BookOpen,
    Check,
    FlaskConical,
    Lightbulb,
    LockKeyhole,
    Play,
    Sparkles,
    X,
  } from '@lucide/svelte';
  import {
    checkRule,
    discoverRule,
    DISCOVERIES,
    discoveryUnlocked,
    learningProgress,
    LEARNING_TIERS,
  } from '../game/logic';
  import type { Discovery } from '../game/logic';
  import type { Session } from '../session.svelte';
  import { modal } from '../modal';
  let { session }: { session: Session } = $props();
  let target = $state<Discovery>('and');
  let expression = $state('NAND(A, B)');
  let result = $state<ReturnType<typeof checkRule> | null>(null);
  let error = $state('');
  let hint = $state(false);
  const mission = $derived(DISCOVERIES[target]);
  const progress = $derived(learningProgress(session.game));
  const recorded = $derived(session.game.state.journal.some((entry) => entry.id === target));
  function selectChallenge(id: Discovery) {
    target = id;
    expression = id === 'and' ? 'NAND(A, B)' : 'A';
    result = null;
    hint = false;
    error = '';
    session.panel = 'lab';
  }
  function runRule() {
    try {
      result = checkRule(expression, target);
      error = '';
    } catch (e) {
      result = null;
      error = e instanceof Error ? e.message : 'Invalid rule';
    }
  }
</script>

<div class="panel-backdrop">
  <div
    class="workbench"
    use:modal
    role="dialog"
    aria-modal="true"
    aria-label={session.panel === 'lab'
      ? 'Logic Lab'
      : session.panel === 'journal'
        ? 'Insight Journal'
        : 'Field guide'}
    tabindex="-1"
  >
    <header class="workbench-header">
      <span class="eyebrow">ITIOVERSE · FROM BITS TO STARS</span><button
        class="icon-button"
        aria-label="Close panel"
        onclick={() => (session.panel = 'factory')}><X size={20} /></button
      >
    </header>
    {#if session.panel === 'lab'}
      <div class="workbench-title">
        <FlaskConical size={30} strokeWidth={1.4} />
        <div>
          <h2>The Logic Lab</h2>
          <p>Don’t just unlock it. Understand it.</p>
        </div>
      </div>
      <div class="learning-summary">
        <span>Logic journey <strong data-testid="learning-tier">{progress.tier}</strong></span>
        <span>{progress.completed} / {progress.total} discoveries recorded</span>
      </div>
      <div class="lab-tabs">
        {#each Object.entries(DISCOVERIES) as [id, item]}<button
            class:active={target === id}
            disabled={!discoveryUnlocked(session.game, id as Discovery)}
            title={discoveryUnlocked(session.game, id as Discovery)
              ? item.title
              : `Complete ${item.prerequisites.map((key) => DISCOVERIES[key].name).join(', ')} to unlock`}
            onclick={() => selectChallenge(id as Discovery)}
            >{#if session.game.state.journal.some((j) => j.id === id)}<Check
                size={14}
              />{:else if !discoveryUnlocked(session.game, id as Discovery)}<LockKeyhole
                size={13}
              />{/if}{item.name}</button
          >{/each}
      </div>
      {#if progress.next}<p class="learning-next">
          Next discovery: {DISCOVERIES[progress.next].name} · {DISCOVERIES[progress.next].reward}
        </p>{/if}
      <div class="lab-columns">
        <div>
          <span class="eyebrow">REDISCOVERY CHALLENGE</span>
          <h3>{mission.title}</h3>
          <p>{mission.description} Build an equivalent rule from smaller operations.</p>
          <label class="field-label" for="rule-expression"
            >Your rule<textarea
              id="rule-expression"
              spellcheck="false"
              maxlength="256"
              bind:value={expression}
              oninput={() => {
                result = null;
                error = '';
              }}></textarea></label
          >
          <div class="rule-reference">
            {#each mission.inputs as input}<code>{input}</code>{/each}
            {#each mission.operators as op}<code>{op}({op === 'NOT' ? 'x' : 'x,y'})</code>{/each}
          </div>
          <button class="primary" onclick={runRule}><Play size={15} />Test all inputs</button
          ><button class="text-button" onclick={() => (hint = !hint)}
            ><Lightbulb size={15} />A small hint</button
          >
          {#if hint}<div class="lab-hint">
              <p>{mission.hint}</p>
              <button
                class="text-button"
                onclick={() => {
                  expression = mission.example;
                  result = null;
                  error = '';
                }}>Try an example <ArrowRight size={14} /></button
              >
            </div>{/if}
          {#if error}<p class="error-message">{error}</p>{/if}
        </div>
        <div class="truth-panel">
          <span class="eyebrow">OBSERVE THE BEHAVIOR</span>
          <h3>Every input matters.</h3>
          <table>
            <thead
              ><tr
                ><th>A</th><th>B</th>{#if mission.inputs.length === 3}<th>C</th>{/if}<th
                  >Expected</th
                ><th>Your rule</th></tr
              ></thead
            ><tbody>
              {#each result?.rows ?? checkRule('A', target).rows as row}<tr
                  ><td>{+row.a}</td><td>{+row.b}</td>{#if mission.inputs.length === 3}<td
                      >{+row.c}</td
                    >{/if}<td>{+row.expected}</td><td
                    class:match={result && row.actual === row.expected}
                    class:mismatch={result && row.actual !== row.expected}
                    >{result ? +row.actual : '—'}</td
                  ></tr
                >{/each}
            </tbody>
          </table>
          <small
            >A matching result for all {mission.inputs.length === 3 ? 'eight' : 'four'} cases verifies
            the same behavior for these binary inputs.</small
          >
          {#if result?.success}<div class="discovery-success">
              <Sparkles size={22} />
              <h3>You found another way.</h3>
              {#if recorded}
                <p class="recorded-message"><Check size={15} />Insight already recorded</p>
                {#if progress.next}<button
                    class="primary full"
                    onclick={() => selectChallenge(progress.next!)}
                    >Next challenge: {DISCOVERIES[progress.next].name}
                    <ArrowRight size={16} /></button
                  >
                {:else}<button class="primary full" onclick={() => (session.panel = 'journal')}
                    >View completed journey <BookOpen size={16} /></button
                  >{/if}
              {:else}
                <p>{mission.reward}. Record your solution and earn 100 credits.</p>
                <button
                  class="primary full"
                  onclick={() =>
                    session.act(
                      (g) => discoverRule(g, target, expression),
                      'Insight recorded in your journal',
                    )}>Record insight <BookOpen size={16} /></button
                >
              {/if}
            </div>{:else if result}<p class="lab-hint">
              {result.constraints.length
                ? result.constraints.join(' ')
                : 'Some cases don’t match yet. Observe, change one thing, and try again.'}
            </p>{/if}
        </div>
      </div>
    {:else if session.panel === 'journal'}
      <div class="workbench-title">
        <BookOpen size={30} strokeWidth={1.4} />
        <div>
          <h2>Your Insight Journal</h2>
          <p>What you build matters. What you learn stays with you.</p>
        </div>
      </div>
      <div class="learning-summary">
        <span>Current game tier <strong data-testid="learning-tier">{progress.tier}</strong></span>
        <span>{progress.completed} / {progress.total} discoveries recorded</span>
      </div>
      <div class="mastery">
        <span class="eyebrow">LOGIC · YOUR LEARNING PATH</span>
        <div>
          {#each LEARNING_TIERS as tier, i}<span
              class:achieved={i <= progress.tierIndex}
              aria-label="{tier}: {i <= progress.tierIndex ? 'reached' : 'locked'}"
              >{i + 1}<small>{tier}</small></span
            >{/each}
        </div>
        <p>
          These are milestones in your Logic Lab journey, not an assessment of real-world expertise.
        </p>
      </div>
      <div class="learning-requirements">
        {#each [['Advanced beginner', 'Record AND, OR, and XOR'], ['Competent', 'Build an implication rule'], ['Proficient', 'Verify a three-input majority rule'], ['Expert', 'Build a selector using only NAND']] as [tier, requirement], i}
          <div class:complete={i < progress.tierIndex}>
            {#if i < progress.tierIndex}<Check size={16} />{:else}<LockKeyhole size={16} />{/if}
            <strong>{tier}</strong><span>{requirement}</span>
          </div>
        {/each}
      </div>
      {#if progress.next}<button
          class="primary learning-continue"
          onclick={() => selectChallenge(progress.next!)}
          >Continue with {DISCOVERIES[progress.next].name} <ArrowRight size={16} /></button
        >
      {:else}<p class="journey-complete">
          <Sparkles size={18} />All six discoveries verified. Your Logic Lab journey is complete.
        </p>{/if}
      <div class="journal-entries">
        {#each session.game.state.journal as entry}<article>
            <div class="journal-entry-icon"><Sparkles size={19} /></div>
            <div>
              <span class="eyebrow">LOGIC · STEP {entry.tick}</span>
              <h3>{entry.title}</h3>
              <code>{entry.expression}</code>
              <p>
                Verified across all {DISCOVERIES[entry.id].inputs.length === 3 ? 'eight' : 'four'} input
                combinations{entry.id === 'selector' ? ' using only NAND gates' : ''}.
              </p>
            </div>
            <Check size={18} />
          </article>{:else}<div class="empty-journal">
            <Lightbulb size={34} strokeWidth={1.3} />
            <h3>A blank page is a beginning.</h3>
            <p>
              Test an idea in the Logic Lab. Your discoveries and the rules you create will live
              here.
            </p>
            <button class="primary" onclick={() => (session.panel = 'lab')}
              >Explore the Logic Lab <ArrowRight size={16} /></button
            >
          </div>{/each}
      </div>
    {:else}
      <div class="workbench-title">
        <Lightbulb size={30} strokeWidth={1.4} />
        <div>
          <h2>A factory for ideas.</h2>
          <p>Design it. Simulate it. Understand it. Improve it.</p>
        </div>
      </div>
      <div class="help-grid">
        <article>
          <span>01</span>
          <h3>Build a system</h3>
          <p>
            Add nodes from the build tray. Drag their cards to arrange them. Select an output port,
            then a matching input. Route labels show items per simulation second, averaged over five
            simulated seconds. Select a label for details or to disconnect the route.
          </p>
        </article>
        <article>
          <span>02</span>
          <h3>Watch and understand</h3>
          <p>
            The factory runs automatically. Open its interior to inspect inventories, change
            resources, and understand what is blocking progress.
          </p>
        </article>
        <article>
          <span>03</span>
          <h3>Discover your own way</h3>
          <p>
            Fulfill contracts to unlock assembly, or rediscover AND in the Logic Lab. Test composed
            rules and keep the evidence in your Insight Journal.
          </p>
        </article>
        <article>
          <span>04</span>
          <h3>Keep what you learn</h3>
          <p>
            Your factory saves automatically on this device. Export a portable save to keep a copy
            or share your system. Only applied changes are saved; draft edits stay separate.
          </p>
        </article>
      </div>
      <div class="keyboard-guide">
        <span>Factory runs automatically</span><span><kbd>Ctrl / ⌘ Z</kbd> Undo edit</span><span
          ><kbd>Esc</kbd> Close / cancel</span
        ><span><kbd>Scroll</kbd> Zoom</span>
      </div>
      <div class="itio-note">
        <strong>Part of ITIOVerse</strong>
        <p>
          Omega Factory is a space for experimenting with systems. Yai describes systems; Kido
          supports human intelligence; Omega Factory makes ideas observable. This demo runs locally
          and explores production and logic.
        </p>
      </div>
    {/if}
  </div>
</div>
