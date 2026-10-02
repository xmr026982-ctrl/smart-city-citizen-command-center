import React from "react";
import { Circle, CircleMarker, Popup } from "react-leaflet";

export default function MyLocation({
  userLocation,
  locationAccuracy,
}) {
  if (!userLocation) {
    return null;
  }

  return (
    <>
      {/* Accuracy Circle */}
      <Circle
        center={userLocation}
        radius={locationAccuracy || 40}
        pathOptions={{
          color: "#2563eb",
          fillColor: "#3b82f6",
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: "4, 4",
        }}
      />

      {/* Outer Blue Circle */}
      <CircleMarker
        center={userLocation}
        radius={12}
        pathOptions={{
          color: "#60a5fa",
          weight: 2,
          fillColor: "#3b82f6",
          fillOpacity: 0.4,
        }}
      />

      {/* Inner Blue Dot */}
      <CircleMarker
        center={userLocation}
        radius={6}
        pathOptions={{
          color: "#ffffff",
          weight: 2,
          fillColor: "#2563eb",
          fillOpacity: 1,
        }}
      >
        <Popup>
          <div className="text-center">
            <strong>📍 Current Position</strong>

            <br />

            <small className="text-muted">
              Accuracy: {Math.round(locationAccuracy)} m
            </small>
          </div>
        </Popup>
      </CircleMarker>
    </>
  );
}