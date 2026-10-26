import React,{useState} from 'react';
import { RefreshCw } from 'lucide-react';
import { desktopCall,messageOf } from '../../services/desktopClient';
import { parseSportsSeason } from '../../services/widgetLogic.mjs';

const sports={football:'Football',basketball:'Basketball',baseball:'Baseball',hockey:'Hockey'} as const;
type Sport=keyof typeof sports;
type SportsSelection={sport:Sport;league:string;season?:string;date:string;updated:Date};
const today=()=>{const date=new Date();return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');};

export const FinanceSportsWidget:React.FC=()=>{
 const [tab,setTab]=useState<'finance'|'sports'>('finance');const [symbols,setSymbols]=useState('');const [quotes,setQuotes]=useState<any[]>([]);const [sport,setSport]=useState<Sport>('football');const [league,setLeague]=useState('');const [date,setDate]=useState(today);const [games,setGames]=useState<any[]>([]);const [selection,setSelection]=useState<SportsSelection|null>(null);const [quoteUpdated,setQuoteUpdated]=useState<Date|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [season,setSeason]=useState('');
 const updated=tab==='finance'?quoteUpdated:selection?.updated;
 const refresh=async()=>{
  setBusy(true);
  try{
   if(tab==='finance'){
    const list=symbols.toUpperCase().split(/[\s,]+/).filter(Boolean);
    if(!list.length)throw new Error('Enter at least one stock symbol.');
    const result=await desktopCall('finance.quote',{symbols:list});setQuotes(result.quotes??result);setQuoteUpdated(new Date());
   }else{
    const requestedSeason=league.trim()?parseSportsSeason(season):undefined;
    const result=await desktopCall('sports.scores',{sport,league:league.trim(),date,...(requestedSeason?{season:requestedSeason}:{})});
    if(result.errors&&Object.keys(result.errors).length)throw new Error(Object.values(result.errors).join(' '));
    if(!Array.isArray(result.response))throw new Error('The sports provider returned an invalid response.');
    setGames(result.response);setSelection({sport,league:league.trim(),season:requestedSeason,date,updated:new Date()});
   }
   setError('');
  }catch(e){setError(messageOf(e));}finally{setBusy(false);}
 };
 return <section className="h-full overflow-y-auto p-5 space-y-4" aria-label="Finance and sports">
  <div className="flex gap-2">{(['finance','sports'] as const).map(value=><button disabled={busy} aria-pressed={tab===value} className={'glass-button px-4 py-2 text-xs '+(tab===value?'text-content':'text-muted')} key={value} onClick={()=>{setTab(value);setError('');}}>{value==='finance'?'Finance':'Sports'}</button>)}</div>
  <p className="text-xs text-muted">{tab==='finance'?'Finnhub quotes. Configure your Finnhub key in Settings.':'Scores and schedules from API-Sports. Configure your API-Sports key in Settings.'}</p>
  <form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();void refresh();}}>
   {tab==='finance'?<input aria-label="Stock symbols" placeholder="Symbols, separated by commas" value={symbols} onChange={e=>setSymbols(e.target.value)} className="flex-1 min-w-0 bg-field rounded-xl border border-subtle px-3 py-2 text-xs"/>:<>
    <select aria-label="Sport" value={sport} onChange={e=>{setSport(e.target.value as Sport);setLeague('');setSeason('');}} className="bg-field rounded-xl border border-subtle px-2 py-2 text-xs">{Object.entries(sports).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
    <input aria-label="League ID (optional)" placeholder="League ID (optional)" inputMode="numeric" value={league} onChange={e=>setLeague(e.target.value)} className="flex-1 min-w-24 bg-field rounded-xl border border-subtle px-3 py-2 text-xs"/>
    {league.trim()&&<input aria-label="League season (optional)" placeholder="Season: YYYY or YYYY-YYYY" value={season} onChange={e=>setSeason(e.target.value)} pattern="[0-9]{4}(-[0-9]{4})?" maxLength={9} className="flex-1 min-w-40 bg-field rounded-xl border border-subtle px-3 py-2 text-xs"/>}
    <input aria-label="Game date" type="date" required value={date} onChange={e=>setDate(e.target.value)} className="bg-field rounded-xl border border-subtle px-2 text-xs"/>
   </>}
   <button disabled={busy} className="glass-button p-2" aria-label="Refresh"><RefreshCw size={16}/></button>
  </form>
  {tab==='sports'&&league.trim()&&<p className="text-[11px] text-muted">Use the season label required by this sport and league. For example, 2026 or 2025-2026. An empty season is sent without an assumed year.</p>}
  {error&&<p role="alert" className="text-xs text-warning">{error}{updated?' Previous results remain visible.':''}</p>}
  {busy&&<p role="status" className="text-xs text-muted">Fetching provider data…</p>}
  {tab==='finance'&&quotes.map(quote=><div className="glass-card p-4 flex justify-between" key={quote.symbol}><div><p className="text-sm">{quote.symbol}</p><p className="text-[10px] text-muted mt-1">{quote.t?new Date(quote.t*1000).toLocaleString():'Provider timestamp unavailable'}</p></div><div className="text-right"><p className="text-xl">{Number.isFinite(quote.c)?quote.c.toFixed(2):'Unavailable'}</p><p className={'text-xs '+(quote.d>=0?'text-success':'text-danger')}>{Number.isFinite(quote.dp)?quote.dp.toFixed(2)+'%':''}</p></div></div>)}
  {tab==='sports'&&selection&&<p className="text-[11px] text-muted">Showing {sports[selection.sport]} · {selection.date}{selection.league?' · League '+selection.league:''}{selection.season?' · Season '+selection.season:''}. Refresh to update the current selection.</p>}
  {tab==='sports'&&games.map((game,index)=><div className="glass-card p-4 text-xs" key={game.fixture?.id??game.id??index}><div className="flex justify-between gap-3"><span>{game.teams?.home?.name??'Home team unavailable'} – {game.teams?.away?.name??'Away team unavailable'}</span><span className="whitespace-nowrap">{game.goals?.home??'–'} : {game.goals?.away??'–'}</span></div><p className="text-[10px] text-muted mt-2">{game.league?.name?game.league.name+' · ':''}{game.fixture?.status?.long??game.fixture?.status?.short??'Status unavailable'}{game.fixture?.date?' · '+new Date(game.fixture.date).toLocaleString():''}</p></div>)}
  {updated&&tab==='sports'&&games.length===0&&<p className="text-sm text-muted py-5">No games returned for this selection.</p>}
  {!updated&&!busy&&!error&&<p className="text-sm text-muted py-8 text-center">Choose what you want to follow, then refresh.</p>}
  {updated&&<p className="text-[10px] text-muted">Fetched {updated.toLocaleString()}. Coverage, delay and request limits depend on your provider plan.</p>}
 </section>;
};
