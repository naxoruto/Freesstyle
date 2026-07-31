export const SOURCE_PRIORITY = ["fandom", "freestyle-stats", "fms-redbull"] as const;

export type CatalogSource = (typeof SOURCE_PRIORITY)[number];

export function firstBooleanEvidence(values: Array<{ source: CatalogSource; value: boolean | undefined }>) {
  for (const item of values) {
    if (item.value !== undefined) return item;
  }
  return undefined;
}
