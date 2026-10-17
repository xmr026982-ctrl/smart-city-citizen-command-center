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
  LayerGroup,
  Polyline,
  useMap,
} from "react-leaflet";

import { fetchIssues } from "../../services/api.js";  // 


import { KOLKATA_BOUNDS, isInsideKolkata } from "./MapUtils";

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
import { getUser, logout } from "../../store/authStore";

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

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const NEARBY_RADIUS = 1000;

const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const OSRM_SERVER = "https://router.project-osrm.org/route/v1/driving";

const COMPLETED_STATUSES = ["pending_review", "resolved", "completed"];
const ASSIGNED_STATUSES = ["submitted", "acknowledged"];

/* =====================================================
   ZONE CONFIG
===================================================== */

const ZONE_CONFIG = {
  Shyambazar: { center: [22.599, 88.373], bounds: null },
  "B.B.D. Bagh": { center: [22.573, 88.348], bounds: null },
  Ballygunge: { center: [22.527, 88.363], bounds: null },
  "College Street": { center: [22.575, 88.363], bounds: null },
  "B.P. Township": { center: [22.484, 88.405], bounds: null },
  Dharmatala: { center: [22.562, 88.352], bounds: null },
};

const isInsideZone = (latitude, longitude, bounds) => {
  if (!bounds) return true;

  const [[south, west], [north, east]] = bounds;

  return (
    latitude >= south &&
    latitude <= north &&
    longitude >= west &&
    longitude <= east
  );
};

/* =====================================================
   HELPERS
===================================================== */

const matchesIssueId = (item, id) => {
  if (!item || id == null) return false;

  const target = String(id).trim().toLowerCase();
  if (!target) return false;

  const candidates = [
    item.id,
    item._id,
    item.issueId,
    item.ticketId,
    item.ticketNumber,
    item.issue_id,
    item.ticket_id,
    item.number,
  ]
    .filter((value) => value != null)
    .map((value) => String(value).trim().toLowerCase());

  if (candidates.some((value) => value === target)) return true;

  // Match trailing digits (e.g. "ISS-2410" vs "2410")
  const targetNum = target.replace(/\D/g, "");
  if (targetNum.length >= 3) {
    if (
      candidates.some((value) => {
        const num = value.replace(/\D/g, "");
        return num === targetNum || value.endsWith(targetNum);
      })
    ) {
      return true;
    }
  }

  return false;
};

function getActorHeaders({ json = false } = {}) {
  const user = getUser();

  if (!user?.id || !user?.role) {
    throw new Error("Your session is missing. Please sign in again.");
  }

  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    "x-role": user.role === "citizen" ? "citizen" : user.role,
    "x-name": user.name || "Unknown user",
    "x-user-id": String(user.id),
  };
}

function formatIssueStatus(value) {
  const status = String(value || "submitted").toLowerCase();
  const labels = {
    submitted: "Pending",
    acknowledged: "Assigned",
    in_progress: "In Progress",
    pending_review: "Pending Review",
    resolved: "Completed",
    completed: "Completed",
  };
  return labels[status] || status.replace(/_/g, " ");
}

/* Backend issue -> consistent shape (numeric lat/lng, lowercase status) */
function resolveAssignedStaffName(issue) {
  if (
    typeof issue?.assignedStaffName === "string" &&
    issue.assignedStaffName.trim()
  ) {
    return issue.assignedStaffName.trim();
  }

  if (typeof issue?.assignedTo === "string" && issue.assignedTo.trim()) {
    return issue.assignedTo.trim();
  }

  if (issue?.assignedTo && typeof issue.assignedTo === "object") {
    const name = issue.assignedTo.name || issue.assignedTo.fullName;

    if (typeof name === "string" && name.trim()) {
      return name.trim();
    }
  }

  return undefined;
}

function normalizeIssue(issue) {
  const coordinates = issue.location?.coordinates;
  const assignedStaffName = resolveAssignedStaffName(issue);

  return {
    ...issue,
    id: String(issue.id ?? issue._id ?? ""),
    latitude: Number(issue.latitude ?? issue.lat ?? coordinates?.[1]),
    longitude: Number(issue.longitude ?? issue.lng ?? coordinates?.[0]),
    type: issue.type || issue.category || "Other",
    status: String(issue.status || "submitted").toLowerCase(),
    assignedStaffName,
  };
}

function hasValidCoordinates(issue) {
  return (
    Number.isFinite(issue?.latitude) &&
    Number.isFinite(issue?.longitude)
  );
}

const extractRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.issues)) return payload.issues;
  return [];
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

const iconCache = new Map();

const createCategoryLeafletIcon = (category) => {
  if (iconCache.has(category)) return iconCache.get(category);

  const icon = L.divIcon({
    html: `<div class="leaflet-category-icon-inner">${getCategoryIcon(
      category
    )}</div>`,
    className: "custom-category-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  iconCache.set(category, icon);
  return icon;
};

/* Overpass tag filters per category */
const CATEGORY_FILTERS = {
  shop: ['["shop"]'],
  hospital: ['["amenity"="hospital"]', '["healthcare"="hospital"]'],
  pharmacy: ['["amenity"="pharmacy"]', '["healthcare"="pharmacy"]'],
  bank: ['["amenity"="bank"]', '["office"="financial"]'],
  restaurant: [
    '["amenity"="restaurant"]',
    '["amenity"="fast_food"]',
    '["amenity"="cafe"]',
  ],
  school: ['["amenity"="school"]', '["amenity"="college"]'],
};

/* =====================================================
   STAFF ICON
===================================================== */

const getStaffIcon = (status) => {
  let icon = "👨‍🔧";

  if (status === "Active") icon = "🟢👨‍🔧";
  else if (status === "Busy") icon = "🟠👨‍🔧";
  else if (status === "Offline") icon = "🔴👨‍🔧";

  return L.divIcon({
    className: "staff-location-icon",
    html: `<div style="font-size: 26px; white-space: nowrap;">${icon}</div>`,
    iconSize: [55, 40],
    iconAnchor: [27, 40],
  });
};

/* =====================================================
   MAP CONTROLLERS (must live inside MapContainer)
===================================================== */

function PickModeController({ center, enabled }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !center) return;
    map.setView(center, 14);
  }, [map, center, enabled]);

  return null;
}

function IssueLocationController({ lat, lng }) {
  const map = useMap();

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.setView([lat, lng], 15);
  }, [map, lat, lng]);

  return null;
}

/* Moves the map whenever mapTarget changes (search, My Location, tracking) */
function MapTargetController({ target }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [map, target]);

  return null;
}

/* =====================================================
   MAIN COMPONENT
===================================================== */

export default function MapView({ role: roleProp = "user", onReportIssue }) {
  /* ---------- URL params ---------- */
  const searchParams = new URLSearchParams(window.location.search);

  const zone = searchParams.get("zone");
  const pickMode = searchParams.get("pick") === "1";
  const returnTo = searchParams.get("return");
  const targetIssueId = searchParams.get("issueId");

  const issueLatParam = searchParams.get("lat");
  const issueLngParam = searchParams.get("lng");
  const issueLat = issueLatParam !== null ? Number(issueLatParam) : null;
  const issueLng = issueLngParam !== null ? Number(issueLngParam) : null;

  // Prefer prop; fall back to path so /staff/map and /admin/map still work
  const role = useMemo(() => {
    if (roleProp && roleProp !== "user") return roleProp;
    const path = window.location.pathname.toLowerCase();
    if (path.includes("/staff")) return "staff";
    if (path.includes("/admin")) return "admin";
    return roleProp || "user";
  }, [roleProp]);

  const zoneConfig = ZONE_CONFIG[zone];

  /* ---------- Basic ---------- */
  const defaultPosition = useMemo(() => DEFAULT_POSITION, []);
  const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

   /* ---------- Backend System Status ---------- */
const [isSystemOnline, setIsSystemOnline] = useState(false);

useEffect(() => {
  let isMounted = true;

  const checkSystemStatus = async () => {
    try {
      const response = await fetch("http://localhost:5000/health");

      if (isMounted) {
        setIsSystemOnline(response.ok);
      }
    } catch {
      if (isMounted) {
        setIsSystemOnline(false);
      }
    }
  };

  checkSystemStatus();

  const intervalId = setInterval(checkSystemStatus, 10000);

  return () => {
    isMounted = false;
    clearInterval(intervalId);
  };
}, []);

  const [baseLayer, setBaseLayer] = useState({
    id: "Streets",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  });

  /* ---------- Refs ---------- */
  const nearbyAbortRef = useRef(null);
  const issuesAbortRef = useRef(null);
  const searchAbortRef = useRef(null);
  const routeAbortRef = useRef(null);
  const trackingWatchRef = useRef(null);
  const nearbyCacheRef = useRef(new Map());

  /* ---------- Search ---------- */
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [mapTarget, setMapTarget] = useState(null);

  /* ---------- User location ---------- */
  const [userLocation, setUserLocation] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(0);
  const [locationLoading, setLocationLoading] = useState(false);

  /* ---------- Live tracking ---------- */
  const [isTracking, setIsTracking] = useState(false);
  const [trackingPath, setTrackingPath] = useState([]);
  const [trackingError, setTrackingError] = useState("");

  /* ---------- Selected location ---------- */
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [clickedLocation, setClickedLocation] = useState(null);
  const [copied, setCopied] = useState(false);

  /* ---------- Nearby places ---------- */
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");
  const [nearbyCategory, setNearbyCategory] = useState(null);

  /* ---------- Backend nearby issues (citizen map) ---------- */
  const [backendIssues, setBackendIssues] = useState([]);
  const [backendIssuesLoading, setBackendIssuesLoading] = useState(false);
  const [backendIssuesError, setBackendIssuesError] = useState("");

  /* ---------- Filters ---------- */
  const [showFilters, setShowFilters] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const [activeFilters, setActiveFilters] = useState({
    cityHub: true,
    selectedLocation: true,
    nearbyPlaces: true,
    issues: true,
    staffLocations: true,
  });

  const handleFilterClick = () => setShowFilters((previous) => !previous);

  const handleFilterChange = (filter) =>
    setActiveFilters((previous) => ({
      ...previous,
      [filter]: !previous[filter],
    }));

  /* ---------- Traffic ---------- */
  const [showTraffic, setShowTraffic] = useState(false);

  /* ---------- Routing ---------- */
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [alternativeRoutes, setAlternativeRoutes] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeDestination, setRouteDestination] = useState(null);

  /* ---------- Staff / admin ---------- */
  const [showAssignedIssues, setShowAssignedIssues] = useState(true);
  const [staffStatusFilter, setStaffStatusFilter] = useState("All");
  const [adminStatusFilter, setAdminStatusFilter] = useState("All");
  const [selectedAdminIssue, setSelectedAdminIssue] = useState(null);
  const [selectedStaffIssue, setSelectedStaffIssue] = useState(null);
  const [workUpdates, setWorkUpdates] = useState({});
  const [evidenceFiles, setEvidenceFiles] = useState({});

  // Never show fabricated staff coordinates. Fill only from a real staff-location API.
  const [staffLocations] = useState([]);

  const [assignedIssues, setAssignedIssues] = useState([]);
  const [assignedIssuesLoading, setAssignedIssuesLoading] = useState(false);
  const [assignedIssuesError, setAssignedIssuesError] = useState("");

  const matchesIssueFilter = useCallback((issue, filter) => {
    const status = String(issue.status || "").toLowerCase();

    if (filter === "All") return true;
    if (filter === "Assigned") {
      return Boolean(issue.assignedTo) && ASSIGNED_STATUSES.includes(status);
    }
    if (filter === "In Progress") return status === "in_progress";
    if (filter === "Completed") return COMPLETED_STATUSES.includes(status);
    return status === String(filter).toLowerCase();
  }, []);

  const filteredAssignedIssues = useMemo(
    () =>
      assignedIssues.filter((issue) =>
        matchesIssueFilter(issue, staffStatusFilter)
      ),
    [assignedIssues, staffStatusFilter, matchesIssueFilter]
  );

  const filteredAdminIssues = useMemo(
    () =>
      assignedIssues.filter((issue) =>
        matchesIssueFilter(issue, adminStatusFilter)
      ),
    [assignedIssues, adminStatusFilter, matchesIssueFilter]
  );

  const adminIssueStats = useMemo(
    () => ({
      total: assignedIssues.length,
      assigned: assignedIssues.filter(
        (issue) =>
          Boolean(issue.assignedTo) &&
          ASSIGNED_STATUSES.includes(String(issue.status).toLowerCase())
      ).length,
      inProgress: assignedIssues.filter(
        (issue) => String(issue.status).toLowerCase() === "in_progress"
      ).length,
      completed: assignedIssues.filter((issue) =>
        COMPLETED_STATUSES.includes(String(issue.status).toLowerCase())
      ).length,
    }),
    [assignedIssues]
  );

  /* ===================================================
     OPEN ISSUE FROM URL (?issueId=...&lat=...&lng=...)
     Works for both staff and admin.
  =================================================== */

  useEffect(() => {
    if ((role !== "staff" && role !== "admin") || !targetIssueId) {
      return undefined;
    }

    const openPanel = (issue) => {
      if (role === "admin") {
        setSelectedStaffIssue(null);
        setSelectedAdminIssue(issue);
        // Ensure filter does not hide the deep-linked issue
        setAdminStatusFilter("All");
      } else {
        setSelectedAdminIssue(null);
        setSelectedStaffIssue(issue);
        setStaffStatusFilter("All");
      }
    };

    const foundIssue = assignedIssues.find((item) =>
      matchesIssueId(item, targetIssueId)
    );

    if (foundIssue) {
      openPanel(foundIssue);
      if (hasValidCoordinates(foundIssue)) {
        setMapTarget([foundIssue.latitude, foundIssue.longitude]);
      }
      return undefined;
    }

    // Instant map move from URL coords while we fetch full issue data
    if (Number.isFinite(issueLat) && Number.isFinite(issueLng)) {
      setMapTarget([issueLat, issueLng]);
    }

    const controller = new AbortController();

    let headers;
    try {
      headers = getActorHeaders();
    } catch (err) {
      console.error("Cannot load issue details (auth):", err);
      if (Number.isFinite(issueLat) && Number.isFinite(issueLng)) {
        openPanel({
          id: String(targetIssueId),
          title: `Issue ${targetIssueId}`,
          status: "submitted",
          type: "Unknown",
          description: "Could not load full details (session missing).",
          latitude: issueLat,
          longitude: issueLng,
        });
      }
      return undefined;
    }

    fetch(`${API_URL}/issues`, {
      method: "GET",
      headers,
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((payload) => {
        const rows = extractRows(payload);
        const target = rows.find((item) => matchesIssueId(item, targetIssueId));

        if (target) {
          const normalized = normalizeIssue(target);
          openPanel(normalized);
          if (hasValidCoordinates(normalized)) {
            setMapTarget([normalized.latitude, normalized.longitude]);
          }
          return;
        }

        console.warn(
          "Issue not found in /issues response:",
          targetIssueId,
          "Sample ids:",
          rows.slice(0, 5).map((i) => i.id || i._id || i.issueId || i.ticketId)
        );

        if (Number.isFinite(issueLat) && Number.isFinite(issueLng)) {
          openPanel({
            id: String(targetIssueId),
            title: `Issue ${targetIssueId}`,
            status: "submitted",
            type: "Unknown",
            description:
              "Full details were not returned by the server. Coordinates are from the map link.",
            latitude: issueLat,
            longitude: issueLng,
          });
        }
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        console.error("Failed to fetch target issue:", error);
        if (Number.isFinite(issueLat) && Number.isFinite(issueLng)) {
          openPanel({
            id: String(targetIssueId),
            title: `Issue ${targetIssueId}`,
            status: "submitted",
            type: "Unknown",
            description: "Could not load issue details from the server.",
            latitude: issueLat,
            longitude: issueLng,
          });
        }
      });

    return () => controller.abort();
  }, [role, targetIssueId, assignedIssues, issueLat, issueLng]);

  /* Admin: only clear panel when the issue is gone from the full list
     (not merely filtered). Deep-links must stay open. */
  useEffect(() => {
    if (role !== "admin") {
      setSelectedAdminIssue(null);
      return;
    }

    if (
      selectedAdminIssue &&
      assignedIssues.length > 0 &&
      !assignedIssues.some((issue) =>
        matchesIssueId(issue, selectedAdminIssue.id)
      ) &&
      // Keep deep-linked issue open even if not yet in assignedIssues
      !matchesIssueId(selectedAdminIssue, targetIssueId)
    ) {
      setSelectedAdminIssue(null);
    }
  }, [role, assignedIssues, selectedAdminIssue, targetIssueId]);

  /* ===================================================
     CLEANUP
  =================================================== */

  useEffect(() => {
    return () => {
      nearbyAbortRef.current?.abort();
      issuesAbortRef.current?.abort();
      searchAbortRef.current?.abort();
      routeAbortRef.current?.abort();

      if (trackingWatchRef.current !== null) {
        navigator.geolocation?.clearWatch(trackingWatchRef.current);
        trackingWatchRef.current = null;
      }
    };
  }, []);

  /* ===================================================
     FORMATTERS
  =================================================== */

  const formatDistance = useCallback((meters) => {
    if (!meters) return "0 m";
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }, []);

  const formatDuration = useCallback((seconds) => {
    if (!seconds) return "0 min";

    const totalMinutes = Math.round(seconds / 60);
    if (totalMinutes < 60) return `${totalMinutes} min`;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
  }, []);

  /* ===================================================
     GET ROUTE
  =================================================== */

  const getRoute = useCallback(
    async (destination) => {
      if (!destination) return;

      if (!userLocation) {
        alert("Please click 'My Location' first to get your current location.");
        return;
      }

      const [userLatitude, userLongitude] = userLocation;

      const {
        latitude: destinationLatitude,
        longitude: destinationLongitude,
        name = "Destination",
      } = destination;

      if (!isInsideKolkata(destinationLatitude, destinationLongitude)) {
        alert("Destination is outside Kolkata boundaries.");
        return;
      }

      routeAbortRef.current?.abort();

      const controller = new AbortController();
      routeAbortRef.current = controller;

      setRouteLoading(true);
      setRouteError("");
      setRouteCoordinates([]);
      setAlternativeRoutes([]);
      setRouteInfo(null);

      setRouteDestination({
        latitude: destinationLatitude,
        longitude: destinationLongitude,
        name,
      });

      try {
        /* 1. OSRM: geometry + normal ETA */
        const url =
          `${OSRM_SERVER}/` +
          `${userLongitude},${userLatitude};` +
          `${destinationLongitude},${destinationLatitude}` +
          `?overview=full&geometries=geojson&steps=true&alternatives=true`;

        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`Routing server error: ${response.status}`);
        }

        const data = await response.json();

        if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
          throw new Error("No route found.");
        }

        const route = data.routes[0];

        // OSRM: [lng, lat]  ->  Leaflet: [lat, lng]
        const toLatLng = (osrmRoute) =>
          osrmRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

        const coordinates = toLatLng(route);
        const altRouteCoordinates = data.routes.slice(1).map(toLatLng);

        /* 2. TomTom: traffic ETA (optional - route still shows if this fails) */
        let trafficDuration;
        let trafficDelay;

        try {
          const tomTomUrl =
            `https://api.tomtom.com/routing/1/calculateRoute/` +
            `${userLatitude},${userLongitude}:` +
            `${destinationLatitude},${destinationLongitude}/json` +
            `?traffic=true&computeTravelTimeFor=all` +
            `&key=${import.meta.env.VITE_TOMTOM_API_KEY}`;

          const trafficResponse = await fetch(tomTomUrl, {
            signal: controller.signal,
          });

          if (!trafficResponse.ok) {
            throw new Error(`TomTom traffic error: ${trafficResponse.status}`);
          }

          const trafficData = await trafficResponse.json();
          const summary = trafficData.routes?.[0]?.summary;

          trafficDuration = summary?.travelTimeInSeconds;
          trafficDelay = summary?.trafficDelayInSeconds;
        } catch (trafficError) {
          if (trafficError.name === "AbortError") throw trafficError;
          console.warn("Traffic ETA unavailable:", trafficError);
        }

        if (controller.signal.aborted) return;

        /* 3. Save */
        setRouteCoordinates(coordinates);
        setAlternativeRoutes(altRouteCoordinates);
        setRouteInfo({
          distance: route.distance,
          duration: route.duration,
          trafficDuration,
          trafficDelay,
        });
      } catch (error) {
        if (error.name === "AbortError") return;

        console.error("Routing error:", error);

        setRouteCoordinates([]);
        setAlternativeRoutes([]);
        setRouteInfo(null);
        setRouteError("Unable to find a route. Please try again.");
      } finally {
        if (!controller.signal.aborted) {
          setRouteLoading(false);
        }
      }
    },
    [userLocation]
  );

  /* Re-route when the user's location changes */
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
     BACKEND NEARBY ISSUES (citizen map only)
  =================================================== */

  const getNearbyIssues = useCallback(async (latitude, longitude) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    if (!isInsideKolkata(latitude, longitude)) {
      setBackendIssues([]);
      setBackendIssuesError("Selected location is outside Kolkata.");
      return;
    }

    issuesAbortRef.current?.abort();
    const controller = new AbortController();
    issuesAbortRef.current = controller;

    setBackendIssuesLoading(true);
    setBackendIssuesError("");

    try {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        radius: "2000",
      });

      const response = await fetch(`${API_URL}/issues/nearby?${params}`, {
        method: "GET",
        headers: getActorHeaders(),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `Issue API error (${response.status})`);
      }

      setBackendIssues(extractRows(data));
    } catch (error) {
      if (error.name === "AbortError") return;

      console.error("Failed to load nearby issues:", error);
      setBackendIssues([]);
      setBackendIssuesError(error.message || "Unable to load nearby issues.");
    } finally {
      if (issuesAbortRef.current === controller) {
        setBackendIssuesLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Staff / admin already get every issue from /issues, so skip this for them.
    if (role !== "user" || !userLocation) return;

    getNearbyIssues(userLocation[0], userLocation[1]);
  }, [role, userLocation, getNearbyIssues]);

  /* ===================================================
     ASSIGNED ISSUES (STAFF / ADMIN)
  =================================================== */

  
useEffect(() => {
  if (role !== "staff" && role !== "admin") {
    setAssignedIssues([]);
    setAssignedIssuesError("");
    setAssignedIssuesLoading(false);
    return undefined;
  }

  const controller = new AbortController();

  async function loadAssignedIssues() {
    setAssignedIssuesLoading(true);
    setAssignedIssuesError("");

    try {
      const payload = await fetchIssues({
        signal: controller.signal,
      });

      const normalized = extractRows(payload)
        .map(normalizeIssue)
        .filter((issue) => Boolean(issue.id));

      if (!controller.signal.aborted) {
        setAssignedIssues(normalized);
      }
    } catch (error) {
      if (error.name === "AbortError") return;

      console.error("Failed to load assigned issues:", error);

      if (!controller.signal.aborted) {
        setAssignedIssuesError(
          error.message || "Unable to load assigned issues."
        );
        setAssignedIssues([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setAssignedIssuesLoading(false);
      }
    }
  }

  loadAssignedIssues();

  return () => controller.abort();
}, [role]);


  /* ===================================================
     COPY COORDINATES
  =================================================== */

  const copyCoordinates = async () => {
    if (!clickedLocation) return;

    const coordinates =
      `${clickedLocation.latitude.toFixed(6)}, ` +
      `${clickedLocation.longitude.toFixed(6)}`;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(coordinates);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = coordinates;
        document.body.appendChild(textarea);

        try {
          textarea.select();
          document.execCommand("copy");
        } finally {
          document.body.removeChild(textarea);
        }
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Failed to copy coordinates.");
    }
  };

  /* ===================================================
     OVERPASS / NEARBY PLACES
  =================================================== */

  const buildCategoryQuery = useCallback((latitude, longitude, category) => {
    const filters = CATEGORY_FILTERS[category] || [];

    const queryParts = filters
      .map(
        (filter) =>
          `nwr${filter}(around:${NEARBY_RADIUS},${latitude},${longitude});`
      )
      .join("\n");

    return `
      [out:json][timeout:10];
      (
        ${queryParts}
      );
      out center tags;
    `;
  }, []);

  const convertOSMElement = useCallback((element) => {
    const tags = element.tags || {};

    const latitude =
      typeof element.lat === "number" ? element.lat : element.center?.lat;

    const longitude =
      typeof element.lon === "number" ? element.lon : element.center?.lon;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return null;
    }

    if (!isInsideKolkata(latitude, longitude)) return null;

    let category = "other";

    if (tags.shop) category = "shop";
    if (tags.amenity === "hospital" || tags.healthcare === "hospital") {
      category = "hospital";
    }
    if (tags.amenity === "pharmacy" || tags.healthcare === "pharmacy") {
      category = "pharmacy";
    }
    if (tags.amenity === "bank" || tags.office === "financial") {
      category = "bank";
    }
    if (["restaurant", "fast_food", "cafe"].includes(tags.amenity)) {
      category = "restaurant";
    }
    if (["school", "college"].includes(tags.amenity)) {
      category = "school";
    }

    const name =
      tags.name?.trim() ||
      tags["name:en"]?.trim() ||
      tags["name:bn"]?.trim() ||
      tags.brand?.trim() ||
      tags.operator?.trim();

    if (!name) return null;

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
      phone: tags.phone || tags["contact:phone"] || "",
      website: tags.website || tags["contact:website"] || "",
    };
  }, []);

  const removeDuplicates = useCallback((places) => {
    const unique = new Map();

    places.forEach((place) => {
      const key =
        `${place.latitude.toFixed(5)}-${place.longitude.toFixed(5)}-` +
        `${place.name.toLowerCase()}-${place.category}`;

      if (!unique.has(key)) unique.set(key, place);
    });

    return Array.from(unique.values());
  }, []);

  const getNearbyPlaces = useCallback(
    async (latitude, longitude, category) => {
      if (!category) {
        setNearbyPlaces([]);
        setNearbyLoading(false);
        return;
      }

      if (!isInsideKolkata(latitude, longitude)) {
        setNearbyPlaces([]);
        setNearbyError("Selected location is outside Kolkata region.");
        return;
      }

      const cacheKey =
        `${latitude.toFixed(4)}_${longitude.toFixed(4)}_${category}`;

      if (nearbyCacheRef.current.has(cacheKey)) {
        setNearbyPlaces(nearbyCacheRef.current.get(cacheKey));
        setNearbyError("");
        setNearbyLoading(false);
        return;
      }

      nearbyAbortRef.current?.abort();

      const controller = new AbortController();
      nearbyAbortRef.current = controller;

      setNearbyLoading(true);
      setNearbyError("");
      setNearbyPlaces([]);

      const overpassQuery = buildCategoryQuery(latitude, longitude, category);

      let successful = false;

      for (const server of OVERPASS_SERVERS) {
        try {
          const response = await fetch(server, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `data=${encodeURIComponent(overpassQuery)}`,
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`Server status ${response.status}`);
          }

          const data = await response.json();

          const uniquePlaces = removeDuplicates(
            (data.elements || []).map(convertOSMElement).filter(Boolean)
          );

          if (controller.signal.aborted) return;

          nearbyCacheRef.current.set(cacheKey, uniquePlaces);
          setNearbyPlaces(uniquePlaces);
          setNearbyError("");

          successful = true;
          break;
        } catch (error) {
          if (error.name === "AbortError") return;
        }
      }

      if (controller.signal.aborted) return;

      if (!successful) {
        setNearbyPlaces([]);
        setNearbyError(
          "Nearby services timeout. Try choosing a specific category."
        );
      }

      setNearbyLoading(false);
    },
    [buildCategoryQuery, convertOSMElement, removeDuplicates]
  );

  /* ===================================================
     SEARCH
  =================================================== */

  const resetSearchState = () => {
    setLoading(true);
    setResults([]);
    setNearbyPlaces([]);
    setNearbyError("");
    setNearbyCategory(null);
  };

  const handleSearch = async (event) => {
    event.preventDefault();

    const searchText = query.trim();
    if (!searchText) return;

    if (!MAPTILER_KEY) {
      alert("MapTiler API Key is missing. Check your .env file.");
      return;
    }

    /* Coordinate search. Supported:
       22.5726, 88.3639
       22.5448° N, 88.3426° E  /  22.5448 N, 88.3426 E  /  22.5448°N, 88.3426°E */

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
      const lonValue = Number(directionMatch[3]);

      latitude = directionMatch[2].toUpperCase() === "S" ? -latValue : latValue;
      longitude = directionMatch[4].toUpperCase() === "W" ? -lonValue : lonValue;
    }

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

      resetSearchState();

      const location = [latitude, longitude];

      const applyCoordinateResult = (name, address) => {
        setSelectedLocation({
          position: location,
          latitude,
          longitude,
          name,
          address,
        });
        setClickedLocation(null);
        setCopied(false);
        setMapTarget(location);
        setQuery(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setResults([]);
      };

      try {
        const reverseUrl =
          `https://api.maptiler.com/geocoding/${longitude},${latitude}.json` +
          `?key=${MAPTILER_KEY}&language=bn,en&limit=1`;

        const response = await fetch(reverseUrl, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`MapTiler reverse geocoding error: ${response.status}`);
        }

        const data = await response.json();

        if (controller.signal.aborted) return;

        const feature = data.features?.[0];

        applyCoordinateResult(
          feature?.place_name_bn ||
            feature?.text_bn ||
            feature?.place_name ||
            feature?.text ||
            "নির্বাচিত স্থান",
          feature?.place_name || "স্থানটির ঠিকানা পাওয়া যায়নি"
        );
      } catch (error) {
        if (error.name === "AbortError") return;

        console.error("Reverse geocoding failed:", error);
        applyCoordinateResult("নির্বাচিত স্থান", "স্থানটির নাম পাওয়া যায়নি");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }

      return;
    }

    /* Normal place search */

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    resetSearchState();

    try {
      const center = mapTarget || defaultPosition;

      const url =
        `https://api.maptiler.com/geocoding/${encodeURIComponent(searchText)}.json` +
        `?key=${MAPTILER_KEY}` +
        `&country=in&autocomplete=true&fuzzyMatch=true` +
        `&proximity=${center[1]},${center[0]}` +
        `&limit=10` +
        `&bbox=${KOLKATA_BOUNDS.west},${KOLKATA_BOUNDS.south},` +
        `${KOLKATA_BOUNDS.east},${KOLKATA_BOUNDS.north}`;

      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`MapTiler error: ${response.status}`);
      }

      const data = await response.json();

      if (controller.signal.aborted) return;

      const kolkataResults = (data.features || []).filter(
        (feature) =>
          feature.center &&
          feature.center.length >= 2 &&
          isInsideKolkata(feature.center[1], feature.center[0])
      );

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
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  /* ===================================================
     USER LOCATION
  =================================================== */

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        // My Location-এর জন্য কোনো Kolkata boundary check নেই
        const location = [latitude, longitude];

        setUserLocation(location);
        setLocationAccuracy(accuracy);

        setClickedLocation(null);
        setSelectedLocation(null);

        setNearbyPlaces([]);
        setNearbyCategory(null);
        setNearbyError("");

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
     LIVE TRACKING
  =================================================== */

  const startLiveTracking = () => {
    if (!navigator.geolocation) {
      setTrackingError("Geolocation is not supported by your browser.");
      return;
    }

    if (trackingWatchRef.current !== null) return;

    setTrackingError("");
    setIsTracking(true);
    setTrackingPath([]);

    trackingWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const location = [latitude, longitude];

        setUserLocation(location);
        setLocationAccuracy(accuracy);
        setMapTarget(location);
        setTrackingError("");

        setTrackingPath((previousPath) => {
          const lastPoint = previousPath[previousPath.length - 1];

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
        let message = "Unable to track your live location.";

        if (error.code === 1) message = "Location permission was denied.";
        else if (error.code === 2) message = "Your current location is unavailable.";
        else if (error.code === 3) message = "Live location request timed out.";

        setTrackingError(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );
  };

  const stopLiveTracking = () => {
    if (trackingWatchRef.current !== null) {
      navigator.geolocation.clearWatch(trackingWatchRef.current);
      trackingWatchRef.current = null;
    }

    setIsTracking(false);
    setTrackingError("");
  };

  /* ===================================================
     SELECT SEARCH RESULT
  =================================================== */

  const selectLocation = (feature) => {
    if (!feature.center) return;

    const [longitude, latitude] = feature.center;

    if (!isInsideKolkata(latitude, longitude)) {
      alert("Selected location is outside the map region.");
      return;
    }

    const location = [latitude, longitude];

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
      name: feature.text || "Selected Location",
      address: feature.place_name || "",
    });

    setClickedLocation(null);
    setCopied(false);

    setNearbyPlaces([]);
    setNearbyError("");
    setNearbyCategory(null);

    setMapTarget(location);
    setQuery(feature.text || feature.place_name || "");
    setResults([]);
  };

  /* ===================================================
   MAP CLICK
=================================================== */

const reverseGeocodeName = useCallback(
  async (latitude, longitude) => {
    if (!MAPTILER_KEY) {
      return {
        name: "Dropped pin",
        address: "",
      };
    }

    try {
      const reverseUrl =
        `https://api.maptiler.com/geocoding/${longitude},${latitude}.json` +
        `?key=${MAPTILER_KEY}&language=bn,en&limit=1`;

      const response = await fetch(reverseUrl);

      if (!response.ok) {
        throw new Error(`Reverse geocoding failed: ${response.status}`);
      }

      const data = await response.json();
      const feature = data.features?.[0];

      return {
        name:
          feature?.text ||
          feature?.place_name ||
          feature?.text_bn ||
          feature?.place_name_bn ||
          "Dropped pin",
        address: feature?.place_name || feature?.place_name_bn || "",
      };
    } catch (error) {
      console.warn("Reverse geocoding unavailable:", error);
      return {
        name: "Dropped pin",
        address: "",
      };
    }
  },
  [MAPTILER_KEY]
);

const handleMapClick = async (location) => {
  if (pickMode) {
    const bounds = ZONE_BOUNDARIES[zone];

    if (!isInsideZone(location.latitude, location.longitude, bounds)) {
      alert(`Pin must stay inside ${zone}`);
      return;
    }

    // Place pin immediately, then resolve a human-readable name
    setClickedLocation({
      ...location,
      name: location.name || "Resolving location…",
      address: location.address || "",
    });

    const geo = await reverseGeocodeName(
      location.latitude,
      location.longitude
    );

    setClickedLocation((previous) => {
      if (
        !previous ||
        previous.latitude !== location.latitude ||
        previous.longitude !== location.longitude
      ) {
        return previous;
      }

      return {
        ...previous,
        name: geo.name,
        address: geo.address,
      };
    });

    return;
  }

  setClickedLocation(location);
  setSelectedLocation(null);
  setCopied(false);

  setNearbyPlaces([]);
  setNearbyError("");
  setNearbyCategory(null);
};

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
     CURRENT POSITION + CATEGORY
  =================================================== */

  const getCurrentSelectedPosition = useCallback(() => {
    if (selectedLocation) {
      return {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      };
    }

    if (clickedLocation) {
      return {
        latitude: clickedLocation.latitude,
        longitude: clickedLocation.longitude,
      };
    }

    if (userLocation) {
      return { latitude: userLocation[0], longitude: userLocation[1] };
    }

    return null;
  }, [selectedLocation, clickedLocation, userLocation]);

  const handleCategoryChange = (category) => {
    const location = getCurrentSelectedPosition();

    if (!location) {
      setNearbyError("Please select a location first.");
      return;
    }

    setNearbyCategory(category);
    getNearbyPlaces(location.latitude, location.longitude, category);
  };

  const filteredNearbyPlaces = useMemo(() => {
    if (!nearbyCategory) return [];

    return nearbyPlaces.filter((place) => place.category === nearbyCategory);
  }, [nearbyCategory, nearbyPlaces]);

  /* ===================================================
     STAFF ACTIONS
  =================================================== */

  const saveWorkUpdate = async (issue) => {
    const update = workUpdates[issue.id]?.trim();

    if (!update) {
      alert("Please write your work update first.");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/issues/${issue._id || issue.id}/comments`,
        {
          method: "POST",
          headers: getActorHeaders({ json: true }),
          body: JSON.stringify({ body: update }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Failed to save work update");
      }

      alert("Work update saved successfully!");

      setWorkUpdates((previous) => ({ ...previous, [issue.id]: "" }));
    } catch (error) {
      console.error("Save work update error:", error);
      alert(error.message || "Could not save work update.");
    }
  };

  const markIssueCompleted = async (issue) => {
    try {
      const response = await fetch(
        `${API_URL}/issues/${issue._id || issue.id}/status`,
        {
          method: "POST",
          headers: getActorHeaders({ json: true }),
          body: JSON.stringify({ status: "pending_review" }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Failed to update issue status");
      }

      const updatedIssue = result.data || result;

      // Keep the status lowercase so filters and button state stay consistent
      const patch = {
        ...updatedIssue,
        status: String(updatedIssue.status || "pending_review").toLowerCase(),
      };

      setAssignedIssues((previous) =>
        previous.map((item) =>
          matchesIssueId(item, issue.id) ? { ...item, ...patch } : item
        )
      );

      // Refresh the open panel too, otherwise it keeps showing the old status
      setSelectedStaffIssue((previous) =>
        previous && matchesIssueId(previous, issue.id)
          ? { ...previous, ...patch }
          : previous
      );

      alert("Issue sent for admin review!");
    } catch (error) {
      console.error("Mark completed error:", error);
      alert(error.message || "Could not update issue status.");
    }
  };

  /* Shared marker click handler for staff / admin */
  const openIssuePanel = useCallback(
    (issue) => {
      if (role === "admin") {
        setSelectedStaffIssue(null);
        setSelectedAdminIssue(issue);
      } else if (role === "staff") {
        setSelectedAdminIssue(null);
        setSelectedStaffIssue(issue);
      }
    },
    [role]
  );

  const issuesWithCoordinates = (issues) => issues.filter(hasValidCoordinates);

  // The URL pin is only a fallback: hide it when the same issue already has its own marker
  const urlIssueAlreadyHasMarker =
    (role === "staff" || role === "admin") &&
    assignedIssues.some(
      (item) => matchesIssueId(item, targetIssueId) && hasValidCoordinates(item)
    );

  /* ===================================================
     JSX
  =================================================== */

  return (
    <div className="map-view-container">
      <MapContainer
        center={defaultPosition}
        zoom={12}
        zoomControl={false}
        minZoom={11}
        maxZoom={18}
        maxBounds={[
          [22.35, 88.15],
          [22.8, 88.6],
        ]}
        maxBoundsViscosity={1.0}
        scrollWheelZoom={true}
        className="leaflet-full-height"
      >
        <PickModeController center={zoneConfig?.center} enabled={pickMode} />

        <IssueLocationController lat={issueLat} lng={issueLng} />

        <MapTargetController target={mapTarget} />

        {/* Fallback pin from URL (?lat=&lng=&issueId=) */}
        {Number.isFinite(issueLat) &&
          Number.isFinite(issueLng) &&
          !urlIssueAlreadyHasMarker && (
            <Marker
              position={[issueLat, issueLng]}
              eventHandlers={{
                click: () => {
                  const targetIssue = assignedIssues.find((item) =>
                    matchesIssueId(item, targetIssueId)
                  );

                  if (targetIssue) {
                    openIssuePanel(targetIssue);
                    return;
                  }

                  if (!targetIssueId) return;

                  openIssuePanel({
                    id: String(targetIssueId),
                    title: `Issue ${targetIssueId}`,
                    status: "submitted",
                    type: "Unknown",
                    description: "Loading full details…",
                    latitude: issueLat,
                    longitude: issueLng,
                  });

                  try {
                    fetch(`${API_URL}/issues`, {
                      method: "GET",
                      headers: getActorHeaders(),
                    })
                      .then((res) => res.json())
                      .then((payload) => {
                        const found = extractRows(payload).find((item) =>
                          matchesIssueId(item, targetIssueId)
                        );
                        if (found) openIssuePanel(normalizeIssue(found));
                      })
                      .catch((err) =>
                        console.error("Failed to load issue for panel:", err)
                      );
                  } catch (err) {
                    console.error("Auth/session error:", err);
                  }
                },
              }}
            />
          )}

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

        {role !== "admin" && <LocationPlaylist userLocation={userLocation} />}

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

       {/* Pick mode: selected marker */}
       {pickMode && clickedLocation && (
       <Marker position={clickedLocation.position}>
       <Popup>
         <strong>
           {clickedLocation.name || "Selected Location"}
         </strong>
          {clickedLocation.address ? (
          <>
          <br />
             <small>{clickedLocation.address}</small>
           </>
         ) : null}
        <br />
         {clickedLocation.latitude.toFixed(6)},{" "}
         {clickedLocation.longitude.toFixed(6)}
         </Popup>
      </Marker>
     )}

        {/* Pick mode: confirm button */}
{pickMode && clickedLocation && (
  <button
    className="pick-confirm-button"
    onClick={() => {
      if (!returnTo) return;

      const placeName =
        clickedLocation.name &&
        clickedLocation.name !== "Resolving location…"
          ? clickedLocation.name
          : clickedLocation.address ||
            `${zone || "Selected"} pin`;

      const params = new URLSearchParams({
        zone: zone || "",
        lat: clickedLocation.latitude.toFixed(6),
        lng: clickedLocation.longitude.toFixed(6),
        label: placeName,
      });

       window.location.href = `${returnTo}?${params.toString()}`;
      }}
     >
    Confirm{" "}
    {clickedLocation.name &&
    clickedLocation.name !== "Resolving location…"
      ? `"${clickedLocation.name}"`
      : "Location"}
      </button>
     )}

        {/* Live tracking path */}
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

        {/* Base layer */}
        <TileLayer
          key={baseLayer.id}
          url={baseLayer.url}
          attribution={baseLayer.attribution}
          keepBuffer={4}
        />

        {/* Layer selector */}
        {role === "admin" ? (
          <AdminLayerManager
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            showTraffic={showTraffic}
            onTrafficToggle={setShowTraffic}
          />
        ) : (
          <LayerSelector
            activeBaseLayer={baseLayer.id}
            onBaseLayerChange={(selectedLayer) => setBaseLayer(selectedLayer)}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            showTraffic={showTraffic}
            onTrafficToggle={setShowTraffic}
          />
        )}

        {/* City hub */}
        {activeFilters.cityHub && (
          <LayerGroup>
            <Marker position={[22.5726, 88.3639]}>
              <Popup>📍 Central Kolkata Command Hub</Popup>
            </Marker>
          </LayerGroup>
        )}

        {/* Staff locations (admin only) */}
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

        {/* User location */}
        <MyLocation
          userLocation={userLocation}
          locationAccuracy={locationAccuracy}
        />

        {/* Selected search location */}
        {activeFilters.selectedLocation && selectedLocation && (
          <Marker position={selectedLocation.position}>
            <Popup>
              <strong>🎯 {selectedLocation.name}</strong>
              <br />
              <small>{selectedLocation.address}</small>
              <br />
              <small>Lat: {selectedLocation.latitude.toFixed(6)}</small>
              <br />
              <small>Lng: {selectedLocation.longitude.toFixed(6)}</small>
              <br />
              <br />
              <button
                type="button"
                className="route-btn"
                onClick={() =>
                  getRoute({
                    latitude: selectedLocation.latitude,
                    longitude: selectedLocation.longitude,
                    name: selectedLocation.name,
                  })
                }
              >
                🚗 Get Route
              </button>
            </Popup>
          </Marker>
        )}

        {/* Clicked location */}
        {clickedLocation && (
          <Marker position={clickedLocation.position}>
            <Popup>
              <div className="clicked-popup-wrapper">
                <strong>📍 Selected Coordinates</strong>

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
                  className={`copy-btn ${copied ? "copied" : ""}`}
                  onClick={copyCoordinates}
                >
                  {copied ? "✓ Copied!" : "📋 Copy Coordinates"}
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
              </div>
            </Popup>
          </Marker>
        )}

        {/* ADMIN ISSUE MARKERS */}
        {role === "admin" &&
          activeFilters.issues &&
          issuesWithCoordinates(filteredAdminIssues).map((issue) => (
            <Marker
              key={`admin-issue-${issue.id}`}
              position={[issue.latitude, issue.longitude]}
              eventHandlers={{ click: () => openIssuePanel(issue) }}
            />
          ))}

        {/* STAFF ASSIGNED ISSUE MARKERS */}
        {role === "staff" &&
          showAssignedIssues &&
          issuesWithCoordinates(filteredAssignedIssues).map((issue) => (
            <Marker
              key={`staff-issue-${issue.id}`}
              position={[issue.latitude, issue.longitude]}
              eventHandlers={{ click: () => openIssuePanel(issue) }}
            />
          ))}

        {/* CITIZEN NEARBY ISSUE MARKERS (backend) - citizen only, so staff/admin never see duplicates */}
        {role === "user" && activeFilters.issues && (
          <LayerGroup>
            {backendIssues.map((raw) => {
              const issue = normalizeIssue(raw);

              if (!hasValidCoordinates(issue)) return null;

              return (
                <Marker
                  key={`backend-issue-${issue.id || raw._id}`}
                  position={[issue.latitude, issue.longitude]}
                />
              );
            })}
          </LayerGroup>
        )}

        {/* NEARBY PLACES */}
        {activeFilters.nearbyPlaces && (
          <NearbyPlaces
            places={filteredNearbyPlaces}
            createCategoryLeafletIcon={createCategoryLeafletIcon}
            getRoute={getRoute}
          />
        )}
      </MapContainer>

      {/* =================================================
          STAFF ISSUE PANEL
      ================================================= */}

      {role === "staff" && selectedStaffIssue && (
        <aside className="admin-issue-details-panel staff-issue-details-panel">
          <div className="admin-issue-panel-header">
            <div>
              <span className="admin-panel-eyebrow">ISSUE DETAILS</span>
              <h3>{selectedStaffIssue.title}</h3>
            </div>

            <button
              type="button"
              className="admin-panel-close"
              onClick={() => setSelectedStaffIssue(null)}
              aria-label="Close issue details"
            >
              ×
            </button>
          </div>

          <div className="admin-issue-panel-body">
            <div className="admin-detail-section">
              <span className="admin-detail-label">Status</span>
              <strong>{formatIssueStatus(selectedStaffIssue.status)}</strong>
            </div>

            <div className="admin-detail-section">
              <span className="admin-detail-label">Category</span>
              <p>{selectedStaffIssue.type || "Not specified"}</p>
            </div>

            <div className="admin-detail-section">
              <span className="admin-detail-label">Description</span>
              <p>
                {selectedStaffIssue.description || "No description provided."}
              </p>
            </div>

            <div className="admin-detail-section">
              <label
                className="admin-detail-label"
                htmlFor="staff-work-update"
              >
                Work Update
              </label>

              <textarea
                id="staff-work-update"
                value={workUpdates[selectedStaffIssue.id] || ""}
                onChange={(event) =>
                  setWorkUpdates((previous) => ({
                    ...previous,
                    [selectedStaffIssue.id]: event.target.value,
                  }))
                }
                placeholder="Write your work update..."
                rows={4}
              />
            </div>

            <div className="admin-detail-section">
              <label className="admin-detail-label" htmlFor="staff-evidence">
                Upload Evidence
              </label>

              <input
                id="staff-evidence"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;

                  setEvidenceFiles((previous) => ({
                    ...previous,
                    [selectedStaffIssue.id]: file,
                  }));
                }}
              />

              {evidenceFiles[selectedStaffIssue.id] && (
                <p>📎 {evidenceFiles[selectedStaffIssue.id].name}</p>
              )}
            </div>

            <div className="admin-issue-panel-actions">
              <button
                type="button"
                className="admin-route-btn"
                onClick={() => saveWorkUpdate(selectedStaffIssue)}
              >
                💾 Save Work Update
              </button>

              <button
                type="button"
                className="admin-copy-location-btn"
                disabled={
                  String(selectedStaffIssue.status).toLowerCase() !==
                  "in_progress"
                }
                onClick={() => markIssueCompleted(selectedStaffIssue)}
              >
                ✅ Mark Completed
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* =================================================
          ADMIN ISSUE PANEL
      ================================================= */}

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
            <div
              className={`admin-issue-status-badge ${
                COMPLETED_STATUSES.includes(
                  String(selectedAdminIssue.status || "").toLowerCase()
                )
                  ? "resolved"
                  : String(selectedAdminIssue.status || "").toLowerCase() ===
                    "in_progress"
                  ? "progress"
                  : "assigned"
              }`}
            >
              <span className="admin-status-badge-dot"></span>
              {formatIssueStatus(selectedAdminIssue.status)}
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
              <p>
                {selectedAdminIssue.description || "No description provided."}
              </p>
            </div>

            <div className="admin-detail-section">
              <span className="admin-detail-label">Location</span>
              <div className="admin-coordinate-box">
                <div>
                  <span>Latitude</span>
                  <strong>
                    {Number(selectedAdminIssue.latitude).toFixed(6)}
                  </strong>
                </div>
                <div>
                  <span>Longitude</span>
                  <strong>
                    {Number(selectedAdminIssue.longitude).toFixed(6)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="admin-issue-meta-list">
              <div>
                <span>👨‍🔧 Assigned Staff</span>
                <strong>
                  {resolveAssignedStaffName(selectedAdminIssue) ||
                    "Not assigned"}
                </strong>
              </div>

              <div>
                <span>🏙️ Ward / Zone</span>
                <strong>
                  {selectedAdminIssue.ward ||
                    selectedAdminIssue.zone ||
                    "Not available"}
                </strong>
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
                    `${Number(selectedAdminIssue.latitude).toFixed(6)}, ` +
                    `${Number(selectedAdminIssue.longitude).toFixed(6)}`;

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

      {/* =================================================
          STATUS FILTERS / ADMIN BARS
      ================================================= */}

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

    {/* Dynamic Stats Rendering */}
    {[
      { icon: "📍", value: adminIssueStats?.total, label: "Total Issues" },
      { icon: "🟡", value: adminIssueStats?.assigned, label: "Pending" },
      { icon: "🔵", value: adminIssueStats?.inProgress, label: "In Progress" },
      { icon: "✅", value: adminIssueStats?.completed, label: "Resolved" }
    ].map((stat, index) => (
      <div key={index} className="admin-status-item">
        <span>{stat.icon}</span>
        <div>
          <strong>{stat.value ?? 0}</strong>
          <small>{stat.label}</small>
        </div>
      </div>
    ))}

    {/* System Status (Fixed without isSystemOnline error) */}
    <div
      className={`admin-system-status ${
          isSystemOnline ? "online" : "offline"
      }`}
     >
       <span className="status-dot"></span>
       {isSystemOnline ? "System Operational" : "System Offline"}
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

      {(role === "staff" || role === "admin") && assignedIssuesLoading && (
        <div className="map-api-feedback" role="status">
          Loading issues from the backend…
        </div>
      )}

      {(role === "staff" || role === "admin") && assignedIssuesError && (
        <div className="map-api-feedback map-api-feedback-error" role="alert">
          Could not load assigned issues: {assignedIssuesError}
        </div>
      )}

      {backendIssuesLoading && (
        <div className="map-api-feedback" role="status">
          Loading nearby issues…
        </div>
      )}

      {backendIssuesError && (
        <div className="map-api-feedback map-api-feedback-error" role="alert">
          Could not load nearby issues: {backendIssuesError}
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
        showProfile={showProfile}
        setShowProfile={setShowProfile}
        currentUser={getUser()}
        onLogout={() => {
          logout();
          window.location.assign("/");
        }}
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