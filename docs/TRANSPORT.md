# Cross-factory transport (spec, v1)

Status: **M1 spec** for kido `omega-things-cross-factory-transport`. Data model and
save format are implemented (`src/lib/game/transport-model.ts`, Collection v3); the
tick mechanic (M2) and World-map UI (M3) are not yet.

Defaults marked _(provisional)_ were chosen without a user answer and can be revisited;
see the kido `decisions.md`.

## 1. Link semantics

A **transport link** joins one factory's **Outlet** (an `export` node, scope port
`outlet`) to another factory's **Inlet** (an `import` node, scope port `inlet`) inside
the **same World**.

| Field | Meaning |
|---|---|
| `id` | `link-N`, allocated from the Collection's `nextId`. |
| `from` | `{ factory, node }` — source Factory Thing id and its Outlet node id. |
| `to` | `{ factory, node }` — destination Factory Thing id and its Inlet node id. |
| `resource` | The single resource the link carries _(provisional: one type per link, no bundles)_. Must equal the resource of both endpoint nodes. |
| `level` | 1–3, sets capacity (§3). |
| `delay` | Transit time in ticks, fixed at build time from World-map distance (§2). Integer ≥ 1. |
| `enabled` | Disabled links accept nothing; goods already in transit still arrive. |
| `transit` | Packets in flight: `{ amount, remaining }[]`, `remaining` in `1..delay`, `amount` in `1..capacity`. At most `delay` packets. |

Rules:

- `from.factory !== to.factory` (intra-factory routing uses normal connections).
- An Outlet feeds **at most one** link; an Inlet is fed by **at most one** link. A linked
  Inlet stops drawing from external suppliers (it becomes the link's sink, M2).
- Links carry **goods only** — never credits _(provisional)_.
- The World's external suppliers/customers are **not** link endpoints in v1 _(provisional)_.
- Links never cross Worlds.

## 2. Transit delay

_(provisional)_ Delay is proportional to World-map distance. Factory Things occupy
World-map **slots** in their order within `world.factories` (slot = index). Then

```
delay = max(1, |slot(from) - slot(to)| * TRANSIT_TICKS_PER_SLOT)   // TRANSIT_TICKS_PER_SLOT = 2
```

The delay is computed once when the link is built and stored, so later reordering or
adding factories never changes a running link.

## 3. Tick ordering, back-pressure and outages (decision record)

Executed per World tick (M2), deterministically, links in ascending numeric id order:

1. **Factory ticks** run first, exactly as today (each `engine.tick`).
2. **Arrivals**: every packet decrements `remaining`; packets reaching 0 are delivered
   into the destination Inlet's inventory, up to its free capacity. Undeliverable
   remainder stays at the head with `remaining = 0` (**back-pressure stall**) — goods
   are never destroyed or duplicated (conservation).
3. **Departures**: if the link is enabled, not stalled, and the source Outlet holds
   goods, up to `capacity` units of `resource` are moved from the Outlet into a new
   packet with `remaining = delay`. A stalled link takes nothing, so pressure backs up
   into the source factory.

**Outages**: when either endpoint factory is out of service (`state.factory.downtime > 0`),
no departures happen and arrivals are held (stall) until it is back. Goods in transit
are preserved. Removing a link (M2 draft flow) refunds nothing and returns in-transit
goods to the source Outlet up to capacity; the rest is lost and the UI must warn.

Because goods leaving the Outlet into a link no longer reach the source factory's
customer/contracts, the link changes where value is earned, not how much is produced.

## 4. Cost, upkeep and upgrades

_(provisional)_ **Build cost only, no per-unit or per-tick upkeep**, paid from the
**source factory's** credits (the factory owning the Outlet). Counts toward its `spent`.

| Level | Capacity (units/tick) | Cost to reach (CR) |
|---|---|---|
| 1 (build) | 2 | 250 |
| 2 | 4 | 400 |
| 3 | 6 | 650 |

Values are placeholders to tune in M4 (task 5.1.1).

## 5. Unlock gate

_(provisional)_ The link tool unlocks once the player owns **2 or more Factory Things in
the active World** (`transportUnlocked(world)`); a link needs two factories anyway.

## 6. Save format

- **Collection v3** (`version: 3`) adds `links: TransportLink[]` to each `WorldThing`.
- Per-factory **Game** saves stay at **v1**; links live only in the Collection.
- **Migration**: legacy v1 single-factory saves and v2 collections load as v3 with
  `links: []`.
- **Validation**: the Collection is validated with zod. A link that is structurally
  valid but semantically broken (missing factory/node, wrong port kind, resource
  mismatch, same factory, duplicate id or endpoint, id ≥ `nextId`, transit inconsistent
  with delay/capacity) is **dropped** rather than failing the whole save. A link that
  is not even structurally valid is also dropped individually.
