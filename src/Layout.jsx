import { useState } from "react";
import { useIsMobile } from "./utils.jsx";
export function Header({ active, setActive, dark, setDark, nav = [], games = [] }) {
    const [menu, setMenu] = useState(false);
    const isMobile = useIsMobile();
    const navIcons = { Home: "🏠", Events: "📅", Registration: "📝", Scoreboard: "🏆", Gallery: "🎨", Captain: "⚡", Admin: "⚙", Winners: "🥇", "Star Players": "🌟" };
    const liveEvents = games.filter(g => g.status === "Live");

    return (
        <header style={{ background: dark ? "rgba(10,10,20,.97)" : "rgba(255,255,255,.97)", borderBottom: "3px solid #8B0000", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)", boxShadow: "0 4px 24px rgba(0,0,0,.12)" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 14px", display: "flex", alignItems: "center", gap: 10, minHeight: isMobile ? 80 : 100 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: isMobile ? 60 : 90, height: isMobile ? 60 : 90, flexShrink: 0, padding: 4, background: "#fff", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 14px rgba(0,0,0,.12)" }}>
                        <img src="/logo.png" alt="College Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: "'Georgia',serif", fontWeight: 800, fontSize: isMobile ? 12 : 18, color: dark ? "#fff" : "#8B0000", lineHeight: 1.2 }}>ACHARIYA COLLEGE OF ENGINEERING TECHNOLOGY</div>
                        <div style={{ fontSize: isMobile ? 8 : 10, color: dark ? "#ccc" : "#444", fontWeight: 600, marginTop: 2 }}>(Approved by AICTE, New Delhi & Affiliated to Pondicherry University)</div>
                        <div style={{ fontSize: isMobile ? 9 : 11, color: dark ? "#bbb" : "#666", letterSpacing: 0.5 }}>Achariyapuram, Villianur, Puducherry - 605 110.</div>
                    </div>
                </div>
                {!isMobile && (
                    <nav style={{ display: "flex", gap: 4 }}>
                        {nav.map(n => (
                            <button key={n} onClick={() => setActive(n)} style={{ background: active === n ? "#8B0000" : "transparent", color: active === n ? "#fff" : dark ? "#ccc" : "#444", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all .2s" }}>{n}</button>
                        ))}
                    </nav>
                )}
                <button onClick={() => setDark(d => !d)} style={{ background: dark ? "#333" : "#f0f0f0", border: "none", borderRadius: 8, padding: isMobile ? "6px 9px" : "8px 12px", cursor: "pointer", fontSize: isMobile ? 15 : 18, flexShrink: 0 }}>{dark ? "☀️" : "🌙"}</button>
                {isMobile && (
                    <button onClick={() => setMenu(m => !m)} style={{ background: menu ? "#8B0000" : "transparent", border: `1.5px solid ${menu ? "#8B0000" : dark ? "#444" : "#ccc"}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 17, color: menu ? "#fff" : dark ? "#fff" : "#333", flexShrink: 0, transition: "all .2s" }}>☰</button>
                )}
            </div>
            {isMobile && menu && (
                <div style={{ background: dark ? "#111" : "#fff", borderTop: `1px solid ${dark ? "#222" : "#eee"}`, padding: "6px 8px 10px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
                        {nav.map(n => (
                            <button key={n} onClick={() => { setActive(n); setMenu(false); }} style={{ background: active === n ? "#8B0000" : dark ? "rgba(255,255,255,.06)" : "#f8f8f8", color: active === n ? "#fff" : dark ? "#ccc" : "#333", border: `1px solid ${active === n ? "#8B0000" : dark ? "#2a2a2a" : "#e5e5e5"}`, borderRadius: 10, padding: "10px 6px", textAlign: "center", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                                <span style={{ fontSize: 18 }}>{navIcons[n]}</span>
                                <span style={{ fontSize: 11 }}>{n}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <div style={{ background: dark ? "#1a1a2e" : "#8B0000", color: "#fff", textAlign: "center", padding: isMobile ? "6px 0" : "8px 0", fontSize: isMobile ? 12 : 15, fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1.5px", boxShadow: "inset 0 4px 10px rgba(0,0,0,0.2)" }}>
                Department of Physical Education
            </div>
            {liveEvents.length > 0 && (
                <div style={{ background: dark ? "#111" : "#fff", borderTop: `1px solid ${dark ? "#222" : "#eee"}`, height: 32, display: "flex", alignItems: "center", overflow: "hidden", position: "relative" }}>
                    <div style={{ background: "#c00", color: "#fff", padding: "0 12px", height: "100%", display: "flex", alignItems: "center", fontSize: 11, fontWeight: 900, zIndex: 2, boxShadow: "4px 0 10px rgba(0,0,0,.1)" }}>LIVE 🔴</div>
                    <div style={{ whiteSpace: "nowrap", flex: 1, overflow: "hidden" }}>
                        <div style={{ display: "inline-block", paddingLeft: "100%", animation: "marquee 25s linear infinite" }}>
                            {liveEvents.map((g, i) => (
                                <span key={i} style={{ color: dark ? "#fff" : "#222", fontSize: 13, fontWeight: 600, marginRight: 60 }}>
                                    ✨ <span style={{ color: "#8B0000" }}>{g.name}</span> @ {g.venue} <span style={{ opacity: .6, fontWeight: 400 }}>({g.start} - {g.end})</span> — Participants: {g.participants}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

export function Footer({ dark, nav = [], houses = [] }) {
    const isMobile = useIsMobile();
    return (
        <footer style={{ marginTop: isMobile ? 36 : 80, background: dark ? "#0a0010" : "#8B0000", color: "#fff", padding: isMobile ? "24px 14px" : "40px 20px" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(200px,1fr))", gap: isMobile ? 18 : 32 }}>
                <div style={{ gridColumn: isMobile ? "1/-1" : "auto" }}>
                    <div style={{ marginBottom: 10 }}>
                        <div style={{ width: 56, height: 56, padding: 4, background: "#fff", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,.2)" }}>
                            <img src="/logo.png" alt="College Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                        </div>
                    </div>
                    <div style={{ fontFamily: "'Georgia',serif", fontWeight: 700, fontSize: 13, marginBottom: 3 }}>Achariya College of Engineering Technology</div>
                    <div style={{ opacity: .7, fontSize: 11 }}>Villianur, Puducherry - 605 110</div>
                </div>
                <div>
                    <div style={{ fontWeight: 700, marginBottom: 7, opacity: .9, fontSize: 13 }}>Quick Links</div>
                    {nav.map(n => <div key={n} style={{ opacity: .7, fontSize: 12, marginBottom: 3 }}>{n}</div>)}
                </div>
                <div>
                    <div style={{ fontWeight: 700, marginBottom: 7, opacity: .9, fontSize: 13 }}>Contact</div>
                    <div style={{ opacity: .7, fontSize: 12 }}>📞 0413-2677700</div>
                    <div style={{ opacity: .7, fontSize: 12, marginTop: 2 }}>✉ sports@achariya.edu</div>
                    <div style={{ opacity: .7, fontSize: 12, marginTop: 2 }}>🌐 www.achariya.edu</div>
                </div>
                <div>
                    <div style={{ fontWeight: 700, marginBottom: 7, opacity: .9, fontSize: 13 }}>Houses</div>
                    {houses.map((h, i) => (
                        <div key={h.id || h.name || i} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: h.color, flexShrink: 0 }} />
                            <span style={{ opacity: .8, fontSize: 12 }}>{h.name}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div style={{ borderTop: `1px solid ${dark ? "#222" : "#a00"}`, marginTop: isMobile ? 24 : 40, paddingTop: isMobile ? 16 : 24, textAlign: "center", opacity: .6, fontSize: 11 }}>
                © {new Date().getFullYear()} Achariya College of Engineering Technology. Sports Day ERP System.
            </div>
        </footer>
    );
}
