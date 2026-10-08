# Omega Factory · ITIOVerse

A playable, local-first **factory for ideas**. Build a logical production graph,
observe resource flow, diagnose bottlenecks, and rediscover equivalent logic rules.
Svelte provides the interface; **Three.js through Threlte** renders machines,
routes, and resource pulses. The pure TypeScript simulation advances independently
of rendering. All artwork is procedural and all assets ship with the app.

## Play locally

Requires Node.js 22.12+ (Node.js 24 LTS recommended) and npm.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. The server listens on all interfaces for testing
on a tablet connected to the same network. Desktop play:

```sh
npm run desktop
```

## First Light

1. Enter the world and open the selected Factory Thing in its **Factory interior** tab.
2. Connect the **Smelter output** to the **Export gate input**, then **Apply factory
   update**. The factory returns to service automatically after its countdown.
3. Deliver 12 ingots and claim the founding quest in **Quests**. This unlocks the
   assembler, plate press, and wire mill. The plate quest unlocks the frame fabricator.
4. Build production branches, attach import/export slots to the factory walls,
   and configure matching customers. A warehouse provides larger resource buffers.
5. Follow ten main and side quests. Inspect objectives and prerequisites, track a
   quest, and claim each reward once. The original three contracts remain included.
6. Explore the Logic Lab and record verified discoveries in the Insight Journal.
   Rediscovering AND also unlocks the assembler.

Discoveries earn 100 credits once each. All five learning tiers are playable:

| Game tier         | Requirement                                  |
| ----------------- | -------------------------------------------- |
| Novice            | Start exploring                              |
| Advanced beginner | Record AND, OR, and XOR                      |
| Competent         | Build an implication rule                    |
| Proficient        | Build a three-input majority rule            |
| Expert            | Build a three-input selector using only NAND |

The advanced challenges unlock in sequence. Three-input rules are checked against
all eight input combinations; the selector also enforces its NAND-only restriction.
The journal shows requirements and the next challenge, and saves retain verified
solutions and earned tiers. Earlier saves remain compatible. Tiers describe game
progress rather than certify real-world expertise.

The expression evaluator is a **small safe rule
language**, not an implementation of the full Yai language or compiler.

## Controls and saves

- Drag any part of a Thing card except its ports to move; drag empty space to pan;
  scroll or use buttons to zoom.
- Select an output port, then a compatible input. Works with mouse or touch.
- Select a node to inspect it. Upgrades, resource changes, enable/disable, salvage,
  routes, and positions are prepared in an interior draft.
- World is a map of the factory, external suppliers/customers, and live route rates.
  Use map zoom/fit and scroll to explore it.
- Things declare a compatible plane: World or Interior. Suppliers and
  customers stay outside; internal machines stay inside. External routes must
  cross the factory's typed boundary ports.
- Manage Inlets/Outlets in **Factory scope**. They are factory boundary context,
  separate from the machine palette. Drag a port vertically to another free slot.
- Each route shows actual items per simulation second, averaged over the last five
  simulated seconds. Select its rate label for details or to disconnect it.
- Production runs automatically while the app is open, including other tabs and
  background windows. 1×/2×/4× adjust simulation speed, not measured throughput.
- **Apply factory update** installs the draft and stops the whole factory for
  30/20/10 simulated seconds at factory level 1/2/3. It then resumes automatically.
  Factory upgrades also cause an outage. No production occurs during an outage.
- Ctrl/Cmd+Z undoes draft edits; Shift+Ctrl/Cmd+Z redoes. Inspecting a machine does
  not change the draft. Switch to World and return to continue the same draft.
- Auto-save runs every five seconds and on leaving the page. Only the live,
  applied factory is saved or exported; unapplied drafts are lost on reload.
  Import/export portable JSON through the Factory menu. Invalid files preserve
  the current factory. Older saves migrate to attached slots and new defaults.
- Closing the app stops simulation; reopening resumes saved progress and downtime.

WebGL2 is used for the Three.js scene. An HTML/SVG fallback keeps the editor usable
when WebGL is unavailable. Reduced-motion settings disable animated pulses.
Landscape tablets are supported; a larger screen gives room for the inspector.

## Validation

```sh
npm run check
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
```

An existing browser executable can be selected with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Tests exercise actual production, graph
editing, discovery, save validation, and desktop/tablet browser flows.

## Installed web app

The game is a PWA, so it can be installed from Chrome or Edge. The
`maximizeOnLaunch` runtime flag in `config.json` (off by default) makes the installed
desktop window fill the screen once per app window. A reload in the same window
keeps whatever size the player chose, because a `sessionStorage` marker (scoped to
that window) records that it was already maximized; a newly opened app window
maximizes again. For local development, `VITE_FEATURE_MAXIMIZE_ON_LAUNCH=1 npm
run dev` forces it on. Production builds ignore that variable. See
`deploy/README.md` for turning flags on.

## Desktop distribution

```sh
npm run package:desktop   # unpacked application in release/
npm run dist:desktop      # host-platform distributable
```

Electron has an isolated, sandboxed renderer with no Node.js access. The packaged
game works offline. Build Windows and macOS distributions on those platforms;
platform signing is configured separately. The Linux target is an AppImage.

This is a local playable demo, **not a Steam release**. Steamworks SDK features,
Steam Cloud, controller/Steam Deck certification, store art, signing, and Steam
depot upload remain release work. Native iPad/Android wrappers are not included.

## Source boundaries

- `src/lib/game/`: deterministic simulation, economy, contracts, logic, save validation.
- `src/lib/components/`: Three.js scene, graph editor, inspector, learning interface.
- `src/lib/session.svelte.ts`: editor history, local saves, and app session.
- `desktop/`: desktop wrapper. `.github/workflows/`: automated checks.

The shared ITIO discussions describe a human-centered ecosystem for modeling,
learning, collaboration, and realizing ideas. Omega Factory is its simulation
environment, alongside Yai and Kido. This demo demonstrates production and logic;
it does not connect to those services. **Itionians are not defined in the available
source conversations**, so their behavior has not been invented or implemented.
The broader Rust/WASM kernel, Free Monad compiler, GraphQL services, multiplayer,
and additional learning domains described in the earlier vision are future scope.

See [the backlog](docs/BACKLOG.md) for completed phases and remaining work.

See [Planes and scopes](docs/SCOPES.md) for the compositional model and the
category-theory direction, including the distinction from a monad implementation.

## Things and categories

World and Factory are categories; each can have multiple Things. Use the World
and Factory selectors to navigate, and **Things & categories** to define more
enclosure categories or create another World. The **Things** palette filters by
the active plane. Shared select/pan/zoom, inspector, history and draft controls
work in both planes. World partners connect to enclosure ports from the inspector.

A new Factory costs 500 CR and receives a 1,000 CR budget transferred from the
selected Factory. It starts empty. Each Factory retains its own progress and
continues running when another is selected. Creation of categories/enclosures is
immediate; machine and route edits remain drafts until applied. Collection saves
preserve all Worlds and Factories. Unapplied drafts survive navigation but not reload.

Kido backlog lives in `.kido/brains` on the `omega-factory` branch. Wish submission
and Kubernetes ingress deployment are pending stories, not implemented services.
Wish scope: submit → `/kido create story` immediately → later `/kido code` →
validate → `/kido deploy dev`. The server will be added to this project when that
story is activated.

## Player Wishes

**Make a Wish** submits game ideas to a durable YAML-backed API and immediately
creates a pending Kido story. Run `npm run server` alongside the game; configure
its installed Kido skill and writable brain checkout first. The optional Claude
Code development/deployment worker is disabled by default.

See [Wish server and worker operation](docs/WISHES.md) for setup, endpoint/storage
configuration, retry behavior, persistent volumes, and worker recovery.
