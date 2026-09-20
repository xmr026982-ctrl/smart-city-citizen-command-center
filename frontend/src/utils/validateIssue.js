export function validateIssueDraft(draft) {
  const errors = {};
  if (!draft.title?.trim()) errors.title = "Please fill this required field";
  if (!draft.category) errors.category = "Please select a category";
  if (!draft.ward) errors.ward = "Please select a ward";
  if (!draft.location?.trim()) errors.location = "Please fill this required field";
  if (!draft.description?.trim()) {
    errors.description = "Please fill this required field";
  } else if (draft.description.trim().length < 20) {
    errors.description = "Add at least 20 characters so crews can act";
  }
  return errors;
}

export function firstErrorKey(errors) {
  return ["title", "category", "ward", "location", "description"].find(
    (key) => errors[key]
  );
}