# The Kerala Story

The current build is a browser based third person exploration prototype set in
Kerala around 2000. It has one connected procedural world with four regions:
Kodassery Peaks, Kadambode, Kurumali Puzha, and Kodaly. The world currently
tracks 12 landmarks, including `spice-garden`, and stores an explorer profile
and progress locally in the browser.

## Run locally

```sh
npm install
npm run dev
```

Open the Vite URL shown in the terminal. Useful checks are:

```sh
npm run typecheck
npm test
npm run build
```

## Controls

Desktop uses the canvas for keyboard and mouse input:

- `W A S D` or arrow keys: walk
- `Shift`: run
- `Space`: jump
- `R`: toggle sprint lock and auto-forward
- `F`: mount or dismount the bicycle
- drag: look; `Q` / `E`: turn
- `M`: open the field map; `Esc`: pause

On a touch device, choose `Auto`, `Touch`, or `Desktop` in Settings. Touch
mode provides a left analog pad and directional buttons, a sprint-lock button,
right-side camera look, Jump, and bicycle actions. While riding, hold Brake;
after the bicycle stops, release and press backward again to arm reverse.
The Settings action returns a nearby bicycle to a named parking spot when the
explorer is on foot.

## Language and saves

The language selector is available at entry and in Settings. Malayalam values
come from [src/content/locales/ml.json](src/content/locales/ml.json); blank or
whitespace values fall back to the English catalog. Keep catalog keys unchanged
when supplying translations. The locale preference persists locally, and old
V1 saves migrate to V2 while preserving the profile, discoveries, position, and
settings.

## Current scope

The four regions, traveler, bicycle, environment, and signs are procedural
prototypes. Approved rigged character and bicycle GLBs, final environment
assets, licensed audio, and device support certification are still open work.
The project does not claim final art, recorded release audio, or certified
desktop/mobile browser support.

See [docs/08-complete-app-plan.md](docs/08-complete-app-plan.md) for the
implementation scope and [docs/10-translations.md](docs/10-translations.md)
for the translation worksheet and runtime API.
