export interface UrlState {
  slugs: string[];
  conversion: { slug: string; from: string; to: string } | null;
}

export function encodeStateToUrl(baseUrl: string, state: UrlState): string {
  const url = new URL(baseUrl);
  if (state.slugs.length > 0) {
    url.searchParams.set("skills", state.slugs.join(","));
  } else {
    url.searchParams.delete("skills");
  }
  if (state.conversion) {
    url.searchParams.set(
      "convert",
      `${state.conversion.slug}:${state.conversion.from}>${state.conversion.to}`,
    );
  } else {
    url.searchParams.delete("convert");
  }
  return url.toString();
}

export function decodeStateFromUrl(href: string): UrlState {
  const url = new URL(href);
  const skillsParam = url.searchParams.get("skills");
  const convertParam = url.searchParams.get("convert");

  const slugs = skillsParam ? skillsParam.split(",").filter(Boolean) : [];
  let conversion: UrlState["conversion"] = null;
  if (convertParam) {
    const match = convertParam.match(/^([^:]+):([^>]+)>(.+)$/);
    if (match) {
      conversion = { slug: match[1], from: match[2], to: match[3] };
    }
  }
  return { slugs, conversion };
}
