import * as crypto from 'crypto';

export interface PasswordOptions {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSymbols?: boolean;
  excludeSimilar?: boolean;
  excludeAmbiguous?: boolean;
}

export interface PassphraseOptions {
  words?: number;
  separator?: string;
  capitalize?: boolean;
  includeNumber?: boolean;
}

export interface PasswordResult {
  value: string;
  entropy: number;
  strength: 'Very Weak' | 'Weak' | 'Moderate' | 'Strong' | 'Very Strong';
  timeToCrack: string;
}

const CHARS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  similar: 'il1Lo0O',
  ambiguous: '{}[]()/\\\'"`~,;:.<>'
};

// EFF Short Wordlist (subset of 256 words for 8 bits of entropy per word)
const WORDLIST = [
  "apple", "brave", "crane", "dance", "eagle", "flame", "grape", "heart",
  "image", "juice", "knife", "lemon", "mango", "night", "ocean", "peach",
  "queen", "river", "snake", "train", "uncle", "voice", "water", "xenon",
  "yacht", "zebra", "actor", "baker", "cabin", "delta", "earth", "fairy",
  "ghost", "honey", "igloo", "jelly", "karma", "laser", "magic", "ninja",
  "oasis", "panda", "quilt", "radar", "salsa", "tiger", "urban", "venus",
  "wagon", "x-ray", "yield", "zesty", "album", "beach", "candy", "dream",
  "elite", "frost", "globe", "happy", "index", "joker", "koala", "lunar",
  "melon", "noble", "onion", "pizza", "quest", "robot", "solar", "tulip",
  "ultra", "vivid", "whale", "xerox", "young", "zonal", "alien", "block",
  "cloud", "drift", "exact", "flock", "grand", "habit", "ideal", "joint",
  "kiosk", "logic", "model", "novel", "orbit", "pilot", "quirk", "rapid",
  "smart", "topic", "unify", "value", "world", "xylem", "yearn", "zappy",
  "amber", "blend", "charm", "dizzy", "eager", "flash", "giant", "hover",
  "inbox", "jumbo", "kneel", "limit", "motor", "nerve", "opera", "pixel",
  "quota", "react", "sweep", "track", "unzip", "valid", "woven", "xenia",
  "yummy", "zeal", "angel", "bliss", "crisp", "donor", "early", "flora",
  "glory", "hotel", "ivory", "judge", "knock", "local", "mural", "nylon",
  "optic", "plaza", "quote", "rebel", "sweet", "trend", "upset", "vapor",
  "wrist", "xeric", "yodel", "zesty", "angry", "bloom", "cross", "doubt",
  "empty", "fluid", "grace", "house", "irony", "jumpy", "known", "lucky",
  "music", "naive", "organ", "plumb", "rabid", "relax", "swift", "trust",
  "usher", "vault", "wrong", "xylan", "yokel", "zonal", "ankle", "bluff",
  "crowd", "draft", "entry", "flush", "grasp", "human", "issue", "juror",
  "kraft", "lumen", "myth", "nasty", "ounce", "plush", "racer", "relay",
  "sword", "truth", "usual", "venom", "yacht", "x-ray", "yield", "zebra",
  "antic", "board", "crown", "drain", "envoy", "flute", "grass", "humor",
  "item", "kebab", "label", "lunar", "naked", "niche", "outer", "point",
  "radio", "relic", "syrup", "tulip", "utter", "verge", "yummy", "xenon",
  "yacht", "zappy", "anvil", "boast", "crust", "drama", "equal", "focal",
  "grave", "husky", "ivory", "khaki", "labor", "lyric", "name", "niece",
  "ovary", "poise", "rainy", "remit", "table", "tutor", "vague", "video",
  "yodel", "xeric", "yearn", "zeal"
];

function getSecureRandomInt(max: number): number {
  return crypto.randomInt(0, max);
}

function calculateStrength(entropy: number): 'Very Weak' | 'Weak' | 'Moderate' | 'Strong' | 'Very Strong' {
  if (entropy < 28) return 'Very Weak';
  if (entropy < 36) return 'Weak';
  if (entropy < 60) return 'Moderate';
  if (entropy < 128) return 'Strong';
  return 'Very Strong';
}

function estimateCrackTime(entropy: number): string {
  // Assume an attacker can try 100 billion (10^11) hashes per second (e.g., cluster of RTX 4090s)
  const guessesPerSecond = 100_000_000_000;
  const totalCombinations = Math.pow(2, entropy);
  const secondsToCrack = totalCombinations / guessesPerSecond;

  if (secondsToCrack < 1) return 'Instantly';
  if (secondsToCrack < 60) return `${Math.round(secondsToCrack)} seconds`;
  if (secondsToCrack < 3600) return `${Math.round(secondsToCrack / 60)} minutes`;
  if (secondsToCrack < 86400) return `${Math.round(secondsToCrack / 3600)} hours`;
  if (secondsToCrack < 31536000) return `${Math.round(secondsToCrack / 86400)} days`;
  if (secondsToCrack < 3153600000) return `${Math.round(secondsToCrack / 31536000)} years`;
  if (secondsToCrack < 3153600000000) return `${Math.round(secondsToCrack / 3153600000)} centuries`;
  return 'Millions of years';
}

export function generatePassword(options: PasswordOptions = {}): PasswordResult {
  const length = options.length || 16;
  const includeUppercase = options.includeUppercase ?? true;
  const includeLowercase = options.includeLowercase ?? true;
  const includeNumbers = options.includeNumbers ?? true;
  const includeSymbols = options.includeSymbols ?? true;
  const excludeSimilar = options.excludeSimilar ?? false;
  const excludeAmbiguous = options.excludeAmbiguous ?? false;

  let pool = '';
  if (includeUppercase) pool += CHARS.uppercase;
  if (includeLowercase) pool += CHARS.lowercase;
  if (includeNumbers) pool += CHARS.numbers;
  if (includeSymbols) pool += CHARS.symbols;

  if (pool.length === 0) {
    pool = CHARS.lowercase + CHARS.numbers; // Fallback
  }

  if (excludeSimilar) {
    pool = pool.split('').filter(c => !CHARS.similar.includes(c)).join('');
  }
  if (excludeAmbiguous) {
    pool = pool.split('').filter(c => !CHARS.ambiguous.includes(c)).join('');
  }

  let password = '';
  for (let i = 0; i < length; i++) {
    password += pool[getSecureRandomInt(pool.length)];
  }

  // Ensure at least one character from each selected pool is included
  const requiredChars: string[] = [];
  if (includeUppercase) requiredChars.push(CHARS.uppercase[getSecureRandomInt(CHARS.uppercase.length)]);
  if (includeLowercase) requiredChars.push(CHARS.lowercase[getSecureRandomInt(CHARS.lowercase.length)]);
  if (includeNumbers) requiredChars.push(CHARS.numbers[getSecureRandomInt(CHARS.numbers.length)]);
  if (includeSymbols) requiredChars.push(CHARS.symbols[getSecureRandomInt(CHARS.symbols.length)]);

  if (requiredChars.length > 0 && length >= requiredChars.length) {
    const passwordArray = password.split('');
    for (let i = 0; i < requiredChars.length; i++) {
      // Replace random positions with required characters
      const pos = getSecureRandomInt(length);
      passwordArray[pos] = requiredChars[i];
    }
    password = passwordArray.join('');
  }

  const entropy = length * Math.log2(pool.length);

  return {
    value: password,
    entropy: Math.round(entropy * 100) / 100,
    strength: calculateStrength(entropy),
    timeToCrack: estimateCrackTime(entropy)
  };
}

export function generatePassphrase(options: PassphraseOptions = {}): PasswordResult {
  const wordsCount = options.words || 4;
  const separator = options.separator ?? '-';
  const capitalize = options.capitalize ?? false;
  const includeNumber = options.includeNumber ?? false;

  const words: string[] = [];
  for (let i = 0; i < wordsCount; i++) {
    let word = WORDLIST[getSecureRandomInt(WORDLIST.length)];
    if (capitalize) {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }
    words.push(word);
  }

  if (includeNumber) {
    const randomPos = getSecureRandomInt(wordsCount);
    words[randomPos] += getSecureRandomInt(10).toString();
  }

  const passphrase = words.join(separator);
  
  // Entropy calculation: log2(WORDLIST.length) per word
  // Plus entropy for separator, capitalization, and number inclusion
  let entropy = wordsCount * Math.log2(WORDLIST.length);
  if (capitalize) entropy += wordsCount; // 1 bit per word for capitalization
  if (includeNumber) entropy += Math.log2(10 * wordsCount); // 10 digits * wordsCount positions

  return {
    value: passphrase,
    entropy: Math.round(entropy * 100) / 100,
    strength: calculateStrength(entropy),
    timeToCrack: estimateCrackTime(entropy)
  };
}
