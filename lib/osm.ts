export function osmEmbedUrl(opts: { lat: number; lng: number; span?: number }) {
  const span = opts.span ?? 0.02;
  const { lat, lng } = opts;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - span}%2C${lat - span}%2C${lng + span}%2C${lat + span}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export const BANGKOK_OSM =
  "https://www.openstreetmap.org/export/embed.html?bbox=100.48%2C13.73%2C100.55%2C13.79&layer=mapnik";
