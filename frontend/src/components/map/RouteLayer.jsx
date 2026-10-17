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
  alternativeRoutes,
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

   const allRoutes = [
     routeCoordinates,
     ...(alternativeRoutes || []),
   ].flat();

   const bounds = L.latLngBounds(allRoutes);

   map.fitBounds(bounds, {
     padding: [60, 60],
     maxZoom: 16,
     animate: true,
     duration: 1,
   });
   }, [routeCoordinates, alternativeRoutes, map]);

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

      {alternativeRoutes?.map((route, index) => (
      <Polyline
         key={`alternative-route-${index}`}
         positions={route}
         pathOptions={{
           color: "#f97316",
           weight: 4,
           opacity: 0.6,
           dashArray: "10 10",
           lineCap: "round",
           lineJoin: "round",
         }}
      />
    ))}

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
           
          {console.log("RouteLayer routeInfo:", routeInfo)}

          {routeInfo && (
            <div style={{ marginTop: "8px" }}>
              {routeInfo.trafficDuration != null && (
                <div>
                   🚦 Traffic ETA:{" "}
                    {formatDuration
                       ? formatDuration(
                       routeInfo.trafficDuration
                    )
                     : `${Math.round(
                     routeInfo.trafficDuration / 60
                    )} min`}
                 </div>
           )} 

          {routeInfo.trafficDelay != null && (
           <div>
              🚗 Traffic Delay:{" "}
              {routeInfo.trafficDelay === 0
                 ? "No extra delay"
                 : formatDuration
                 ? formatDuration(routeInfo.trafficDelay)
                 : `${Math.round(routeInfo.trafficDelay / 60)} min`}
            </div>
          )}
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