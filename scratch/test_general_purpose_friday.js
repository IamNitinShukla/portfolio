const http = require('http');

const PORT = 3000;

function queryApi(payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const t0 = Date.now();
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let rawData = '';
        let streamedText = '';
        let ttft = null;
        let modelUsed = res.headers['x-model-used'] || null;
        let sources = [];

        res.on('data', (chunk) => {
          if (ttft === null) ttft = Date.now() - t0;
          const str = chunk.toString();
          rawData += str;
          const lines = str.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.text) streamedText += parsed.text;
                if (parsed.model) modelUsed = parsed.model;
                if (parsed.sources) sources = parsed.sources;
              } catch {}
            }
          }
        });

        res.on('end', () => {
          resolve({
            status: res.statusCode,
            ttft: ttft ?? Date.now() - t0,
            totalTime: Date.now() - t0,
            modelUsed,
            sources,
            text: streamedText.trim() || rawData.trim(),
          });
        });
      }
    );

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

const testSuite = [
  {
    num: 1,
    q: "What day is today?",
    category: "Date / Time",
    validate: (res) => {
      const text = res.text.toLowerCase();
      const hasDayOrDate = text.includes("wednesday") || text.includes("november") || text.includes("2026") || text.includes("today is");
      const noPortfolioRejection = !text.includes("portfolio does not contain") && !text.includes("isn't mentioned in nitin");
      return hasDayOrDate && noPortfolioRejection;
    }
  },
  {
    num: 2,
    q: "What is machine learning?",
    category: "General Knowledge",
    validate: (res) => {
      const text = res.text.toLowerCase();
      const hasML = text.includes("algorithm") || text.includes("data") || text.includes("pattern") || text.includes("learn");
      const noPortfolioRejection = !text.includes("portfolio does not contain") && !text.includes("isn't mentioned in nitin");
      return hasML && noPortfolioRejection;
    }
  },
  {
    num: 3,
    q: "Explain the difference between supervised and unsupervised learning.",
    category: "General Knowledge",
    validate: (res) => {
      const text = res.text.toLowerCase();
      const hasSup = text.includes("supervised") && text.includes("labeled");
      const hasUnsup = text.includes("unsupervised") || text.includes("unlabeled") || text.includes("cluster");
      return hasSup && hasUnsup;
    }
  },
  {
    num: 4,
    q: "Write a Python program to reverse a string.",
    category: "Code Generation",
    validate: (res) => {
      const text = res.text;
      const hasPython = text.includes("def ") || text.includes("[::-1]") || text.includes("reversed");
      return hasPython;
    }
  },
  {
    num: 5,
    q: "What is quantum computing?",
    category: "General Knowledge",
    validate: (res) => {
      const text = res.text.toLowerCase();
      const hasQuantum = text.includes("qubit") || text.includes("superposition") || text.includes("quantum mechanics") || text.includes("quantum");
      const noPortfolioRejection = !text.includes("portfolio does not contain") && !text.includes("isn't mentioned in nitin");
      return hasQuantum && noPortfolioRejection;
    }
  },
  {
    num: 6,
    q: "Tell me about Nitin's LexGenAI project.",
    category: "Portfolio Knowledge",
    validate: (res) => {
      const text = res.text.toLowerCase();
      const hasLex = text.includes("lexgenai") && (text.includes("legal") || text.includes("rag"));
      const hasNitinSir = res.text.includes("Nitin Sir") || res.text.includes("Nitin");
      return hasLex && hasNitinSir;
    }
  },
  {
    num: 7,
    q: "What technologies does Nitin use?",
    category: "Portfolio Knowledge",
    validate: (res) => {
      const text = res.text;
      const hasTech = text.includes("Python") || text.includes("FastAPI") || text.includes("Next.js") || text.includes("TypeScript");
      return hasTech;
    }
  },
  {
    num: 8,
    q: "What are the latest AI developments?",
    category: "Current / Web-Grounded",
    validate: (res) => {
      const text = res.text.toLowerCase();
      const hasAiNews = text.includes("ai") || text.includes("model") || text.includes("intelligence");
      const hasSources = res.sources && res.sources.length > 0;
      return hasAiNews;
    }
  }
];

async function main() {
  console.log("=== EXECUTING 8 GENERAL-PURPOSE FRIDAY TEST QUESTIONS ===");
  const results = [];

  for (const item of testSuite) {
    console.log(`\n---------------------------------------------------------`);
    console.log(`[TEST ${item.num}/8] Query: "${item.q}" (${item.category})`);
    
    const res = await queryApi({ message: item.q, history: [] });
    const passed = item.validate(res);

    console.log(`- Status: HTTP ${res.status}`);
    console.log(`- Model Used: ${res.modelUsed}`);
    console.log(`- TTFT: ${res.ttft}ms | Total Time: ${res.totalTime}ms`);
    console.log(`- Sources Attached: ${res.sources.length}`);
    if (res.sources.length > 0) {
      console.log(`  Sources preview:`, res.sources.slice(0, 2));
    }
    console.log(`- Passed Validation: ${passed ? "YES" : "NO"}`);
    console.log(`- Response Preview:\n${res.text.substring(0, 220)}...`);

    results.push({
      num: item.num,
      question: item.q,
      category: item.category,
      model: res.modelUsed,
      totalTime: `${res.totalTime}ms`,
      sourcesCount: res.sources.length,
      passed: passed ? "YES" : "NO",
      fullText: res.text
    });

    // Pause between calls
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log("\n\n=================== FINAL SUMMARY ===================");
  console.table(results.map(r => ({
    No: r.num,
    Question: r.question,
    Category: r.category,
    Model: r.model,
    Duration: r.totalTime,
    Sources: r.sourcesCount,
    Passed: r.passed
  })));
}

main().catch(console.error);
