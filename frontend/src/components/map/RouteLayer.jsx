import { useEffect } from "react";
import {
  Polyline,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";

function RouteLayer({
  routeCoordinates,
  routeDestination,
  routeInfo,
  formatDistance,
  formatDuration,
}) {
  const map = useMap();

  /* ===================================================
     FIT MAP TO ROUTE
  =================================================== */

  useEffect(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) {
      return;
    }

    const bounds = L.latLngBounds(routeCoordinates);

    map.fitBounds(bounds, {
      padding: [60, 60],
      maxZoom: 16,
      animate: true,
      duration: 1,
    });
  }, [routeCoordinates, map]);

  /* ===================================================
     NO ROUTE
  =================================================== */

  if (!routeCoordinates || routeCoordinates.length < 2) {
    return null;
  }

  /* ===================================================
     START & DESTINATION
  =================================================== */

  const startPoint = routeCoordinates[0];

  const destinationPoint =
    routeCoordinates[routeCoordinates.length - 1];

  return (
    <>
      {/* =================================================
          ROUTE LINE
      ================================================= */}

      <Polyline
        positions={routeCoordinates}
        pathOptions={{
          color: "#2563eb",
          weight: 6,
          opacity: 0.85,
          lineCap: "round",
          lineJoin: "round",
        }}
      />

      {/* =================================================
          START LOCATION
      ================================================= */}

      <Marker position={startPoint}>
        <Popup>
          <strong>📍 Start Location</strong>
        </Popup>
      </Marker>

      {/* =================================================
          DESTINATION
      ================================================= */}

      <Marker position={destinationPoint}>
        <Popup>
          <strong>🏁 Destination</strong>

          {routeDestination?.name && (
            <div style={{ marginTop: "6px" }}>
              {routeDestination.name}
            </div>
          )}

          {routeInfo && (
            <div style={{ marginTop: "8px" }}>
              {routeInfo.distance != null && (
                <div>
                  📏{" "}
                  {formatDistance
                    ? formatDistance(
                        routeInfo.distance
                      )
                    : `${(
                        routeInfo.distance / 1000
                      ).toFixed(2)} km`}
                </div>
              )}

              {routeInfo.duration != null && (
                <div>
                  ⏱️{" "}
                  {formatDuration
                    ? formatDuration(
                        routeInfo.duration
                      )
                    : `${Math.round(
                        routeInfo.duration / 60
                      )} min`}
                </div>
              )}
            </div>
          )}
        </Popup>
      </Marker>
    </>
  );
}

export default RouteLayer;