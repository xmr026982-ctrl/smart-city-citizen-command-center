/* One-time account seeding.

   Put lines like these in backend/.env, run `npm run seed`, then delete them:

     SEED_1="admin|Full Name|email|password"
     SEED_2="staff|Full Name|email|password|Zone|expertise|Rank|Experience"
     SEED_3="citizen|Full Name|email|password|Zone"

   - Every password is checked against the same rules as sign-up
     (staff and citizens 10+, admin 16+). If any line fails, nothing is seeded.
   - An email that already exists is skipped, never overwritten.
   - No password is ever printed. */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), quiet: true });

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const { validatePassword } = require("../utils/passwordValidator");
const { CITIZEN_ZONES } = require("../config/citizenZones");

const EXPERTISE = ["electrical", "roads", "waste", "water", "civic"];
const RANKS = ["Field Operative", "Specialist", "Senior Specialist", "Zone Lead", "Command Fellow"];
const EXPERIENCE = ["Field Active", "2 Years", "5 Years", "10 Years", "Senior Field"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parse(key, line) {
  const p = line.split("|").map((s) => s.trim());
  const [role, name, email, password] = p;
  const where = `${key} (${email || "no email"})`;
  if (!["admin", "staff", "citizen"].includes(role)) throw new Error(`${where}: role must be admin, staff or citizen.`);
  if (!name || name.length < 2) throw new Error(`${where}: a full name is needed.`);
  if (!EMAIL.test(email || "")) throw new Error(`${where}: the email isn't valid.`);
  const problem = validatePassword(password, { role, name, email });
  if (problem) throw new Error(`${where}: ${problem}`);

  const doc = { role, name, email: email.toLowerCase(), password, isActive: true, provider: "password" };
  if (role === "admin") {
    doc.dutyStatus = "on";
    doc.prefs = { idleSignOut: 30 };
  }
  if (role === "staff") {
    const [, , , , zone, expertise, rank = "Field Operative", experience = "Field Active"] = p;
    if (!CITIZEN_ZONES.includes(zone)) throw new Error(`${where}: zone must be one of ${CITIZEN_ZONES.join(", ")}.`);
    if (!EXPERTISE.includes(String(expertise).toLowerCase())) throw new Error(`${where}: expertise must be one of ${EXPERTISE.join(", ")}.`);
    if (!RANKS.includes(rank)) throw new Error(`${where}: rank must be one of ${RANKS.join(", ")}.`);
    if (!EXPERIENCE.includes(experience)) throw new Error(`${where}: experience must be one of ${EXPERIENCE.join(", ")}.`);
    Object.assign(doc, { zone, expertise: expertise.toLowerCase(), rank, experience, verified: true, dutyStatus: "off", prefs: { idleSignOut: 60 } });
  }
  if (role === "citizen") {
    const zone = p[4];
    if (!CITIZEN_ZONES.includes(zone)) throw new Error(`${where}: zone must be one of ${CITIZEN_ZONES.join(", ")}.`);
    doc.zone = zone;
  }
  return doc;
}

async function main() {
  const keys = Object.keys(process.env).filter((k) => /^SEED_\d+$/.test(k)).sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
  if (!keys.length) {
    console.log("No SEED_ lines in backend/.env. Nothing to do.");
    return;
  }

  // check every line before touching the database
  const docs = keys.map((k) => parse(k, process.env[k]));

  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing from backend/.env.");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

  for (const doc of docs) {
    if (await User.exists({ email: doc.email })) {
      console.log(`Skipped ${doc.role} ${doc.email}: already exists.`);
      continue;
    }
    await User.create({ ...doc, password: await bcrypt.hash(doc.password, 12) });
    console.log(`Created ${doc.role} ${doc.email}.`);
  }
  console.log("Done. Delete the SEED_ lines from backend/.env now.");
}

main()
  .catch((error) => {
    console.error(`Seeding stopped: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect().catch(() => {}));
