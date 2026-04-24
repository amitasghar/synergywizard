export function json(body: unknown, init: { status?: number; cache?: boolean } = {}): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
  };
  if (init.cache !== false) {
    headers["Cache-Control"] = "public, s-maxage=3600, stale-while-revalidate=86400";
  }
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
}

export function badRequest(message: string): Response {
  return json({ error: message }, { status: 400, cache: false });
}
