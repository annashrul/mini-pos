export function toBoolean(value: string | boolean): boolean {
  if (typeof value === "boolean") return value;
  return value !== "false";
}
