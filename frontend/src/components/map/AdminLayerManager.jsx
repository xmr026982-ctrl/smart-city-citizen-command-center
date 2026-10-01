import React from "react";
import "./AdminLayerManager.css";

export default function AdminLayerManager({
  activeFilters,
  onFilterChange,
  showTraffic,
  onTrafficToggle,
}) {
  const layers = [
    {
      key: "cityHub",
      icon: "🏙️",
      label: "City Hub",
    },
    {
      key: "issues",
      icon: "📍",
      label: "Issues",
    },
    {
      key: "staffLocations",
      icon: "👨‍🔧",
      label: "Staff Locations",
    },
    {
      key: "nearbyPlaces",
      icon: "🏥",
      label: "Nearby Places",
    },
  ];

  return (
    <div className="admin-layer-manager">
      <div className="admin-layer-header">
        <div>
          <span className="admin-layer-icon">🗺️</span>

          <div>
            <strong>Map Layers</strong>
            <small>Admin Controls</small>
          </div>
        </div>
      </div>

      <div className="admin-layer-list">
        {layers.map((layer) => {
          const enabled = Boolean(activeFilters?.[layer.key]);

          return (
            <button
              key={layer.key}
              type="button"
              className={`admin-layer-row ${
                enabled ? "active" : ""
              }`}
              onClick={() =>
                onFilterChange(layer.key, !enabled)
              }
            >
              <span className="admin-layer-name">
                <span className="admin-layer-item-icon">
                  {layer.icon}
                </span>

                {layer.label}
              </span>

              <span
                className={`admin-layer-switch ${
                  enabled ? "on" : ""
                }`}
              >
                <span className="admin-layer-switch-dot"></span>
              </span>
            </button>
          );
        })}

        {/* Traffic is controlled separately */}
        <button
          type="button"
          className={`admin-layer-row ${
            showTraffic ? "active" : ""
          }`}
          onClick={() => onTrafficToggle(!showTraffic)}
        >
          <span className="admin-layer-name">
            <span className="admin-layer-item-icon">
              🚦
            </span>

            Traffic
          </span>

          <span
            className={`admin-layer-switch ${
              showTraffic ? "on" : ""
            }`}
          >
            <span className="admin-layer-switch-dot"></span>
          </span>
        </button>
      </div>
    </div>
  );
}