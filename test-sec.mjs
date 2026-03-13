import axios from "axios";
import assert from "assert";
import { spawn } from "child_process";

const API_BASE = "http://localhost:3005";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("Starting production server...");
  const serverStr = spawn("node", ["api/server.js"], {
    // VERCEL=1 tricks server into strict origin mode, 
    // but NODE_ENV=development ensures app.listen is called.
    env: { ...process.env, PORT: "3005", VERCEL: "1", NODE_ENV: "development" },
    stdio: "inherit" // Pipe output so we can see DB connection errors
  });

  await sleep(4000); // Wait for boot

  console.log("\n--- Starting Security Tests ---");
  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.log(`❌ FAIL: ${name}`);
      console.error(err.response ? err.response.data : err.message);
      failed++;
    }
  };

  await test("CORS Preflight (OPTIONS) - Allowed Origin", async () => {
    const res = await axios.options(`${API_BASE}/api/health`, {
      headers: {
        "Origin": "https://acet-sports-seven.vercel.app",
        "Access-Control-Request-Method": "POST"
      }
    });
    assert.strictEqual(res.headers["access-control-allow-origin"], "https://acet-sports-seven.vercel.app");
    assert.strictEqual(res.headers["access-control-allow-credentials"], undefined, "Credentials should be disabled"); 
  });

  await test("CORS Preflight (OPTIONS) - Blocked Origin", async () => {
    const res = await axios.options(`${API_BASE}/api/health`, {
      headers: {
        "Origin": "https://malicious.com",
        "Access-Control-Request-Method": "POST"
      }
    });
    assert.notStrictEqual(res.headers["access-control-allow-origin"], "https://malicious.com");
  });

  await test("Origin Validation - Block POST without Origin/Referer", async () => {
    try {
      await axios.post(`${API_BASE}/api/submit-query`, { name: "test", email: "test@test.com", message: "test" });
      throw new Error("Should have been blocked");
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
      assert.strictEqual(err.response?.data?.error, "Access Denied: Invalid Origin.");
    }
  });

  await test("Origin Validation - Block POST with Malicious Origin", async () => {
    try {
      await axios.post(`${API_BASE}/api/submit-query`, 
        { name: "test", email: "test@test.com", message: "test" }, 
        { headers: { "Origin": "https://evil.com" } }
      );
      throw new Error("Should have been blocked");
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  await test("Origin Validation - Allow POST with Trusted Origin", async () => {
    try {
      await axios.post(`${API_BASE}/api/submit-query`, 
        { name: "test", email: "test@test.com", message: "test", regNo: "123" }, 
        { headers: { "Origin": "https://acetsports.favoflex.com", "Content-Type": "application/json" } }
      );
    } catch (err) {
      // It might 400 (validation) or 429 (rate limit), but NOT 403 Origin Block
      if (err.response?.status === 403) {
         throw new Error(`Failed with 403: ${JSON.stringify(err.response?.data)}`);
      }
    } // If it succeeds or 400s, it means CORS/Origin validation passed
  });

  await test("Helmet Security Headers Present", async () => {
     const res = await axios.get(`${API_BASE}/api/health`);
     assert.strictEqual(res.headers["x-frame-options"], "DENY");
     assert.strictEqual(res.headers["x-content-type-options"], "nosniff");
     assert.strictEqual(res.headers["referrer-policy"], "strict-origin-when-cross-origin");
  });

  console.log(`\nTests Complete: ${passed} Passed, ${failed} Failed`);
  
  serverStr.kill();
  if (failed > 0) process.exit(1);
}

runTests();
