// ============================================================================
//  VISIBILITY POLICY: who may see what about whom. ONE source of truth.
//
//  Frontend: every screen that shows a person asks fieldsFor()/canSee().
//  Backend (Person 6): exportPolicy() returns the same rules as JSON. The server must
//  enforce them by building a DIFFERENT, trimmed response per role. Hiding a field in
//  the UI is not security: if the browser receives it, anyone can read it.
//
//  Rule shape: { f: field, needs?: [ctx flags that must be true], unless?: ctx flag that blocks }
// ============================================================================

export const FIELD_LABELS = {
  name: "Name", photo: "Photo", alias: "Alias", email: "Email address", maskedEmail: "Email (masked)",
  phone: "Phone number", rank: "Rank", employeeId: "Employee ID", dutyStatus: "Duty status", zones: "Assigned zones",
  tasks: "Tasks", workContact: "Work contact", designation: "Designation", office: "Office",
  liveLocation: "Live location", emergency: "Emergency contact", homeWard: "Home ward", devices: "Devices & sessions",
  issueDetails: "Issue details", issueStatus: "Issue status", history: "Contribution history",
};

// Never shown to anyone but the owner, in any context.
export const ALWAYS_PRIVATE = ["email", "phone", "emergency", "devices", "homeWard"];

export const POLICY = {
  citizen: {
    // other citizens (Community)
    citizen: [{ f: "name", unless: "anonymous" }, { f: "history", needs: ["showHistory"] }],
    staff: [{ f: "issueStatus" }],
    admin: [{ f: "issueStatus" }],
  },
  staff: {
    citizen: [{ f: "alias" }, { f: "issueDetails" }],
    staff: [{ f: "name" }, { f: "dutyStatus" }, { f: "zones" }],
    admin: [{ f: "name" }, { f: "designation" }, { f: "office" }, { f: "workContact" }],
  },
  admin: {
    citizen: [
      { f: "alias" },
      { f: "issueDetails" },
      { f: "maskedEmail", needs: ["openCase"] },
      { f: "name", needs: ["openCase"], unless: "anonymous" },
      { f: "photo", needs: ["openCase", "sharePhoto"], unless: "anonymous" },
    ],
    staff: [
      { f: "name" }, { f: "photo" }, { f: "employeeId" }, { f: "rank" }, { f: "dutyStatus" }, { f: "zones" },
      { f: "tasks" }, { f: "workContact" }, { f: "liveLocation", needs: ["onDuty"] },
    ],
    admin: [{ f: "name" }, { f: "designation" }, { f: "office" }, { f: "workContact" }],
  },
};

// Personal fields worth listing as "Not shared" for each kind of person.
export const SUBJECT_FIELDS = {
  citizen: ["name", "photo", "email", "phone", "homeWard", "devices"],
  staff: ["name", "photo", "employeeId", "rank", "dutyStatus", "zones", "tasks", "workContact", "liveLocation", "phone", "email", "emergency", "devices"],
  admin: ["name", "designation", "office", "workContact", "phone", "email", "devices"],
};

const passes = (rule, ctx) => (rule.needs || []).every((k) => ctx[k]) && !(rule.unless && ctx[rule.unless]);

// ctx flags: openCase, anonymous, sharePhoto, onDuty, showHistory
export function fieldsFor(viewer, subject, ctx = {}) {
  return ((POLICY[viewer] || {})[subject] || []).filter((r) => passes(r, ctx)).map((r) => r.f);
}

export function canSee(viewer, subject, field, ctx = {}) {
  if (ctx.self) return true;
  return fieldsFor(viewer, subject, ctx).includes(field);
}

// For Person 6: hand this to the backend so both sides use the same rules.
export function exportPolicy() {
  return { version: 1, alwaysPrivate: ALWAYS_PRIVATE, rules: POLICY, ctxFlags: ["openCase", "anonymous", "sharePhoto", "onDuty", "showHistory"] };
}

export function maskEmail(email = "") {
  const [local, domain] = String(email).split("@");
  if (!domain) return "••••";
  return `${local.slice(0, local.length > 2 ? 2 : 1)}****@${domain}`;
}

export function aliasFor(seed = "") {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `Citizen #${1000 + (h % 9000)}`;
}