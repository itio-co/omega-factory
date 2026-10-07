<script lang="ts">
  import {
    Mountain,
    ArrowDownToLine,
    Package,
    Flame,
    Cog,
    ArrowUpFromLine,
    ShoppingBag,
    Layers,
    Cable,
    Frame,
    Warehouse,
  } from '@lucide/svelte';
  import type { Kind } from '../game/types';
  let { kind, size = 22 }: { kind: Kind; size?: number } = $props();
  const icons = {
    supplier: Mountain,
    import: ArrowDownToLine,
    storage: Package,
    smelter: Flame,
    assembler: Cog,
    export: ArrowUpFromLine,
    customer: ShoppingBag,
    press: Layers,
    wiremill: Cable,
    fabricator: Frame,
    warehouse: Warehouse,
  };
  const Icon = $derived(icons[kind]);
</script>

<Icon {size} strokeWidth={1.7} />
