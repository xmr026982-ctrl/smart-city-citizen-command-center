import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";

const BASE_LAYERS = [
  {
    id: "Streets",
    name: "Streets",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    preview: "https://a.tile.openstreetmap.org/12/2939/1785.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  {
    id: "Satellite",
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    preview:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1785/2939",
    attribution: "Tiles &copy; Esri",
  },
  {
    id: "Terrain",
    name: "Terrain",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    preview: "https://a.tile.opentopomap.org/12/2939/1785.png",
    attribution: "Map data &copy; OpenTopoMap",
  },
];

export default function LayerSelector({
  activeBaseLayer,
  onBaseLayerChange,
  activeFilters,
  onFilterChange,
  showTraffic,
  onTrafficToggle,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef(null);

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
      {/* ট্রিপল-লেয়ার আইকন বটন */}
      <button
        type="button"
        className={`layer-toggle-btn ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
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

      {/* পপআপ লেয়ার উইজেট */}
      {isOpen && (
        <div className="layer-popup-card">
          <div className="layer-popup-header">
            <strong>Map Types</strong>

            <button
              className="close-btn"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          {/* বেস লেয়ার (থাম্বনেল কার্ডসমূহ) */}
          <div className="layer-card-grid">
            {BASE_LAYERS.map((layer) => (
              <div
                key={layer.id}
                className={`layer-card ${
                  activeBaseLayer === layer.id ? "selected" : ""
                }`}
                onClick={() => onBaseLayerChange(layer)}
              >
                <div className="card-image-wrapper">
                  <img src={layer.preview} alt={layer.name} />

                  {activeBaseLayer === layer.id && (
                    <div className="active-badge">✓</div>
                  )}
                </div>

                <span>{layer.name}</span>
              </div>
            ))}
          </div>

          <div className="layer-divider" />

          {/* ওভারলে ও ফিচারস (কাস্টম সুইচ/চেকবক্স) */}
          <div className="layer-overlays">
            <span className="section-title">Map Details</span>

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