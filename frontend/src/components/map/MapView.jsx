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
  Polyline,
} from "react-leaflet";

import {
  KOLKATA_BOUNDS,
  isInsideKolkata,
} from "./MapUtils";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import markerRetina from "leaflet/dist/images/marker-icon-2x.png";

import "./MapView.css";

import MapSearch from "./MapSearch";
import MapControls from "./MapControls";
import RouteLayer from "./RouteLayer";
import MyLocation from "./MyLocation";
import NearbyPlaces from "./NearbyPlaces";
import TrafficLayer from "./TrafficLayer";
import LocationPlaylist from "./LocationPlaylist";



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
  const trackingWatchRef = useRef(null);

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
     LIVE TRACKING
  =================================================== */

  const [isTracking, setIsTracking] =
    useState(false);

  const [trackingPath, setTrackingPath] =
    useState([]);

  const [trackingError, setTrackingError] =
    useState("");

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
     TRAFFIC
  =================================================== */

  const [showTraffic, setShowTraffic] =
    useState(false);


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

      if (trackingWatchRef.current !== null) {
        navigator.geolocation?.clearWatch(
          trackingWatchRef.current
        );
        trackingWatchRef.current = null;
      }
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
    alert("Geolocation is not supported by your browser.");
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

      // My Location-এর জন্য কোনো Kolkata boundary check নেই
      const location = [latitude, longitude];

      setUserLocation(location);
      setLocationAccuracy(accuracy);

      // আগের selected/clicked location clear
      setClickedLocation(null);
      setSelectedLocation(null);

      // Nearby data clear
      setNearbyPlaces([]);
      setNearbyCategory(null);
      setNearbyError("");

      // Map current location-এ যাবে
      setMapTarget(location);

      // পুরনো route clear
      clearRoute();

      setLocationLoading(false);
    },
    () => {
      alert("Location access denied or timed out.");
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
     START LIVE TRACKING
  =================================================== */

  const startLiveTracking = () => {
    if (!navigator.geolocation) {
      setTrackingError(
        "Geolocation is not supported by your browser."
      );
      return;
    }

    if (trackingWatchRef.current !== null) {
      return;
    }

    setTrackingError("");
    setIsTracking(true);
    setTrackingPath([]);

    trackingWatchRef.current =
      navigator.geolocation.watchPosition(
        (position) => {
          const {
            latitude,
            longitude,
            accuracy,
          } = position.coords;

          const location = [latitude, longitude];

          setUserLocation(location);
          setLocationAccuracy(accuracy);
          setMapTarget(location);
          setTrackingError("");

          setTrackingPath((previousPath) => {
            const lastPoint =
              previousPath[previousPath.length - 1];

            if (
              lastPoint &&
              lastPoint[0] === latitude &&
              lastPoint[1] === longitude
            ) {
              return previousPath;
            }

            return [...previousPath, location];
          });
        },
        (error) => {
          let message =
            "Unable to track your live location.";

          if (error.code === 1) {
            message =
              "Location permission was denied.";
          } else if (error.code === 2) {
            message =
              "Your current location is unavailable.";
          } else if (error.code === 3) {
            message =
              "Live location request timed out.";
          }

          setTrackingError(message);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000,
        }
      );
  };

  /* ===================================================
     STOP LIVE TRACKING
  =================================================== */

  const stopLiveTracking = () => {
    if (trackingWatchRef.current !== null) {
      navigator.geolocation.clearWatch(
        trackingWatchRef.current
      );

      trackingWatchRef.current = null;
    }

    setIsTracking(false);
    setTrackingError("");
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
         zoomControl={false}
         minZoom={3}
         maxZoom={18}
         scrollWheelZoom={true}
           className="leaflet-full-height"
          >

        <MapControls
          onMapClick={handleMapClick}
          getUserLocation={getUserLocation}
          locationLoading={locationLoading}
        />

        <LocationPlaylist userLocation={userLocation} />

        {showTraffic && <TrafficLayer />}
        
        {/* =================================================
            ROUTE
        ================================================= */}

        <RouteLayer
          routeCoordinates={routeCoordinates}
          routeDestination={routeDestination}
          routeInfo={routeInfo}
          formatDistance={formatDistance}
          formatDuration={formatDuration}
        />

        {/* =================================================
            LIVE TRACKING PATH
        ================================================= */}

        {trackingPath.length > 1 && (
          <Polyline
            positions={trackingPath}
            pathOptions={{
              color: "#2563eb",
              weight: 5,
              opacity: 0.75,
              lineCap: "round",
              lineJoin: "round",
              dashArray: "8, 8",
            }}
          />
        )}

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

           {/* TERRAIN */}

          <LayersControl.BaseLayer
            name="Terrain"
          >
         <TileLayer
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            attribution='Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap'
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

        <MyLocation
          userLocation={userLocation}
          locationAccuracy={locationAccuracy}
        />

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

        <NearbyPlaces
            places={filteredNearbyPlaces}
            createCategoryLeafletIcon={createCategoryLeafletIcon}
            getRoute={getRoute}
        />

      </MapContainer>

   
     
      <MapSearch 
  query={query} 
  setQuery={setQuery} 
  handleSearch={handleSearch} 
  clearSearch={clearSearch} 
  loading={loading} 
  getUserLocation={getUserLocation} 
  locationLoading={locationLoading} 
  isTracking={isTracking} 
  startLiveTracking={startLiveTracking} 
  stopLiveTracking={stopLiveTracking} 
  trackingError={trackingError} 
  results={results} 
  selectLocation={selectLocation} 
  routeLoading={routeLoading} 
  routeInfo={routeInfo} 
  routeDestination={routeDestination} 
  routeError={routeError} 
  getRoute={getRoute} 
  clearRoute={clearRoute} 
  formatDistance={formatDistance} 
  formatDuration={formatDuration} 
  selectedLocation={selectedLocation} 
  userLocation={userLocation} 
  clickedLocation={clickedLocation} 
  nearbyCategory={nearbyCategory} 
  nearbyLoading={nearbyLoading} 
  nearbyPlaces={nearbyPlaces} 
  nearbyError={nearbyError} 
  filteredNearbyPlaces={filteredNearbyPlaces} 
  handleCategoryChange={handleCategoryChange} 
  getCurrentSelectedPosition={getCurrentSelectedPosition} 
  getNearbyPlaces={getNearbyPlaces} 
  NEARBY_RADIUS={NEARBY_RADIUS}

  // Traffic
  showTraffic={showTraffic}
  setShowTraffic={setShowTraffic}
/>
    </div>
  );
}