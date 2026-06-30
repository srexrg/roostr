import type { AgentRecipe, CloudInitFragment } from './recipe.js';

export const claudeCodeRecipe: AgentRecipe = {
  name: 'claude-code',
  fragment({ username }): CloudInitFragment {
    return { runcmd: [`su - ${username} -c 'curl -fsSL https://claude.ai/install.sh | bash'`] };
  },
  firstRunHint(): string {
    return 'Run `claude`, press `c` to copy the login URL, open it in your browser, then paste the code back.';
  },
};
