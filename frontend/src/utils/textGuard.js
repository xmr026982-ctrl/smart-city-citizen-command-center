/* ------------------------------------------------------------------
   Text guard: every place people write to each other (reports, notes,
   close and return notes, requests, proposals, responses, decisions,
   polls, announcements, work notices, checks, profile fields) runs
   this, on the screen and again in the store before anything is saved.

   It blocks keyboard mashes and filler, not opinions or spelling:
     • a single letter held down          "ggggggg"
     • keyboard runs                       "asdf", "qwerty", "zxcvbn", "1234"
     • repeated chunks                     "sdfsdf", "hahaha", "kjhkjhkjh"
     • words no language would make        "ghfhfgyugygyugyftff", "sjdhfkjsdhf"
     • the same word over and over         "test test test"
     • one long unbroken string            "jfkdlsjfkdlsjfkdls…"
     • no letters at all                   "…… 12345 !!!"
   Names of Kolkata places pass ("Shyambazar", "Bowbazar", "Dakshineswar").
   Bengali, Hindi and other scripts are never judged.

   The backend repeats this check (docs/backend/BACKEND-HANDOVER.md · conventions, rule 9).
------------------------------------------------------------------- */

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const RUNS = new Set();
ROWS.forEach((row) => {
  for (let i = 0; i + 4 <= row.length; i += 1) {
    const run = row.slice(i, i + 4);
    RUNS.add(run);
    RUNS.add([...run].reverse().join(""));
  }
});
RUNS.delete("erty"); // property, liberty, poverty
RUNS.delete("ytre");
const hasRun = (w) => {
  for (const run of RUNS) if (w.includes(run)) return true;
  return false;
};

const DIGIT_ROWS = ["0123456789"];
const DIGIT_RUNS = new Set();

DIGIT_ROWS.forEach((row) => {
  for (let i = 0; i + 4 <= row.length; i += 1) {
    const run = row.slice(i, i + 4);
    DIGIT_RUNS.add(run);
    DIGIT_RUNS.add([...run].reverse().join(""));
  }
});

const hasDigitRun = (value) => {
  for (const run of DIGIT_RUNS) {
    if (value.includes(run)) return true;
  }
  return false;
};

// consonant pairs that real words (English and Indian place names in Latin letters) use
const OK_PAIRS = new Set(
  ("bb bh bl br bs bt cc ch ck cl cr ct dd dg dh dl dm dn dr ds dw ff fl fr ft gg gh gl gm gn gr gs " +
    "hl hm hn hr hs ht hw jh kh kk kl km kn kr ks kt lb lc ld lf lg lk ll lm ln lp ls lt lv lw mb mm mn mp ms " +
    "nc nd nf ng nj nk nl nm nn ns nt nv nw nz ph pl pp pr ps pt rb rc rd rf rg rh rk rl rm rn rp rr rs rt rv rw " +
    "sc sh sk sl sm sn sp sq ss st sw th tl tm tn tr ts tt tw vr wb wd wh wk wl wn wr ws xp xt zz")
    .split(" ")
);
const isVowel = (c) => "aeiouy".includes(c);

/* rare consonant pairs in one word */
function rarePairs(w) {
  let n = 0;
  for (let i = 0; i + 1 < w.length; i += 1) {
    const a = w[i];
    const b = w[i + 1];
    if (isVowel(a) || isVowel(b)) continue;
    if (!OK_PAIRS.has(a + b)) n += 1;
  }
  return n;
}

/* a single word that no language would make */
function junkWord(w) {
  if (w.length < 5) return false;
  if (/([a-z])\1{3,}/.test(w)) return true; // gggg
  if (/^(.{2,4})\1+.{0,2}$/.test(w) && w.length >= 6) return true; // sdfsdf, hahaha, kjhkjhk
  if (/^(.)\1*$/.test(w)) return true;
  if (w.length >= 8 && new Set(w).size <= 3) return true; // ababbaab
  const vowels = (w.match(/[aeiouy]/g) || []).length;
  if (w.length >= 6 && vowels === 0) return true; // lkjhgf
  if (w.length >= 12 && vowels / w.length < 0.15) return true;
  const rare = rarePairs(w);
  if (rare >= 3) return true;
  if (rare >= 2 && rare / (w.length - 1) >= 0.2) return true;
  return false;
}

/**
 * True when the text is a keyboard mash or filler, not words.
 * title: also blocks one long unbroken string in a short line.
 */
export function isMash(text = "", { title = false } = {}) {
  const raw = String(text).trim();
  if (!raw) return false;
  if (!/\p{L}/u.test(raw)) return raw.length >= 3; // no letters at all (in any script)
  const latin = raw.replace(/[^A-Za-z]/g, "");
  if (latin.length < raw.replace(/[\s\d\p{P}\p{S}]/gu, "").length * 0.6) return false; // mostly another script
  const low = raw.toLowerCase();
  // Numeric keyboard runs, including reversed runs ("1234", "4321").
  const digits = low.replace(/\D/g, "");
  if (hasDigitRun(digits)) return true;
  if (/(.)\1{5,}/.test(low.replace(/\s/g, ""))) return true; // !!!!!!, ......, gggggg

  const words = low.split(/[^a-z]+/).filter(Boolean);
  if (!words.length) return false;

  // keyboard runs: inside a word, or typed with spaces ("a s d f")
  if (words.some(hasRun)) return true;
  const singles = words.filter((w) => w.length === 1).join("");
  if (singles.length >= 4 && hasRun(singles)) return true;

  const junk = words.filter(junkWord);
  if (junk.some((w) => w.length >= 8)) return true;
  const longer = words.filter((w) => w.length >= 5);
  if (longer.length && junk.length / longer.length >= 0.4) return true;

  // filler: the same word again and again ("test test test")
  if (words.length >= 3) {
    const counts = new Map();
    words.forEach((w) => counts.set(w, (counts.get(w) || 0) + 1));
    const top = Math.max(...counts.values());
    if (top >= 3 && top / words.length >= 0.5) return true;
  }
  // short lines made only of vowel-less words ("dfg hjk")
  const bare = words.filter((w) => w.length > 3 && !/[aeiouy]/.test(w)).length;
  if (words.length <= 2 && bare === words.length) return true;
  if (words.length <= 3 && words.every((w) => !/[aeiouy]/.test(w)) && words.join("").length >= 6) return true; // "dfg hjk"
  if (words.length >= 3 && bare / words.length > 0.5) return true;

  // one long unbroken string (a link or a reference has / . : @ - in it)
  if (/[^\s/.:@\-_]{28,}/.test(raw)) return true;
  if (title && /\S{20,}/.test(raw) && !/[./:@]/.test(raw)) return true;
  return false;
}

export const MASH_MESSAGE = "That doesn't read like words. Write it so people can understand it.";

/**
 * One check for a written field: empty, too short, or a mash.
 * Returns the message to show, or "" when the text is fine.
 *   min    characters needed (0 = optional field)
 *   what   how the field is called in the message, e.g. "the reason"
 */
export function textProblem(text, { min = 0, what = "this", title = false } = {}) {
  const t = String(text || "").trim();
  if (!t) return min ? `Write ${what}.` : "";
  if (t.length < min) return `Write a little more (at least ${min} characters).`;
  if (isMash(t, { title })) return MASH_MESSAGE;
  return "";
}

/**
 * For the screen: the message to show under a field while someone types.
 * Quiet until the text is long enough to judge, so a half-typed word
 * never flashes an error.
 */
export function liveProblem(text, opts = {}) {
  const t = String(text || "").trim();
  if (t.length < 5) return "";
  return isMash(t, { title: opts.title }) ? MASH_MESSAGE : "";
}
