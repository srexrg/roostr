import type { AgentName } from '../core/types.js';
import { RoostrError } from '../core/errors.js';
import type { AgentRecipe } from './recipe.js';
import { claudeCodeRecipe } from './claude-code.js';
import { codexRecipe } from './codex.js';

export function getAgentRecipe(name: AgentName): AgentRecipe {
  if (name === 'claude-code') return claudeCodeRecipe;
  if (name === 'codex') return codexRecipe;
  throw new RoostrError(`agent ${name} not supported yet`, { phase: 'agent', hint: 'use claude-code' });
}
