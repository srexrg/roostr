export class RoostrError extends Error {
  phase: string;
  hint?: string;
  constructor(message: string, opts: { phase: string; hint?: string }) {
    super(message);
    this.name = new.target.name;
    this.phase = opts.phase;
    this.hint = opts.hint;
  }
}

export class ConfigError extends RoostrError {
  constructor(message: string, hint?: string) {
    super(message, { phase: 'config', hint });
  }
}
export class ProviderError extends RoostrError {
  constructor(message: string, hint?: string) {
    super(message, { phase: 'provider', hint });
  }
}
export class ConnectivityError extends RoostrError {
  constructor(message: string, hint?: string) {
    super(message, { phase: 'connectivity', hint });
  }
}
export class SetupError extends RoostrError {
  constructor(message: string, hint?: string) {
    super(message, { phase: 'setup', hint });
  }
}
