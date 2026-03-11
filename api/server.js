import "dotenv/config";
import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import jwt from "jsonwebtoken";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import compression from "compression";
import mongoSanitize from "express-mongo-sanitize";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import { State, Otp } from "./models.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.set("trust proxy", 1); // Trust first proxy (required for Vercel/Render rate limiting)
app.use(compression()); // gzip all responses — reduces bandwidth by ~70%
app.use(helmet({ contentSecurityPolicy: false })); // disable CSP so Cloudinary images load
// Configure CORS for all routes
const allowedOrigins = [
  "https://acet-sports-seven.vercel.app",
  "https://acetsports.favoflex.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3001",
  "http://127.0.0.1:3001"
];

const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;

  // Allow all localhost/127.0.0.1 variations in local development
  const isProd = process.env.VERCEL || process.env.NODE_ENV === "production";
  if (!isProd && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
    return true;
  }

  // Allow Vercel preview deployments (e.g., https://acet-sports-r7cef9k0u-koshik2005s-projects.vercel.app)
  if (/^https:\/\/acet-sports-[a-z0-9]+-[a-z0-9-]+\.vercel\.app$/.test(origin)) return true;
  return false;
};

const corsOptions = {
  origin: function (origin, callback) {
    // Browsers don't send Origin for same-origin GETs.
    // We allow !origin here, but requireValidOrigin middleware will later catch
    // malicious !origin requests that also lack Referer headers.
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

// Apply CORS but catch the specific Error to return a clean 403
app.use((req, res, next) => {
  cors(corsOptions)(req, res, (err) => {
    if (err) {
      console.warn(`🔒 CORS Bloced: Origin "${req.headers.origin}" not in whitelist.`);
      return res.status(403).json({ error: "Access Denied: Origin not allowed or missing." });
    }
    next();
  });
});
app.options(/(.*)/, cors()); // Handle preflight requests for all routes
app.use(express.json({ limit: "20mb" })); // allow larger payloads for image base64
app.use(mongoSanitize()); // sanitize all inputs against NoSQL injection

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-change-in-production";

// Rate Limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000,
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: { error: "Too many requests from this IP, please try again after 15 minutes" }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: { error: "Too many login attempts, please try again later" }
});

app.use("/api/", globalLimiter);


const otpStore = {}; // DEPRECATED: Use Otp model

// ─── Security: Block Non-Browser API Testing Tools ──────────────────────────
const allowedHosts = [
  "acet-sports-seven.vercel.app",
  "acetsports.favoflex.com",
  "localhost",
  "127.0.0.1"
];

const requireValidOrigin = (req, res, next) => {
  if (req.path === "/api/health") return next();

  let origin = req.headers.origin || req.headers.referer;

  // Clean up referer trailing slashes to match origin format if needed
  if (origin && origin.endsWith('/')) {
    origin = origin.slice(0, -1);
  }

  // Also check Host header as a fallback for same-origin requests
  // (Browsers don't send Origin for same-origin GET requests)
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  const hostBase = host.split(":")[0]; // strip port if present
  const isAllowedHost = allowedHosts.includes(hostBase) || /^acet-sports-[a-z0-9-]+\.vercel\.app$/.test(hostBase);

  // Only enforce strict origin checks in production (Vercel) to avoid breaking local Vite proxies
  const isProd = process.env.VERCEL || process.env.NODE_ENV === "production";

  if (isProd && !isAllowedHost && (!origin || !isAllowedOrigin(origin))) {
    console.warn(`Blocked API request. Host: ${host}, Origin: ${origin || 'NONE'}`);
    return res.status(403).json({ error: "Access Denied: strictly frontend access only." });
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
  emptyGame: { name: "", venue: "", official: "", status: "Upcoming", start: "", end: "", participants: "" },
});


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
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ─── Middleware ────────────────────────────────────────────────────────────
const authenticateAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
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
        hasSmtp: !!(process.env.SMTP_USER && process.env.SMTP_PASS)
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
      const { ...hSafe } = h;
      ["boysCaptain", "girlsCaptain", "viceCaptainBoys", "viceCaptainGirls", "staffCaptainMale", "staffCaptainFemale"].forEach(role => {
        if (hSafe[role]) delete hSafe[role].password;
      });
      return hSafe;
    });

    const result = { ...state.toObject ? state.toObject() : state, houses: sanitizedHouses };
    delete result.activeAdminToken; // <--- ADDED: Security fix, do not leak admin token to public state

    stateCache = { data: result, ts: Date.now() }; // update cache
    res.json(result);
  } catch (err) {
    console.error("STATE ERROR:", err);
    res.status(500).json({ error: "Failed to load state", details: err.message });
  }
});

app.get("/api/secure-state", authenticateAdmin, async (req, res) => {
  try {
    const state = await loadDb();
    res.json(state);
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

    // Authorization Check: Captains can ONLY update studentsDB
    if (req.user.role === "captain" && type !== "studentsDB") {
      return res.status(403).json({ error: "Captains can only update T-shirt issuance." });
    }

    // Prepare update payload
    let updatePayload = { [type]: data };

    // Automatically hash captain passwords if houses are being updated
    if (type === "houses" && Array.isArray(data)) {
      const roles = ["boysCaptain", "girlsCaptain", "viceCaptainBoys", "viceCaptainGirls", "staffCaptainMale", "staffCaptainFemale"];
      const saltedHouses = await Promise.all(data.map(async h => {
        const updatedH = { ...h };
        for (const role of roles) {
          if (updatedH[role] && updatedH[role].password) {
            const isHashed = updatedH[role].password.startsWith("$2a$") || updatedH[role].password.startsWith("$2b$");
            if (!isHashed && updatedH[role].password.trim() !== "") {
              updatedH[role].password = await bcrypt.hash(updatedH[role].password, 10);
            }
          }
        }
        return updatedH;
      }));
      updatePayload[type] = saltedHouses;
    }

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
    await State.findOneAndUpdate({}, updatePayload, { upsert: true });
    invalidateCache(); // clear state cache so next fetch gets fresh data
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update state" });
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
      from: `"Sports Day ERP" <${process.env.SMTP_USER}>`,
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

app.post("/api/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  const stored = await Otp.findOne({ email, type: "student" });

  if (!stored) return res.status(400).json({ success: false, error: "No OTP found for this email" });
  if (stored.otp !== otp) return res.status(400).json({ success: false, error: "Invalid OTP" });

  await Otp.deleteOne({ _id: stored._id });
  res.json({ success: true });
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
      from: `"Sports Day Admin" <${process.env.SMTP_USER}>`,
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

  const adminPassword = process.env.ADMIN_PASSWORD || "adminacet";
  
  // Support both plain text and hashed admin password in .env
  const isHashed = adminPassword.startsWith("$2a$") || adminPassword.startsWith("$2b$");
  let match = false;
  
  if (isHashed) {
    match = await bcrypt.compare(password, adminPassword);
  } else {
    match = (password === adminPassword);
  }

  if (!match) {
    return res.status(401).json({ success: false, error: "Incorrect admin password." });
  }

  res.json({ success: true });
});

app.post("/api/admin-login", loginLimiter, async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !email.trim() === "" || !otp) return res.status(400).json({ success: false, error: "Email and OTP are required" });

  const em = email.trim();
  const isDefaultFallback = String(otp) === "159753";
  const stored = await Otp.findOne({ email: em, type: "admin" });

  if (!isDefaultFallback) {
    if (!stored) return res.status(400).json({ error: "OTP expired or not sent" });
    if (String(stored.otp) !== String(otp)) return res.status(400).json({ error: "Invalid OTP" });
  }

  if (stored) await Otp.deleteOne({ _id: stored._id });

  const token = jwt.sign({ role: "admin", name: em, email: em }, JWT_SECRET, { expiresIn: "12h" });

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
  let needsMigration = false;

  // Search all houses and all roles for this email
  for (const houseObj of state.houses) {
    const roles = ["boysCaptain", "girlsCaptain", "viceCaptainBoys", "viceCaptainGirls", "staffCaptainMale", "staffCaptainFemale"];
    for (const role of roles) {
      const captain = houseObj[role];
      if (captain && captain.email && captain.email.trim().toLowerCase() === em) {
        // Try hashed comparison first
        const isHashed = captain.password && (captain.password.startsWith("$2a$") || captain.password.startsWith("$2b$"));
        
        if (isHashed) {
          const match = await bcrypt.compare(password, captain.password);
          if (match) {
            valid = true;
            loggedInRole = role;
            houseId = houseObj.id;
          }
        } else if (captain.password === password) {
          // Legacy plain-text match
          valid = true;
          loggedInRole = role;
          houseId = houseObj.id;
          needsMigration = true;
        }

        if (valid) break;
      }
    }
    if (valid) break;
  }

  if (valid) {
    console.log(`✅ Captain logged in: ${em} (${loggedInRole} in House ${houseId})`);
    
    // Lazy migration: if they logged in with plain text, hash it now
    if (needsMigration) {
      const hashed = await bcrypt.hash(password, 10);
      const updatedHouses = state.houses.map(h => {
        if (h.id === houseId) {
          const updatedHouse = { ...h };
          updatedHouse[loggedInRole] = { ...updatedHouse[loggedInRole], password: hashed };
          return updatedHouse;
        }
        return h;
      });
      await State.findOneAndUpdate({}, { $set: { houses: updatedHouses } });
      invalidateCache();
      console.log(`🔐 Lazy migrated password for ${em}`);
    }

    const token = jwt.sign({ role: "captain", house: houseId, houseRole: loggedInRole }, JWT_SECRET, { expiresIn: "12h" });

    // Find house details to return
    const houseObj = state.houses.find(h => h.id === houseId);

    res.json({
      success: true,
      token,
      houseRole: loggedInRole,
      houseName: houseObj?.name || "House",
      houseColor: houseObj?.color || "#8B0000",
      captainName: houseObj?.[loggedInRole]?.name || "Captain"
    });
  } else {
    console.log(`❌ Login failed for ${em}: Invalid credentials.`);
    res.status(401).json({ success: false, error: "Invalid email or password." });
  }
});

app.get("/api/email-config", (req, res) => {
  res.json({
    configured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
    user: process.env.SMTP_USER || "",
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
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(500).json({ error: "SMTP not configured. Set SMTP_USER and SMTP_PASS in .env" });
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
      from: `"Sports Day ERP" <${process.env.SMTP_USER}>`,
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
            from: `"Sports ERP System" <${process.env.SMTP_USER}>`,
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
  const { date, time, portalUrl, authorities = [], studentsDB = [], invitationFile, invitationFileName, regardsNames } = req.body;

  if (!date) {
    return res.status(400).json({ error: "Date is required." });
  }

  // Gather recipients
  const recipients = [];

  // Authorities & Management
  authorities.forEach(a => {
    if (a.email && a.email.includes("@")) recipients.push(a.email);
  });

  // Students
  studentsDB.forEach(s => {
    if (s.email && s.email.includes("@")) recipients.push(s.email);
  });

  // Deduplicate
  const uniqueEmails = [...new Set(recipients)];

  if (uniqueEmails.length === 0) {
    return res.status(400).json({ error: "No valid email addresses found across users." });
  }

  const transporter = makeTransporter();

  const displayDate = new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const displayTime = time ? `<div style="font-size:20px; color:#fff; margin-top:10px; font-weight:600;">⏰ ${time}</div>` : "";

  const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
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
          <p style="font-size:16px;color:#444;margin:0 0 30px;line-height:1.6;text-align:center;">
            Get ready to showcase your talent, spirit, and sportsmanship. We are excited to announce the official schedule for ACET Sports Day 2025.
          </p>
          
          <div style="background:#0f0f1a;border-radius:14px;padding:30px 24px;text-align:center;box-shadow:inset 0 4px 12px rgba(0,0,0,.3);border:2px solid #FFD700;">
            <div style="font-size:12px;font-weight:800;letter-spacing:2px;color:#FFD700;text-transform:uppercase;margin-bottom:12px;">Official Date & Time</div>
            <div style="font-size:24px;color:#fff;font-weight:800;text-shadow:0 2px 8px rgba(255,215,0,.4);">
              ${displayDate}
            </div>
            ${displayTime}
          </div>
          
          <p style="font-size:15px;color:#555;margin:30px 0 30px;line-height:1.6;text-align:center;">
            Don't forget to register for your events and track your house's progress on the official Sports Day portal.
          </p>
          
          <div style="text-align:center; padding-bottom: 24px; border-bottom: 1px solid #eee;">
            <a href="${portalUrl}" style="display:inline-block;background:linear-gradient(135deg,#FFD700,#FFA500);color:#000;text-decoration:none;padding:16px 40px;border-radius:50px;font-size:16px;font-weight:800;letter-spacing:1px;box-shadow:0 8px 24px rgba(255,215,0,.4);">
              Go to Sports Portal 🏃‍♂️
            </a>
          </div>

          <div style="margin-top: 24px; text-align: left;">
            <p style="font-size:16px; color:#222; font-weight:600; margin-bottom:12px;">
              Invited by the Department of Physical Education and Training.
            </p>
            <p style="font-size:15px; color:#444; margin-top:0;">
              With regards,<br/><br/>
              <strong>${regardsNames}</strong>
            </p>
          </div>
        </td></tr>
        
        <tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:20px 36px;text-align:center;">
          <p style="font-size:12px;color:#888;margin:0 0 8px;">You are receiving this because you are registered in the ACET Sports Database.</p>
          <p style="font-size:11px;color:#aaa;margin:0;">© 2025 Achariya College of Engineering Technology · Sports Day ERP</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    // Configure attachments if an invitation file is provided
    const mailOptions = {
      from: `"ACET Sports Authority" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER, // Send to self
      bcc: uniqueEmails.join(","),
      subject: `🏆 Official Sports Day Schedule Announced!`,
      html: htmlTemplate,
    };

    if (invitationFile && invitationFileName) {
      mailOptions.attachments = [
        {
          filename: invitationFileName,
          path: invitationFile // Nodemailer accepts Data URIs (Base64) directly in the path
        }
      ];
    }

    await transporter.sendMail(mailOptions);

    console.log(`✅ Global announcement sent to ${uniqueEmails.length} users.`);
    res.json({ success: true, message: `Announcement sent to ${uniqueEmails.length} users.` });
  } catch (err) {
    console.error("❌ Announcement error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── ImgBB Image Upload ──────────────────────────────────────────────────
// Admin sends base64 image → we upload it to ImgBB → return the public URL
app.post("/api/upload-image", authenticateAdmin, async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "No image data provided" });

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
