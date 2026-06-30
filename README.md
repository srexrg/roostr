# roostr

[![npm version](https://img.shields.io/npm/v/roostr.svg)](https://www.npmjs.com/package/roostr)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Spin up a hardened, agent-ready VPS on **your own** cloud account in one command - and tear it down just as fast.

Move your coding agents (Claude Code, Codex) off your laptop and onto a persistent remote box you can reach from anywhere - your phone included - so work keeps running with the lid closed.

roostr is **a tool, not a middleman.** It runs entirely on your machine, uses *your* cloud token and *your* agent subscription, and never routes anything through infrastructure operated by anyone else. You bring the provider; roostr does the tedious, error-prone setup.

> **New here? Start with [SETUP.md](SETUP.md)** - a complete, beginner-friendly walkthrough from zero to connecting from your phone (DigitalOcean token, full Tailscale setup, the lot). This README is the quick reference.

## Highlights

- **One command** - `roostr init` checks prerequisites, configures everything, and provisions your first box.
- **Hardened by default** - non-root `dev` user (no sudo), key-only OpenSSH, firewall created *before* the droplet, on-box `ufw`.
- **Private by default** - reachable only over your Tailscale tailnet, with zero public inbound ports.
- **Reach it from your phone** - `roostr mobile` plus a persistent `tmux` session that follows you between devices.
- **Agents preinstalled** - Claude Code (and optionally Codex) set up at provision time.
- **Live pricing** - pick region and size from the real provider catalog, cheapest first.
- **Minimal secret exposure** - only a short-lived, single-use Tailscale key ever reaches the box's metadata.

**Supported today:** macOS, DigitalOcean, single-user. (Linux likely works but is not yet tested end to end; Hetzner is on the roadmap.)

## Install

```sh
npm install -g roostr
roostr doctor      # confirm prerequisites are in place
```

Or from source (requires [Bun](https://bun.sh)):

```sh
git clone git@github.com:srexrg/roostr.git
cd roostr
bun install      # also builds the CLI
bun link         # puts `roostr` on your PATH
```

## Quickstart

```sh
roostr init                  # guided: prerequisites, config, and your first box
roostr ssh box-1             # drop into a persistent tmux session on the box
roostr mobile box-1          # connect from your phone (prints a card + QR)
roostr status                # live state, public IP, cost/mo from the provider catalog
roostr destroy box-1 --yes   # delete it - stops billing
```

`roostr init` is the guided entry point: it offers to install anything missing, walks you through provider, token, region/size (live, cheapest-first), connectivity, and agents, then provisions your first box. For the full first-run guide including Tailscale, see **[SETUP.md](SETUP.md)**.

Secrets (your provider token, Tailscale credentials) are stored in a `0600` file at `~/.config/roostr/secrets.json`, separate from `config.json` and never in your shell history. Environment variables override the file.

### Commands

| Command | What it does |
|---|---|
| `roostr init` | Guided setup: prerequisites, config, optional first box |
| `roostr up --name <n>` | Provision a hardened box (`--clone owner/repo`, `--copy ./dir`) |
| `roostr ssh <n>` | Connect, landing in a persistent `tmux` session |
| `roostr mobile <n>` | Authorize a phone key and print a connection card + QR |
| `roostr status` | Live state, IP, and monthly cost from the catalog |
| `roostr sizes` | List live sizes and prices, cheapest first |
| `roostr destroy <n> --yes` | Delete the box and stop billing |
| `roostr doctor [--fix]` | Check prerequisites (and offer to install them) |

## Project source

By default `roostr up` creates a fresh, empty box. You can land a project on it two ways:

```sh
roostr up --name box --clone owner/repo     # clone a GitHub repo
roostr up --name box --clone                # pick from your GitHub repos via local gh
roostr up --name box --copy ./my-project    # rsync a local folder
```

Both run from roostr over SSH once the box is reachable, so the project is there by the time `up` finishes; a failure is non-fatal (the box stays up). A repo lands in `~/<repo-name>`, a folder in `~/<folder-name>`.

**Private repos:** the GitHub token (read from your local `gh` CLI) is **never placed in cloud-init or droplet metadata** - it travels over the SSH session into a transient, command-scoped git credential helper, so it never appears in the clone URL, the process arguments, or `.git/config`.

To push a folder to a box that is *already running*, use plain rsync over the tailnet:

```sh
rsync -az --filter=':- .gitignore' ./my-folder dev@box-1:~/
```

## Connect from your phone

Once a box is up, authorize your phone and connect over the tailnet:

```sh
roostr mobile box-1 --sshid <your-handle>        # authorize your Termius SSH ID keys (no copy-paste)
roostr mobile box-1 --key 'ssh-ed25519 AAAA...'  # or paste a phone-generated public key
roostr mobile box-1                              # just (re)print the connection card + QR
```

`roostr mobile` authorizes your phone's SSH key on the box, prints a connection card (host, user, Mosh, QR), and writes a `~/.ssh/config` block so `ssh box-1` also works from this machine. You do **not** need to set a startup command - the box **auto-attaches the persistent `roostr` tmux session** on any interactive SSH login, so you connect straight into your running work. **Mosh** is installed, so enable it in your SSH app and the session survives Wi-Fi/cellular handoffs.

Your phone needs the [Tailscale](https://tailscale.com/download) app installed and on the **same tailnet**. The box has no public inbound ports - all connectivity is over Tailscale. See [SETUP.md](SETUP.md) for the step-by-step phone walkthrough.

## How it works

```
CLI (commander)
  └─ Orchestrator  ──►  Provider interface  ──►  digitalocean adapter (REST)
        │                                         (registry resolves by name)
        ├─ cloud-init builder   (user + hardening + swap + readiness sentinel)
        ├─ readiness polling    (running → public IP → TCP/22 open)
        └─ local state store    (~/.config/roostr/servers.json, lock-guarded)
```

Everything is provider-agnostic behind a single `Provider` interface - adding a cloud is one new file, and the orchestrator never branches on a vendor string. The whole test suite runs **offline** against injected fakes: no network, no money.

## Security model

- **You hold your credentials.** The provider token is read from your machine and used to call the provider API directly. Nothing phones home.
- **Firewall-at-create, no open window.** roostr creates the (tagged) DigitalOcean firewall *before* the droplet, so the network policy is in effect from the first packet - port 22 is never briefly exposed, even during boot.
- **On-box `ufw` layer.** A second firewall inside the box restricts SSH to the `tailscale0` interface only.
- **Zero public inbound (Tailscale mode).** You reach the box exclusively over your tailnet with key-only OpenSSH through MagicDNS - no Tailscale SSH daemon, standard `sshd` only.
- **No sudo for `dev`.** An agent running arbitrary shell cannot escalate to root, alter the firewall, or exfiltrate host credentials. Root login and SSH password auth are disabled.
- **Half-finished provisions are tracked.** A droplet is recorded the instant it exists, so a failed provision is never an untracked, silently-billing orphan.
- **Tailscale ACL.** Apply [`tailscale-acl.hujson`](tailscale-acl.hujson) once; it scopes `tag:devbox` to your own devices and the tag is never a `src`, so a compromised box cannot pivot across your tailnet.
- **Minimal secrets in metadata.** The only secret that reaches the box via cloud-init `user_data` is the Tailscale auth key, and with the OAuth-client option it is single-use and expires in 30 minutes. It is validated and shell-quoted before it is ever placed in a command. Nothing else touches metadata: Claude logs in interactively on the box (no token is ever injected), and private-clone tokens travel over the SSH session.

## Cost

roostr never spends money in its tests. A real `up` creates a droplet billed by the hour; a create → use → `destroy` cycle on a small box is a fraction of a cent. `status` reminds you that boxes bill while they exist - destroy them when you are done.

## Development

```sh
bun test                  # full suite, offline
bun run src/cli.ts --help # run the CLI from source
bunx tsc --noEmit         # typecheck
```

TDD throughout; each layer is independently testable behind injected seams (fake `fetch`, fake provider, fake clock/TCP probe).

### Publishing (maintainers)

```sh
npm pack --dry-run   # inspect the tarball (dist/cli.js + README, SETUP, CHANGELOG, LICENSE, package.json)
npm publish          # the prepack hook builds dist/ from source first
```

The published package ships the bundled `dist/cli.js` only; `src/`, `tests/`, and internal `docs/` never enter the tarball (enforced by the `files` allowlist in `package.json`).

## License

MIT - see [LICENSE](LICENSE).
