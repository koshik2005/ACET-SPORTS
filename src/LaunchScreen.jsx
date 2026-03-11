import { useState, useEffect } from "react";
export function LaunchScreen({ config, onLaunch }) {
  const [isLaunching, setIsLaunching] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);

  const handleLaunch = () => {
    setIsLaunching(true);
    // Wait for the curtain animation to finish before unmounting
    setTimeout(() => {
      setShouldRender(false);
      onLaunch();
    }, 2000); // 2000ms carefully matches our CSS transition duration
  };

  if (!shouldRender) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 99999,
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden", pointerEvents: isLaunching ? "none" : "auto",
      backgroundColor: "#000" // Prevents any flash behind curtains
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

      {/* Center Logo / Button Container */}
      <div style={{
        position: "relative", zIndex: 3,
        display: "flex", flexDirection: "column", alignItems: "center",
        transition: "opacity 1s ease-in, transform 1s ease-in",
        opacity: isLaunching ? 0 : 1,
        transform: isLaunching ? "scale(1.5)" : "scale(1)",
      }}>
        <div style={{
          fontSize: "80px", marginBottom: "20px",
          filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.5))"
        }}>
          🏆
        </div>
        <h1 style={{
          color: "#fff", fontSize: "42px", fontWeight: "900", marginBottom: "40px",
          textShadow: "0 4px 10px rgba(0,0,0,0.5)", textAlign: "center",
          textTransform: "uppercase", letterSpacing: "2px"
        }}>
          {config?.title || "Achariya Sports Day"} <span style={{ color: "#FFD700" }}>{config?.year || "2026"}</span>
        </h1>
        
        <button 
          onClick={handleLaunch}
          style={{
            padding: "20px 50px", fontSize: "24px", fontWeight: "900",
            color: "#8B0000", background: "linear-gradient(to right, #FFD700, #FFA500)",
            border: "none", borderRadius: "50px",
            cursor: "pointer", 
            boxShadow: "0 10px 30px rgba(255, 215, 0, 0.4), inset 0 -4px 10px rgba(0,0,0,0.2)",
            textTransform: "uppercase", letterSpacing: "3px",
            transition: "transform 0.2s, box-shadow 0.2s"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.boxShadow = "0 15px 40px rgba(255, 215, 0, 0.6), inset 0 -4px 10px rgba(0,0,0,0.2)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 10px 30px rgba(255, 215, 0, 0.4), inset 0 -4px 10px rgba(0,0,0,0.2)";
          }}
        >
          Launch Website
        </button>
      </div>

      {/* Fancy background particles or styling behind the curtains (Optional, creates depth) */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        background: "radial-gradient(circle at center, #222 0%, #000 100%)",
        zIndex: 1, opacity: isLaunching ? 1 : 0, transition: "opacity 1s"
      }} />
    </div>
  );
}
