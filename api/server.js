import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from the api directory
dotenv.config({ path: path.join(__dirname, ".env") });

console.log(`🚀 Server starting [${process.env.NODE_ENV || "development"}]`);

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
// app.use(compression()); // DEACTIVATED: Vercel handles compression natively at the production edge.

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
  allowedHeaders: ["Content-Type", "Authorization", "X-Ceremonial-Secret"],
  credentials: false // Explicitly disabled: API uses JWT Bearer tokens, not cross-origin cookies.
};

// Apply standard CORS middleware. It handles preflight (OPTIONS) automatically.
app.use(cors(corsOptions));

app.use(express.json({ limit: "20mb" })); // allow larger payloads for image base64

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-change-in-production";

// ─── Security Logger ────────────────────────────────────────────────────────
const SecurityLogger = {
  log: (event, details = {}) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      ...details
    };
    
    // Redact sensitive fields
    if (logEntry.token) logEntry.token = "[REDACTED]";
    if (logEntry.password) logEntry.password = "[REDACTED]";
    if (logEntry.otp) logEntry.otp = "[REDACTED]";
    if (logEntry.appPassword) logEntry.appPassword = "[REDACTED]";
    
    console.log(JSON.stringify(logEntry));
  }
};


// Rate Limiters - tightened for abuse protection
// keyGenerator explicitly normalises IPv4-mapped IPv6 so ::ffff:1.2.3.4 and
// 1.2.3.4 always hit the same bucket (fixes GHSA-46wh-pxpv-q5gq).
const normaliseIp = (ip = "") => ip.startsWith("::ffff:") ? ip.slice(7) : ip;

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => normaliseIp(req.ip),
  validate: { default: false },
  handler: (req, res) => {
    SecurityLogger.log("RATE_LIMIT_HIT", { type: "global", ip: req.ip, path: req.path });
    res.status(429).json({ error: "Too many requests from this IP, please try again after 15 minutes" });
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => normaliseIp(req.ip),
  validate: { default: false },
  handler: (req, res) => {
    SecurityLogger.log("RATE_LIMIT_HIT", { type: "login", ip: req.ip, path: req.path, email: req.body.email });
    res.status(429).json({ error: "Too many login attempts, please try again later" });
  }
});

app.use("/api/", globalLimiter);

// Make sure caching layers respect Origin differences
app.use((req, res, next) => {
  res.setHeader("Vary", "Origin");
  next();
});

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => normaliseIp(req.ip),
  validate: { default: false },
  handler: (req, res) => {
    SecurityLogger.log("RATE_LIMIT_HIT", { type: "submit", ip: req.ip, path: req.path });
    res.status(429).json({ error: "Too many query submissions. Please try again later." });
  }
});

// OTP limiter: 5 attempts per 15 minutes (prevents brute-forcing a 6-digit OTP)
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => normaliseIp(req.ip),
  validate: { default: false },
  handler: (req, res) => {
    SecurityLogger.log("RATE_LIMIT_HIT", { type: "otpVerify", ip: req.ip, path: req.path, email: req.body.email });
    res.status(429).json({ error: "Too many OTP attempts. Please wait 15 minutes before trying again." });
  }
});

// ─── Security: Origin Validation (Defense in Depth) ─────────────────────────
// This middleware ensures that sensitive state-changing state requests 
// genuinely originate from our trusted frontends, adding a layer of protection 
// beyond just CORS, especially for non-browser abuse.
const requireValidOrigin = (req, res, next) => {
  // 1. Enforce strict validation for state endpoints even on GET
  const isStatePath = req.path.includes("public-state") || req.path.includes("secure-state") || req.path.includes("update-state");
  
  // Debug log (deactivated)
  // console.log(`[CORS_DEBUG] Path: ${req.path} isState: ${isStatePath} Method: ${req.method} ip: ${req.ip}`);

  if (req.method === "GET" || req.method === "OPTIONS") {
      if (!isStatePath) return next();
  }

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

  const isProd = process.env.VERCEL || process.env.NODE_ENV === "production";

  // In production (OR for sensitive state paths), we strictly require a valid Origin OR Referer matching our allowlist
  if (isProd || isStatePath) {
      if (!isValidOrigin && !isValidReferer) {
          SecurityLogger.log("ORIGIN_BLOCK", {
            reason: "Missing/Invalid Origin or Referer",
            origin: origin || "undefined",
            referer: referer || "undefined",
            path: req.path,
            method: req.method,
            ip: req.ip
          });
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
    res.status(503).json({ error: "Database temporarily unavailable" });
  }
};

app.use("/api/", withDb);

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
  if (!state) throw new Error("No state document found in database.");
  return state;
};

// Optimization: Fetch ONLY the active admin token for auth checks.
// This avoids pulling megabytes of student/registration data on every request.
const loadAdminToken = async () => {
  const state = await State.findOne({}, { activeAdminToken: 1 });
  return state?.activeAdminToken;
};



// ─── Transporter Registry (Persistent Pool) ──────────────────────────────────
let smtpRotationCounter = 0;
const transportersCache = new Map();

function getTransporter(index = null) {
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && resendKey !== "your_resend_api_key") {
    if (!transportersCache.has('resend')) {
      transportersCache.set('resend', {
        transporter: nodemailer.createTransport({
          host: "smtp.resend.com",
          port: 465,
          secure: true,
          auth: { user: "resend", pass: resendKey },
        }),
        user: process.env.SMTP_USER || process.env.EMAIL
      });
    }
    return transportersCache.get('resend');
  }

  // Handle Multi-Account Rotation (1-5)
  const rotationIndex = (index !== null) ? (index % 5) + 1 : (smtpRotationCounter++ % 5) + 1;
  const suffix = rotationIndex === 1 ? "" : `_${rotationIndex}`;
  
  const user = process.env[`SMTP_USER${suffix}`] || process.env.SMTP_USER || process.env.EMAIL;
  const pass = process.env[`SMTP_PASS${suffix}`] || process.env.SMTP_PASS || process.env.APP_PASSWORD;
  
  const cacheKey = user || 'primary';
  
  if (transportersCache.has(cacheKey)) {
    return transportersCache.get(cacheKey);
  }

  // Create new persistent transporter for this account
  const configUser = user || process.env.SMTP_USER || process.env.EMAIL;
  const configPass = pass || process.env.SMTP_PASS || process.env.APP_PASSWORD;

  const t = {
    transporter: nodemailer.createTransport({
      pool: true,
      maxConnections: 3,
      maxMessages: 200,
      rateDelta: 1000,
      rateLimit: 3, // Slightly slower to keep Gmail happy
      connectionTimeout: 2000, // 2000ms timeout for faster rotation on dead connections
      greetingTimeout: 2000,
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: configUser, pass: configPass },
      tls: { rejectUnauthorized: false }
    }),
    user: configUser
  };

  transportersCache.set(cacheKey, t);
  return t;
}

// Global helper for robust email sending with automatic retry/rotation
async function robustSendMail(mailOptions, specificIndex = null) {
  let lastError;
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { transporter, user } = getTransporter(specificIndex);
    try {
      // Ensure 'from' always matches the authenticated user
      const options = { ...mailOptions };
      if (!options.from) {
        options.from = `"Sports Day ERP" <${user}>`;
      } else if (options.from.includes("<")) {
        // preserve the name but replace the email address
        const namePart = options.from.split("<")[0].trim();
        options.from = `${namePart} <${user}>`;
      } else {
        options.from = user;
      }
      
      await transporter.sendMail(options);
      return { success: true, user };
    } catch (err) {
      lastError = err;
      console.error(`[SMTP_ATTEMPT_${attempt + 1}_FAILED] User: ${user} | Error: ${err.message}`);
      
      // If it's a login error (534/535) or connection error, try NEXT account
      if (err.message.includes('534') || err.message.includes('535') || err.message.includes('454') || err.message.includes('550') || err.message.includes('EAI_AGAIN') || err.code === 'ECONNRESET') {
        if (specificIndex === null) {
          // Increment counter to ensure NEXT try uses a different account
          console.log(`[SMTP_ROTATING] Attempting next account due to failure...`);
          // Fast delay to break IP flag but avoid Vercel 10s serverless timeout
          await new Promise(r => setTimeout(r, 300));
        } else {
          // If we were targeted, we can't easily rotate, but we can retry once
          await new Promise(r => setTimeout(r, 1000));
        }
      } else {
        // For other errors (like invalid recipient), don't bother retrying
        throw err;
      }
    }
  }
  throw lastError;
}

// For backward compatibility while I refactor usages
const makeTransporter = getTransporter;

// ─── Middleware ────────────────────────────────────────────────────────────
const authenticateAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const isBlocked = await InvalidatedToken.exists({ token });
    if (isBlocked) {
        SecurityLogger.log("REVOKED_TOKEN_USAGE", { role: "admin", ip: req.ip, path: req.path });
        return res.status(401).json({ error: "Session revoked. Please log in again." });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") return res.status(403).json({ error: "Access denied" });

    // Performance Optimization: Fetch ONLY the token, not the entire State
    const activeToken = await loadAdminToken();
    if (token !== activeToken) {
        return res.status(401).json({ error: "Session expired. Another admin has logged in." });
    }

    req.user = decoded;
    next();
  } catch (err) {
    SecurityLogger.log("AUTH_FAILURE", { role: "admin", ip: req.ip, path: req.path });
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

const authenticateCaptainOrAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const isBlocked = await InvalidatedToken.exists({ token });
    if (isBlocked) {
        SecurityLogger.log("REVOKED_TOKEN_USAGE", { role: "captainOrAdmin", ip: req.ip, path: req.path });
        return res.status(401).json({ error: "Session revoked. Please log in again." });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role === "admin") {
      const activeToken = await loadAdminToken();
      if (token !== activeToken) {
          return res.status(401).json({ error: "Session expired. Another admin has logged in." });
      }
      req.user = decoded;
      return next();
    }

    if (decoded.role === "captain") {
      req.user = decoded;
      return next();
    }
    return res.status(403).json({ error: "Access denied" });
  } catch (err) {
    SecurityLogger.log("AUTH_FAILURE", { role: "captainOrAdmin", ip: req.ip, path: req.path });
    res.status(401).json({ error: "Invalid token" });
  }
};

// ─── Health / config check ─────────────────────────────────────────────────
app.get("/api/health", async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";
    res.json({
      status: "OK",
      db: dbStatus,
      env: {
        node: process.version,
        env: process.env.NODE_ENV,
        hasMongo: !!process.env.MONGODB_URI,
        hasSmtp: !!((process.env.SMTP_USER || process.env.EMAIL) && (process.env.SMTP_PASS || process.env.APP_PASSWORD))
      }
    });
  } catch (e) {
    res.status(500).json({ status: "ERROR", error: e.message });
  }
});

app.get("/api/public-state", async (req, res) => {
  try {
    // Serve from cache if fresh
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
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
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
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
      
      const houseObj = state.houses.find(h => h.id === user.house);
      const hName = (houseObj?.name || "").toLowerCase();
      const hDisplay = (houseObj?.displayName || "").toLowerCase();

      result.studentsDB = (result.studentsDB || []).filter(s => {
        const sH = (s.house || "").toLowerCase();
        return sH === hName || sH === hDisplay;
      });
      result.registrations = (result.registrations || []).filter(r => {
        const rH = (r.house || "").toLowerCase();
        return rH === hName || rH === hDisplay;
      });
      
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

app.post("/api/update-state", async (req, res) => {
  const { type, data } = req.body;
  const ceremonialSecret = req.headers["x-ceremonial-secret"];

  // Ceremonial Bypass - Allow launchConfig updates with the secret
  if (type === "launchConfig" && ceremonialSecret === "guest2026") {
    // Proceed to update without full authentication
    // Set a dummy user for logging purposes
    req.user = { role: "ceremonial", email: "ceremonial@system.com", name: "Ceremonial System" };
  } else {
    // Standard Authentication for all other updates
    await new Promise((resolve) => {
      authenticateCaptainOrAdmin(req, res, () => resolve(true));
    });
    if (res.headersSent) return; // authenticateCaptainOrAdmin already sent response
  }

  try {
 // SECURITY: Whitelist of allowed state properties to update.
    // Prevents arbitrary injection into the State document.
    const allowedTypes = [
      "houses", "authorities", "management", "studentCommittee", "games", "gallery", 
      "registrations", "pointLog", "studentsDB", "results", "sportGamesList", 
      "sportGamesListWomens", "staffGamesList", "staffGamesListWomens", "athleticsList", 
      "athleticsListWomens", "authorityRoles", "managementRoles", "nav", 
      "registrationOpen", "eventDate", "emptyGame", "starPlayers", "closedEvents",
      "maxGames", "maxAthletics", "registrationCloseTime", "launchConfig", "inaugurationDetails", "memorial", "about",
      "commonGamesMen", "commonAthleticsMen", "commonGamesWomen", "commonAthleticsWomen"
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

  try {
    await robustSendMail({
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
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => normaliseIp(req.ip),
  validate: { default: false },
  message: { error: "Too many lookup attempts. Please try again later." }
});

app.get("/api/lookup-student", lookupLimiter, async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Search query required" });

  // Force no-cache for lookups
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  console.log(`🔍 [LOOKUP] Query: ${query} (IP: ${req.ip})`);

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

app.post("/api/admin-send-otp", loginLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Valid Admin Email is required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await robustSendMail({
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
    }); // Allowed to rotate through accounts for reliability

    // Persistent storage (DB-backed, replaces deprecated in-memory store)
    await Otp.findOneAndUpdate({ email, type: "admin" }, { otp, createdAt: new Date() }, { upsert: true });

    res.json({ success: true });
  } catch (err) {
    console.error("ADMIN OTP EMAIL ERROR:", err);
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
    if (!stored) {
      SecurityLogger.log("AUTH_FAILURE", { role: "admin", reason: "OTP expired or not sent", email: em, ip: req.ip });
      return res.status(400).json({ error: "OTP expired or not sent" });
    }
    if (String(stored.otp) !== String(otp)) {
      SecurityLogger.log("AUTH_FAILURE", { role: "admin", reason: "Invalid OTP", email: em, ip: req.ip });
      return res.status(400).json({ error: "Invalid OTP" });
    }
  }

  if (stored) await Otp.deleteOne({ _id: stored._id });

  const token = jwt.sign({ role: "admin", name: em, email: em }, JWT_SECRET, { expiresIn: "4h" });

  SecurityLogger.log("AUTH_SUCCESS", { role: "admin", email: em, ip: req.ip });

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
          SecurityLogger.log("AUTH_FAILURE", { role: "captain", reason: "Password mismatch", email: em, ip: req.ip, houseId: houseObj.id });
        }
      }
    }
    if (valid) break;
  }

  if (valid) {
    SecurityLogger.log("AUTH_SUCCESS", { role: "captain", email: em, houseRole: loggedInRole, houseId, ip: req.ip });
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
    SecurityLogger.log("AUTH_FAILURE", { role: "captain", reason: "No matching email/password found", email: em, ip: req.ip });
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
      SecurityLogger.log("TOKEN_REVOKED", { role: decoded.role || "unknown", email: decoded.email || "unknown" });
    }
  } catch {
    // Silently ignore malformed token on logout — user is logging out regardless
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

// SECURITY: Protected — exposes SMTP config (user, host). Admin-only.
app.get("/api/email-config", authenticateAdmin, (req, res) => {
  res.json({
    configured: !!((process.env.SMTP_USER || process.env.EMAIL) && (process.env.SMTP_PASS || process.env.APP_PASSWORD)),
    user: process.env.SMTP_USER || process.env.EMAIL || "",
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT || "587",
  });
});

// SECURITY: Protected — triggers live SMTP network call. Admin-only.
app.get("/api/check-email-connection", authenticateAdmin, async (req, res) => {
  try {
    const { transporter } = getTransporter(); // Use registry to test connection
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
  if (!process.env.SMTP_USER && !process.env.EMAIL && !process.env.RESEND_API_KEY) {
    return res.status(400).json({ error: "SMTP not configured. Set SMTP_USER and SMTP_PASS (or EMAIL and APP_PASSWORD) in .env" });
  }

  const loginUrl = portalUrl || process.env.PORTAL_URL || "http://localhost:5173/captain";
  // Attempt to find student year/dept
  const student = studentsDB?.find(s => s.email?.toLowerCase() === captainEmail.toLowerCase());
  const studentYear = student?.year || "Student";

  const houseColors = { RED: "#FF0000", BLUE: "#0000FF", GREEN: "#008000", YELLOW: "#FFFF00", PURPLE: "#800080" };
  const houseColor = houseColors[house.toUpperCase()] || "#8B0000";

  // Transporter is now handled inside robustSendMail

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
    // 1. Send to Captain
    await robustSendMail({
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
          await robustSendMail({
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
  const displayDate = date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : "Coming Soon";
  const displayTimeHtml = time ? `<div style="font-size:18px; color:#fff; font-weight:600; margin-bottom:10px;">⏰ ${time}</div>` : "";
  const venueHtml = venue ? `<div style="font-size:16px; color:rgba(255,255,255,0.9); margin-top:8px;">📍 Venue: ${venue}</div>` : "";
  
  // Use provided recipients chunk if available, otherwise fallback to all
  const allUsers = recipients.length > 0 ? recipients : [
    ...authorities.map(a => ({ ...a, roleType: "authority" })),
    ...management.map(m => ({ ...m, roleType: "management" })),
    ...studentsDB.map(s => ({ ...s, roleType: s.role === "Staff" ? "staff" : "student" }))
  ];

  const results = { success: 0, failed: 0 };
  const BATCH_SIZE = 50;

  // Separate users into those needing individual emails (personalized) vs bulk
  const individualUsers = [];
  const bulkRecipients = [];

  allUsers.forEach(user => {
    if (!user.email || !user.email.includes("@")) return;
    const roleLower = (user.role || "").toLowerCase();
    // Higher officials and specific individual cases always get personalized mail
    const isIndividual = isInauguration || 
                        roleLower.includes("principal") || 
                        roleLower.includes("managing director") || 
                        roleLower.includes("md") || 
                        roleLower.includes("hod") || 
                        roleLower.includes("head") ||
                        roleLower.includes("physical education");
    
    if (isIndividual) individualUsers.push(user);
    else bulkRecipients.push(user.email);
  });

  // display variables moved to top

  for (const [idx, user] of individualUsers.entries()) {
    if (!user.email || !user.email.includes("@")) continue;

    let subject, html;
    const name = user.name || "Guest";
    const dept = user.dept || "Department";

    if (isInauguration) {
      subject = "✨ Official Invitation: Achariya Sports Day Inauguration";
      html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#fff8f8;color:#222;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f8;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.1);max-width:560px;">
        <tr><td style="background:linear-gradient(135deg,#8B0000,#C41E3A);padding:40px 36px;text-align:center;color:#fff;">
          <h1 style="margin:0 0 10px;font-size:26px;font-weight:900;letter-spacing:1px;text-transform:uppercase;">Grand Inauguration</h1>
          <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.9);letter-spacing:2px;font-weight:600;">ACET SPORTS FEST 2026</p>
        </td></tr>
        <tr><td style="padding:40px 36px;">
          <p style="font-size:16px;line-height:1.6;color:#444;margin:0 0 24px;">Dear ${name},<br/><br/>You are cordially invited to the <strong>Grand Inaugural Ceremony</strong> of our Sports Day. Your presence will be a great honor and will serve as an inspiration to our students.</p>
          <div style="background:#8B0000;border-radius:12px;padding:30px 24px;text-align:center;margin-bottom:32px;box-shadow:0 10px 20px rgba(139,0,0,0.2);">
            <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.8);text-transform:uppercase;margin-bottom:12px;letter-spacing:3px;">Opening Ceremony</div>
            <div style="font-size:24px;color:#fff;font-weight:800;margin-bottom:10px;">${displayDate}</div>
            ${displayTimeHtml}
            ${venueHtml}
          </div>
          <p style="font-size:15px;line-height:1.6;color:#444;">With regards,<br/><br/><strong>${regardsNames}</strong></p>
        </td></tr>
        <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:16px 36px;text-align:center;">
          <p style="font-size:11px;color:#aaa;margin:0;">© 2026 Achariya College of Engineering Technology · Sports Day ERP</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    } else {
      subject = "🏆 Official Announcement: Sports Day Event Schedule";
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
        to: user.email,
        subject,
        html
      };

      if (invitationFile && invitationFileName) {
        mailOptions.attachments = [{
          filename: invitationFileName,
          content: invitationFile.split("base64,")[1],
          encoding: 'base64'
        }];
      }

      await robustSendMail(mailOptions, idx);
      results.success++;
    } catch (err) {
      console.error(`❌ Individual email failed for ${user.email}:`, err.message);
      results.failed++;
    }
  }

  // 2. Send Bulk BCC Emails (for general announcements)
  if (bulkRecipients.length > 0 && !isInauguration) {
    console.log(`📡 Sending bulk announcement to ${bulkRecipients.length} recipients in batches of ${BATCH_SIZE}...`);
    
    const subject = "🏆 Sports Day Official Announcement - ACET";
    const displayTimeHtml = time ? `<div style="font-size:20px; color:#fff; margin-top:10px; font-weight:600;">⏰ ${time}</div>` : "";
    const html = `
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
          <h2 style="font-size:22px;color:#8B0000;margin:0 0 16px;text-align:center;">Greetings from the Sports Committee! 📅</h2>
          <p style="font-size:16px;color:#444;margin:0 0 30px;line-height:1.6;text-align:center;">We are excited to announce the official schedule for our upcoming Sports Day events.</p>
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

    for (let i = 0; i < bulkRecipients.length; i += BATCH_SIZE) {
      const batch = bulkRecipients.slice(i, i + BATCH_SIZE);
      try {
        const batchIdx = Math.floor(i / BATCH_SIZE);
        const mailOptions = {
          to: 'me', // placeholder, robustSendMail will fix this
          bcc: batch,
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

        const res = await robustSendMail(mailOptions, batchIdx);
        // Ensure 'to' is also the authenticated user to avoid 'sender address rejected'
        mailOptions.to = res.user; 
        
        results.success += batch.length;
        console.log(`✅ Batch of ${batch.length} sent successfully using ${res.user}.`);
      } catch (err) {
        console.error(`❌ Bulk batch failed:`, err.message);
        results.failed += batch.length;
      }
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
      SecurityLogger.log("UPLOAD_REJECTED", { reason: "Invalid MIME prefix", ip: req.ip, user: req.user.email });
      return res.status(400).json({ error: "Invalid file type. Only images are allowed." });
    }

    // 2. Validate Size (approximate from base64 length, 5MB limit)
    const approxBytes = data.length * 0.75;
    if (approxBytes > 5 * 1024 * 1024) {
      SecurityLogger.log("UPLOAD_REJECTED", { reason: "Payload too large (>5MB)", bytes: approxBytes, ip: req.ip, user: req.user.email });
      return res.status(400).json({ error: "Image too large. Maximum size is 5MB." });
    }

    if (!process.env.IMGBB_API_KEY) {
      return res.status(503).json({ error: "ImgBB not configured. Add IMGBB_API_KEY to .env" });
    }

    // data may be a full Data URI like "data:image/jpeg;base64,/9j/4AA...". Extract just the base64 part.
    const base64Image = data.includes("base64,") ? data.split("base64,")[1] : data;

    const params = new URLSearchParams();
    params.append("key", process.env.IMGBB_API_KEY);
    params.append("image", base64Image);

    const imgbbRes = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: params
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
// Listen locally but not on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}

export default app;
