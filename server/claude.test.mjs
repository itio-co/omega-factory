import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { run } from './kido.mjs';
import { claudeStages } from './claude.mjs';

test('requires explicit supported-host and dev deployment configuration', () => {
  assert.throws(
    () =>
      claudeStages({
        root: '/tmp',
        brains: '/tmp',
        project: 'omega-factory',
        skill: '/tmp',
        config: {},
      }),
    /requires/,
  );
});

test('integrates dispatch artifact, exact-commit checks, approved dev command and durable recovery', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'wish-claude-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const root = join(dir, 'project'),
    brains = join(dir, 'brains'),
    skill = join(dir, 'skill');
  const id = randomUUID(),
    slug = `wish-${id}`,
    storyId = `20261007120000_${slug}`;
  const path = `omega-factory/202610/${storyId}`;
  const storyDir = join(brains, path);
  const branch = `feature/${slug}`;
  for (const [repo, name] of [
    [root, branch],
    [brains, 'omega-factory'],
  ]) {
    await run('git', ['init', '-b', name, repo]);
    await run('git', ['-C', repo, 'config', 'user.name', 'Test']);
    await run('git', ['-C', repo, 'config', 'user.email', 'test@example.invalid']);
    await run('git', ['init', '--bare', `${repo}.git`]);
    await run('git', ['-C', repo, 'remote', 'add', 'origin', `${repo}.git`]);
  }
  await writeFile(join(root, '.gitignore'), 'var/\nevidence/\nnode_modules/\n');
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      version: '1.0.0',
      scripts: Object.fromEntries(
        ['check', 'test', 'test:e2e', 'build'].map((s) => [s, `node check.cjs ${s}`]),
      ),
    }),
  );
  await writeFile(
    join(root, 'package-lock.json'),
    JSON.stringify({
      name: 'fixture',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: { '': { name: 'fixture', version: '1.0.0' } },
    }),
  );
  await writeFile(
    join(root, 'check.cjs'),
    "const fs=require('fs'); fs.mkdirSync('evidence',{recursive:true});fs.appendFileSync('evidence/checks',process.argv[2]+'\\n');if(fs.existsSync('evidence/fail'))process.exit(1);",
  );
  await run('git', ['-C', root, 'add', '.']);
  await run('git', ['-C', root, 'commit', '-m', 'fixture']);
  await run('git', ['-C', root, 'push', 'origin', branch]);
  const commit = (await run('git', ['-C', root, 'rev-parse', 'HEAD'])).stdout.trim();
  await mkdir(join(storyDir, 'artifacts'), { recursive: true });
  await writeFile(
    join(storyDir, 'meta.md'),
    `---\nid: ${storyId}\nslug: ${slug}\nstatus: active\nlock: none\n---\n`,
  );
  await writeFile(join(storyDir, 'tasks.md'), '- [x] Finished the story\n');
  await run('git', ['-C', brains, 'add', '.']);
  await run('git', ['-C', brains, 'commit', '-m', 'fixture']);
  await run('git', ['-C', brains, 'push', 'origin', 'omega-factory']);
  const launcher = join(dir, 'claude-fixture');
  await writeFile(
    launcher,
    `#!${process.execPath}\nconst fs=require('fs'), cp=require('child_process');\nconst prompt=process.argv[3];if(!prompt.startsWith('/kido code ${storyId} --task '))process.exit(1);\nconst op=prompt.match(/wish-operation:([a-f0-9-]+)/)[1];\nfs.writeFileSync(${JSON.stringify(join(storyDir, 'artifacts'))}+'/kido-code-run-fixture.md','wish-operation:'+op+'\\nhttps://claude.ai/code/session_fixture');\nfor(const args of [['add',${JSON.stringify(path)}],['commit','-m','dispatch'],['push','origin','omega-factory']]){const r=cp.spawnSync('git',['-C',${JSON.stringify(brains)},...args]);if(r.status)process.exit(1);}\nconsole.log(JSON.stringify({is_error:false,result:'dispatched'}));\n`,
    { mode: 0o700 },
  );
  await mkdir(join(skill, 'scripts'), { recursive: true });
  await writeFile(
    join(skill, 'scripts/kido-deploy.py'),
    `import sys,pathlib\nroot=pathlib.Path(sys.argv[sys.argv.index('--root')+1])\nif '--dry-run' not in sys.argv: (root/'evidence'/'deployed').write_text('dev')\nprint('kido-deploy receipt\\n  env      dev\\n  command  fixture-deploy-dev\\n  exit     '+('dry-run' if '--dry-run' in sys.argv else '0'))\n`,
  );
  const config = {
    WISH_WORKER_HOST: 'claude-code',
    WISH_DEPLOY_DEV: '1',
    WISH_DEV_DEPLOY_COMMAND: 'fixture-deploy-dev',
    WISH_CLAUDE_BIN: launcher,
  };
  const stages = claudeStages({ root, brains, project: 'omega-factory', skill, config });
  const wish = { id, story: { id: storyId, slug, path }, worker: { receipts: {} } };
  const op = randomUUID();
  const dispatch = await stages.dispatch(wish, op);
  assert.equal(dispatch.sessionUrl, 'https://claude.ai/code/session_fixture');
  assert.deepEqual(await stages.recover(wish, 'dispatch', op), dispatch);
  wish.worker.receipts.develop = await stages.develop(wish);
  assert.equal(wish.worker.receipts.develop.commit, commit);
  wish.worker.receipts.validate = await stages.validate(wish, randomUUID());
  const build = join(root, 'var/worker-checkouts', id);
  assert.equal(
    await readFile(join(build, 'evidence/checks'), 'utf8'),
    'check\ntest\ntest:e2e\nbuild\n',
  );
  const denied = claudeStages({
    root,
    brains,
    project: 'omega-factory',
    skill,
    config: { ...config, WISH_DEV_DEPLOY_COMMAND: 'different-command' },
  });
  await assert.rejects(denied.deploy(wish, randomUUID()), /approved/);
  assert.ok(!(await readdir(join(build, 'evidence'))).includes('deployed'));
  const deployment = randomUUID();
  const receipt = await stages.deploy(wish, deployment);
  assert.equal(receipt.environment, 'dev');
  assert.equal(receipt.commit, commit);
  assert.equal(await readFile(join(build, 'evidence/deployed'), 'utf8'), 'dev');
  assert.deepEqual(await stages.recover(wish, 'deploy', deployment), receipt);
  await writeFile(join(build, 'evidence/fail'), 'fail');
  await assert.rejects(stages.validate(wish, randomUUID()));
});
