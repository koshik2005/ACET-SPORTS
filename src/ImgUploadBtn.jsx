import { useState, useRef } from "react";
import { API_BASE } from "./api.js";
import { ImageCropper } from "./ImageCropper.jsx";

export function ImgUploadBtn({ img, onUpload, size = 64, dark }) {
    const ref = useRef();
    const [uploading, setUploading] = useState(false);
    const [tempImage, setTempImage] = useState(null);

    const onChange = async e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = ev => {
            setTempImage(ev.target.result);
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const handleCropComplete = async (croppedBase64) => {
        setTempImage(null);
        setUploading(true);

        try {
            const token = localStorage.getItem("adminToken");
            const res = await fetch(`${API_BASE}/api/upload-image`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ data: croppedBase64 }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Upload failed");
            onUpload(result.url);
        } catch (err) {
            console.error("UPLOAD ERROR:", err);
            alert("Upload failed. Using local browser view instead.");
            onUpload(croppedBase64);
        } finally {
            setUploading(false);
        }
    };

    return (
        <>
            <input type="file" accept="image/*" ref={ref} onChange={onChange} style={{ display: "none" }} />

            {tempImage && (
                <ImageCropper
                    image={tempImage}
                    onCancel={() => setTempImage(null)}
                    onCropComplete={handleCropComplete}
                    dark={dark}
                />
            )}

            <div
                onClick={() => ref.current?.click()}
                title="Tap to upload photo"
                style={{ width: size, height: size, borderRadius: 16, cursor: uploading ? "not-allowed" : "pointer", flexShrink: 0, border: `2px dashed ${img && !uploading ? "transparent" : dark ? "#555" : "#ccc"}`, background: img ? "transparent" : dark ? "#2a2a3e" : "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", transition: "opacity 0.2s", opacity: uploading ? 0.6 : 1 }}
                onMouseEnter={e => { if (img && !uploading) e.currentTarget.querySelector(".ov").style.opacity = "1"; }}
                onMouseLeave={e => { if (img && !uploading) e.currentTarget.querySelector(".ov").style.opacity = "0"; }}
            >
                {uploading ? (
                    <span style={{ fontSize: size * 0.25, fontWeight: 700, color: dark ? "#ccc" : "#666" }}>...</span>
                ) : img ? (
                    <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                    <span style={{ fontSize: size * 0.36, opacity: 0.35 }}>📷</span>
                )}
                {img && !uploading && (
                    <div className="ov" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }}>
                        <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>Change</span>
                    </div>
                )}
            </div>
        </>
    );
}
