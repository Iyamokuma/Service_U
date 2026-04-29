import { useRef, useState } from "react";

export function Dropzone({ value, onChange }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  function handleFile(f) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) =>
      onChange({ name: f.name, size: f.size, dataUrl: e.target.result });
    reader.readAsDataURL(f);
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
          {value?.name ? value.name : "Passport-style photo"}
        </div>
        <div className="dropzone-desc">
          {value
            ? `${(value.size / 1024).toFixed(0)} KB — ready to upload`
            : "Drag & drop, or browse. JPG or PNG, portrait orientation, clear face, neutral background."}
        </div>
        <div className="dropzone-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => inputRef.current?.click()}
          >
            {value ? "Replace" : "Browse file"}
          </button>
          {value && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => onChange(null)}
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
