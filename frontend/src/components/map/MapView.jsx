import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  LayersControl,
  LayerGroup,
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
      <LayersControl position="topright">

        {/* Street Map */}
        <LayersControl.BaseLayer checked name="Street Map">
          <TileLayer
            attribution="&copy; MapTiler &copy; OpenStreetMap contributors"
            url={`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`}
          />
        </LayersControl.BaseLayer>

        {/* Satellite */}
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer
            attribution="&copy; MapTiler &copy; OpenStreetMap contributors"
            url={`https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`}
          />
        </LayersControl.BaseLayer>

        {/* Issues */}
        <LayersControl.Overlay checked name="Issues">
          <LayerGroup>

            <Marker
              position={[22.575467, 88.427178]}
              icon={defaultIcon}
            >
              <Popup>
                🚧 Road Damage
              </Popup>
            </Marker>

            <Marker
              position={[22.656237, 88.424959]}
              icon={defaultIcon}
            >
              <Popup>
                🗑️ Garbage Issue
              </Popup>
            </Marker>

          </LayerGroup>
        </LayersControl.Overlay>

      </LayersControl>
    </MapContainer>
  );
}

export default MapView;