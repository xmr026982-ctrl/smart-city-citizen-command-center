import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_MB,
  MAX_PHOTOS,
  PHOTO_HINTS,
} from "../../../constants/issueConstants";

function IssuePhotoUpload({ files, onChange }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");

  const handleFiles = (list) => {
    if (!list?.length) return;
    const incoming = Array.from(list);
    if (files.length + incoming.length > MAX_PHOTOS) {
      setError("You can upload a maximum of 5 photos.");
      return;
    }
    const bad = incoming.find(
      (file) =>
        !ALLOWED_PHOTO_TYPES.includes(file.type) ||
        file.size > MAX_PHOTO_MB * 1024 * 1024
    );
    if (bad) {
      setError("Only PNG, JPG or JPEG images up to 5 MB each are allowed.");
      return;
    }
    setError("");
    onChange([
      ...files,
      ...incoming.map((file) => ({
        id: `${file.name}-${file.lastModified}`,
        name: file.name,
        url: URL.createObjectURL(file),
        sizeMb: Number((file.size / 1024 / 1024).toFixed(2)),
      })),
    ]);
  };

  return (
    <div>
      <h3>Attach photos</h3>
      <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
        Optional supporting evidence. Clear photos help the response team understand the issue more accurately.
      </p>
      <span className="optional-badge">Optional evidence</span>

      <div
        className="upload-box"
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <ImagePlus size={28} />
        <h4 style={{ marginTop: 12 }}>{files.length ? "Add more photos" : "Upload issue photos"}</h4>
        <p style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
          Click or press Enter to select images
        </p>
        {PHOTO_HINTS.map((hint) => (
          <p key={hint} className="constraint">
            {hint}
          </p>
        ))}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error ? <p className="field-error">{error}</p> : null}

      {files.map((file, index) => (
        <div
          key={file.id}
          style={{
            marginTop: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--card)",
          }}
        >
          <span style={{ fontSize: 13 }}>{file.name}</span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ height: 32, padding: "0 10px" }}
            aria-label={`Remove ${file.name}`}
            onClick={() => onChange(files.filter((_, i) => i !== index))}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default IssuePhotoUpload;