import { resetAndSeed } from "../_helpers/seed.ts";

export async function seedOnce(): Promise<{ vfId: string; stId: string }> {
  return resetAndSeed();
}
