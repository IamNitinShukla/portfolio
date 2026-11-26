/**
 * Zero-cost server-side web search module.
 * Fetches real-time public web search snippets to ground current-information queries in authentic sources.
 */

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

function cleanHtml(str: string): string {
  return str
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Searches the public web for real-time information with a strict timeout.
 * Returns up to maxResults verified search snippets with clean target URLs.
 */
export async function searchWeb(
  query: string,
  maxResults = 4
): Promise<WebSearchResult[]> {
  try {
    const url = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(3500),
    });

    if (!res.ok) return [];

    const html = await res.text();
    const results: WebSearchResult[] = [];
    const linkRegex = /<a[^>]+class=["']result__a["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<a[^>]+class=["']result__snippet["'][^>]*>([\s\S]*?)<\/a>/gi;

    const snippets: string[] = [];
    let sMatch: RegExpExecArray | null;
    while ((sMatch = snippetRegex.exec(html)) !== null) {
      snippets.push(cleanHtml(sMatch[1]));
    }

    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = linkRegex.exec(html)) !== null && results.length < maxResults) {
      let href = m[1];
      // Resolve DuckDuckGo redirect to destination URL
      if (href.includes("uddg=")) {
        const u = href.match(/uddg=([^&]+)/);
        if (u) href = decodeURIComponent(u[1]);
      }
      const title = cleanHtml(m[2]);
      const snippet = snippets[idx] || "";

      if (href.startsWith("http") && !href.includes("duckduckgo.com/y.js")) {
        results.push({ title, url: href, snippet });
      }
      idx++;
    }

    return results;
  } catch {
    // Graceful failover if network unavailable
    return [];
  }
}

/**
 * Determines whether a question requires live current or real-time internet data.
 */
export function isCurrentInfoQuery(query: string): boolean {
  const q = query.toLowerCase().trim();

  // Exclude simple date/time questions (handled instantly via server temporal context)
  if (
    /\b(what day|what is today'?s? date|what is the date|what time|current time|today'?s? date|what day is it)\b/i.test(
      q
    )
  ) {
    return false;
  }

  // Common current-information triggers
  return /\b(latest|today'?s?|yesterday'?s?|current|now|recent|news|developments? in|breaking|price of|btc|bitcoin|stock|who won|match|weather|this week|this month|2026)\b/i.test(
    q
  );
}

/**
 * Determines whether a query specifically asks about Nitin Shukla or his portfolio.
 */
export function isPortfolioQuery(query: string): boolean {
  const q = query.toLowerCase().trim();
  return /\b(nitin|shukla|lexgenai|krishi|rookdb|ai video generator|resume|upi|hire|portfolio|experience|skills?|projects?|contact|creator|owner)\b/i.test(
    q
  );
}
