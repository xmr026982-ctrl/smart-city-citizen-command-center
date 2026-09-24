import React, { useState } from "react";

function MapSearch({
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
  onSelectLocation,

  // Traffic
  showTraffic,
  setShowTraffic,
}) {
  const [showNearby, setShowNearby] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showTracking, setShowTracking] = useState(false);

  const nearbyAvailable =
    selectedLocation ||
    userLocation ||
    clickedLocation;

  const handleNearbyClick = () => {
    setShowNearby((previous) => !previous);
    setShowFilters(false);
  };

  const handleFilterClick = () => {
    setShowFilters((previous) => !previous);
    setShowNearby(false);
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
      {/* =====================================================
          TOP SEARCH
      ===================================================== */}

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


        {/* ===================================================
            SEARCH RESULTS
        =================================================== */}

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


      {/* =====================================================
          LEFT TOOLBAR
      ===================================================== */}

      <div className="map-left-toolbar">

        {/* =================================================
            REPORT ISSUE
        ================================================= */}

        <button
          type="button"
          className="map-tool-btn"
          onClick={() => {

            if (onReportIssue) {
              onReportIssue();
            } else {
              alert(
                "Report Issue feature will be connected here."
              );
            }

          }}
          title="Report Issue"
        >

          <span className="tool-icon">
            📝
          </span>

          <span className="tool-label">
            Report Issue
          </span>

        </button>


        {/* =================================================
            NEARBY
        ================================================= */}

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


        {/* =================================================
            FILTERS
        ================================================= */}

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


        {/* =================================================
            TRAFFIC
        ================================================= */}

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


        {/* =================================================
            LIVE TRACKING
        ================================================= */}

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
            {isTracking
              ? "🟢"
              : "🔴"}
          </span>

          <span className="tool-label">
            Live Tracking
          </span>

        </button>

      </div>


      {/* =====================================================
          LIVE TRACKING PANEL
      ===================================================== */}

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


      {/* =====================================================
          FILTER PANEL
      ===================================================== */}

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
                defaultChecked
              />

              <span>
                🏙️ City Hub
              </span>

            </label>


            <label className="filter-option">

              <input
                type="checkbox"
                defaultChecked
              />

              <span>
                📍 Selected Location
              </span>

            </label>


            <label className="filter-option">

              <input
                type="checkbox"
                defaultChecked
              />

              <span>
                🏥 Nearby Places
              </span>

            </label>


            <label className="filter-option">

              <input
                type="checkbox"
                defaultChecked
              />

              <span>
                🚨 Issues
              </span>

            </label>

          </div>

        </div>
      )}


      {/* =====================================================
          NEARBY PANEL
      ===================================================== */}

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

            Within{" "}
            {NEARBY_RADIUS / 1000} km

          </div>


          {/* =================================================
              NEARBY CATEGORY BUTTONS
          ================================================= */}

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


          {/* =================================================
              NEARBY LOADING
          ================================================= */}

          {nearbyLoading && (
            <div className="nearby-status">

              ⏳ Searching{" "}
              {nearbyCategory} nearby...

            </div>
          )}


          {/* =================================================
              NEARBY ERROR
          ================================================= */}

          {!nearbyLoading &&
            nearbyError && (

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


          {/* =================================================
              NEARBY COUNT
          ================================================= */}

          {!nearbyLoading &&
            !nearbyError &&
            nearbyPlaces.length > 0 && (

              <div className="nearby-count">

                Found{" "}
                {filteredNearbyPlaces.length}{" "}
                places

              </div>

            )}


          {/* =================================================
              NEARBY HINT
          ================================================= */}

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


      {/* =====================================================
          ROUTE PANEL
      ===================================================== */}

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


          {/* =================================================
              ROUTE LOADING
          ================================================= */}

          {routeLoading && (

            <div className="route-loading">

              Finding the best driving route...

            </div>

          )}


          {/* =================================================
              ROUTE INFO
          ================================================= */}

          {!routeLoading &&
            routeInfo && (

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


          {/* =================================================
              ROUTE ERROR
          ================================================= */}

          {!routeLoading &&
            routeError && (

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