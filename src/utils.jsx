import { useState, useEffect, useMemo } from "react";

export function useIsMobile() {
    const [m, setM] = useState(window.innerWidth <= 700);
    useEffect(() => {
        const h = () => setM(window.innerWidth <= 700);
        window.addEventListener("resize", h);
        return () => window.removeEventListener("resize", h);
    }, []);
    return m;
}

export const hi = (n = "") => (n || "").slice(0, 2).toUpperCase();

export const tint = (hex, a = 0.09) => {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
};

export function Count({ v }) {
    const [d, setD] = useState(0);
    useEffect(() => {
        let s = 0;
        const step = Math.ceil(v / 40);
        const t = setInterval(() => {
            s += step;
            if (s >= v) { setD(v); clearInterval(t); }
            else setD(s);
        }, 30);
        return () => clearInterval(t);
    }, [v]);
    return <span>{d}</span>;
}

export function Confetti({ show }) {
    const [particles, setParticles] = useState([]);

    useEffect(() => {
        if (show) {
            const c = ["#8B0000", "#FFD700", "#FF4500", "#1E90FF", "#228B22", "#FF69B4"];
            const p = [...Array(40)].map((_, i) => ({
                id: i,
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                background: c[i % c.length],
                borderRadius: Math.random() > .5 ? "50%" : "2px",
                duration: 1.5 + Math.random() * 2,
                delay: Math.random() * 2,
            }));
            setParticles(p);
        } else {
            setParticles([]);
        }
    }, [show]);

    if (!show || particles.length === 0) return null;
    return (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 999, overflow: "hidden" }}>
            {particles.map(p => (
                <div key={p.id} style={{ position: "absolute", left: p.left, top: p.top, width: 10, height: 10, background: p.background, borderRadius: p.borderRadius, animation: `fall ${p.duration}s ${p.delay}s linear forwards`, opacity: .85 }} />
            ))}
        </div>
    );
}

export function Avatar({ img, name, size = 64, color = "#888" }) {
    return (
        <div style={{ width: size, height: size, borderRadius: 16, overflow: "hidden", flexShrink: 0, background: img ? "transparent" : color, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${color}`, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}>
            {img
                ? <img src={img} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ color: "#fff", fontWeight: 800, fontSize: size * .3 }}>{hi(name)}</span>
            }
        </div>
    );
}

export function Sheet({ open = true, dark, isMobile, onClose, title, children }) {
    if (!open) return null;
    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 300, padding: 0 }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{ background: dark ? "#1a1a2e" : "#fff", borderRadius: isMobile ? "20px 20px 0 0" : "20px", padding: isMobile ? 20 : 32, width: isMobile ? "100%" : "min(500px,90vw)", boxShadow: "0 -8px 40px rgba(0,0,0,.5)", maxHeight: "92vh", overflowY: "auto" }}>
                {isMobile && <div style={{ width: 40, height: 4, background: "#ccc", borderRadius: 2, margin: "0 auto 14px" }} />}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ color: dark ? "#fff" : "#222", margin: 0, fontSize: isMobile ? 16 : 18 }}>{title}</h3>
                    <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: dark ? "#aaa" : "#888" }}>✕</button>
                </div>
                {children}
            </div>
        </div>
    );
}
