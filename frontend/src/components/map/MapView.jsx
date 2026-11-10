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

import { fetchIssues } from "./mapApi";


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
import { useNavigate } from "react-router-dom";
import { searchCity } from "./mapLocalSearch";
import LayerSelector from "./LayerSelector";
import ZONE_BOUNDARIES from "./zoneBoundaries";
import { useAllIssues } from "../../store/issueStore";
import { mapNotify } from "./mapNotify";
import ZoneFollow, { startView } from "./overlays/ZoneFollow"; // integration: top bar zone ↔ map
import IssuePins from "./overlays/IssuePins"; // integration: clear status pins for every role
import IssueCard from "./overlays/IssueCard"; // integration: one issue card for every role
import { PickNearby, TodayRoute, ZoneBreach, CommunityMarkers } from "./overlays/MapExtras"; // integration: nearby check, today's route, breach overlay, community layer
import { MapPin, Navigation, Copy, Check, Crosshair, Building2 } from "lucide-react";
import { CATEGORY_SVG } from "./mapIcons";

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

const OSRM_SERVER = "https://router.project-osrm.org/route/v1/driving";

/* the board's stages: command filters the map's pins by each (field crews see all of theirs) */
const STAGES = {
  new: ["submitted"],
  assigned: ["acknowledged"],
  working: ["in_progress"],
  confirm: ["pending_review"],
  resolved: ["resolved", "completed"],
};
export const ADMIN_STAGES = [
  { id: "all", label: "All" },
  { id: "new", label: "New", status: "submitted" },
  { id: "assigned", label: "Assigned", status: "acknowledged" },
  { id: "working", label: "In progress", status: "in_progress" },
  { id: "confirm", label: "To confirm", status: "pending_review" },
  { id: "resolved", label: "Resolved", status: "resolved" },
];


/* =====================================================
   ZONE CONFIG
===================================================== */

const ZONE_CONFIG = {
  Shyambazar: { center: [22.599, 88.373], bounds: null },
  "B.B.D. Bagh": { center: [22.573, 88.348], bounds: null },
  Ballygunge: { center: [22.527, 88.363], bounds: null },
  "College Street": { center: [22.575, 88.363], bounds: null },
  "B.P. Township": { center: [22.4722, 88.3878], bounds: null }, // integration: the township's real centre (Baishnabghata Patuli)
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

const getCategoryIcon = (category) => CATEGORY_SVG[category] || CATEGORY_SVG.other;

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

/* integration: Leaflet draws before its box has its final size inside the app
   layout (grey gaps); redraw whenever the box changes size */
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const box = map.getContainer();
    const fix = () => map.invalidateSize({ pan: false });
    const t = setTimeout(fix, 60);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fix) : null;
    if (box instanceof Element) ro?.observe(box);
    return () => { clearTimeout(t); ro?.disconnect(); };
  }, [map]);
  return null;
}

export default function MapView({ role: roleProp = "user", onReportIssue }) {
  const navigate = useNavigate(); // integration: in-app navigation, no full reloads
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
  // integration: the first view is decided before the map draws, so it opens in place (no jump)
  const firstView = useMemo(
    () => startView({ pickZone: pickMode ? zone : "", pickCenter: ZONE_CONFIG[zone]?.center, lat: issueLat, lng: issueLng, fallback: DEFAULT_POSITION }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

  const [baseLayer, setBaseLayer] = useState({
    id: "Streets",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  });

  /* ---------- Refs ---------- */
  const nearbyAbortRef = useRef(null);
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

  /* ---------- Filters ---------- */
  const [showFilters, setShowFilters] = useState(false);

  const [activeFilters, setActiveFilters] = useState({
    cityHub: true,
    selectedLocation: true,
    nearbyPlaces: true,
    issues: true,
    breach: true, // integration: admin zone breach overlay
    community: true, // integration: community layer (proposals, announcements)
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
  const [adminStatusFilter, setAdminStatusFilter] = useState("all");
  const [selectedAdminIssue, setSelectedAdminIssue] = useState(null);
  const [selectedStaffIssue, setSelectedStaffIssue] = useState(null);
  const [citizenIssue, setCitizenIssue] = useState(null); // integration: citizens get the issue card too
  const [layerClose, setLayerClose] = useState(0); // integration: an open issue card closes the map-types panel
  const [routeCardOpen, setRouteCardOpen] = useState(true); // integration: the route card can be hidden and brought back
  const [assignedIssues, setAssignedIssues] = useState([]);
  const [, setAssignedIssuesLoading] = useState(false);
  const [assignedIssuesError, setAssignedIssuesError] = useState("");

  const matchesIssueFilter = useCallback((issue, filter) => {
    if (!filter || filter === "all") return true;
    return (STAGES[filter] || []).includes(String(issue.status || "").toLowerCase());
  }, []);

  /* one count per chip; the chips add up to the total (removed files aren't on the board) */
  const stageCounts = useMemo(() => {
    const live = assignedIssues.filter((issue) => !issue.removed);
    const out = { all: live.length };
    Object.keys(STAGES).forEach((k) => { out[k] = live.filter((issue) => matchesIssueFilter(issue, k)).length; });
    return out;
  }, [assignedIssues, matchesIssueFilter]);

  /* ===================================================
     OPEN ISSUE FROM URL (?issueId=...&lat=...&lng=...)
     Staff and admin here; citizens just below the board loader.
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
        setAdminStatusFilter("all");
      } else {
        setSelectedAdminIssue(null);
        setSelectedStaffIssue(issue);
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

    // not on this desk's board (another crew's file, or an old link): say so; the pin marks the link's spot
    if (assignedIssues.length) {
      if (Number.isFinite(issueLat) && Number.isFinite(issueLng)) setMapTarget([issueLat, issueLng]);
      mapNotify(`${targetIssueId} isn't on your desk's board.${Number.isFinite(issueLat) ? " The pin marks the spot from the link." : ""}`);
    }
    return undefined;
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
        mapNotify("Use My location first, so the route has a start.");
        return;
      }

      const [userLatitude, userLongitude] = userLocation;

      const {
        latitude: destinationLatitude,
        longitude: destinationLongitude,
        name = "Destination",
      } = destination;

      if (!isInsideKolkata(destinationLatitude, destinationLongitude)) {
        mapNotify("That destination is outside Kolkata.");
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
        setRouteError("No route found right now. Try again in a moment.");
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
     ASSIGNED ISSUES (STAFF / ADMIN)
  =================================================== */

  
const board = useAllIssues();
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
}, [role, board]);

/* citizens: a link to an issue (from Community, Notifications, My Reports)
   opens its card too: their own report in full, anyone else's as the public card */
useEffect(() => {
  if (role !== "user" || !targetIssueId) return;
  const found = board.find((i) => matchesIssueId(i, targetIssueId) && !i.removed);
  if (found) setCitizenIssue({ ...found, latitude: found.lat, longitude: found.lng });
  else mapNotify(`${targetIssueId} isn't on the city board any more.`);
  // the link is read once; the board updating later must not reopen a card you closed
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [role, targetIssueId]);


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
      mapNotify("The coordinates couldn't be copied.");
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
        setNearbyError("That spot is outside Kolkata.");
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
          "The places service is slow right now. Try again in a moment."
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
        mapNotify("Those coordinates aren't valid.");
        return;
      }

      if (!isInsideKolkata(latitude, longitude)) {
        mapNotify("Those coordinates are outside Kolkata.");
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

    // integration: without a MapTiler key, search the city's zones and open issues
    if (!MAPTILER_KEY) {
      const local = searchCity(searchText);
      setLoading(false);
      if (!local.length) mapNotify("No zone, landmark or open issue matches that. Try a zone name like College Street.");
      else setResults(local);
      return;
    }

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
        mapNotify("Nothing found inside Kolkata for that search.");
        return;
      }

      setResults(kolkataResults);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Location search failed:", error);
        mapNotify("Search isn't answering right now. Try again in a moment.");
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
      mapNotify("This browser can't share its location.");
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
        mapNotify("Location is off for this site, or took too long. Allow it in the browser and try again.");
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
      setTrackingError("This browser can't share its location.");
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
        let message = "Tracking stopped. Try again.";

        if (error.code === 1) message = "Location is off for this site. Allow it in the browser to track.";
        else if (error.code === 2) message = "This device can't find its location right now.";
        else if (error.code === 3) message = "Finding your location took too long. Try again outdoors or near a window.";

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
      mapNotify("That spot is outside the map.");
      return;
    }

    const location = [latitude, longitude];

    if (pickMode) {
      const bounds = ZONE_BOUNDARIES[zone];

      if (!isInsideZone(latitude, longitude, bounds)) {
        mapNotify(`Keep the pin inside ${zone}`);
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
      mapNotify(`Keep the pin inside ${zone}`);
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
      setNearbyError("Search a place, drop a pin, or use My location first.");
      return;
    }

    setNearbyCategory(category);
    getNearbyPlaces(location.latitude, location.longitude, category);
  };

  const filteredNearbyPlaces = useMemo(() => {
    if (!nearbyCategory) return [];

    return nearbyPlaces.filter((place) => place.category === nearbyCategory);
  }, [nearbyCategory, nearbyPlaces]);

  /* Shared marker click handler for staff / admin */
  const openIssuePanel = useCallback(
    (issue) => {
      setLayerClose((n) => n + 1); // one right-hand panel at a time
      if (role === "admin") {
        setSelectedStaffIssue(null);
        setSelectedAdminIssue(issue);
      } else if (role === "staff") {
        setSelectedAdminIssue(null);
        setSelectedStaffIssue(issue);
      } else {
        setCitizenIssue(issue);
      }
    },
    [role]
  );

  // integration: the card and the pins speak in board ids
  const cardIssue = role === "admin" ? selectedAdminIssue : role === "staff" ? selectedStaffIssue : citizenIssue;
  const closeCard = useCallback(() => { setSelectedAdminIssue(null); setSelectedStaffIssue(null); setCitizenIssue(null); }, []);
  const pinFilter = useCallback(
    (issue) => (role === "admin" ? matchesIssueFilter(issue, adminStatusFilter) : true),
    [role, adminStatusFilter, matchesIssueFilter]
  );
  const routeTo = useCallback((dest) => { setRouteCardOpen(true); getRoute(dest); }, [getRoute]);

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
        attributionControl={false}
        center={firstView.center}
        zoom={firstView.zoom}
        zoomControl={false}
        minZoom={11}
        maxZoom={19}
        maxBounds={[
          [22.35, 88.15],
          [22.8, 88.6],
        ]}
        maxBoundsViscosity={1.0}
        scrollWheelZoom={true}
        className="leaflet-full-height"
      >
        <InvalidateOnResize />
        <PickModeController center={zoneConfig?.center} enabled={pickMode} />

        <IssueLocationController lat={issueLat} lng={issueLng} />

        <MapTargetController target={mapTarget} />

        {/* integration: the top bar's zone moves the map; an issue / coordinates / pick target holds it */}
        <ZoneFollow
          pick={pickMode}
          hold={pickMode ? firstView.center : Number.isFinite(issueLat) && Number.isFinite(issueLng) ? [issueLat, issueLng] : null}
          holdZone={pickMode ? zone || "" : searchParams.get("zone") || ""}
        />

        {/* Fallback pin from URL (?lat=&lng=&issueId=) */}
        {Number.isFinite(issueLat) &&
          Number.isFinite(issueLng) &&
          !urlIssueAlreadyHasMarker && (
            <Marker
              position={[issueLat, issueLng]}
              eventHandlers={{
                click: () => {
                  const targetIssue = assignedIssues.find((item) => matchesIssueId(item, targetIssueId));
                  if (targetIssue) openIssuePanel(targetIssue);
                  else mapNotify(`${targetIssueId || "This file"} isn't on your desk's board. The pin marks the spot from the link.`);
                },
              }}
            />
          )}

        {pickMode && (
          <div className="pick-mode-bar">
            <MapPin size={14} aria-hidden /> <b>{zone || "Your zone"}</b> · tap the map inside this zone to drop the pin
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


        {showTraffic && <TrafficLayer />}

        {/* Route */}
        {!pickMode && (
          <RouteLayer
            onDestinationClick={() => setRouteCardOpen(true)}
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

       navigate(`${returnTo}?${params.toString()}`);
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
          maxZoom={19}
          maxNativeZoom={baseLayer.maxNativeZoom || 19}
        />
        {/* integration: satellite with street and place names on top */}
        {baseLayer.labels ? baseLayer.labels.map((u) => <TileLayer key={u} url={u} maxZoom={19} maxNativeZoom={19} pane="overlayPane" />) : null}

        {/* Layer selector */}
          <LayerSelector
            closeSignal={layerClose}
            onOpen={closeCard}
            showBreachToggle={role === "admin"}
            showCommunityToggle
            activeBaseLayer={baseLayer.id}
            onBaseLayerChange={(selectedLayer) => setBaseLayer(selectedLayer)}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            showTraffic={showTraffic}
            onTrafficToggle={setShowTraffic}
          />


        {/* City hub */}
        {activeFilters.cityHub && (
          <LayerGroup>
            <Marker position={[22.5726, 88.3639]}>
              <Popup><strong className="pop-title"><Building2 size={13} aria-hidden /> Central Kolkata Command Hub</strong></Popup>
            </Marker>
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
              <strong className="pop-title"><Crosshair size={13} aria-hidden /> {selectedLocation.name}</strong>
              {selectedLocation.address ? <small className="pop-sub">{selectedLocation.address}</small> : null}
              <small className="pop-coord">{selectedLocation.latitude.toFixed(5)}, {selectedLocation.longitude.toFixed(5)}</small>
              <button
                type="button"
                className="route-btn"
                onClick={() =>
                  routeTo({
                    latitude: selectedLocation.latitude,
                    longitude: selectedLocation.longitude,
                    name: selectedLocation.name,
                  })
                }
              >
                <Navigation size={13} aria-hidden /> Route here
              </button>
            </Popup>
          </Marker>
        )}

        {/* Clicked location */}
        {clickedLocation && (
          <Marker position={clickedLocation.position}>
            <Popup>
              <div className="clicked-popup-wrapper">
                <strong className="pop-title"><MapPin size={13} aria-hidden /> Dropped pin</strong>

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
                  {copied ? <><Check size={13} aria-hidden /> Copied</> : <><Copy size={13} aria-hidden /> Copy coordinates</>}
                </button>

                <button
                  type="button"
                  className="route-btn"
                  onClick={() =>
                    routeTo({
                      latitude: clickedLocation.latitude,
                      longitude: clickedLocation.longitude,
                      name: "Selected Location",
                    })
                  }
                >
                  <Navigation size={13} aria-hidden /> Route here
                </button>
              </div>
            </Popup>
          </Marker>
        )}

        {/* integration: citizen pinning → "already reported nearby"; field → today's route; admin → zone breach overlay */}
        {pickMode ? <PickNearby spot={clickedLocation} category={searchParams.get("category") || ""} /> : null}
        {role === "staff" && !pickMode ? <TodayRoute userLocation={userLocation} onRoute={routeTo} hidden={routeCardOpen && Boolean(routeInfo || routeLoading || routeError)} /> : null}
        {role === "admin" && !pickMode && activeFilters.breach !== false ? <ZoneBreach /> : null}
        {!pickMode && activeFilters.community !== false ? <CommunityMarkers /> : null}

        {/* integration: ISSUE PINS for every role (admin all, staff own files,
            citizen own reports + quiet public dots), straight from the board */}
        {!pickMode && (role !== "admin" || activeFilters.issues) && (role !== "staff" || showAssignedIssues) && (
          <IssuePins
            role={role}
            selectedId={cardIssue ? String(cardIssue.id) : null}
            onSelect={(issue) => openIssuePanel({ ...issue, latitude: issue.lat, longitude: issue.lng })}
            keep={pinFilter}
          />
        )}

        {/* NEARBY PLACES */}
        {activeFilters.nearbyPlaces && (
          <NearbyPlaces
            places={filteredNearbyPlaces}
            createCategoryLeafletIcon={createCategoryLeafletIcon}
            getRoute={routeTo}
          />
        )}
      </MapContainer>

      {/* integration: one issue card for every role (replaces the staff and admin panels) */}
      {cardIssue ? (
        <IssueCard role={role} issueId={String(cardIssue.id)} onClose={closeCard} onRoute={routeTo} />
      ) : null}

      {/* =================================================
          STATUS FILTERS / ADMIN BARS
      ================================================= */}

      {/* admin: the stage chips carry the counts, filter the pins, and open All Issues */}

      {role === "admin" && (
        <div className="admin-city-status-bar">
          <div className="admin-status-title">
            <span className="status-dot" />
            <div><strong>City operations</strong><small>Tap a stage to filter the pins</small></div>
          </div>
          <div className="map-stage-chips admin" role="group" aria-label="Filter the pins by stage">
            {ADMIN_STAGES.map((st) => (
              <button key={st.id} type="button" className={`st-${st.id}${adminStatusFilter === st.id ? " on" : ""}`} aria-pressed={adminStatusFilter === st.id} onClick={() => setAdminStatusFilter(st.id)}>
                <i aria-hidden /><strong>{stageCounts[st.id] ?? 0}</strong><small>{st.label}</small>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ops-open-all"
            onClick={() => navigate("/admin/queue", { state: ADMIN_STAGES.find((x) => x.id === adminStatusFilter)?.status ? { status: ADMIN_STAGES.find((x) => x.id === adminStatusFilter).status } : {} })}
            title="Open these files in All Issues"
          >
            Open in All Issues
          </button>
        </div>
      )}

      {(role === "staff" || role === "admin") && assignedIssuesError && (
        <div className="map-api-feedback map-api-feedback-error" role="alert">
          The issue pins couldn't load. Reload the page to try again.
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
        routeCardOpen={routeCardOpen}
        onRouteCardClose={() => setRouteCardOpen(false)}
        getRoute={routeTo}
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