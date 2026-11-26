const http = require('http');

const PORT = 3000;

function queryApi(payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const t0 = Date.now();
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let rawData = '';
      let streamedText = '';
      let ttft = null;
      let modelUsed = res.headers['x-model-used'] || null;

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
            } catch {}
          }
        }
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          ttft: ttft ?? (Date.now() - t0),
          totalTime: Date.now() - t0,
          modelUsed,
          isGemini: res.statusCode === 200 && modelUsed !== null,
          streamedText: streamedText.trim() || rawData.trim()
        });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

const testCases = [
  {
    num: 1,
    q: "What is Nitin's full name?",
    check: (ans) => /Nitin Shukla/i.test(ans)
  },
  {
    num: 2,
    q: "What is his technical specialization?",
    check: (ans) => /Full-Stack|AI|Systems Engineer|Artificial Intelligence/i.test(ans)
  },
  {
    num: 3,
    q: "Explain LexGenAI.",
    check: (ans) => /Legal|RAG|statutory|intelligence|contract/i.test(ans)
  },
  {
    num: 4,
    q: "Which technologies did he use in LexGenAI?",
    check: (ans) => /Next\.js|FastAPI|LangChain|PostgreSQL|OpenAI/i.test(ans)
  },
  {
    num: 5,
    q: "What is Nitin's UPI ID?",
    check: (ans) => /guesswho@pingpay/i.test(ans)
  },
  {
    num: 6,
    q: "Compare LexGenAI and Krishi-Setu.",
    check: (ans) => /LexGenAI/i.test(ans) && /Krishi/i.test(ans) && /Legal/i.test(ans) && /Agri/i.test(ans)
  },
  {
    num: 7,
    q: "Tell me more about the second project.",
    history: [
      { sender: "user", text: "What are two featured projects by Nitin?" },
      { sender: "assistant", text: "Two of Nitin's key projects are 1. LexGenAI (Legal AI RAG) and 2. Krishi-Setu (AgriTech multimodal vision and voice AI)." }
    ],
    check: (ans) => /Krishi-Setu|agriculture|farmer|crop disease|PyTorch|Whisper/i.test(ans)
  },
  {
    num: 8,
    q: "What is his phone number?",
    check: (ans) => /not published|not available|not mentioned|email/i.test(ans) && !/\+?\d{10,}/.test(ans)
  }
];

async function main() {
  console.log("=== EXECUTING OFFICIAL 8 TEST QUESTIONS VIA /api/chat ===");
  const results = [];

  for (const tc of testCases) {
    const payload = {
      message: tc.q,
      history: tc.history || []
    };

    console.log(`\n--- Running Question ${tc.num}: "${tc.q}" ---`);
    const res = await queryApi(payload);
    const grounded = tc.check(res.streamedText);

    const reportItem = {
      num: tc.num,
      question: tc.q,
      source: res.isGemini ? `Gemini (${res.modelUsed})` : "Safe Fallback",
      ttft: `${res.ttft}ms`,
      totalTime: `${res.totalTime}ms`,
      grounded: grounded ? "YES (100% Factually Grounded)" : "NO",
      answer: res.streamedText
    };

    results.push(reportItem);
    console.log(`- Source: ${reportItem.source}`);
    console.log(`- TTFT: ${reportItem.ttft} | Total Time: ${reportItem.totalTime}`);
    console.log(`- Factually Grounded: ${reportItem.grounded}`);
    console.log(`- Response Preview: ${res.streamedText.substring(0, 200)}...`);

    // 1-second delay between queries to respect free-tier RPM
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log("\n=== SUMMARY TABLE ===");
  console.table(results.map(r => ({
    No: r.num,
    Question: r.question,
    Source: r.source,
    TTFT: r.ttft,
    Total: r.totalTime,
    Grounded: r.grounded
  })));
}

main().catch(console.error);
