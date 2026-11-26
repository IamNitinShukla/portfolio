function cleanHtml(str) {
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

async function searchWeb(query, maxResults = 4) {
  try {
    const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return [];

    const html = await res.text();
    const results = [];
    const linkRegex = /<a[^>]+class=["']result__a["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<a[^>]+class=["']result__snippet["'][^>]*>([\s\S]*?)<\/a>/gi;

    const snippets = [];
    let sMatch;
    while ((sMatch = snippetRegex.exec(html)) !== null) {
      snippets.push(cleanHtml(sMatch[1]));
    }

    let m;
    let idx = 0;
    while ((m = linkRegex.exec(html)) !== null && results.length < maxResults) {
      let href = m[1];
      if (href.includes('uddg=')) {
        const u = href.match(/uddg=([^&]+)/);
        if (u) href = decodeURIComponent(u[1]);
      }
      const title = cleanHtml(m[2]);
      const snippet = snippets[idx] || '';
      if (href.startsWith('http')) {
        results.push({ title, url: href, snippet });
      }
      idx++;
    }

    return results;
  } catch (err) {
    console.error('searchWeb error:', err.message);
    return [];
  }
}

function isCurrentInfoQuery(query) {
  const q = query.toLowerCase().trim();
  // Exclude simple date/time questions
  if (/\b(what day|what is today'?s? date|what is the date|what time|current time|today'?s? date)\b/i.test(q)) {
    return false;
  }
  // Check for recency or current-information triggers
  return /\b(latest|today'?s?|yesterday'?s?|current|now|recent|news|developments? in|breaking|price of|score|match|weather|this week|this month|2026)\b/i.test(q);
}

function isPortfolioQuery(query) {
  const q = query.toLowerCase().trim();
  return /\b(nitin|shukla|lexgenai|krishi|rookdb|ai video generator|resume|upi|hire|portfolio|experience|skills?|projects?|contact|creator|owner)\b/i.test(q);
}

async function run() {
  console.log("Test classification:");
  const testQueries = [
    "What day is today?",
    "What is machine learning?",
    "Write a Python program to reverse a string.",
    "Tell me about Nitin's LexGenAI project.",
    "What are the latest AI developments?",
    "What is the current price of Bitcoin?"
  ];

  for (const q of testQueries) {
    const isCurrent = isCurrentInfoQuery(q);
    const isPort = isPortfolioQuery(q);
    console.log(`Q: "${q}" -> isCurrent: ${isCurrent}, isPortfolio: ${isPort}`);
  }

  console.log("\nTesting searchWeb for 'latest AI developments':");
  const res = await searchWeb("latest AI developments");
  console.log(res);
}

run();
