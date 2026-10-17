import React, { useMemo, useState } from "react";

function LocationPlaylist({ userLocation }) {
  const [travelMode, setTravelMode] = useState("driving");
  const [collapsed, setCollapsed] = useState(false);

  const playlists = {
    driving: {
      title: "Bangla Road Trip",
      description: "Bangla songs for your road journey",
      url: "https://open.spotify.com/playlist/40OXf8qIOx78nXPze8CZmX",
      icon: "🚗",
    },

    walking: {
      title: "Bengali Chill & Travel",
      description: "Relaxing Bengali songs for walking",
      url: "https://open.spotify.com/playlist/4RCEAQ6Git9FWfaGfN9K4t",
      icon: "🚶",
    },

    transit: {
      title: "Bangla Rock Journey",
      description: "Bangla rock for your daily commute",
      url: "https://open.spotify.com/playlist/37i9dQZF1DX3MUQrfTBXMY",
      icon: "🚆",
    },
  };

  const playlist = useMemo(
    () => playlists[travelMode],
    [travelMode]
  );

  if (!userLocation) {
    return (
      <div className="playlist-card">
        <div className="playlist-header">
          <div className="playlist-title">
            🎵 Bengali Travel Playlist
          </div>

          <button
            type="button"
            className="playlist-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((prev) => !prev);
            }}
          >
            −
          </button>
        </div>

        {!collapsed && (
          <div className="playlist-message">
            📍 Use <strong>My Location</strong> to get
            playlist suggestions.
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`playlist-card ${
        collapsed ? "playlist-collapsed" : ""
      }`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="playlist-header">
        <div className="playlist-title">
          🎵 Bengali Travel Playlist
        </div>

        <button
          type="button"
          className="playlist-toggle"
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed((prev) => !prev);
          }}
          title={collapsed ? "Expand" : "Minimize"}
        >
          {collapsed ? "+" : "−"}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Location */}
          <div className="playlist-location">
            📍 Current Location
          </div>

          {/* Travel Mode */}
          <div className="playlist-mode-title">
            Travel Mode
          </div>

          <div className="playlist-modes">
            <button
              type="button"
              className={travelMode === "driving" ? "active" : ""}
              onClick={() => setTravelMode("driving")}
            >
              🚗 Driving
            </button>

            <button
              type="button"
              className={travelMode === "walking" ? "active" : ""}
              onClick={() => setTravelMode("walking")}
            >
              🚶 Walking
            </button>

            <button
              type="button"
              className={travelMode === "transit" ? "active" : ""}
              onClick={() => setTravelMode("transit")}
            >
              🚆 Transit
            </button>
          </div>

          {/* Playlist */}
          <div className="playlist-result">
            <div className="playlist-icon">
              {playlist.icon}
            </div>

            <div className="playlist-info">
              <strong>{playlist.title}</strong>

              <span>{playlist.description}</span>
            </div>
          </div>

          {/* Spotify */}
          <a
            href={playlist.url}
            target="_blank"
            rel="noopener noreferrer"
            className="spotify-button"
            onClick={(e) => e.stopPropagation()}
          >
            ▶ Open Spotify
          </a>
        </>
      )}
    </div>
  );
}

export default LocationPlaylist;