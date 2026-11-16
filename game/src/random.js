// NEON VOID — deterministic random numbers (mulberry32).
// Every random choice in the simulation goes through this generator, so the
// same seed always replays the same game — the screenshot scenes and the
// grader's replay both depend on it. Never use Math.random in the sim.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] inclusive. */
export function int(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Float in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Pick one element of an array. */
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}
