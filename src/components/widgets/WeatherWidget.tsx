import React,{useEffect,useRef,useState} from 'react';
import { CloudSun,RefreshCw,MapPin } from 'lucide-react';
import { WeatherData } from '../../types';
import { fetchLiveWeather,searchWeatherLocations,WeatherLocation } from '../../services/weatherService';
import { loadStored,saveStored } from '../../services/storageService';
import { messageOf } from '../../services/desktopClient';
export const WeatherWidget:React.FC=()=>{
  const [location,setLocation]=useState<WeatherLocation|undefined>(()=>loadStored('sapphire_weather',undefined));const [query,setQuery]=useState('');const [choices,setChoices]=useState<WeatherLocation[]>([]);const [weather,setWeather]=useState<WeatherData|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(false);const [updated,setUpdated]=useState<Date|null>(null);
  const requestRevision=useRef(0);
  const refresh=async(place=location)=>{if(!place)return;const request=++requestRevision.current;setLoading(true);try{const next=await fetchLiveWeather(place);if(request!==requestRevision.current)return;setWeather(next);setUpdated(new Date());setError('');}catch(e){if(request===requestRevision.current)setError(messageOf(e));}finally{if(request===requestRevision.current)setLoading(false);}};
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),15*60*1000);return()=>{clearInterval(timer);requestRevision.current++;};},[location]);
  const choose=async(place:WeatherLocation)=>{try{await saveStored('sapphire_weather',place);setLocation(place);setChoices([]);setQuery('');setWeather(null);}catch(e){setError(messageOf(e));}};
  return <section className="h-full overflow-y-auto p-5 space-y-4" aria-label="Weather"><form className="flex gap-2" onSubmit={async e=>{e.preventDefault();setLoading(true);try{const found=await searchWeatherLocations(query);setChoices(found);setError(found.length?'':'No locations found. Try a nearby city.');}catch(error){setError(messageOf(error));}finally{setLoading(false);}}}><input aria-label="Weather city" placeholder="Choose a city" minLength={2} required value={query} onChange={e=>setQuery(e.target.value)} className="min-w-0 flex-1 rounded-xl bg-field border border-subtle px-3 py-2 text-xs"/><button disabled={loading} className="glass-button px-3 text-xs">Find city</button></form>
    {choices.map(place=><button className="glass-card p-3 block w-full text-left text-xs" key={place.latitude+':'+place.longitude} onClick={()=>choose(place)}>{place.name}</button>)}
    {error&&<p role="alert" className="text-xs text-warning">{error}{weather?' Showing the last successful update.':''}</p>}
    {loading&&<p role="status" className="text-xs text-muted">Updating weather…</p>}
    {!location&&!loading&&<p className="text-sm text-muted py-8 text-center">Choose your location to see real weather and hourly forecasts.</p>}
    {weather&&<><div className="flex items-center justify-between"><div><p className="text-xs text-muted flex items-center gap-1"><MapPin size={13}/>{weather.location}</p><p className="text-5xl tracking-tight mt-3">{weather.temp}°<span className="text-xl text-muted">C</span></p><p className="text-sm text-muted mt-2">{weather.condition} · {weather.low}° / {weather.high}°</p></div><CloudSun size={55} className="text-muted"/><button aria-label="Refresh weather" className="glass-button p-2" onClick={()=>refresh()}><RefreshCw size={15}/></button></div><div className="flex gap-6 text-xs text-muted"><span>Humidity {weather.humidity}%</span><span>Wind {weather.windSpeed} km/h</span></div><div className="grid grid-cols-5 gap-2">{weather.hourly.map(hour=><div className="glass-card p-3 text-center" key={hour.time}><p className="text-[11px] text-muted">{hour.time}</p><p className="text-lg mt-2">{hour.temp}°</p><p className="text-[10px] text-muted mt-1">{hour.icon}</p></div>)}</div></>}
    <p className="text-[10px] text-muted">Forecast: Open-Meteo · {updated?'Updated '+updated.toLocaleTimeString():'No data fetched yet'} · Location times are shown in the forecast’s timezone.</p>
  </section>;
};
