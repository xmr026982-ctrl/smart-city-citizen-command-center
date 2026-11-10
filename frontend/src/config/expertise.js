/* ------------------------------------------------------------------
   Expertise: one shared list for the whole system.
   The Staff Request form stores the id. Every screen shows the label.
   Staff Desk, Assign Issues, issue files and anything else that names
   a staff member's expertise should import from here, never hard-code.
------------------------------------------------------------------- */

export const EXPERTISE = [
  { id: "electrical", label: "Electrician", matches: ["electric", "lighting", "power"] },
  { id: "roads", label: "Road Works", matches: ["roads", "road", "pothole", "footpath"] },
  { id: "waste", label: "Waste", matches: ["waste", "garbage", "sanitation"] },
  { id: "water", label: "Water & Drainage", matches: ["water", "drainage", "sewer"] },
  { id: "civic", label: "Civic General", matches: ["civic", "other", "general", "safety"] },
];

export const EXPERTISE_IDS = EXPERTISE.map((e) => e.id);

// Issue category (from the Report Issue form) -> the expertise that handles it.
export const CATEGORY_EXPERTISE = {
  roads: "roads",
  lighting: "electrical",
  electricity: "electrical",
  water: "water",
  waste: "waste",
  safety: "civic",
  other: "civic",
};

export function isExpertiseId(id) {
  return EXPERTISE_IDS.includes(id);
}

// id -> label ("electrical" -> "Electrician"). Unknown ids fall back to Civic General.
export function expertiseLabel(id) {
  return EXPERTISE.find((e) => e.id === id)?.label || "Civic General";
}

// Which expertise should handle this issue category.
export function expertiseForCategory(category) {
  return CATEGORY_EXPERTISE[category] || "civic";
}

// Does this expertise cover an issue category? Used when assigning issues.
export function matchesExpertise(expertiseId, category) {
  if (!expertiseId || !category) return false;
  if (CATEGORY_EXPERTISE[category]) return CATEGORY_EXPERTISE[category] === expertiseId;
  const exp = EXPERTISE.find((e) => e.id === expertiseId);
  if (!exp) return false;
  const key = String(category).toLowerCase();
  return exp.matches.some((m) => key.includes(m));
}