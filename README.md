# roostr

> Spin up a hardened, agent-ready VPS on **your own** cloud account in one command - and tear it down just as fast.

`roostr` is a small CLI for the workflow people keep rebuilding by hand: move your coding agents (Claude Code, Codex) off your laptop and onto a persistent remote box you can reach from anywhere, so work keeps running even with the lid closed.

It is **a tool, not a middleman.** It runs entirely on your machine, uses *your* cloud provider token and *your* agent subscription, and never routes anything through infrastructure operated by anyone else. You bring the provider; roostr does the tedious, error-prone setup.

## What it does

Provision and tear down a hardened **DigitalOcean** box (`up` / `status` / `destroy`), reachable over **Tailscale** with zero public inbound ports, with **Claude Code** and **Codex** installed at provision time. Plus live pricing (`roostr sizes`), phone onboarding (`roostr mobile`), and a preflight check (`roostr doctor`). Boxes are hardened by default - non-root `dev` user with no sudo, key-only OpenSSH, firewall created before the droplet, on-box `ufw`.

See [CHANGELOG.md](CHANGELOG.md) for the full, per-version feature list.

**Roadmap:** Hetzner provider (the provider abstraction is already in place).

**Supported today:** macOS, DigitalOcean, single-user. Linux likely works but is not yet tested end-to-end.

> **Tailscale note:** Tailscale mode needs the [Tailscale](https://tailscale.com/download) app running on your device and signed in to the same tailnet as the box. Apply [`tailscale-acl.hujson`](tailscale-acl.hujson) once to lock down what your devboxes can reach. For the auth key, `roostr init` offers two ways: an **OAuth client** (recommended - roostr auto-mints a fresh, single-use, 30-minute `tag:devbox` key for each box, so nothing long-lived sits in droplet metadata), or **paste a `tag:devbox` key** you mint yourself. Connections use standard key-only OpenSSH over the tailnet (no Tailscale SSH daemon), and Mosh is installed for resilient sessions that survive Wi-Fi/cellular handoffs.

## Install

roostr is not yet on the npm registry. Install from source - it only requires [Bun](https://bun.sh):

```sh
git clone git@github.com:srexrg/roostr.git
cd roostr
bun install         # also builds the binary (prepare hook)
bun run build       # belt-and-suspenders: ensure dist/cli.js exists
bun link            # makes `roostr` available on your PATH

roostr doctor       # confirm prerequisites are in place
```

(Once published, this becomes `npm install -g roostr`.)

### Publishing (maintainers)

```sh
npm pack --dry-run   # inspect the tarball: dist/cli.js, README.md, CHANGELOG.md, LICENSE, package.json
npm publish          # the prepack hook builds dist/ from source first
```

The published package ships the bundled `dist/cli.js` only; `src/`, `tests/`, and internal `docs/` never enter the tarball (enforced by the `files` allowlist in `package.json`).

## Quickstart

New here? You really only need one command:

```sh
roostr init
```

`roostr init` is the guided entry point. It checks your prerequisites and offers to install anything missing (with your confirmation - it generates an SSH key for you, and installs tools like `gh` via Homebrew on macOS), walks you through provider, token, connectivity mode, and agents with a sane default at each step, and at the end offers to provision your first box. Answer the prompts and you finish with a running, reachable machine.

The individual commands, if you want them:

```sh
roostr init                       # guided setup (prerequisites, config, optional first box)
roostr sizes                      # list available sizes and live prices, cheapest first
roostr up --name box-1            # provision a hardened droplet (~2 min)
roostr ssh box-1                  # drop into a persistent tmux session on the box
roostr mobile box-1               # print a QR to connect from your phone
roostr status                     # live state, public IP, live cost/mo from provider catalog
roostr destroy box-1 --yes        # delete it - stops billing
roostr doctor                     # check prerequisites (add --fix to install what is missing)
```

`init` stores your provider token in a `0600` file (`~/.config/roostr/secrets.json`), separate from `config.json` and never in your shell history. You can also supply secrets via environment variables, which take precedence.

## Project source

By default `roostr up` creates a fresh, empty box. You can optionally land a project on the box in two ways:

### Clone a GitHub repo

```sh
roostr up --name box --clone owner/repo     # clone a specific repo
roostr up --name box --clone                # pick from your GitHub repos via local gh
```

The clone runs on the box at boot (via cloud-init), so the repo is already there when you `roostr ssh`. It lands in `~/<repo-name>` (the part after the slash, e.g. `owner/roostr` lands in `~/roostr`).

**Token caveat for private repos:** a private clone needs a GitHub token. roostr reads it from your local `gh` CLI (`gh auth token`) and injects it via cloud-init `user_data` - the same mechanism used for the Tailscale auth key and Claude Code token. The token is stored in droplet metadata and is readable from the box during boot. Prefer a **fine-grained PAT** scoped to just the target repo. After the clone completes, the token is stripped from the box's git remote so it is not persisted in `.git/config`.

### Copy a local folder

```sh
roostr up --name box --copy ./my-project    # rsync a local folder to the box
```

The rsync runs after the box is reachable over the tailnet, and respects `.gitignore` (via `--filter=':- .gitignore'`). The folder lands in `~/<folder-name>` (its basename, e.g. `./my-project` lands in `~/my-project`). This is the first time roostr's controller connects to the box over SSH; a copy failure is **non-fatal** - the box is already up and usable. You will see a warning and the exact rsync command to run manually if it fails.

## Connect from your phone

Once a box is up, connect to it from your phone over the tailnet:

```sh
roostr mobile box-1                              # print a QR code to scan
roostr mobile box-1 --key 'ssh-ed25519 AAAA...'  # also authorize a phone-generated key
```

`roostr mobile` does three things:

- Prints a QR code encoding `ssh://dev@<host>`. Scan it with a mobile SSH client - [Termius](https://termius.com) or [Blink](https://blink.sh) on iOS, [Termux](https://termux.dev) on Android - to add the box.
- If you pass `--key`, it authorizes that public key on the box (appended to the `dev` user's `~/.ssh/authorized_keys`). Generate the key on the phone in your SSH app, copy the **public** key, and paste it here. The key is validated before it is sent, and only ever the public half travels.
- Writes a `~/.ssh/config` block for the box, so `ssh box-1` works from any terminal on your tailnet.

Your phone must have the [Tailscale](https://tailscale.com/download) app installed and joined to the **same tailnet** as the box. The box has no public inbound ports - all connectivity is over Tailscale.

`roostr up` reminds you of this with a `From your phone: roostr mobile <name>` hint in its success output. `roostr destroy` removes the `~/.ssh/config` block it created.

## Troubleshooting

```sh
roostr doctor          # check prerequisites and configuration
roostr doctor --fix    # offer to install whatever is missing
```

`roostr doctor` verifies that the tools roostr leans on are present (`gh` for `--clone`, `tailscale` to connect, `rsync` for `--copy`), that you have an SSH key, and that a provider token is configured. Run it first if anything misbehaves; it prints `[OK]`, `[WARN]`, or `[ERR]` for each check with a hint on how to fix it.

Add `--fix` and roostr offers to resolve each problem for you: it can generate an SSH key with `ssh-keygen`, and on macOS run the Homebrew install for a missing tool - always showing the exact command and asking before it runs anything. On Linux it prints the command for you to run yourself. The same preflight runs automatically at the start of `roostr init`.

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
- **Firewall-at-create, no open window:** roostr creates the DigitalOcean firewall (tagged to the droplet) before creating the droplet. Because enrollment is by tag, the network policy is in effect from the very first packet - there is no window where port 22 is briefly exposed to the internet, even during boot.
- **On-box ufw layer:** a second firewall layer inside the droplet (ufw) restricts SSH to the `tailscale0` interface only. Even if a public IP were somehow reachable, the kernel drops the connection before sshd sees it.
- **Zero public inbound (Tailscale mode):** the box has no inbound rules for public traffic. You reach it exclusively over your tailnet - `roostr ssh <name>` or `ssh dev@<name>` uses key-only OpenSSH tunneled through Tailscale MagicDNS (no Tailscale SSH daemon, standard sshd only).
- **No sudo for `dev`:** cloud-init creates a `dev` user without sudo rights. An agent running arbitrary shell commands cannot escalate to root and cannot install kernel modules, alter firewall rules, or exfiltrate host credentials.
- cloud-init disables root login and SSH password auth. The `dev` user authenticates with your SSH public key only.
- A droplet is recorded as `incomplete` the instant it exists - so a half-finished provision is never an untracked, silently-billing orphan.
- **Tailscale ACL:** apply [`tailscale-acl.hujson`](tailscale-acl.hujson) once in your Tailscale admin console. It scopes `tag:devbox` to accept SSH and Mosh from your own devices only, and the tag never appears as a `src` - a compromised box cannot pivot to the rest of your tailnet. Mint a `tag:devbox` auth key (single-use or ephemeral) to avoid reusable keys in droplet metadata.
- **Caveat: secrets in cloud-init.** The Tailscale auth key, and the Claude Code setup-token if you provide one, are passed through cloud-init `user_data`, which the provider stores in droplet metadata and is readable from the box itself. For a single-user box on your own account this is low risk, but prefer a **single-use or ephemeral** Tailscale auth key, and note that logging into Claude interactively (`claude`) instead of supplying a token keeps the token off the box's metadata entirely.

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
