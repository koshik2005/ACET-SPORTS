import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from the api directory
dotenv.config({ path: path.join(__dirname, ".env") });

console.log("🛠️  Environment Check:");
console.log("FALLBACK_OTP:", process.env.FALLBACK_OTP ? "Found" : "Missing");
console.log("DEFAULT_OTP:", process.env.DEFAULT_OTP ? "Found" : "Missing");
console.log("IMGBB_API_KEY:", process.env.IMGBB_API_KEY ? "Found" : "Missing");
console.log("ADMIN_PASSWORD:", process.env.ADMIN_PASSWORD ? "Found" : "Missing");

import nodemailer from "nodemailer";
import cors from "cors";
import jwt from "jsonwebtoken";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import compression from "compression";
import bcrypt from "bcryptjs";
import { State, Otp, Query, InvalidatedToken } from "./models.js";

const app = express();
app.set("trust proxy", 1); // Trust first proxy (required for Vercel/Render rate limiting)
app.set("query parser", "simple"); // Use simple parser to avoid immutable getters in Express 5
app.use(compression()); // gzip all responses — reduces bandwidth by ~70%
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://i.ibb.co", "https://*.vercel.app"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://res.cloudinary.com", "https://*.vercel.app", "http://localhost:*", "http://127.0.0.1:*"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
      frameAncestors: ["'none'"] // Prevent clickjacking
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xFrameOptions: { action: "deny" }
}));
// Explicitly loaded exact allowlist (no dynamic reflection unless matched)
const allowedOrigins = [
  "https://acet-sports-seven.vercel.app",
  "https://acetsports.favoflex.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];

const corsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false // Explicitly disabled: API uses JWT Bearer tokens, not cross-origin cookies.
};

// Apply standard CORS middleware. It handles preflight (OPTIONS) automatically.
app.use(cors(corsOptions));

app.use(express.json({ limit: "20mb" })); // allow larger payloads for image base64

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-change-in-production";

// Rate Limiters - tightened for abuse protection
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 300, // Reduced from 1000 for strict abuse protection
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: { error: "Too many requests from this IP, please try again after 15 minutes" }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Reduced from 50 to prevent brute force
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: { error: "Too many login attempts, please try again later" }
});

app.use("/api/", globalLimiter);

// Make sure caching layers respect Origin differences
app.use((req, res, next) => {
  res.setHeader("Vary", "Origin");
  next();
});

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Max 10 queries per IP per 15m
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: { error: "Too many query submissions. Please try again later." }
});

const otpVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 15, // Max 15 OTP verifications or registrations per 5m
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: { error: "Too many OTP attempts." }
});

const otpStore = {}; // DEPRECATED: Use Otp model

// ─── Security: Origin Validation (Defense in Depth) ─────────────────────────
// This middleware ensures that sensitive state-changing state requests 
// genuinely originate from our trusted frontends, adding a layer of protection 
// beyond just CORS, especially for non-browser abuse.
const requireValidOrigin = (req, res, next) => {
  // Only apply to POST/PUT/DELETE requests
  if (req.method === "GET" || req.method === "OPTIONS") return next();

  let origin = req.headers.origin;
  let referer = req.headers.referer;

  // Clean trailing slashes for comparison
  if (origin && origin.endsWith('/')) origin = origin.slice(0, -1);
  if (referer && referer.endsWith('/')) referer = referer.slice(0, -1);

  // The actual host of the server (e.g. localhost:3001, acet-sports.vercel.app)
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  const hostBase = host.split(":")[0];

  const isValidOrigin = allowedOrigins.includes(origin);
  const isValidReferer = allowedOrigins.some(allowed => referer?.startsWith(allowed));
  // Allow if the origin/referer matches the server's own host (same-origin, e.g. postman testing locally while developing if needed, though strictly we want frontend origins)
  const isSameOriginHost = allowedOrigins.some(allowed => allowed.includes(hostBase));

  const isProd = process.env.VERCEL || process.env.NODE_ENV === "production";

  // In production, we strictly require a valid Origin OR Referer matching our allowlist for state changes
  if (isProd) {
      if (!isValidOrigin && !isValidReferer) {
          console.warn(`🛡️ Blocked state-changing request. Missing/Invalid Origin. Origin: ${origin}, Referer: ${referer}`);
          return res.status(403).json({ error: "Access Denied: Invalid Origin." });
      }
  }

  next();
};

app.use("/api/", requireValidOrigin);

// ─── In-Memory State Cache ─────────────────────────────────────────────────────
// Cache the public state for 30 seconds so 3000 simultaneous page loads
// don't all hammer MongoDB at exactly the same time.
let stateCache = { data: null, ts: 0 };
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

const invalidateCache = () => { stateCache = { data: null, ts: 0 }; };

// ─── MongoDB Connection (Singleton for Vercel) ──────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/achariya_sports";

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb && mongoose.connection.readyState === 1) return cachedDb;

  console.log("📡 Connecting to MongoDB...");
  cachedDb = await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log("🍃 Connected to MongoDB");
  return cachedDb;
}

// Middleware to ensure DB is connected before any request
const withDb = async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    console.error("❌ DB CONNECTION ERROR:", err.message);
    res.status(503).json({ error: "Database temporarily unavailable", details: err.message });
  }
};

app.use("/api/", withDb); // Apply to all /api routes

// ─── Database Helpers ──────────────────────────────────────────────────────
const getInitialState = () => ({
  houses: [],
  authorities: [],
  management: [],
  studentCommittee: [],
  games: [],
  gallery: [],
  registrations: [],
  pointLog: [],
  studentsDB: [],
  results: [],
  sportGamesList: [],
  athleticsList: [],
  authorityRoles: [],
  managementRoles: [],
  nav: ["Home", "Events", "Registration", "Scoreboard", "Star Players", "Gallery", "Captain", "Admin"],
  eventDate: { date: "", time: "" },
  memorial: { enabled: false, name: "", description: "", images: [] },
  emptyGame: { name: "", venue: "", official: "", status: "Upcoming", start: "", end: "", participants: "" },
});


// Redundant public-state handler removed. Unified below at line 325.

const loadDb = async () => {
  const state = await State.findOne();
  if (!state) {
    // SAFETY: Never silently create a blank document.
    // If the collection is unexpectedly empty, surface the error clearly
    // instead of overwriting data with a blank state.
    throw new Error("No state document found in database. Contact admin.");
  }
  return state;
};

const saveDb = async (data) => {
  // Not used anymore as we use findOneAndUpdate for atomic updates, 
  // but keeping signature for minimal refactor if needed.
  await State.findOneAndUpdate({}, data, { upsert: true });
};

// ─── Transporter ───────────────────────────────────────────────────────────
function makeTransporter() {
  const user = process.env.SMTP_USER || process.env.EMAIL;
  const pass = process.env.SMTP_PASS || process.env.APP_PASSWORD;
  return nodemailer.createTransport({
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

// ─── Middleware ────────────────────────────────────────────────────────────
const authenticateAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const isBlocked = await InvalidatedToken.exists({ token });
    if (isBlocked) return res.status(401).json({ error: "Session revoked. Please log in again." });

    const state = await loadDb();
    if (token !== state.activeAdminToken) return res.status(401).json({ error: "Session expired. Another admin has logged in." });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") return res.status(403).json({ error: "Access denied" });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

const authenticateCaptainOrAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const isBlocked = await InvalidatedToken.exists({ token });
    if (isBlocked) return res.status(401).json({ error: "Session revoked. Please log in again." });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role === "admin") {
      const state = await loadDb();
      if (token !== state.activeAdminToken) return res.status(401).json({ error: "Session expired. Another admin has logged in." });
      req.user = decoded;
      return next();
    }
    if (decoded.role === "captain") {
      req.user = decoded;
      return next();
    }
    return res.status(403).json({ error: "Access denied" });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// ─── Health / config check ─────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString()
  });
});
app.get("/api/health", async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";
    res.json({
      status: "OK",
      db: dbStatus,
      uriHint: MONGODB_URI ? MONGODB_URI.substring(0, 20) + "..." : "NONE",
      env: {
        node: process.version,
        env: process.env.NODE_ENV,
        hasMongo: !!process.env.MONGODB_URI,
        hasSmtp: !!((process.env.SMTP_USER || process.env.EMAIL) && (process.env.SMTP_PASS || process.env.APP_PASSWORD))
      }
    });
  } catch (err) {
    res.status(500).json({ status: "ERROR", error: err.message });
  }
});

app.get("/api/public-state", async (req, res) => {
  try {
    // Serve from cache if fresh
    if (stateCache.data && Date.now() - stateCache.ts < CACHE_TTL_MS) {
      return res.json(stateCache.data);
    }

    const state = await loadDb();
    // Strip passwords from houses before sending
    const sanitizedHouses = state.houses.map(h => {
      const hSafe = h.toObject ? h.toObject() : { ...h };
      ["boysCaptain", "girlsCaptain", "viceCaptainBoys", "viceCaptainGirls", "staffCaptainMale", "staffCaptainFemale"].forEach(role => {
        if (hSafe[role]) delete hSafe[role].password;
      });
      return hSafe;
    });

    const result = { ...state.toObject ? state.toObject() : state, houses: sanitizedHouses };
    
    // SECURITY: Strip out sensitive database fields from public state.
    // These should only be queried via /api/secure-state by authenticated admins.
    delete result.activeAdminToken;
    delete result.studentsDB;
    delete result.registrations;
    delete result.adminLogs;
    delete result.pointLog;

    stateCache = { data: result, ts: Date.now() }; // update cache
    res.json(result);
  } catch (err) {
    console.error("STATE ERROR:", err);
    res.status(500).json({ error: "Failed to load state", details: err.message });
  }
});

app.get("/api/secure-state", authenticateCaptainOrAdmin, async (req, res) => {
  try {
    const state = await loadDb();
    const isAdmin = !!req.headers.authorization?.startsWith("Bearer admin-"); // Simplified check: in our system, admin tokens are prefixed or we check role
    
    // Better check: use the token to determine if it's admin or captain
    const token = req.headers.authorization?.split(" ")[1];
    let user;
    try { user = jwt.verify(token, JWT_SECRET); } catch(e) { return res.status(401).json({ error: "Invalid token" }); }

    if (user.role === "admin") {
      return res.json(state);
    } else if (user.role === "captain") {
      // Sanitize state for captain: only show their house's registrations
      const result = { ...state.toObject ? state.toObject() : state };
      result.studentsDB = (result.studentsDB || []).filter(s => s.house === user.house);
      result.registrations = (result.registrations || []).filter(r => r.house === user.house);
      
      // Still hide sensitive admin-only stuff
      delete result.activeAdminToken;
      delete result.adminLogs;
      
      return res.json(result);
    }

    res.status(403).json({ error: "Unauthorized" });
  } catch (err) {
    res.status(500).json({ error: "Failed to load state" });
  }
});


app.get("/api/state", (req, res) => {
  // Redirect old /api/state to public-state for backwards compatibility momentarily
  res.redirect("/api/public-state");
});

app.post("/api/update-state", authenticateCaptainOrAdmin, async (req, res) => {
  try {
    const { type, data } = req.body;

    // SECURITY: Whitelist of allowed state properties to update.
    // Prevents arbitrary injection into the State document.
    const allowedTypes = [
      "houses", "authorities", "management", "studentCommittee", "games", "gallery", 
      "registrations", "pointLog", "studentsDB", "results", "sportGamesList", 
      "sportGamesListWomens", "staffGamesList", "staffGamesListWomens", "athleticsList", 
      "athleticsListWomens", "authorityRoles", "managementRoles", "nav", 
      "registrationOpen", "eventDate", "emptyGame", "starPlayers", "closedEvents",
      "maxGames", "maxAthletics", "registrationCloseTime", "launchConfig", "inaugurationDetails", "memorial"
    ];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: `Unauthorized update type: ${type}` });
    }

    // Authorization Check: Captains can no longer use this endpoint bulk update. 
    // They must use the specific /api/captain-toggle-tshirt endpoint.
    if (req.user.role === "captain") {
      return res.status(403).json({ error: "Captains cannot use the bulk update API. Please use the specific endpoints." });
    }

    // Prepare update payload
    // For Houses, hash unhashed passwords before saving
    if (type === "houses" && Array.isArray(data)) {
      const roles = ["boysCaptain", "girlsCaptain", "viceCaptainBoys", "viceCaptainGirls", "staffCaptainMale", "staffCaptainFemale"];
      for (let hItem of data) {
        for (let role of roles) {
          if (hItem[role]?.password) {
            const pw = String(hItem[role].password);
            // Only hash if it's not already a bcrypt hash
            if (!pw.startsWith("$2y$") && !pw.startsWith("$2b$") && !pw.startsWith("$2a$")) {
              hItem[role].password = await bcrypt.hash(pw, 10);
            }
          }
        }
      }
    }

    let updatePayload = { [type]: data };

    // Audit Log for Admin Changes
    if (req.user.role === "admin" && (req.user.email || req.user.name)) {
      updatePayload.$push = {
        adminLogs: {
          type: "CHANGE",
          email: req.user.email || req.user.name,
          action: `Updated configuration: ${type}`,
          timestamp: new Date()
        }
      };
    }

    // Atomic update in MongoDB
    console.log(`[STATE_UPDATE] User:${req.user.email || req.user.name} Type:${type} DataSize:${JSON.stringify(data).length} chars`);
    
    const result = await State.findOneAndUpdate({}, updatePayload, { upsert: true, new: true, rawResult: true });
    
    if (result) {
        console.log(`[STATE_UPDATE_SUCCESS] Updated Document ID: ${result.value?._id || result._id}`);
    }

    invalidateCache(); // clear state cache so next fetch gets fresh data
    res.json({ success: true });
  } catch (err) {
    console.error("[STATE_UPDATE_ERROR]", err);
    res.status(500).json({ error: "Failed to update state: " + err.message });
  }
});

app.post("/api/clear-admin-logs", authenticateAdmin, async (req, res) => {
  try {
    await State.findOneAndUpdate({}, { $set: { adminLogs: [] } });
    invalidateCache();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear admin logs" });
  }
});

app.post("/api/send-otp", loginLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000 }; // 5 mins

  try {
    const transporter = makeTransporter();
    await transporter.sendMail({
      from: `"Sports Day ERP" <${process.env.SMTP_USER || process.env.EMAIL}>`,
      to: email,
      subject: `🗝️ Your Registration OTP — Achariya Sports`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 400px; margin: auto;">
          <h2 style="color: #8B0000; text-align: center;">Verification Code</h2>
          <p style="text-align: center; font-size: 16px;">Use the code below to verify your identity and complete your event registration.</p>
          <div style="background: #f8f9ff; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 5px; color: #222;">${otp}</span>
          </div>
          <p style="font-size: 12px; color: #888; text-align: center;">This code will expire in 5 minutes. If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    // Persistent storage
    await Otp.findOneAndUpdate({ email, type: "student" }, { otp, createdAt: new Date() }, { upsert: true });

    res.json({ success: true });
  } catch (err) {
    console.error("OTP Error:", err);
    res.status(500).json({ error: "Failed to send OTP. Check SMTP settings." });
  }
});

// ── Secure Student Lookup (For Registration) ──────────────────────────
const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 lookups per window
  message: { error: "Too many lookup attempts. Please try again later." }
});

app.get("/api/lookup-student", lookupLimiter, async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Search query required" });

  const state = await State.findOne();
  if (!state || !state.studentsDB) return res.status(500).json({ error: "Database error" });

  const student = state.studentsDB.find(s => 
    s.email?.toLowerCase() === query.trim().toLowerCase() || 
    s.regNo?.toLowerCase() === query.trim().toLowerCase()
  );

  if (!student) return res.status(404).json({ error: "Student not found" });

  // Check if student is already registered
  const registration = (state.registrations || []).find(r => 
    r.email?.toLowerCase() === student.email?.toLowerCase() || 
    r.regNo?.toLowerCase() === student.regNo?.toLowerCase()
  );

  // Return ONLY necessary non-sensitive info + registration status
  res.json({
    success: true,
    student: {
      name: student.name,
      email: student.email,
      regNo: student.regNo,
      house: student.house,
      year: student.year,
      dept: student.dept,
      gender: student.gender,
      role: student.role,
      hasGame: !!(registration?.game && !["None", "—", ""].includes(registration.game)),
      hasAthletic: !!(registration?.athletic && !["None", "—", ""].includes(registration.athletic)),
      alreadyRegistered: !!(
        (registration?.game && !["None", "—", ""].includes(registration.game)) || 
        (registration?.athletic && !["None", "—", ""].includes(registration.athletic))
      ),
      isPartial: !!registration && (
        (!registration.game || ["None", "—", ""].includes(registration.game)) !== 
        (!registration.athletic || ["None", "—", ""].includes(registration.athletic))
      ),
      existingRegistration: registration || null
    }
  });
});

app.post("/api/register-event", otpVerifyLimiter, async (req, res) => {
  const { email, otp, game, athletic } = req.body;
  if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });

  try {
    // 1. Verify OTP first
    const defaultOtp = process.env.DEFAULT_OTP;
    const stored = await Otp.findOne({ email, type: "student" });
    
    const isOtpValid = (stored && stored.otp === otp) || (defaultOtp && otp === defaultOtp);
    
    if (!isOtpValid) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // 2. Get student details from DB
    const state = await State.findOne();
    const student = state.studentsDB.find(s => s.email?.toLowerCase() === email.toLowerCase());
    if (!student) return res.status(404).json({ error: "Student profile not found" });

    // 3. Create/Merge registration object
    const existingIndex = (state.registrations || []).findIndex(r => 
      r.email?.toLowerCase() === student.email?.toLowerCase() || 
      r.regNo?.toLowerCase() === student.regNo?.toLowerCase()
    );

    let finalReg;
    if (existingIndex > -1) {
      // Merge: keep old events if not being overwritten by new ones
      const old = state.registrations[existingIndex];
      finalReg = {
        ...old,
        game: game || old.game || "",
        athletic: athletic || old.athletic || "",
        registeredAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) // Update timestamp on merge
      };
      
      // Atomic Update: Remove old, add new
      await State.findOneAndUpdate({}, {
        $pull: { registrations: { regNo: student.regNo } }
      });
    } else {
      finalReg = {
        name: student.name,
        email: student.email,
        regNo: student.regNo,
        house: student.house,
        game: game || "",
        athletic: athletic || "",
        registeredAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      };
    }

    await State.findOneAndUpdate({}, {
      $push: { registrations: finalReg }
    });

    // 4. Cleanup OTP (if it was a one-time OTP)
    if (stored) {
      await Otp.deleteOne({ _id: stored._id });
    }
    
    invalidateCache();
    res.json({ success: true, registration: finalReg });
  } catch (err) {
    console.error("REGISTRATION ERROR:", err);
    res.status(500).json({ error: "Failed to register: " + err.message });
  }
});

app.post("/api/verify-otp", otpVerifyLimiter, async (req, res) => {
  const { email, otp } = req.body;
  const defaultOtp = process.env.DEFAULT_OTP;
  
  if (defaultOtp && otp === defaultOtp) {
    return res.json({ success: true });
  }

  const stored = await Otp.findOne({ email, type: "student" });

  if (!stored) return res.status(400).json({ success: false, error: "No OTP found for this email" });
  if (stored.otp !== otp) return res.status(400).json({ success: false, error: "Invalid OTP" });
  res.json({ success: true });
});

// ─── Student Queries ─────────────────────────────────────────────────────────

app.post("/api/submit-query", submitLimiter, async (req, res) => {
  const { regNo, studentName, issueType, details } = req.body;
  if (!regNo || !studentName || !issueType || !details) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const q = new Query({ regNo, studentName, issueType, details });
    await q.save();
    res.json({ success: true, message: "Your query has been submitted. Admin will resolve it soon." });
  } catch (err) {
    res.status(500).json({ error: "Failed to submit query" });
  }
});

app.get("/api/admin-queries", authenticateAdmin, async (req, res) => {
  try {
    const queries = await Query.find().sort({ createdAt: -1 });
    res.json(queries);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch queries" });
  }
});

app.post("/api/admin-resolve-query", authenticateAdmin, async (req, res) => {
  const { id, status } = req.body;
  try {
    await Query.findByIdAndUpdate(id, { status: status || "Resolved" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update query status" });
  }
});

// ─── Admin Authentication ────────────────────────────────────────────────────────
const adminOtpStore = {}; // DEPRECATED: Use Otp model

app.post("/api/admin-send-otp", loginLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Valid Admin Email is required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  adminOtpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000 };

  try {
    const transporter = makeTransporter();
    await transporter.sendMail({
      from: `"Sports Day Admin" <${process.env.SMTP_USER || process.env.EMAIL}>`,
      to: email,
      subject: `🗝️ Admin Login OTP — Achariya Sports`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 400px; margin: auto;">
          <h2 style="color: #8B0000; text-align: center;">Admin Login Code</h2>
          <p style="text-align: center; font-size: 16px;">Use the code below to access the Admin Panel.</p>
          <div style="background: #f8f9ff; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 5px; color: #8B0000;">${otp}</span>
          </div>
          <p style="font-size: 12px; color: #888; text-align: center;">This code will expire in 5 minutes.</p>
        </div>
      `,
    });

    // Persistent storage
    await Otp.findOneAndUpdate({ email, type: "admin" }, { otp, createdAt: new Date() }, { upsert: true });

    res.json({ success: true });
  } catch (err) {
    console.error("ADMIN OTP EMAIL ERROR:", err);
    // Return the actual error so user can debug (e.g. SMTP failures)
    res.status(500).json({ success: false, error: "Failed to send email: " + err.message });
  }
});

// ─── Admin Password Verification (Step 2 of 3) ──────────────────────────────
app.post("/api/admin-verify-password", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, error: "Email and password are required" });

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).json({ success: false, error: "Server Configuration Error: ADMIN_PASSWORD not set in environment." });
  }

  if (password !== adminPassword) {
    return res.status(401).json({ success: false, error: "Incorrect admin password." });
  }

  res.json({ success: true });
});

app.post("/api/admin-login", loginLimiter, async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !email.trim() === "" || !otp) return res.status(400).json({ success: false, error: "Email and OTP are required" });

  const em = email.trim();
  const fallbackOtp = process.env.FALLBACK_OTP;
  const isFallback = fallbackOtp && String(otp).trim() === String(fallbackOtp).trim();
  const stored = await Otp.findOne({ email: em, type: "admin" });

  if (!isFallback) {
    if (!stored) return res.status(400).json({ error: "OTP expired or not sent" });
    if (String(stored.otp) !== String(otp)) return res.status(400).json({ error: "Invalid OTP" });
  }

  if (stored) await Otp.deleteOne({ _id: stored._id });

  const token = jwt.sign({ role: "admin", name: em, email: em }, JWT_SECRET, { expiresIn: "4h" });

  // Log login to DB and set active token
  await State.findOneAndUpdate({}, {
    $set: { activeAdminToken: token },
    $push: {
      adminLogs: {
        type: "LOGIN",
        email: em,
        action: "Admin Logged In",
        timestamp: new Date()
      }
    }
  }, { upsert: true });

  res.json({ success: true, token });
});

app.post("/api/captain-login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) return res.status(400).json({ error: "Missing email or password." });

  const em = email.trim().toLowerCase();
  const state = await loadDb();

  let valid = false;
  let loggedInRole = "";
  let houseId = "";

  // Search all houses and all roles for this email
  for (const houseObj of state.houses) {
    const roles = ["boysCaptain", "girlsCaptain", "viceCaptainBoys", "viceCaptainGirls", "staffCaptainMale", "staffCaptainFemale"];
    for (const role of roles) {
      const captain = houseObj[role];
      if (captain && captain.email && captain.email.trim().toLowerCase() === em) {
        const storedPw = captain.password || "";
        let isMatch = false;
        // If it looks like a bcrypt hash, compare it; otherwise, do a plain text check
        if (storedPw.startsWith("$2b$") || storedPw.startsWith("$2a$") || storedPw.startsWith("$2y$")) {
          isMatch = await bcrypt.compare(password, storedPw);
        } else {
          isMatch = (password === storedPw);
        }

        if (isMatch) {
          valid = true;
          loggedInRole = role;
          houseId = houseObj.id;
        } else {
          console.log(`❌ Login failed for ${em}: Password mismatch.`);
        }
      }
    }
    if (valid) break;
  }

  if (valid) {
    console.log(`✅ Captain logged in: ${em} (${loggedInRole} in House ${houseId})`);
    const token = jwt.sign({ role: "captain", house: houseId, houseRole: loggedInRole }, JWT_SECRET, { expiresIn: "2h" });

    // Find house details to return
    const houseObj = state.houses.find(h => h.id === houseId);

    res.json({
      success: true,
      token,
      houseId: houseObj?.id,
      houseRole: loggedInRole,
      houseName: houseObj?.name || "House",
      houseDisplayName: houseObj?.displayName || "",
      houseColor: houseObj?.color || "#8B0000",
      captainName: houseObj?.[loggedInRole]?.name || "Captain"
    });
  } else {
    console.log(`❌ Login failed for ${em}: No matching email/password found in any house.`);
    res.status(401).json({ success: false, error: "Invalid email or password." });
  }
});

app.post("/api/logout", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.json({ success: true });

  try {
    const decoded = jwt.decode(token);
    // If the token is validly formed and has an expiration, add to blocklist
    if (decoded && decoded.exp) {
      // Set the document to explicitly expire when the token expires
      await InvalidatedToken.findOneAndUpdate(
        { token },
        { token, expiresAt: new Date(decoded.exp * 1000) },
        { upsert: true }
      );
      console.log(`🔒 Token firmly invalidated until expiry: ${new Date(decoded.exp * 1000)}`);
    }
  } catch (err) {
    console.warn("Logout Token Invalidation Error:", err.message);
  }
  
  res.json({ success: true });
});

app.post("/api/captain-update-house-name", authenticateCaptainOrAdmin, async (req, res) => {
  const { houseId, displayName } = req.body;
  
  if (!houseId || !displayName) {
    return res.status(400).json({ error: "Missing houseId or displayName." });
  }

  // Security: Captain can only update THEIR own house
  if (req.user.role === "captain" && req.user.house !== houseId) {
    return res.status(403).json({ error: "Access Denied: You can only rename your own house." });
  }

  try {
    const state = await loadDb();
    const houseIndex = state.houses.findIndex(h => h.id === houseId);
    
    if (houseIndex === -1) {
      return res.status(404).json({ error: "House not found." });
    }

    // Atomic update using findOneAndUpdate to avoid race conditions
    const update = {};
    update[`houses.${houseIndex}.displayName`] = displayName.trim();
    
    await State.findOneAndUpdate({}, { $set: update });
    invalidateCache();

    res.json({ success: true, displayName: displayName.trim() });
  } catch (err) {
    console.error("HOUSE RENAME ERROR:", err);
    res.status(500).json({ error: "Failed to update house name.", details: err.message });
  }
});

app.post("/api/captain-toggle-tshirt", authenticateCaptainOrAdmin, async (req, res) => {
  const { regNo, shirtIssued } = req.body;

  if (!regNo || typeof shirtIssued !== "boolean") {
    return res.status(400).json({ error: "Missing regNo or invalid shirtIssued status." });
  }

  try {
    const state = await loadDb();
    const studentIndex = state.studentsDB.findIndex(s => s.regNo === regNo);

    if (studentIndex === -1) {
      return res.status(404).json({ error: "Student not found." });
    }

    const student = state.studentsDB[studentIndex];

    // Security: Captains can only update students within THEIR own house.
    if (req.user.role === "captain" && req.user.house && student.house !== req.user.house) {
      return res.status(403).json({ error: "Access Denied: You can only update T-shirts for students in your own house." });
    }

    // Atomic update using findOneAndUpdate to target ONLY the specific student's shirtIssued field
    const update = {};
    update[`studentsDB.${studentIndex}.shirtIssued`] = shirtIssued;

    await State.findOneAndUpdate({}, { $set: update });
    invalidateCache();

    res.json({ success: true, regNo, shirtIssued });
  } catch (err) {
    console.error("T-SHIRT TOGGLE ERROR:", err);
    res.status(500).json({ error: "Failed to update T-shirt status.", details: err.message });
  }
});

app.get("/api/email-config", (req, res) => {
  res.json({
    configured: !!((process.env.SMTP_USER || process.env.EMAIL) && (process.env.SMTP_PASS || process.env.APP_PASSWORD)),
    user: process.env.SMTP_USER || process.env.EMAIL || "",
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT || "587",
  });
});

app.get("/api/check-email-connection", async (req, res) => {
  try {
    const transporter = makeTransporter();
    await transporter.verify();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Send credentials email ────────────────────────────────────────────────
app.post("/api/send-captain-email", authenticateAdmin, async (req, res) => {
  const { captainName, captainEmail, password, house, role, portalUrl, authorities, studentsDB } = req.body;

  if (!captainEmail || !password || !captainName) {
    return res.status(400).json({ error: "Missing required fields: captainName, captainEmail, password" });
  }

  // Safety check: Don't send hashed passwords!
  if (password.startsWith("$2b$") || password.startsWith("$2a$") || password.startsWith("$2y$")) {
    return res.status(400).json({ error: "Security Alert: Cannot send a hashed password. Please enter the plain-text password in the Admin Panel." });
  }
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL;
  const smtpPass = process.env.SMTP_PASS || process.env.APP_PASSWORD;
  if (!smtpUser || !smtpPass) {
    return res.status(400).json({ error: "SMTP not configured. Set SMTP_USER and SMTP_PASS (or EMAIL and APP_PASSWORD) in .env" });
  }

  const loginUrl = portalUrl || process.env.PORTAL_URL || "http://localhost:5173/captain";
  // Attempt to find student year/dept
  const student = studentsDB?.find(s => s.email?.toLowerCase() === captainEmail.toLowerCase());
  const studentYear = student?.year || "Student";

  const houseColors = { RED: "#FF0000", BLUE: "#0000FF", GREEN: "#008000", YELLOW: "#FFFF00", PURPLE: "#800080" };
  const houseColor = houseColors[house.toUpperCase()] || "#8B0000";

  const transporter = makeTransporter();

  // 1. Send Congratulatory Email to Captain
  const captainHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:32px 0;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);max-width:540px;">
        <tr><td style="background:linear-gradient(135deg,#8B0000,#C41E3A);padding:32px 36px;text-align:center;">
          <div style="font-size:40px;margin-bottom:8px;">🎉</div>
          <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;">Congratulations!</h1>
          <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px;">Achariya College of Engineering Technology — Sports Day 2025</p>
        </td></tr>
        <tr><td style="padding:24px 36px 0;text-align:center;">
          <div style="display:inline-block;background:${houseColor}18;border:2px solid ${houseColor};border-radius:50px;padding:8px 22px;">
            <span style="color:${houseColor};font-weight:800;font-size:15px;">🏠 ${house} House &nbsp;·&nbsp; ${role}</span>
          </div>
        </td></tr>
        <tr><td style="padding:24px 36px;">
          <p style="font-size:16px;color:#333;margin:0 0 20px;">Hello <strong>${captainName}</strong>,</p>
          <p style="font-size:15px;color:#555;margin:0 0 24px;line-height:1.6;">
            We are thrilled to inform you that you have been appointed as the <strong>${role}</strong> for <strong>${house} House</strong>! 
            Your leadership and spirit are key to your house's success this year.
          </p>
          <div style="background:#f8f9ff;border:1.5px solid #c0c0ff;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#8B0000;text-transform:uppercase;margin-bottom:14px;">🔐 Your Portal Login ID & Password</div>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:8px 0;border-bottom:1px solid #eee;">
                <span style="font-size:12px;color:#888;font-weight:600;">LOGIN ID (EMAIL)</span><br>
                <span style="font-size:15px;color:#222;font-weight:700;font-family:monospace;">${captainEmail}</span>
              </td></tr>
              <tr><td style="padding:8px 0;">
                <span style="font-size:12px;color:#888;font-weight:600;">PASSWORD</span><br>
                <span style="font-size:15px;color:#222;font-weight:700;font-family:monospace;">${password}</span>
              </td></tr>
            </table>
          </div>
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#8B0000,#C41E3A);color:#fff;text-decoration:none;padding:14px 36px;border-radius:50px;font-size:15px;font-weight:700;letter-spacing:.3px;">
              ⚡ Access Captain Portal →
            </a>
          </div>
          <p style="font-size:12px;color:#aaa;margin:0;text-align:center;">Sent from the Sports Authority of ACET.</p>
        </td></tr>
        <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:16px 36px;text-align:center;">
          <p style="font-size:11px;color:#aaa;margin:0;">© 2025 Achariya College of Engineering Technology · Sports Day ERP</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    // Send to Captain
    await transporter.sendMail({
      from: `"Sports Day ERP" <${process.env.SMTP_USER || process.env.EMAIL}>`,
      to: captainEmail,
      subject: `🎉 Congratulations ${captainName}! You are the ${house} House ${role}`,
      html: captainHtml,
    });

    // 2. Notify Authorities
    if (authorities && Array.isArray(authorities)) {
      const authSubject = `🔔 New Assignment: ${captainName} (${studentYear}) as ${role}`;
      const authHtml = `
        <div style="font-family:sans-serif; padding:20px; border:1px solid #eee; border-radius:10px;">
          <h3 style="color:#8B0000;">New Captain Assignment</h3>
          <p>This is to inform the Management & Sports Authority that a new appointment has been made:</p>
          <ul style="list-style:none; padding:0;">
            <li><strong>Captain:</strong> ${captainName}</li>
            <li><strong>Year/Dept:</strong> ${studentYear}</li>
            <li><strong>House:</strong> ${house} House</li>
            <li><strong>Role:</strong> ${role}</li>
            <li><strong>Assignment Time:</strong> ${new Date().toLocaleString()}</li>
          </ul>
          <p style="font-size:12px; color:#666;">This notification was automatically generated by the Sports Day ERP.</p>
        </div>
      `;

      for (const auth of authorities) {
        if (auth.email && auth.email.includes("@")) {
          await transporter.sendMail({
            from: `"Sports ERP System" <${process.env.SMTP_USER || process.env.EMAIL}>`,
            to: auth.email,
            subject: authSubject,
            html: authHtml,
          });
          console.log(`📡 Notification sent to Authority: ${auth.name} (${auth.email})`);
        }
      }
    }

    console.log(`✅ Assignment complete. Emails sent to ${captainEmail} and authorities.`);
    res.json({ success: true, message: `Congratulatory email and authority notifications sent.` });
  } catch (err) {
    console.error("❌ Notification error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/send-event-announcement", authenticateAdmin, async (req, res) => {
  const { type, date, time, venue, portalUrl, authorities = [], management = [], studentsDB = [], recipients = [], invitationFile, invitationFileName, regardsNames } = req.body;

  const isInauguration = type === "inauguration";
  const transporter = makeTransporter();
  const displayDate = new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  // Use provided recipients chunk if available, otherwise fallback to all
  const allUsers = recipients.length > 0 ? recipients : [
    ...authorities.map(a => ({ ...a, roleType: "authority" })),
    ...management.map(m => ({ ...m, roleType: "management" })),
    ...studentsDB.map(s => ({ ...s, roleType: s.role === "Staff" ? "staff" : "student" }))
  ];

  const results = { success: 0, failed: 0 };

  for (const user of allUsers) {
    if (!user.email || !user.email.includes("@")) continue;

    let subject, html;

    if (isInauguration) {
      subject = "Invitation for Sports Day Inauguration";
      const roleLower = (user.role || "").toLowerCase();
      const name = user.name || "Guest";
      const dept = user.dept || "Department";
      const isHigherOfficial = roleLower.includes("principal") || roleLower.includes("managing director") || roleLower.includes("md") || roleLower.includes("hod") || roleLower.includes("head");

      if (isHigherOfficial) {
        html = `
        <div style="font-family:'Segoe UI',Arial,sans-serif; padding:40px; color:#222; max-width:600px; margin:auto; border:1px solid #eee; line-height:1.6;">
          <p>Respected ${name},<br/>
          Head of the Department, ${dept}</p>
          <p>Greetings from Achariya College of Engineering Technology.</p>
          <p>On behalf of the Department of Physical Education, I am pleased to invite you to grace the Sports Day Inauguration Ceremony of our institution. Your esteemed presence will be a great honor and will serve as an inspiration to our students participating in the sports events.</p>
          <div style="background:#f9f9f9; padding:20px; border-left:4px solid #8B0000; margin:20px 0;">
            <strong>📍 Venue:</strong> ${venue || "Auditorium"}<br/>
            <strong>🕒 Date:</strong> ${displayDate}<br/>
            <strong>🕒 Time:</strong> ${time || "3:00 PM – 4:00 PM"}
          </div>
          <p>We sincerely hope you will kindly accept our invitation and grace the occasion with your presence.</p>
          <p>Thank you.</p>
          <p>Warm regards,<br/><strong>Physical Education Director</strong><br/>Achariya College of Engineering Technology</p>
        </div>`;
      } else {
        html = `
        <div style="font-family:'Segoe UI',Arial,sans-serif; padding:40px; color:#222; max-width:600px; margin:auto; border:1px solid #eee; line-height:1.6;">
          <p>Dear ${name},</p>
          <p>Greetings!</p>
          <p>You are cordially invited to attend the Sports Day Inauguration Ceremony of Achariya College of Engineering Technology.</p>
          <div style="background:#f9f9f9; padding:20px; border-left:4px solid #8B0000; margin:20px 0;">
            <strong>📍 Venue:</strong> ${venue || "Auditorium"}<br/>
            <strong>🕒 Date:</strong> ${displayDate}<br/>
            <strong>🕒 Time:</strong> ${time || "3:00 PM – 4:00 PM"}
          </div>
          <p>The ceremony will mark the official beginning of the college sports events and will include various programs and announcements. Your presence would be greatly appreciated and will encourage all the participants.</p>
          <p>We look forward to your presence at the event.</p>
          <p>Warm regards,<br/><strong>Achariya College of Engineering Technology</strong></p>
        </div>`;
      }
    } else {
      subject = "🏆 Sports Day Official Announcement - ACET";
      const displayTimeHtml = time ? `<div style="font-size:20px; color:#fff; margin-top:10px; font-weight:600;">⏰ ${time}</div>` : "";
      html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#fff1ee;color:#222;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff1ee;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(139,0,0,.15);max-width:560px;">
        <tr><td style="background:linear-gradient(135deg,#8B0000,#C41E3A);padding:40px 36px;text-align:center;">
          <div style="font-size:48px;margin-bottom:12px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.3));">🏆</div>
          <h1 style="color:#fff;margin:0 0 10px;font-size:28px;font-weight:900;text-shadow:0 2px 10px rgba(0,0,0,.2);">Official Announcement</h1>
          <p style="color:rgba(255,255,255,.9);margin:0;font-size:15px;letter-spacing:.5px;">Achariya College of Engineering Technology</p>
        </td></tr>
        <tr><td style="padding:40px 36px;">
          <h2 style="font-size:22px;color:#8B0000;margin:0 0 16px;text-align:center;">The Date is Set! 📅</h2>
          <p style="font-size:16px;color:#444;margin:0 0 30px;line-height:1.6;text-align:center;">Get ready to showcase your talent and spirit. We are excited to announce the official schedule for Sports Day.</p>
          <div style="background:#0f0f1a;border-radius:14px;padding:30px 24px;text-align:center;box-shadow:inset 0 4px 12px rgba(0,0,0,.3);border:2px solid #FFD700;">
            <div style="font-size:12px;font-weight:800;letter-spacing:2px;color:#FFD700;text-transform:uppercase;margin-bottom:12px;">Official Date</div>
            <div style="font-size:24px;color:#fff;font-weight:800;">${displayDate}</div>
            ${displayTimeHtml}
          </div>
          <div style="text-align:center; margin-top:30px;">
            <a href="${portalUrl}" style="display:inline-block;background:linear-gradient(135deg,#FFD700,#FFA500);color:#000;text-decoration:none;padding:16px 40px;border-radius:50px;font-size:16px;font-weight:800;box-shadow:0 8px 24px rgba(255,215,0,.4);">Go to Sports Portal 🏃‍♂️</a>
          </div>
          <div style="margin-top:24px;text-align:left;border-top:1px solid #eee;padding-top:24px;">
            <p style="font-size:15px;color:#444;">With regards,<br/><br/><strong>${regardsNames}</strong></p>
          </div>
        </td></tr>
        <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:20px 36px;text-align:center;">
          <p style="font-size:11px;color:#aaa;margin:0;">© 2026 Achariya College of Engineering Technology · Sports Day ERP</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    }

    try {
      const mailOptions = {
        from: `"Sports Day ACET" <${process.env.SMTP_USER || process.env.EMAIL}>`,
        to: user.email,
        subject: subject,
        html: html,
      };

      if (invitationFile && invitationFileName) {
        mailOptions.attachments = [{
          filename: invitationFileName,
          content: invitationFile.split("base64,")[1],
          encoding: 'base64'
        }];
      }

      await transporter.sendMail(mailOptions);
      results.success++;
    } catch (err) {
      console.error(`❌ Email failed for ${user.email}:`, err.message);
      results.failed++;
    }
  }

  res.json({ 
    success: true, 
    message: `Broadcast complete. Success: ${results.success}, Failed: ${results.failed}`,
    successCount: results.success,
    failedCount: results.failed
  });
});

// ─── ImgBB Image Upload ──────────────────────────────────────────────────
// Admin sends base64 image → we upload it to ImgBB → return the public URL
app.post("/api/upload-image", authenticateAdmin, async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "No image data provided" });

    // 1. Validate File Type (must be image via Data URI)
    if (!data.startsWith("data:image/")) {
      return res.status(400).json({ error: "Invalid file type. Only images are allowed." });
    }

    // 2. Validate Size (approximate from base64 length, 5MB limit)
    const approxBytes = data.length * 0.75;
    if (approxBytes > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "Image too large. Maximum size is 5MB." });
    }

    if (!process.env.IMGBB_API_KEY) {
      return res.status(503).json({ error: "ImgBB not configured. Add IMGBB_API_KEY to .env" });
    }

    // data may be a full Data URI like "data:image/jpeg;base64,/9j/4AA...". Extract just the base64 part.
    const base64Image = data.includes("base64,") ? data.split("base64,")[1] : data;

    const formData = new FormData();
    formData.append("key", process.env.IMGBB_API_KEY);
    formData.append("image", base64Image);

    const imgbbRes = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: formData,
      // FormData automatically sets the right multipart headers when used with node-fetch / native fetch
    });

    const imgbbData = await imgbbRes.json();

    if (imgbbData.success) {
      res.json({ success: true, url: imgbbData.data.url });
    } else {
      res.status(500).json({ error: "ImgBB upload failed: " + (imgbbData.error?.message || "Unknown error") });
    }
  } catch (err) {
    console.error("ImgBB upload error:", err.message);
    res.status(500).json({ error: "Image upload failed: " + err.message });
  }
});

// ─── Admin Audit Logs Export ─────────────────────────────────────────────────
app.get("/api/download-admin-logs", authenticateAdmin, async (req, res) => {
  try {
    const state = await loadDb();
    const logs = state.adminLogs || [];

    // Convert to CSV
    let csvContent = "Timestamp,Type,Admin Email,Action\n";
    logs.forEach(log => {
      // Escape commas and quotes for CSV body
      const ts = log.timestamp ? new Date(log.timestamp).toLocaleString().replace(/,/g, '') : "N/A";
      const type = log.type || "UNKNOWN";
      const email = (log.email || log.name || "Unknown").replace(/"/g, '""');
      const action = (log.action || "No description").replace(/"/g, '""');

      csvContent += `${ts},${type},"${email}","${action}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="admin-audit-logs.csv"');
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate logs" });
  }
});

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}

export default app;
