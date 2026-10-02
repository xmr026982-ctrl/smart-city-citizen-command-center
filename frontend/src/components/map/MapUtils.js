// --------------------------------------------------
// Import Kolkata GeoJSON
// --------------------------------------------------

import kolkataGeoJSONRaw from "../../data/kolkata.geojson?raw";

const kolkataGeoJSON = JSON.parse(kolkataGeoJSONRaw);


// --------------------------------------------------
// Kolkata map bounds
// --------------------------------------------------

export const KOLKATA_BOUNDS = {
  south: 22.35,
  north: 22.80,
  west: 88.15,
  east: 88.60,
};


// --------------------------------------------------
// Point inside ring
// --------------------------------------------------

const isPointInRing = (point, ring) => {
  const [x, y] = point;

  let inside = false;

  for (
    let i = 0, j = ring.length - 1;
    i < ring.length;
    j = i++
  ) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const intersect =
      yi > y !== yj > y &&
      x <
        ((xj - xi) * (y - yi)) / (yj - yi) +
          xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
};


// --------------------------------------------------
// Polygon
// --------------------------------------------------

const isPointInPolygon = (point, coordinates) => {
  if (!coordinates?.length) {
    return false;
  }

  // Outer boundary
  if (!isPointInRing(point, coordinates[0])) {
    return false;
  }

  // Holes
  for (let i = 1; i < coordinates.length; i++) {
    if (isPointInRing(point, coordinates[i])) {
      return false;
    }
  }

  return true;
};


// --------------------------------------------------
// Polygon / MultiPolygon
// --------------------------------------------------

const isPointInsideGeometry = (
  latitude,
  longitude,
  geometry
) => {
  if (!geometry) {
    return false;
  }

  // GeoJSON coordinates = [longitude, latitude]
  const point = [longitude, latitude];

  if (geometry.type === "Polygon") {
    return isPointInPolygon(
      point,
      geometry.coordinates
    );
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) =>
      isPointInPolygon(point, polygon)
    );
  }

  return false;
};


// --------------------------------------------------
// FINAL Kolkata boundary check
// --------------------------------------------------

export const isInsideKolkata = (
  latitude,
  longitude
) => {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number"
  ) {
    return false;
  }

  if (
    !kolkataGeoJSON ||
    kolkataGeoJSON.type !== "FeatureCollection"
  ) {
    return false;
  }

  return kolkataGeoJSON.features.some((feature) =>
    isPointInsideGeometry(
      latitude,
      longitude,
      feature.geometry
    )
  );
};