import { useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Polyline, TileLayer } from "react-leaflet";
import { http } from "../api/http.jsx";
import { zanzibarRoutes } from "../data/zanzibarRoutes.js";

function toLatLng(coords) {
  return [coords[1], coords[0]];
}

function DriverDashboardPage() {
  const [data, setData] = useState({ active_deliveries: [] });
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);

  const routePoints = useMemo(
    () => zanzibarRoutes.features[0].geometry.coordinates.map((coord) => toLatLng(coord)),
    []
  );
  const activePoint = routePoints[step % routePoints.length];

  useEffect(() => {
    const timer = setInterval(() => setStep((value) => value + 1), 1300);
    return () => clearInterval(timer);
  }, [routePoints.length]);

  const loadDashboard = async () => {
    try {
      const response = await http.get("/api/driver/dashboard/");
      setData(response.data);
    } catch {
      setError("Unable to load driver dashboard.");
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const updateStatus = async (saleId, status) => {
    try {
      await http.patch(`/api/driver/sales/${saleId}/status/`, { status });
      await loadDashboard();
    } catch {
      setError("Status update failed.");
    }
  };

  return (
    <section className="page-wrap">
      <h2>Driver Dashboard - Zanzibar Live Routes</h2>
      {error ? <p className="error">{error}</p> : null}
      <div className="map-card">
        <MapContainer center={[-6.1659, 39.2]} zoom={10} scrollWheelZoom className="map-box">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <GeoJSON data={zanzibarRoutes} style={{ color: "#16a34a", weight: 4, opacity: 0.8 }} />
          <Polyline positions={routePoints} pathOptions={{ color: "#0ea5e9", dashArray: "12 10" }} />
          <CircleMarker center={activePoint} radius={10} pathOptions={{ color: "#ef4444", fillOpacity: 0.9 }} />
        </MapContainer>
      </div>
      <div className="order-list">
        {data.active_deliveries.map((sale) => (
          <article className="order-card" key={sale.id}>
            <div>
              <h4>Delivery #{sale.id}</h4>
              <p>Status: {sale.status}</p>
              <p>Destination: {sale.delivery_location || "No location"}</p>
            </div>
            <div className="row">
              <button className="accent-btn" type="button" onClick={() => updateStatus(sale.id, "out_for_delivery")}>
                Start Route
              </button>
              <button className="primary-btn" type="button" onClick={() => updateStatus(sale.id, "delivered")}>
                Mark Delivered
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default DriverDashboardPage;
