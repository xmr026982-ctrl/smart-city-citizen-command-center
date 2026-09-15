import { useState } from "react";

function IssuePhotoUpload() {
  const [selectedFiles, setSelectedFiles] = useState([]);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);

    setSelectedFiles(files);
  };

  const removeFile = (fileIndex) => {
    setSelectedFiles((previousFiles) =>
      previousFiles.filter((_, index) => index !== fileIndex)
    );
  };

  return (
    <div className="issue-photo-upload">
      <div className="issue-photo-heading">
        <div>
          <h3>Attach photos</h3>

          <p>
            Add photos that help explain the issue. This step is
            optional.
          </p>
        </div>

        <span>Optional</span>
      </div>

      <label htmlFor="issuePhotos" className="issue-upload-box">
        <div className="issue-upload-icon">＋</div>

        <strong>Upload issue photos</strong>

        <p>Click to select images from your device</p>

        <small>PNG, JPG or JPEG · Maximum 5 photos</small>
      </label>

      <input
        id="issuePhotos"
        type="file"
        accept="image/png, image/jpeg, image/jpg"
        multiple
        onChange={handleFileChange}
        hidden
      />

      {selectedFiles.length > 0 && (
        <div className="issue-selected-files">
          <div className="issue-selected-files-heading">
            <strong>Selected photos</strong>

            <span>{selectedFiles.length}/5</span>
          </div>

          <div className="issue-file-list">
            {selectedFiles.slice(0, 5).map((file, index) => (
              <div
                className="issue-file-item"
                key={`${file.name}-${index}`}
              >
                <div>
                  <strong>{file.name}</strong>

                  <small>
                    {(file.size / 1024).toFixed(1)} KB
                  </small>
                </div>

                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="issue-remove-file"
                  aria-label={`Remove ${file.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {selectedFiles.length > 5 && (
            <p className="issue-upload-warning">
              Only the first 5 photos will be used.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default IssuePhotoUpload;