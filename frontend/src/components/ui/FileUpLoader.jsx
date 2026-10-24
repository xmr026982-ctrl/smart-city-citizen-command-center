import { useRef } from "react";

function FileUpLoader({ accept = "image/png,image/jpeg,image/jpg", multiple = true, onFiles }) {
  const inputRef = useRef(null);

  return (
    <div>
      <button type="button" className="btn btn-secondary" onClick={() => inputRef.current?.click()}>
        Choose files
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(event) => {
          onFiles?.(Array.from(event.target.files || []));
          event.target.value = "";
        }}
      />
    </div>
  );
}

export default FileUpLoader;