import React from "react";
import MapView from "../../components/map/MapView";

export default function StaffMap() {
  return (
    <div
      className="staff-map-page"
      style={{
        width: "100%",
        height: "100vh",
      }}
    >
      <MapView />
    </div>
  );
}