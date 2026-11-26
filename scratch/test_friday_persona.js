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
            ttft: ttft ?? Date.now() - t0,
            totalTime: Date.now() - t0,
            modelUsed,
            isGemini: res.statusCode === 200 && modelUsed !== null,
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

const testQuestions = [
  {
    name: "Persona / Introduction",
    q: "Who are you?",
    expected: /Friday.*Nitin Sir/i
  },
  {
    name: "Owner Full Name",
    q: "What is Nitin's full name?",
    expected: /Nitin Sir.*Nitin Shukla/i
  },
  {
    name: "Specialization",
    q: "What does he specialize in?",
    expected: /Nitin Sir/i
  },
  {
    name: "Project Description",
    q: "Explain LexGenAI.",
    expected: /Nitin Sir|LexGenAI/i
  },
  {
    name: "UPI ID Query",
    q: "What is Nitin's UPI ID?",
    expected: /guesswho@pingpay/i
  }
];

async function run() {
  console.log("=== TESTING FRIDAY ASSISTANT LIVE ENDPOINT ===");

  for (const t of testQuestions) {
    console.log(`\n--- [Query]: "${t.q}" (${t.name}) ---`);
    const res = await queryApi({ message: t.q, history: [] });
    console.log(`Status: ${res.status} | Model: ${res.modelUsed} | Total: ${res.totalTime}ms`);
    console.log(`Response:\n${res.text}`);
    
    const matchesExpected = t.expected.test(res.text);
    console.log(`Passed Checks: ${matchesExpected ? "YES" : "NO"}`);

    await new Promise(r => setTimeout(r, 1200));
  }
}

run().catch(console.error);
