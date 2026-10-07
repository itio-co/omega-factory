<script lang="ts">
  import { T } from '@threlte/core';
  import type { Kind } from '../game/types';
  let { kind, color }: { kind: Kind; color: string } = $props();
</script>

<T.Group rotation={[0.35, -0.35, 0]}>
  <T.Mesh position={[0, -17, -8]}
    ><T.BoxGeometry args={[78, 5, 42]} /><T.MeshStandardMaterial
      color="#d7d4c6"
      roughness={0.85}
    /></T.Mesh
  >
  {#if kind === 'supplier'}
    {#each [[-20, 0, 0, 15], [6, 4, -4, 22], [25, -3, 8, 12]] as [x, y, z, r]}<T.Mesh
        position={[x, y, z]}
        rotation={[0.3, 0.5, 0.2]}
        ><T.IcosahedronGeometry args={[r, 0]} /><T.MeshStandardMaterial
          {color}
          roughness={0.9}
        /></T.Mesh
      >{/each}
  {:else if kind === 'warehouse'}
    <T.Mesh position={[0, 5, 0]}
      ><T.BoxGeometry args={[64, 40, 36]} /><T.MeshStandardMaterial {color} /></T.Mesh
    >
    <T.Mesh position={[0, 29, 0]}
      ><T.BoxGeometry args={[72, 9, 42]} /><T.MeshStandardMaterial color="#6f775d" /></T.Mesh
    >
    {#each [-20, 0, 20] as x}<T.Mesh position={[x, 0, 19]}
        ><T.BoxGeometry args={[13, 28, 2]} /><T.MeshStandardMaterial color="#dbd5b7" /></T.Mesh
      >{/each}
  {:else if kind === 'press'}
    {#each [-25, 25] as x}<T.Mesh position={[x, 11, 0]}
        ><T.BoxGeometry args={[9, 54, 24]} /><T.MeshStandardMaterial {color} /></T.Mesh
      >{/each}
    <T.Mesh position={[0, 36, 0]}
      ><T.BoxGeometry args={[60, 10, 25]} /><T.MeshStandardMaterial {color} /></T.Mesh
    >
    <T.Mesh position={[0, 19, 0]}
      ><T.CylinderGeometry args={[6, 6, 26, 12]} /><T.MeshStandardMaterial
        color="#747c78"
        metalness={0.5}
      /></T.Mesh
    >
    <T.Mesh position={[0, 5, 0]}
      ><T.BoxGeometry args={[35, 7, 28]} /><T.MeshStandardMaterial color="#b5c5c9" /></T.Mesh
    >
    {#each [0, 1, 2] as i}<T.Mesh position={[0, -11 + i * 3, 8]}
        ><T.BoxGeometry args={[31, 2, 22]} /><T.MeshStandardMaterial color="#89a9b5" /></T.Mesh
      >{/each}
  {:else if kind === 'wiremill'}
    {#each [-19, 19] as x}<T.Mesh position={[x, 6, 0]} rotation={[Math.PI / 2, 0, 0]}
        ><T.CylinderGeometry args={[20, 20, 24, 16]} /><T.MeshStandardMaterial {color} /></T.Mesh
      ><T.Mesh position={[x, 6, 13]}
        ><T.TorusGeometry args={[14, 3, 8, 18]} /><T.MeshStandardMaterial
          color="#ddba80"
          metalness={0.4}
        /></T.Mesh
      >{/each}
  {:else if kind === 'fabricator'}
    {#each [-24, 24] as x}<T.Mesh position={[x, 9, 0]}
        ><T.BoxGeometry args={[7, 48, 8]} /><T.MeshStandardMaterial {color} /></T.Mesh
      >{/each}
    {#each [-12, 32] as y}<T.Mesh position={[0, y, 0]}
        ><T.BoxGeometry args={[54, 7, 8]} /><T.MeshStandardMaterial {color} /></T.Mesh
      >{/each}
    <T.Mesh position={[0, 8, 0]} rotation={[0, 0, 0.74]}
      ><T.BoxGeometry args={[7, 58, 8]} /><T.MeshStandardMaterial color="#b7c9b0" /></T.Mesh
    >
  {:else if kind === 'storage'}
    {#each [[-17, -1, 10], [15, -1, 10], [-17, 0, -18], [15, 0, -18], [-17, 26, -18]] as [x, y, z]}<T.Mesh
        position={[x, y, z]}
        ><T.BoxGeometry args={[25, 24, 23]} /><T.MeshStandardMaterial
          {color}
          roughness={0.7}
        /></T.Mesh
      ><T.Mesh position={[x, y, z + 12]}
        ><T.BoxGeometry args={[4, 24, 1]} /><T.MeshStandardMaterial color="#e8dfc4" /></T.Mesh
      >{/each}
  {:else if kind === 'smelter'}
    <T.Mesh position={[0, 4, 0]}
      ><T.BoxGeometry args={[48, 39, 33]} /><T.MeshStandardMaterial
        {color}
        roughness={0.65}
      /></T.Mesh
    >
    <T.Mesh position={[-13, 35, -6]}
      ><T.BoxGeometry args={[12, 28, 13]} /><T.MeshStandardMaterial color="#6b6f65" /></T.Mesh
    >
    <T.Mesh position={[0, 2, 17]}
      ><T.BoxGeometry args={[29, 19, 2]} /><T.MeshStandardMaterial color="#493e35" /></T.Mesh
    >
    <T.Mesh position={[0, 1, 19]}
      ><T.BoxGeometry args={[20, 9, 2]} /><T.MeshStandardMaterial
        color="#f1bb55"
        emissive="#cc7622"
        emissiveIntensity={0.45}
      /></T.Mesh
    >
  {:else if kind === 'assembler'}
    <T.Mesh position={[0, 5, 0]}
      ><T.TorusGeometry args={[19, 7, 8, 16]} /><T.MeshStandardMaterial
        {color}
        metalness={0.3}
        roughness={0.5}
      /></T.Mesh
    >
    {#each Array(8) as _, i}<T.Mesh
        position={[Math.sin((i * Math.PI) / 4) * 26, 5 + Math.cos((i * Math.PI) / 4) * 26, 0]}
        rotation={[0, 0, (-i * Math.PI) / 4]}
        ><T.BoxGeometry args={[10, 12, 11]} /><T.MeshStandardMaterial {color} /></T.Mesh
      >{/each}
  {:else if kind === 'customer'}
    <T.Mesh position={[0, 5, 0]}
      ><T.BoxGeometry args={[51, 38, 27]} /><T.MeshStandardMaterial color="#d9d4bf" /></T.Mesh
    >
    <T.Mesh position={[0, 27, 2]} rotation={[0, 0, 0]}
      ><T.BoxGeometry args={[61, 9, 39]} /><T.MeshStandardMaterial {color} /></T.Mesh
    >
    <T.Mesh position={[0, -1, 15]}
      ><T.BoxGeometry args={[16, 23, 2]} /><T.MeshStandardMaterial {color} /></T.Mesh
    >
    {#each [-18, 18] as x}<T.Mesh position={[x, 8, 15]}
        ><T.BoxGeometry args={[9, 11, 2]} /><T.MeshStandardMaterial color="#86aaa6" /></T.Mesh
      >{/each}
  {:else}
    {#each [-24, 24] as x}<T.Mesh position={[x, 9, 0]}
        ><T.BoxGeometry args={[11, 47, 18]} /><T.MeshStandardMaterial {color} /></T.Mesh
      >{/each}
    <T.Mesh position={[0, 33, 0]}
      ><T.BoxGeometry args={[59, 10, 18]} /><T.MeshStandardMaterial {color} /></T.Mesh
    >
    <T.Mesh position={[0, -5, 4]}
      ><T.BoxGeometry args={[18, 18, 18]} /><T.MeshStandardMaterial color="#dcb568" /></T.Mesh
    >
    <T.Mesh position={[0, 31, 11]}
      ><T.BoxGeometry args={[24, 3, 1]} /><T.MeshStandardMaterial
        color="#eff4da"
        emissive="#c6d8a7"
        emissiveIntensity={0.3}
      /></T.Mesh
    >
  {/if}
</T.Group>
