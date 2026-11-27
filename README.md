# Nanograms Foundation — The Campus

A walkable, breakable campus for the [Nanograms Foundation](https://nanograms-foundation.muontau.chatgpt.site/). Five wings, twenty-two sculptures, and a plaque beside each one. The monuments are rigid-body assemblies: they hold their pose until a power hits them, then they fracture, collide, and scatter. Restoration is part of the visit.

The writing follows the Foundation’s own voice — ceremonial, warm, and plain about what is a prototype and what is a myth. Plaques link out to the real Studio, Observatory, Nook, Mercy Engine, Paragon, and Squad pages.

Play it on GitHub Pages: [https://muonntau.github.io/Nanograms-Foundation/](https://muonntau.github.io/Nanograms-Foundation/)

## Run locally

```bash
npm install
npm run dev
```

The dev server listens on port **47321**. `npm run build` typechecks and writes `dist/`. Preview that folder with `npm run preview`.

Asset URLs are relative to Vite’s `base` (`./`), so the same build loads textures, the sunset HDRI, models, audio, and scripts from a local server or from the GitHub Pages subpath.

## GitHub Pages

Pushes to `main` run `.github/workflows/deploy.yml`: Node 20, `npm ci`, `npm run build`, then deploy `dist/` with GitHub’s Pages actions.

In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. The first successful run publishes the campus at the URL above.

## Wings

- **Grand Terrace** — the amber gateway, Agency, Evidence, and the compass of three expressions.
- **Nanogram Studio** — Wilds Reborn, the eight affinities, the Genesis Atelier, The Pod, The Living Frame, and The Infinite Deck.
- **E&G Observatory** — Differentiality (`z = 1/E`), Phased Universes, the No-Harm Lattice, and the Threefold Cosmos.
- **Mirthea’s Nook** — tea and paradox, the star chart, and the Eightfold Lantern.
- **Mercy & Paragon** — the Creed, Palimpsest, the three Miasmore doors, the Shift 2 threshold, and the Assembly.

## Controls

| Action | Input |
| --- | --- |
| Walk / sprint / jump | WASD, Shift, Space |
| Look | Look button (pointer lock), right-drag, or arrow keys |
| Stroll | Click the ground |
| Read a plaque | Click it, or aim and press E |
| Powers | 1–5, then Cast, F, or a click while looking |
| Ember beam | Hold Cast, F, or the locked mouse button |
| Restore one / all | R, or Shift+R. Buttons do the same |
| Cursor back, panels closed | Esc |
| Mute | M |

The top bar is the site map. It carries you to a wing without the walk.

## Powers

1. **Kinetic Lance** — a fast beam that punches through a sculpture and throws the shards.
2. **Gravity Singularity** — a dark-gold vortex that draws pieces into orbit, then throws them out.
3. **Seismic Shockwave** — a ground wave that heaves nearby monuments upward.
4. **Solar Ember Beam** — sustained heat that cracks a form and can chain to its neighbors.
5. **Differentiality Pulse** — a mint field where gravity loosens, then slams back. A game feeling, not a result. The plaque says so.

## Credits

Poly Haven CC0 textures, the Qwantani sunset HDRI, Marble Bust 01, and Concrete Cat Statue are bundled under `public/assets`. Kenney’s CC0 impact sounds supply footsteps, glass, metal, stone, and chimes. Wind, hum, beam, and shock tones are synthesized in the browser. The in-world Archive panel lists each source. Type is Cormorant Garamond and Inter (SIL Open Font License). Physics is Rapier. Rendering is Three.js.
