import PageHeader from "../components/PageHeader";

const galleryItems = [
  { id: 1, title: "Hybrid Soft Glam", vibe: "soft-glam", tone: "warm" },
  { id: 2, title: "Classic Natural", vibe: "soft-glam", tone: "blush" },
  { id: 3, title: "Volume Drama", vibe: "high-fashion", tone: "gold" },
  { id: 4, title: "Mega Editorial", vibe: "high-fashion", tone: "dark" },
  { id: 5, title: "Wispy Hybrid", vibe: "soft-glam", tone: "rose" },
  { id: 6, title: "Cat-Eye Volume", vibe: "high-fashion", tone: "champagne" },
];

export default function Gallery() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Portfolio"
        title="Gallery"
        subtitle="A glimpse of our soft glam and high fashion work. Replace placeholders with your client photos (with consent)."
      />

      <div className="gallery-grid">
        {galleryItems.map((item) => (
          <figure key={item.id} className={`gallery-item tone-${item.tone}`}>
            <div className="gallery-placeholder">
              <span>{item.title}</span>
            </div>
            <figcaption>
              <strong>{item.title}</strong>
              <span>{item.vibe === "high-fashion" ? "High Fashion" : "Soft Glam"}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
