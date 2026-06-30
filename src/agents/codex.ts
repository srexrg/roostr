import type { AgentRecipe, CloudInitFragment } from './recipe.js';

export const codexRecipe: AgentRecipe = {
  name: 'codex',
  fragment({ username }): CloudInitFragment {
    return { runcmd: [`su - ${username} -c 'curl -fsSL https://chatgpt.com/codex/install.sh | sh'`] };
  },
  firstRunHint(): string {
    return 'Set OPENAI_API_KEY (export OPENAI_API_KEY=<your key>) then run `codex`. For a ChatGPT account, run `codex login`.';
  },
};
