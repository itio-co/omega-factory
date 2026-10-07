import { open, readFile, mkdir, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { lockFile } from './lock.mjs';
import { randomUUID } from 'node:crypto';
import yaml from 'js-yaml';
import { z } from 'zod';

const story = z.object({
  id: z.string().regex(/^\d{14}_wish-[a-f0-9-]{36}$/),
  slug: z.string(),
  path: z.string(),
});
const database = z.object({
  version: z.literal(1),
  wishes: z.array(
    z
      .object({
        id: z.uuid(),
        text: z.string().min(1).max(4000),
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
        status: z.enum(['pending', 'submitted']),
        story: story.nullable(),
        worker: z
          .object({ status: z.enum(['queued', 'running', 'failed', 'attention', 'deployed']) })
          .passthrough(),
      })
      .passthrough(),
  ),
});

// kido: one local YAML writer; use a transactional database before scaling replicas.
export class WishStore {
  static async open(file) {
    file = resolve(file);
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    const unlock = await lockFile(`${file}.lock`);
    try {
      let data;
      try {
        data = yaml.load(await readFile(file, 'utf8'), { schema: yaml.JSON_SCHEMA });
      } catch (e) {
        if (e.code !== 'ENOENT') throw new Error('Wish storage is invalid', { cause: e });
        data = { version: 1, wishes: [] };
      }
      const parsed = database.safeParse(data);
      if (
        !parsed.success ||
        new Set(parsed.data.wishes.map((w) => w.id)).size !== parsed.data.wishes.length ||
        parsed.data.wishes.some((w) => (w.status === 'submitted') !== Boolean(w.story))
      )
        throw new Error('Wish storage has invalid schema or version');
      return new WishStore(file, unlock, parsed.data);
    } catch (e) {
      await unlock();
      throw e;
    }
  }
  constructor(file, unlock, data) {
    this.file = file;
    this.unlock = unlock;
    this.data = data;
    this.tail = Promise.resolve();
    this.closed = false;
    this.uncertain = false;
  }
  read() {
    return structuredClone(this.data);
  }
  mutate(fn) {
    const next = this.tail.then(async () => {
      if (this.closed) throw new Error('Wish storage closed');
      if (this.uncertain)
        throw new Error('Wish storage flush was uncertain; restart before writing');
      const draft = this.read();
      const result = await fn(draft);
      database.parse(draft);
      const temp = `${this.file}.${randomUUID()}.tmp`;
      try {
        await writeSynced(temp, yaml.dump(draft, { noRefs: true, lineWidth: -1 }));
        await rename(temp, this.file);
        this.uncertain = true;
        const directory = await open(dirname(this.file), 'r');
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
        this.data = draft;
        this.uncertain = false;
      } finally {
        await rm(temp, { force: true });
      }
      return structuredClone(result);
    });
    this.tail = next.catch(() => {});
    return next;
  }
  async close() {
    await this.tail;
    this.closed = true;
    await this.unlock();
  }
}

async function writeSynced(file, body) {
  const handle = await open(file, 'wx', 0o600);
  try {
    await handle.writeFile(body, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}
