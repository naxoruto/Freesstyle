export function createOriginPolicy(value: string | undefined): (origin: string | undefined) => boolean {
  const allowed = value?.split(",").map(origin => origin.trim()).filter(Boolean) ?? [];
  return origin => !origin || allowed.length === 0 || allowed.includes(origin);
}
