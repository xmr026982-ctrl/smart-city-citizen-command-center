import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

function MapView() {
  const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

  return (
    <MapContainer
      center={[22.5726, 88.3639]}
      zoom={12}
      style={{
        width: "100%",
        height: "100vh",
      }}
    >
      <TileLayer
        attribution="&copy; MapTiler &copy; OpenStreetMap contributors"
        url={`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`}
      />
      
      <Marker
        position={[22.575467, 88.427178]}
        icon={defaultIcon}
      >
      <Popup>
         💼 Internship Location
      </Popup>
     </Marker>
     <Marker
        position={[22.656237, 88.424959]}
        icon={defaultIcon}
      >
        <Popup>
           📍 My Home
        </Popup>
     </Marker>
    
    </MapContainer>
  );
}

export default MapView;