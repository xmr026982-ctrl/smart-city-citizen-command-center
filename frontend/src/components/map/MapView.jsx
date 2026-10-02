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
  useMap,
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
import "./AdminIssueDetailsPanel.css";

import MapSearch from "./MapSearch";
import MapControls from "./MapControls";
import RouteLayer from "./RouteLayer";
import MyLocation from "./MyLocation";
import NearbyPlaces from "./NearbyPlaces";
import TrafficLayer from "./TrafficLayer";
import LocationPlaylist from "./LocationPlaylist";
import LayerSelector from "./LayerSelector";
import AdminLayerManager from "./AdminLayerManager";
import ZONE_BOUNDARIES from "./zoneBoundaries";



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
   ZONE CONFIG
===================================================== */

const ZONE_CONFIG = {
  Shyambazar: {
    center: [22.599, 88.373],
    bounds: null,
  },

  "B.B.D. Bagh": {
    center: [22.573, 88.348],
    bounds: null,
  },

  Ballygunge: {
    center: [22.527, 88.363],
    bounds: null,
  },

  "College Street": {
    center: [22.575, 88.363],
    bounds: null,
  },

  "B.P Township": {
    center: [22.484, 88.405],
    bounds: null,
  },

  Dharmatala: {
    center: [22.562, 88.352],
    bounds: null,
  },
  };

const isInsideZone = (latitude, longitude, bounds) => {
  if (!bounds) {
    return true;
  }

  const [[south, west], [north, east]] = bounds;

  return (
    latitude >= south &&
    latitude <= north &&
    longitude >= west &&
    longitude <= east
  );
};

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

  const getStaffIcon = (status) => {
  let icon = "👨‍🔧";

  if (status === "Active") {
    icon = "🟢👨‍🔧";
  } else if (status === "Busy") {
    icon = "🟠👨‍🔧";
  } else if (status === "Offline") {
    icon = "🔴👨‍🔧";
  }

  return L.divIcon({
    className: "staff-location-icon",
    html: `<div style="font-size: 26px; white-space: nowrap;">${icon}</div>`,
    iconSize: [55, 40],
    iconAnchor: [27, 40],
  });
};

/* =====================================================
   PICK MODE CONTROLLER
===================================================== */

function PickModeController({ center, enabled }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !center) {
      return;
    }

    map.setView(center, 14);
  }, [map, center, enabled]);

  return null;
 }

 export default function MapView({ role = "user", onReportIssue }) {
  /* ===================================================
                   BASIC
  =================================================== */

  const defaultPosition = useMemo(
    () => DEFAULT_POSITION,
    []
  );

  const MAPTILER_KEY =
    import.meta.env.VITE_MAPTILER_KEY;

  const [baseLayer, setBaseLayer] = useState({
   id: "Streets",
   url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
   attribution: "&copy; OpenStreetMap contributors",
   });

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
                        MAP FILTERS
    =================================================== */

  const [showFilters, setShowFilters] =
    useState(false);

  const [activeFilters, setActiveFilters] = useState({
    cityHub: true,
    selectedLocation: true,
    nearbyPlaces: true,
    issues: true,
    staffLocations: true, 
  });

    const handleFilterClick = () => {
    setShowFilters((previous) => !previous);
  };

    const handleFilterChange = (filter) => {
    setActiveFilters((previous) => ({
      ...previous,
      [filter]: !previous[filter],
    }));
 };
  
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
  
  const [alternativeRoutes, setAlternativeRoutes] = 
    useState([]);

  const [routeError, setRouteError] =
    useState("");

  const [routeInfo, setRouteInfo] =
    useState(null);

  const [routeDestination, setRouteDestination] =
    useState(null);

  const [showAssignedIssues, setShowAssignedIssues] = 
    useState(true);

  const [staffStatusFilter, setStaffStatusFilter] = useState("All");
  const [adminStatusFilter, setAdminStatusFilter] = useState("All");
  const [selectedAdminIssue, setSelectedAdminIssue] = useState(null);

  const [workUpdates, setWorkUpdates] = useState({});

  const [evidenceFiles, setEvidenceFiles] = useState({});
  
  const [staffLocations] = useState([
  {
    id: 1,
    name: "Demo Staff",
    latitude: 22.5755,
    longitude: 88.4271,
    status: "Active",
  },
  {
    id: 2,
    name: "Staff 2",
    latitude: 22.5720,
    longitude: 88.3650,
    status: "Busy",
 },
  ]);
  
  const [assignedIssues, setAssignedIssues] = useState([
  {
    id: 1,
    title: "Broken Street Light",
    type: "Electricity",
    status: "Assigned",
    latitude: 22.5729,
    longitude: 88.3645,
    description: "Street light is not working.",
  },
  {
    id: 2,
    title: "Road Damage",
    type: "Road",
    status: "In Progress",
    latitude: 22.5685,
    longitude: 88.3690,
    description: "Road surface is damaged.",
  },
]);

  const filteredAssignedIssues = assignedIssues.filter(
  (issue) =>
    staffStatusFilter === "All" ||
    issue.status === staffStatusFilter
  );

  const filteredAdminIssues = assignedIssues.filter(
    (issue) =>
      adminStatusFilter === "All" ||
      issue.status === adminStatusFilter
  );

  const adminIssueStats = useMemo(() => {
    return {
      total: assignedIssues.length,
      assigned: assignedIssues.filter((issue) => issue.status === "Assigned").length,
      inProgress: assignedIssues.filter((issue) => issue.status === "In Progress").length,
      completed: assignedIssues.filter((issue) => issue.status === "Completed").length,
    };
  }, [assignedIssues]);

  useEffect(() => {
    if (role !== "admin") {
      setSelectedAdminIssue(null);
      return;
    }

    if (
      selectedAdminIssue &&
      !filteredAdminIssues.some(
        (issue) => issue.id === selectedAdminIssue.id
      )
    ) {
      setSelectedAdminIssue(null);
    }
  }, [role, filteredAdminIssues, selectedAdminIssue]);

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
      /* ==========================================
         1. OSRM
         Route geometry + normal ETA
      ========================================== */

      const url =
        `${OSRM_SERVER}/` +
        `${userLongitude},${userLatitude};` +
        `${destinationLongitude},${destinationLatitude}` +
        `?overview=full` +
        `&geometries=geojson` +
        `&steps=true` +
        `&alternatives=true`;

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
        throw new Error("No route found.");
      }
      
      console.log("OSRM routes:", data.routes.length, data.routes);
      const route = data.routes[0];
      const alternativeRoutes = data.routes.slice(1);

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

      const alternativeRouteCoordinates = alternativeRoutes.map(
         (alternativeRoute) =>
         alternativeRoute.geometry.coordinates.map(
         ([longitude, latitude]) => [latitude, longitude]
        )
      );

      /* ==========================================
         2. TOMTOM
         Traffic ETA
      ========================================== */

      const tomTomUrl =
        `https://api.tomtom.com/routing/1/calculateRoute/` +
        `${userLatitude},${userLongitude}:` +
        `${destinationLatitude},${destinationLongitude}/json` +
        `?traffic=true` +
        `&computeTravelTimeFor=all` +
        `&key=${import.meta.env.VITE_TOMTOM_API_KEY}`;

      const trafficResponse =
        await fetch(tomTomUrl, {
          signal: controller.signal,
        });

      if (!trafficResponse.ok) {
        throw new Error(
          `TomTom traffic error: ${trafficResponse.status}`
        );
      }

      const trafficData =
        await trafficResponse.json();

      const trafficRoute =
        trafficData.routes?.[0];

      if (!trafficRoute) {
        throw new Error(
          "No traffic route found."
        );
      }

      const trafficSummary =
        trafficRoute.summary;

      const trafficDuration =
        trafficSummary?.travelTimeInSeconds;

      const trafficDelay =
        trafficSummary?.trafficDelayInSeconds;

      console.log(
        "TomTom Summary:",
        trafficSummary
      );

      console.log(
        "trafficDuration:",
        trafficDuration
      );

      console.log(
        "trafficDelay:",
        trafficDelay
      );

      if (controller.signal.aborted) {
        return;
      }

      /* ==========================================
         3. SAVE ROUTE DATA
      ========================================== */

      setRouteCoordinates(coordinates);

      setAlternativeRoutes(alternativeRouteCoordinates);

      setRouteInfo({
        distance: route.distance,
        duration: route.duration,
        trafficDuration,
        trafficDelay,
      });

    } catch (error) {
      if (
        error.name === "AbortError"
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

   useEffect(() => {
   if (!userLocation || !routeDestination) return;

   getRoute(routeDestination);

   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [userLocation]);
  
  const clearRoute = useCallback(() => {
  routeAbortRef.current?.abort();

  setRouteCoordinates([]);
  setAlternativeRoutes([]);
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

    const searchText = query.trim();

    if (!searchText) {
      return;
    }

    if (!MAPTILER_KEY) {
      alert("MapTiler API Key is missing. Check your .env file.");
      return;
    }

    /* ===================================================
       COORDINATE SEARCH
       Supported:
       22.5726, 88.3639
       22.5448° N, 88.3426° E
       22.5448 N, 88.3426 E
       22.5448°N, 88.3426°E
    =================================================== */

    let latitude = null;
    let longitude = null;

    const decimalMatch = searchText.match(
      /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/
    );

    const directionMatch = searchText.match(
      /^\s*(\d+(?:\.\d+)?)\s*°?\s*([NS])\s*,\s*(\d+(?:\.\d+)?)\s*°?\s*([EW])\s*$/i
    );

    if (decimalMatch) {
      latitude = Number(decimalMatch[1]);
      longitude = Number(decimalMatch[2]);
    } else if (directionMatch) {
      const latValue = Number(directionMatch[1]);
      const latDirection = directionMatch[2].toUpperCase();
      const lonValue = Number(directionMatch[3]);
      const lonDirection = directionMatch[4].toUpperCase();

      latitude = latDirection === "S" ? -latValue : latValue;
      longitude = lonDirection === "W" ? -lonValue : lonValue;
    }

    /* ===================================================
       COORDINATE RESULT
    =================================================== */

    if (latitude !== null && longitude !== null) {
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        alert("Invalid coordinates.");
        return;
      }

      if (!isInsideKolkata(latitude, longitude)) {
        alert("These coordinates are outside Kolkata boundaries.");
        return;
      }

      searchAbortRef.current?.abort();

      const controller = new AbortController();
      searchAbortRef.current = controller;

      setLoading(true);
      setResults([]);
      setNearbyPlaces([]);
      setNearbyError("");
      setNearbyCategory(null);

      const location = [latitude, longitude];

      try {
        const reverseUrl =
          `https://api.maptiler.com/geocoding/` +
          `${longitude},${latitude}.json` +
          `?key=${MAPTILER_KEY}` +
          `&language=bn,en` +
          `&limit=1`;

        const response = await fetch(reverseUrl, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`MapTiler reverse geocoding error: ${response.status}`);
        }

        const data = await response.json();

        if (controller.signal.aborted) {
          return;
        }

        const feature = data.features?.[0];

        const placeName =
          feature?.place_name_bn ||
          feature?.text_bn ||
          feature?.place_name ||
          feature?.text ||
          "নির্বাচিত স্থান";

        const address =
          feature?.place_name ||
          "স্থানটির ঠিকানা পাওয়া যায়নি";

        setSelectedLocation({
          position: location,
          latitude,
          longitude,
          name: placeName,
          address,
        });

        setClickedLocation(null);
        setCopied(false);
        setMapTarget(location);
        setQuery(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setResults([]);
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        console.error("Reverse geocoding failed:", error);

        setSelectedLocation({
          position: location,
          latitude,
          longitude,
          name: "নির্বাচিত স্থান",
          address: "স্থানটির নাম পাওয়া যায়নি",
        });

        setClickedLocation(null);
        setCopied(false);
        setMapTarget(location);
        setQuery(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }

      return;
    }

    /* ===================================================
       NORMAL PLACE SEARCH
    =================================================== */

    searchAbortRef.current?.abort();

    const controller = new AbortController();
    searchAbortRef.current = controller;

    setLoading(true);
    setResults([]);
    setNearbyPlaces([]);
    setNearbyError("");
    setNearbyCategory(null);

    try {
      const center = mapTarget || defaultPosition;

      const url =
        `https://api.maptiler.com/geocoding/` +
        `${encodeURIComponent(searchText)}.json` +
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

      const response = await fetch(url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`MapTiler error: ${response.status}`);
      }

      const data = await response.json();

      if (controller.signal.aborted) {
        return;
      }

      const kolkataResults = (data.features || []).filter((feature) => {
        if (!feature.center || feature.center.length < 2) {
          return false;
        }

        return isInsideKolkata(
          feature.center[1],
          feature.center[0]
        );
      });

      if (kolkataResults.length === 0) {
        alert("No results found within Kolkata boundaries.");
        return;
      }

      setResults(kolkataResults);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Location search failed:", error);
        alert("Location search failed. Please try again.");
      }
    } finally {
      if (!controller.signal.aborted) {
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

    if (!isInsideKolkata(latitude, longitude)) {
      alert(
        "Selected location is outside the map region."
      );
      return;
    }

    const location = [
      latitude,
      longitude,
    ];

    if (pickMode) {
      const bounds = ZONE_BOUNDARIES[zone];

      if (!isInsideZone(latitude, longitude, bounds)) {
        alert(`Pin must stay inside ${zone}`);
        return;
      }

      setClickedLocation({
        position: location,
        latitude,
        longitude,
        name: feature.text || feature.place_name || "Dropped pin",
        address: feature.place_name || "",
      });

      setMapTarget(location);
      setQuery(feature.text || feature.place_name || "");
      setResults([]);
      return;
    }

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
  
  const searchParams = new URLSearchParams(window.location.search);

  const zone = searchParams.get("zone");
  const pickMode = searchParams.get("pick") === "1";
  const returnTo = searchParams.get("return");

  const zoneConfig = ZONE_CONFIG[zone];
  
  const handleMapClick = (location) => {

  if (pickMode) {

    const bounds = ZONE_BOUNDARIES[zone];

    const insideZone = isInsideZone(
      location.latitude,
      location.longitude,
      bounds
    );

    if (!insideZone) {
      alert(`Pin must stay inside ${zone}`);
      return;
    }

    setClickedLocation(location);

    return;
  }

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
  minZoom={11}
  maxZoom={18}
  maxBounds={[
    [22.35, 88.15],
    [22.80, 88.60],
  ]}
  maxBoundsViscosity={1.0}
  scrollWheelZoom={true}
  className="leaflet-full-height"
>
  <PickModeController
    center={zoneConfig?.center}
    enabled={pickMode}
  />

  {pickMode && (
    <div className="pick-mode-bar">
      📍 {zone || "Selected Zone"} — Drop a pin inside this zone
    </div>
  )}

  <MapControls
  onMapClick={handleMapClick}
  getUserLocation={getUserLocation}
  locationLoading={locationLoading}
  role={role}
  showAssignedIssues={showAssignedIssues}
  setShowAssignedIssues={setShowAssignedIssues}
  pickMode={pickMode}
/>

  {role !== "admin" && (
  <LocationPlaylist
    userLocation={userLocation}
  />
)}

  {showTraffic && <TrafficLayer />}

  {/* Route */}
  {!pickMode && (
    <RouteLayer
      routeCoordinates={routeCoordinates}
      alternativeRoutes={alternativeRoutes}
      routeDestination={routeDestination}
      routeInfo={routeInfo}
      formatDistance={formatDistance}
      formatDuration={formatDuration}
    />
  )}

  {/* Pick Mode Selected Marker */}
  {pickMode && clickedLocation && (
   <Marker position={clickedLocation.position}>
     <Popup>
       <strong>Selected Location</strong>
       <br />
        {clickedLocation.latitude.toFixed(6)},{" "}
        {clickedLocation.longitude.toFixed(6)}
     </Popup>
   </Marker>
  )}

   {/* Confirm selected location */}
   {pickMode && clickedLocation && (
   <button
      className="pick-confirm-button"
     onClick={(e) => {
       e.preventDefault();
      e.stopPropagation();

    if (!returnTo) return;

    const params = new URLSearchParams({
    zone: zone || "",
    lat: clickedLocation.latitude.toFixed(6),
    lng: clickedLocation.longitude.toFixed(6),
    label: clickedLocation.name || "Dropped pin",
  });

   window.location.href = `${returnTo}?${params.toString()}`;
  }}
   >
    Confirm Location
  </button>
  )}

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

        {/* 🗺️ Dynamic Base Layer */}
      <TileLayer
        key={baseLayer.id}
        url={baseLayer.url}
        attribution={baseLayer.attribution}
        keepBuffer={4}
      />

     {/* 🎛️ Custom Layer Selector */}
     <LayerSelector
        activeBaseLayer={baseLayer.id}
        onBaseLayerChange={(selectedLayer) =>
        setBaseLayer(selectedLayer)
      }
      activeFilters={activeFilters}
      onFilterChange={handleFilterChange}
      showTraffic={showTraffic}
     onTrafficToggle={setShowTraffic}
    />

    {/* 📍 CITY HUB */}
    {activeFilters.cityHub && (
     <LayerGroup>
       <Marker position={[22.5726, 88.3639]}>
          <Popup>
           📍 Central Kolkata Command Hub
          </Popup>
       </Marker>
     </LayerGroup>
    )}

     {/* 👨‍🔧 STAFF LOCATIONS */}
    {role === "admin" && activeFilters.staffLocations && (
    <LayerGroup>
    {staffLocations.map((staff) => (
      <Marker
        key={staff.id}
        position={[staff.latitude, staff.longitude]}
        icon={getStaffIcon(staff.status)}
      >
           <Popup>
            <strong>👨‍🔧 Staff Location</strong>
           <br />
           Staff: {staff.name}
           <br />
           Status: 🟢 {staff.status}
         </Popup>
       </Marker>
     ))}
   </LayerGroup>
   )}

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

        {activeFilters.selectedLocation && selectedLocation && (
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
    position={clickedLocation.position}
  >
    <Popup>

      <div className="clicked-popup-wrapper">

        <strong>
          📍 Selected Coordinates
        </strong>

        <hr className="popup-divider" />

        <div className="popup-coordinates">

          <div>
            <strong>Latitude:</strong>{" "}
            {clickedLocation.latitude.toFixed(6)}
          </div>

          <div>
            <strong>Longitude:</strong>{" "}
            {clickedLocation.longitude.toFixed(6)}
          </div>

        </div>

        <button
          type="button"
          className={`copy-btn ${
            copied ? "copied" : ""
          }`}
          onClick={copyCoordinates}
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
              latitude: clickedLocation.latitude,
              longitude: clickedLocation.longitude,
              name: "Selected Location",
            })
          }
        >
          🚗 Get Route
        </button>

        {/* REPORT ISSUE */}
        {role === "user" && (
          <button
            type="button"
            className="report-issue-btn"
            onClick={() => {
              if (onReportIssue) {
                onReportIssue({
                  latitude: clickedLocation.latitude,
                  longitude: clickedLocation.longitude,
                });
              } else {
                alert(
                  "Report Issue feature is not connected yet."
                );
              }
            }}
          >
            📝 Report Issue Here
          </button>
        )}

      </div>

    </Popup>
  </Marker>
)}
         {/* =================================================
    ADMIN ISSUES
================================================= */}

{role === "admin" &&
  activeFilters.issues &&
  filteredAdminIssues.map((issue) => (
    <Marker
      key={`admin-${issue.id}`}
      position={[issue.latitude, issue.longitude]}
      eventHandlers={{
        click: () => setSelectedAdminIssue(issue),
      }}
    >
      <Popup>
        <div className="admin-issue-popup">
          <strong>{issue.title}</strong>
          <span>{issue.type} • {issue.status}</span>
          <button
            type="button"
            className="admin-popup-details-btn"
            onClick={() => setSelectedAdminIssue(issue)}
          >
            View Details →
          </button>
        </div>
      </Popup>
    </Marker>
  ))}

         {/* =================================================
    STAFF ASSIGNED ISSUES
================================================= */}

{role === "staff" &&
  showAssignedIssues &&
  filteredAssignedIssues.map((issue) => (
    <Marker
      key={issue.id}
      position={[issue.latitude, issue.longitude]}
    >
      <Popup>
        <div className="issue-card">
          <h4>{issue.title}</h4>

          <p>📂 Type: {issue.type}</p>

          <p>
            🔄 Status: <strong>{issue.status}</strong>
          </p>

          <p>{issue.description}</p>

          <textarea
            value={workUpdates[issue.id] || ""}
            onChange={(event) =>
              setWorkUpdates((previous) => ({
                ...previous,
                [issue.id]: event.target.value,
              }))
            }
            placeholder="Write your work update..."
            rows="3"
          />

          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (!file) {
                return;
              }

              setEvidenceFiles((previous) => ({
                ...previous,
                [issue.id]: file,
              }));
            }}
          />

          {evidenceFiles[issue.id] && (
            <p>
              📎 {evidenceFiles[issue.id].name}
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              setAssignedIssues((previous) =>
                previous.map((item) =>
                  item.id === issue.id
                    ? {
                        ...item,
                        status: "In Progress",
                      }
                    : item
                )
              );

              alert("Work update saved successfully!");
            }}
          >
            💾 Save Work Update
          </button>

          <button
            type="button"
            onClick={() => {
              setAssignedIssues((previous) =>
                previous.map((item) =>
                  item.id === issue.id
                    ? {
                        ...item,
                        status: "Completed",
                      }
                    : item
                )
              );

              alert("Issue marked as completed!");
            }}
          >
            ✅ Mark Completed
          </button>
        </div>
      </Popup>
    </Marker>
  ))}
        {/* =================================================
            NEARBY PLACES
        ================================================= */}

        {activeFilters.nearbyPlaces && (
          <NearbyPlaces
             places={filteredNearbyPlaces}
             createCategoryLeafletIcon={createCategoryLeafletIcon}
             getRoute={getRoute}
          />
        )}

      </MapContainer>

      {role === "admin" && selectedAdminIssue && (
        <aside className="admin-issue-details-panel" aria-label="Issue details">
          <div className="admin-issue-panel-header">
            <div>
              <span className="admin-panel-eyebrow">ISSUE DETAILS</span>
              <h3>{selectedAdminIssue.title}</h3>
            </div>

            <button
              type="button"
              className="admin-panel-close"
              onClick={() => setSelectedAdminIssue(null)}
              aria-label="Close issue details"
            >
              ×
            </button>
          </div>

          <div className="admin-issue-panel-body">
            <div className={`admin-issue-status-badge ${
              selectedAdminIssue.status === "Completed"
                ? "resolved"
                : selectedAdminIssue.status === "In Progress"
                  ? "progress"
                  : "assigned"
            }`}>
              <span className="admin-status-badge-dot"></span>
              {selectedAdminIssue.status}
            </div>

            <div className="admin-issue-detail-grid">
              <div className="admin-detail-item">
                <span>Category</span>
                <strong>{selectedAdminIssue.type || "Not specified"}</strong>
              </div>

              <div className="admin-detail-item">
                <span>Issue ID</span>
                <strong>#{selectedAdminIssue.id}</strong>
              </div>
            </div>

            <div className="admin-detail-section">
              <span className="admin-detail-label">Description</span>
              <p>{selectedAdminIssue.description || "No description provided."}</p>
            </div>

            <div className="admin-detail-section">
              <span className="admin-detail-label">Location</span>
              <div className="admin-coordinate-box">
                <div>
                  <span>Latitude</span>
                  <strong>{Number(selectedAdminIssue.latitude).toFixed(6)}</strong>
                </div>
                <div>
                  <span>Longitude</span>
                  <strong>{Number(selectedAdminIssue.longitude).toFixed(6)}</strong>
                </div>
              </div>
            </div>

            <div className="admin-issue-meta-list">
              <div>
                <span>👨‍🔧 Assigned Staff</span>
                <strong>
                  {selectedAdminIssue.assignedStaffName ||
                    selectedAdminIssue.assignedTo?.name ||
                    "Not assigned"}
                </strong>
              </div>

              <div>
                <span>🏙️ Ward / Zone</span>
                <strong>{selectedAdminIssue.ward || selectedAdminIssue.zone || "Not available"}</strong>
              </div>

              <div>
                <span>🕒 Reported</span>
                <strong>
                  {selectedAdminIssue.createdAt
                    ? new Date(selectedAdminIssue.createdAt).toLocaleString()
                    : "Not available"}
                </strong>
              </div>
            </div>

            {Array.isArray(selectedAdminIssue.photos) &&
              selectedAdminIssue.photos.length > 0 && (
                <div className="admin-detail-section">
                  <span className="admin-detail-label">Evidence</span>
                  <div className="admin-evidence-count">
                    📷 {selectedAdminIssue.photos.length} evidence file(s)
                  </div>
                </div>
              )}

            <div className="admin-issue-panel-actions">
              <button
                type="button"
                className="admin-route-btn"
                onClick={() =>
                  getRoute({
                    latitude: selectedAdminIssue.latitude,
                    longitude: selectedAdminIssue.longitude,
                    name: selectedAdminIssue.title,
                  })
                }
              >
                🚗 Route to Issue
              </button>

              <button
                type="button"
                className="admin-copy-location-btn"
                onClick={async () => {
                  const coordinates =
                    `${Number(selectedAdminIssue.latitude).toFixed(6)}, ${Number(selectedAdminIssue.longitude).toFixed(6)}`;

                  try {
                    await navigator.clipboard.writeText(coordinates);
                    alert("Issue coordinates copied!");
                  } catch {
                    alert(coordinates);
                  }
                }}
              >
                📋 Copy Coordinates
              </button>
            </div>
          </div>
        </aside>
      )}
      
      {role === "staff" && (
        <div className="staff-status-filter">
          <label htmlFor="issue-status">🔄 Status</label>
          <select
            id="issue-status"
            value={staffStatusFilter}
            onChange={(event) => setStaffStatusFilter(event.target.value)}
          >
            <option value="All">All</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      )}

      {role === "admin" && (
        <div className="admin-city-status-bar">
          <div className="admin-status-title">
            <span className="status-dot"></span>
            <div>
              <strong>City Operations</strong>
              <small>Live Command Center</small>
            </div>
          </div>

          <div className="admin-status-item">
            <span>📍</span>
            <div>
              <strong>{adminIssueStats.total}</strong>
              <small>Total Issues</small>
            </div>
          </div>

          <div className="admin-status-item">
            <span>🟡</span>
            <div>
              <strong>{adminIssueStats.assigned}</strong>
              <small>Pending</small>
            </div>
          </div>

          <div className="admin-status-item">
            <span>🔵</span>
            <div>
              <strong>{adminIssueStats.inProgress}</strong>
              <small>In Progress</small>
            </div>
          </div>

          <div className="admin-status-item">
            <span>✅</span>
            <div>
              <strong>{adminIssueStats.completed}</strong>
              <small>Resolved</small>
            </div>
          </div>

          <div className="admin-system-status">
            <span className="status-dot"></span>
            System Operational
          </div>
        </div>
      )}

      {role === "admin" && (
        <div className="admin-issue-filter">
          <label htmlFor="admin-issue-status">🔎 Issues</label>
          <select
            id="admin-issue-status"
            value={adminStatusFilter}
            onChange={(event) => setAdminStatusFilter(event.target.value)}
          >
            <option value="All">All Issues</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      )}

      <MapSearch
        role={role}
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
        onReportIssue={onReportIssue}
        showTraffic={showTraffic}
        setShowTraffic={setShowTraffic}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        handleFilterClick={handleFilterClick}
        activeFilters={activeFilters}
        handleFilterChange={handleFilterChange}
      />
    </div>
  );
}