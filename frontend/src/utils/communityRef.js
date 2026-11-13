/* The community item a command trail line is about (PRP-, POL-, ANN-, WN-), or null. */
const REF = /\b(PRP|POL|ANN|WN)-\d{4}\b/;

export function communityRefOf(e) {
  if (!e || e.kind !== "community") return null;
  if (e.n?.ref && REF.test(e.n.ref)) return e.n.ref;
  return (String(e.action || "").match(REF) || [null])[0];
}
