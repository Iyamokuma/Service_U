import { useRef, useState } from "react";
import {
  formatPhotoBytes,
  PHOTO_MAX_OUTPUT_BYTES,
  PHOTO_MAX_UPLOAD_BYTES,
  preparePhotoFile,
} from "../photoCompress.js";

export function Dropzone({ value, onChange }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(f) {
    if (!f || busy) return;
    setError("");
    setBusy(true);
    try {
      const prepared = await preparePhotoFile(f);
      onChange(prepared);
    } catch (err) {
      onChange(null);
      setError(err?.message || "Could not use this image.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      className={`dropzone ${drag ? "dragover" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="dropzone-preview">
        {value?.dataUrl ? (
          <img src={value.dataUrl} alt="Preview" />
        ) : (
          <span className="ph-label">Photo</span>
        )}
      </div>
      <div className="dropzone-body">
        <div className="dropzone-title">
          {busy ? "Compressing photo…" : value?.name ? value.name : "Passport-style photo"}
        </div>
        <div className="dropzone-desc">
          {busy
            ? "Optimizing image for upload…"
            : value
              ? `${formatPhotoBytes(value.size)} compressed — ready to upload`
              : `Drag & drop, or browse. JPG or PNG up to ${formatPhotoBytes(PHOTO_MAX_UPLOAD_BYTES)}; saved at max ${formatPhotoBytes(PHOTO_MAX_OUTPUT_BYTES)}.`}
        </div>
        {error ? (
          <div className="error-msg" role="alert" style={{ marginTop: 8 }}>
            {error}
          </div>
        ) : null}
        <div className="dropzone-actions">
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {value ? "Replace" : "Browse file"}
          </button>
          {value && (
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => {
                setError("");
                onChange(null);
              }}
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          style={{ display: "none" }}
          disabled={busy}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
