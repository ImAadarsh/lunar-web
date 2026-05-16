export const PORTAL_THEME_COOKIE = "lunar_portal_theme";

export type PortalThemeId = "default" | "dark" | "coloured";

export const PORTAL_THEMES: Array<{ id: PortalThemeId; label: string }> = [
  { id: "default", label: "Default" },
  { id: "dark", label: "Dark" },
  { id: "coloured", label: "Coloured" },
];

export function isPortalThemeId(value: string | null | undefined): value is PortalThemeId {
  return value === "default" || value === "dark" || value === "coloured";
}
