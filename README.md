# NEON VOID

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/galanazza22/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/galanazza22/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**NEON VOID** is a fast neon arena survival shooter that runs offline in a desktop browser from its own static files. Pilot the last interceptor through 8 waves of enemies — chasers that hunt you, weavers that strafe in sine waves, spitters that shoot back, and armoured brutes — dashing through danger, chaining kills into a combo multiplier, and grabbing triple-shot, rapid-fire, shield and hull pickups. Clear all 8 waves and the sector is yours.

Controls: **WASD / arrows** to fly, **mouse** to aim, **hold click** to fire, **Space** to dash (briefly invulnerable), **P** to pause, **M** to mute. All art is drawn in code and all sound — effects and a driving bass sequencer — is synthesized live with WebAudio. Nothing is fetched from the network.

## Run it

```sh
# Play it locally (serves game/ on http://localhost:8080)
python3 -m http.server 8080 --directory game

# Or hand it in exactly as the grader does:
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots are deterministic renders of the game's own code: `game/index.html?shot=title|play|win|over&seed=7` stages each scene from a seeded simulation and signals `window.__shotReady` when the frame is drawn.

---

<sub>Entered on [make.fun](https://make.fun/?ref=1c6jcmp6&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
