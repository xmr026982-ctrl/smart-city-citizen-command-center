import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  LayersControl,
  LayerGroup,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import { useState } from "react";

import "./MapView.css";

/* =====================================================
   DEFAULT MARKER ICON
===================================================== */

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,

  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

/* =====================================================
   USER LOCATION ICON
===================================================== */

const userIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,

  iconSize: [30, 46],
  iconAnchor: [15, 46],
  popupAnchor: [1, -40],
});

/* =====================================================
   SEARCH LOCATION COMPONENT
===================================================== */

function SearchLocation() {
  const map = useMap();

  /* =========================
     SEARCH STATE
  ========================= */

  const [query, setQuery] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [results, setResults] =
    useState([]);

  /* =========================
     USER LOCATION
  ========================= */

  const [userLocation, setUserLocation] =
    useState(null);

  const [locationLoading, setLocationLoading] =
    useState(false);

  /* =========================
     SELECTED LOCATION
  ========================= */

  const [selectedLocation, setSelectedLocation] =
    useState(null);

  /* =========================
     NEARBY PLACES
  ========================= */

  const [nearbyPlaces, setNearbyPlaces] =
    useState([]);

  const [nearbyLoading, setNearbyLoading] =
    useState(false);

  /* =========================
     CATEGORY
  ========================= */

  const [nearbyCategory, setNearbyCategory] =
    useState("all");

  /* =========================
     MAPTILER KEY
  ========================= */

  const MAPTILER_KEY =
    import.meta.env.VITE_MAPTILER_KEY;

  /* =====================================================
     GET USER LOCATION
  ===================================================== */

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
        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        const location = [
          latitude,
          longitude,
        ];

        setUserLocation(location);

        /*
          Move map to current GPS location
        */

        map.flyTo(
          location,
          16,
          {
            duration: 1.5,
          }
        );

        setLocationLoading(false);
      },

      (error) => {
        console.error(
          "Location error:",
          error
        );

        alert(
          "Location permission দেওয়া হয়নি বা location পাওয়া যাচ্ছে না."
        );

        setLocationLoading(false);
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  /* =====================================================
     GET NEARBY PLACES FROM OPENSTREETMAP
  ===================================================== */

  const getNearbyPlaces = async (
    latitude,
    longitude
  ) => {
    setNearbyLoading(true);

    try {
      /*
        Search radius:

        2500 meters = 2.5 KM
      */

      const radius = 2500;

      /*
        OpenStreetMap Overpass query

        We search:

        shop
        hospital
        pharmacy
        restaurant
        school
        bank
        atm
        cafe
        clinic
        supermarket
        etc.
      */

      const overpassQuery = `
        [out:json][timeout:25];

        (
          node
            ["shop"]
            (around:${radius},${latitude},${longitude});

          way
            ["shop"]
            (around:${radius},${latitude},${longitude});

          relation
            ["shop"]
            (around:${radius},${latitude},${longitude});

          node
            ["amenity"~"hospital|pharmacy|restaurant|school|bank|atm|cafe|clinic"]
            (around:${radius},${latitude},${longitude});

          way
            ["amenity"~"hospital|pharmacy|restaurant|school|bank|atm|cafe|clinic"]
            (around:${radius},${latitude},${longitude});

          relation
            ["amenity"~"hospital|pharmacy|restaurant|school|bank|atm|cafe|clinic"]
            (around:${radius},${latitude},${longitude});
        );

        out center tags;
      `;

      const response = await fetch(
        "https://overpass-api.de/api/interpreter",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body:
            "data=" +
            encodeURIComponent(
              overpassQuery
            ),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Nearby places request failed"
        );
      }

      const data =
        await response.json();

      console.log(
        "Nearby OSM Places:",
        data
      );

      /* =================================================
         CONVERT OSM RESULTS
      ================================================= */

      const places = data.elements
        .map((item) => {
          let latitude;
          let longitude;

          /*
            Node
          */

          if (
            item.lat !== undefined &&
            item.lon !== undefined
          ) {
            latitude = item.lat;
            longitude = item.lon;
          }

          /*
            Way / Relation
          */

          else if (item.center) {
            latitude =
              item.center.lat;

            longitude =
              item.center.lon;
          }

          if (
            latitude === undefined ||
            longitude === undefined
          ) {
            return null;
          }

          const tags =
            item.tags || {};

          /* =========================
             NAME
          ========================= */

          const name =
            tags.name ||
            tags["name:en"] ||
            "Unnamed Place";

          /* =========================
             CATEGORY
          ========================= */

          let category =
            "other";

          if (tags.shop) {
            category = "shop";
          }

          if (tags.amenity) {
            category =
              tags.amenity;
          }

          return {
            id: `${item.type}-${item.id}`,

            latitude,

            longitude,

            name,

            category,

            address:
              tags["addr:street"] ||
              tags["addr:place"] ||
              tags["addr:city"] ||
              "",

            phone:
              tags.phone ||
              tags["contact:phone"] ||
              "",

            website:
              tags.website ||
              tags["contact:website"] ||
              "",
          };
        })
        .filter(Boolean);

      /* =================================================
         REMOVE DUPLICATES
      ================================================= */

      const uniquePlaces = [];

      const seen = new Set();

      places.forEach((place) => {
        const key =
          `${place.name}-${place.latitude.toFixed(
            5
          )}-${place.longitude.toFixed(5)}`;

        if (!seen.has(key)) {
          seen.add(key);

          uniquePlaces.push(place);
        }
      });

      setNearbyPlaces(
        uniquePlaces
      );

      console.log(
        "Processed Nearby Places:",
        uniquePlaces
      );
    } catch (error) {
      console.error(
        "Nearby places error:",
        error
      );

      /*
        Do not show scary error every time.
        Just keep map working.
      */

      setNearbyPlaces([]);
    } finally {
      setNearbyLoading(false);
    }
  };

  /* =====================================================
     LOCATION SEARCH
  ===================================================== */

  const handleSearch = async (e) => {
    e.preventDefault();

    const searchText =
      query.trim();

    if (!searchText) {
      return;
    }

    if (!MAPTILER_KEY) {
      alert(
        "MapTiler API key is missing"
      );

      return;
    }

    setLoading(true);

    setResults([]);

    /*
      Hide old nearby places
      when a new search starts.
    */

    setNearbyPlaces([]);

    try {
      /* =================================================
         CURRENT MAP CENTER

         IMPORTANT:

         This is NOT GPS.

         It only tells MapTiler which area
         should get priority.
      ================================================= */

      const mapCenter =
        map.getCenter();

      const longitude =
        mapCenter.lng;

      const latitude =
        mapCenter.lat;

      /* =================================================
         MAPTILER SEARCH

         types:

         place
         locality
         neighbourhood
         address
         poi
      ================================================= */

      const url =
        `https://api.maptiler.com/geocoding/` +
        `${encodeURIComponent(searchText)}.json` +
        `?key=${MAPTILER_KEY}` +
        `&country=in` +
        `&autocomplete=false` +
        `&fuzzyMatch=true` +
        `&proximity=${longitude},${latitude}` +
        `&types=place,locality,neighbourhood,address,poi` +
        `&limit=10`;

      console.log(
        "Location Search:",
        searchText
      );

      console.log(
        "Search Proximity:",
        longitude,
        latitude
      );

      const response =
        await fetch(url);

      if (!response.ok) {
        throw new Error(
          "Search request failed"
        );
      }

      const data =
        await response.json();

      console.log(
        "MapTiler Search Result:",
        data
      );

      if (
        !data.features ||
        data.features.length === 0
      ) {
        alert(
          "Location not found"
        );

        return;
      }

      /* =================================================
         CUSTOM RANKING
      ================================================= */

      const searchLower =
        searchText.toLowerCase();

      const sortedResults = [
        ...data.features,
      ].sort((a, b) => {
        const aText =
          (
            a.text || ""
          ).toLowerCase();

        const bText =
          (
            b.text || ""
          ).toLowerCase();

        const aPlace =
          (
            a.place_name || ""
          ).toLowerCase();

        const bPlace =
          (
            b.place_name || ""
          ).toLowerCase();

        let scoreA = 0;

        let scoreB = 0;

        /* =========================
           EXACT NAME
        ========================= */

        if (
          aText === searchLower
        ) {
          scoreA += 1000;
        }

        if (
          bText === searchLower
        ) {
          scoreB += 1000;
        }

        /* =========================
           STARTS WITH
        ========================= */

        if (
          aText.startsWith(
            searchLower
          )
        ) {
          scoreA += 500;
        }

        if (
          bText.startsWith(
            searchLower
          )
        ) {
          scoreB += 500;
        }

        /* =========================
           CONTAINS
        ========================= */

        if (
          aText.includes(
            searchLower
          )
        ) {
          scoreA += 250;
        }

        if (
          bText.includes(
            searchLower
          )
        ) {
          scoreB += 250;
        }

        /* =========================
           PLACE NAME
        ========================= */

        if (
          aPlace.includes(
            searchLower
          )
        ) {
          scoreA += 150;
        }

        if (
          bPlace.includes(
            searchLower
          )
        ) {
          scoreB += 150;
        }

        /* =========================
           MAPTILER RELEVANCE
        ========================= */

        scoreA +=
          (a.relevance || 0) *
          100;

        scoreB +=
          (b.relevance || 0) *
          100;

        return (
          scoreB - scoreA
        );
      });

      setResults(
        sortedResults
      );
    } catch (error) {
      console.error(
        "Search error:",
        error
      );

      alert(
        "Unable to search location"
      );
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     SELECT LOCATION
  ===================================================== */

  const selectLocation = async (
    feature
  ) => {
    if (!feature.center) {
      return;
    }

    const [
      longitude,
      latitude,
    ] = feature.center;

    const location = [
      latitude,
      longitude,
    ];

    /* =================================================
       SAVE SELECTED LOCATION
    ================================================= */

    const selected = {
      position: location,

      latitude,

      longitude,

      name:
        feature.text ||
        feature.place_name ||
        "Selected Location",

      address:
        feature.place_name ||
        "",
    };

    setSelectedLocation(
      selected
    );

    /* =================================================
       MOVE MAP
    ================================================= */

    map.flyTo(
      location,
      16,
      {
        duration: 1.5,
      }
    );

    /* =================================================
       UPDATE SEARCH BOX
    ================================================= */

    setQuery(
      feature.text ||
      feature.place_name ||
      ""
    );

    /* =================================================
       CLOSE LOCATION RESULTS
    ================================================= */

    setResults([]);

    /* =================================================
       SEARCH NEARBY PLACES
    ================================================= */

    await getNearbyPlaces(
      latitude,
      longitude
    );
  };

  /* =====================================================
     FILTER NEARBY PLACES
  ===================================================== */

  const filteredNearbyPlaces =
    nearbyPlaces.filter(
      (place) => {
        if (
          nearbyCategory ===
          "all"
        ) {
          return true;
        }

        if (
          nearbyCategory ===
          "shop"
        ) {
          return (
            place.category ===
            "shop"
          );
        }

        return (
          place.category ===
          nearbyCategory
        );
      }
    );

  /* =====================================================
     RETURN UI
  ===================================================== */

  return (
    <>
      {/* =================================================
          USER LOCATION MARKER
      ================================================= */}

      {userLocation && (
        <Marker
          position={userLocation}
          icon={userIcon}
        >
          <Popup>
            <strong>
              📍 Your Location
            </strong>

            <br />

            Current device location
          </Popup>
        </Marker>
      )}

      {/* =================================================
          SELECTED LOCATION MARKER
      ================================================= */}

      {selectedLocation && (
        <Marker
          position={
            selectedLocation.position
          }
          icon={defaultIcon}
        >
          <Popup>
            <strong>
              📍{" "}
              {selectedLocation.name}
            </strong>

            <br />

            {selectedLocation.address}
          </Popup>
        </Marker>
      )}

      {/* =================================================
          NEARBY PLACE MARKERS
      ================================================= */}

      {filteredNearbyPlaces.map(
        (place) => (
          <Marker
            key={place.id}
            position={[
              place.latitude,
              place.longitude,
            ]}
            icon={defaultIcon}
          >
            <Popup>
              <strong>
                📍 {place.name}
              </strong>

              <br />

              <span>
                {place.category}
              </span>

              {place.address && (
                <>
                  <br />
                  <small>
                    {place.address}
                  </small>
                </>
              )}

              {place.phone && (
                <>
                  <br />
                  📞 {place.phone}
                </>
              )}

              {place.website && (
                <>
                  <br />

                  <a
                    href={
                      place.website
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Website
                  </a>
                </>
              )}
            </Popup>
          </Marker>
        )
      )}

      {/* =================================================
          SEARCH UI
      ================================================= */}

      <div className="map-search-box">

        {/* =================================================
            LOCATION SEARCH
        ================================================= */}

        <form
          onSubmit={handleSearch}
        >
          <input
            type="text"
            placeholder="Search location..."
            value={query}
            onChange={(e) => {
              setQuery(
                e.target.value
              );
            }}
          />

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
            NEARBY PLACES PANEL
        ================================================= */}

        {selectedLocation && (
          <div className="nearby-panel">

            <div className="nearby-header">
              <strong>
                Nearby Places
              </strong>

              {nearbyLoading && (
                <span>
                  Loading...
                </span>
              )}
            </div>

            {/* =================================================
                CATEGORY FILTER
            ================================================= */}

            <div className="nearby-filters">

              <button
                type="button"
                className={
                  nearbyCategory ===
                  "all"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setNearbyCategory(
                    "all"
                  )
                }
              >
                All
              </button>

              <button
                type="button"
                className={
                  nearbyCategory ===
                  "shop"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setNearbyCategory(
                    "shop"
                  )
                }
              >
                🛍️ Shops
              </button>

              <button
                type="button"
                className={
                  nearbyCategory ===
                  "hospital"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setNearbyCategory(
                    "hospital"
                  )
                }
              >
                🏥 Hospital
              </button>

              <button
                type="button"
                className={
                  nearbyCategory ===
                  "pharmacy"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setNearbyCategory(
                    "pharmacy"
                  )
                }
              >
                💊 Pharmacy
              </button>

              <button
                type="button"
                className={
                  nearbyCategory ===
                  "restaurant"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setNearbyCategory(
                    "restaurant"
                  )
                }
              >
                🍴 Restaurant
              </button>

              <button
                type="button"
                className={
                  nearbyCategory ===
                  "school"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setNearbyCategory(
                    "school"
                  )
                }
              >
                🏫 School
              </button>

              <button
                type="button"
                className={
                  nearbyCategory ===
                  "bank"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setNearbyCategory(
                    "bank"
                  )
                }
              >
                🏦 Bank
              </button>

            </div>

            {/* =================================================
                RESULT COUNT
            ================================================= */}

            {!nearbyLoading && (
              <small className="nearby-count">
                {filteredNearbyPlaces.length}{" "}
                places found within
                2.5 km
              </small>
            )}

          </div>
        )}

      </div>
    </>
  );
}

/* =====================================================
   MAP VIEW
===================================================== */

function MapView() {
  const defaultPosition = [
    22.5726,
    88.3639,
  ];

  return (
    <div className="map-view">

      <MapContainer
        center={defaultPosition}
        zoom={12}
        scrollWheelZoom={true}
        style={{
          width: "100%",
          height: "100%",
        }}
      >

        {/* =================================================
            SEARCH / MARKERS
        ================================================= */}

        <SearchLocation />

        {/* =================================================
            MAP LAYERS
        ================================================= */}

        <LayersControl
          position="topright"
        >

          {/* =================================================
              STREETS
          ================================================= */}

          <LayersControl.BaseLayer
            checked
            name="Streets"
          >
            <TileLayer
              url={`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${
                import.meta.env
                  .VITE_MAPTILER_KEY
              }`}
              attribution="&copy; MapTiler &copy; OpenStreetMap contributors"
            />
          </LayersControl.BaseLayer>

          {/* =================================================
              SATELLITE
          ================================================= */}

          <LayersControl.BaseLayer
            name="Satellite"
          >
            <TileLayer
              url={`https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${
                import.meta.env
                  .VITE_MAPTILER_KEY
              }`}
              attribution="&copy; MapTiler &copy; OpenStreetMap contributors"
            />
          </LayersControl.BaseLayer>

          {/* =================================================
              CITY ISSUES
          ================================================= */}

          <LayersControl.Overlay
            checked
            name="City Issues"
          >
            <LayerGroup>

              <Marker
                position={[
                  22.5726,
                  88.3639,
                ]}
                icon={defaultIcon}
              >
                <Popup>
                  <strong>
                    📍 Kolkata City Center
                  </strong>

                  <br />

                  Example city location.
                </Popup>
              </Marker>

            </LayerGroup>
          </LayersControl.Overlay>

        </LayersControl>

      </MapContainer>

    </div>
  );
}

export default MapView;