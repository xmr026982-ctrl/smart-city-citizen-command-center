export function getErrorMessage(error) {
  if (!error) return "Something went wrong";
  if (typeof error === "string") return error;
  return error.message || "Something went wrong";
}