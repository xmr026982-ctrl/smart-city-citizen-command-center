import React from "react";
import { Marker, Popup } from "react-leaflet";

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

export default function NearbyPlaces({
  places,
  createCategoryLeafletIcon,
  getRoute,
}) {
  if (!places || places.length === 0) {
    return null;
  }

  return (
    <>
      {places.map((place) => (
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
                {getCategoryIcon(place.category)}{" "}
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
                    📍 {place.address}
                  </small>
                </>
              )}

              {place.phone && (
                <>
                  <br />

                  <small>
                    📞 {place.phone}
                  </small>
                </>
              )}

              {place.website && (
                <>
                  <br />

                  <a
                    href={
                      place.website.startsWith("http")
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
                    latitude: place.latitude,
                    longitude: place.longitude,
                    name: place.name,
                  })
                }
              >
                🚗 Get Route
              </button>

            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}