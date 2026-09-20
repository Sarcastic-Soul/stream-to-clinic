// Theme preference: what the user picked. "system" follows the operating system.
export type ThemePreference = "light" | "dark" | "system";
// Resolved theme: what is actually painted, and the value of data-theme on <html>.
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const THEME_ORDER: ThemePreference[] = ["system", "light", "dark"];

export const THEME_COLOR: Record<Theme, string> = { light: "#ffffff", dark: "#0a0a0a" };

export function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" || value === "system" ? value : "system";
  } catch {
    return "system";
  }
}

export function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(preference: ThemePreference): Theme {
  return preference === "system" ? systemTheme() : preference;
}

// Sets data-theme on <html> (the source of truth for CSS) and keeps the browser
// UI colour in step. Mirrors THEME_SCRIPT below; change both together.
export function applyTheme(preference: ThemePreference): Theme {
  const theme = resolveTheme(preference);
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  return theme;
}

// Runs synchronously in <head>, before the first paint, so the page never flashes
// the wrong theme. It is stringified into the HTML, not bundled: keep it ES5 and
// self-contained, and keep it in step with applyTheme above.
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var t=(p==="light"||p==="dark")?p:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?${JSON.stringify(THEME_COLOR.dark)}:${JSON.stringify(THEME_COLOR.light)})}catch(e){}})()`;
