<script lang="ts">
  import { onMount } from 'svelte';
  import { X, Sparkles } from '@lucide/svelte';
  import { modal } from '../modal';
  import { sendWish, type WishResponse } from '../wishes';
  let { open, onclose }: { open: boolean; onclose: () => void } = $props();
  const storageKey = 'omega-factory-wish-draft';
  let text = $state(''),
    requestId = $state(''),
    attempted = $state(false);
  let busy = $state(false),
    error = $state(''),
    result = $state<WishResponse | null>(null);
  onMount(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (
        draft &&
        typeof draft.text === 'string' &&
        draft.text.length <= 4000 &&
        typeof draft.requestId === 'string' &&
        /^[a-f0-9-]{36}$/.test(draft.requestId)
      ) {
        text = draft.text;
        requestId = draft.requestId;
        attempted = draft.attempted === true;
      }
    } catch {
      /* Browser storage may be unavailable; the open form still keeps its text. */
    }
  });
  function saveDraft() {
    requestId ||= crypto.randomUUID();
    try {
      localStorage.setItem(storageKey, JSON.stringify({ text, requestId, attempted }));
    } catch {
      error = 'Browser storage is unavailable. Keep this form open until your Wish is confirmed.';
    }
  }
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !text.trim()) return;
    busy = true;
    error = '';
    attempted = true;
    saveDraft();
    try {
      result = await sendWish(requestId, text);
      if (result.status === 'submitted') {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* Confirmation remains visible. */
        }
      }
    } catch {
      error = 'We could not confirm your Wish. Keep your text and retry with the same request.';
    } finally {
      busy = false;
    }
  }
  function another() {
    text = '';
    requestId = '';
    attempted = false;
    result = null;
    error = '';
  }
</script>

{#if open}
  <div class="wish-backdrop">
    <div
      class="wish-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wish-title"
      tabindex="-1"
      use:modal
    >
      <header>
        <div>
          <span class="eyebrow">YOUR IDEAS, OUR NEXT POSSIBILITY</span>
          <h2 id="wish-title"><Sparkles size={22} />Make a Wish</h2>
        </div>
        <button class="icon-button" aria-label="Close Wish form" onclick={onclose}
          ><X size={20} /></button
        >
      </header>
      {#if result?.status === 'submitted'}
        <div role="status">
          <h3>Wish submitted</h3>
          <p>Your idea has a story in our development backlog.</p>
          <dl>
            <dt>Wish ID</dt>
            <dd>{result.id}</dd>
            <dt>Story ID</dt>
            <dd>{result.story?.id}</dd>
          </dl>
        </div>
        <button class="primary" onclick={another}>Write another Wish</button>
      {:else}
        <p>What would make your factory more fun, useful, or surprising?</p>
        <form onsubmit={submit}>
          <label for="wish-text">Your Wish</label>
          <textarea
            id="wish-text"
            bind:value={text}
            oninput={saveDraft}
            maxlength="4000"
            rows="6"
            required
            readonly={attempted}
            aria-describedby="wish-help"
            placeholder="I wish my factory could…"></textarea>
          <p class="wish-help" id="wish-help">
            {attempted
              ? 'Your original text stays with this request while we confirm it.'
              : 'Describe one improvement you would love to see.'} <span>{text.length}/4000</span>
          </p>
          {#if result?.status === 'pending'}<p role="status">
              Your Wish is saved. Story creation is pending; retry to check it.
            </p>{/if}
          {#if error}<p role="alert">{error}</p>{/if}
          <button class="primary" type="submit" disabled={busy || !text.trim()}
            >{busy ? 'Sending Wish…' : attempted ? 'Retry Wish' : 'Send Wish'}</button
          >
        </form>
      {/if}
    </div>
  </div>
{/if}

<style>
  .wish-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    place-items: center;
    padding: 20px;
    background: #030a12b8;
    backdrop-filter: blur(8px);
  }
  .wish-dialog {
    width: min(560px, 100%);
    max-height: 90dvh;
    overflow: auto;
    padding: 28px;
    border: 1px solid #314557;
    border-radius: 18px;
    background: #101a26;
    color: #edf5fc;
    box-shadow: 0 24px 90px #0009;
  }
  header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: start;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 10px 0 18px;
  }
  .eyebrow {
    color: #88cbd0;
    font-size: 10px;
    letter-spacing: 0.12em;
  }
  p {
    color: #b7c8d5;
    line-height: 1.5;
  }
  label {
    display: block;
    margin: 20px 0 8px;
    font-weight: 600;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    min-height: 120px;
    color: #edf5fc;
    background: #0a131e;
    border: 1px solid #426077;
    border-radius: 8px;
    padding: 12px;
    font: inherit;
    line-height: 1.5;
  }
  textarea:focus-visible {
    outline: 2px solid #71d8bf;
    outline-offset: 3px;
  }
  .wish-help {
    font-size: 12px;
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }
  .wish-help span {
    white-space: nowrap;
  }
  [role='alert'] {
    color: #ffc692;
  }
  [role='status'] {
    color: #8ce1cb;
  }
  button.primary {
    margin-top: 12px;
  }
  dd {
    margin: 6px 0 18px;
    overflow-wrap: anywhere;
    font-family: monospace;
  }
  dt {
    color: #b7c8d5;
    font-size: 12px;
  }
</style>
