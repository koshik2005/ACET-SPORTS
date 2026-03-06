import { useState } from "react";
import { useIsMobile, hi, tint, Count, Sheet } from "./utils.jsx";
import { API_BASE } from "./api.js";
export function RegistrationPage({ dark, registrations, setRegistrations, studentsDB, houses = [], sportGamesList = [], sportGamesListWomens = [], athleticsList = [], athleticsListWomens = [] }) {
    const [input, setInput] = useState("");
    const [student, setStudent] = useState(null);
    const [game, setGame] = useState("");
    const [athletic, setAthletic] = useState("");
    const [error, setError] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [isOtpVerified, setIsOtpVerified] = useState(false);
    const isMobile = useIsMobile();

    const existing = student ? registrations.find(r => r.email === student.email) : null;
    const hObj = houses.find(h => h.name === student?.house);

    const lookup = async () => {
        setError(""); setGame(""); setAthletic(""); setOtpSent(false); setIsOtpVerified(false); setOtp("");
        const f = studentsDB.find(s => s.email === input.trim() || s.regNo === input.trim());
        if (!f) {
            setError("Student not found. Check your email or register number.");
            return;
        }
        setStudent(f);
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

    const submit = () => {
        if (!game && !athletic) { setError("Please select at least one event."); return; }
        setRegistrations(p => [...p.filter(r => r.email !== student.email), { ...student, game, athletic, registeredAt: new Date().toLocaleTimeString() }]);
        setStudent(null); setInput(""); setGame(""); setAthletic(""); setError(""); setIsOtpVerified(false); setOtpSent(false);
    };

    if (student && existing) return (
        <div style={{ maxWidth: 600, margin: isMobile ? "16px auto" : "60px auto", padding: isMobile ? "16px 12px" : "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 52 }}>🔒</div>
            <h2 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", margin: "10px 0 8px", fontSize: isMobile ? 19 : 24 }}>Already Registered</h2>
            <p style={{ color: dark ? "#aaa" : "#666", marginBottom: 16, fontSize: 13 }}>Your registration is locked. Only an admin can make changes.</p>
            <div style={{ background: dark ? "rgba(255,255,255,.05)" : "#fff", border: `2px solid ${hObj?.color || "#888"}`, borderRadius: 14, padding: isMobile ? 14 : 28, textAlign: "left" }}>
                <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 18, color: hObj?.color, marginBottom: 10 }}>{existing.name} — {existing.house} House</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ background: dark ? "rgba(139,0,0,.15)" : "#fff5f5", border: "1px solid #8B000033", borderRadius: 9, padding: 12 }}><div style={{ fontSize: 10, color: "#8B0000", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>⚽ Game</div><div style={{ fontWeight: 700, color: dark ? "#fff" : "#222", fontSize: 13 }}>{existing.game || <span style={{ color: "#aaa", fontStyle: "italic" }}>None</span>}</div></div>
                    <div style={{ background: dark ? "rgba(75,0,130,.2)" : "#f5f0ff", border: "1px solid #4B008233", borderRadius: 9, padding: 12 }}><div style={{ fontSize: 10, color: "#4B0082", fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>🏃 Athletic</div><div style={{ fontWeight: 700, color: dark ? "#fff" : "#222", fontSize: 13 }}>{existing.athletic || <span style={{ color: "#aaa", fontStyle: "italic" }}>None</span>}</div></div>
                </div>
                <div style={{ marginTop: 12, padding: "9px 12px", background: dark ? "rgba(255,200,0,.1)" : "#fffbea", border: "1px solid #FFD70066", borderRadius: 8, fontSize: 12, color: dark ? "#ffd700" : "#856404" }}>⚠️ To change, contact your Sports Admin.</div>
            </div>
            <button onClick={() => { setStudent(null); setInput(""); setOtpSent(false); setIsOtpVerified(false); }} style={{ marginTop: 14, background: "transparent", border: `1px solid ${dark ? "#444" : "#ddd"}`, color: dark ? "#ccc" : "#666", borderRadius: 50, padding: "10px 24px", cursor: "pointer", fontSize: 14 }}>← Back</button>
        </div>
    );

    return (
        <div style={{ maxWidth: 600, margin: "0 auto", padding: isMobile ? "16px 12px" : "40px 20px" }}>
            <h1 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", marginBottom: 6, fontSize: isMobile ? 21 : 28 }}>📝 Event Registration</h1>
            <p style={{ color: dark ? "#aaa" : "#666", marginBottom: isMobile ? 14 : 32, fontSize: isMobile ? 13 : 15 }}>Enter your register number or email</p>
            <div style={{ background: dark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${dark ? "#333" : "#eee"}`, borderRadius: 14, padding: isMobile ? 16 : 28, boxShadow: "0 4px 24px rgba(0,0,0,.08)" }}>
                {!student ? (
                    <>
                        <label style={{ display: "block", fontWeight: 600, color: dark ? "#ccc" : "#444", marginBottom: 8, fontSize: 14 }}>Email or University Register Number</label>
                        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && lookup()} placeholder={isMobile ? "Email or Reg No" : "e.g. 23TD0578 or student@achariya.edu"} style={{ flex: 1, padding: "12px 14px", borderRadius: 8, fontSize: 16, border: `1px solid ${dark ? "#555" : "#ddd"}`, background: dark ? "#2a2a3e" : "#f8f8f8", color: dark ? "#fff" : "#333" }} />
                            <button onClick={lookup} style={{ background: "#8B0000", color: "#fff", border: "none", borderRadius: 8, padding: "12px 16px", cursor: "pointer", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>Lookup</button>
                        </div>
                        {error && <div style={{ marginTop: 8, color: "#c00", fontSize: 13 }}>⚠ {error}</div>}
                    </>
                ) : (
                    <>
                        <div style={{ background: dark ? tint(hObj?.color || "#888888") : `rgba(${parseInt((hObj?.color || "#888888").slice(1, 3), 16)},${parseInt((hObj?.color || "#888888").slice(3, 5), 16)},${parseInt((hObj?.color || "#888888").slice(5, 7), 16)},.08)`, border: `2px solid ${hObj?.color || "#888"}`, borderRadius: 12, padding: 12, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 42, height: 42, borderRadius: "50%", background: hObj?.color || "#888", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{hi(student.house)}</div>
                            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 800, fontSize: 15, color: hObj?.color }}>{student.name}</div><div style={{ fontSize: 11, color: dark ? "#ccc" : "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{student.house} · {student.year} {student.dept ? `(${student.dept})` : ""} · {student.email}</div></div>
                            <button onClick={() => { setStudent(null); setError(""); setOtpSent(false); setIsOtpVerified(false); }} style={{ background: "transparent", border: "none", cursor: "pointer", color: dark ? "#aaa" : "#999", fontSize: 20, flexShrink: 0 }}>✕</button>
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
                                <div style={{ background: dark ? "rgba(34,139,34,.15)" : "#f0fff0", border: "1px solid #228B2266", borderRadius: 9, padding: "9px 12px", fontSize: 12, color: dark ? "#90EE90" : "#228B22", marginBottom: 16, textAlign: "center" }}>✅ Identity Verified Successfully!</div>
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ fontWeight: 700, color: dark ? "#ccc" : "#444", display: "block", marginBottom: 8, fontSize: 14 }}>⚽ Select Game</label>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {(student.gender?.toLowerCase() === "female" || student.gender?.toLowerCase() === "f" ? sportGamesListWomens : sportGamesList).map(sg => <button key={sg} onClick={() => setGame(g => g === sg ? "" : sg)} style={{ padding: "8px 12px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: 600, background: game === sg ? "#8B0000" : "transparent", color: game === sg ? "#fff" : dark ? "#ccc" : "#444", border: `2px solid ${game === sg ? "#8B0000" : dark ? "#444" : "#ddd"}` }}>{game === sg ? "✓ " : ""}{sg}</button>)}
                                    </div>
                                </div>
                                <div style={{ marginBottom: 18 }}>
                                    <label style={{ fontWeight: 700, color: dark ? "#ccc" : "#444", display: "block", marginBottom: 8, fontSize: 14 }}>🏃 Select Athletic Event</label>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                        {(student.gender?.toLowerCase() === "female" || student.gender?.toLowerCase() === "f" ? athleticsListWomens : athleticsList).map(a => <button key={a} onClick={() => setAthletic(at => at === a ? "" : a)} style={{ padding: "8px 12px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: 600, background: athletic === a ? "#4B0082" : "transparent", color: athletic === a ? "#fff" : dark ? "#ccc" : "#444", border: `2px solid ${athletic === a ? "#4B0082" : dark ? "#444" : "#ddd"}` }}>{athletic === a ? "✓ " : ""}{a}</button>)}
                                    </div>
                                </div>
                                {error && <div style={{ marginBottom: 10, color: "#c00", fontSize: 13 }}>⚠ {error}</div>}
                                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 10 }}>
                                    <div style={{ fontSize: 12, color: dark ? "#888" : "#aaa" }}>{game && <span style={{ color: "#8B0000", fontWeight: 600 }}>⚽ {game}</span>}{game && athletic && " · "}{athletic && <span style={{ color: "#4B0082", fontWeight: 600 }}>🏃 {athletic}</span>}{!game && !athletic && "No events selected yet"}</div>
                                    <button onClick={submit} disabled={!game && !athletic} style={{ background: (game || athletic) ? "linear-gradient(135deg,#8B0000,#C41E3A)" : "#ccc", color: "#fff", border: "none", borderRadius: 50, padding: "13px 22px", cursor: (game || athletic) ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 15, textAlign: "center" }}>Register & Lock 🔒</button>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export function ScoreboardPage({ dark, houses, pointLog }) {
    const sh = [...houses].sort((a, b) => b.points - a.points);
    const isMobile = useIsMobile();
    return (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "16px 12px" : "40px 20px" }}>
            <div style={{ textAlign: "center", marginBottom: isMobile ? 20 : 40 }}>
                <div style={{ fontSize: isMobile ? 36 : 48, marginBottom: 6 }}>🏆</div>
                <h1 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", margin: 0, fontSize: isMobile ? 21 : 28 }}>Live Scoreboard</h1>
                <p style={{ color: dark ? "#aaa" : "#666", fontSize: 12 }}>🟢 Live · {new Date().toLocaleTimeString()}</p>
            </div>
            {sh.map((h, i) => (
                <div key={h.id} style={{ background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `2px solid ${i === 0 ? h.color : dark ? "#333" : h.color + "44"}`, borderRadius: 14, padding: isMobile ? 12 : 24, marginBottom: isMobile ? 8 : 16, display: "flex", alignItems: "center", gap: isMobile ? 10 : 20, boxShadow: i === 0 ? `0 8px 40px ${h.color}44` : "0 2px 12px rgba(0,0,0,.06)", flexWrap: "wrap" }}>
                    <div style={{ width: isMobile ? 38 : 52, height: isMobile ? 38 : 52, borderRadius: "50%", background: i === 0 ? "linear-gradient(135deg,#FFD700,#FFA500)" : h.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 17 : 22, fontWeight: 900, color: i === 0 ? "#000" : h.color, flexShrink: 0 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</div>
                    <div style={{ width: isMobile ? 34 : 44, height: isMobile ? 34 : 44, borderRadius: "50%", background: h.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: isMobile ? 12 : 16, flexShrink: 0 }}>{hi(h.name)}</div>
                    <div style={{ flex: 1, minWidth: 80 }}>
                        <div style={{ fontWeight: 800, fontSize: isMobile ? 15 : 22, color: dark ? "#fff" : h.color }}>{h.name} House</div>
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
                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: hObj?.color || "#888", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{hi(p.house)}</div>
                            <div style={{ flex: 1, minWidth: 0 }}><span style={{ fontWeight: 700, color: dark ? "#fff" : "#222", fontSize: 13 }}>{p.house}</span><span style={{ color: dark ? "#aaa" : "#888", marginLeft: 6, fontSize: 12 }}>{p.reason}</span></div>
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
        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill,minmax(${isMobile ? 110 : 160}px,1fr))`, gap: isMobile ? 7 : 12 }}>
            {imgs.map((img, i) => (
                <div key={i} onClick={() => setSel(img)} style={{ borderRadius: 10, overflow: "hidden", aspectRatio: "1", cursor: "pointer", background: dark ? "#222" : "#f0f0f0", position: "relative" }}
                    onMouseEnter={e => e.currentTarget.querySelector(".ov2").style.opacity = "1"}
                    onMouseLeave={e => e.currentTarget.querySelector(".ov2").style.opacity = "0"}>
                    <img src={img.src} alt={img.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                    {houses.map(h => <option key={h.id} value={h.name}>{h.name} House</option>)}
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
                                                <div style={{ padding: "3px 8px", background: hO?.color || "#888", color: "#fff", borderRadius: 6, fontSize: 12, fontWeight: 900 }}>{win.house}</div>
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
