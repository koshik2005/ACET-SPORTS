import { useState, useEffect } from "react";

export function WelcomeScreen({ config, onStart }) {
    const [ripples, setRipples] = useState([]);

    const createRipple = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        const newRipple = { x, y, size, id: Date.now() };
        setRipples([...ripples, newRipple]);
        setTimeout(() => setRipples(rs => rs.filter(r => r.id !== newRipple.id)), 1000);
    };

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 100000,
            background: "#0a0a0a", display: "flex", flexDirection: "column", 
            alignItems: "center", justifyContent: "center", overflow: "hidden"
        }}>
            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-20px) rotate(5deg); }
                }
                @keyframes glow {
                    0%, 100% { text-shadow: 0 0 20px rgba(255,215,0,0.3); }
                    50% { text-shadow: 0 0 40px rgba(255,215,0,0.6); }
                }
                @keyframes ripple-effect {
                    to { transform: scale(4); opacity: 0; }
                }
                .falling-entity {
                    position: absolute; pointer-events: none; opacity: 0.2;
                    animation: fall-vertical linear infinite;
                }
                @keyframes fall-vertical {
                    from { transform: translateY(-10vh) rotate(0deg); }
                    to { transform: translateY(110vh) rotate(360deg); }
                }
            `}</style>

            {/* Background Decorative Elements */}
            {[...Array(15)].map((_, i) => (
                <div key={i} className="falling-entity" style={{
                    left: `${Math.random() * 100}%`,
                    fontSize: `${20 + Math.random() * 30}px`,
                    animationDuration: `${5 + Math.random() * 10}s`,
                    animationDelay: `-${Math.random() * 10}s`
                }}>
                    {["🏆", "⚽", "🏃", "🏸", "🏀"][i % 5]}
                </div>
            ))}

            <div style={{
                position: "relative", zIndex: 10, textAlign: "center",
                padding: "20px", display: "flex", flexDirection: "column", alignItems: "center"
            }}>
                <div style={{
                    fontSize: "120px", marginBottom: "30px", animation: "float 4s ease-in-out infinite",
                    filter: "drop-shadow(0 0 30px rgba(255,215,0,0.4))"
                }}>
                    🔥
                </div>

                <h1 style={{
                    color: "#fff", fontSize: "min(64px, 12vw)", fontWeight: "900", margin: "0 0 10px",
                    textTransform: "uppercase", letterSpacing: "4px", lineHeight: "1",
                    animation: "glow 3s ease-in-out infinite"
                }}>
                    {config?.title || "Achariya Sports Day"}
                </h1>
                
                <h2 style={{
                    color: "#FFD700", fontSize: "min(42px, 8vw)", fontWeight: "800", margin: "0 0 50px",
                    letterSpacing: "8px", textTransform: "uppercase"
                }}>
                    {config?.year || "2026"}
                </h2>

                <button 
                    onClick={(e) => {
                        createRipple(e);
                        setTimeout(onStart, 400);
                    }}
                    style={{
                        position: "relative", overflow: "hidden",
                        padding: "25px 80px", fontSize: "28px", fontWeight: "950",
                        color: "#000", background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                        border: "none", borderRadius: "60px", cursor: "pointer",
                        boxShadow: "0 15px 40px rgba(255, 215, 0, 0.4), 0 0 100px rgba(255,215,0,0.2)",
                        textTransform: "uppercase", letterSpacing: "5px", transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.1) translateY(-5px)";
                        e.currentTarget.style.boxShadow = "0 25px 60px rgba(255, 215, 0, 0.6), 0 0 120px rgba(255,215,0,0.3)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1) translateY(0)";
                        e.currentTarget.style.boxShadow = "0 15px 40px rgba(255, 215, 0, 0.4), 0 0 100px rgba(255,215,0,0.2)";
                    }}
                >
                    ENTER EVENT
                    {ripples.map(r => (
                        <span key={r.id} style={{
                            position: "absolute", left: r.x, top: r.y, width: r.size, height: r.size,
                            background: "rgba(255,255,255,0.4)", borderRadius: "50%",
                            pointerEvents: "none", animation: "ripple-effect 1s linear forwards"
                        }} />
                    ))}
                </button>

                <p style={{ marginTop: "30px", color: "rgba(255,255,255,0.4)", fontSize: "14px", fontWeight: "600", letterSpacing: "2px" }}>
                    PREPARE FOR GLORY
                </p>
            </div>

            {/* Vignette effect */}
            <div style={{
                position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                boxShadow: "inset 0 0 200px rgba(0,0,0,0.9)", pointerEvents: "none"
            }} />
        </div>
    );
}
