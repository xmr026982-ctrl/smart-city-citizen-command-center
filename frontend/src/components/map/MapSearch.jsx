import { useNavigate } from "react-router-dom";
import { Search, Flag, Building2, SlidersHorizontal, Activity, Radar, MapPin, X, ArrowRight, Loader2, Route, Ruler, Clock, Square, Crosshair, Layers } from "lucide-react";
import React, { useState } from "react";
import { CATEGORY_SVG } from "./mapIcons";

/* the nearby-place categories, with the same drawn icons the map markers use */
const NEARBY = [["shop", "Shops"], ["hospital", "Hospitals"], ["pharmacy", "Pharmacies"], ["restaurant", "Food"], ["school", "Schools"], ["bank", "Banks"]];
const Glyph = ({ k }) => <span className="glyph" aria-hidden dangerouslySetInnerHTML={{ __html: CATEGORY_SVG[k] || CATEGORY_SVG.other }} />;


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

  // Live Tracking
  isTracking,
  startLiveTracking,
  stopLiveTracking,
  trackingError,

  // Route
  routeLoading,
  routeInfo,
  routeCardOpen = true, // integration: the route card can be hidden, the route line stays
  onRouteCardClose,
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
  const navigate = useNavigate(); // integration: in-app navigation
  const [showNearby, setShowNearby] = useState(false);
  const [showTracking, setShowTracking] = useState(false);

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
          <span className="search-icon"><Search size={17} /></span>

          <input
            type="text"
            placeholder="Search a zone, landmark or open issue…"
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
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}

          <button
            type="submit"
            className="search-submit-btn"
            title="Search"
            aria-label="Search"
          >
            {loading ? <Loader2 size={17} className="spin" /> : <ArrowRight size={17} />}
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
                <span className="result-icon"><MapPin size={15} /></span>

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
      navigate(query ? `/citizen/report?${query}` : "/citizen/report");
    }}
    title="Report an issue here"
    >
      <span className="tool-icon"><Flag size={18} /></span>
      <span className="tool-label">Report issue</span>
    </button>
    )}

        {/* NEARBY */}

        <button
          type="button"
          className={`map-tool-btn ${
            showNearby ? "active" : ""
          }`}
          onClick={handleNearbyClick}
          title="Nearby services"
        >
          <span className="tool-icon">
            <Building2 size={18} />
          </span>

          <span className="tool-label">
            Nearby
          </span>
        </button>

        {/* FILTERS */}

        <button
          type="button"
          className={`map-tool-btn ${
            showFilters ? "active" : ""
          }`}
          onClick={handleFilterClick}
          title="What the map shows"
        >
          <span className="tool-icon">
            <SlidersHorizontal size={18} />
          </span>

          <span className="tool-label">
            Layers
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
            <Activity size={18} />
          </span>

          <span className="tool-label">
            {showTraffic ? "Traffic on" : "Traffic"}
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
          title="Live tracking"
        >
          <span className="tool-icon">
            <Radar size={18} />
          </span>

          <span className="tool-label">
            Tracking
          </span>
        </button>
      </div>

      {/* LIVE TRACKING PANEL */}

      {showTracking && (
        <div className="map-floating-panel tracking-panel">
          <div className="floating-panel-header">
            <strong><Radar size={14} aria-hidden /> Live tracking</strong>
            <button type="button" onClick={() => setShowTracking(false)} aria-label="Close"><X size={15} /></button>
          </div>

          <div className="tracking-panel-content">
            <p>
              {isTracking
                ? "On. Your trail draws on this map, on this device only. Nothing is sent to the city."
                : "Off. Turn it on to follow your own movement on the map. Your location stays on this device."}
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
                ? <><Square size={13} aria-hidden /> Stop tracking</>
                : <><Radar size={13} aria-hidden /> Start tracking</>}
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
            <strong><Layers size={14} aria-hidden /> On the map</strong>
            <button type="button" onClick={() => setShowFilters(false)} aria-label="Close"><X size={15} /></button>
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

              <span><Building2 size={14} aria-hidden /> City command hub</span>
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

              <span><Crosshair size={14} aria-hidden /> Searched place</span>
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

              <span><MapPin size={14} aria-hidden /> Nearby places</span>
            </label>

          </div>
        </div>
      )}

      {/* NEARBY PANEL */}

      {showNearby && (
        <div className="map-floating-panel nearby-panel">
          <div className="floating-panel-header">
            <strong><Building2 size={14} aria-hidden /> Nearby services</strong>
            <button type="button" onClick={() => setShowNearby(false)} aria-label="Close"><X size={15} /></button>
          </div>

          {nearbyAvailable ? (
          <>
          <div className="nearby-radius-info">
            Within {NEARBY_RADIUS / 1000} km of {selectedLocation ? "the searched place" : clickedLocation ? "your dropped pin" : "you"}
          </div>

          <div className="nearby-filters">
            {NEARBY.map(
              ([category, label]) => (
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
                  <Glyph k={category} /> {label}
                </button>
              )
            )}
          </div>

          {nearbyLoading && (
            <div className="nearby-status">
              <Loader2 size={13} className="spin" aria-hidden /> Looking for {(NEARBY.find((n) => n[0] === nearbyCategory)?.[1] || "places").toLowerCase()} nearby…
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
                {filteredNearbyPlaces.length} found · tap a marker for directions
              </div>
            )}

          {!nearbyLoading &&
            nearbyPlaces.length === 0 &&
            !nearbyError && (
              <div className="nearby-hint">
                Pick what you need.
              </div>
            )}
          </>
          ) : (
            <p className="nearby-hint">Search a place, drop a pin on the map, or use My location first. Nearby services are found around that spot.</p>
          )}
        </div>
      )}

      {/* ROUTE PANEL */}

      {routeCardOpen && (routeLoading ||
        routeInfo ||
        routeError) && (
        <div className="map-floating-panel route-panel">
          <div className="floating-panel-header">
            <strong><Route size={14} aria-hidden /> Route</strong>

            {routeLoading && (
              <span className="calc"><Loader2 size={12} className="spin" aria-hidden /> Working it out</span>
            )}
            {onRouteCardClose ? (
              <button type="button" onClick={onRouteCardClose} aria-label="Hide the route card" title="Hide · tap the destination pin to bring it back"><X size={15} /></button>
            ) : null}
          </div>

          {routeLoading && (
            <div className="route-loading">
              Finding the best driving route…
            </div>
          )}

          {!routeLoading && routeInfo && (
            <>
              <div className="route-destination">
                <MapPin size={13} aria-hidden /> {routeDestination?.name || "Destination"}
              </div>

              <div className="route-details">
                <span>
                  <Ruler size={13} aria-hidden /> {formatDistance(
                    routeInfo.distance
                  )}
                </span>

                <span>
                  <Clock size={13} aria-hidden /> {formatDuration(
                    routeInfo.duration
                  )}
                </span>
              </div>

              <button
                type="button"
                className="clear-route-btn"
                onClick={clearRoute}
              >
                <X size={13} aria-hidden /> Clear route
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