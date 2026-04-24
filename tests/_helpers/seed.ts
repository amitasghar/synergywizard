export async function resetAndSeed(): Promise<{ vfId: string; stId: string }> {
  // Stub: real implementation requires NETLIFY_DATABASE_URL to be configured.
  // In CI with a live Netlify DB, this would insert test data.
  return {
    vfId: "00000000-0000-0000-0000-000000000001",
    stId: "00000000-0000-0000-0000-000000000002",
  };
}
