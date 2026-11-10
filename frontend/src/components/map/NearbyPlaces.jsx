import React from "react";
import { Marker, Popup } from "react-leaflet";
import { MapPin, Phone, Globe, Navigation } from "lucide-react";
import { CATEGORY_SVG } from "./mapIcons";

const LABEL = { shop: "Shop", hospital: "Hospital", pharmacy: "Pharmacy", bank: "Bank", restaurant: "Food", school: "School" };

/* only http(s) links open: a place's website comes from OpenStreetMap, not from us */
function safeSite(raw) {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch {
    return "";
  }
}

export default function NearbyPlaces({ places, createCategoryLeafletIcon, getRoute }) {
  if (!places || places.length === 0) return null;

  return (
    <>
      {places.map((place) => {
        const site = place.website ? safeSite(place.website) : "";
        return (
          <Marker key={place.id} position={[place.latitude, place.longitude]} icon={createCategoryLeafletIcon(place.category)}>
            <Popup>
              <div className="nearby-place-popup">
                <strong className="pop-title">
                  <span className="glyph" aria-hidden dangerouslySetInnerHTML={{ __html: CATEGORY_SVG[place.category] || CATEGORY_SVG.other }} />
                  {place.name}
                </strong>
                <small className="category-tag">{LABEL[place.category] || "Place"}</small>
                {place.address ? <small className="pop-line"><MapPin size={12} aria-hidden /> {place.address}</small> : null}
                {place.phone ? <small className="pop-line"><Phone size={12} aria-hidden /> <a href={`tel:${String(place.phone).replace(/[^\d+]/g, "")}`}>{place.phone}</a></small> : null}
                {site ? <small className="pop-line"><Globe size={12} aria-hidden /> <a href={site} target="_blank" rel="noopener noreferrer">Website</a></small> : null}
                <button
                  type="button"
                  className="route-btn"
                  onClick={() => getRoute({ latitude: place.latitude, longitude: place.longitude, name: place.name })}
                >
                  <Navigation size={13} aria-hidden /> Route here
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
