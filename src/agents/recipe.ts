import type { AgentName } from '../core/types.js';

export interface CloudInitFragment {
  packages?: string[];
  runcmd?: string[];
}

export interface AgentRecipe {
  name: AgentName;
  fragment(opts: { username: string }): CloudInitFragment;
  firstRunHint(): string;
}
