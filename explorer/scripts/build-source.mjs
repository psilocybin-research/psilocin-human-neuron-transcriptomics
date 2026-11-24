import {execFileSync} from 'node:child_process';
import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export function publicRepository(remote) {
  const match = remote.match(/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/);
  return match ? `https://github.com/${match[1]}` : null;
}

export function buildSource(root, env = process.env) {
  const canonical = 'https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics';
  if (env.ATLAS_SOURCE_COMMIT !== undefined) {
    if (!/^[a-f0-9]{40}$/.test(env.ATLAS_SOURCE_COMMIT) || !['true','false'].includes(env.ATLAS_SOURCE_DIRTY)) {
      throw Error('Archive builds require a full ATLAS_SOURCE_COMMIT and explicit ATLAS_SOURCE_DIRTY=true/false');
    }
    const repository = env.ATLAS_SOURCE_REPOSITORY ? publicRepository(env.ATLAS_SOURCE_REPOSITORY) : canonical;
    if (!repository) throw Error('ATLAS_SOURCE_REPOSITORY must name a public GitHub repository');
    return {commit: env.ATLAS_SOURCE_COMMIT, dirty: env.ATLAS_SOURCE_DIRTY === 'true', repository};
  }
  const options = {cwd:fileURLToPath(root),encoding:'utf8',stdio:['ignore','pipe','pipe']};
  const git = (...args) => execFileSync('git',args,options).trim();
  if (realpathSync(git('rev-parse','--show-toplevel')) !== realpathSync(new URL('../',root))) {
    throw Error('Supply verified archive source metadata outside the atlas checkout');
  }
  // The parent scientific repository does not track the curated website package.
  git('ls-files','--error-unmatch','package.json','scripts/prepare-network-3d.mjs');
  let remote = canonical;
  try { remote = git('config','--get','remote.origin.url'); } catch { /* A local checkout may have no remote. */ }
  const repository = publicRepository(remote) || canonical;
  const commit = git('rev-parse','HEAD');
  if (env.GITHUB_SHA && commit !== env.GITHUB_SHA) throw Error('Build revision differs from the workflow revision');
  return {commit,dirty:Boolean(git('status','--porcelain','--untracked-files=no')),repository};
}
