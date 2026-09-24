import React from "react";
import MapView from "../../components/map/MapView";

export default function AdminMap() {
  return (
    <div
      className="admin-map-page"
      style={{
        width: "100%",
        height: "100vh",
      }}
    >
      <MapView />
    </div>
  );
}