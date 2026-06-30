# Changelog

All notable changes to roostr are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com), and this project adheres to
[Semantic Versioning](https://semver.org).

## 0.2.0 - unreleased

First feature-complete cut, in private testing. Not yet published to the npm
registry. roostr provisions a hardened, agent-ready VPS on your own cloud
account and tears it down just as fast.

### Onboarding

- `roostr init` is now a guided first-run flow: it runs a prerequisite preflight, explains each choice with a sensible default, and offers to provision your first box at the end - so a new user can go from install to a running box with one command.
- `roostr doctor --fix` offers to resolve missing prerequisites with your confirmation: it generates an SSH key with `ssh-keygen`, and on macOS runs the Homebrew install for a missing tool. The exact command is always shown, nothing runs without a yes, and on Linux the command is printed for you to run. Manual installs (`sudo`, `curl | sh`) are never auto-run.

### Provisioning

- DigitalOcean provider: `roostr up` / `roostr status` / `roostr destroy`.
- Firewall-at-create (tagged to the droplet) so there is no window where port 22 is exposed, even during boot; plus an on-box `ufw` layer scoped to the Tailscale interface.
- Readiness polling: `up` returns only once the box is actually reachable.
- A droplet is recorded as `incomplete` the instant it exists, so a half-finished provision is never an untracked, silently-billing orphan.
- `roostr status` reconciles local state against the provider with drift detection.

### Hardening

- Non-root `dev` user with no sudo; root login and SSH password auth disabled.
- Key-only OpenSSH (not the Tailscale SSH daemon); swap configured.
- `tailscale-acl.hujson` scopes `tag:devbox` machines to accept SSH and Mosh from your own devices only, and the tag never appears as a source.

### Connectivity

- Tailscale mode: zero public inbound ports. Reach the box over your tailnet with `roostr ssh <name>` or `ssh dev@<name>`.
- `roostr ssh` drops you into a persistent `tmux` session on the box.

### Agents

- Claude Code installed at provision time, authenticated via token injection or interactive browser flow.
- Codex installed at provision time when selected in `roostr init`; authenticate by exporting `OPENAI_API_KEY` or running `codex login`.

### Project source

- `roostr up --clone owner/repo` (or `--clone` to pick interactively) clones a GitHub repo onto the box at boot. Private repos read a token from your local `gh` CLI; the token is stripped from the box's git remote after clone.
- `roostr up --copy ./folder` rsyncs a local folder onto the box, respecting `.gitignore`. A copy failure is non-fatal.

### Pricing

- `roostr sizes` lists live server sizes and prices for a provider, cheapest first.
- `roostr up` validates the requested size and region against the live catalog before creating anything, with an early error pointing to `roostr sizes`.
- `roostr status` shows live monthly cost fetched from the provider catalog, not a static estimate.

### Mobile onboarding

- `roostr mobile <name>` prints a QR code to connect from your phone and adds a `~/.ssh/config` block so `ssh <name>` works from any terminal on your tailnet.
- `roostr mobile <name> --key <pubkey>` authorizes a phone-generated SSH public key on the box.

### Diagnostics

- `roostr doctor` checks prerequisites (`gh`, `tailscale`, `rsync`, an SSH key, a configured provider token) and reports what is missing.

### Security and secrets

- Provider token read from your machine and used to call the provider API directly. Nothing phones home.
- Secrets stored in your OS keychain or a `0600` file, never in `config.json` and never in your shell history.
