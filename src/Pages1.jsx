import { useState } from "react";
import { useIsMobile, hi, tint, Count, Confetti, Avatar, Sheet } from "./utils.jsx";

export function HomePage({ dark, houses, authorities, management = [], studentCommittee = [], games, gallery, eventDate, memorial }) {
    const [confetti, setConfetti] = useState(false);
    const isMobile = useIsMobile();
    const sortedH = [...houses].sort((a, b) => b.points - a.points);
    const isInitial = sortedH.every(h => h.points === 0);
    const live = games.find(g => g.status === "Live");
    const next = games.find(g => g.status === "Upcoming");
    const p = isMobile ? "20px 12px" : "40px 20px";

    return (
        <div>
            <div style={{ background: dark ? "linear-gradient(135deg,#1a0010,#0a0520,#001a0a)" : "linear-gradient(135deg,#8B0000,#C41E3A 40%,#4B0082)", padding: isMobile ? "44px 16px" : "80px 20px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, opacity: .08, backgroundImage: "radial-gradient(circle at 20% 50%,white 1px,transparent 1px),radial-gradient(circle at 80% 20%,white 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
                <SportsAnimations isMobile={isMobile} />
                <div style={{ position: "relative", maxWidth: 800, margin: "0 auto" }}>
                    <div style={{ fontSize: isMobile ? 40 : 56, marginBottom: 12, filter: "drop-shadow(0 4px 16px rgba(0,0,0,.5))" }}>🏆</div>
                    <h1 style={{ fontFamily: "'Georgia',serif", fontSize: isMobile ? "clamp(22px,6vw,36px)" : "clamp(28px,5vw,52px)", color: "#fff", margin: "0 0 10px", textShadow: "0 4px 24px rgba(0,0,0,.5)" }}>Sports Day {eventDate?.date ? new Date(eventDate.date).getFullYear() : ""}</h1>
                    <p style={{ color: "rgba(255,255,255,.8)", fontSize: isMobile ? 13 : 18, margin: "0 0 20px" }}>Achariya College of Engineering Technology, Puducherry</p>

                    {eventDate?.date && (
                        <div style={{ background: "rgba(255,255,255,.1)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 16, padding: isMobile ? "12px 20px" : "16px 32px", display: "inline-block", marginBottom: 24, boxShadow: "0 8px 32px rgba(0,0,0,.2)" }}>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,.7)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>Official Date</div>
                            <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 800, color: "#FFD700", textShadow: "0 2px 10px rgba(255,215,0,.3)" }}>
                                📅 {new Date(eventDate.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                            {eventDate.time && (
                                <div style={{ fontSize: isMobile ? 14 : 18, color: "#fff", marginTop: 4, fontWeight: 600 }}>
                                    ⏰ {eventDate.time}
                                </div>
                            )}
                        </div>
                    )}
                    <br />
                    <button onClick={() => { setConfetti(true); setTimeout(() => setConfetti(false), 4000); }} style={{ background: "#FFD700", color: "#000", border: "none", borderRadius: 50, padding: isMobile ? "11px 24px" : "14px 40px", fontSize: isMobile ? 14 : 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 32px rgba(255,215,0,.4)" }}>🎉 Celebrate!</button>
                </div>
            </div>
            <Confetti show={confetti} />
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: p }}>
                {live && (
                    <div style={{ background: dark ? "rgba(255,60,0,.15)" : "#fff1ee", border: "2px solid #FF4500", borderRadius: 14, padding: isMobile ? 14 : 24, marginBottom: isMobile ? 18 : 32, display: "flex", alignItems: "center", gap: isMobile ? 12 : 20, flexWrap: "wrap", animation: "pulse 2s infinite" }}>
                        <div style={{ fontSize: isMobile ? 26 : 40 }}>🔴</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#FF4500", letterSpacing: 2, textTransform: "uppercase" }}>NOW PLAYING</div>
                            <div style={{ fontSize: isMobile ? 17 : 24, fontWeight: 800, color: dark ? "#fff" : "#222", marginTop: 2 }}>{live.name}</div>
                            <div style={{ fontSize: 12, color: dark ? "#aaa" : "#666" }}>📍 {live.venue} · {live.participants}</div>
                            {live.delay && <div style={{ marginTop: 8 }}><span style={{ background: "#FF000022", color: "#FF4500", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, border: "1px solid #FF450033" }}>⚠️ {live.delay}</span></div>}
                        </div>
                        {next && (
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: 10, color: dark ? "#aaa" : "#666" }}>Next Up</div>
                                <div style={{ fontWeight: 700, color: dark ? "#ccc" : "#333", fontSize: isMobile ? 13 : 15 }}>{next.name}</div>
                                <div style={{ fontSize: 12, color: "#1E90FF" }}>⏰ {next.start} {next.delay && <span style={{ color: "#FF4500", fontSize: 10 }}>(+{next.delay})</span>}</div>
                            </div>
                        )}
                    </div>
                )}
                <h2 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", marginBottom: 14, fontSize: isMobile ? 19 : 24 }}>🏠 House Standings</h2>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(220px,1fr))", gap: isMobile ? 10 : 16, marginBottom: isMobile ? 28 : 48 }}>
                    {sortedH.map((h, i) => (
                        <div key={h.id || h.name || i} style={{
                            background: dark ? "rgba(255,255,255,.05)" : "#fff",
                            border: `2px solid ${i === 0 ? h.color : h.color + "44"}`,
                            borderRadius: 16,
                            padding: isMobile ? 12 : 20,
                            position: "relative",
                            overflow: "hidden",
                            boxShadow: i === 0 ? `0 12px 40px ${h.color}44` : "0 4px 12px rgba(0,0,0,.05)",
                            transition: "transform .3s ease"
                        }}>
                            {i === 0 && !isInitial && <div style={{ position: "absolute", top: 8, right: 10, fontSize: isMobile ? 18 : 26 }}>🏆</div>}
                            <div style={{ width: isMobile ? 32 : 48, height: isMobile ? 32 : 48, borderRadius: "50%", background: h.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: isMobile ? 13 : 19, marginBottom: 8, boxShadow: `0 4px 12px ${h.color}44` }}>{hi(h.name)}</div>
                            <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 18, color: h.color, letterSpacing: 0.5 }}>{h.name}</div>
                            <div style={{ fontSize: isMobile ? 28 : 40, fontWeight: 900, color: dark ? "#fff" : "#1a1a1a", fontFamily: "'Georgia',serif", margin: "2px 0" }}><Count v={h.points} /></div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: dark ? "#aaa" : "#888", marginBottom: 10, letterSpacing: 1 }}>POINTS</div>
                            <div style={{ height: 6, background: dark ? "#333" : "#f0f0f0", borderRadius: 10, overflow: "hidden" }}>
                                <div style={{ height: "100%", background: h.color, borderRadius: 10, width: `${(h.points / (sortedH[0].points || 1)) * 100}%`, transition: "width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
                            </div>
                            <div style={{ position: "absolute", top: 8, left: 10, width: 22, height: 22, background: isInitial ? "#ccc" : h.color, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 11, boxShadow: "0 2px 8px rgba(0,0,0,.1)" }}>#{isInitial ? 0 : (i + 1)}</div>
                        </div>
                    ))}
                </div>
                {(() => {
                    const sortedMan = [...management].sort((a, b) => a.priority - b.priority);
                    const topMan = sortedMan.filter(a => a.priority <= 2);
                    const otherMan = sortedMan.filter(a => a.priority > 2);
                    const sortedAuth = [...authorities].sort((a, b) => a.priority - b.priority);

                    const AuthorityBlock = ({ title, items, isTop = false }) => {
                        if (items.length === 0) return null;
                        const isOdd = items.length % 2 !== 0;
                        return (
                            <>
                                <h2 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", marginBottom: 14, fontSize: isMobile ? 19 : 24 }}>{title}</h2>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: isMobile ? 12 : 20, marginBottom: isMobile ? 28 : 48 }}>
                                    {items.map((a, i) => {
                                        const isLast = i === items.length - 1;
                                        return (
                                            <div key={a.id || a.name || i} style={{
                                                background: dark ? "rgba(255,255,255,.05)" : "#fff",
                                                border: `1px solid ${isTop && i === 0 ? "#8B000055" : dark ? "#333" : "#eee"}`,
                                                borderTop: `3px solid ${isTop && i === 0 ? "#8B0000" : "#ccc"}`,
                                                borderRadius: 16,
                                                padding: isMobile ? "18px 12px" : "28px 20px",
                                                textAlign: "center",
                                                boxShadow: isTop && i === 0 ? "0 8px 32px rgba(139,0,0,.15)" : "0 2px 12px rgba(0,0,0,.06)",
                                                gridColumn: isOdd && isLast ? "1 / -1" : undefined,
                                                maxWidth: isOdd && isLast ? (isMobile ? "60%" : "45%") : undefined,
                                                margin: isOdd && isLast ? "0 auto" : undefined,
                                                width: isOdd && isLast ? "100%" : undefined,
                                            }}>
                                                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                                                    <Avatar img={a.img} name={a.name} size={isMobile ? 72 : 96} color={isTop && i === 0 ? "#8B0000" : "#555"} />
                                                </div>
                                                <div style={{ fontSize: isMobile ? 15 : 19, fontWeight: 800, color: dark ? "#fff" : "#1a1a1a", marginBottom: 4 }}>{a.name}</div>
                                                <div style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, letterSpacing: 1.3, color: "#8B0000", textTransform: "uppercase", marginBottom: 3 }}>{a.role}</div>
                                                <div style={{ fontSize: isMobile ? 11 : 12, color: dark ? "#aaa" : "#777" }}>{a.designation}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        );
                    };

                    return (
                        <>
                            <AuthorityBlock title="🏛️ Management Authority" items={topMan} isTop={true} />
                            <AuthorityBlock title="🎖️ Sports Authority" items={sortedAuth} isTop={true} />
                            <AuthorityBlock title="👥 Academic Staff" items={otherMan} />
                        </>
                    );
                })()}
                {
                    studentCommittee.length > 0 && (
                        <>
                            <h2 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", marginBottom: 14, fontSize: isMobile ? 19 : 24 }}>🤝 Student Committee</h2>
                            {(() => {
                                const sorted = [...studentCommittee].sort((a, b) => a.priority - b.priority);
                                const isOdd = sorted.length % 2 !== 0;
                                return (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: isMobile ? 12 : 20, marginBottom: isMobile ? 28 : 48 }}>
                                        {sorted.map((a, i) => {
                                            const isLast = i === sorted.length - 1;
                                            return (
                                                <div key={a.id || a.name || i} style={{
                                                    background: dark ? "rgba(255,255,255,.05)" : "#fff",
                                                    border: `1px solid ${i === 0 ? "#483D8B55" : dark ? "#333" : "#eee"}`,
                                                    borderTop: `3px solid ${i === 0 ? "#483D8B" : "#ccc"}`,
                                                    borderRadius: 16,
                                                    padding: isMobile ? "18px 12px" : "28px 20px",
                                                    textAlign: "center",
                                                    boxShadow: i === 0 ? "0 8px 32px rgba(72,61,139,.15)" : "0 2px 12px rgba(0,0,0,.06)",
                                                    gridColumn: isOdd && isLast ? "1 / -1" : undefined,
                                                    maxWidth: isOdd && isLast ? (isMobile ? "60%" : "45%") : undefined,
                                                    margin: isOdd && isLast ? "0 auto" : undefined,
                                                    width: isOdd && isLast ? "100%" : undefined,
                                                }}>
                                                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                                                        <Avatar img={a.img} name={a.name} size={isMobile ? 72 : 96} color={i === 0 ? "#483D8B" : "#555"} />
                                                    </div>
                                                    <div style={{ fontSize: isMobile ? 15 : 19, fontWeight: 800, color: dark ? "#fff" : "#1a1a1a", marginBottom: 4 }}>{a.name}</div>
                                                    <div style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, letterSpacing: 1.3, color: "#483D8B", textTransform: "uppercase", marginBottom: 3 }}>{a.role}</div>
                                                    <div style={{ fontSize: isMobile ? 11 : 12, color: dark ? "#aaa" : "#777" }}>{a.designation}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </>
                    )
                }
                <h2 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", marginBottom: 14, fontSize: isMobile ? 19 : 24 }}>⚡ House Captains</h2>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: isMobile ? 14 : 20, marginBottom: isMobile ? 28 : 48 }}>
                    {houses.map((h, idx) => (
                        <div key={h.id || h.name || idx} style={{ background: dark ? "rgba(255,255,255,.05)" : tint(h.color), border: `2px solid ${h.color}`, borderRadius: 16, padding: isMobile ? "14px 10px" : "24px 20px" }}>
                            {/* House header */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isMobile ? 12 : 18 }}>
                                <div style={{ width: 30, height: 30, borderRadius: "50%", background: h.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 12, flexShrink: 0 }}>{hi(h.name)}</div>
                                <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 17, color: h.color }}>{h.name} House</div>
                            </div>
                            {/* Staff Captain info */}
                            {(h.staffCaptainMale?.name || h.staffCaptainFemale?.name) && (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: isMobile ? 10 : 12, marginBottom: isMobile ? 12 : 14 }}>
                                    {[
                                        { l: "🎓 Staff Captain (M)", p: h.staffCaptainMale, emoji: "♂️" },
                                        { l: "🎓 Staff Captain (F)", p: h.staffCaptainFemale, emoji: "♀️" }
                                    ].map((c, i) => (
                                        c.p?.name ? (
                                            <div key={i} style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.75)", borderRadius: 12, padding: isMobile ? "12px 10px" : "16px 10px", textAlign: "center" }}>
                                                <div style={{ fontSize: isMobile ? 9 : 9, fontWeight: 700, color: h.color, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: isMobile ? 8 : 8 }}>{c.l}</div>
                                                <div style={{ display: "flex", justifyContent: "center", marginBottom: isMobile ? 8 : 8 }}>
                                                    <Avatar img={c.p?.img} name={c.p?.name} size={isMobile ? 64 : 72} color={h.color} />
                                                </div>
                                                <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 800, color: dark ? "#fff" : "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{c.p.name}</div>
                                                <div style={{ fontSize: isMobile ? 10 : 11, color: dark ? "#aaa" : "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.p.designation}</div>
                                            </div>
                                        ) : <div key={i} />
                                    ))}
                                </div>
                            )}

                            {/* 2x2 captain grid */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: isMobile ? 8 : 12 }}>
                                {[{ l: "♂ Captain", p: h.boysCaptain }, { l: "♀ Captain", p: h.girlsCaptain }, { l: "♂ Vice Captain", p: h.viceCaptainBoys }, { l: "♀ Vice Captain", p: h.viceCaptainGirls }].map((c, i) => (
                                    <div key={i} style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.75)", borderRadius: 12, padding: isMobile ? "12px 10px" : "16px 10px", textAlign: "center" }}>
                                        <div style={{ fontSize: isMobile ? 10 : 10, fontWeight: 700, color: h.color, letterSpacing: 1, textTransform: "uppercase", marginBottom: isMobile ? 8 : 8 }}>{c.l}</div>
                                        <div style={{ display: "flex", justifyContent: "center", marginBottom: isMobile ? 8 : 8 }}>
                                            <Avatar img={c.p?.img} name={c.p?.name || "?"} size={isMobile ? 64 : 72} color={h.color} />
                                        </div>
                                        <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: dark ? "#fff" : "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{c.p?.name || "—"}</div>
                                        {c.p?.name && (c.p.year || c.p.dept) && (
                                            <div style={{ fontSize: isMobile ? 10 : 11, color: dark ? "#aaa" : "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {c.p.year} {c.p.dept ? `(${c.p.dept})` : ""}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                {memorial?.enabled && (
                    <section style={{ 
                        marginTop: 40, 
                        background: dark ? "rgba(255,255,255,.03)" : "#fffcfc", 
                        borderRadius: 24, 
                        padding: isMobile ? "30px 20px" : "50px 40px",
                        border: `1px solid ${dark ? "#333" : "#eee"}`,
                        boxShadow: "0 10px 40px rgba(139,0,0,0.05)",
                        textAlign: "center"
                    }}>
                        <div style={{ display: "inline-block", background: "#8B0000", color: "#fff", padding: "4px 16px", borderRadius: 50, fontSize: 11, fontWeight: 800, letterSpacing: 2, marginBottom: 20, textTransform: "uppercase" }}>In Loving Memory</div>
                        
                        <h2 style={{ fontFamily: "'Georgia',serif", fontSize: isMobile ? 28 : 42, color: dark ? "#fff" : "#8B0000", margin: "0 0 16px" }}>{memorial.name || "Our Beloved Staff"}</h2>
                        
                        <div style={{ maxWidth: 700, margin: "0 auto 40px", lineHeight: 1.8, color: dark ? "#ccc" : "#444", fontSize: isMobile ? 15 : 18, fontStyle: "italic" }}>
                            "{memorial.description || "In memory of our dear colleague who served our institution with dedication and passion. Their legacy lives on in our hearts and the lives they touched."}"
                        </div>

                        {memorial.images?.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 15 }}>
                                {memorial.images.map((img, i) => (
                                    <div key={img.id || i} style={{ 
                                        width: isMobile ? "calc(50% - 10px)" : "250px", 
                                        aspectRatio: "3/4", 
                                        borderRadius: 16, 
                                        overflow: "hidden", 
                                        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                                        border: `4px solid ${dark ? "#222" : "#fff"}`,
                                        transform: `rotate(${i % 2 === 0 ? "1.5deg" : "-1.5deg"})`,
                                        transition: "transform .3s ease"
                                    }}>
                                        <img src={img.src} alt="Tribute" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div style={{ marginTop: 30, fontSize: 24, opacity: 0.6 }}>🕊️</div>
                    </section>
                )}
            </div>
        </div>
    );
}

export function EventsPage({ dark, games }) {
    const isMobile = useIsMobile();
    const sc = { Live: "#FF4500", Upcoming: "#1E90FF", Completed: "#228B22" };

    return (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: isMobile ? "16px 12px" : "40px 20px" }}>
            <h1 style={{ fontFamily: "'Georgia',serif", color: dark ? "#fff" : "#8B0000", marginBottom: 6, fontSize: isMobile ? 21 : 28 }}>📅 Events & Schedule</h1>
            <p style={{ color: dark ? "#aaa" : "#666", marginBottom: isMobile ? 14 : 32, fontSize: isMobile ? 13 : 15 }}>Live schedule with real-time updates</p>
            <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 8 : 16 }}>
                {games.map(g => (
                    <div key={g.id} style={{ background: dark ? "rgba(255,255,255,.05)" : "#fff", border: `2px solid ${sc[g.status]}22`, borderLeft: `5px solid ${sc[g.status]}`, borderRadius: 12, padding: isMobile ? 12 : 20, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, justifyContent: "space-between" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                                    <span style={{ background: sc[g.status] + "22", color: sc[g.status], fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>{g.status === "Live" ? "🔴 LIVE" : g.status}</span>
                                    {g.delay && <span style={{ fontSize: 10, color: "#FF4500", background: "#FF450015", padding: "2px 7px", borderRadius: 20, fontWeight: 700 }}>⚠️ {g.delay}</span>}
                                </div>
                                <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color: dark ? "#fff" : "#222" }}>{g.name}</div>
                                <div style={{ fontSize: 12, color: dark ? "#aaa" : "#666", marginTop: 2 }}>📍 {g.venue} · {g.participants}</div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: 10, color: dark ? "#aaa" : "#888" }}>Start</div>
                                <div style={{ fontSize: isMobile ? 17 : 22, fontWeight: 800, color: dark ? "#fff" : "#222", fontFamily: "'Georgia',serif" }}>{g.start}</div>
                                <div style={{ fontSize: 10, color: dark ? "#aaa" : "#888" }}>–{g.end}</div>
                            </div>
                        </div>
                    </div>
                ))}
                {games.length === 0 && <div style={{ textAlign: "center", padding: 48, color: dark ? "#666" : "#aaa" }}>No events scheduled yet.</div>}
            </div>
        </div>
    );
}

function SportsAnimations({ isMobile }) {
    return (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 1, opacity: 0.8 }}>
            {/* Cricket Bat */}
            <div style={{ position: 'absolute', top: '15%', left: isMobile ? '5%' : '15%', fontSize: isMobile ? 40 : 60, animation: 'float-cricket 3s ease-in-out infinite', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}>
                🏏
            </div>

            {/* Football */}
            <div style={{ position: 'absolute', top: '40%', right: isMobile ? '8%' : '20%', fontSize: isMobile ? 35 : 55, animation: 'bounce-football 2.5s cubic-bezier(0.28, 0.84, 0.42, 1) infinite', filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.4))' }}>
                ⚽
            </div>

            {/* Shuttlecock */}
            <div style={{ position: 'absolute', bottom: '30%', left: isMobile ? '12%' : '25%', fontSize: isMobile ? 30 : 50, animation: 'fly-shuttle 4s linear infinite', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.2))' }}>
                🏸
            </div>

            {/* Runner */}
            <div style={{ position: 'absolute', bottom: '10%', left: '0', fontSize: isMobile ? 45 : 70, animation: 'dash-runner 6s linear infinite', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}>
                🏃‍♂️
            </div>
        </div>
    );
}
