import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const PORT = 3005;

import { spawn } from "child_process";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("Starting production server...");
  const serverStr = spawn("node", ["server.js"], {
    env: { ...process.env, PORT: "3005", VERCEL: "1", NODE_ENV: "development" },
    stdio: "inherit"
  });

  await sleep(4000); // Wait for boot
  console.log("--- Starting JWT & Auth Tests ---");
  
  // Create a mock admin token
  const token = jwt.sign({ role: "admin", email: "test@acet.com" }, JWT_SECRET, { expiresIn: "4h" });

  
  // Test 1: Let's verify normal rejection first if we don't have blocklist.
  // We'll hit /api/logout, which should block the token.
  console.log("1. Hitting /api/logout...");
  const logoutRes = await fetch(`http://localhost:${PORT}/api/logout`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Origin": "https://acet-sports-seven.vercel.app" }
  });
  
  const logoutData = await logoutRes.json();
  if (!logoutData.success) {
    console.error("❌ Logout failed");
    process.exit(1);
  }
  console.log("✅ Logout successful, token should be in blocklist");

  // Test 2: Try using the blocked token to access a protected route
  console.log("2. Attempting to access protected route with revoked token...");
  const accessRes = await fetch(`http://localhost:${PORT}/api/secure-state`, {
    headers: { "Authorization": `Bearer ${token}`, "Origin": "https://acet-sports-seven.vercel.app" }
  });

  if (accessRes.status === 401) {
    console.log("✅ PASS: Server correctly rejected revoked token (401)");
  } else {
    console.error(`❌ FAIL: Server did not reject revoked token. Status: ${accessRes.status}`);
    process.exit(1);
  }

  console.log("Tests Complete: 2 Passed, 0 Failed");
  serverStr.kill();
  process.exit(0);
}

runTests();
