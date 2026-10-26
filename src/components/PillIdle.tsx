import React, { useEffect, useState } from 'react';
import { Battery, BatteryCharging, Coffee, Music2, Pause, Play } from 'lucide-react';
import { TrackInfo } from '../types';
interface PillIdleProps {
  track: TrackInfo | null;
  battery?: { percent: number | null; charging: boolean; available: boolean };
  isCaffeinated: boolean;
  banner?: { title: string; body: string } | null;
  onExpand: (focus?: boolean) => void;
  onTogglePlay: (event: React.MouseEvent) => void;
}
export const PillIdle: React.FC<PillIdleProps> = ({ track, battery, isCaffeinated, banner, onExpand, onTogglePlay }) => {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => { const interval = window.setInterval(() => setTime(new Date()), 1000); return () => window.clearInterval(interval); }, []);
  const BatteryIcon = battery?.charging ? BatteryCharging : Battery;
  return (
    <div className={`notch-idle ${banner ? 'notch-idle-banner' : ''}`}>
      <button type="button" className="notch-idle-open" aria-label={banner ? `${banner.title}. ${banner.body}. Open Sapphire` : 'Open Sapphire'} aria-expanded="false" onClick={event => onExpand(event.detail === 0)}>
        {banner ? <span className="notch-banner-text"><strong>{banner.title}</strong><span>{banner.body}</span></span> : track ? <>
          {track.albumArt ? <img className="notch-mini-art" src={track.albumArt} alt="" /> : <Music2 size={15} className="notch-accent" />}
          <span className="notch-mini-track"><strong>{track.title || 'Media'}</strong><span>{track.artist}</span></span>
        </> : <><img className="notch-mini-logo" src="./sapphire-light.png" alt="" /><time dateTime={time.toISOString()}>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></>}
      </button>
      {!banner && isCaffeinated && <Coffee size={13} className="notch-awake" aria-label="Stay awake active" />}
      {!banner && track && <button type="button" className="notch-idle-play" onClick={onTogglePlay} disabled={track.isPlaying ? track.controls?.pause === false : track.controls?.play === false} aria-label={track.isPlaying ? 'Pause media' : 'Play media'}>{track.isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}</button>}
      {!banner && battery?.available && battery.percent !== null && <span className="notch-mini-battery" aria-label={`Battery ${Math.round(battery.percent)} percent${battery.charging ? ', charging' : ''}`}><BatteryIcon size={15} />{!track && <span>{Math.round(battery.percent)}%</span>}</span>}
    </div>
  );
};
