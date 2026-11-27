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
| Walk / sprint / jump | WASD or arrow keys, Shift, Space. Works without pointer lock |
| Turn | Q and E. Drag the mouse to look. Click the view to capture the mouse |
| Read a plaque | Click the plaque, or aim and press X |
| Powers | 1–5, then click or Cast |
| Wrecking orb | F |
| Lunar gravity | G |
| Bullet time | T (physics at 0.25×) |
| Restore one / all | R restores the sculpture ahead and resets props. Shift+R rebuilds the campus |
| Cursor back, panels closed | Esc. Walking keeps working |
| Mute | M |

The top bar is the site map. It carries you to a wing without the walk.

## Powers

1. **Kinetic Force Blast** — a directional shockwave that impulses every rigid body in front of you.
2. **Singularity** — a gravity well that lifts, orbits, and then flings nearby bodies.
3. **Differentiality Inversion** — `z = 1/E`. A local anti-gravity field floats objects, then drops them.
4. **Fracture Beam** — shatters a sculpture into live pieces and breaks fragile props into shards.
5. **Orbital Slam** — a physical meteor and a wide shockwave. Resonance cores chain-detonate.

Every wing holds stacks, dominos, urns, spheres, pendulums, and cores. They sleep until a power, a wrecking orb, or the player bumps them.

## Credits

Poly Haven CC0 textures, the Qwantani sunset HDRI, Marble Bust 01, and Concrete Cat Statue are bundled under `public/assets`. Kenney’s CC0 impact sounds supply footsteps, glass, metal, stone, and chimes. Wind, hum, beam, and shock tones are synthesized in the browser. The in-world Archive panel lists each source. Type is Cormorant Garamond and Inter (SIL Open Font License). Physics is Rapier. Rendering is Three.js.
