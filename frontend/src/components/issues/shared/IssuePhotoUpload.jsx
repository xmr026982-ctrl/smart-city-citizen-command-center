import { useRef, useState } from "react";

function IssuePhotoUpload() {
  const fileInputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [error, setError] = useState("");

  const MAX_FILES = 5;
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    setError("");

    if (files.length === 0) return;

    if (selectedFiles.length + files.length > MAX_FILES) {
      setError("You can upload a maximum of 5 photos.");
      return;
    }

    const invalidFile = files.find(
      (file) =>
        !allowedTypes.includes(file.type) || file.size > MAX_FILE_SIZE
    );

    if (invalidFile) {
      setError("Only PNG, JPG or JPEG images up to 5 MB each are allowed.");
      return;
    }

    setSelectedFiles((previousFiles) => [...previousFiles, ...files]);
  };

  const removeFile = (fileIndex) => {
    setSelectedFiles((previousFiles) =>
      previousFiles.filter((_, index) => index !== fileIndex)
    );
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="issue-photo-content">
      <div className="issue-photo-heading">
        <h3>Attach photos</h3>
        <p>
          Optional supporting evidence. Clear photos help the response team
          understand the issue more accurately.
        </p>
        <span className="optional-badge">Optional evidence</span>
      </div>

      <div
        className="upload-box"
        role="button"
        tabIndex={0}
        onClick={openFilePicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openFilePicker();
          }
        }}
      >
        <div className="upload-icon">＋</div>

        <h4>
          {selectedFiles.length > 0
            ? "Add more photos"
            : "Upload issue photos"}
        </h4>

        <p>Click or press Enter to select images from your device</p>

        <div className="upload-note">
          PNG, JPG or JPEG · Maximum 5 photos
        </div>

        <div className="image-size-requirement">
          Maximum file size: 5 MB per image
        </div>

        <div className="image-size-requirement">
          Recommended resolution: 1200 × 800 px
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          multiple
          hidden
          onChange={handleFileChange}
        />
      </div>

      {error && <p className="error-message">{error}</p>}

      {selectedFiles.length > 0 && (
        <div className="selected-photo-list">
          <div className="selected-photo-header">
            <strong>Selected photos</strong>
            <span>
              {selectedFiles.length}/{MAX_FILES}
            </span>
          </div>

          {selectedFiles.map((file, index) => (
            <div
              className="selected-photo-item"
              key={`${file.name}-${index}`}
            >
              <div className="selected-photo-info">
                <span className="selected-photo-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <strong>{file.name}</strong>
                  <small>
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </small>
                </div>
              </div>

              <button
                type="button"
                className="remove-photo-button"
                onClick={(event) => {
                  event.stopPropagation();
                  removeFile(index);
                }}
                aria-label={`Remove ${file.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default IssuePhotoUpload;