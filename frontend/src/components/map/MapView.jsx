import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  LayersControl,
  LayerGroup,
  useMap,
  useMapEvents,
  Circle,
  CircleMarker,
  Polyline,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import markerRetina from "leaflet/dist/images/marker-icon-2x.png";

import "./MapView.css";

/* =====================================================
   LEAFLET DEFAULT ICON FIX
===================================================== */

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerRetina,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/* =====================================================
   KOLKATA BOUNDS
===================================================== */

export const KOLKATA_BOUNDS = {
  south: 22.35,
  north: 22.8,
  west: 88.15,
  east: 88.6,
};

/* =====================================================
   CONSTANTS
===================================================== */

const DEFAULT_POSITION = [22.5726, 88.3639];

const NEARBY_RADIUS = 1000;

const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const OSRM_SERVER =
  "https://router.project-osrm.org/route/v1/driving";

/* =====================================================
   CATEGORY ICONS
===================================================== */

const CATEGORY_ICONS = {
  shop: "🛍️",
  hospital: "🏥",
  pharmacy: "💊",
  bank: "🏦",
  restaurant: "🍴",
  school: "🏫",
  other: "📍",
};

const getCategoryIcon = (category) =>
  CATEGORY_ICONS[category] || CATEGORY_ICONS.other;

/* =====================================================
   KOLKATA CHECK
===================================================== */

const isInsideKolkata = (latitude, longitude) => {
  return (
    latitude >= KOLKATA_BOUNDS.south &&
    latitude <= KOLKATA_BOUNDS.north &&
    longitude >= KOLKATA_BOUNDS.west &&
    longitude <= KOLKATA_BOUNDS.east
  );
};

/* =====================================================
   CATEGORY ICON CACHE
===================================================== */

const iconCache = new Map();

const createCategoryLeafletIcon = (category) => {
  if (iconCache.has(category)) {
    return iconCache.get(category);
  }

  const icon = L.divIcon({
    html: `
      <div class="leaflet-category-icon-inner">
        ${getCategoryIcon(category)}
      </div>
    `,
    className: "custom-category-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  iconCache.set(category, icon);

  return icon;
};

/* =====================================================
   ROUTE LAYER
===================================================== */

function RouteLayer({ routeCoordinates }) {
  const map = useMap();

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

  if (!routeCoordinates || routeCoordinates.length < 2) {
    return null;
  }

  return (
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
  );
}

/* =====================================================
   MAP CONTROLLER
===================================================== */

function MapController({
  onMapClick,
  targetPosition,
}) {
  const map = useMap();

  const previousPositionRef = useRef(null);

  useMapEvents({
    click(event) {
      const { lat, lng } = event.latlng;

      if (!isInsideKolkata(lat, lng)) {
        alert(
          "Please select a location inside Kolkata boundaries."
        );
        return;
      }

      onMapClick({
        position: [lat, lng],
        latitude: lat,
        longitude: lng,
      });
    },
  });

  useEffect(() => {
    if (!targetPosition) {
      return;
    }

    const [latitude, longitude] =
      targetPosition;

    const previous =
      previousPositionRef.current;

    if (
      !previous ||
      previous[0] !== latitude ||
      previous[1] !== longitude
    ) {
      map.flyTo(targetPosition, 16, {
        duration: 1.5,
      });

      previousPositionRef.current =
        targetPosition;
    }
  }, [targetPosition, map]);

  return null;
}

/* =====================================================
   MAIN MAP COMPONENT
===================================================== */

export default function MapView() {
  /* ===================================================
     BASIC
  =================================================== */

  const defaultPosition = useMemo(
    () => DEFAULT_POSITION,
    []
  );

  const MAPTILER_KEY =
    import.meta.env.VITE_MAPTILER_KEY;

  /* ===================================================
     ABORT CONTROLLERS
  =================================================== */

  const nearbyAbortRef = useRef(null);
  const searchAbortRef = useRef(null);
  const routeAbortRef = useRef(null);

  /* ===================================================
     CACHE
  =================================================== */

  const nearbyCacheRef = useRef(
    new Map()
  );

  /* ===================================================
     SEARCH STATE
  =================================================== */

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [mapTarget, setMapTarget] =
    useState(null);

  /* ===================================================
     USER LOCATION
  =================================================== */

  const [userLocation, setUserLocation] =
    useState(null);

  const [locationAccuracy, setLocationAccuracy] =
    useState(0);

  const [locationLoading, setLocationLoading] =
    useState(false);

  /* ===================================================
     SELECTED LOCATION
  =================================================== */

  const [selectedLocation, setSelectedLocation] =
    useState(null);

  const [clickedLocation, setClickedLocation] =
    useState(null);

  const [copied, setCopied] = useState(false);

  /* ===================================================
     NEARBY
  =================================================== */

  const [nearbyPlaces, setNearbyPlaces] =
    useState([]);

  const [nearbyLoading, setNearbyLoading] =
    useState(false);

  const [nearbyError, setNearbyError] =
    useState("");

  const [nearbyCategory, setNearbyCategory] =
    useState(null);

  /* ===================================================
     ROUTING
  =================================================== */

  const [routeCoordinates, setRouteCoordinates] =
    useState([]);

  const [routeLoading, setRouteLoading] =
    useState(false);

  const [routeError, setRouteError] =
    useState("");

  const [routeInfo, setRouteInfo] =
    useState(null);

  const [routeDestination, setRouteDestination] =
    useState(null);

  /* ===================================================
     CLEANUP
  =================================================== */

  useEffect(() => {
    return () => {
      nearbyAbortRef.current?.abort();
      searchAbortRef.current?.abort();
      routeAbortRef.current?.abort();
    };
  }, []);

  /* ===================================================
     FORMAT DISTANCE
  =================================================== */

  const formatDistance = useCallback(
    (meters) => {
      if (!meters) {
        return "0 m";
      }

      if (meters < 1000) {
        return `${Math.round(meters)} m`;
      }

      return `${(meters / 1000).toFixed(1)} km`;
    },
    []
  );

  /* ===================================================
     FORMAT DURATION
  =================================================== */

  const formatDuration = useCallback(
    (seconds) => {
      if (!seconds) {
        return "0 min";
      }

      const totalMinutes = Math.round(
        seconds / 60
      );

      if (totalMinutes < 60) {
        return `${totalMinutes} min`;
      }

      const hours = Math.floor(
        totalMinutes / 60
      );

      const minutes = totalMinutes % 60;

      if (minutes === 0) {
        return `${hours} hr`;
      }

      return `${hours} hr ${minutes} min`;
    },
    []
  );

  /* ===================================================
     GET ROUTE
  =================================================== */

  const getRoute = useCallback(
    async (destination) => {
      if (!destination) {
        return;
      }

      if (!userLocation) {
        alert(
          "Please click 'My Location' first to get your current location."
        );
        return;
      }

      const [
        userLatitude,
        userLongitude,
      ] = userLocation;

      const {
        latitude: destinationLatitude,
        longitude: destinationLongitude,
        name = "Destination",
      } = destination;

      if (
        !isInsideKolkata(
          destinationLatitude,
          destinationLongitude
        )
      ) {
        alert(
          "Destination is outside Kolkata boundaries."
        );
        return;
      }

      /* Cancel previous route request */
      routeAbortRef.current?.abort();

      const controller =
        new AbortController();

      routeAbortRef.current = controller;

      setRouteLoading(true);
      setRouteError("");
      setRouteCoordinates([]);
      setRouteInfo(null);

      setRouteDestination({
        latitude: destinationLatitude,
        longitude: destinationLongitude,
        name,
      });

      try {
        /*
          OSRM coordinate order:

          longitude,latitude
        */

        const url =
          `${OSRM_SERVER}/` +
          `${userLongitude},${userLatitude};` +
          `${destinationLongitude},${destinationLatitude}` +
          `?overview=full` +
          `&geometries=geojson` +
          `&steps=true`;

        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Routing server error: ${response.status}`
          );
        }

        const data = await response.json();

        if (
          data.code !== "Ok" ||
          !data.routes ||
          data.routes.length === 0
        ) {
          throw new Error(
            "No route found."
          );
        }

        const route = data.routes[0];

        /*
          OSRM:

          [longitude, latitude]

          Leaflet:

          [latitude, longitude]
        */

        const coordinates =
          route.geometry.coordinates.map(
            ([longitude, latitude]) => [
              latitude,
              longitude,
            ]
          );

        if (controller.signal.aborted) {
          return;
        }

        setRouteCoordinates(
          coordinates
        );

        setRouteInfo({
          distance: route.distance,
          duration: route.duration,
        });
      } catch (error) {
        if (
          error.name ===
          "AbortError"
        ) {
          return;
        }

        console.error(
          "Routing error:",
          error
        );

        setRouteCoordinates([]);
        setRouteInfo(null);

        setRouteError(
          "Unable to find a route. Please try again."
        );
      } finally {
        if (!controller.signal.aborted) {
          setRouteLoading(false);
        }
      }
    },
    [userLocation]
  );

  /* ===================================================
     CLEAR ROUTE
  =================================================== */

  const clearRoute = useCallback(() => {
    routeAbortRef.current?.abort();

    setRouteCoordinates([]);
    setRouteInfo(null);
    setRouteError("");
    setRouteDestination(null);
    setRouteLoading(false);
  }, []);

  /* ===================================================
     COPY COORDINATES
  =================================================== */

  const copyCoordinates = async () => {
    if (!clickedLocation) {
      return;
    }

    const coordinates =
      `${clickedLocation.latitude.toFixed(6)}, ` +
      `${clickedLocation.longitude.toFixed(6)}`;

    try {
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(
          coordinates
        );
      } else {
        const textarea =
          document.createElement(
            "textarea"
          );

        textarea.value = coordinates;

        document.body.appendChild(
          textarea
        );

        try {
          textarea.select();

          document.execCommand(
            "copy"
          );
        } finally {
          document.body.removeChild(
            textarea
          );
        }
      }

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      alert(
        "Failed to copy coordinates."
      );
    }
  };

  /* ===================================================
     BUILD OVERPASS QUERY
  =================================================== */

  const buildCategoryQuery =
    useCallback(
      (
        latitude,
        longitude,
        category
      ) => {
        let queryParts = "";

        switch (category) {
          case "shop":
            queryParts = `
              nwr["shop"](
                around:${NEARBY_RADIUS},
                ${latitude},
                ${longitude}
              );
            `;
            break;

          case "hospital":
            queryParts = `
              nwr["amenity"="hospital"](
                around:${NEARBY_RADIUS},
                ${latitude},
                ${longitude}
              );

              nwr["healthcare"="hospital"](
                around:${NEARBY_RADIUS},
                ${latitude},
                ${longitude}
              );
            `;
            break;

          case "pharmacy":
            queryParts = `
              nwr["amenity"="pharmacy"](
                around:${NEARBY_RADIUS},
                ${latitude},
                ${longitude}
              );

              nwr["healthcare"="pharmacy"](
                around:${NEARBY_RADIUS},
                ${latitude},
                ${longitude}
              );
            `;
            break;

          case "bank":
            queryParts = `
              nwr["amenity"="bank"](
                around:${NEARBY_RADIUS},
                ${latitude},
                ${longitude}
              );

              nwr["office"="financial"](
                around:${NEARBY_RADIUS},
                ${latitude},
                ${longitude}
              );
            `;
            break;

          case "restaurant":
            queryParts = `
              nwr["amenity"="restaurant"](
                around:${NEARBY_RADIUS},
                ${latitude},
                ${longitude}
              );

              nwr["amenity"="fast_food"](
                around:${NEARBY_RADIUS},
                ${latitude},
                ${longitude}
              );

              nwr["amenity"="cafe"](
                around:${NEARBY_RADIUS},
                ${latitude},
                ${longitude}
              );
            `;
            break;

          case "school":
            queryParts = `
              nwr["amenity"="school"](
                around:${NEARBY_RADIUS},
                ${latitude},
                ${longitude}
              );

              nwr["amenity"="college"](
                around:${NEARBY_RADIUS},
                ${latitude},
                ${longitude}
              );
            `;
            break;

          default:
            break;
        }

        return `
          [out:json][timeout:10];
          (
            ${queryParts}
          );
          out center tags;
        `;
      },
      []
    );

  /* ===================================================
     CONVERT OSM ELEMENT
  =================================================== */

  const convertOSMElement =
    useCallback((element) => {
      const tags = element.tags || {};

      const latitude =
        typeof element.lat === "number"
          ? element.lat
          : element.center?.lat;

      const longitude =
        typeof element.lon === "number"
          ? element.lon
          : element.center?.lon;

      if (
        typeof latitude !== "number" ||
        typeof longitude !== "number"
      ) {
        return null;
      }

      if (
        !isInsideKolkata(
          latitude,
          longitude
        )
      ) {
        return null;
      }

      let category = "other";

      if (tags.shop) {
        category = "shop";
      }

      if (
        tags.amenity === "hospital" ||
        tags.healthcare === "hospital"
      ) {
        category = "hospital";
      }

      if (
        tags.amenity === "pharmacy" ||
        tags.healthcare === "pharmacy"
      ) {
        category = "pharmacy";
      }

      if (
        tags.amenity === "bank" ||
        tags.office === "financial"
      ) {
        category = "bank";
      }

      if (
        [
          "restaurant",
          "fast_food",
          "cafe",
        ].includes(tags.amenity)
      ) {
        category = "restaurant";
      }

      if (
        ["school", "college"].includes(
          tags.amenity
        )
      ) {
        category = "school";
      }

      const name =
        tags.name?.trim() ||
        tags["name:en"]?.trim() ||
        tags["name:bn"]?.trim() ||
        tags.brand?.trim() ||
        tags.operator?.trim();

      if (!name) {
        return null;
      }

      return {
        id: `${element.type}-${element.id}`,
        name,
        category,
        latitude,
        longitude,

        address:
          tags["addr:full"] ||
          [
            tags["addr:housenumber"],
            tags["addr:street"],
            tags["addr:suburb"],
            tags["addr:city"],
          ]
            .filter(Boolean)
            .join(", "),

        phone:
          tags.phone ||
          tags["contact:phone"] ||
          "",

        website:
          tags.website ||
          tags["contact:website"] ||
          "",
      };
    }, []);

  /* ===================================================
     REMOVE DUPLICATES
  =================================================== */

  const removeDuplicates =
    useCallback((places) => {
      const unique = new Map();

      places.forEach((place) => {
        const key =
          `${place.latitude.toFixed(5)}-` +
          `${place.longitude.toFixed(5)}-` +
          `${place.name.toLowerCase()}-` +
          `${place.category}`;

        if (!unique.has(key)) {
          unique.set(key, place);
        }
      });

      return Array.from(
        unique.values()
      );
    }, []);

  /* ===================================================
     GET NEARBY PLACES
  =================================================== */

  const getNearbyPlaces =
    useCallback(
      async (
        latitude,
        longitude,
        category
      ) => {
        if (!category) {
          setNearbyPlaces([]);
          setNearbyLoading(false);
          return;
        }

        if (
          !isInsideKolkata(
            latitude,
            longitude
          )
        ) {
          setNearbyPlaces([]);
          setNearbyError(
            "Selected location is outside Kolkata region."
          );
          return;
        }

        const cacheKey =
          `${latitude.toFixed(4)}_` +
          `${longitude.toFixed(4)}_` +
          `${category}`;

        if (
          nearbyCacheRef.current.has(
            cacheKey
          )
        ) {
          setNearbyPlaces(
            nearbyCacheRef.current.get(
              cacheKey
            )
          );

          setNearbyError("");
          setNearbyLoading(false);

          return;
        }

        nearbyAbortRef.current?.abort();

        const controller =
          new AbortController();

        nearbyAbortRef.current =
          controller;

        setNearbyLoading(true);
        setNearbyError("");
        setNearbyPlaces([]);

        const overpassQuery =
          buildCategoryQuery(
            latitude,
            longitude,
            category
          );

        let successful = false;

        for (const server of OVERPASS_SERVERS) {
          try {
            const response =
              await fetch(server, {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/x-www-form-urlencoded",
                },
                body:
                  `data=${encodeURIComponent(
                    overpassQuery
                  )}`,
                signal:
                  controller.signal,
              });

            if (!response.ok) {
              throw new Error(
                `Server status ${response.status}`
              );
            }

            const data =
              await response.json();

            const places =
              (data.elements || [])
                .map(
                  convertOSMElement
                )
                .filter(Boolean);

            const uniquePlaces =
              removeDuplicates(
                places
              );

            if (
              controller.signal.aborted
            ) {
              return;
            }

            nearbyCacheRef.current.set(
              cacheKey,
              uniquePlaces
            );

            setNearbyPlaces(
              uniquePlaces
            );

            setNearbyError("");

            successful = true;

            break;
          } catch (error) {
            if (
              error.name ===
              "AbortError"
            ) {
              return;
            }
          }
        }

        if (
          controller.signal.aborted
        ) {
          return;
        }

        if (!successful) {
          setNearbyPlaces([]);

          setNearbyError(
            "Nearby services timeout. Try choosing a specific category."
          );
        }

        setNearbyLoading(false);
      },
      [
        buildCategoryQuery,
        convertOSMElement,
        removeDuplicates,
      ]
    );

  /* ===================================================
     SEARCH
  =================================================== */

  const handleSearch = async (event) => {
    event.preventDefault();

    const searchText =
      query.trim();

    if (!searchText) {
      return;
    }

    if (!MAPTILER_KEY) {
      alert(
        "MapTiler API Key is missing. Check your .env file."
      );
      return;
    }

    searchAbortRef.current?.abort();

    const controller =
      new AbortController();

    searchAbortRef.current =
      controller;

    setLoading(true);
    setResults([]);

    setNearbyPlaces([]);
    setNearbyError("");
    setNearbyCategory(null);

    try {
      const center =
        mapTarget ||
        defaultPosition;

      const url =
        `https://api.maptiler.com/geocoding/` +
        `${encodeURIComponent(
          searchText
        )}.json` +
        `?key=${MAPTILER_KEY}` +
        `&country=in` +
        `&autocomplete=true` +
        `&fuzzyMatch=true` +
        `&proximity=${center[1]},${center[0]}` +
        `&limit=10` +
        `&bbox=` +
        `${KOLKATA_BOUNDS.west},` +
        `${KOLKATA_BOUNDS.south},` +
        `${KOLKATA_BOUNDS.east},` +
        `${KOLKATA_BOUNDS.north}`;

      const response =
        await fetch(url, {
          signal:
            controller.signal,
        });

      if (!response.ok) {
        throw new Error(
          `MapTiler error: ${response.status}`
        );
      }

      const data =
        await response.json();

      const kolkataResults =
        (data.features || []).filter(
          (feature) => {
            if (
              !feature.center ||
              feature.center.length < 2
            ) {
              return false;
            }

            return isInsideKolkata(
              feature.center[1],
              feature.center[0]
            );
          }
        );

      if (
        controller.signal.aborted
      ) {
        return;
      }

      if (
        kolkataResults.length === 0
      ) {
        alert(
          "No results found within Kolkata boundaries."
        );
      } else {
        setResults(
          kolkataResults
        );
      }
    } catch (error) {
      if (
        error.name !==
        "AbortError"
      ) {
        alert(
          "Location search failed. Please try again."
        );
      }
    } finally {
      if (
        !controller.signal.aborted
      ) {
        setLoading(false);
      }
    }
  };

  /* ===================================================
     GET USER LOCATION
  =================================================== */

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      alert(
        "Geolocation is not supported by your browser."
      );
      return;
    }

    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const {
          latitude,
          longitude,
          accuracy,
        } = position.coords;

        if (
          !isInsideKolkata(
            latitude,
            longitude
          )
        ) {
          setLocationLoading(false);

          alert(
            "Your location is outside the defined Kolkata region."
          );

          return;
        }

        const location = [
          latitude,
          longitude,
        ];

        setUserLocation(location);
        setLocationAccuracy(
          accuracy
        );

        setClickedLocation(null);
        setSelectedLocation(null);

        setNearbyPlaces([]);
        setNearbyCategory(null);
        setNearbyError("");

        setMapTarget(location);

        clearRoute();

        setLocationLoading(false);
      },
      () => {
        alert(
          "Location access denied or timed out."
        );

        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  };

  /* ===================================================
     SELECT SEARCH RESULT
  =================================================== */

  const selectLocation = (
    feature
  ) => {
    if (!feature.center) {
      return;
    }

    const [
      longitude,
      latitude,
    ] = feature.center;

    if (
      !isInsideKolkata(
        latitude,
        longitude
      )
    ) {
      alert(
        "Selected location is outside the map region."
      );

      return;
    }

    const location = [
      latitude,
      longitude,
    ];

    setSelectedLocation({
      position: location,
      latitude,
      longitude,
      name:
        feature.text ||
        "Selected Location",
      address:
        feature.place_name || "",
    });

    setClickedLocation(null);
    setCopied(false);

    setNearbyPlaces([]);
    setNearbyError("");
    setNearbyCategory(null);

    setMapTarget(location);

    setQuery(
      feature.text ||
        feature.place_name ||
        ""
    );

    setResults([]);
  };

  /* ===================================================
     MAP CLICK
  =================================================== */

  const handleMapClick = (
    location
  ) => {
    setClickedLocation(location);

    setSelectedLocation(null);
    setCopied(false);

    setNearbyPlaces([]);
    setNearbyError("");
    setNearbyCategory(null);
  };

  /* ===================================================
     CLEAR SEARCH
  =================================================== */

  const clearSearch = () => {
    setQuery("");
    setResults([]);

    setSelectedLocation(null);
    setClickedLocation(null);

    setNearbyPlaces([]);
    setNearbyCategory(null);
    setNearbyError("");

    setCopied(false);
  };

  /* ===================================================
     CURRENT SELECTED POSITION
  =================================================== */

  const getCurrentSelectedPosition =
    useCallback(() => {
      if (selectedLocation) {
        return {
          latitude:
            selectedLocation.latitude,
          longitude:
            selectedLocation.longitude,
        };
      }

      if (clickedLocation) {
        return {
          latitude:
            clickedLocation.latitude,
          longitude:
            clickedLocation.longitude,
        };
      }

      if (userLocation) {
        return {
          latitude:
            userLocation[0],
          longitude:
            userLocation[1],
        };
      }

      return null;
    }, [
      selectedLocation,
      clickedLocation,
      userLocation,
    ]);

  /* ===================================================
     CATEGORY CHANGE
  =================================================== */

  const handleCategoryChange =
    (category) => {
      const location =
        getCurrentSelectedPosition();

      if (!location) {
        setNearbyError(
          "Please select a location first."
        );
        return;
      }

      setNearbyCategory(category);

      getNearbyPlaces(
        location.latitude,
        location.longitude,
        category
      );
    };

  /* ===================================================
     FILTER NEARBY
  =================================================== */

  const filteredNearbyPlaces =
    useMemo(() => {
      if (!nearbyCategory) {
        return [];
      }

      return nearbyPlaces.filter(
        (place) =>
          place.category ===
          nearbyCategory
      );
    }, [
      nearbyCategory,
      nearbyPlaces,
    ]);

  /* ===================================================
     JSX
  =================================================== */

  return (
    <div className="map-view-container">

      {/* =================================================
          MAP
      ================================================= */}

      <MapContainer
        center={defaultPosition}
        zoom={12}
        minZoom={3}
        maxZoom={18}
        scrollWheelZoom={true}
        className="leaflet-full-height"
      >

        <MapController
          onMapClick={handleMapClick}
          targetPosition={mapTarget}
        />

        {/* =================================================
            ROUTE
        ================================================= */}

        <RouteLayer
          routeCoordinates={
            routeCoordinates
          }
        />

        {/* =================================================
            MAP LAYERS
        ================================================= */}

        <LayersControl position="topright">

          {/* STREETS */}

          <LayersControl.BaseLayer
            checked
            name="Streets"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              keepBuffer={4}
            />
          </LayersControl.BaseLayer>

          {/* SATELLITE */}

          <LayersControl.BaseLayer
            name="Satellite"
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
              keepBuffer={4}
            />
          </LayersControl.BaseLayer>

          {/* CITY HUB */}

          <LayersControl.Overlay
            checked
            name="City Hub"
          >
            <LayerGroup>

              <Marker
                position={[
                  22.5726,
                  88.3639,
                ]}
              >
                <Popup>
                  <strong>
                    📍 Central Kolkata
                    Command Hub
                  </strong>

                  <br />

                  <small>
                    Kolkata Smart City
                  </small>
                </Popup>
              </Marker>

            </LayerGroup>
          </LayersControl.Overlay>

        </LayersControl>

        {/* =================================================
            USER LOCATION
        ================================================= */}

        {userLocation && (
          <>
            <Circle
              center={userLocation}
              radius={
                locationAccuracy || 40
              }
              pathOptions={{
                color: "#2563eb",
                fillColor: "#3b82f6",
                fillOpacity: 0.12,
                weight: 1.5,
                dashArray: "4, 4",
              }}
            />

            <CircleMarker
              center={userLocation}
              radius={12}
              pathOptions={{
                color: "#60a5fa",
                weight: 2,
                fillColor: "#3b82f6",
                fillOpacity: 0.4,
              }}
            />

            <CircleMarker
              center={userLocation}
              radius={6}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: "#2563eb",
                fillOpacity: 1,
              }}
            >
              <Popup>

                <div className="text-center">

                  <strong>
                    📍 Current Position
                  </strong>

                  <br />

                  <small className="text-muted">
                    Accuracy:{" "}
                    {Math.round(
                      locationAccuracy
                    )}{" "}
                    m
                  </small>

                </div>

              </Popup>
            </CircleMarker>
          </>
        )}

        {/* =================================================
            SELECTED SEARCH LOCATION
        ================================================= */}

        {selectedLocation && (
          <Marker
            position={
              selectedLocation.position
            }
          >
            <Popup>

              <strong>
                🎯{" "}
                {selectedLocation.name}
              </strong>

              <br />

              <small>
                {selectedLocation.address}
              </small>

              <br />

              <small>
                Lat:{" "}
                {selectedLocation.latitude.toFixed(
                  6
                )}
              </small>

              <br />

              <small>
                Lng:{" "}
                {selectedLocation.longitude.toFixed(
                  6
                )}
              </small>

              <br />
              <br />

              <button
                type="button"
                className="route-btn"
                onClick={() =>
                  getRoute({
                    latitude:
                      selectedLocation.latitude,
                    longitude:
                      selectedLocation.longitude,
                    name:
                      selectedLocation.name,
                  })
                }
              >
                🚗 Get Route
              </button>

            </Popup>
          </Marker>
        )}

        {/* =================================================
            CLICKED LOCATION
        ================================================= */}

        {clickedLocation && (
          <Marker
            position={
              clickedLocation.position
            }
          >
            <Popup>

              <div className="clicked-popup-wrapper">

                <strong>
                  📍 Selected Coordinates
                </strong>

                <hr className="popup-divider" />

                <div className="popup-coordinates">

                  <div>
                    <strong>
                      Latitude:
                    </strong>{" "}
                    {clickedLocation.latitude.toFixed(
                      6
                    )}
                  </div>

                  <div>
                    <strong>
                      Longitude:
                    </strong>{" "}
                    {clickedLocation.longitude.toFixed(
                      6
                    )}
                  </div>

                </div>

                <button
                  type="button"
                  className={`copy-btn ${
                    copied
                      ? "copied"
                      : ""
                  }`}
                  onClick={
                    copyCoordinates
                  }
                >
                  {copied
                    ? "✓ Copied!"
                    : "📋 Copy Coordinates"}
                </button>

                <button
                  type="button"
                  className="route-btn"
                  onClick={() =>
                    getRoute({
                      latitude:
                        clickedLocation.latitude,
                      longitude:
                        clickedLocation.longitude,
                      name:
                        "Selected Location",
                    })
                  }
                >
                  🚗 Get Route
                </button>

              </div>

            </Popup>
          </Marker>
        )}

        {/* =================================================
            NEARBY PLACES
        ================================================= */}

        {filteredNearbyPlaces.map(
          (place) => (
            <Marker
              key={place.id}
              position={[
                place.latitude,
                place.longitude,
              ]}
              icon={createCategoryLeafletIcon(
                place.category
              )}
            >
              <Popup>

                <div className="nearby-place-popup">

                  <strong>
                    {getCategoryIcon(
                      place.category
                    )}{" "}
                    {place.name}
                  </strong>

                  <br />

                  <small className="category-tag">
                    {place.category}
                  </small>

                  {place.address && (
                    <>
                      <br />

                      <small>
                        📍{" "}
                        {place.address}
                      </small>
                    </>
                  )}

                  {place.phone && (
                    <>
                      <br />

                      <small>
                        📞{" "}
                        {place.phone}
                      </small>
                    </>
                  )}

                  {place.website && (
                    <>
                      <br />

                      <a
                        href={
                          place.website.startsWith(
                            "http"
                          )
                            ? place.website
                            : `https://${place.website}`
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        🌐 Website
                      </a>
                    </>
                  )}

                  <br />
                  <br />

                  <button
                    type="button"
                    className="route-btn"
                    onClick={() =>
                      getRoute({
                        latitude:
                          place.latitude,
                        longitude:
                          place.longitude,
                        name:
                          place.name,
                      })
                    }
                  >
                    🚗 Get Route
                  </button>

                </div>

              </Popup>
            </Marker>
          )
        )}

      </MapContainer>

      {/* ===================================================
          SEARCH BOX
      =================================================== */}

      <div className="map-search-box">

        <form
          onSubmit={handleSearch}
        >

          <input
            type="text"
            placeholder="Search location in Kolkata..."
            value={query}
            onChange={(event) =>
              setQuery(
                event.target.value
              )
            }
          />

          {query && (
            <button
              type="button"
              className="clear-btn"
              onClick={
                clearSearch
              }
            >
              ❌
            </button>
          )}

          <button type="submit">
            {loading
              ? "..."
              : "🔍"}
          </button>

        </form>

        {/* =================================================
            MY LOCATION
        ================================================= */}

        <button
          type="button"
          className="my-location-btn"
          onClick={
            getUserLocation
          }
          disabled={
            locationLoading
          }
        >
          📍{" "}
          {locationLoading
            ? "Locating..."
            : "My Location"}
        </button>

        {/* =================================================
            SEARCH RESULTS
        ================================================= */}

        {results.length > 0 && (
          <div className="search-results">

            {results.map(
              (
                feature,
                index
              ) => (
                <button
                  key={
                    feature.id ||
                    index
                  }
                  type="button"
                  className="search-result-item"
                  onClick={() =>
                    selectLocation(
                      feature
                    )
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
                      {feature.place_name ||
                        ""}
                    </small>

                  </span>

                </button>
              )
            )}

          </div>
        )}

        {/* =================================================
            ROUTE INFORMATION
        ================================================= */}

        {(routeLoading ||
          routeInfo ||
          routeError) && (
          <div className="route-panel">

            <div className="route-header">

              <span>
                🛣️ Route
              </span>

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
                    onClick={
                      clearRoute
                    }
                  >
                    ✕ Clear Route
                  </button>
                </>
              )}

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
                      if (
                        routeDestination
                      ) {
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

        {/* =================================================
            NEARBY PANEL
        ================================================= */}

        {(selectedLocation ||
          userLocation ||
          clickedLocation) && (
          <div className="nearby-panel">

            <div className="nearby-header">

              <span>
                Nearby Services{" "}
                <small>
                  (
                  {NEARBY_RADIUS /
                    1000}
                  km)
                </small>
              </span>

              {nearbyLoading && (
                <span>
                  Loading...
                </span>
              )}

            </div>

            {!nearbyLoading &&
              nearbyPlaces.length ===
                0 &&
              !nearbyError && (
                <small className="nearby-hint">
                  Select a category to
                  search nearby.
                </small>
              )}

            {/* CATEGORY BUTTONS */}

            <div className="nearby-filters">

              {[
                "shop",
                "hospital",
                "pharmacy",
                "restaurant",
                "school",
                "bank",
              ].map((category) => (
                <button
                  key={category}
                  type="button"
                  className={
                    nearbyCategory ===
                    category
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    handleCategoryChange(
                      category
                    )
                  }
                >

                  {category ===
                    "shop" &&
                    "🛍️ Shops"}

                  {category ===
                    "hospital" &&
                    "🏥 Hospital"}

                  {category ===
                    "pharmacy" &&
                    "💊 Pharmacy"}

                  {category ===
                    "restaurant" &&
                    "🍴 Food"}

                  {category ===
                    "school" &&
                    "🏫 School"}

                  {category ===
                    "bank" &&
                    "🏦 Bank"}

                </button>
              ))}

            </div>

            {/* LOADING */}

            {nearbyLoading && (
              <small className="nearby-count">
                Searching{" "}
                {nearbyCategory}{" "}
                nearby...
              </small>
            )}

            {/* ERROR */}

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

            {/* RESULT COUNT */}

            {!nearbyLoading &&
              !nearbyError &&
              nearbyPlaces.length >
                0 && (
                <small className="nearby-count">
                  Found{" "}
                  {
                    filteredNearbyPlaces.length
                  }{" "}
                  places
                </small>
              )}

          </div>
        )}

      </div>
    </div>
  );
}