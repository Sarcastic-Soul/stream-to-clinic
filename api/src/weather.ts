// Rainfall per site from Open-Meteo (free, no key; data CC BY 4.0, attribution "Weather data by Open-Meteo.com").
import { config } from "./config.js";
import type { Weather } from "./rules.js";

const CACHE_MS = 60 * 60_000;
const HOUR = 3_600_000;
const cache = new Map<string, { fetchedAt: number; weather: Weather }>();

interface OpenMeteoHourly {
  hourly: { time: string[]; precipitation: (number | null)[] };
}

// Sums hourly precipitation (UTC timestamps, each value covering the preceding hour) over rolling windows.
export function summariseRain(data: OpenMeteoHourly, now = Date.now()): Weather {
  const sum = (hours: number) =>
    data.hourly.time.reduce((total, time, i) => {
      const t = Date.parse(`${time}Z`);
      return t <= now && t > now - hours * HOUR ? total + (data.hourly.precipitation[i] ?? 0) : total;
    }, 0);
  const round = (value: number) => Math.round(value * 10) / 10;
  return { rain24h: round(sum(24)), rain7d: round(sum(7 * 24)), source: "Open-Meteo" };
}

// Returns undefined when the weather service is unavailable; callers must cope.
export async function getWeather(lat: number, lon: number): Promise<Weather | undefined> {
  if (config.weatherOverride) return { ...config.weatherOverride, source: "demo weather override" };

  const key = `${lat},${lon}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.weather;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: "precipitation",
    past_days: "7",
    forecast_days: "1",
    timezone: "UTC",
  }).toString();

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return undefined;
    const weather = summariseRain((await res.json()) as OpenMeteoHourly);
    cache.set(key, { fetchedAt: Date.now(), weather });
    return weather;
  } catch {
    return undefined;
  }
}
