export function validateIssue(draft = {}) {
  const errors = {};

  if (!String(draft.title || "").trim()) {
    errors.title = "Please fill this required field.";
  }

  if (!String(draft.category || "").trim()) {
    errors.category = "Please fill this required field.";
  }

  if (!String(draft.ward || "").trim()) {
    errors.ward = "Please fill this required field.";
  }

  if (!String(draft.location || "").trim()) {
    errors.location = "Please fill this required field.";
  }

  if (!String(draft.description || "").trim()) {
    errors.description = "Please fill this required field.";
  } else if (String(draft.description).trim().length < 12) {
    errors.description = "Add a little more detail so the team can act.";
  }

  return errors;
}

export default validateIssue;