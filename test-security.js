

const API_BASE = "http://localhost:3001";

async function runTests() {
    console.log("Starting Security Verification Tests...");

    // Test 1: NoSQL Injection Attempt (Admin Login OTP)
    console.log("\n[Test 1] NoSQL Injection Attempt on /api/admin-send-otp");
    try {
        const res = await fetch(`${API_BASE}/api/admin-send-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: { "$gt": "" } })
        });
        const data = await res.json();
        console.log("NoSQL Injection Response:", JSON.stringify(data));
        if (data.error && data.error.includes("Valid Admin Email is required")) {
            console.log("✅ PASS: NoSQL Injection payload was rejected safely.");
        } else {
            console.log("❌ FAIL: NoSQL Injection response differs from expectation.");
        }
    } catch (err) {
        console.error("Test 1 Error:", err);
    }

    // Test 2: XSS Payload Submission
    console.log("\n[Test 2] XSS Payload Attempt on /api/admin-login (Dummy submission)");
    try {
        const res = await fetch(`${API_BASE}/api/admin-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "<script>alert('xss')</script>admin@achariya.edu", otp: "123456" })
        });
        const data = await res.json();
        console.log("XSS Response:", JSON.stringify(data));
        // Since xss-clean escapes <script> to &lt;script&gt;, the lookup will fail but safely
        if (data.error === "OTP expired or not sent" || data.error === "Invalid OTP" || data.error === "Valid Admin Email is required") {
            console.log("✅ PASS: XSS payload handled safely without execution or crash.");
        } else {
            console.log("⚠️ WARN: Check XSS response behavior carefully.");
        }
    } catch (err) {
        console.error("Test 2 Error:", err);
    }
}

runTests();
