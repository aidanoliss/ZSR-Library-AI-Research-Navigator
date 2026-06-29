export function isReservedExampleUrl(url) {
  if (!url) return true;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "example.com" || host === "example.org" || host === "example.net" || host.endsWith(".example.com");
  } catch {
    return true;
  }
}

export function hasOutreachReadyCompanySource(company) {
  return [company?.source_url, company?.website_url].some((url) => !isReservedExampleUrl(url));
}
