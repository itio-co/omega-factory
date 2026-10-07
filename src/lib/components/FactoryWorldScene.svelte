<script lang="ts">
  import { T } from '@threlte/core';
  let { level, offline }: { level: number; offline: boolean } = $props();
</script>

<T.PerspectiveCamera
  makeDefault
  position={[5, 4, 6]}
  fov={35}
  oncreate={(camera) => camera.lookAt(0, 0, 0)}
/>
<T.AmbientLight intensity={2} /><T.DirectionalLight position={[3, 6, 4]} intensity={3} />
<T.Group rotation={[0, -0.2, 0]}>
  <T.Mesh position={[0, -0.7, 0]}
    ><T.BoxGeometry args={[3.6, 0.12, 2.8]} /><T.MeshStandardMaterial color="#b9bfa9" /></T.Mesh
  >
  <T.Mesh position={[0, 0, 0]}
    ><T.BoxGeometry args={[2.7, 1.3, 1.9]} /><T.MeshStandardMaterial color="#d4ccae" /></T.Mesh
  >
  <T.Mesh position={[0, 0.72, 0]}
    ><T.BoxGeometry args={[2.95, 0.2, 2.15]} /><T.MeshStandardMaterial color="#78866b" /></T.Mesh
  >
  {#each [-0.85, 0, 0.85] as x}<T.Mesh position={[x, 0.15, 0.96]}
      ><T.BoxGeometry args={[0.48, 0.42, 0.03]} /><T.MeshStandardMaterial
        color={offline ? '#71786c' : '#a4c5bd'}
        emissive={offline ? '#000000' : '#71968b'}
        emissiveIntensity={0.25}
      /></T.Mesh
    >{/each}
  {#each Array(level) as _, i}<T.Mesh position={[-0.8 + i * 0.5, 1.03, -0.55]}
      ><T.BoxGeometry args={[0.24, 0.65, 0.3]} /><T.MeshStandardMaterial color="#8d826b" /></T.Mesh
    >{/each}
  <T.Mesh position={[-1.4, -0.12, 0.25]}
    ><T.BoxGeometry args={[0.16, 0.7, 0.62]} /><T.MeshStandardMaterial color="#829770" /></T.Mesh
  >
  <T.Mesh position={[1.4, -0.12, 0.25]}
    ><T.BoxGeometry args={[0.16, 0.7, 0.62]} /><T.MeshStandardMaterial color="#71979a" /></T.Mesh
  >
  <T.Mesh position={[0, -0.3, 0.98]}
    ><T.BoxGeometry args={[0.42, 0.65, 0.05]} /><T.MeshStandardMaterial color="#646d56" /></T.Mesh
  >
</T.Group>
