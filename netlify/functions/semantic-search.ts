import type { Config, Context } from "@netlify/functions";
import { neon } from "@netlify/neon";
import { badRequest, json } from "./_lib/response.ts";
import { semanticSearchBodySchema } from "./_lib/validators.ts";

export const config: Config = {
  path: "/api/semantic-search",
  method: ["POST"],
};

const sqlClient = neon();

export default async function handler(req: Request, _ctx: Context): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = semanticSearchBodySchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const { vector, limit } = parsed.data;
  const vecLiteral = `[${vector.join(",")}]`;

  const rows = await sqlClient`
    SELECT entity_slug, display_name, entity_type,
           mechanic_tags, damage_tags, class_tags,
           1 - (embedding <=> ${vecLiteral}::vector) AS similarity
    FROM entities
    WHERE game = 'poe2' AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vecLiteral}::vector
    LIMIT ${limit}
  `;

  return json(rows, { cache: false });
}
