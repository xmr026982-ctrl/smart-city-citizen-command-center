import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { isInsideKolkata } from "./MapUtils";

function MapButtons({
  getUserLocation,
  locationLoading,
  role,
  showAssignedIssues,
  setShowAssignedIssues,
}) {
  const map = useMap();
  const controlRef = useRef(null);

  useEffect(() => {
    const control = L.control({ position: "bottomright" });

    control.onAdd = () => {
      const container = L.DomUtil.create(
        "div",
        "custom-map-controls"
      );

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      /* =========================
         MY LOCATION
      ========================= */

      const locationButton = L.DomUtil.create(
        "button",
        "my-location-control",
        container
      );

      locationButton.type = "button";
      locationButton.title = "My Location";
      locationButton.innerHTML = locationLoading
        ? "⏳"
        : "📍";

      L.DomEvent.on(locationButton, "click", (event) => {
        L.DomEvent.stop(event);

        if (!locationLoading) {
          getUserLocation();
        }
      });

      /* =========================
         ASSIGNED ISSUES
         STAFF ONLY
      ========================= */

      if (role === "staff") {
        const issueButton = L.DomUtil.create(
          "button",
          "assigned-issues-control",
          container
        );

        issueButton.type = "button";
        issueButton.title = "Assigned Issues";

        issueButton.innerHTML =
          showAssignedIssues ? "📌" : "📍";

        L.DomEvent.on(issueButton, "click", (event) => {
          L.DomEvent.stop(event);

          setShowAssignedIssues(
            (previous) => !previous
          );
        });
      }

      /* =========================
         ZOOM IN
      ========================= */

      const zoomInButton = L.DomUtil.create(
        "button",
        "",
        container
      );

      zoomInButton.type = "button";
      zoomInButton.title = "Zoom in";
      zoomInButton.innerHTML = "+";

      L.DomEvent.on(zoomInButton, "click", (event) => {
        L.DomEvent.stop(event);
        map.zoomIn();
      });

      /* =========================
         ZOOM OUT
      ========================= */

      const zoomOutButton = L.DomUtil.create(
        "button",
        "",
        container
      );

      zoomOutButton.type = "button";
      zoomOutButton.title = "Zoom out";
      zoomOutButton.innerHTML = "−";

      L.DomEvent.on(zoomOutButton, "click", (event) => {
        L.DomEvent.stop(event);
        map.zoomOut();
      });

      controlRef.current = container;

      return container;
    };

    control.addTo(map);

    return () => {
      map.removeControl(control);
      controlRef.current = null;
    };
  }, [
    map,
    getUserLocation,
    locationLoading,
    role,
    showAssignedIssues,
    setShowAssignedIssues,
  ]);

  return null;
}

/* =========================
   MAP CLICK
========================= */

// UI overlays that must not trigger map pin / Kolkata boundary checks
const UI_OVERLAY_SELECTORS = [
  ".playlist-card",
  ".pick-confirm-button",
  ".pick-mode-bar",
  ".map-left-toolbar",
  ".map-tool-btn",
  ".map-floating-panel",
  ".map-search-box",
  ".search-results",
  ".layer-control-wrapper",
  ".layer-popup-card",
  ".layer-toggle-btn",
  ".layer-selector",
  ".layer-card",
  ".admin-layer-manager",
  ".admin-city-status-bar",
  ".admin-issue-filter",
  ".staff-status-filter",
  ".admin-issue-details-panel",
  ".staff-issue-details-panel",
  ".custom-map-controls",
  ".map-api-feedback",
  ".leaflet-control",
  ".leaflet-control-container",
  ".leaflet-popup",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "a",
].join(", ");

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (event) => {
      const target = event.originalEvent?.target;

      // Ignore clicks that started on any map overlay / control UI
      if (target?.closest?.(UI_OVERLAY_SELECTORS)) {
        return;
      }

      const { lat, lng } = event.latlng;

      if (!isInsideKolkata(lat, lng)) {
        alert("Please select a location inside Kolkata boundaries.");
        return;
      }

      onMapClick({
        position: [lat, lng],
        latitude: lat,
        longitude: lng,
      });
    },
  });

  return null;
}

/* =========================
   MAIN
========================= */

export default function MapControls({
  onMapClick,
  getUserLocation,
  locationLoading,
  role,
  showAssignedIssues,
  setShowAssignedIssues,
  pickMode,
}) {
  return (
    <>
      <MapClickHandler
        onMapClick={onMapClick}
      />

      <MapButtons
        getUserLocation={getUserLocation}
        locationLoading={locationLoading}
        role={role}
        showAssignedIssues={showAssignedIssues}
        setShowAssignedIssues={setShowAssignedIssues}
      />
    </>
  );
}