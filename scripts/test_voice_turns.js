// Run against a built site. Supply five WAVs containing the acceptance prompts in order.
// node scripts/test_voice_turns.js <origin> <chrome executable> <wav1> ... <wav5>
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const [origin, executable, ...files] = process.argv.slice(2);
assert.equal(files.length, 5, "Five speech fixtures are required");
const prompts = ["hello friday", "what is machine learning", "give me a simple example",
  "explain the difference between ai and ml", "explain that more simply"];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "friday-chrome-"));
  const browser = spawn(executable, ["--remote-debugging-pipe", "--no-first-run", "--no-default-browser-check",
    "--window-position=-3000,-3000", "--disable-backgrounding-occluded-windows", "--disable-features=CalculateNativeWinOcclusion", "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
    "--user-data-dir=" + profile, "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
  const waiting = new Map();
  let serial = 0;
  let tail = "";
  browser.stdio[4].setEncoding("utf8").on("data", chunk => {
    const packets = (tail + chunk).split("\0");
    tail = packets.pop();
    for (const packet of packets) {
      const response = JSON.parse(packet);
      const pending = waiting.get(response.id);
      if (pending) {
        waiting.delete(response.id);
        if (response.error) pending.reject(Error(response.error.message));
        else pending.resolve(response.result);
      }
    }
  });
  browser.on("exit", () => {
    for (const pending of waiting.values()) pending.reject(Error("Browser exited"));
    waiting.clear();
  });
  function call(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++serial;
      waiting.set(id, { resolve, reject });
      browser.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + "\0");
    });
  }
  try {
    const { targetId } = await call("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await call("Target.attachToTarget", { targetId, flatten: true });
    await call("Browser.grantPermissions", { origin: new URL(origin).origin, permissions: ["audioCapture"] });
    await call("Page.bringToFront", {}, sessionId);
    async function evaluate(expression) {
      const res = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true }, sessionId);
      if (res.exceptionDetails) throw Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
      return res.result.value;
    }
    async function until(expression, timeout = 12000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        if (await evaluate("Boolean(" + expression + ")")) return;
        await delay(100);
      }
      throw Error("Timed out waiting for " + expression + " " + await evaluate("JSON.stringify({label:document.querySelector('[data-testid=voice-state-label]')?.textContent, contexts:window.qa?.contexts.map(c=>c.state), metrics:window.qa?.metrics, errors:window.qa?.errors, spokenChars:window.qa?.utterances.at(-1)?.length, lastBoundary:window.qa?.boundary, voices:speechSynthesis.getVoices().length})"));
    }

    await call("Page.navigate", { url: origin }, sessionId);
    await until("!!document.querySelector('[data-testid=mascot-assistant-trigger]')");
    await evaluate('sessionStorage.setItem("portfolio_intro_seen","true")');
    await call("Page.reload", {}, sessionId);
    await until("!!document.querySelector('[data-testid=mascot-assistant-trigger]')");
    // Instrument native endpoints, MediaRecorder and TTS. Only microphone input is synthetic.
    function installCapture() {
      const metrics = { mic: 0, starts: 0, uploads: 0, chats: 0, done: 0, spoken: 0, ended: 0 };
      const qa = window.qa = { metrics, transcripts: [], errors: [], replies: [], utterances: [], sizes: [] };
      qa.contexts = [];
      const NativeContext = window.AudioContext;
      window.AudioContext = class extends NativeContext {
        constructor(...options) { super(...options); qa.contexts.push(this); }
      };
      const getMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async options => {
        metrics.mic++;
        if (qa.mode === "deny") throw new DOMException("Denied", "NotAllowedError");
        const input = await getMedia(options);
        input.getTracks().forEach(track => track.stop());
        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        const silence = ctx.createConstantSource();
        silence.offset.value = 0;
        silence.connect(dest);
        silence.start();
        await ctx.resume();
        qa.play = async (base64, seconds) => {
          const bytes = Uint8Array.from(atob(base64), ch => ch.charCodeAt(0));
          const source = ctx.createBufferSource();
          source.buffer = await ctx.decodeAudioData(bytes.buffer);
          source.connect(dest);
          await ctx.resume();
          source.start(0, 0, seconds ?? source.buffer.duration);
        };
        return dest.stream;
      };
      const start = MediaRecorder.prototype.start;
      MediaRecorder.prototype.start = function (...args) {
        this.addEventListener("start", () => metrics.starts++, { once: true });
        return start.apply(this, args);
      };
      const request = window.fetch.bind(window);
      window.fetch = async (url, opts) => {
        if (url === "/api/transcribe") {
          metrics.uploads++;
          qa.sizes.push(opts.body.size);
          if (qa.mode === "quota") return Response.json({ code: "rate_limited", error: "Quota reached." }, { status: 429 });
          if (qa.mode === "timeout" || qa.mode === "close") return new Promise((_, reject) => {
            opts.signal.addEventListener("abort", () => { qa.aborted = true; reject(new DOMException("Cancelled", "AbortError")); }, { once: true });
          });
          const res = await request(url, opts);
          const data = await res.clone().json();
          if (data.transcript) qa.transcripts.push(data.transcript);
          else qa.errors.push(data.code || res.status);
          return res;
        }
        if (url === "/api/chat") {
          metrics.chats++;
          const res = await request(url, opts);
          void res.clone().text().then(body => {
            let reply = "";
            for (const line of body.split("\n").filter(line => line.startsWith("data: "))) {
              const data = JSON.parse(line.slice(6));
              reply += data.text || "";
              if (data.done) metrics.done++;
            }
            qa.replies.push(reply);
          });
          return res;
        }
        return request(url, opts);
      };
      const speak = speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak = utterance => {
        qa.utterances.push(utterance.text);
        utterance.addEventListener("boundary", e => { qa.boundary = e.charIndex; });
        utterance.addEventListener("start", () => metrics.spoken++);
        utterance.addEventListener("end", () => metrics.ended++);
        utterance.addEventListener("error", e => qa.errors.push(e.error));
        speak(utterance);
      };
    }
    await evaluate("(" + installCapture.toString() + ")()");
    await evaluate("document.querySelector('[data-testid=mascot-assistant-trigger]').click()");
    const startButton = "document.querySelector('[aria-label=\"Start Voice Mode\"]')";
    const closeButton = "document.querySelector('[aria-label=\"Close Friday Voice Mode\"]')";
    const label = "document.querySelector('[data-testid=voice-state-label]')?.textContent";
    await until(startButton);
    await evaluate(startButton + ".click()");
    await until(label + " === 'Listening...'");
    await delay(13000);
    assert.equal(await evaluate("qa.metrics.uploads"), 0, "Silence submitted a recording");
    const play = index => evaluate("qa.play(" + JSON.stringify(fs.readFileSync(files[index]).toString("base64")) + ")");
    for (let i = 0; i < files.length; i++) {
      const before = await evaluate("qa.metrics.starts");
      await play(i);
      await until("qa.metrics.ended === " + (i + 1), 180000);
      await until(label + " === 'Listening...'");
      const m = await evaluate("qa.metrics");
      for (const key of ["uploads", "chats", "done", "spoken", "ended"]) assert.equal(m[key], i + 1, key);
      assert.equal(m.mic, 1);
      assert.ok(m.starts > before);
      const transcript = await evaluate("qa.transcripts.at(-1).toLowerCase().replace(/[^a-z0-9 ]/g,'').trim()");
      assert.equal(transcript, prompts[i]);
      assert.ok(await evaluate("qa.sizes.at(-1)>64 && qa.replies.at(-1).length>0 && qa.utterances.at(-1).length>0"));
      const spoken = await evaluate("qa.utterances.at(-1)");
      const reply = await evaluate("qa.replies.at(-1)");
      const words = value => value.toLowerCase().replace(/[^a-z0-9]/g, "");
      assert.equal(words(spoken), words(reply), "Speech differed from the completed SSE reply");
      console.log("PASS turn", i + 1, { bytes: await evaluate("qa.sizes.at(-1)"), completed: m.ended });
    }
    // A click-sized input should never be submitted.
    await evaluate("qa.play(" + JSON.stringify(fs.readFileSync(files[0]).toString("base64")) + ",0.02)");
    await delay(1500);
    assert.equal(await evaluate("qa.metrics.uploads"), 5);
    for (const mode of ["quota", "timeout", "close"]) {
      await evaluate("qa.mode=" + JSON.stringify(mode) + ";qa.aborted=false");
      await play(0);
      if (mode === "close") {
        await until(label + " === 'Processing speech...'");
        await evaluate(closeButton + ".click()");
        await until("qa.aborted && !" + closeButton);
      } else {
        await until(label + " === 'Microphone Notice'", 35000);
        if (mode === "timeout") assert.ok(await evaluate("qa.aborted"));
        await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Retry voice').click()");
        await until(label + " === 'Listening...'");
      }
    }
    await evaluate("qa.mode='deny';" + startButton + ".click()");
    await until(label + " === 'Microphone Notice'");
    assert.ok(await evaluate("document.querySelector('dialog').textContent.includes('Microphone access was denied')"));
    assert.equal(await evaluate("qa.metrics.chats"), 5);
    console.log("PASS silence, short input, quota, timeout, close during processing, microphone denial");
  } finally {
    const exited = new Promise(resolve => browser.once("exit", resolve));
    browser.kill();
    if (browser.exitCode === null && browser.signalCode === null) await exited;
    if (path.dirname(profile) === os.tmpdir() && path.basename(profile).startsWith("friday-chrome-")) {
      fs.rmSync(profile, { force: true, recursive: true, maxRetries: 4, retryDelay: 150 });
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
