import React from "react";
import MapView from "../../components/map/MapView";

export default function UserMap() {
  return (
    <div
      className="user-map-page"
      style={{
        width: "100%",
        height: "100vh",
      }}
    >
      <MapView />
    </div>
  );
}