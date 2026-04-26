import type { Config, Context } from "@netlify/functions";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { json } from "./_lib/response.ts";

export const config: Config = {
  path: "/api/seed-status",
  method: ["GET"],
};

const SEED_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../pipeline/data/poe2_seed.json",
);

const DEFAULT_POE2_DIR = String.raw`F:\SteamLibrary\steamapps\common\Path of Exile 2`;

export default async function handler(_req: Request, _ctx: Context): Promise<Response> {
  const poe2Dir = process.env.POE2_DIR ?? DEFAULT_POE2_DIR;

  try {
    const raw = await readFile(SEED_PATH, "utf-8");
    const data = JSON.parse(raw) as {
      extracted_at: string;
      patch_version: string;
      entity_counts: { skill: number; support: number; passive: number };
    };
    return json(
      {
        present: true,
        extracted_at: data.extracted_at,
        patch_version: data.patch_version,
        entity_counts: data.entity_counts,
        poe2Dir,
      },
      { cache: false },
    );
  } catch {
    return json({ present: false, poe2Dir }, { cache: false });
  }
}
