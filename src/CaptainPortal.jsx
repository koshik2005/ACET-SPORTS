import { useState } from "react";
import { useIsMobile, hi } from "./utils.jsx";
import * as XLSX from "xlsx";
import { API_BASE } from "./api.js";

export function CaptainPortal({ dark, houses, registrations, studentsDB, setStudentsDB, isFetching }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPwd, setShowPwd] = useState(false);
    const [captain, setCaptain] = useState(null); // { name, role, houseRole, house, houseColor, houseId, houseDisplayName }
    const [newName, setNewName] = useState("");
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("Dashboard"); // Dashboard, Roster, Participation, T-Shirt Issue
    const [shirtIssueTab, setShirtIssueTab] = useState("Pending"); // Pending, Issued
    const [filterType, setFilterType] = useState("All"); // All, Game, Athletic
    const [filterVal, setFilterVal] = useState("All");
    const isMobile = useIsMobile();

    const ROLE_LABELS = {
        boysCaptain: "♂ Captain", girlsCaptain: "♀ Captain",
        viceCaptainBoys: "♂ Vice Captain", viceCaptainGirls: "♀ Vice Captain",
        staffCaptainMale: "🎓 Staff Captain (M)", staffCaptainFemale: "🎓 Staff Captain (F)",
    };

    const login = async () => {
        setError("");
        const em = email.trim();
        if (!em || !password) {
            setError("Email and password are required.");
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/captain-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: em, password })
            });
            const data = await res.json();

            if (data.success) {
                localStorage.setItem("captainToken", data.token);
                setCaptain({
                    name: data.captainName,
                    role: ROLE_LABELS[data.houseRole],
                    houseRole: data.houseRole,
                    house: data.houseName,
                    houseColor: data.houseColor,
                    houseId: data.houseId,
                    houseDisplayName: data.houseDisplayName
                });
                setNewName(data.houseDisplayName || data.houseName);
                setEmail(""); setPassword("");
            } else {
                setError(data.error || "Incorrect email or password.");
            }
        } catch (err) {
            console.error("CAPTAIN LOGIN ERROR:", err);
            setError(`Failed to reach server: ${err.message}`);
        }
    };

    // Determine captain's gender scope from their role
    const captainIsMale = captain ? (
        ["boysCaptain", "viceCaptainBoys", "staffCaptainMale"].includes(captain.houseRole)
    ) : true;
    const captainGender = captainIsMale ? "male" : "female";

    const houseRegs = captain
        ? registrations.filter(r => {
            const student = studentsDB.find(s => s.regNo === r.regNo);
            if (!student || student.role === "Staff") return false;
            if ((r.house || "").toLowerCase() !== captain.house.toLowerCase()) return false;
            
            // Filter out cleared registrations
            const hasGame = r.game && !["None", "—", ""].includes(r.game);
            const hasAthletic = r.athletic && !["None", "—", ""].includes(r.athletic);
            if (!hasGame && !hasAthletic) return false;

            // gender filter
            const g = (student.gender || "").toLowerCase();
            return captainIsMale ? (g === "male" || g === "m") : (g === "female" || g === "f");
        })
        : [];

    const houseStudents = captain
        ? studentsDB.filter(s => {
            if (s.role === "Staff") return false;
            if ((s.house || "").toLowerCase() !== captain.house.toLowerCase()) return false;
            const g = (s.gender || "").toLowerCase();
            return captainIsMale ? (g === "male" || g === "m") : (g === "female" || g === "f");
        })
        : [];

    const staffRegs = registrations.filter(r => {
        const hasGame = r.game && !["None", "—", ""].includes(r.game);
        const hasAthletic = r.athletic && !["None", "—", ""].includes(r.athletic);
        if (!hasGame && !hasAthletic) return false;
        return studentsDB.find(s => s.regNo === r.regNo)?.role === "Staff";
    });

    const filteredHouseRegs = houseRegs.filter(r => {
        if (filterType === "All") return true;
        if (filterType === "Game") {
            return filterVal === "All" || (r.game && r.game.split(", ").includes(filterVal));
        }
        if (filterType === "Athletic") {
            return filterVal === "All" || (r.athletic && r.athletic.split(", ").includes(filterVal));
        }
        return true;
    });

    const exportToExcel = () => {
        const data = houseStudents.map((s, i) => {
            const reg = houseRegs.find(r => r.regNo === s.regNo);
            return {
                "S.No": s.sno || i + 1,
                "Name": s.name,
                "Register No": s.regNo,
                "Gender": s.gender || "—",
                "Year": s.year || "N/A",
                "Department": s.dept || "—",
                "House": s.house,
                "T-Shirt Size": s.shirtSize || "—",
                "T-Shirt Issued": s.shirtIssued ? "✅ YES" : "❌ NO",
                "Status": reg ? "✅ REGISTERED" : "❌ PENDING",
                "Game": reg?.game || "—",
                "Athletic Event": reg?.athletic || "—",
                "Registration Time": reg ? reg.registeredAt : "—"
            };
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "HouseRoster");
        XLSX.writeFile(wb, `${captain.house}_Full_Roster.xlsx`);
    };

    const exportFilteredToExcel = () => {
        const data = filteredHouseRegs.map((r, i) => {
            const student = houseStudents.find(s => s.regNo === r.regNo);
            return {
                "S.No": i + 1,
                "Name": r.name,
                "Register No": r.regNo,
                "Year": student?.year || "N/A",
                "Department": student?.dept || "—",
                "House": r.house,
                "Game": r.game,
                "Athletic Event": r.athletic,
                "Registration Time": r.registeredAt
            };
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "FilteredParticipation");
        const filename = filterVal === "All" ? `${captain.house}_Participation_List.xlsx` : `${captain.house}_${filterVal}_List.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    const exportShirtList = (type) => { // "Pending" or "Issued"
        const list = type === "Pending"
            ? houseStudents.filter(s => !s.shirtIssued)
            : houseStudents.filter(s => s.shirtIssued);

        const data = list.map((s, i) => ({
            "S.No": s.sno || i + 1,
            "Name": s.name,
            "Register No": s.regNo,
            "Gender": s.gender || "—",
            "Year": s.year || "N/A",
            "Department": s.dept || "—",
            "House": s.house,
            "T-Shirt Size": s.shirtSize || "—",
            "T-Shirt Status": s.shirtIssued ? "✅ ISSUED" : "❌ PENDING"
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `TShirt_${type}`);
        XLSX.writeFile(wb, `${captain.house}_TShirt_${type}_List.xlsx`);
    };

    const toggleShirtIssued = async (regNo) => {
        // Optimistic UI update
        const studentIndex = studentsDB.findIndex(s => s.regNo === regNo);
        if (studentIndex === -1) return;
        
        const currentStatus = studentsDB[studentIndex].shirtIssued;
        const newStatus = !currentStatus;

        const updated = [...studentsDB];
        updated[studentIndex] = { ...updated[studentIndex], shirtIssued: newStatus };
        
        // Update local state ONLY (do not trigger global sync)
        setStudentsDB(updated);

        // Send restricted atomic update to backend
        try {
            const res = await fetch(`${API_BASE}/api/captain-toggle-tshirt`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("captainToken")}`
                },
                body: JSON.stringify({ regNo, shirtIssued: newStatus })
            });
            const data = await res.json();
            if (!data.success) {
                console.error("Failed to sync t-shirt status:", data.error);
                // Revert on failure
                const revert = [...studentsDB];
                revert[studentIndex] = { ...revert[studentIndex], shirtIssued: currentStatus };
                setStudentsDB(revert);
                alert(`Failed to update status: ${data.error}`);
            }
        } catch (err) {
            console.error("Network error syncing t-shirt status:", err);
            // Revert on failure
            const revert = [...studentsDB];
            revert[studentIndex] = { ...revert[studentIndex], shirtIssued: currentStatus };
            setStudentsDB(revert);
            alert("Network error while syncing status.");
        }
    };

    const saveHouseName = async () => {
        if (!newName.trim() || newName.trim() === (captain.houseDisplayName || captain.house)) return;
        setUpdating(true);
        setError("");
        try {
            const res = await fetch(`${API_BASE}/api/captain-update-house-name`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("captainToken")}`
                },
                body: JSON.stringify({ houseId: captain.houseId, displayName: newName })
            });
            const data = await res.json();
            if (data.success) {
                setCaptain({ ...captain, houseDisplayName: data.displayName });
                alert("House name updated successfully!");
            } else {
                setError(data.error || "Failed to update name.");
            }
        } catch (err) {
            setError("Connection failed.");
        } finally {
            setUpdating(false);
        }
    };

    const cS = { background: dark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${dark ? "#333" : "#eee"}`, borderRadius: 14, padding: isMobile ? 16 : 28, boxShadow: "0 4px 24px rgba(0,0,0,.08)" };

    if (!captain) return (
        <div style={{ maxWidth: 440, margin: isMobile ? "24px auto" : "80px auto", padding: isMobile ? "16px 14px" : "40px 20px" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 52 }}>⚡</div>
                <h2 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", fontSize: isMobile ? 20 : 26, margin: "8px 0 6px" }}>Captain Portal</h2>
                <p style={{ color: dark ? "#aaa" : "#777", fontSize: 13, margin: 0 }}>House captains & vice captains — view your registered players</p>
            </div>
            <div style={cS}>
                <label style={{ display: "block", fontWeight: 600, color: dark ? "#ccc" : "#444", marginBottom: 8, fontSize: 14 }}>Your Email Address</label>
                <input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && login()}
                    placeholder="Enter your email"
                    style={{ width: "100%", padding: "13px 14px", borderRadius: 8, fontSize: 15, border: `1px solid ${dark ? "#444" : "#ddd"}`, background: dark ? "#2a2a3e" : "#f8f8f8", color: dark ? "#fff" : "#333", boxSizing: "border-box", marginBottom: 10 }}
                />
                <div style={{ position: "relative", marginBottom: 10 }}>
                    <input
                        type={showPwd ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && login()}
                        placeholder="Enter your password"
                        style={{ width: "100%", padding: "13px 42px 13px 14px", borderRadius: 8, fontSize: 15, border: `1px solid ${dark ? "#444" : "#ddd"}`, background: dark ? "#2a2a3e" : "#f8f8f8", color: dark ? "#fff" : "#333", boxSizing: "border-box" }}
                    />
                    <button onClick={() => setShowPwd(s => !s)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: dark ? "#aaa" : "#888", padding: 2 }}>{showPwd ? "🙈" : "👁"}</button>
                </div>
                {error && <div style={{ marginBottom: 10, color: "#c00", fontSize: 13 }}>⚠ {error}</div>}
                <button onClick={login} style={{ width: "100%", background: "linear-gradient(135deg,#8B0000,#C41E3A)", color: "#fff", border: "none", borderRadius: 8, padding: "14px 0", cursor: "pointer", fontWeight: 700, fontSize: 16 }}>
                    Login →
                </button>
                <div style={{ marginTop: 12, padding: "9px 12px", background: dark ? "rgba(255,200,0,.1)" : "#fffbea", border: "1px solid #FFD70066", borderRadius: 8, fontSize: 12, color: dark ? "#ffd700" : "#7a5800" }}>
                    💡 Your email must be added by the Admin under Houses → Captain card
                </div>
            </div>
        </div>
    );

    const tS = { flex: 1, padding: "12px 0", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 700, color: dark ? "#aaa" : "#666", transition: ".2s", borderBottom: "3px solid transparent" };
    const aTS = { ...tS, color: captain.houseColor, borderBottomColor: captain.houseColor };

    return (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "16px 12px" : "40px 20px" }}>
            {/* Header */}
            <div style={{ background: `linear-gradient(135deg,${captain.houseColor},${captain.houseColor}bb)`, borderRadius: 16, padding: isMobile ? "18px 16px" : "28px 32px", marginBottom: isMobile ? 18 : 24, color: "#fff", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", boxShadow: `0 8px 32px ${captain.houseColor}33` }}>
                <div style={{ width: isMobile ? 48 : 64, height: isMobile ? 48 : 64, borderRadius: "50%", background: "rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: isMobile ? 18 : 24, flexShrink: 0 }}>{hi(captain.house)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", opacity: .8 }}>{captain.role}</div>
                    <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 800 }}>{captain.name}</div>
                    <div style={{ fontSize: isMobile ? 12 : 14, opacity: .85 }}>{captain.houseDisplayName || captain.house} House</div>
                </div>
                <button onClick={() => { 
                    fetch("/api/logout", { method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("captainToken")}` } })
                    .finally(() => { localStorage.removeItem("captainToken"); setCaptain(null); setError(""); });
                }} style={{ background: "rgba(255,255,255,.2)", color: "#fff", border: "2px solid rgba(255,255,255,.4)", borderRadius: 50, padding: "8px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>Logout</button>
            </div>

            {/* Syncing Indicator */}
            <div style={{
                position: "fixed",
                top: 0,
                left: "50%",
                transform: `translateX(-50%) translateY(${isFetching ? "0" : "-100%"})`,
                background: "#1E90FF",
                color: "#fff",
                padding: "8px 20px",
                borderBottomLeftRadius: 12,
                borderBottomRightRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 4px 12px rgba(30,144,255,0.3)",
                transition: "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s",
                opacity: isFetching ? 1 : 0,
                pointerEvents: "none"
            }}>
                <div style={{ 
                    width: 14, height: 14, 
                    border: "2px solid rgba(255,255,255,0.3)", 
                    borderTopColor: "#fff", 
                    borderRadius: "50%", 
                    animation: "spin 1s linear infinite" 
                }} />
                <span style={{ letterSpacing: 0.5 }}>Syncing live data...</span>
                <style>{`
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                `}</style>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: "flex", borderBottom: `1px solid ${dark ? "#333" : "#eee"}`, gap: 10, overflowX: "auto", scrollbarWidth: "thin", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
                <button onClick={() => setActiveTab("Dashboard")} style={{ ...(activeTab === "Dashboard" ? aTS : tS), whiteSpace: "nowrap", flexShrink: 0 }}>📊 DASHBOARD</button>
                <button onClick={() => setActiveTab("Roster")} style={{ ...(activeTab === "Roster" ? aTS : tS), whiteSpace: "nowrap", flexShrink: 0 }}>🏠 HOUSE ROSTER</button>
                <button onClick={() => setActiveTab("Participation")} style={{ ...(activeTab === "Participation" ? aTS : tS), whiteSpace: "nowrap", flexShrink: 0 }}>⚽ PARTICIPATION</button>
                <button onClick={() => setActiveTab("T-Shirt Issue")} style={{ ...(activeTab === "T-Shirt Issue" ? aTS : tS), whiteSpace: "nowrap", flexShrink: 0 }}>👕 T-SHIRT ISSUE</button>
                <button onClick={() => setActiveTab("Staff")} style={{ ...(activeTab === "Staff" ? aTS : tS), whiteSpace: "nowrap", flexShrink: 0 }}>👨‍🏫 STAFF REGS</button>
                <button onClick={() => setActiveTab("Settings")} style={{ ...(activeTab === "Settings" ? aTS : tS), whiteSpace: "nowrap", flexShrink: 0 }}>⚙️ SETTINGS</button>
            </div>

            <div style={{ marginBottom: 24 }} />

            {activeTab === "Dashboard" && (
                <div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: isMobile ? 10 : 20, marginBottom: 28 }}>
                        {[
                            { label: `${captainIsMale ? "♂ Men's" : "♀ Women's"} House Strength`, value: houseStudents.length, emoji: captainIsMale ? "👨" : "👩", color: captain.houseColor },
                            { label: "Total Registrations", value: houseRegs.length, emoji: "📋", color: "#8B0000" },
                            { label: "Participation Rate", value: houseStudents.length ? Math.round((houseRegs.length / houseStudents.length) * 100) + "%" : "0%", emoji: "📈", color: "#2E8B57" },
                        ].map(s => (
                            <div key={s.label} style={{ background: dark ? "rgba(255,255,255,.05)" : "#fff", border: `1px solid ${dark ? "#333" : "#eee"}`, borderRadius: 16, padding: isMobile ? "16px 14px" : "24px 20px", textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,.03)" }}>
                                <div style={{ fontSize: 32, marginBottom: 8 }}>{s.emoji}</div>
                                <div style={{ fontSize: 30, fontWeight: 900, color: s.color, fontFamily: "'Georgia',serif" }}>{s.value}</div>
                                <div style={{ fontSize: 12, color: dark ? "#aaa" : "#888", fontWeight: 600, marginTop: 4 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
                        <div style={cS}>
                            <h4 style={{ margin: "0 0 16px", fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 20 }}>🎮</span> Game Breakdown</h4>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {(() => {
                                    const gamesFound = houseRegs.filter(r => r.game && !["None", "—"].includes(r.game)).flatMap(r => r.game.split(", "));
                                    const uniqueGames = Array.from(new Set(gamesFound)).sort();
                                    return uniqueGames.length === 0 ? <div style={{ fontSize: 12, color: "#888", fontStyle: "italic" }}>No games registered</div> : uniqueGames.map(g => (
                                        <div key={g} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                                            <span style={{ fontWeight: 600, color: dark ? "#ccc" : "#444" }}>{g}</span>
                                            <span style={{ fontWeight: 800, color: "#8B0000" }}>{gamesFound.filter(x => x === g).length}</span>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                        <div style={cS}>
                            <h4 style={{ margin: "0 0 16px", fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 20 }}>🏃</span> Athletics Breakdown</h4>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {(() => {
                                    const athFound = houseRegs.filter(r => r.athletic && !["None", "—"].includes(r.athletic)).flatMap(r => r.athletic.split(", "));
                                    const uniqueAth = Array.from(new Set(athFound)).sort();
                                    return uniqueAth.length === 0 ? <div style={{ fontSize: 12, color: "#888", fontStyle: "italic" }}>No athletics registered</div> : uniqueAth.map(a => (
                                        <div key={a} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                                            <span style={{ fontWeight: 600, color: dark ? "#ccc" : "#444" }}>{a}</span>
                                            <span style={{ fontWeight: 800, color: "#4B0082" }}>{athFound.filter(x => x === a).length}</span>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "Roster" && (
                <div>
                    <h3 style={{ color: dark ? "#fff" : "#222", marginBottom: 16, fontSize: 18, fontWeight: 800 }}>🏠 {captain.house} House — {captainIsMale ? "♂ Men's" : "♀ Women's"} Roster ({houseStudents.length})</h3>
                    {houseStudents.length === 0 ? (
                        <div style={{ ...cS, textAlign: "center", padding: 60 }}>
                            <div style={{ fontSize: 60, marginBottom: 15 }}>📂</div>
                            <div style={{ fontWeight: 700, fontSize: 18, color: dark ? "#aaa" : "#666" }}>No students imported yet</div>
                            <div style={{ fontSize: 14, color: dark ? "#666" : "#888", marginTop: 8 }}>Admin needs to upload the student CSV/Excel file.</div>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                            {houseStudents.map((s, idx) => {
                                const reg = houseRegs.find(r => r.regNo === s.regNo);
                                return (
                                    <div key={s.regNo || s.email} style={{ background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `1px solid ${dark ? "#333" : "#eee"}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: reg ? "#2E8B57" : (dark ? "#333" : "#f0f0f0"), color: reg ? "#fff" : (dark ? "#666" : "#888"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                                            {reg ? "✓" : idx + 1}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, color: dark ? "#fff" : "#1a1a1a", fontSize: 14 }}>{s.name}</div>
                                            <div style={{ fontSize: 11, color: dark ? "#888" : "#777", marginTop: 2 }}>{s.gender || "?"} · {s.regNo} · {s.year || "N/A"} {s.dept ? `(${s.dept})` : ""} · Size: {s.shirtSize || "—"}</div>
                                        </div>
                                        <div style={{ textAlign: "right", marginRight: 8 }}>
                                            <div style={{ fontSize: 10, fontWeight: 800, color: dark ? "#ccc" : "#444" }}>SHIRT: {s.shirtSize || "—"}</div>
                                            <div style={{ fontSize: 9, color: s.shirtIssued ? "#2E8B57" : "#c00", fontWeight: 700 }}>{s.shirtIssued ? "ISSUED ✅" : "PENDING ❌"}</div>
                                        </div>
                                        {reg ? (
                                            <span style={{ fontSize: 10, fontWeight: 750, color: "#2E8B57", background: "#2E8B5718", padding: "4px 10px", borderRadius: 50, letterSpacing: .5 }}>REGISTERED</span>
                                        ) : (
                                            <span style={{ fontSize: 10, fontWeight: 700, color: dark ? "#555" : "#ccc", padding: "4px 10px", borderRadius: 50, border: `1px solid ${dark ? "#444" : "#eee"}` }}>PENDING</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeTab === "Participation" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
                        <h3 style={{ color: dark ? "#fff" : "#222", margin: 0, fontSize: 18, fontWeight: 800 }}>🏅 {captainIsMale ? "♂ Men's" : "♀ Women's"} Participation ({filteredHouseRegs.length})</h3>
                        <div style={{ display: "flex", gap: 8 }}>
                            <select value={filterType} onChange={e => { setFilterType(e.target.value); setFilterVal("All"); }} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${dark ? "#444" : "#ddd"}`, background: dark ? "#222" : "#fff", color: dark ? "#fff" : "#333", fontSize: 13, fontWeight: 600 }}>
                                <option value="All">All Types</option>
                                <option value="Game">Games</option>
                                <option value="Athletic">Athletics</option>
                            </select>
                            {filterType !== "All" && (
                                <select value={filterVal} onChange={e => setFilterVal(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${dark ? "#444" : "#ddd"}`, background: dark ? "#222" : "#fff", color: dark ? "#fff" : "#333", fontSize: 13, fontWeight: 600 }}>
                                    <option value="All">All Events</option>
                                    {filterType === "Game" ? (
                                        Array.from(new Set(houseRegs.filter(r => r.game).flatMap(r => r.game.split(", ").filter(x => x && x !== "None" && x !== "—")))).sort().map(g => <option key={g} value={g}>{g}</option>)
                                    ) : (
                                        Array.from(new Set(houseRegs.filter(r => r.athletic).flatMap(r => r.athletic.split(", ").filter(x => x && x !== "None" && x !== "—")))).sort().map(a => <option key={a} value={a}>{a}</option>)
                                    )}
                                </select>
                            )}
                            <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={exportFilteredToExcel} disabled={filteredHouseRegs.length === 0} style={{ background: "linear-gradient(135deg,#1E90FF,#4169E1)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13, opacity: filteredHouseRegs.length === 0 ? .5 : 1 }}>📥 Export Filtered</button>
                                <button onClick={exportToExcel} disabled={houseStudents.length === 0} style={{ background: "linear-gradient(135deg,#2E8B57,#3CB371)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13, opacity: houseStudents.length === 0 ? .5 : 1 }}>📥 Full Roster</button>
                            </div>
                        </div>
                    </div>
                    {houseRegs.length === 0 ? (
                        <div style={{ ...cS, textAlign: "center", padding: 60 }}>
                            <div style={{ fontSize: 60, marginBottom: 15 }}>🏟️</div>
                            <div style={{ fontWeight: 700, fontSize: 18, color: dark ? "#aaa" : "#666" }}>No registrations yet</div>
                            <div style={{ fontSize: 14, color: dark ? "#666" : "#888", marginTop: 8 }}>Students will appear here once they complete registration.</div>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                            {filteredHouseRegs.map((r, idx) => (
                                <div key={r.regNo || r.email} style={{ background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `1px solid ${dark ? "#333" : "#eee"}`, borderLeft: `5px solid ${captain.houseColor}`, borderRadius: 14, padding: "16px 20px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: 16, color: dark ? "#fff" : "#1a1a1a" }}>{r.name}</div>
                                            <div style={{ fontSize: 12, color: dark ? "#888" : "#666", marginTop: 2 }}>{r.regNo} · Year: {houseStudents.find(s => s.regNo === r.regNo)?.year || "N/A"}</div>
                                        </div>
                                        <div style={{ fontSize: 10, color: dark ? "#555" : "#bbb", fontWeight: 600 }}>{r.registeredAt}</div>
                                    </div>
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        {r.game && r.game.split(", ").filter(x => x && x !== "None" && x !== "—").map(g => (
                                            <div key={g} style={{ background: "#8B000012", border: "1.5px solid #8B000025", padding: "6px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 6 }}>
                                                <span style={{ fontSize: 16 }}>⚽</span>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: "#8B0000" }}>{g}</span>
                                            </div>
                                        ))}
                                        {r.athletic && r.athletic.split(", ").filter(x => x && x !== "None" && x !== "—").map(a => (
                                            <div key={a} style={{ background: "#4B008212", border: "1.5px solid #4B008225", padding: "6px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 6 }}>
                                                <span style={{ fontSize: 16 }}>🏃</span>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: "#4B0082" }}>{a}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === "T-Shirt Issue" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                        <h3 style={{ color: dark ? "#fff" : "#222", margin: 0, fontSize: 18, fontWeight: 800 }}>👕 T-Shirt Distribution Management</h3>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => exportShirtList("Pending")} style={{ background: "#8B0000", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>📥 Pending List</button>
                            <button onClick={() => exportShirtList("Issued")} style={{ background: "#2E8B57", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>📥 Issued List</button>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, marginBottom: 20, borderBottom: `1px solid ${dark ? "#333" : "#eee"}` }}>
                        {["Pending", "Issued"].map(t => (
                            <button key={t} onClick={() => setShirtIssueTab(t)} style={{ padding: "10px 20px", border: "none", background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 700, color: shirtIssueTab === t ? captain.houseColor : (dark ? "#666" : "#aaa"), borderBottom: `3px solid ${shirtIssueTab === t ? captain.houseColor : "transparent"}`, transition: ".2s" }}>
                                {t} ({houseStudents.filter(s => t === "Pending" ? !s.shirtIssued : s.shirtIssued).length})
                            </button>
                        ))}
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                        {houseStudents
                            .filter(s => shirtIssueTab === "Pending" ? !s.shirtIssued : s.shirtIssued)
                            .map((s, idx) => (
                                <div key={s.regNo} style={{ background: dark ? "rgba(255,255,255,.03)" : "#fff", border: `1px solid ${dark ? "#333" : "#eee"}`, borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: dark ? "#1a1a1a" : "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: dark ? "#555" : "#ccc", fontSize: 12 }}>{s.sno || idx + 1}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 750, color: dark ? "#fff" : "#1a1a1a", fontSize: 15 }}>{s.name}</div>
                                        <div style={{ fontSize: 12, color: dark ? "#aaa" : "#666", marginTop: 2 }}>
                                            <span style={{ fontWeight: 700, color: captain.houseColor }}>{s.shirtSize}</span> · {s.gender} · {s.year} {s.dept ? `(${s.dept})` : ""} · {s.regNo}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => toggleShirtIssued(s.regNo)}
                                        style={{ background: s.shirtIssued ? "rgba(46,139,87,.1)" : captain.houseColor, color: s.shirtIssued ? "#2E8B57" : "#fff", border: s.shirtIssued ? "1px solid #2E8B57" : "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontWeight: 800, fontSize: 13, transition: ".2s" }}
                                    >
                                        {s.shirtIssued ? "Mark Pending" : "Give Shirt 👕"}
                                    </button>
                                </div>
                            ))}
                        {houseStudents.filter(s => shirtIssueTab === "Pending" ? !s.shirtIssued : s.shirtIssued).length === 0 && (
                            <div style={{ textAlign: "center", padding: 40, color: dark ? "#444" : "#ccc", fontSize: 14, fontStyle: "italic" }}>
                                No students in this list
                            </div>
                        )}
                    </div>
                </div>
            )}
            {activeTab === "Staff" && (
                <div>
                    <h3 style={{ color: dark ? "#fff" : "#222", marginBottom: 16, fontSize: 18, fontWeight: 800 }}>👨‍🏫 Staff Registrations ({staffRegs.length})</h3>
                    {staffRegs.length === 0 ? (
                        <div style={{ ...cS, textAlign: "center", padding: 60 }}>
                            <div style={{ fontSize: 60, marginBottom: 15 }}>👨‍🏫</div>
                            <div style={{ fontWeight: 700, fontSize: 18, color: dark ? "#aaa" : "#666" }}>No staff have registered yet</div>
                            <div style={{ fontSize: 14, color: dark ? "#666" : "#888", marginTop: 8 }}>Staff registrations for all events will appear here.</div>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                            {staffRegs.map((r, idx) => (
                                <div key={r.regNo || r.email} style={{ background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `1px solid ${dark ? "#333" : "#eee"}`, borderLeft: `5px solid #8B0000`, borderRadius: 14, padding: "16px 20px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: 16, color: dark ? "#fff" : "#1a1a1a" }}>{r.name}</div>
                                            <div style={{ fontSize: 12, color: dark ? "#888" : "#666", marginTop: 2 }}>{r.gender || "?"} · {r.regNo} · Dept: {studentsDB.find(s => s.regNo === r.regNo)?.dept || "N/A"}</div>
                                        </div>
                                        <div style={{ fontSize: 10, color: dark ? "#555" : "#bbb", fontWeight: 600 }}>{r.registeredAt}</div>
                                    </div>
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        {r.game && r.game.split(", ").filter(x => x && x !== "None" && x !== "—").map(g => (
                                            <div key={g} style={{ background: "#8B000012", border: "1.5px solid #8B000025", padding: "6px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 6 }}>
                                                <span style={{ fontSize: 16 }}>⚽</span>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: "#8B0000" }}>{g}</span>
                                            </div>
                                        ))}
                                        {r.athletic && r.athletic.split(", ").filter(x => x && x !== "None" && x !== "—").map(a => (
                                            <div key={a} style={{ background: "#4B008212", border: "1.5px solid #4B008225", padding: "6px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 6 }}>
                                                <span style={{ fontSize: 16 }}>🏃</span>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: "#4B0082" }}>{a}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {activeTab === "Settings" && (
                <div style={cS}>
                    <h3 style={{ margin: "0 0 8px", fontSize: 18, color: dark ? "#fff" : "#222" }}>⚙️ House Settings</h3>
                    <p style={{ fontSize: 13, color: dark ? "#aaa" : "#666", marginBottom: 20 }}>Customize how your house appears across the platform.</p>
                    
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: dark ? "#ccc" : "#444", marginBottom: 8 }}>House Display Name</label>
                        <div style={{ display: "flex", gap: 10 }}>
                            <input 
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="e.g. Red Dragons"
                                style={{ flex: 1, padding: "12px 14px", borderRadius: 8, fontSize: 15, border: `1px solid ${dark ? "#444" : "#ddd"}`, background: dark ? "#1a1a2e" : "#f8f8f8", color: dark ? "#fff" : "#333" }}
                            />
                            <button 
                                onClick={saveHouseName}
                                disabled={updating || !newName.trim() || newName.trim() === (captain.houseDisplayName || captain.house)}
                                style={{ background: captain.houseColor, color: "#fff", border: "none", borderRadius: 8, padding: "0 24px", cursor: "pointer", fontWeight: 700, fontSize: 14, opacity: (updating || !newName.trim() || newName.trim() === (captain.houseDisplayName || captain.house)) ? 0.5 : 1 }}
                            >
                                {updating ? "Saving..." : "Save Name"}
                            </button>
                        </div>
                        <div style={{ fontSize: 11, color: dark ? "#666" : "#888", marginTop: 8 }}>
                            💡 This will change your house name in standings, cards, and reports. The internal category (<strong>{captain.house}</strong>) will remain unchanged for admin records.
                        </div>
                    </div>

                    {error && <div style={{ color: "#c00", fontSize: 13, marginTop: 10 }}>⚠️ {error}</div>}
                </div>
            )}
        </div>
    );
}
