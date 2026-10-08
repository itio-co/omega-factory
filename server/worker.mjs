import { randomUUID } from 'node:crypto';
const nextStage = { dispatch: 'develop', develop: 'validate', validate: 'deploy' };
const hash = (s) => typeof s === 'string' && /^[a-f0-9]{40,64}$/.test(s);

export class WishWorker {
  constructor({ store, stages, leaseMs = 60000, owner = randomUUID() }) {
    this.store = store;
    this.stages = stages;
    this.leaseMs = leaseMs;
    this.owner = owner;
    this.busy = false;
    this.stopping = false;
  }
  async tick() {
    if (this.busy || this.stopping) return false;
    this.busy = true;
    let heartbeat;
    try {
      const rows = this.store.read().wishes;
      // An uncertain external side effect blocks further work until its receipt is reconciled.
      const wish =
        rows.find((w) => ['running', 'attention'].includes(w.worker.status)) ??
        rows.find((w) => w.status === 'submitted' && w.worker.status === 'queued');
      if (!wish) return false;
      const state = wish.worker;
      if (state.owner !== this.owner && Date.parse(state.leaseUntil) > Date.now()) return false;
      const recovering = state.inFlight || state.status === 'attention';
      const stage = state.stage || 'dispatch';
      const op = recovering ? state.operationId : randomUUID();
      const update = async (fn) =>
        this.store.mutate((db) => {
          const row = db.wishes.find((w) => w.id === wish.id);
          fn(row.worker);
          row.updatedAt = new Date().toISOString();
          return row;
        });
      const claimed = await this.store.mutate((db) => {
        const row = db.wishes.find((w) => w.id === wish.id);
        const s = row.worker;
        if (
          s.operationId !== state.operationId ||
          s.status !== state.status ||
          (s.owner !== this.owner && Date.parse(s.leaseUntil) > Date.now())
        )
          return null;
        Object.assign(s, {
          status: 'running',
          stage,
          operationId: op,
          inFlight: true,
          owner: this.owner,
          leaseUntil: new Date(Date.now() + this.leaseMs).toISOString(),
          attempts: (s.attempts || 0) + (recovering ? 0 : 1),
          receipts: s.receipts || {},
        });
        row.updatedAt = new Date().toISOString();
        return row;
      });
      if (!claimed) return false;
      heartbeat = setInterval(
        () => {
          update((s) => {
            if (s.operationId !== op || s.owner !== this.owner) return;
            s.leaseUntil = new Date(Date.now() + this.leaseMs).toISOString();
          }).catch(() => {});
        },
        Math.max(100, this.leaseMs / 3),
      );
      let receipt;
      try {
        // Validation/development polling are repeatable; dispatch/deploy must reconcile after a crash.
        receipt =
          recovering && ['dispatch', 'deploy'].includes(stage)
            ? await this.stages.recover(claimed, stage, op)
            : await this.stages[stage](claimed, op);
        if (!receipt) {
          await update((s) => {
            s.status = stage === 'develop' ? 'running' : 'attention';
            s.inFlight = stage !== 'develop';
            if (s.status === 'attention')
              s.error = {
                stage,
                message: 'No confirmed receipt. Inspect this operation before retrying.',
                at: new Date().toISOString(),
              };
            s.leaseUntil = new Date().toISOString();
          });
          return true;
        }
        if (
          stage === 'dispatch' &&
          (typeof receipt.sessionUrl !== 'string' || !receipt.sessionUrl.startsWith('https://'))
        )
          throw new Error('Invalid dispatch receipt');
        if (stage !== 'dispatch' && !hash(receipt.commit))
          throw new Error('Missing development commit');
        if (
          ['validate', 'deploy'].includes(stage) &&
          receipt.commit !== claimed.worker.receipts.develop?.commit
        )
          throw new Error('Receipt commit differs from development');
        if (
          stage === 'deploy' &&
          (receipt.environment !== 'dev' || typeof receipt.receipt !== 'string' || !receipt.receipt)
        )
          throw new Error('Missing dev deployment receipt');
        await update((s) => {
          s.receipts[stage] = { ...receipt, operationId: op, at: new Date().toISOString() };
          s.stage = nextStage[stage] || 'done';
          s.status = stage === 'deploy' ? 'deployed' : 'running';
          s.inFlight = false;
          s.error = null;
          s.leaseUntil = new Date().toISOString();
        });
      } catch (error) {
        await update((s) => {
          s.status =
            stage === 'develop'
              ? 'running'
              : ['dispatch', 'deploy'].includes(stage) && !error.definite
                ? 'attention'
                : 'failed';
          s.inFlight = s.status === 'attention';
          s.leaseUntil = new Date().toISOString();
          s.error = {
            stage,
            message: 'Stage failed; inspect the protected server logs/operation receipt.',
            at: new Date().toISOString(),
          };
        });
        this.onError?.(error);
      }
      return true;
    } finally {
      clearInterval(heartbeat);
      this.busy = false;
    }
  }
  start() {
    this.stopping = false;
    this.timer = setInterval(() => {
      if (!this.busy) this.current = this.tick().catch((e) => this.onError?.(e));
    }, 5000);
  }
  async stop() {
    this.stopping = true;
    clearInterval(this.timer);
    await this.current;
  }
}
