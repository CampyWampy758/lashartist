import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import ServiceCard from "../components/ServiceCard";
import { fetchServices } from "../api";

export default function Services() {
  const [services, setServices] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchServices().then(setServices).catch(console.error);
  }, []);

  const filtered =
    filter === "all" ? services : services.filter((s) => s.vibe === filter);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Menu"
        title="Services & Pricing"
        subtitle="All prices in EC$. A deposit is required to secure your slot."
      />

      <div className="filter-tabs">
        {[
          { id: "all", label: "All" },
          { id: "soft-glam", label: "Soft Glam" },
          { id: "high-fashion", label: "High Fashion" },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={filter === id ? "active" : ""}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="stack">
        {filtered.map((service) => (
          <ServiceCard key={service.id} service={service} showBook />
        ))}
      </div>
    </div>
  );
}
