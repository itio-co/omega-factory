# Buildings and quests

Extend the existing factory with useful branches and a persistent quest board.
This is implementation scope authorized by the request for more buildings and a
proper quest system; no additional lore or external services are assumed.

## Production

Add Plate press (2 ingots → 1 plate, 4 steps, 380 credits), Wire mill
(1 ingot → 1 wire, 3 steps, 360 credits), Frame fabricator (2 plates → 1 frame,
5 steps, 600 credits), and Warehouse (96 capacity, 320 credits). Existing level
upgrades apply. Plate/wire production unlocks after the founding contract;
fabrication unlocks after the plate quest. Warehouse is available immediately.
Use a shared recipe catalog for simulation, display, and validation. Every recipe
reserves output capacity, consumes inputs once, and honors downstream backpressure.
New resource sale prices are plate 42, wire 22, and frame 110 credits.

## Quests

Retain the original three contracts as main quests and their existing counters.
Add main quests for owning a press and delivering 12 plates; owning a wire mill
and delivering 16 wires; owning a fabricator and delivering 8 frames; and an
expansion finale requiring the original contracts and new branches, a warehouse,
20 lifetime frame deliveries, and 40 lifetime wire deliveries. New deliveries
count cumulatively, including work done before unlocking a quest, with that rule
visible to players. Side quests cover a warehouse, an upgraded smelter, and AND
rediscovery. Building requirements describe currently owned buildings until a
quest is claimed; completed quests remain complete after salvage.

States: locked, active, ready to claim, completed. Rewards are manual and once
only. A board shows objectives, progress, prerequisites, rewards and unlocks;
players can pin one available quest in the factory sidebar. Show completed quests
and allow filtering. Tracking, completion, unlocks, and progress survive saves.

## Compatibility and checks

Keep v1 saves readable by defaulting new resource quantities to zero and quest
state to empty. Infer original completed quests from contractIndex without
granting rewards again. Validate new recipes, unlocks, quest IDs and prerequisite
chains. Retain deterministic production, undo/redo and mouse/touch behavior.
Use distinct procedural Three.js models and a browsable build palette. Verify
new production chains, quest lifecycle, once-only rewards, migration, invalid
saves, board interactions, desktop and tablet presentation, and packaged desktop.

## Factory management (user steering)

Represent the factory as one Three.js object in World. Open its interior in a
separate in-game tab. Import/export gates are attached wall slots, movable only
between available slots. Production runs automatically while preparing a draft
and while visiting other tabs. Apply merges the draft with current live runtime
and wallet, then takes the entire factory out of service. Level 1/2/3 downtime is
30/20/10 simulation seconds, followed by automatic restart. Factory upgrades cost
1,000/2,000 credits and use the new level's downtime. Draft undo/redo must not
rewind live progress or quest rewards. Saves include only applied state.

These tab and timing defaults were stated after an optional clarification received
no answer. Closing the app does not accrue offline production. Existing gates
migrate to wall slots without losing their routes or inventory.
