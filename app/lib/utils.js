/**
 * Creates a pseudo-random number generator function from a seed.
 * This is a simple Mulberry32 implementation.
 * @param {string} seed - A string seed.
 * @returns {function(): number} A function that returns a pseudo-random number between 0 and 1.
 */
function createSeededRandom(seed) {
  let a = 0;
  // Simple hash function to turn the string seed into a number
  for (let i = 0; i < seed.length; i++) {
    a = (a + seed.charCodeAt(i)) % 2**32;
  }

  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

/**
 * Shuffles an array in place using a deterministic, seeded pseudo-random number generator.
 * Uses the Fisher-Yates (aka Knuth) shuffle algorithm.
 * @param {Array<T>} array The array to shuffle.
 * @param {string} seed The seed for the random number generator.
 * @returns {Array<T>} The shuffled array (mutated in place).
 * @template T
 */
export function seededShuffle(array, seed) {
  if (!array || array.length <= 1) {
    return array;
  }

  const random = createSeededRandom(seed);
  let currentIndex = array.length;
  let randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex !== 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}
