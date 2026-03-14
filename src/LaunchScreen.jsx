import { useState, useEffect } from "react";
export function LaunchScreen({ config, onLaunch }) {
  const [isLaunching, setIsLaunching] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    if (!config?.released) return;

    // Start the curtain reveal slightly after release for a smooth feel
    const timer = setTimeout(() => setIsLaunching(true), 500);
    
    // Unmount and trigger complete after animation finishes
    const finishTimer = setTimeout(() => {
      setShouldRender(false);
      onLaunch();
    }, 2500); // 500ms delay + 2000ms animation

    return () => { clearTimeout(timer); clearTimeout(finishTimer); };
  }, [onLaunch, config?.released]);

  if (!shouldRender) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 99999,
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden", pointerEvents: isLaunching ? "none" : "auto",
      backgroundColor: "#000"
    }}>
      {/* Left Curtain */}
      <div style={{
        position: "absolute", top: 0, left: 0, width: "50%", height: "100%",
        background: "linear-gradient(135deg, #4A0000 0%, #8B0000 100%)",
        transition: "transform 2s cubic-bezier(0.77, 0, 0.175, 1)",
        transform: isLaunching ? "translateX(-100%)" : "translateX(0)",
        zIndex: 2,
        boxShadow: "5px 0 25px rgba(0,0,0,0.8)",
        borderRight: "4px solid #FFD700"
      }} />
      
      {/* Right Curtain */}
      <div style={{
        position: "absolute", top: 0, right: 0, width: "50%", height: "100%",
        background: "linear-gradient(225deg, #4A0000 0%, #8B0000 100%)",
        transition: "transform 2s cubic-bezier(0.77, 0, 0.175, 1)",
        transform: isLaunching ? "translateX(100%)" : "translateX(0)",
        zIndex: 2,
        boxShadow: "-5px 0 25px rgba(0,0,0,0.8)",
        borderLeft: "4px solid #FFD700"
      }} />

      {/* Center Logo - Shrinks as curtains open */}
      <div style={{
        position: "relative", zIndex: 3,
        display: "flex", flexDirection: "column", alignItems: "center",
        transition: "opacity 1.5s ease-out, transform 1.5s ease-out",
        opacity: isLaunching ? 0 : 1,
        transform: isLaunching ? "scale(1.2)" : "scale(1)",
      }}>
        <div style={{
          fontSize: "100px", marginBottom: "20px",
          filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.5))"
        }}>
          🏆
        </div>
        <h1 style={{
          color: "#fff", fontSize: "48px", fontWeight: "900",
          textShadow: "0 4px 15px rgba(0,0,0,0.7)", textAlign: "center",
          textTransform: "uppercase", letterSpacing: "4px"
        }}>
          {config?.title || "Achariya Sports Day"} <span style={{ color: "#FFD700" }}>{config?.year || "2026"}</span>
        </h1>
        
        {!config?.released && (
          <div style={{
            marginTop: "30px",
            color: "#FFD700",
            fontSize: "18px",
            fontWeight: "700",
            letterSpacing: "2px",
            textTransform: "uppercase",
            animation: "pulse 2s infinite",
            background: "rgba(0,0,0,0.3)",
            padding: "10px 20px",
            borderRadius: "30px",
            border: "1px solid rgba(255,215,0,0.3)"
          }}>
            ⏳ Waiting for Ceremonial Launch...
          </div>
        )}
      </div>

      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        background: "radial-gradient(circle at center, #222 0%, #000 100%)",
        zIndex: 1, opacity: isLaunching ? 1 : 0, transition: "opacity 1s"
      }} />
    </div>
  );
}
