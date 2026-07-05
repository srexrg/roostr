# roostr website

Marketing site and setup guide for [roostr](../README.md). Astro, static output, no runtime.

## Develop

```sh
cd site
bun install
bun run dev        # http://localhost:4321
bun run build      # → dist/
bun run preview    # serve the built site
```

## Deploy

Static output, host anywhere. Set the **Root/Base directory** to `site` and Astro's
config files do the rest (`vercel.json`, `netlify.toml`).

Before deploying, set `site` in `astro.config.mjs` to your final domain so canonical
and Open Graph URLs resolve.

## Structure

```
src/
├─ layouts/Base.astro     <head>, fonts, reveal + copy scripts
├─ components/            Nav, Footer, Logo, Terminal, CopyCommand, Callout, Step
│  └─ sections/           Hero, Features, HowItWorks, Security, Commands, CTA
├─ styles/global.css      design tokens (OKLCH color, type scale, motion)
└─ pages/                 index.astro, setup.astro
```
