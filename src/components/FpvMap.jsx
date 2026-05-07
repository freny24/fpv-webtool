import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function FpvMap() {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      style={{ height: "100vh", width: "100%" }}
    >
      {/* Base map */}
      <TileLayer
        attribution="© OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* GEE FPV layer */}
      <TileLayer
        url="https://earthengine.googleapis.com/v1/projects/spheric-mesh-330606/maps/06e67adeceb620403c76daf836c10f49-94385b5a19c2d31d6f49c83ae25c5494/tiles/{z}/{x}/{y}"
      />
    </MapContainer>
  );
}