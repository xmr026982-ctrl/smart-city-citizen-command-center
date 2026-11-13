/* The 16 places on the 3D city (same ids and centres as frontend/src/config/zones.js).
   Every one gets live air quality (nearest CPCB station), traffic (TomTom) and
   rainfall/heat (Open-Meteo). The six issue zones are the same places by id. */
module.exports = [
  { id: "howrah", name: "Howrah Bridge", lat: 22.5851, lng: 88.3468 },
  { id: "central", name: "Central Kolkata", lat: 22.5705, lng: 88.3585 },
  { id: "esplanade", name: "Esplanade", lat: 22.5647, lng: 88.3513 },
  { id: "victoria", name: "Victoria Memorial", lat: 22.5448, lng: 88.3426 },
  { id: "college", name: "College Street", lat: 22.576, lng: 88.3635 },
  { id: "shyambazar", name: "Shyambazar", lat: 22.6015, lng: 88.3736 },
  { id: "belgachia", name: "Belgachia", lat: 22.612, lng: 88.385 },
  { id: "salt", name: "Salt Lake", lat: 22.586, lng: 88.417 },
  // traffic is read on Park Street itself; the centre point sits on the Chowringhee junction,
  // where TomTom returns a segment with no free-flow speed. Chowringhee Road is the fallback.
  { id: "park", name: "Park Street", lat: 22.553, lng: 88.352, trafficPoints: [[22.5527, 88.3532], [22.5536, 88.3508]] },
  { id: "ballygunge", name: "Ballygunge", lat: 22.527, lng: 88.363 },
  { id: "alipore", name: "Alipore", lat: 22.525, lng: 88.337 },
  { id: "tollygunge", name: "Tollygunge", lat: 22.498, lng: 88.346 },
  { id: "behala", name: "Behala", lat: 22.501, lng: 88.31 },
  { id: "bbdbagh", name: "B.B.D. Bagh", lat: 22.5726, lng: 88.349 },
  { id: "dharmatala", name: "Dharmatala", lat: 22.5604, lng: 88.3519 },
  { id: "bptownship", name: "B.P. Township", lat: 22.4722, lng: 88.3878 },
];
