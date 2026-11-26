async function testSearch(q) {
  try {
    const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    console.log('Status:', res.status);
    const html = await res.text();
    console.log('HTML length:', html.length);
    
    // Parse DuckDuckGo html results
    const results = [];
    const linkRegex = /<a[^>]+class=["']result__a["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<a[^>]+class=["']result__snippet["'][^>]*>([\s\S]*?)<\/a>/gi;
    
    const snippets = [];
    let sMatch;
    while ((sMatch = snippetRegex.exec(html)) !== null) {
      snippets.push(sMatch[1].replace(/<[^>]+>/g, '').trim());
    }

    let m;
    let idx = 0;
    while ((m = linkRegex.exec(html)) !== null && results.length < 5) {
      let href = m[1];
      if (href.includes('uddg=')) {
        const u = href.match(/uddg=([^&]+)/);
        if (u) href = decodeURIComponent(u[1]);
      }
      const rawTitle = m[2].replace(/<[^>]+>/g, '').trim();
      const snippet = snippets[idx] || '';
      results.push({ title: rawTitle, url: href, snippet });
      idx++;
    }

    console.log('Results found:', results.length);
    console.log(JSON.stringify(results, null, 2));
    return results;
  } catch (e) {
    console.error('Error:', e.message);
    return [];
  }
}

testSearch('latest AI developments');
