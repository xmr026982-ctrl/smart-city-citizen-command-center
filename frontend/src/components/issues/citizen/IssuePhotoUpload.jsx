import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_MB, MAX_PHOTOS } from "../../../constants/issueConstants";

function IssuePhotoUpload({ files, onChange, active, onFocus }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");

  const handleFiles = (list) => {
    if (!list?.length) return;
    const incoming = Array.from(list);
    if (files.length + incoming.length > MAX_PHOTOS) {
      setError("You can upload a maximum of 5 photos.");
      return;
    }
    const bad = incoming.find((file) => !ALLOWED_PHOTO_TYPES.includes(file.type) || file.size > MAX_PHOTO_MB * 1024 * 1024);
    if (bad) {
      setError("Only PNG, JPG or JPEG images up to 5 MB each are allowed.");
      return;
    }
    setError("");
    onChange([...files, ...incoming.map((file) => ({
      id: `${file.name}-${file.lastModified}`,
      name: file.name,
      url: URL.createObjectURL(file),
      sizeMb: Number((file.size / 1024 / 1024).toFixed(2)),
    }))]);
  };

  return (
    <aside onClick={onFocus} style={{
      position: "relative", overflow: "hidden", borderRadius: 16, padding: 16,
      background: active ? "rgba(14,165,233,0.06)" : "rgba(255,255,255,0.55)",
      border: "1px solid rgba(14,165,233,0.16)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Evidence bay</h3>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 9px", borderRadius: 999, background: "rgba(14,165,233,0.1)", color: "var(--primary-deep)", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 650 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0ea5e9", animation: "livePulse 1.8s ease infinite" }} />
          {files.length} / {MAX_PHOTOS}
        </span>
      </div>
      <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 13.5 }}>Optional. Clear photos help the crew read the site.</p>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = "0 18px 36px rgba(14,165,233,0.18)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
        style={{
          position: "relative", marginTop: 14, minHeight: 200, borderRadius: 14, padding: "32px 14px 18px",
          textAlign: "center", cursor: "pointer", overflow: "hidden",
          background: "radial-gradient(circle at 50% 30%, rgba(14,165,233,0.14), transparent 55%), rgba(255,255,255,0.6)",
          border: "1px solid rgba(14,165,233,0.18)",
          transition: "transform 220ms ease, box-shadow 220ms ease",
        }}
      >
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(14,165,233,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.06) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(34,211,238,0.7), transparent)", animation: "scanLine 3.4s linear infinite" }} />
        <div style={{ position: "relative" }}>
          <div style={{ width: 44, height: 44, margin: "0 auto", borderRadius: 12, display: "grid", placeItems: "center", background: "rgba(14,165,233,0.12)" }}>
            <ImagePlus size={20} color="#0ea5e9" />
          </div>
          <h4 style={{ margin: "12px 0 0", fontSize: 15 }}>{files.length ? "Add more photos" : "Upload issue photos"}</h4>
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--muted)" }}>Click or press Enter to select images</p>
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
      </div>
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {["PNG, JPG or JPEG", "5 photos", "5 MB each", "1200 × 800"].map((rule) => (
          <span key={rule} style={{ padding: "5px 8px", borderRadius: 999, background: "rgba(255,255,255,0.7)", border: "1px solid rgba(14,165,233,0.14)", fontSize: 11.5, color: "var(--muted)" }}>{rule}</span>
        ))}
      </div>
      {error ? <p className="field-error">{error}</p> : null}
      {files.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {files.map((file) => (
            <div key={file.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
              <button type="button" onClick={() => onChange(files.filter((item) => item.id !== file.id))} aria-label="Remove photo" style={{ border: "none", background: "transparent", cursor: "pointer" }}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <style>{`
        @keyframes livePulse { 50% { box-shadow: 0 0 0 5px rgba(14,165,233,0.12); } }
        @keyframes scanLine { 0% { top: 0; } 100% { top: 100%; } }
      `}</style>
    </aside>
  );
}

export default IssuePhotoUpload;