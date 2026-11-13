import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { X, Check } from "lucide-react";

// integration: Person 3's Standard (default), Satellite and Terrain, plus
// "Clean command" (a muted base so issues stand out). Satellite now carries
// street and place names; every type zooms to building level.
// integration: Clean command uses MapTiler (the project's VITE_MAPTILER_KEY);
// without a key it is not offered. Previews show central Kolkata
// (zoom 12, tile x 3053 / y 1783).
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || "";
const PREVIEW = { z: 12, x: 3053, y: 1783 };

const BASE_LAYERS = [
  {
    id: "Streets",
    name: "Standard",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    preview: `https://a.tile.openstreetmap.org/${PREVIEW.z}/${PREVIEW.x}/${PREVIEW.y}.png`,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxNativeZoom: 19,
  },
  MAPTILER_KEY
    ? {
        id: "Clean",
        name: "Clean command",
        url: `https://api.maptiler.com/maps/dataviz/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
        preview: `https://api.maptiler.com/maps/dataviz/256/${PREVIEW.z}/${PREVIEW.x}/${PREVIEW.y}.png?key=${MAPTILER_KEY}`,
        attribution:
          '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxNativeZoom: 20,
      }
    : null,
  {
    id: "Satellite",
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    preview: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${PREVIEW.z}/${PREVIEW.y}/${PREVIEW.x}`,
    attribution: "Tiles &copy; Esri",
    maxNativeZoom: 19,
    labels: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    ],
  },
  {
    id: "Terrain",
    name: "Terrain",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    preview: `https://a.tile.opentopomap.org/${PREVIEW.z}/${PREVIEW.x}/${PREVIEW.y}.png`,
    attribution: "Map data &copy; OpenTopoMap",
    maxNativeZoom: 17,
  },
].filter(Boolean);

export default function LayerSelector({
  closeSignal = 0, // integration: an issue card opening closes this panel
  onOpen, // integration: opening this panel closes the issue card
  showBreachToggle = false, // integration: admin zone breach overlay switch
  showCommunityToggle = false, // integration: community layer switch
  activeBaseLayer,
  onBaseLayerChange,
  activeFilters,
  onFilterChange,
  showTraffic,
  onTrafficToggle,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef(null);
  useEffect(() => { setIsOpen(false); }, [closeSignal]);

  useEffect(() => {
    if (!selectorRef.current) return;

    L.DomEvent.disableClickPropagation(selectorRef.current);
    L.DomEvent.disableScrollPropagation(selectorRef.current);

    return () => {
      if (!selectorRef.current) return;

      L.DomEvent.enableClickPropagation(selectorRef.current);
      L.DomEvent.enableScrollPropagation(selectorRef.current);
    };
  }, []);

  return (
    <div ref={selectorRef} className="layer-control-wrapper">

      <button
        type="button"
        className={`layer-toggle-btn ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen((prev) => { if (!prev) onOpen?.(); return !prev; })}
        title="Map Layers"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </button>

      {isOpen && (
        <div className="layer-popup-card">
          <div className="layer-popup-header">
            <strong>Map type</strong>

            <button
              type="button"
              className="close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>

          <div className="layer-card-grid">
            {BASE_LAYERS.map((layer) => (
              <button
                type="button"
                key={layer.id}
                className={`layer-card ${
                  activeBaseLayer === layer.id ? "selected" : ""
                }`}
                aria-pressed={activeBaseLayer === layer.id}
                onClick={() => onBaseLayerChange(layer)}
              >
                <span className="card-image-wrapper">
                  <img src={layer.preview} alt="" />

                  {activeBaseLayer === layer.id && (
                    <span className="active-badge"><Check size={12} strokeWidth={3} /></span>
                  )}
                </span>

                <span>{layer.name}</span>
              </button>
            ))}
          </div>

          <div className="layer-divider" />

          <div className="layer-overlays">
            <span className="section-title">On the map</span>

            {/* integration: traffic needs a TomTom key; hide the toggle without one */}
            {import.meta.env.VITE_TOMTOM_API_KEY ? (
            <label className="switch-row">
              <span>Traffic Info</span>

              <input
                type="checkbox"
                checked={showTraffic}
                onChange={(e) =>
                  onTrafficToggle(e.target.checked)
                }
              />
            </label>
            ) : null}

            {showCommunityToggle ? (
              <label className="switch-row">
                <span>Community layer</span>
                <input type="checkbox" checked={activeFilters.community !== false} onChange={() => onFilterChange("community")} />
              </label>
            ) : null}

            {showBreachToggle ? (
              <label className="switch-row">
                <span>Zone breach overlay</span>
                <input type="checkbox" checked={activeFilters.breach !== false} onChange={() => onFilterChange("breach")} />
              </label>
            ) : null}

            <label className="switch-row">
              <span>City Hub Overlay</span>

              <input
                type="checkbox"
                checked={activeFilters.cityHub}
                onChange={() =>
                  onFilterChange("cityHub")
                }
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}