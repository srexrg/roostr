# roostr

> Spin up a hardened, agent-ready VPS on **your own** cloud account in one command - and tear it down just as fast.

`roostr` is a small CLI for the workflow people keep rebuilding by hand: move your coding agents (Claude Code, Codex) off your laptop and onto a persistent remote box you can reach from anywhere, so work keeps running even with the lid closed.

It is **a tool, not a middleman.** It runs entirely on your machine, uses *your* cloud provider token and *your* agent subscription, and never routes anything through infrastructure operated by anyone else. You bring the provider; roostr does the tedious, error-prone setup.

## Status

roostr is built in stages. What works **today**:

- ✅ **DigitalOcean** provisioning - `up` / `status` / `destroy`
- ✅ Hardened boxes - non-root user, root + password SSH disabled, swap, key-only auth
- ✅ Firewall locked to **your** IP (port 22 only), nothing else inbound - or zero exposed ports via Tailscale
- ✅ Readiness polling - `up` returns only once the box is actually reachable
- ✅ Reconciled `status` with drift detection + a monthly cost estimate
- ✅ Secrets kept out of config and off your shell history
- ✅ **Tailscale** connectivity - zero exposed ports; reach your box from your phone, laptop, or anywhere on your tailnet
- ✅ **Claude Code** installed on the box at provision time - authenticated via token injection or interactive browser flow
- ✅ `roostr ssh` - drops you straight into a persistent `tmux` session on the box

**Note:** Tailscale mode requires the Tailscale app running on your device (phone or laptop) to connect. Install from [tailscale.com/download](https://tailscale.com/download) and sign in to the same tailnet as your server.

On the roadmap:

- ⏳ **Hetzner** provider (the abstraction is already in place)
- ⏳ **Codex** agent install

## Install

Not yet published to npm. For now, from source (requires [Bun](https://bun.sh)):

```sh
git clone git@github.com:srexrg/roostr.git
cd roostr
bun install
bun link            # makes `roostr` available on your PATH
```

(When published: `npm install -g roostr`.)

## Quickstart

```sh
roostr init                       # pick provider, paste token, set defaults
roostr up --name box-1            # provision a hardened droplet (~2 min)
roostr ssh box-1                  # drop into a persistent tmux session on the box
roostr status                     # live state, public IP, ~cost/mo
roostr destroy box-1 --yes        # delete it - stops billing
```

`init` stores your provider token in your OS keychain (or a `0600` file), never in `config.json` and never in your shell history.

## How it works

```
CLI (commander)
  └─ Orchestrator  ──►  Provider interface  ──►  digitalocean adapter (REST)
        │                                         (registry resolves by name)
        ├─ cloud-init builder   (user + hardening + swap + readiness sentinel)
        ├─ readiness polling    (running → public IP → TCP/22 open)
        └─ local state store    (~/.config/roostr/servers.json, lock-guarded)
```

Everything is provider-agnostic behind a single `Provider` interface - adding a cloud is one new file. Provider statuses are normalized so the orchestrator never branches on a vendor-specific string. The whole test suite runs **offline** against injected fakes - no network, no money.

## Security model

- **You are the only one who holds your credentials.** The provider token is read from your machine and used to call the provider API directly. Nothing phones home.
- **Firewall, per mode:** in Tailscale mode the box has **zero inbound rules** - nothing is exposed to the internet, and you reach it only over your tailnet. In direct mode the firewall opens port 22 to **your current public IP** only, and nothing else.
- cloud-init disables root login and SSH password auth; you log in as a non-root `dev` user with key-only auth.
- A droplet is recorded as `incomplete` the instant it exists - so a half-finished provision is never an untracked, silently-billing orphan.
- **Caveat: secrets in cloud-init.** In Tailscale mode the Tailscale auth key, and the Claude Code setup-token if you provide one, are passed to the box through cloud-init `user_data`, which the provider stores in droplet metadata and is readable from the box itself. For a single-user box on your own account this is low risk, but prefer a **single-use or ephemeral** Tailscale auth key, and note that logging into Claude interactively (`claude`) instead of supplying a token keeps the token off the box's metadata entirely.

## Cost

roostr never spends money in its tests. A real `up` creates a real droplet on your account billed by the hour; a create→use→`destroy` cycle on a small box is a fraction of a cent. `status` reminds you that boxes bill while they exist - destroy them when you're done.

## Development

```sh
bun test            # full suite, offline
bun run src/cli.ts --help
```

TDD throughout; each layer is independently testable behind injected seams (fake `fetch`, fake provider, fake clock/TCP probe).

## License

MIT - see [LICENSE](LICENSE).
