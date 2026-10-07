# Omega Factory — First Light

## Intent and sources

Implement the playable Svelte factory demo requested in the linked conversation
“Design Omega Factory Gameplay” (6ac5ebff-ee64-83ec-8e32-c22987e730f2).
The user clarified that Omega Factory belongs to **Itioverse**. Its project link
requires login and its project context is not exposed by the connected app;
no additional canon or shared services were initially assumed. The later supplied
conversation “What is ITIO” (69b44c54-93f4-83a0-b4cd-78b62ebeff6d) establishes
ITIOVerse as a human-centered ecosystem, Omega Factory as a simulation environment,
Yai as system description, and Kido as intelligence augmentation. Its guidance is
reflected in the field guide. Itionians are not defined in the available messages.

The supplied “Factory Automation Game Features” discussion
(682ca7cf-a97c-800b-b43c-2a3f673488c2) adds composable rules, equivalent-behavior
rediscovery, an Insight Journal, and five Dreyfus learning tiers. The playable
slice implements a safe boolean rule lab for AND/OR/XOR, checks every input pair,
records solutions with simulation timestamps, and provides an alternative
assembly unlock through AND rediscovery. Phase 2 makes all five game tiers
reachable: the original trio unlocks implication, then three-input majority,
then a NAND-only selector. Every challenge verifies all input combinations;
the selector also enforces its operator constraint. Each verified discovery
grants 100 credits once, is saved in the journal, and unlocks its successor.
Existing saves remain compatible, while invalid prerequisite chains are rejected.
The full Yai compiler,
Rust/WASM/Free Monad backend, GraphQL services, and multiplayer remain beyond
this local demo and are explicitly documented.

The available discussion specifies Svelte, Three.js through Threlte, a logical
node graph, a supplier → import → storage → process → export → customer loop,
explainable blockages, save/load, and eventual desktop/Steam distribution.
This implementation request authorizes implementing that design in this repo.

## Playable scope

A polished single-player scenario, First Light, starts with a partly connected
factory. Players complete the line, run explicit simulation ticks, earn credits,
fulfill three contracts, unlock gear assembly, and expand their factory.
Contracts and numeric balancing are implementation assumptions, not Itioverse lore.

Players add, move, configure, enable/disable, upgrade, connect, disconnect, and
remove nodes; pan and zoom the map; inspect inventories and actionable status;
pause, step, and accelerate the simulation; save locally and export/import JSON.
There is onboarding, an objective panel, live metrics, and a completion state
that permits continued sandbox play. Mouse, keyboard, and tablet pointer input
share the same editor interactions. Undo/redo covers structural edits while
paused; running clears edit history to avoid rewinding earned resources.

## Architecture

- Pure TypeScript core owns definitions, runtime inventories/jobs, economy,
  contracts, and ordered fixed steps. Render frames never advance production.
- Svelte 5 owns interface, editor layout, selection, and input. Layout is a
  separate save section; moving cards cannot change production behavior.
- Threlte/Three.js renders procedural machine models, route geometry, and resource
  pulses through an orthographic camera, honoring the user's explicit Three.js
  requirement. SVG connections and HTML cards remain usable without WebGL.
- Electron wraps the static build without exposing Node.js to the renderer.
  Offline desktop builds require no backend or external assets.

## Rules and invariants

Resources: iron ore, iron ingots, precision gears. Smelting consumes two ore
for one ingot; assembling consumes two ingots for one gear. Finite inventories
apply backpressure. Each link transfers at most one unit per step and resources
cross at most one link per step. Recipes reserve input and output capacity.
Suppliers spend credits only when producing. Deliveries pay per unit, and
contract rewards are claimed exactly once. Disabled nodes cannot send/receive.
Connections must have matching resources, valid endpoints, and no duplicates
or self-links. Storage cycles are valid and must conserve resources.

Versioned save validation checks every definition, state, endpoint, inventory,
number, and layout value before replacement. Invalid saves leave the factory
untouched. Save operations report failures, including browser quota failures.

## Presentation

Warm paper, graphite, saffron accents, blueprint grid, restrained motion, and
legible compact cards. Itioverse is the parent identity; Omega Factory the game.
Show useful game concepts, not rendering or implementation details.

## Validation and release boundary

Unit tests exercise deterministic progression, conservation/backpressure,
connection rules, contract rewards, upgrades, and malformed saves. Browser tests
exercise onboarding, editing, connection, production, save/load, and touch input.
Type checking and production/desktop packaging must pass. Steam upload,
Steamworks features, store assets, signing, native mobile distribution, multiplayer,
and broader Itioverse integration need product/account requirements and are
outside this local playable delivery.
