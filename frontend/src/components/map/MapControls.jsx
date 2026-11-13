import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { isInsideKolkata } from "./MapUtils";
import { mapNotify } from "./mapNotify";

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
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.6"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>';

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
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
        issueButton.classList.toggle("on", Boolean(showAssignedIssues));

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
      zoomInButton.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

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
      zoomOutButton.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>';

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
        mapNotify("Pick a spot inside Kolkata.");
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