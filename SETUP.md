# roostr setup guide

A complete, step-by-step walkthrough - from nothing to a hardened box you can reach from your laptop and your phone. No prior DevOps knowledge assumed. Take it top to bottom.

By the end you will have:
- A small Linux box running on your own DigitalOcean account.
- Claude Code installed on it.
- Private access over Tailscale (no public ports) from your laptop and your phone.
- A persistent `tmux` session so your work follows you between devices.

A create-use-destroy cycle on the smallest box costs a fraction of a cent. Destroy it when you are done and billing stops.

---

## What you need before you start

Two accounts (both have free tiers) and two apps. roostr can install the rest for you.

- **A DigitalOcean account** - https://www.digitalocean.com (new accounts get signup credit).
- **A Tailscale account** - https://tailscale.com (free for personal use).
- **The Tailscale app on your laptop** - https://tailscale.com/download
- **An SSH app on your phone** - Termius (https://termius.com) is what this guide uses.

You also need **[Bun](https://bun.sh)** to install roostr from source (until it is on npm).

---

## Step 1 - Install roostr

```sh
git clone git@github.com:srexrg/roostr.git
cd roostr
bun install            # also builds the CLI
bun link               # puts `roostr` on your PATH
roostr --version       # should print a version number
```

Check your environment (optional, but nice):

```sh
roostr doctor          # lists what is present; `roostr doctor --fix` offers to install what is missing
```

---

## Step 2 - Get a DigitalOcean API token

This is the credential roostr uses to create the box on your account.

1. Open https://cloud.digitalocean.com/account/api/tokens
2. Click **Generate New Token**.
3. Name it `roostr`.
4. **Scope: choose Full Access** (read-only cannot create a box).
5. Click **Generate Token** and **copy it now** - DigitalOcean shows it only once. Keep it handy for Step 5.

---

## Step 3 - Set up Tailscale (the private network)

Tailscale is what makes your box reachable privately, with no ports open to the internet. This step has three parts. Do them in order.

### 3a. Apply the access policy (once)

1. Open https://login.tailscale.com/admin/acls
2. Copy the contents of [`tailscale-acl.hujson`](tailscale-acl.hujson) (in this repo) and paste it into the editor.
3. Click **Save**.

This defines a tag called `tag:devbox` and locks down what your boxes can reach. You only ever do this once.

### 3b. Create a Tailscale OAuth client (recommended)

This lets roostr mint a fresh, short-lived key for each box automatically, so you never paste keys by hand.

1. Open https://login.tailscale.com/admin/settings/oauth
2. Click **Generate OAuth client**.
3. Description: `roostr`.
4. In the list of scopes, find **Auth Keys** (under the Keys group) and set it to **Write**.
5. When you enable that, a **tags** selector appears - pick **`tag:devbox`**. (This works because you applied the policy in 3a.)
6. Click **Generate client**.
7. Copy the **Client ID** and the **Client secret** (the secret is shown only once). Keep both for Step 5.

> Prefer not to do OAuth? You can instead mint a single key: https://login.tailscale.com/admin/settings/keys -> Generate auth key -> enable **Tags** = `tag:devbox`, turn **Reusable** off -> copy the `tskey-...`. In Step 5 choose "Paste an auth key" and paste it. (You then mint a new key for each box; OAuth does it for you.)

### 3c. Run Tailscale on your laptop

Install from https://tailscale.com/download, sign in with the **same** Tailscale account, and make sure it shows **Connected**. Verify in a terminal:

```sh
tailscale status       # should list your laptop
```

This is required so your laptop can reach the box by name later.

---

## Step 4 - (you are ready) gather what you copied

Before running setup, have these in front of you:
- DigitalOcean API token (Step 2)
- Tailscale OAuth **Client ID** and **Client secret** (Step 3b)

---

## Step 5 - Run the guided setup

```sh
roostr init
```

It walks you through each choice. Here is what to pick:

1. **Cloud provider** -> `DigitalOcean`
2. **API token** -> paste your DigitalOcean token. roostr validates it immediately; a wrong or low-scope token is rejected and re-asked.
3. **Region** -> pick the one nearest you from the live list.
4. **Server size** -> the cheapest (e.g. `s-1vcpu-1gb`) is fine to start. The list shows specs and price.
5. **Connectivity mode** -> `tailscale` (recommended - private, reachable from your phone).
6. **Tailscale authentication** -> `OAuth client (recommended)` -> paste the **Client ID**, then the **Client secret**.
7. **Agents to install** -> `claude-code` (press space to toggle, enter to confirm).
8. **How should Claude Code authenticate** -> `Log in on the box (recommended)`.
9. **SSH public key path** -> accept the default. If you do not have a key, roostr offers to generate one.
10. **Provision your first box now?** -> `Yes`, then name it `box-1`.

It provisions in 2-3 minutes and prints how to connect.

---

## Step 6 - Connect from your laptop

```sh
roostr ssh box-1
```

You land directly in a persistent `tmux` session on the box. Try:

```sh
whoami                 # prints: dev
claude                 # press `c` to copy the login URL, open it in a browser, paste the code back
```

Run a prompt to confirm Claude works. To leave the session running and disconnect: press **Ctrl-b**, then **d** (detach). The session keeps running on the box.

---

## Step 7 - Connect from your phone

You only set this up once. After that it is open-app-and-tap.

### 7a. Put your phone on the tailnet

Install the **Tailscale app**, sign in with the **same** account, and turn it on. (That is the only way the phone can reach a private box.)

### 7b. Make a key in Termius

1. Install **Termius** from your app store and open it.
2. Go to **Keychain** -> **+** -> **Generate Key** -> type **ED25519** -> Save.
3. Open that key -> tap **Export or share a public key** -> send it to yourself (email, notes, any message you can open on your laptop). Copy the whole line; it starts with `ssh-ed25519 AAAA...`.

### 7c. Authorize the phone key on the box

On your laptop:

```sh
roostr mobile box-1 --key 'ssh-ed25519 AAAA...the entire key...'
```

You should see `authorized your phone key on the box` and a connection card.

> Smoother alternative: if you enable **SSH ID** in Termius (Settings -> account), your keys publish at `sshid.io/<handle>` and you can run `roostr mobile box-1 --sshid <handle>` instead - no copy-paste.

### 7d. Add the box in Termius and connect

1. Termius -> **+** -> **New Host**.
2. **Address:** `box-1`   **Username:** `dev`   **Key:** the key you made in 7b.
3. (Optional) enable **Mosh** - keeps the session alive when you switch Wi-Fi/data.
4. Save -> tap the host.

You land in the **same `tmux` session** as your laptop. No startup command needed - the box auto-attaches it. Start something on the laptop, close the lid, pick it up on the phone - it is right there.

(The QR code that `roostr mobile` prints just encodes the address. On Android Termius it is simpler to add the host by hand as above.)

---

## Step 8 - Do real work

- **Run Claude:** just `claude` inside the session. It runs on the box, not your device.
- **Copy a local folder to a running box:** roostr's `--copy` runs at provision time, so for a box that is already up, use rsync from your laptop:
  ```sh
  rsync -az --filter=':- .gitignore' ./my-folder dev@box-1:~/
  ```
  It lands in `~/my-folder` on the box. (Drop the `--filter` part if the folder has no `.gitignore`.)
- **Start a box with a project already on it (next time):**
  ```sh
  roostr up --name box-2 --clone owner/repo     # clone a git repo onto the box
  roostr up --name box-2 --copy ./my-folder     # or copy a local folder
  ```

---

## Step 9 - Tear it down (stops billing)

```sh
roostr destroy box-1 --yes
```

This deletes the box from DigitalOcean and removes it from your local state. Do this whenever you are done - the box bills by the hour while it exists.

---

## Troubleshooting

- **`roostr init` does not show an option I expected (e.g. the OAuth choice).** You are running an old build. Rebuild and reinstall:
  ```sh
  cd /path/to/roostr && bun install && bun link      # or: npm pack && npm install -g ./roostr-*.tgz
  ```
- **Phone says "Connection refused".** Tailscale is not on/connected on the phone. Open the Tailscale app and toggle it on. Check the laptop too: `tailscale status`.
- **Phone (or laptop) says "Permission denied".** The key you are connecting with is not authorized on the box. Re-run `roostr mobile box-1 --key '...'` with that device's public key.
- **`tag not owned` when creating the OAuth client.** The access policy (Step 3a) was not saved. Re-apply `tailscale-acl.hujson`.
- **Token rejected during `roostr init`.** The DigitalOcean token is wrong or lacks Write scope. Generate a new Full Access token (Step 2).
- **`roostr doctor`** is your friend - run it any time to see what is missing, and `roostr doctor --fix` to install it.

---

That is the whole journey. Once set up, your day-to-day is just: `roostr up` -> work from anywhere -> `roostr destroy`.
