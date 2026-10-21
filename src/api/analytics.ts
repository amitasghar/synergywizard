type GA4Event = "search" | "filter_use" | "result_expand" | "example_click" | "share_url_copy" | "outbound_click";

export function track(event: GA4Event, params: Record<string, unknown> = {}): void {
  const gtag = (window as any).__gtag ?? (window as any).gtag;
  if (typeof gtag === "function") gtag("event", event, params);
}
