// Seeded random helpers. The game uses one seeded stream per night so a
// screenshot seed always stages the same room; Math.random is never used for
// gameplay. mulberry32 is small, fast and deterministic across engines.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] from a seeded stream. */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Float in [min, max) from a seeded stream. */
export function randFloat(rng, min, max) {
  return min + rng() * (max - min);
}

/** Pick one element of an array from a seeded stream. */
export function randPick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** Fisher-Yates shuffle of a copy, from a seeded stream. */
export function shuffled(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
