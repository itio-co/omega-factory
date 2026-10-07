<script lang="ts">
  import { Minus, Plus, Maximize, MousePointer2, Hand } from '@lucide/svelte';
  let {
    zoom,
    panMode,
    onPanChange,
    onZoom,
    onFit,
    fitLabel,
  }: {
    zoom: number;
    panMode: boolean;
    onPanChange: (pan: boolean) => void;
    onZoom: (factor: number) => void;
    onFit: () => void;
    fitLabel: string;
  } = $props();
</script>

<div class="canvas-tools" aria-label="Plane controls">
  <button
    class:active={!panMode}
    aria-label="Select tool"
    title="Select and move Things"
    onclick={() => onPanChange(false)}><MousePointer2 size={17} /></button
  >
  <button
    class:active={panMode}
    aria-label="Pan tool"
    title="Pan the plane"
    onclick={() => onPanChange(true)}><Hand size={17} /></button
  >
  <i></i><button aria-label="Zoom out" onclick={() => onZoom(0.85)}><Minus size={17} /></button>
  <span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" onclick={() => onZoom(1.15)}
    ><Plus size={17} /></button
  >
  <i></i><button aria-label={fitLabel} title="Fit this plane to view" onclick={onFit}
    ><Maximize size={16} /></button
  >
</div>
