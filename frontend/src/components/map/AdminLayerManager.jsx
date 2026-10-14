import React from "react";
import "./AdminLayerManager.css";

export default function AdminLayerManager({
  activeFilters,
  onFilterChange,
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
  ];

  return (
    <div
      className="admin-layer-manager"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="admin-layer-header">
        <div className="admin-layer-header-content">
          <span className="admin-layer-icon">🗺️</span>
          <div>
            <strong>Map Layers</strong>
            <small>Admin Controls</small>
          </div>
        </div>
      </div>

      {/* Layer List */}
      <div className="admin-layer-list">
        {layers.map((layer) => {
          const enabled = Boolean(activeFilters?.[layer.key]);

          return (
            <button
              key={layer.key}
              type="button"
              className={`admin-layer-row ${enabled ? "active" : ""}`}
              onClick={() => onFilterChange(layer.key)}
            >
              <span className="admin-layer-name">
                <span className="admin-layer-item-icon">{layer.icon}</span>
                {layer.label}
              </span>

              <span className={`admin-layer-switch ${enabled ? "on" : ""}`}>
                <span className="admin-layer-switch-dot"></span>
              </span>
            </button>
          );
        })}
        {/* Traffic button removed */}
      </div>
    </div>
  );
}