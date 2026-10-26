import { WeatherData } from '../types';
import { decodeWeather } from './widgetLogic.mjs';
export type WeatherLocation = { name: string; latitude: number; longitude: number };
export async function searchWeatherLocations(name: string): Promise<WeatherLocation[]> {
  const response = await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(name.trim())+'&count=5&language=en&format=json', { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Location search failed ('+response.status+').');
  const data = await response.json();
  return (data.results ?? []).map((item: any) => ({ name: [item.name, item.admin1, item.country].filter(Boolean).join(', '), latitude: item.latitude, longitude: item.longitude }));
}
export async function fetchLiveWeather(location?: WeatherLocation): Promise<WeatherData> {
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) throw new Error('Choose your weather location.');
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m', hourly: 'temperature_2m,weather_code', daily: 'temperature_2m_max,temperature_2m_min', timezone: 'auto', forecast_days: '2' }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Weather update failed ('+response.status+').');
  return decodeWeather(await response.json(), location.name);
}
