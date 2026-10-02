import React from "react";

export default function Loader({
  text = "Loading...",
  size = "medium",
}) {
  return (
    <div className={`map-loader map-loader-${size}`}>
      <span className="map-loader-spinner"></span>
      <span>{text}</span>
    </div>
  );
}