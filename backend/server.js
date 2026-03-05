import "dotenv/config";
import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import jwt from "jsonwebtoken";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import State from "./models.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(compression()); // gzip all responses — reduces bandwidth by ~70%
app.use(helmet({ contentSecurityPolicy: false })); // disable CSP so Cloudinary images load
// Configure CORS for all routes (allows frontend to talk to backend from different subdomains)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.options(/(.*)/, cors()); // Handle preflight requests for all routes
app.use(express.json({ limit: "20mb" })); // allow larger payloads for image base64

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-change-in-production";

// Rate Limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // allow 2000 req per IP per 15 min — enough for 1000 active users
  message: { error: "Too many requests from this IP, please try again after 15 minutes" }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Max 10 login attempts
  message: { error: "Too many login attempts, please try again later" }
});

app.use("/api/", globalLimiter);


const otpStore = {}; // { [email]: { otp, expires } }

// ─── In-Memory State Cache ─────────────────────────────────────────────────────
// Cache the public state for 10 seconds so 1000 simultaneous page loads
// don't all hammer MongoDB at exactly the same time.
let stateCache = { data: null, ts: 0 };
const CACHE_TTL_MS = 10 * 1000; // 10 seconds

const invalidateCache = () => { stateCache = { data: null, ts: 0 }; };

// ─── MongoDB Connection ───────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/achariya_sports";
mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log("🍃 Connected to MongoDB");
  })
  .catch(err => console.error("❌ MongoDB connection error:", err));

// ─── Database Helpers ──────────────────────────────────────────────────────
const getInitialState = () => ({
  houses: [
    { id: 1, name: "RED", color: "#DC2626", points: 0 },
    { id: 2, name: "GREEN", color: "#16A34A", points: 0 },
    { id: 3, name: "PURPLE", color: "#7C3AED", points: 0 },
    { id: 4, name: "YELLOW", color: "#CA8A04", points: 0 },
  ],
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
  authorityRoles: ["Physical Education Director", "Sports Secretary", "Sports Official", "Coach", "Referee"],
  managementRoles: ["Principal", "Vice Principal", "HOD", "Dean", "Director"],
  nav: ["Home", "Events", "Registration", "Scoreboard", "Gallery", "Captain", "Admin"],
  eventDate: { date: "", time: "" },
  emptyGame: { name: "", venue: "", official: "", status: "Upcoming", start: "", end: "", participants: "" },
});


const loadDb = async () => {
  let state = await State.findOne();
  if (!state) {
    state = await State.create(getInitialState());
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

// ─── Single Admin Session Tracking ───────────────────────────────────────────
let activeAdminToken = null;

// ─── Middleware ────────────────────────────────────────────────────────────
const authenticateAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  if (token !== activeAdminToken) return res.status(401).json({ error: "Session expired. Another admin has logged in." });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") return res.status(403).json({ error: "Access denied" });
    req.user = decoded;
    next();
  } catch (err) {
    if (token === activeAdminToken) activeAdminToken = null; // Clear if it was the active one but expired
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

const authenticateCaptainOrAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role === "admin") {
      if (token !== activeAdminToken) return res.status(401).json({ error: "Session expired. Another admin has logged in." });
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
      ["boysCaptain", "girlsCaptain", "viceCaptainBoys", "viceCaptainGirls"].forEach(role => {
        if (hSafe[role]) delete hSafe[role].password;
      });
      return hSafe;
    });

    const result = { ...state.toObject ? state.toObject() : state, houses: sanitizedHouses };
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

    // Audit Log for Admin Changes
    if (req.user.role === "admin" && req.user.name) {
      updatePayload.$push = {
        adminLogs: {
          type: "CHANGE",
          name: req.user.name,
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
    res.json({ success: true });
  } catch (err) {
    console.error("OTP Error:", err);
    res.status(500).json({ error: "Failed to send OTP. Check SMTP settings." });
  }
});

app.post("/api/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  const stored = otpStore[email];

  if (!stored) return res.status(400).json({ success: false, error: "No OTP found for this email" });
  if (Date.now() > stored.expires) {
    delete otpStore[email];
    return res.status(400).json({ success: false, error: "OTP expired" });
  }
  if (stored.otp !== otp) return res.status(400).json({ success: false, error: "Invalid OTP" });

  delete otpStore[email];
  res.json({ success: true });
});

app.post("/api/admin-login", loginLimiter, async (req, res) => {
  const { password, name } = req.body;
  if (!name || name.trim() === "") return res.status(400).json({ success: false, error: "Admin Name is required" });

  const adminPass = process.env.ADMIN_PASSWORD || "AcEt@sports";
  if (password === adminPass) {
    const token = jwt.sign({ role: "admin", name: name.trim() }, JWT_SECRET, { expiresIn: "12h" });
    activeAdminToken = token; // Single session enforcement

    // Log login to DB
    await State.findOneAndUpdate({}, {
      $push: {
        adminLogs: {
          type: "LOGIN",
          name: name.trim(),
          action: "Admin Logged In",
          timestamp: new Date()
        }
      }
    }, { upsert: true });

    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, error: "Invalid admin password" });
  }
});

app.post("/api/captain-login", loginLimiter, async (req, res) => {
  const { house, password } = req.body;

  if (!house || !password) return res.status(400).json({ error: "Missing house or password." });

  const state = await loadDb();
  const houseObj = state.houses.find(h => h.id === Number(house) || h.id === house);

  if (!houseObj) return res.status(404).json({ error: "House not found." });

  let valid = false;
  let loggedInRole = "";

  ["boysCaptain", "girlsCaptain", "viceCaptainBoys", "viceCaptainGirls"].forEach(role => {
    if (houseObj[role] && houseObj[role].password === password) {
      valid = true;
      loggedInRole = role;
    }
  });

  if (valid) {
    const token = jwt.sign({ role: "captain", house, houseRole: loggedInRole }, JWT_SECRET, { expiresIn: "12h" });
    res.json({ success: true, token, houseRole: loggedInRole });
  } else {
    res.status(401).json({ success: false, error: "Invalid captain password." });
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

  const loginUrl = portalUrl || process.env.PORTAL_URL || "http://localhost:5173";
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
    let csvContent = "Timestamp,Type,Admin Name,Action\n";
    logs.forEach(log => {
      // Escape commas and quotes for CSV body
      const ts = log.timestamp ? new Date(log.timestamp).toLocaleString().replace(/,/g, '') : "N/A";
      const type = log.type || "UNKNOWN";
      const name = (log.name || "Unknown").replace(/"/g, '""');
      const action = (log.action || "No description").replace(/"/g, '""');

      csvContent += `${ts},${type},"${name}","${action}"\n`;
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
