import { useState } from "react";
import { useIsMobile, hi, tint, Count, Sheet } from "./utils.jsx";
import { API_BASE } from "./api.js";
export function RegistrationPage({ dark, setRegistrations, studentsDB, houses = [], sportGamesList = [], sportGamesListWomens = [], athleticsList = [], athleticsListWomens = [], staffGamesList = [], staffGamesListWomens = [], registrationOpen = true, registrationCloseTime, closedEvents = [], maxGames = 1, maxAthletics = 1, commonGamesMen = [], commonAthleticsMen = [], commonGamesWomen = [], commonAthleticsWomen = [] }) {
    const [input, setInput] = useState("");
    const [student, setStudent] = useState(null);
    const [gameSel, setGameSel] = useState([]);
    const [athleticSel, setAthleticSel] = useState([]);
    const [otp, setOtp] = useState("");
    const [error, setError] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [isOtpVerified, setIsOtpVerified] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [registered, setRegistered] = useState(null); // holds { student, hObj } after successful registration
    const [existingRegistration, setExistingRegistration] = useState(null);
    const [lockedGames, setLockedGames] = useState([]);
    const [lockedAthletics, setLockedAthletics] = useState([]);
    const [isPartial, setIsPartial] = useState(false);
    const [showQuery, setShowQuery] = useState(false);
    const [queryData, setQueryData] = useState({ issueType: "Name Spelling", details: "" });
    const isMobile = useIsMobile();

    const isClosed = !registrationOpen || (registrationCloseTime && new Date() > new Date(registrationCloseTime));

    const hObj = houses.find(h => h.name === student?.house);

    const lookup = async () => {
        setError(""); setGameSel([]); setAthleticSel([]); setLockedGames([]); setLockedAthletics([]); setOtpSent(false); setIsOtpVerified(false); setOtp(""); setExistingRegistration(null); setIsPartial(false);
        if (!input.trim()) return;

        setIsVerifying(true);
        try {
            const res = await fetch(`${API_BASE}/api/lookup-student?query=${encodeURIComponent(input.trim())}`);
            const data = await res.json();
            if (data.success) {
                setStudent(data.student);
                setIsPartial(data.student.isPartial);
                if (data.student.alreadyRegistered) {
                    setExistingRegistration(data.student.existingRegistration);
                    // Pre-fill existing selections only if they are valid
                    if (data.student.hasGame) {
                        const gs = data.student.existingRegistration.game.split(", ");
                        setGameSel(gs);
                        setLockedGames(gs);
                    }
                    if (data.student.hasAthletic) {
                        const as = data.student.existingRegistration.athletic.split(", ");
                        setAthleticSel(as);
                        setLockedAthletics(as);
                    }
                }
            } else {
                setError(data.error || "Student not found. Check your email or register number.");
            }
        } catch (err) {
            setError("Server unreachable.");
        }
        setIsVerifying(false);
    };

    const sendOtp = async () => {
        setError(""); setIsVerifying(true);
        try {
            const res = await fetch(`${API_BASE}/api/send-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: student.email })
            });
            const data = await res.json();
            if (data.success) {
                setOtpSent(true);
            } else {
                setError(data.error || "Failed to send OTP.");
            }
        } catch (err) {
            setError("Server unreachable.");
        }
        setIsVerifying(false);
    };

    const verifyOtp = async () => {
        setError(""); setIsVerifying(true);
        try {
            const res = await fetch(`${API_BASE}/api/verify-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: student.email, otp })
            });
            const data = await res.json();
            if (data.success) {
                setIsOtpVerified(true);
                setOtpSent(false);
            } else {
                setError(data.error || "Invalid OTP.");
            }
        } catch (err) {
            setError("Verification failed.");
        }
        setIsVerifying(false);
    };

    const submit = async () => {
        if (gameSel.length === 0 && athleticSel.length === 0) { setError("Please select at least one event."); return; }
        
        setIsVerifying(true);
        try {
            const res = await fetch(`${API_BASE}/api/register-event`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: student.email,
                    otp,
                    game: gameSel.join(", "),
                    athletic: athleticSel.join(", ")
                })
            });
            const data = await res.json();
            if (data.success) {
                if (typeof setRegistrations === 'function') {
                    setRegistrations(p => [...p.filter(r => r.email !== student.email), data.registration]);
                }
                setRegistered({ student, hObj });
                setStudent(null); setInput(""); setGameSel([]); setAthleticSel([]); setLockedGames([]); setLockedAthletics([]); setError(""); setIsOtpVerified(false); setOtpSent(false); setExistingRegistration(null); setIsPartial(false);
            } else {
                setError(data.error || "Registration failed.");
            }
        } catch (err) {
            setError("Server error during registration.");
        }
        setIsVerifying(false);
    };

    const submitQuery = async () => {
        if (!queryData.details.trim()) { setError("Please provide details."); return; }
        setIsVerifying(true);
        try {
            const res = await fetch(`${API_BASE}/api/submit-query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    regNo: student.regNo,
                    studentName: student.name,
                    issueType: queryData.issueType,
                    details: queryData.details
                })
            });
            const data = await res.json();
            if (data.success) {
                alert("Query submitted successfully!");
                setShowQuery(false);
                setQueryData({ issueType: "Name Spelling", details: "" });
            } else {
                setError(data.error || "Failed to submit query.");
            }
        } catch (err) {
            setError("Request failed.");
        }
        setIsVerifying(false);
    };

    // ── Post-registration WhatsApp prompt ──────────────────────────────────
    if (registered) {
        const { student: reg, hObj: rHObj } = registered;
        const isFemale = reg?.gender?.toLowerCase() === "female" || reg?.gender?.toLowerCase() === "f";
        const rawWaLink = isFemale ? (rHObj?.whatsappLinkWomen) : (rHObj?.whatsappLinkMen);
        
        const sanitizeUrl = (url) => {
            if (!url || typeof url !== 'string') return "#";
            try {
                const parsed = new URL(url.trim());
                if (["http:", "https:", "mailto:", "whatsapp:"].includes(parsed.protocol)) {
                    return parsed.href;
                }
            } catch (e) {}
            return "#";
        };
        const waLink = sanitizeUrl(rawWaLink);
        const genderLabel = isFemale ? "Women's" : "Men's";
        const genderColor = isFemale ? "#FF69B4" : "#1E90FF";
        return (
            <div style={{ maxWidth: 600, margin: isMobile ? "16px auto" : "60px auto", padding: isMobile ? "16px 12px" : "40px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 56, marginBottom: 8 }}>🎉</div>
                <h2 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#228B22", margin: "0 0 6px", fontSize: isMobile ? 20 : 26 }}>Registration Successful!</h2>
                <p style={{ color: dark ? "#aaa" : "#555", fontSize: 13, marginBottom: 20 }}>You're all set, <strong>{reg?.name}</strong>.</p>

                <div style={{ background: dark ? "rgba(255,255,255,.05)" : "#fff", border: `2px solid ${rHObj?.color || "#888"}`, borderRadius: 16, padding: isMobile ? 16 : 28, marginBottom: 20 }}>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: rHObj?.color || "#888", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 18, margin: "0 auto 10px", overflow: "hidden" }}>
                        {rHObj?.logo ? <img src={rHObj.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🏠"}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: isMobile ? 16 : 20, color: rHObj?.color || "#888", marginBottom: 4 }}>{rHObj?.displayName || reg?.house} House</div>
                    {waLink ? (
                        <>
                            <p style={{ color: dark ? "#ccc" : "#555", fontSize: 13, margin: "8px 0 16px" }}>
                                Join your house <strong style={{ color: genderColor }}>{genderLabel}</strong> WhatsApp group to stay updated on events, schedules, and announcements!
                            </p>
                            <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: "inline-flex", alignItems: "center", gap: 8,
                                    background: "linear-gradient(135deg,#25D366,#128C7E)",
                                    color: "#fff", textDecoration: "none",
                                    borderRadius: 50, padding: isMobile ? "12px 24px" : "14px 32px",
                                    fontWeight: 800, fontSize: isMobile ? 15 : 17,
                                    boxShadow: "0 4px 20px rgba(37,211,102,.35)",
                                    transition: "transform .2s"
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
                                onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                            >
                                <svg width="22" height="22" viewBox="0 0 32 32" fill="white">
                                    <path d="M16 2C8.27 2 2 8.27 2 16c0 2.46.65 4.77 1.78 6.77L2 30l7.47-1.75A13.93 13.93 0 0016 30c7.73 0 14-6.27 14-14S23.73 2 16 2zm0 25.38c-2.2 0-4.28-.6-6.07-1.64l-.43-.26-4.44 1.04 1.06-4.32-.28-.45A11.35 11.35 0 014.64 16C4.64 9.67 9.67 4.64 16 4.64S27.36 9.67 27.36 16 22.33 27.38 16 27.38zm6.28-8.5c-.34-.17-2.03-1-2.35-1.12-.32-.11-.55-.17-.78.17-.23.34-.9 1.12-1.1 1.35-.2.23-.4.26-.74.09-.34-.17-1.44-.53-2.74-1.69-1.01-.9-1.7-2.01-1.9-2.35-.2-.34-.02-.52.15-.69.15-.15.34-.4.51-.6.17-.2.23-.34.34-.57.11-.23.06-.43-.03-.6-.09-.17-.78-1.88-1.07-2.57-.28-.67-.57-.58-.78-.59h-.66c-.23 0-.6.09-.91.43-.31.34-1.19 1.16-1.19 2.83s1.22 3.28 1.39 3.51c.17.23 2.4 3.66 5.82 5.13.81.35 1.44.56 1.93.72.81.26 1.55.22 2.14.13.65-.1 2.03-.83 2.31-1.63.29-.8.29-1.49.2-1.63-.08-.14-.31-.23-.65-.4z"/>
                                </svg>
                                Join {rHObj?.displayName || reg?.house} {genderLabel} WhatsApp Group
                            </a>
                        </>
                    ) : (
                        <p style={{ color: dark ? "#666" : "#aaa", fontSize: 13, margin: "8px 0 0", fontStyle: "italic" }}>WhatsApp group link not configured yet — check with your Sports Admin.</p>
                    )}
                </div>

                <button
                    onClick={() => setRegistered(null)}
                    style={{ background: "transparent", border: `1px solid ${dark ? "#444" : "#ddd"}`, color: dark ? "#ccc" : "#666", borderRadius: 50, padding: "10px 28px", cursor: "pointer", fontSize: 14, fontWeight: 600 }}
                >
                    ✓ Done
                </button>
            </div>
        );
    }


    if (student && existingRegistration && !isPartial) return (
        <div style={{ maxWidth: 600, margin: isMobile ? "16px auto" : "60px auto", padding: isMobile ? "16px 12px" : "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 52 }}>🔒</div>
            <h2 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", margin: "10px 0 8px", fontSize: isMobile ? 19 : 24 }}>Already Registered</h2>
            <p style={{ color: dark ? "#aaa" : "#666", marginBottom: 16, fontSize: 13 }}>Your registration is locked. Only an admin can make changes.</p>
            <div style={{ background: dark ? "rgba(255,255,255,.05)" : "#fff", border: `2px solid ${hObj?.color || "#888"}`, borderRadius: 14, padding: isMobile ? 14 : 28, textAlign: "left" }}>
                <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 18, color: hObj?.color, marginBottom: 10 }}>{existingRegistration.name} — {hObj?.displayName || existingRegistration.house} House</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ background: dark ? "rgba(139,0,0,.15)" : "#fff5f5", border: "1px solid #8B000033", borderRadius: 9, padding: 12 }}><div style={{ fontSize: 10, color: "#8B0000", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>⚽ Game</div><div style={{ fontWeight: 700, color: dark ? "#fff" : "#222", fontSize: 13 }}>{existingRegistration.game || <span style={{ color: "#aaa", fontStyle: "italic" }}>None</span>}</div></div>
                    <div style={{ background: dark ? "rgba(75,0,130,.2)" : "#f5f0ff", border: "1px solid #4B008233", borderRadius: 9, padding: 12 }}><div style={{ fontSize: 10, color: "#4B0082", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>🏃 Athletic</div><div style={{ fontWeight: 700, color: dark ? "#fff" : "#222", fontSize: 13 }}>{existingRegistration.athletic || <span style={{ color: "#aaa", fontStyle: "italic" }}>None</span>}</div></div>
                </div>

                {/* WhatsApp Link Addition */}
                {(function() {
                    const isFemale = student?.gender?.toLowerCase() === "female" || student?.gender?.toLowerCase() === "f";
                    const rawWaLink = isFemale ? (hObj?.whatsappLinkWomen) : (hObj?.whatsappLinkMen);
                    const sanitizeUrl = (url) => {
                        if (!url || typeof url !== 'string') return "#";
                        try {
                            const parsed = new URL(url.trim());
                            if (["http:", "https:", "mailto:", "whatsapp:"].includes(parsed.protocol)) return parsed.href;
                        } catch (e) {}
                        return "#";
                    };
                    const waLink = sanitizeUrl(rawWaLink);
                    const genderLabel = isFemale ? "Women's" : "Men's";
                    const genderColor = isFemale ? "#FF69B4" : "#1E90FF";

                    if (!rawWaLink) return <div style={{ marginTop: 16, fontSize: 11, color: dark ? "#666" : "#aaa", fontStyle: "italic", textAlign: "center" }}>WhatsApp group link not configured yet.</div>;

                    return (
                        <a href={waLink} target="_blank" rel="noopener noreferrer" style={{
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16,
                            background: "linear-gradient(135deg,#25D366,#128C7E)", color: "#fff", textDecoration: "none",
                            borderRadius: 10, padding: 12, fontWeight: 800, fontSize: 14, boxShadow: "0 4px 12px rgba(37,211,102,.2)"
                        }}>
                             <svg width="18" height="18" viewBox="0 0 32 32" fill="white"><path d="M16 2C8.27 2 2 8.27 2 16c0 2.46.65 4.77 1.78 6.77L2 30l7.47-1.75A13.93 13.93 0 0016 30c7.73 0 14-6.27 14-14S23.73 2 16 2zm0 25.38c-2.2 0-4.28-.6-6.07-1.64l-.43-.26-4.44 1.04 1.06-4.32-.28-.45A11.35 11.35 0 014.64 16C4.64 9.67 9.67 4.64 16 4.64S27.36 9.67 27.36 16 22.33 27.38 16 27.38zm6.28-8.5c-.34-.17-2.03-1-2.35-1.12-.32-.11-.55-.17-.78.17-.23.34-.9 1.12-1.1 1.35-.2.23-.4.26-.74.09-.34-.17-1.44-.53-2.74-1.69-1.01-.9-1.7-2.01-1.9-2.35-.2-.34-.02-.52.15-.69.15-.15.34-.4.51-.6.17-.2.23-.34.34-.57.11-.23.06-.43-.03-.6-.09-.17-.78-1.88-1.07-2.57-.28-.67-.57-.58-.78-.59h-.66c-.23 0-.6.09-.91.43-.31.34-1.19 1.16-1.19 2.83s1.22 3.28 1.39 3.51c.17.23 2.4 3.66 5.82 5.13.81.35 1.44.56 1.93.72.81.26 1.55.22 2.14.13.65-.1 2.03-.83 2.31-1.63.29-.8.29-1.49.2-1.63-.08-.14-.31-.23-.65-.4z"/></svg>
                             Join {genderLabel} WhatsApp Group →
                        </a>
                    );
                })()}

                <div style={{ marginTop: 12, padding: "9px 12px", background: dark ? "rgba(255,200,0,.1)" : "#fffbea", border: "1px solid #FFD70066", borderRadius: 8, fontSize: 12, color: dark ? "#ffd700" : "#856404" }}>⚠️ To change, contact your Sports Admin.</div>
            </div>
            <button onClick={() => { setStudent(null); setInput(""); setOtpSent(false); setIsOtpVerified(false); setExistingRegistration(null); setIsPartial(false); }} style={{ marginTop: 14, background: "transparent", border: `1px solid ${dark ? "#444" : "#ddd"}`, color: dark ? "#ccc" : "#666", borderRadius: 50, padding: "10px 24px", cursor: "pointer", fontSize: 14 }}>← Back</button>
        </div>
    );

    if (showQuery && student) return (
        <div style={{ maxWidth: 500, margin: "60px auto", padding: 20 }}>
            <h2 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", fontSize: 24, marginBottom: 16 }}>Report Data Error</h2>
            <div style={{ background: dark ? "#1a1a2e" : "#fff", border: `1px solid ${dark ? "#333" : "#eee"}`, borderRadius: 14, padding: 24 }}>
                <p style={{ fontSize: 13, color: dark ? "#aaa" : "#666", marginBottom: 20 }}>Found a spelling mistake in your name or email? Report it here and the Admin will fix it for you.</p>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Issue Type</label>
                <select value={queryData.issueType} onChange={e => setQueryData({...queryData, issueType: e.target.value})} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #ddd", marginBottom: 16 }}>
                    <option>Name Spelling</option>
                    <option>Email Change</option>
                    <option>Department/Year Error</option>
                    <option>Other</option>
                </select>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Details</label>
                <textarea value={queryData.details} onChange={e => setQueryData({...queryData, details: e.target.value})} placeholder="e.g. My name is spelled 'Abishek' not 'Abhishek'" style={{ width: "100%", height: 100, padding: 12, borderRadius: 8, border: "1px solid #ddd", marginBottom: 16, fontFamily: "inherit" }} />
                {error && <div style={{ color: "#c00", fontSize: 12, marginBottom: 10 }}>{error}</div>}
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={submitQuery} disabled={isVerifying} style={{ flex: 1, background: "#8B0000", color: "#fff", border: "none", borderRadius: 8, padding: 14, fontWeight: 700 }}>{isVerifying ? "Submitting..." : "Submit Report"}</button>
                    <button onClick={() => setShowQuery(false)} style={{ flex: 1, background: "transparent", border: "1px solid #ddd", borderRadius: 8, padding: 14, color: dark ? "#fff" : "#222" }}>Cancel</button>
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ maxWidth: 600, margin: "0 auto", padding: isMobile ? "16px 12px" : "40px 20px" }}>
            <h1 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", marginBottom: 6, fontSize: isMobile ? 21 : 28 }}>📝 Event Registration</h1>
            <div style={{ marginBottom: isMobile ? 14 : 24 }}>
                {isClosed ? (
                    <div style={{ display: "inline-block", background: dark ? "rgba(204,0,0,.15)" : "#fff0f0", border: "1px solid #cc000066", borderRadius: 50, padding: "6px 16px", color: "#c00", fontSize: 13, fontWeight: 700 }}>
                        🔴 REGISTRATIONS CLOSED
                    </div>
                ) : (
                    <div style={{ display: "inline-block", background: dark ? "rgba(46,139,87,.15)" : "#f0fff0", border: "1px solid #2E8B5766", borderRadius: 50, padding: "6px 16px", color: "#2E8B57", fontSize: 13, fontWeight: 700 }}>
                        🟢 REGISTRATION OPEN {registrationCloseTime && `• Closes at ${new Date(registrationCloseTime).toLocaleString()}`}
                    </div>
                )}
            </div>
            <p style={{ color: dark ? "#aaa" : "#666", marginBottom: isMobile ? 14 : 24, fontSize: isMobile ? 13 : 15 }}>Enter your register number or email</p>
            {isClosed && (
                <div style={{ background: "#cc000015", border: "1px solid #cc000044", borderRadius: 14, padding: "20px", textAlign: "center", marginBottom: 20 }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
                    <h3 style={{ margin: "0 0 8px", color: dark ? "#ff6b6b" : "#c00" }}>Registrations Closed</h3>
                    <p style={{ margin: 0, fontSize: 13, color: dark ? "#aaa" : "#555" }}>The official registration period has been closed by the Sports Administrator. Please contact them if you have any questions.</p>
                </div>
            )}
            {!isClosed && (
                <div style={{ background: dark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${dark ? "#333" : "#eee"}`, borderRadius: 14, padding: isMobile ? 16 : 28, boxShadow: "0 4px 24px rgba(0,0,0,.08)" }}>
                    {!student ? (
                        <>
                            <label style={{ display: "block", fontWeight: 600, color: dark ? "#ccc" : "#444", marginBottom: 8, fontSize: 14 }}>Email or University Register Number</label>
                            <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                                <input maxLength={100} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && lookup()} placeholder={isMobile ? "Email or Reg No" : "e.g. 23TD0578 or student@achariya.edu"} style={{ flex: 1, padding: "12px 14px", borderRadius: 8, fontSize: 16, border: `1px solid ${dark ? "#555" : "#ddd"}`, background: dark ? "#2a2a3e" : "#f8f8f8", color: dark ? "#fff" : "#333" }} />
                                <button onClick={lookup} style={{ background: "#8B0000", color: "#fff", border: "none", borderRadius: 8, padding: "12px 16px", cursor: "pointer", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>Lookup</button>
                            </div>
                            {error && <div style={{ marginTop: 8, color: "#c00", fontSize: 13 }}>⚠ {error}</div>}
                        </>
                    ) : (
                        <>
                            <div style={{ background: dark ? tint(hObj?.color || "#888888") : `rgba(${parseInt((hObj?.color || "#888888").slice(1, 3), 16)},${parseInt((hObj?.color || "#888888").slice(3, 5), 16)},${parseInt((hObj?.color || "#888888").slice(5, 7), 16)},.08)`, border: `2px solid ${hObj?.color || "#888"}`, borderRadius: 12, padding: 12, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 42, height: 42, borderRadius: "50%", background: hObj?.color || "#888", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 15, flexShrink: 0, overflow: "hidden", border: `2px solid ${dark ? "#444" : "#fff"}` }}>
                                    {hObj?.logo ? <img src={hObj.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : hi(hObj?.displayName || student.house)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 800, fontSize: 15, color: hObj?.color }}>{student.name}</div><div style={{ fontSize: 11, color: dark ? "#ccc" : "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hObj?.displayName || student.house} · {student.year} {student.dept ? `(${student.dept})` : ""} · {student.email}</div></div>
                                <button onClick={() => { setStudent(null); setError(""); setOtpSent(false); setIsOtpVerified(false); setLockedGames([]); setLockedAthletics([]); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: dark ? "#aaa" : "#999", fontSize: 20, flexShrink: 0 }}>✕</button>
                            </div>

                            {!isOtpVerified ? (
                                <div style={{ textAlign: "center", padding: "10px 0" }}>
                                    {!otpSent ? (
                                        <>
                                            <p style={{ color: dark ? "#ccc" : "#444", fontSize: 14, marginBottom: 16 }}>Privacy Check: Verify its you via Email OTP</p>
                                            <button onClick={sendOtp} disabled={isVerifying} style={{ background: "#8B0000", color: "#fff", border: "none", borderRadius: 50, padding: "12px 30px", cursor: "pointer", fontWeight: 700, transition: "transform .2s" }}>{isVerifying ? "Sending..." : "🔑 Send Verification Code"}</button>
                                        </>
                                    ) : (
                                        <>
                                            <p style={{ color: dark ? "#ccc" : "#444", fontSize: 14, marginBottom: 8 }}>Enter the 6-digit code sent to your email</p>
                                            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 }}>
                                                <input value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} placeholder="······" style={{ width: 140, textAlign: "center", letterSpacing: 4, padding: "12px", borderRadius: 8, fontSize: 20, fontWeight: 800, border: `2px solid ${dark ? "#555" : "#ddd"}`, background: dark ? "#2a2a3e" : "#fff", color: dark ? "#fff" : "#222" }} />
                                                <button onClick={verifyOtp} disabled={isVerifying || otp.length < 6} style={{ background: "#228B22", color: "#fff", border: "none", borderRadius: 8, padding: "0 20px", cursor: "pointer", fontWeight: 700 }}>{isVerifying ? "..." : "Verify"}</button>
                                            </div>
                                            <button onClick={sendOtp} style={{ background: "transparent", border: "none", color: "#1E90FF", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Resend Code</button>
                                        </>
                                    )}
                                    {error && <div style={{ marginTop: 12, color: "#c00", fontSize: 13, fontWeight: 600 }}>⚠ {error}</div>}
                                </div>
                            ) : (
                                <>
                                    <div style={{ background: dark ? "rgba(34,139,34,.15)" : "#f0fff0", border: "1px solid #228B2266", borderRadius: 9, padding: "16px", marginBottom: 16, textAlign: "center" }}>
                                        <div style={{ fontSize: 12, color: dark ? "#90EE90" : "#228B22", fontWeight: 700, marginBottom: 12 }}>✅ Verified As: {student.name}</div>
                                        
                                        {/* Identity Check & Query Link */}
                                        <div style={{ padding: 12, background: dark ? "rgba(0,0,0,.2)" : "rgba(0,0,0,.03)", borderRadius: 10, textAlign: "left" }}>
                                            <div style={{ fontSize: 11, color: dark ? "#aaa" : "#888", marginBottom: 4 }}>House Group Join Link:</div>
                                            <a href={
                                                (function sanitizeUrl(url) {
                                                    if (!url || typeof url !== 'string') return "#";
                                                    try {
                                                        const parsed = new URL(url.trim());
                                                        if (["http:", "https:", "mailto:", "whatsapp:"].includes(parsed.protocol)) return parsed.href;
                                                    } catch (e) {}
                                                    return "#";
                                                })((student.gender?.toLowerCase() === "female" || student.gender?.toLowerCase() === "f") ? hObj?.whatsappLinkWomen : hObj?.whatsappLinkMen)
                                            } target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#25D366", fontWeight: 800, textDecoration: "none", display: "block", marginBottom: 8 }}>💬 Join {hObj?.displayName || student.house} WhatsApp Group →</a>
                                            
                                            <div style={{ borderTop: `1px solid ${dark ? "#444" : "#ddd"}`, paddingTop: 8, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <span style={{ fontSize: 11, color: dark ? "#888" : "#999" }}>Spelling mistake?</span>
                                                <button onClick={() => setShowQuery(true)} style={{ background: "transparent", border: "none", color: "#8B0000", fontWeight: 700, fontSize: 11, cursor: "pointer", padding: 0 }}>Report to Admin</button>
                                            </div>
                                        </div>
                                    </div>

                                    {existingRegistration && isPartial && (student.hasGame || student.hasAthletic) && (
                                        <div style={{ padding: "8px 12px", background: "#FFD70022", border: "1px solid #FFD70055", borderRadius: 8, fontSize: 11, color: dark ? "#ffd700" : "#856404", marginBottom: 16, textAlign: "center", fontWeight: 700 }}>
                                            ⚠️ You have already registered for {student.hasGame ? "a Game" : "an Athletic Event"}. You can now add your missing selection.
                                        </div>
                                    )}
                                    <div style={{ marginBottom: 20 }}>
                                        <label style={{ display: "block", fontWeight: 600, color: dark ? "#ccc" : "#444", marginBottom: 8, fontSize: 14 }}>{student.role === "Staff" ? `Staff Games (Max ${maxGames})` : `Team Games (Max ${maxGames})`}</label>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                            {(function() {
                                                const isWomen = (student.gender?.toLowerCase() === "female" || student.gender?.toLowerCase() === "f");
                                                const commonList = isWomen ? commonGamesWomen : commonGamesMen;
                                                const baseGamesList = student.role === "Staff" ? (isWomen ? staffGamesListWomens : staffGamesList) : (isWomen ? sportGamesListWomens : sportGamesList);
                                                
                                                // Combine standard games with common games
                                                const gamesList = [...new Set([...baseGamesList, ...(commonList || [])])];
                                                
                                                if (gamesList.length === 0) return <span style={{ fontSize: 12, color: dark ? "#888" : "#999", fontStyle: "italic" }}>No {student.role === "Staff" ? "staff" : "team"} games available</span>;

                                                return gamesList.map(g => {
                                                    const isClosed = closedEvents?.includes(g);
                                                    const isSelected = gameSel.includes(g);
                                                    const isLocked = lockedGames.includes(g);
                                                    const isCommon = commonList.includes(g);
                                                    return (
                                                        <button key={g} disabled={isClosed || isLocked} onClick={() => {
                                                            if (isSelected) setGameSel(gameSel.filter(x => x !== g));
                                                            else {
                                                                const nonCommonCount = gameSel.filter(x => !commonList.includes(x)).length;
                                                                if (isCommon || nonCommonCount < maxGames) {
                                                                    setGameSel([...gameSel, g]);
                                                                } else {
                                                                    alert(`You can only select up to ${maxGames} team games.`);
                                                                }
                                                            }
                                                        }} style={{ background: isSelected ? "#8B0000" : (isClosed || isLocked ? (dark ? "#333" : "#eee") : "transparent"), color: isSelected ? "#fff" : (isClosed || isLocked ? (dark ? "#777" : "#aaa") : (dark ? "#aaa" : "#555")), border: `1px solid ${isSelected ? "#8B0000" : dark ? "#444" : "#ddd"}`, borderRadius: 50, padding: "8px 16px", cursor: (isClosed || isLocked) ? "not-allowed" : "pointer", fontSize: 13, transition: "all .2s", textDecoration: isClosed ? "line-through" : "none" }}>
                                                            {g} {isCommon && <span style={{ fontSize: 10, opacity: 0.8, fontWeight: 400, marginLeft: 4 }}>(Common)</span>} {isClosed && "(Closed)"} {isLocked && "🔒"}
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                    {student.role !== "Staff" && (
                                        <div style={{ marginBottom: 24 }}>
                                            <label style={{ display: "block", fontWeight: 600, color: dark ? "#ccc" : "#444", marginBottom: 8, fontSize: 14 }}>Athletic Events (Max {maxAthletics})</label>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                {(function() {
                                                    const isWomen = (student.gender?.toLowerCase() === "female" || student.gender?.toLowerCase() === "f");
                                                    const commonList = isWomen ? commonAthleticsWomen : commonAthleticsMen;
                                                    const baseAthletics = isWomen ? athleticsListWomens : athleticsList;
                                                    
                                                    // Combine standard athletics with common athletics
                                                    const athletics = [...new Set([...baseAthletics, ...(commonList || [])])];

                                                    return athletics.map(a => {
                                                        const isClosed = closedEvents?.includes(a);
                                                        const isSelected = athleticSel.includes(a);
                                                        const isLocked = lockedAthletics.includes(a);
                                                        const isCommon = commonList.includes(a);
                                                        return (
                                                            <button key={a} disabled={isClosed || isLocked} onClick={() => {
                                                                if (isSelected) setAthleticSel(athleticSel.filter(x => x !== a));
                                                                else {
                                                                    const nonCommonCount = athleticSel.filter(x => !commonList.includes(x)).length;
                                                                    if (isCommon || nonCommonCount < maxAthletics) {
                                                                        setAthleticSel([...athleticSel, a]);
                                                                    } else {
                                                                        alert(`You can only select up to ${maxAthletics} athletic events.`);
                                                                    }
                                                                }
                                                            }} style={{ background: isSelected ? "#4B0082" : (isClosed || isLocked ? (dark ? "#333" : "#eee") : "transparent"), color: isSelected ? "#fff" : (isClosed || isLocked ? (dark ? "#777" : "#aaa") : (dark ? "#aaa" : "#555")), border: `1px solid ${isSelected ? "#4B0082" : dark ? "#444" : "#ddd"}`, borderRadius: 50, padding: "8px 16px", cursor: (isClosed || isLocked) ? "not-allowed" : "pointer", fontSize: 13, transition: "all .2s", textDecoration: isClosed ? "line-through" : "none" }}>
                                                                {a} {isCommon && <span style={{ fontSize: 10, opacity: 0.8, fontWeight: 400, marginLeft: 4 }}>(Common)</span>} {isClosed && "(Closed)"} {isLocked && "🔒"}
                                                            </button>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                    {error && <div style={{ marginBottom: 10, color: "#c00", fontSize: 13 }}>⚠ {error}</div>}
                                    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 10 }}>
                                        <div style={{ fontSize: 12, color: dark ? "#888" : "#aaa" }}>{gameSel.length > 0 && <span style={{ color: "#8B0000", fontWeight: 600 }}>⚽ {gameSel.join(", ")}</span>}{gameSel.length > 0 && athleticSel.length > 0 && " · "}{athleticSel.length > 0 && <span style={{ color: "#4B0082", fontWeight: 600 }}>🏃 {athleticSel.join(", ")}</span>}{gameSel.length === 0 && athleticSel.length === 0 && "No events selected yet"}</div>
                                        <button onClick={submit} disabled={gameSel.length === 0 && athleticSel.length === 0} style={{ background: (gameSel.length > 0 || athleticSel.length > 0) ? "linear-gradient(135deg,#8B0000,#C41E3A)" : "#ccc", color: "#fff", border: "none", borderRadius: 50, padding: "13px 22px", cursor: (gameSel.length > 0 || athleticSel.length > 0) ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 15, textAlign: "center" }}>Register & Lock 🔒</button>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export function ScoreboardPage({ dark, houses, pointLog, registrationOpen = true, registrationCloseTime }) {
    const sh = [...houses].sort((a, b) => b.points - a.points);
    const isMobile = useIsMobile();
    const isClosed = !registrationOpen || (registrationCloseTime && new Date() > new Date(registrationCloseTime));

    return (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "16px 12px" : "40px 20px" }}>
            <div style={{ textAlign: "center", marginBottom: isMobile ? 20 : 40 }}>
                <div style={{ fontSize: isMobile ? 36 : 48, marginBottom: 6 }}>🏆</div>
                <h1 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", margin: 0, fontSize: isMobile ? 21 : 28 }}>Live Scoreboard</h1>
                <p style={{ color: dark ? "#aaa" : "#666", fontSize: 12, marginBottom: 16 }}>🟢 Live · {new Date().toLocaleTimeString()}</p>
            </div>
            {sh.map((h, i) => (
                <div key={h.id} style={{ background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `2px solid ${i === 0 ? h.color : dark ? "#333" : h.color + "44"}`, borderRadius: 14, padding: isMobile ? 12 : 24, marginBottom: isMobile ? 8 : 16, display: "flex", alignItems: "center", gap: isMobile ? 10 : 20, boxShadow: i === 0 ? `0 8px 40px ${h.color}44` : "0 2px 12px rgba(0,0,0,.06)", flexWrap: "wrap" }}>
                    <div style={{ width: isMobile ? 38 : 52, height: isMobile ? 38 : 52, borderRadius: "50%", background: i === 0 ? "linear-gradient(135deg,#FFD700,#FFA500)" : h.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 17 : 22, fontWeight: 900, color: i === 0 ? "#000" : h.color, flexShrink: 0 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</div>
                    <div style={{ width: isMobile ? 34 : 44, height: isMobile ? 34 : 44, borderRadius: "50%", background: h.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: isMobile ? 12 : 16, flexShrink: 0, overflow: "hidden", border: `2px solid ${dark ? "#444" : "#fff"}` }}>
                        {h.logo ? <img src={h.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : hi(h.displayName || h.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 80 }}>
                        <div style={{ fontWeight: 800, fontSize: isMobile ? 15 : 22, color: dark ? "#fff" : h.color }}>{h.displayName || h.name} House</div>
                        {i === 0 && h.points > 0 && <div style={{ fontSize: 10, color: h.color }}>👑 LEADING</div>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: isMobile ? 28 : 44, fontWeight: 900, fontFamily: "'Georgia',serif", color: i === 0 ? h.color : dark ? "#fff" : "#222", lineHeight: 1 }}><Count v={h.points} /></div>
                        <div style={{ fontSize: 9, color: dark ? "#aaa" : "#888", letterSpacing: 2 }}>POINTS</div>
                    </div>
                    <div style={{ width: "100%", height: 6, background: dark ? "#333" : "#f0f0f0", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", background: i === 0 && h.points > 0 ? `linear-gradient(90deg,${h.color},${tint(h.color)})` : h.color, borderRadius: 3, width: `${sh[0].points > 0 ? (h.points / sh[0].points) * 100 : 0}%`, transition: "width .8s ease" }} />
                    </div>
                </div>
            ))}
            <h2 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", marginTop: isMobile ? 24 : 48, marginBottom: 14, fontSize: isMobile ? 17 : 22 }}>📋 Points Log</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {pointLog.map((p, i) => {
                    if (typeof p === "string") {
                        return (
                            <div key={i} style={{ background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `1px solid ${dark ? "#333" : "#eee"}`, borderRadius: 9, padding: isMobile ? "9px 11px" : "12px 16px", display: "flex", alignItems: "center", gap: 9 }}>
                                <div style={{ fontSize: isMobile ? 15 : 20, flexShrink: 0 }}>✨</div>
                                <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: dark ? "#fff" : "#222" }}>{p}</div>
                            </div>
                        );
                    }
                    const hObj = houses.find(h => h.name === p.house);
                    return (
                        <div key={i} style={{ background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `1px solid ${dark ? "#333" : "#eee"}`, borderRadius: 9, padding: isMobile ? "9px 11px" : "12px 16px", display: "flex", alignItems: "center", gap: 9 }}>
                            <div style={{ fontSize: isMobile ? 15 : 20, flexShrink: 0 }}>{p.type === "win" ? "🏆" : p.type === "bonus" ? "⭐" : "⚠️"}</div>
                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: hObj?.color || "#888", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 800, flexShrink: 0, overflow: "hidden", border: `1px solid ${dark ? "#444" : "#fff"}` }}>
                                {hObj?.logo ? <img src={hObj.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : hi(hObj?.displayName || p.house)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}><span style={{ fontWeight: 700, color: dark ? "#fff" : "#222", fontSize: 13 }}>{hObj?.displayName || p.house}</span><span style={{ color: dark ? "#aaa" : "#888", marginLeft: 6, fontSize: 12 }}>{p.reason}</span></div>
                            <div style={{ fontWeight: 800, fontSize: isMobile ? 13 : 16, color: p.pts > 0 ? "#228B22" : "#c00", flexShrink: 0 }}>{p.pts > 0 ? "+" : ""}{p.pts}</div>
                            <div style={{ fontSize: 10, color: dark ? "#aaa" : "#aaa", flexShrink: 0 }}>{p.time}</div>
                        </div>
                    );
                })}
                {pointLog.length === 0 && <div style={{ color: dark ? "#666" : "#aaa", textAlign: "center", padding: 20, fontSize: 14 }}>No points history yet.</div>}
            </div>
        </div>
    );
}

export function GalleryPage({ dark, gallery }) {
    const [sel, setSel] = useState(null);
    const isMobile = useIsMobile();
    const cur = gallery.filter(g => g.category === "current");
    const prev = gallery.filter(g => g.category === "previous");
    const Grid = ({ imgs }) => (
        <div style={{ 
            columnCount: isMobile ? 2 : 4, 
            columnGap: isMobile ? 7 : 12,
            width: "100%"
        }}>
            {imgs.map((img, i) => (
                <div key={i} onClick={() => setSel(img)} style={{ 
                    marginBottom: isMobile ? 7 : 12, 
                    borderRadius: 10, 
                    overflow: "hidden", 
                    cursor: "pointer", 
                    background: dark ? "#222" : "#f0f0f0", 
                    position: "relative",
                    breakInside: "avoid",
                    display: "inline-block",
                    width: "100%"
                }}
                    onMouseEnter={e => e.currentTarget.querySelector(".ov2").style.opacity = "1"}
                    onMouseLeave={e => e.currentTarget.querySelector(".ov2").style.opacity = "0"}>
                    <img src={img.src} alt={img.label} style={{ width: "100%", height: "auto", display: "block" }} />
                    <div className="ov2" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "flex-end", padding: 6, opacity: 0, transition: "opacity .2s" }}>
                        <span style={{ color: "#fff", fontSize: 11, fontWeight: 600 }}>{img.label}</span>
                    </div>
                </div>
            ))}
        </div>
    );
    return (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "16px 12px" : "40px 20px" }}>
            <h1 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", marginBottom: 6, fontSize: isMobile ? 21 : 28 }}>🎨 Gallery</h1>
            <p style={{ color: dark ? "#aaa" : "#666", marginBottom: isMobile ? 14 : 32, fontSize: 13 }}>Sports Day memories</p>
            {cur.length > 0 && <><h2 style={{ fontFamily: "'Georgia',serif", color: dark ? "#ccc" : "#444", marginBottom: 10, fontSize: isMobile ? 16 : 20 }}>📸 Current Year ({cur.length})</h2><div style={{ marginBottom: isMobile ? 20 : 40 }}><Grid imgs={cur} /></div></>}
            {prev.length > 0 && <><h2 style={{ fontFamily: "'Georgia',serif", color: dark ? "#ccc" : "#444", marginBottom: 10, fontSize: isMobile ? 16 : 20 }}>🏆 Previous Years ({prev.length})</h2><div style={{ marginBottom: isMobile ? 20 : 40 }}><Grid imgs={prev} /></div></>}
            {gallery.length === 0 && <div style={{ textAlign: "center", padding: isMobile ? 40 : 80, color: dark ? "#666" : "#aaa" }}><div style={{ fontSize: isMobile ? 48 : 64, marginBottom: 10 }}>📷</div><div style={{ fontWeight: 600, fontSize: isMobile ? 14 : 16 }}>No images yet</div><div style={{ fontSize: 12, marginTop: 4 }}>Upload photos from Admin → Gallery</div></div>}
            {sel && (
                <div onClick={() => setSel(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 16 }}>
                    <div style={{ maxWidth: 700, width: "100%", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                        <img src={sel.src} alt={sel.label} style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 12, objectFit: "contain" }} />
                        <div style={{ color: "#fff", marginTop: 10, fontWeight: 600, fontSize: 14 }}>{sel.label}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 3 }}>{sel.category === "previous" ? "Previous Year" : "Current Year"}</div>
                        <button onClick={() => setSel(null)} style={{ marginTop: 14, background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", borderRadius: 50, padding: "11px 30px", cursor: "pointer", fontWeight: 600, fontSize: 15 }}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}
export function WinnersPage({ dark, results, houses, sportGamesList = [], sportGamesListWomens = [], athleticsList = [], athleticsListWomens = [] }) {
    const [hFilter, setHFilter] = useState("All");
    const [eFilter, setEFilter] = useState("All");
    const isMobile = useIsMobile();

    const filtered = results.filter(r => {
        const matchesH = hFilter === "All" || Object.values(r.placements).some(p => p.house === hFilter);
        const matchesE = eFilter === "All" || r.eventType === eFilter || r.eventName === eFilter;
        return matchesH && matchesE;
    });

    return (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: isMobile ? "16px 12px" : "40px 20px" }}>
            <div style={{ textAlign: "center", marginBottom: isMobile ? 24 : 40 }}>
                <div style={{ fontSize: isMobile ? 40 : 54, marginBottom: 8, filter: "drop-shadow(0 4px 12px rgba(0,0,0,.2))" }}>🏅</div>
                <h1 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", margin: 0, fontSize: isMobile ? 24 : 36 }}>Winners & Runners</h1>
                <p style={{ color: dark ? "#aaa" : "#666", fontSize: 13, marginTop: 4 }}>Official results for Sports Day {new Date().getFullYear()}</p>
            </div>

            {/* ── Filters ── */}
            <div style={{ background: dark ? "rgba(255,255,255,.03)" : "#f9f9f9", padding: "12px 16px", borderRadius: 14, marginBottom: 24, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", border: `1px solid ${dark ? "#333" : "#eee"}` }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: dark ? "#888" : "#888", marginRight: 5 }}>FILTERS:</span>
                <select value={hFilter} onChange={e => setHFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${dark ? "#444" : "#ddd"}`, background: dark ? "#222" : "#fff", color: dark ? "#fff" : "#333", fontSize: 13 }}>
                    <option value="All">All Houses</option>
                    {houses.map(h => <option key={h.id} value={h.name}>{h.displayName || h.name} House</option>)}
                </select>
                <select value={eFilter} onChange={e => setEFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${dark ? "#444" : "#ddd"}`, background: dark ? "#222" : "#fff", color: dark ? "#fff" : "#333", fontSize: 13 }}>
                    <option value="All">All Events</option>
                    <optgroup label="Categories">
                        <option value="game">Team Games</option>
                        <option value="athletic">Athletic Events</option>
                    </optgroup>
                    <optgroup label="Specific Games (Men)">
                        {sportGamesList.map(g => <option key={g} value={g}>{g}</option>)}
                    </optgroup>
                    <optgroup label="Specific Games (Women)">
                        {sportGamesListWomens.map(g => <option key={g} value={g}>{g}</option>)}
                    </optgroup>
                    <optgroup label="Athletics (Men)">
                        {athleticsList.map(a => <option key={a} value={a}>{a}</option>)}
                    </optgroup>
                    <optgroup label="Athletics (Women)">
                        {athleticsListWomens.map(a => <option key={a} value={a}>{a}</option>)}
                    </optgroup>
                </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(450px, 1fr))", gap: 20 }}>
                {filtered.map(res => (
                    <div key={res.id} style={{ background: dark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${dark ? "#333" : "#eee"}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,.04)" }}>
                        <div style={{ background: dark ? "rgba(255,255,255,.02)" : "#fdfdfd", padding: "14px 20px", borderBottom: `1px solid ${dark ? "#222" : "#f0f0f0"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 800, color: "#8B0000", letterSpacing: 1.5, textTransform: "uppercase" }}>{res.eventType}</div>
                                <div style={{ fontSize: 18, fontWeight: 900, color: dark ? "#fff" : "#1a1a1a" }}>{res.eventName}</div>
                            </div>
                            <div style={{ fontSize: 11, color: dark ? "#666" : "#aaa" }}>{res.time?.split(",")[0]}</div>
                        </div>
                        <div style={{ padding: 20 }}>
                            {[
                                { place: "first", medal: "🥇", label: "Winner", pts: "10 pts", color: "#FFD700" },
                                { place: "second", medal: "🥈", label: "Runner Up", pts: "6 pts", color: "#C0C0C0" },
                                { place: "third", medal: "🥉", label: "Third Place", pts: "4 pts", color: "#CD7F32" }
                            ].map(p => {
                                const win = res.placements[p.place];
                                if (!win.house) return null;
                                const hO = houses.find(h => h.name === win.house);
                                return (
                                    <div key={p.place} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: p.place === "third" ? 0 : 16 }}>
                                        <div style={{ fontSize: 24, width: 32, textAlign: "center" }}>{p.medal}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                                <div style={{ fontSize: 13, fontWeight: 800, color: p.color }}>{p.label}</div>
                                                <div style={{ fontSize: 10, fontWeight: 700, color: dark ? "#555" : "#ccc" }}>{p.pts}</div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                                                 <div style={{ padding: "3px 8px", background: hO?.color || "#888", color: "#fff", borderRadius: 6, fontSize: 12, fontWeight: 900 }}>{hO?.displayName || win.house}</div>
                                                 <div style={{ fontSize: 14, fontWeight: 700, color: dark ? "#ccc" : "#333" }}>{win.player || "Team Victory"}</div>
                                             </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div style={{ textAlign: "center", padding: 80, color: dark ? "#444" : "#ccc" }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>🏁</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>No results found</div>
                    <p style={{ fontSize: 14 }}>Try changing your filters or check back later.</p>
                </div>
            )}
        </div>
    );
}

export function StarPlayersPage({ dark, starPlayers = [], houses = [] }) {
    const isMobile = useIsMobile();
    const [search, setSearch] = useState("");

    const filtered = starPlayers.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.game.toLowerCase().includes(search.toLowerCase()) ||
        p.house.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "16px 12px" : "40px 20px" }}>
            <div style={{ textAlign: "center", marginBottom: isMobile ? 24 : 40 }}>
                <div style={{ fontSize: isMobile ? 40 : 54, marginBottom: 8, filter: "drop-shadow(0 4px 12px rgba(255,215,0,.4))" }}>🌟</div>
                <h1 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", margin: 0, fontSize: isMobile ? 24 : 36 }}>Star Players</h1>
                <p style={{ color: dark ? "#aaa" : "#666", fontSize: 13, marginTop: 4 }}>Highlighting the most outstanding athletes of the year</p>
            </div>

            <div style={{ marginBottom: 30, display: "flex", justifyContent: "center" }}>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, game, or house..."
                    style={{
                        width: "100%", maxWidth: 400, padding: "12px 20px", borderRadius: 50,
                        border: `2px solid ${dark ? "#444" : "#ddd"}`,
                        background: dark ? "rgba(255,255,255,.05)" : "#fff",
                        color: dark ? "#fff" : "#222", fontSize: 15,
                        boxShadow: "0 4px 12px rgba(0,0,0,.05)"
                    }}
                />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
                {filtered.map(p => {
                    const hObj = houses.find(h => h.name === p.house);
                    return (
                        <div key={p.id} style={{
                            background: dark ? "rgba(255,255,255,.04)" : "#fff",
                            border: `1px solid ${dark ? "#333" : "#eee"}`,
                            borderRadius: 16, overflow: "hidden",
                            boxShadow: "0 8px 24px rgba(0,0,0,.06)",
                            transition: "transform .2s",
                            cursor: "default"
                        }}
                            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"}
                            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                        >
                            <div style={{ height: 220, position: "relative", background: dark ? "#222" : "#f5f5f5" }}>
                                <img src={p.img} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                <div style={{
                                    position: "absolute", top: 12, right: 12,
                                    background: hObj?.color || "#555", color: "#fff",
                                    padding: "4px 12px", borderRadius: 50,
                                    fontSize: 11, fontWeight: 800, textTransform: "uppercase",
                                    boxShadow: "0 4px 12px rgba(0,0,0,.3)"
                                }}>
                                    {hObj?.displayName || p.house}
                                </div>
                                <div style={{
                                    position: "absolute", bottom: 0, left: 0, right: 0,
                                    background: "linear-gradient(transparent, rgba(0,0,0,.8))",
                                    padding: "30px 16px 12px",
                                    display: "flex", alignItems: "flex-end"
                                }}>
                                    <div style={{ color: "#fff", fontWeight: 800, fontSize: 18, textShadow: "0 2px 4px rgba(0,0,0,.5)" }}>
                                        {p.name}
                                    </div>
                                </div>
                            </div>
                            <div style={{ padding: "16px 20px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                    <div style={{ fontSize: 13, color: dark ? "#aaa" : "#666", fontWeight: 600 }}>
                                        {p.year} • {p.dept}
                                    </div>
                                </div>
                                <div style={{
                                    background: dark ? "rgba(255,215,0,.1)" : "#fffbea",
                                    border: "1px solid rgba(255,215,0,.3)",
                                    padding: "8px 12px", borderRadius: 8,
                                    fontSize: 13, color: dark ? "#ffd700" : "#b8860b",
                                    fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6
                                }}>
                                    🏆 {p.game}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div style={{ textAlign: "center", padding: 60, color: dark ? "#666" : "#aaa", background: dark ? "rgba(255,255,255,.02)" : "#fafafa", borderRadius: 16, border: `1px dashed ${dark ? "#444" : "#ccc"}` }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>No Star Players found</div>
                    <p style={{ fontSize: 14, marginTop: 4 }}>Check back later or adjust your search.</p>
                </div>
            )}
        </div>
    );
}
