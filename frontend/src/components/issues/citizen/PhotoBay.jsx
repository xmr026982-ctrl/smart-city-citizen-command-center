import { useRef, useState } from "react";
import { ImagePlus, X, RotateCcw } from "lucide-react";
import { preparePhoto, PHOTO_MAX, PHOTO_MAX_MB } from "../../../utils/photos";

/* ------------------------------------------------------------------
   Photo bay: optional evidence for a report. Click, press Enter, or
   drop files on it. Each photo is resized before it is kept (see
   utils/photos.js), shown as a thumbnail, and can be removed.
------------------------------------------------------------------- */

function PhotoBay({ photos, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(0);
  const [errors, setErrors] = useState([]);
  const [over, setOver] = useState(false);
  const room = PHOTO_MAX - photos.length;

  const take = async (list) => {
    const files = Array.from(list || []);
    if (!files.length) return;
    const errs = [];
    if (files.length > room) errs.push(`Up to ${PHOTO_MAX} photos per report. ${room ? `Kept the first ${room}.` : "Remove one to add another."}`);
    const batch = files.slice(0, Math.max(0, room));
    setBusy(batch.length);
    const done = [];
    for (const file of batch) {
      try {
        done.push(await preparePhoto(file));
      } catch (e) {
        errs.push(e.message);
      }
    }
    setBusy(0);
    setErrors(errs);
    if (done.length) onChange([...photos, ...done]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="pb">
      <div
        role="button"
        tabIndex={room ? 0 : -1}
        aria-disabled={!room}
        className={`pb-drop${over ? " over" : ""}${room ? "" : " full"}`}
        onClick={() => room && inputRef.current?.click()}
        onKeyDown={(e) => { if (room && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); if (room) setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (room) take(e.dataTransfer.files); }}
      >
        <span className="pb-scan" aria-hidden />
        <span className="pb-ic">{busy ? <RotateCcw size={20} className="spin" /> : <ImagePlus size={20} />}</span>
        <strong>{busy ? `Preparing ${busy} photo${busy === 1 ? "" : "s"}…` : room ? (photos.length ? "Add another photo" : "Add photos of the problem") : "Photo limit reached"}</strong>
        <span>{room ? `Click, press Enter or drop images here · up to ${PHOTO_MAX}, ${PHOTO_MAX_MB} MB each` : "Remove a photo to add a different one"}</span>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => take(e.target.files)} />
      </div>
      {errors.length ? <ul className="pb-errors" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
      {photos.length ? (
        <div className="pb-grid">
          {photos.map((ph, i) => (
            <figure key={ph.id} className="pb-thumb" style={{ animationDelay: `${i * 50}ms` }}>
              <img src={ph.url} alt={`Photo ${i + 1}: ${ph.name}`} />
              <figcaption>{ph.kb} KB</figcaption>
              <button type="button" onClick={() => onChange(photos.filter((x) => x.id !== ph.id))} aria-label={`Remove photo ${i + 1}`}><X size={12} /></button>
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default PhotoBay;