
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const RUNS = new Set();

ROWS.forEach((row) => {
  for (let i = 0; i + 4 <= row.length; i += 1) {
    const run = row.slice(i, i + 4);
    RUNS.add(run);
    RUNS.add([...run].reverse().join(""));
  }
});

RUNS.delete("erty");
RUNS.delete("ytre");

const hasRun = (word) => {
  for (const run of RUNS) {
    if (word.includes(run)) return true;
  }
  return false;
};

const DIGIT_RUNS = new Set();

for (let i = 0; i + 4 <= 10; i += 1) {
  const run = "0123456789".slice(i, i + 4);
  DIGIT_RUNS.add(run);
  DIGIT_RUNS.add([...run].reverse().join(""));
}

const hasDigitRun = (value) => {
  for (const run of DIGIT_RUNS) {
    if (value.includes(run)) return true;
  }
  return false;
};

const OK_PAIRS = new Set(
  (
    "bb bh bl br bs bt cc ch ck cl cr ct dd dg dh dl dm dn dr ds dw ff fl fr ft gg gh gl gm gn gr gs " +
    "hl hm hn hr hs ht hw jh kh kk kl km kn kr ks kt lb lc ld lf lg lk ll lm ln lp ls lt lv lw mb mm mn mp ms " +
    "nc nd nf ng nj nk nl nm nn ns nt nv nw nz ph pl pp pr ps pt rb rc rd rf rg rh rk rl rm rn rp rr rs rt rv rw " +
    "sc sh sk sl sm sn sp sq ss st sw th tl tm tn tr ts tt tw vr wb wd wh wk wl wn wr ws xp xt zz"
  ).split(" ")
);

const isVowel = (c) => "aeiouy".includes(c);

function rarePairs(word) {
  let count = 0;

  for (let i = 0; i + 1 < word.length; i += 1) {
    const a = word[i];
    const b = word[i + 1];

    if (isVowel(a) || isVowel(b)) continue;
    if (!OK_PAIRS.has(a + b)) count += 1;
  }

  return count;
}

function junkWord(word) {
  if (word.length < 5) return false;
  if (/([a-z])\1{3,}/.test(word)) return true;
  if (/^(.{2,4})\1+.{0,2}$/.test(word) && word.length >= 6) return true;
  if (/^(.)\1*$/.test(word)) return true;
  if (word.length >= 8 && new Set(word).size <= 3) return true;

  const vowels = (word.match(/[aeiouy]/g) || []).length;

  if (word.length >= 6 && vowels === 0) return true;
  if (word.length >= 12 && vowels / word.length < 0.15) return true;

  const rare = rarePairs(word);

  if (rare >= 3) return true;
  if (rare >= 2 && rare / (word.length - 1) >= 0.2) return true;

  return false;
}

function isMash(text = "", { title = false } = {}) {
  const raw = String(text).trim();

  if (!raw) return false;
  if (!/\p{L}/u.test(raw)) return raw.length >= 3;

  const latin = raw.replace(/[^A-Za-z]/g, "");
  const meaningful = raw.replace(/[\s\d\p{P}\p{S}]/gu, "");

  if (latin.length < meaningful.length * 0.6) return false;

  const low = raw.toLowerCase();
  const digits = low.replace(/\D/g, "");

  if (hasDigitRun(digits)) return true;
  if (/(.)\1{5,}/.test(low.replace(/\s/g, ""))) return true;

  const words = low.split(/[^a-z]+/).filter(Boolean);

  if (!words.length) return false;
  if (words.some(hasRun)) return true;

  const singles = words.filter((word) => word.length === 1).join("");

  if (singles.length >= 4 && hasRun(singles)) return true;

  const junk = words.filter(junkWord);

  if (junk.some((word) => word.length >= 8)) return true;

  const longer = words.filter((word) => word.length >= 5);

  if (longer.length && junk.length / longer.length >= 0.4) return true;

  if (words.length >= 3) {
    const counts = new Map();

    words.forEach((word) => {
      counts.set(word, (counts.get(word) || 0) + 1);
    });

    const top = Math.max(...counts.values());

    if (top >= 3 && top / words.length >= 0.5) return true;
  }

  const bare = words.filter(
    (word) => word.length > 3 && !/[aeiouy]/.test(word)
  ).length;

  if (words.length <= 2 && bare === words.length) return true;

  if (
    words.length <= 3 &&
    words.every((word) => !/[aeiouy]/.test(word)) &&
    words.join("").length >= 6
  ) {
    return true;
  }

  if (words.length >= 3 && bare / words.length > 0.5) return true;

  if (/[^\s/.:@\\_-]{28,}/.test(raw)) return true;

  if (title && /\S{20,}/.test(raw) && !/[./:@]/.test(raw)) {
    return true;
  }

  return false;
}

const MASH_MESSAGE =
  "That doesn't read like words. Write it so people can understand it.";

function textProblem(
  text,
  { min = 0, what = "this", title = false } = {}
) {
  const value = String(text || "").trim();

  if (!value) return min ? `Write ${what}.` : "";
  if (value.length < min) {
    return `Write a little more (at least ${min} characters).`;
  }

  if (isMash(value, { title })) return MASH_MESSAGE;

  return "";
}

module.exports = {
  isMash,
  textProblem,
  MASH_MESSAGE,
};