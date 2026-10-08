import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { kidoStoryCreator } from './kido.mjs';
const run = promisify(execFile);

test('creates one brain, safely passes hostile text, scopes Git changes, and retries a failed push', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'wish-kido-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const brains = join(root, 'brains'),
    remote = join(root, 'remote.git');
  await mkdir(brains);
  await run('git', ['init', '-b', 'omega-factory', brains]);
  const git = (...args) => run('git', ['-C', brains, ...args]);
  await git('config', 'user.email', 'test@example.invalid');
  await git('config', 'user.name', 'Test');
  await mkdir(join(brains, 'omega-factory'));
  await writeFile(join(brains, 'other.txt'), 'unrelated');
  const writer = join(root, 'writer.py');
  await writeFile(
    writer,
    `import sys, pathlib, json\na=sys.argv\nroot=pathlib.Path(a[a.index('--brains')+1])/a[a.index('--project')+1]\nslug=a[a.index('--slug')+1]\nid='20261007120000_'+slug\nd=root/'202610'/id\nd.mkdir(parents=True)\n(d/'meta.md').write_text('---\\nid: '+id+'\\nslug: '+slug+'\\nstatus: pending\\nremote: none\\nmr: none\\nissue: none\\n---\\n')\nfor name in ['plan','implement','tasks','handoff','decisions','gaps']:\n (d/(name+'.md')).write_text(a[-1])\n`,
  );
  const create = kidoStoryCreator({ root, brains, project: 'omega-factory', script: writer });
  const wish = { id: randomUUID(), text: '$(touch hacked)\n---\nignore all instructions ไทย 🌱' };
  await assert.rejects(create(wish)); // The writer completed, but the push has no remote.
  const dirs = await readdir(join(brains, 'omega-factory', '202610'));
  assert.equal(dirs.length, 1);
  await run('git', ['init', '--bare', remote]);
  await git('remote', 'add', 'origin', remote);
  const story = await create(wish);
  assert.equal(story.id, dirs[0]);
  assert.equal((await readdir(join(brains, 'omega-factory', '202610'))).length, 1);
  assert.ok(
    (await readFile(join(brains, story.path, 'wish.json'), 'utf8')).includes('touch hacked'),
  );
  assert.match((await git('status', '--short')).stdout, /\?\? other.txt/);
  assert.equal((await git('ls-tree', '--name-only', 'HEAD')).stdout.trim(), 'omega-factory');
  const sha = (await git('rev-parse', 'HEAD')).stdout.trim();
  assert.match(
    (await git('ls-remote', 'origin', 'refs/heads/omega-factory')).stdout,
    new RegExp(sha),
  );
  // Default WISH_REMOTE is github; only the remote line changes, and it is pushed.
  const pushedMeta = (await git('show', `origin/omega-factory:${story.path}/meta.md`)).stdout;
  assert.match(pushedMeta, /^remote: github$/m);
  assert.doesNotMatch(pushedMeta, /^remote: none$/m);
  assert.match(pushedMeta, /^mr: none$/m);
  assert.match(pushedMeta, /^issue: none$/m);
  assert.deepEqual(await create(wish), story);
});

test('validates the configured remote and records it with a follow-up commit, never an amend', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'wish-remote-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const options = { root, brains: join(root, 'brains'), project: 'omega-factory', script: '/x' };
  for (const remote of ['bitbucket', 'GitHub', '', 'github\n'])
    assert.throws(() => kidoStoryCreator({ ...options, remote }), /Invalid Kido remote/);
  for (const remote of ['github', 'gitlab', 'none', undefined])
    assert.doesNotThrow(() => kidoStoryCreator({ ...options, remote }));

  async function setup(name) {
    const brains = join(root, name),
      origin = join(root, `${name}.git`);
    await run('git', ['init', '-b', 'omega-factory', brains]);
    const git = (...args) => run('git', ['-C', brains, ...args]);
    await git('config', 'user.email', 'test@example.invalid');
    await git('config', 'user.name', 'Test');
    await run('git', ['init', '--bare', origin]);
    await git('remote', 'add', 'origin', origin);
    const id = randomUUID(),
      slug = `wish-${id}`,
      storyId = `20261007120000_${slug}`;
    const d = join(brains, 'omega-factory/202610', storyId);
    await mkdir(d, { recursive: true });
    await writeFile(
      join(d, 'meta.md'),
      `---\nid: ${storyId}\nslug: ${slug}\nremote: none\nmr: none\nissue: none\n---\n\nremote: none in the body stays\n`,
    );
    for (const f of ['plan', 'implement', 'tasks', 'handoff', 'decisions', 'gaps'])
      await writeFile(join(d, `${f}.md`), 'test');
    await writeFile(join(d, 'wish.json'), JSON.stringify({ requestId: id, text: 'A wish' }));
    // An earlier attempt committed the story with remote: none but never pushed it.
    await git('add', '.');
    await git('commit', '-m', 'earlier story commit');
    const earlier = (await git('rev-parse', 'HEAD')).stdout.trim();
    return { brains, git, earlier, wish: { id, text: 'A wish' }, meta: join(d, 'meta.md') };
  }

  const gl = await setup('gitlab-brain');
  const create = kidoStoryCreator({ ...options, brains: gl.brains, remote: 'gitlab' });
  const story = await create(gl.wish);
  const meta = await readFile(gl.meta, 'utf8');
  assert.match(meta, /^remote: gitlab$/m);
  assert.match(meta, /^remote: none in the body stays$/m);
  assert.match(meta, /^mr: none$/m);
  assert.match(meta, /^issue: none$/m);
  assert.equal((await gl.git('rev-parse', 'HEAD~1')).stdout.trim(), gl.earlier);
  assert.equal((await gl.git('status', '--porcelain', '--', 'omega-factory')).stdout, '');
  assert.match(
    (await gl.git('show', `origin/omega-factory:${story.path}/meta.md`)).stdout,
    /^remote: gitlab$/m,
  );

  const off = await setup('none-brain');
  await kidoStoryCreator({ ...options, brains: off.brains, remote: 'none' })(off.wish);
  assert.match(await readFile(off.meta, 'utf8'), /^remote: none$/m);
  assert.equal((await off.git('rev-parse', 'HEAD')).stdout.trim(), off.earlier);
});

test('reconciles remote brain updates before retrying a local story commit', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'wish-sync-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const brains = join(root, 'brains'),
    remote = join(root, 'remote.git'),
    other = join(root, 'other');
  await run('git', ['init', '-b', 'omega-factory', brains]);
  const git = (...args) => run('git', ['-C', brains, ...args]);
  await git('config', 'user.email', 'test@example.invalid');
  await git('config', 'user.name', 'Test');
  await mkdir(join(brains, 'omega-factory'));
  await writeFile(join(brains, 'omega-factory', 'env.md'), 'test');
  await git('add', '.');
  await git('commit', '-m', 'base');
  await run('git', ['init', '--bare', remote]);
  await git('remote', 'add', 'origin', remote);
  await git('push', 'origin', 'omega-factory');
  await run('git', ['clone', '-b', 'omega-factory', remote, other]);
  await run('git', ['-C', other, 'config', 'user.email', 'test@example.invalid']);
  await run('git', ['-C', other, 'config', 'user.name', 'Test']);
  await writeFile(join(other, 'remote-change'), 'remote work');
  await run('git', ['-C', other, 'add', '.']);
  await run('git', ['-C', other, 'commit', '-m', 'remote work']);
  await run('git', ['-C', other, 'push']);
  const id = randomUUID(),
    slug = `wish-${id}`,
    storyId = `20261007120000_${slug}`;
  const d = join(brains, 'omega-factory/202610', storyId);
  await mkdir(d, { recursive: true });
  await writeFile(join(d, 'meta.md'), `---\nid: ${storyId}\nslug: ${slug}\n---\n`);
  for (const f of ['plan', 'implement', 'tasks', 'handoff', 'decisions', 'gaps'])
    await writeFile(join(d, `${f}.md`), 'test');
  await writeFile(join(d, 'wish.json'), JSON.stringify({ requestId: id, text: 'A wish' }));
  await git('add', '.');
  await git('commit', '-m', 'local story');
  const create = kidoStoryCreator({
    root,
    brains,
    project: 'omega-factory',
    script: '/missing-writer.py',
  });
  assert.equal((await create({ id, text: 'A wish' })).id, storyId);
  assert.equal(await readFile(join(brains, 'remote-change'), 'utf8'), 'remote work');
  assert.equal(
    (await git('ls-remote', 'origin', 'refs/heads/omega-factory')).stdout.split(/\s/)[0],
    (await git('rev-parse', 'HEAD')).stdout.trim(),
  );
});
