# Planes, scopes, and compositional factories

A **Thing** is an instance. **World** and **Factory** are enclosure categories.
Categories are definitions shared by many Things; custom enclosure categories
choose World or Factory behavior. Worlds have a World plane, and factories expose
an Interior plane. There is no separate Wall plane. Inlets and Outlets are typed
properties of the enclosure scope, not independent Things in the build palette.

The same palette, inspector, draft actions, history, and select/pan/zoom/fit
controls serve both planes. Purchases are filtered by the active plane: external
suppliers and customers in World; production/storage Things in Interior. World
also offers Factory-category enclosures. Entering an enclosure hides external
Things and exposes its ports as scope context. World Things can be moved and
connected to compatible ports from their inspector.

`CATALOG[kind].plane` defines placement compatibility; `scopePort` marks inlet/
outlet properties. New external connections cannot bypass the enclosure ports.
Older saves migrate direct routes via matching or newly created ports. Saves at
hard graph limits with no reusable port may require capacity before migration.
Legacy external coordinates are normalized into the reachable World map.

The Things collection stores categories, World instances and Factory instances
with stable identities. Each Factory has its own simulation, budget, quests,
layout and draft/history. All factories continue ticking while another is focused.
A World is a separate sandbox. New factories begin empty: 500 CR construction
cost plus 1,000 CR transferred from the selected factory as a starting budget.
Category/World/Factory creation is immediate; component and connection edits use
the shared Apply/Discard draft flow. Saves contain applied games, never drafts.
Legacy single-game saves migrate into the first World and Factory.

World maps focus the selected factory's external routes. Other Factory Things
remain on the map and in the selector; selecting another brings its routes into
focus. Cross-factory transport is not implemented. Limits are 8 Worlds,
16 Factory Things per World and 24 enclosure category definitions. Custom
categories reuse an existing behavior rather than defining new simulation code.

## Category-theory direction

The design direction is a factory of composable typed systems: resource types
(or typed bundles) describe objects, and transformations describe arrows between
them. The factory should eventually expose the same interface as a composite
transformation while hiding its internal graph. Composition must respect types
and preserve the meaning of the computation across scope boundaries.

This is a design direction, not a claim that the current graph editor implements
a category or a lawful monad. The current implementation is a stateful resource
simulation. Time, inventory, costs, errors, and interaction with the outside world
are effects; nesting alone is not monadic composition. A future computation layer
must define its effect type, return/pure and bind, and test the identity and
associativity laws. It must also distinguish logical identity from a simulated
buffer or route, which may introduce capacity limits and elapsed time.

Keep declarative structure separate from execution (`definition` versus `state`).
Keep scope ports explicit. Do not expose inner node identities as the required
interface between future factory instances. The broader Yai/Free Monad work,
arbitrary recursive enclosure types remain future scope.
