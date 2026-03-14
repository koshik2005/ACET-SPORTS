import { useState, useEffect } from "react";

export function GuestButtonPage({ launchConfig, onUpdateConfig, dark, syncing }) {
    const [password, setPassword] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = (e) => {
        e.preventDefault();
        if (password === "guest2026") {
            setIsAuthenticated(true);
            setError("");
        } else {
            setError("Incorrect ceremonial password.");
        }
    };

    if (!isAuthenticated) {
        return (
            <div style={{
                minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center",
                padding: "20px", background: dark ? "#0f0f1a" : "#f4f4f8"
            }}>
                <div style={{
                    maxWidth: "400px", width: "100%", padding: "40px",
                    background: dark ? "#1a1a2e" : "#fff", borderRadius: "24px",
                    boxShadow: "0 20px 50px rgba(0,0,0,0.2)", textAlign: "center",
                    border: `1px solid ${dark ? "#FFD70044" : "#FFD700"}`
                }}>
                    <div style={{ fontSize: "50px", marginBottom: "20px" }}>🗝️</div>
                    <h2 style={{ color: dark ? "#fff" : "#222", margin: "0 0 10px", fontSize: "24px" }}>Guest Portal</h2>
                    <p style={{ color: dark ? "#aaa" : "#666", fontSize: "14px", marginBottom: "30px" }}>
                        Enter the ceremonial password to access the launch control.
                    </p>
                    <form onSubmit={handleLogin}>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Ceremonial Password"
                            style={{
                                width: "100%", padding: "15px 20px", borderRadius: "12px",
                                border: `2px solid ${dark ? "#333" : "#eee"}`,
                                background: dark ? "#0a0a0f" : "#f9f9f9",
                                color: dark ? "#fff" : "#000",
                                fontSize: "16px", marginBottom: "15px", outline: "none"
                            }}
                        />
                        {error && <div style={{ color: "#ff4444", fontSize: "12px", marginBottom: "15px" }}>{error}</div>}
                        <button type="submit" style={{
                            width: "100%", padding: "15px", borderRadius: "12px",
                            border: "none", background: "linear-gradient(135deg, #FFD700, #DAA520)",
                            color: "#000", fontWeight: "800", fontSize: "16px",
                            cursor: "pointer", boxShadow: "0 10px 20px rgba(218,165,32,0.3)"
                        }}>
                            ACCESS CONTROL
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const isReleased = !!launchConfig?.released;

    return (
        <div style={{
            minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "40px", background: dark ? "#0a0a0f" : "#f4f4f8", textAlign: "center"
        }}>
            <div style={{
                maxWidth: "600px", width: "100%", padding: "60px 40px",
                background: dark ? "rgba(255,215,0,0.02)" : "#fff",
                borderRadius: "40px", border: `2px solid ${isReleased ? "#2E8B57" : "#FFD700"}`,
                boxShadow: isReleased ? "0 20px 60px rgba(46,139,87,0.2)" : "0 30px 80px rgba(218,165,32,0.15)",
                position: "relative", overflow: "hidden"
            }}>
                {/* Decorative particles */}
                <div style={{ position: "absolute", top: -20, left: -20, fontSize: "40px", opacity: 0.1 }}>🏆</div>
                <div style={{ position: "absolute", bottom: -20, right: -20, fontSize: "40px", opacity: 0.1 }}>🔥</div>

                <div style={{ fontSize: "80px", marginBottom: "30px", animation: "float 4s ease-in-out infinite" }}>
                    {syncing ? "⏳" : (isReleased ? "🏟️" : "🎬")}
                </div>
                
                <h1 style={{ 
                    color: dark ? "#fff" : "#222", fontSize: "32px", fontWeight: "900", margin: "0 0 10px",
                    textTransform: "uppercase", letterSpacing: "2px"
                }}>
                    Ceremonial Launch
                </h1>
                <p style={{ color: dark ? "#aaa" : "#666", fontSize: "16px", marginBottom: "50px", lineHeight: "1.6" }}>
                    {isReleased ? 
                        "The event is currently LIVE. The curtains have been opened for all participants." : 
                        "Press the button below to trigger the ceremonial reveal and open the curtains for all participants worldwide."
                    }
                </p>

                <button
                    disabled={syncing}
                    onClick={() => {
                        if (!isReleased && !window.confirm("Trigger the ceremonial reveal for ALL users?")) return;
                        // Use functional update to ensure we use the most recent configuration
                        onUpdateConfig(prev => ({ ...prev, released: !prev.released }));
                    }}
                    style={{
                        padding: "30px 60px", fontSize: "24px", fontWeight: "900",
                        color: (isReleased || syncing) ? "#fff" : "#000",
                        background: syncing ? "#444" : (isReleased ? "#4B5563" : "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)"),
                        border: "none", borderRadius: "100px", cursor: syncing ? "not-allowed" : "pointer",
                        boxShadow: (isReleased || syncing) ? "none" : "0 20px 50px rgba(255, 215, 0, 0.4)",
                        textTransform: "uppercase", letterSpacing: "4px",
                        transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                        animation: (isReleased || syncing) ? "none" : "pulse-button 2s infinite",
                        opacity: syncing ? 0.7 : 1
                    }}
                    onMouseEnter={(e) => {
                        if (!isReleased && !syncing) {
                            e.currentTarget.style.transform = "scale(1.05) translateY(-5px)";
                            e.currentTarget.style.boxShadow = "0 30px 70px rgba(255, 215, 0, 0.6)";
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isReleased && !syncing) {
                            e.currentTarget.style.transform = "scale(1) translateY(0)";
                            e.currentTarget.style.boxShadow = "0 20px 50px rgba(255, 215, 0, 0.4)";
                        }
                    }}
                >
                    {syncing ? "SYNCING..." : (isReleased ? "🔒 LOCK CURTAINS" : "🎬 LAUNCH EVENT")}
                </button>

                <div style={{ marginTop: "40px", fontSize: "14px", fontWeight: "700", opacity: 0.6 }}>
                    Status: {syncing ? 
                        <span style={{ color: "#DAA520" }}>● UPDATING...</span> :
                        (isReleased ? 
                            <span style={{ color: "#2E8B57" }}>● LIVE (OPEN)</span> : 
                            <span style={{ color: "#8B0000" }}>● READY (CLOSED)</span>
                        )
                    }
                </div>
            </div>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-15px); }
                }
                @keyframes pulse-button {
                    0% { transform: scale(1); box-shadow: 0 20px 50px rgba(255, 215, 0, 0.4); }
                    50% { transform: scale(1.02); box-shadow: 0 20px 70px rgba(255, 215, 0, 0.7); }
                    100% { transform: scale(1); box-shadow: 0 20px 50px rgba(255, 215, 0, 0.4); }
                }
            `}</style>
        </div>
    );
}
