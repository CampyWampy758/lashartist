/** Brand colors aligned with client/src/App.css */
export const PINK = {
  bg: "#ffc8d8",
  bgSoft: "#ffe4ec",
  bgPage: "#ffe8f0",
  blush: "#8b4a52",
  text: "#3d2a2e",
  muted: "#6b5258",
  label: "#8b6e72",
  border: "#f0d4dc",
  borderSoft: "#f5e3e8",
  cardBg: "#fff9fb",
  white: "#ffffff",
};

export const GOLD = {
  main: "#c9a962",
  dim: "#a8894a",
  text: "#2d2416",
  textSoft: "#5c4a20",
};

export function formatStatus(status) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDate(dateStr) {
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatEC(amount) {
  return `EC$${Math.round(amount || 0)}`;
}
