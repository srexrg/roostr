import type { AgentRecipe, CloudInitFragment } from './recipe.js';

export const claudeCodeRecipe: AgentRecipe = {
  name: 'claude-code',
  fragment({ username, oauthToken }): CloudInitFragment {
    const runcmd: string[] = [
      // Install Claude Code for the non-root user via the official native installer.
      `su - ${username} -c 'curl -fsSL https://claude.ai/install.sh | bash'`,
    ];
    if (oauthToken) {
      runcmd.push(
        `echo 'export CLAUDE_CODE_OAUTH_TOKEN=${oauthToken}' >> /home/${username}/.bashrc`,
        `chown ${username}:${username} /home/${username}/.bashrc`,
      );
    }
    return { runcmd };
  },
  firstRunHint({ hasToken }): string {
    return hasToken
      ? 'Claude Code is authenticated - run `claude` to start.'
      : 'Run `claude`, press `c` to copy the login URL, open it in your browser, then paste the code back.';
  },
};
