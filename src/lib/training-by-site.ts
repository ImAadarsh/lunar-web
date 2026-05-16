/** Build siteId → trained userIds map for client-side guard filtering. */
export function buildTrainingBySite(
  assignments: Array<{ siteId: number; userId: number }>,
): Record<string, number[]> {
  const map = new Map<number, Set<number>>();
  for (const row of assignments) {
    if (!map.has(row.siteId)) map.set(row.siteId, new Set());
    map.get(row.siteId)!.add(row.userId);
  }
  const out: Record<string, number[]> = {};
  for (const [siteId, userIds] of map) {
    out[String(siteId)] = [...userIds].sort((a, b) => a - b);
  }
  return out;
}
