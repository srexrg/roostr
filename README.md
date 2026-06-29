# roostr

> Spin up a hardened, agent-ready VPS on **your own** cloud account in one command — and tear it down just as fast.

`roostr` is a small CLI for the workflow people keep rebuilding by hand: move your coding agents (Claude Code, Codex) off your laptop and onto a persistent remote box you can reach from anywhere, so work keeps running even with the lid closed.

It is **a tool, not a middleman.** It runs entirely on your machine, uses *your* cloud provider token and *your* agent subscription, and never routes anything through infrastructure operated by anyone else. You bring the provider; roostr does the tedious, error-prone setup.

## Status

roostr is built in stages. What works **today**:

- ✅ **DigitalOcean** provisioning — `up` / `status` / `destroy`
- ✅ Hardened boxes — non-root user, root + password SSH disabled, swap, key-only auth
- ✅ Firewall locked to **your** IP (port 22 only), nothing else inbound
- ✅ Readiness polling — `up` returns only once the box is actually reachable
- ✅ Reconciled `status` with drift detection + a monthly cost estimate
- ✅ Secrets kept out of config and off your shell history

On the roadmap:

- ⏳ **Tailscale** as the default connectivity (zero exposed ports, reach it from your phone)
- ⏳ **Agent install** on the box — Claude Code + Codex, ready to log into
- ⏳ A `roostr ssh` command that drops you straight into a persistent `tmux` session
- ⏳ **Hetzner** provider (the abstraction is already in place)

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
ssh dev@<ip it prints>           # you're on the box, as a non-root user
roostr status                     # live state, public IP, ~cost/mo
roostr destroy box-1 --yes        # delete it — stops billing
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

Everything is provider-agnostic behind a single `Provider` interface — adding a cloud is one new file. Provider statuses are normalized so the orchestrator never branches on a vendor-specific string. The whole test suite runs **offline** against injected fakes — no network, no money.

## Security model

- **You are the only one who holds your credentials.** The provider token is read from your machine and used to call the provider API directly. Nothing phones home.
- Boxes are created with a deny-all-but-SSH firewall scoped to **your current public IP**, not the box's.
- cloud-init disables root login and SSH password auth; you log in as a non-root `dev` user with key-only auth.
- A droplet is recorded as `incomplete` the instant it exists — so a half-finished provision is never an untracked, silently-billing orphan.

## Cost

roostr never spends money in its tests. A real `up` creates a real droplet on your account billed by the hour; a create→use→`destroy` cycle on a small box is a fraction of a cent. `status` reminds you that boxes bill while they exist — destroy them when you're done.

## Development

```sh
bun test            # full suite, offline
bun run src/cli.ts --help
```

TDD throughout; each layer is independently testable behind injected seams (fake `fetch`, fake provider, fake clock/TCP probe).

## License

MIT — see [LICENSE](LICENSE).
