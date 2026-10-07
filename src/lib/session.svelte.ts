import { tickWorld } from './game/transport';
import { createGame } from './game/engine';
import { SAVE_KEY } from './game/persistence';
import type { Game } from './game/types';
import {
  createCollection,
  activeFactory,
  activeWorld,
  addCategory,
  addWorld,
  addFactory,
  readCollection,
  writeCollection,
  FACTORY_PRICE,
  FACTORY_BUDGET,
} from './game/collection';
import { applyFactoryDraft } from './game/factory';
type EditSnapshot = { game: Game; balance: number; spent: number; dirty: boolean };

export class Session {
  game = $state.raw<Game>(createGame());
  collection = $state.raw(createCollection(this.game));
  private edits = new Map<
    string,
    {
      draft: Game | null;
      dirty: boolean;
      balance: number;
      spent: number;
      undo: EditSnapshot[];
      redo: EditSnapshot[];
    }
  >();
  get worldThing() {
    return activeWorld(this.collection);
  }
  get factoryThing() {
    return activeFactory(this.collection);
  }
  private storeActive() {
    this.collection = {
      ...this.collection,
      worlds: this.collection.worlds.map((w) => ({
        ...w,
        factories: w.factories.map((f) =>
          f.id === this.collection.activeFactory ? { ...f, game: this.game } : f,
        ),
      })),
    };
  }
  private stashEdits() {
    this.storeActive();
    this.edits.set(this.collection.activeFactory, {
      draft: this.draft,
      dirty: this.dirty,
      balance: this.balanceDelta,
      spent: this.spentDelta,
      undo: this.undoStack,
      redo: this.redoStack,
    });
  }
  private loadActive() {
    this.game = this.factoryThing.game;
    const cached = this.edits.get(this.collection.activeFactory);
    this.draft = cached?.draft ?? null;
    this.dirty = cached?.dirty ?? false;
    this.balanceDelta = cached?.balance ?? 0;
    this.spentDelta = cached?.spent ?? 0;
    this.undoStack = cached?.undo ?? [];
    this.redoStack = cached?.redo ?? [];
    this.selected = null;
    this.connecting = null;
    this.view = 'world';
    this.syncDraft();
  }
  focusThing(worldId: string, factoryId: string) {
    if (
      !this.collection.worlds.some(
        (w) => w.id === worldId && w.factories.some((f) => f.id === factoryId),
      )
    )
      return;
    this.stashEdits();
    this.collection = { ...this.collection, activeWorld: worldId, activeFactory: factoryId };
    this.loadActive();
  }
  createCategory(name: string, template: 'world' | 'factory') {
    try {
      this.collection = addCategory(this.collection, name, template);
      this.save(true);
      this.notify('Category created');
    } catch (error) {
      this.notify((error as Error).message);
    }
  }
  createWorld(category: string) {
    try {
      this.stashEdits();
      this.collection = addWorld(this.collection, category);
      this.loadActive();
      this.save(true);
      this.notify('World Thing created');
    } catch (error) {
      this.notify((error as Error).message);
    }
  }
  createFactory(category: string) {
    try {
      if (this.editorGame.state.credits < FACTORY_PRICE + FACTORY_BUDGET)
        throw new Error('Not enough available credits after pending edits.');
      this.storeActive();
      this.collection = addFactory(this.collection, category);
      this.game = this.factoryThing.game;
      this.syncDraft();
      this.save(true);
      this.notify('Factory Thing created with a 1,000 CR budget');
    } catch (error) {
      this.notify((error as Error).message);
    }
  }
  view = $state<'world' | 'interior'>('world');
  draft = $state.raw<Game | null>(null);
  dirty = $state(false);
  private balanceDelta = 0;
  private spentDelta = 0;
  get editorGame() {
    return this.draft ?? this.game;
  }
  get running() {
    return !this.welcome && this.game.state.factory.downtime === 0;
  }
  speed = $state(1);
  selected = $state<string | null>(null);
  connecting = $state<string | null>(null);
  panel = $state<'factory' | 'lab' | 'journal' | 'help' | 'quests'>('factory');
  welcome = $state(true);
  toast = $state('');
  lastSaved = $state('Not saved yet');
  undoStack = $state.raw<EditSnapshot[]>([]);
  redoStack = $state.raw<EditSnapshot[]>([]);
  private toastTimer?: ReturnType<typeof setTimeout>;
  private saveFailed = false;

  notify(message: string) {
    this.toast = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = ''), 5000);
  }
  initialize() {
    try {
      const save = localStorage.getItem(SAVE_KEY);
      if (save) {
        this.collection = readCollection(save);
        this.loadActive();
        this.welcome = false;
        this.lastSaved = 'Restored local save';
      }
    } catch (error) {
      this.notify(error instanceof Error ? error.message : 'Could not restore the local save.');
    }
  }
  openFactory() {
    if (!this.draft) this.draft = structuredClone(this.game);
    if (this.view !== 'interior') this.selected = null;
    this.view = 'interior';
    this.panel = 'factory';
  }
  private snapshot(): EditSnapshot {
    return {
      game: structuredClone(this.editorGame),
      balance: this.balanceDelta,
      spent: this.spentDelta,
      dirty: this.dirty,
    };
  }
  private syncDraft() {
    if (!this.draft) return;
    const draft = this.draft;
    const nodes = Object.fromEntries(
      draft.definition.nodes.map((node) => {
        const live = this.game.definition.nodes.find((entry) => entry.id === node.id);
        return [
          node.id,
          live?.resource === node.resource
            ? this.game.state.nodes[node.id]
            : draft.state.nodes[node.id],
        ];
      }),
    );
    this.draft = {
      ...draft,
      state: {
        ...this.game.state,
        nodes,
        credits: this.game.state.credits + this.balanceDelta,
        spent: this.game.state.spent + this.spentDelta,
      },
    };
  }
  remember() {
    if (!this.draft) this.draft = structuredClone(this.game);
    this.undoStack = [...this.undoStack.slice(-29), this.snapshot()];
    this.redoStack = [];
    this.dirty = true;
  }
  edit(action: (game: Game) => Game, message?: string) {
    try {
      if (!this.draft) this.draft = structuredClone(this.game);
      this.syncDraft();
      const next = action(this.editorGame);
      if (next === this.editorGame) return;
      this.remember();
      this.balanceDelta = next.state.credits - this.game.state.credits;
      this.spentDelta = next.state.spent - this.game.state.spent;
      this.draft = next;
      if (this.selected && !next.state.nodes[this.selected]) this.selected = null;
      if (message) this.notify(`${message} · draft`);
    } catch (error) {
      this.notify(error instanceof Error ? error.message : 'That edit could not be made.');
    }
  }
  act(action: (game: Game) => Game, message?: string) {
    try {
      const next = action(this.game);
      if (next === this.game) {
        this.notify('This insight is already in your journal.');
        return;
      }
      this.game = next;
      this.syncDraft();
      if (message) this.notify(message);
    } catch (error) {
      this.notify(error instanceof Error ? error.message : 'That action could not be completed.');
    }
  }
  layout(layout: Game['layout']) {
    if (!this.draft) this.draft = structuredClone(this.game);
    if (layout.positions !== this.draft.layout.positions) this.dirty = true;
    this.draft = { ...this.draft, layout };
  }
  private restore(snapshot: EditSnapshot) {
    this.draft = snapshot.game;
    this.balanceDelta = snapshot.balance;
    this.spentDelta = snapshot.spent;
    this.dirty = snapshot.dirty;
    this.selected = null;
    this.connecting = null;
    this.syncDraft();
  }
  undo() {
    const previous = this.undoStack.at(-1);
    if (!previous) return;
    this.redoStack = [...this.redoStack, this.snapshot()];
    this.undoStack = this.undoStack.slice(0, -1);
    this.restore(previous);
  }
  redo() {
    const next = this.redoStack.at(-1);
    if (!next) return;
    this.undoStack = [...this.undoStack, this.snapshot()];
    this.redoStack = this.redoStack.slice(0, -1);
    this.restore(next);
  }
  discardDraft() {
    this.draft = null;
    this.dirty = false;
    this.balanceDelta = 0;
    this.spentDelta = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.selected = null;
    this.connecting = null;
  }
  applyDraft() {
    if (!this.draft || !this.dirty) return;
    try {
      this.game = applyFactoryDraft(this.game, this.draft, this.balanceDelta, this.spentDelta);
      this.discardDraft();
      this.view = 'world';
      this.save(true);
      this.notify(
        'Factory update applied. Production resumes automatically after the service cooldown.',
      );
    } catch (error) {
      this.notify(error instanceof Error ? error.message : 'Could not apply this draft.');
    }
  }
  step() {
    const active = this.collection.activeFactory;
    const worlds = this.collection.worlds.map((w) =>
      tickWorld({
        ...w,
        factories: w.factories.map((f) => (f.id === active ? { ...f, game: this.game } : f)),
      }),
    );
    this.collection = { ...this.collection, worlds };
    this.game = activeFactory(this.collection).game;
    this.syncDraft();
  }
  save(silent = false) {
    try {
      this.storeActive();
      localStorage.setItem(SAVE_KEY, writeCollection(this.collection));
      this.lastSaved = 'Saved on this device';
      this.saveFailed = false;
      if (!silent) this.notify('Factory saved on this device');
    } catch {
      if (!silent || !this.saveFailed)
        this.notify('Local save failed. Export a save file to keep your factory.');
      this.saveFailed = true;
      this.lastSaved = 'Local save unavailable';
    }
  }
  export() {
    this.storeActive();
    const blob = new Blob([writeCollection(this.collection)], { type: 'application/json' });
    const url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = 'omega-things.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.notify('Factory exported');
  }
  async import(file: File) {
    try {
      if (file.size > 16_000_000) throw new Error('Save file is too large (maximum 16 MB).');
      const next = readCollection(await file.text());
      this.discardDraft();
      this.edits.clear();
      this.collection = next;
      this.loadActive();
      this.view = 'world';
      this.selected = null;
      this.connecting = null;
      this.welcome = false;
      this.save(true);
      this.notify('Factory imported');
    } catch (error) {
      this.notify(error instanceof Error ? error.message : 'Could not read the save file.');
    }
  }
  reset() {
    this.discardDraft();
    this.game = createGame();
    this.view = 'world';
    this.selected = null;
    this.connecting = null;
    this.save(true);
    this.notify('A fresh factory is ready. Production runs automatically.');
  }
  dispose() {
    clearTimeout(this.toastTimer);
  }
}
