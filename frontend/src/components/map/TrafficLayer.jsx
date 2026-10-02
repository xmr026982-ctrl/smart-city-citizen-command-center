import React from "react";
import { TileLayer } from "react-leaflet";

const KOLKATA_BOUNDS = [
  [22.35, 88.15],
  [22.80, 88.60],
];

export default function TrafficLayer() {
  const apiKey = import.meta.env.VITE_TOMTOM_API_KEY;

  console.log("TrafficLayer rendered");
  console.log("TomTom key exists:", !!apiKey);

  if (!apiKey) {
    console.error("TomTom Traffic API key is missing.");
    return null;
  }

  return (
    <TileLayer
      url={`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${apiKey}`}
      attribution="&copy; TomTom"
      opacity={0.9}
      bounds={KOLKATA_BOUNDS}
      minZoom={10}
      maxZoom={20}
      tileSize={256}
      zIndex={1000}
    />
  );
}