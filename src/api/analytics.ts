type GA4Event =
  | "analysis_run"
  | "share_url_copy"
  | "export_action"
  | "conversion_applied";

export function track(event: GA4Event, params: Record<string, unknown> = {}): void {
  const gtag = (window as any).__gtag ?? (window as any).gtag;
  if (typeof gtag === "function") gtag("event", event, params);
}
