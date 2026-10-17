import React, { useState } from "react";
import { getProfileIcon } from "../../store/authStore";


function MapSearch({
  role,

  // Search
  query,
  setQuery,
  handleSearch,
  clearSearch,
  loading,
  results,
  selectLocation,

  // My Location
  getUserLocation,
  locationLoading,

  // Live Tracking
  isTracking,
  startLiveTracking,
  stopLiveTracking,
  trackingError,

  // Route
  routeLoading,
  routeInfo,
  routeDestination,
  routeError,
  getRoute,
  clearRoute,
  formatDistance,
  formatDuration,

  // Nearby
  selectedLocation,
  userLocation,
  clickedLocation,
  nearbyCategory,
  nearbyLoading,
  nearbyPlaces,
  nearbyError,
  filteredNearbyPlaces,
  handleCategoryChange,
  getCurrentSelectedPosition,
  getNearbyPlaces,
  NEARBY_RADIUS,

  // Optional
  onReportIssue,

  // Profile / Session
  showProfile,
  setShowProfile,
  currentUser,
  onLogout,

  // Traffic
  showTraffic,
  setShowTraffic,

  // Filters
  showFilters,
  setShowFilters,
  handleFilterClick,
  activeFilters,
  handleFilterChange,
}) {
  const [showNearby, setShowNearby] = useState(false);
  const [showTracking, setShowTracking] = useState(false);

  const profileIcon = getProfileIcon(currentUser);

  const nearbyAvailable =
    selectedLocation ||
    userLocation ||
    clickedLocation;

  const handleNearbyClick = () => {
    setShowNearby((previous) => !previous);
    setShowFilters(false);
  };

  const handleTrackingClick = () => {
    setShowTracking((previous) => !previous);
  };

  const handleTrafficClick = () => {
    if (setShowTraffic) {
      setShowTraffic((previous) => !previous);
    }
  };

  return (
    <>
      {/* TOP SEARCH */}

      <div className="map-search-box">
        <form onSubmit={handleSearch}>
          <span className="search-icon">
            🔎
          </span>

          <input
            type="text"
            placeholder="Search location in Kolkata..."
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
          />

          {query && (
            <button
              type="button"
              className="clear-btn"
              onClick={clearSearch}
              title="Clear search"
            >
              ✕
            </button>
          )}

          <button
            type="submit"
            className="search-submit-btn"
            title="Search"
          >
            {loading ? "⏳" : "➤"}
          </button>
        </form>

        {/* SEARCH RESULTS */}

        {results.length > 0 && (
          <div className="search-results">
            {results.map((feature, index) => (
              <button
                key={feature.id || index}
                type="button"
                className="search-result-item"
                onClick={() =>
                  selectLocation(feature)
                }
              >
                <span className="result-icon">
                  📍
                </span>

                <span className="result-info">
                  <strong>
                    {feature.text ||
                      "Unknown Location"}
                  </strong>

                  <small>
                    {feature.place_name || ""}
                  </small>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* LEFT TOOLBAR */}

      <div className="map-left-toolbar">

        {/* REPORT ISSUE - USER ONLY */}

       {role === "user" && (
       <button
        type="button"
        className="map-tool-btn"
        onClick={() => {
        const location = getCurrentSelectedPosition
          ? getCurrentSelectedPosition()
          : null;

        // Parent can override navigation
        if (onReportIssue) {
        if (location) {
          onReportIssue({
            latitude: location.latitude,
            longitude: location.longitude,
          });
        } else {
          onReportIssue();
        }
        return;
      }

      // Open citizen report form; include coords when available
      const params = new URLSearchParams();
      if (location) {
        params.set("lat", String(location.latitude));
        params.set("lng", String(location.longitude));
      }

      const query = params.toString();
      window.location.assign(
        query ? `/citizen/report?${query}` : "/citizen/report"
      );
    }}
    title="Report Issue"
    >
      <span className="tool-icon">📝</span>
      <span className="tool-label">Report Issue</span>
    </button>
    )}

        {/* PROFILE */}

        <button
          type="button"
          className={`map-tool-btn ${showProfile ? "active" : ""}`}
          onClick={() => setShowProfile((prev) => !prev)}
          title="My Profile"
        >
          <span className="tool-icon">
            <img
              src={profileIcon}
              alt="Profile"
              className="map-profile-icon"
            />
          </span>
          <span className="tool-label">My Profile</span>
        </button>

        {/* NEARBY */}

        <button
          type="button"
          className={`map-tool-btn ${
            showNearby ? "active" : ""
          }`}
          onClick={handleNearbyClick}
          title="Nearby Places"
        >
          <span className="tool-icon">
            🏥
          </span>

          <span className="tool-label">
            Nearby Places
          </span>
        </button>

        {/* FILTERS */}

        <button
          type="button"
          className={`map-tool-btn ${
            showFilters ? "active" : ""
          }`}
          onClick={handleFilterClick}
          title="Filters"
        >
          <span className="tool-icon">
            🗂️
          </span>

          <span className="tool-label">
            Filters
          </span>
        </button>

        {/* TRAFFIC */}

        <button
          type="button"
          className={`map-tool-btn ${
            showTraffic ? "active" : ""
          }`}
          onClick={handleTrafficClick}
          title={
            showTraffic
              ? "Hide Traffic"
              : "Show Traffic"
          }
        >
          <span className="tool-icon">
            🚦
          </span>

          <span className="tool-label">
            {showTraffic
              ? "Traffic ON"
              : "Traffic"}
          </span>
        </button>

        {/* LIVE TRACKING */}

        <button
          type="button"
          className={`map-tool-btn tracking-tool ${
            isTracking
              ? "tracking-active"
              : ""
          }`}
          onClick={handleTrackingClick}
          title="Live Tracking"
        >
          <span className="tool-icon">
            {isTracking ? "🟢" : "🔴"}
          </span>

          <span className="tool-label">
            Live Tracking
          </span>
        </button>
      </div>

      {/* PROFILE PANEL — name + email only */}

      {showProfile && (
        <div className="map-floating-panel profile-panel">
          <div className="floating-panel-header">
            <strong>My Profile</strong>
            <button
              type="button"
              onClick={() => setShowProfile(false)}
              aria-label="Close profile"
            >
              ✕
            </button>
          </div>

          <div className="profile-panel-content">
            <div className="profile-avatar">
              <img
                src={profileIcon}
                alt="Profile"
                className="profile-avatar-image"
              />
            </div>

            <h3 className="profile-name">
              {currentUser?.name || "My Account"}
            </h3>

            <p className="profile-email">
              {currentUser?.email || "Signed in to Smart City Command Center"}
            </p>

            <button
              type="button"
              className="profile-logout-btn"
              onClick={onLogout}
            >
              Log Out
            </button>
          </div>
        </div>
      )}

      {/* LIVE TRACKING PANEL */}

      {showTracking && (
        <div className="map-floating-panel tracking-panel">
          <div className="floating-panel-header">
            <strong>
              📡 Live Tracking
            </strong>

            <button
              type="button"
              onClick={() =>
                setShowTracking(false)
              }
            >
              ✕
            </button>
          </div>

          <div className="tracking-panel-content">
            <p>
              {isTracking
                ? "🟢 Your location is being tracked."
                : "Live location tracking is currently off."}
            </p>

            <button
              type="button"
              className={
                isTracking
                  ? "tracking-action stop"
                  : "tracking-action start"
              }
              onClick={
                isTracking
                  ? stopLiveTracking
                  : startLiveTracking
              }
            >
              {isTracking
                ? "⏹ Stop Live Tracking"
                : "🔴 Start Live Tracking"}
            </button>

            {trackingError && (
              <div className="tracking-error">
                {trackingError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FILTER PANEL */}

      {showFilters && (
        <div className="map-floating-panel filters-panel">
          <div className="floating-panel-header">
            <strong>
              🗂️ Map Filters
            </strong>

            <button
              type="button"
              onClick={() =>
                setShowFilters(false)
              }
            >
              ✕
            </button>
          </div>

          <div className="filter-content">
            <label className="filter-option">
              <input
                type="checkbox"
                checked={activeFilters.cityHub}
                onChange={() =>
                  handleFilterChange("cityHub")
                }
              />

              <span>
                🏙️ City Hub
              </span>
            </label>

            <label className="filter-option">
              <input
                type="checkbox"
                checked={
                  activeFilters.selectedLocation
                }
                onChange={() =>
                  handleFilterChange(
                    "selectedLocation"
                  )
                }
              />

              <span>
                📍 Selected Location
              </span>
            </label>

            <label className="filter-option">
              <input
                type="checkbox"
                checked={
                  activeFilters.nearbyPlaces
                }
                onChange={() =>
                  handleFilterChange(
                    "nearbyPlaces"
                  )
                }
              />

              <span>
                🏥 Nearby Places
              </span>
            </label>

            {/*
            <label className="filter-option">
              <input
                type="checkbox"
                checked={activeFilters.issues}
                onChange={() =>
                  handleFilterChange("issues")
                }
              />

              <span>
                🚨 Issues
              </span>
            </label>
            */}
          </div>
        </div>
      )}

      {/* NEARBY PANEL */}

      {showNearby && nearbyAvailable && (
        <div className="map-floating-panel nearby-panel">
          <div className="floating-panel-header">
            <strong>
              🏥 Nearby Services
            </strong>

            <button
              type="button"
              onClick={() =>
                setShowNearby(false)
              }
            >
              ✕
            </button>
          </div>

          <div className="nearby-radius-info">
            Within {NEARBY_RADIUS / 1000} km
          </div>

          <div className="nearby-filters">
            {[
              ["shop", "🛍️", "Shops"],
              ["hospital", "🏥", "Hospital"],
              ["pharmacy", "💊", "Pharmacy"],
              ["restaurant", "🍴", "Food"],
              ["school", "🏫", "School"],
              ["bank", "🏦", "Bank"],
            ].map(
              ([category, icon, label]) => (
                <button
                  key={category}
                  type="button"
                  className={
                    nearbyCategory === category
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    handleCategoryChange(
                      category
                    )
                  }
                >
                  {icon} {label}
                </button>
              )
            )}
          </div>

          {nearbyLoading && (
            <div className="nearby-status">
              ⏳ Searching {nearbyCategory} nearby...
            </div>
          )}

          {!nearbyLoading && nearbyError && (
            <div className="nearby-error-wrapper">
              <span>
                {nearbyError}
              </span>

              <button
                type="button"
                className="retry-btn"
                onClick={() => {
                  const location =
                    getCurrentSelectedPosition();

                  if (
                    location &&
                    nearbyCategory
                  ) {
                    getNearbyPlaces(
                      location.latitude,
                      location.longitude,
                      nearbyCategory
                    );
                  }
                }}
              >
                Retry
              </button>
            </div>
          )}

          {!nearbyLoading &&
            !nearbyError &&
            nearbyPlaces.length > 0 && (
              <div className="nearby-count">
                Found{" "}
                {filteredNearbyPlaces.length}{" "}
                places
              </div>
            )}

          {!nearbyLoading &&
            nearbyPlaces.length === 0 &&
            !nearbyError && (
              <div className="nearby-hint">
                Select a category to search
                nearby places.
              </div>
            )}
        </div>
      )}

      {/* ROUTE PANEL */}

      {(routeLoading ||
        routeInfo ||
        routeError) && (
        <div className="map-floating-panel route-panel">
          <div className="floating-panel-header">
            <strong>
              🛣️ Route
            </strong>

            {routeLoading && (
              <span>
                Calculating...
              </span>
            )}
          </div>

          {routeLoading && (
            <div className="route-loading">
              Finding the best driving route...
            </div>
          )}

          {!routeLoading && routeInfo && (
            <>
              <div className="route-destination">
                📍{" "}
                {routeDestination?.name ||
                  "Destination"}
              </div>

              <div className="route-details">
                <span>
                  📏{" "}
                  {formatDistance(
                    routeInfo.distance
                  )}
                </span>

                <span>
                  ⏱️{" "}
                  {formatDuration(
                    routeInfo.duration
                  )}
                </span>
              </div>

              <button
                type="button"
                className="clear-route-btn"
                onClick={clearRoute}
              >
                ✕ Clear Route
              </button>
            </>
          )}

          {!routeLoading && routeError && (
            <div className="route-error">
              <span>
                {routeError}
              </span>

              <button
                type="button"
                className="retry-route-btn"
                onClick={() => {
                  if (routeDestination) {
                    getRoute(
                      routeDestination
                    );
                  }
                }}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default MapSearch;