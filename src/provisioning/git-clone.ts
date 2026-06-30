import type { CloudInitFragment } from '../agents/recipe.js';

export function cloneFragment(opts: { repo: string; username: string; githubToken?: string }): CloudInitFragment {
  const { repo, username, githubToken } = opts;
  const name = repo.split('/')[1];
  const dest = `/home/${username}/${name}`;
  const cleanUrl = `https://github.com/${repo}`;
  const cloneUrl = githubToken ? `https://x-access-token:${githubToken}@github.com/${repo}` : cleanUrl;
  const runcmd = [`su - ${username} -c 'git clone ${cloneUrl} ${dest}'`];
  if (githubToken) {
    // strip the token from the persisted remote so it does not live in .git/config on the box
    runcmd.push(`su - ${username} -c 'git -C ${dest} remote set-url origin ${cleanUrl}'`);
  }
  return { runcmd };
}
