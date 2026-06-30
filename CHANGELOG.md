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
- `roostr init` picks region and size from the live provider catalog: region first, then the sizes available there, cheapest first, with specs and price shown inline and a "show all (type to filter)" option. If the catalog cannot load (offline, or a provider without one), it falls back to free-text entry so setup never blocks.
- `roostr init` validates the API token before continuing (the catalog fetch doubles as the probe): a rejected token (HTTP 401/403, e.g. wrong scope) is reported and re-prompted, while an offline or non-auth failure does not block setup. It also prints provider-specific guidance (the console URL and required token scope) before asking for the token.
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
- `roostr ssh` drops you into a persistent `tmux` session on the box. Any interactive SSH login auto-attaches the same `roostr` session (via `/etc/profile.d`, guarded to TTY logins), so a phone connects straight into your running work with no startup command to configure.
- Tailscale auth via an OAuth client (recommended): `roostr init` can take a Tailscale OAuth client id/secret and `roostr up` auto-mints a fresh single-use, `tag:devbox`, 30-minute auth key for each box, so no long-lived key sits in droplet metadata. Pasting a `tag:devbox` key you mint yourself still works.
- Mosh is installed on the box and allowed through `ufw` on the `tailscale0` interface (UDP 60000-61000), so phone sessions survive Wi-Fi/cellular handoffs. The box joins the tailnet with `--accept-dns`.

### Agents

- Claude Code installed at provision time. `roostr init` defaults to interactive login on the box (paste-code over SSH, no token in metadata); pasting a setup-token is an opt-in, clearly-labeled alternative.
- Codex installed at provision time when selected in `roostr init`; authenticate by exporting `OPENAI_API_KEY` or running `codex login`.

### Project source

- `roostr up --clone owner/repo` (or `--clone` to pick interactively) clones a GitHub repo onto the box over SSH once it is reachable (not via cloud-init). For private repos the GitHub token from your local `gh` CLI travels over the SSH session into a transient credential helper - it never enters cloud-init/droplet metadata, the clone URL, or `.git/config`. A clone failure is non-fatal.
- `roostr up --copy ./folder` rsyncs a local folder onto the box, respecting `.gitignore`. A copy failure is non-fatal.

### Pricing

- `roostr sizes` lists live server sizes and prices for a provider, cheapest first.
- `roostr up` validates the requested size and region against the live catalog before creating anything, with an early error pointing to `roostr sizes`.
- `roostr status` shows live monthly cost fetched from the provider catalog, not a static estimate.

### Mobile onboarding

- `roostr mobile <name>` prints a connection card (host, user, Mosh, QR) and adds a `~/.ssh/config` block so `ssh <name>` works from any terminal on your tailnet.
- `roostr mobile <name> --sshid <handle>` fetches your published Termius SSH ID keys from `sshid.io` and authorizes them on the box - no key copy-paste.
- `roostr mobile <name> --key <pubkey>` authorizes a phone-generated SSH public key on the box.
- Combined with tmux auto-attach, the phone path is: authorize once, then open your SSH app and tap the host to land straight in your session.

### Diagnostics

- `roostr doctor` checks prerequisites (`gh`, `tailscale`, `rsync`, an SSH key, a configured provider token) and reports what is missing.

### Security and secrets

- Provider token read from your machine and used to call the provider API directly. Nothing phones home.
- Secrets stored in a `0600` file (`secrets.json`), separate from `config.json` and never in your shell history; environment variables override.
- Minimal cloud-init exposure: the only secret that reaches droplet metadata is the Tailscale auth key (single-use, 30-minute when auto-minted). Claude auth defaults to interactive on-box login, and private-repo clone tokens travel over SSH, so neither touches metadata.
