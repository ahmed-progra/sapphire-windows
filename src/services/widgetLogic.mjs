export function remainingSeconds(deadline, paused, now = Date.now()) {
  return deadline === null ? Math.max(0, paused) : Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function parseSportsSeason(value) {
  const season=String(value??'').trim();
  if(!season)return undefined;
  if(!/^\d{4}(?:-\d{4})?$/.test(season))throw new Error('Use a season in YYYY or YYYY-YYYY format.');
  return season;
}
function calendarDate(value, timezone) {
  if (/^\d{8}$/.test(value)) {
    const day=value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6,8);
    const parsed=new Date(day+'T00:00:00Z');
    if(Number.isNaN(parsed.valueOf())||parsed.toISOString().slice(0,10)!==day)throw new Error('Calendar contains an invalid date.');
    return { date:day+'T00:00:00',allDay:true };
  }
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!match) throw new Error('Calendar contains an invalid date.');
  const day=match[1]+'-'+match[2]+'-'+match[3];
  const parsedDay=new Date(day+'T00:00:00Z');
  if(Number.isNaN(parsedDay.valueOf())||parsedDay.toISOString().slice(0,10)!==day||Number(match[4])>23||Number(match[5])>59||Number(match[6])>59)throw new Error('Calendar contains an invalid date.');
  if (timezone && timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone && !match[7]) throw new Error('Calendar uses '+timezone+'. Export UTC event times before importing.');
  const date = new Date(match[1]+'-'+match[2]+'-'+match[3]+'T'+match[4]+':'+match[5]+':'+match[6]+match[7]);
  if (Number.isNaN(date.valueOf())) throw new Error('Calendar contains an invalid date.');
  return { date: date.toISOString(), allDay: false };
}
export function parseCalendar(text) {
  if (typeof text !== 'string' || text.length > 2_000_000 || !text.includes('BEGIN:VCALENDAR')) throw new Error('Choose an iCalendar (.ics) file under 2 MB.');
  const events = [];
  for (const block of text.replace(/\r?\n[ \t]/g, '').split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0];
    if (/^(?:RRULE|RDATE|EXDATE)[:;]/mi.test(body)) throw new Error('Repeating events are not supported by this import. Export individual occurrences.');
    const fields = Object.create(null);
    for (const line of body.split(/\r?\n/)) {
      const index = line.indexOf(':');
      if (index < 0) continue;
      const [key, ...params] = line.slice(0, index).split(';');
      fields[key.toUpperCase()] = { value: line.slice(index + 1), timezone: params.find(p => p.toUpperCase().startsWith('TZID='))?.slice(5) };
    }
    if (!fields.DTSTART || !fields.SUMMARY) throw new Error('Calendar event is missing its title or start time.');
    const start = calendarDate(fields.DTSTART.value, fields.DTSTART.timezone);
    const unescape = value => value?.replace(/\\[nN]/g, '\n').replace(/\\([,;\\])/g, '$1');
    events.push({ id: fields.UID?.value || fields.DTSTART.value+':'+fields.SUMMARY.value, title: unescape(fields.SUMMARY.value), start: start.date, allDay: start.allDay, ...(fields.DTEND ? { end: calendarDate(fields.DTEND.value, fields.DTEND.timezone).date } : {}), ...(fields.LOCATION ? { location: unescape(fields.LOCATION.value) } : {}) });
  }
  return events.sort((a, b) => a.start.localeCompare(b.start));
}
export function encodePCM16(samples) {
  const bytes=new Uint8Array(samples.length*2);const view=new DataView(bytes.buffer);
  for(let i=0;i<samples.length;i++) {
    const value=Math.max(-1,Math.min(1,samples[i]));
    view.setInt16(i*2,value<0?value*32768:value*32767,true);
  }
  return bytes;
}
export function weatherCondition(code) {
  if (code === 0) return 'Clear';
  if ([1,2,3].includes(code)) return 'Cloudy';
  if ([45,48].includes(code)) return 'Fog';
  if ([51,53,55,56,57,61,63,65,66,67].includes(code)) return 'Rain';
  if ([71,73,75,77].includes(code)) return 'Snow';
  if ([80,81,82].includes(code)) return 'Rain showers';
  if ([85,86].includes(code)) return 'Snow showers';
  if ([95,96,99].includes(code)) return 'Thunderstorm';
  return 'Condition unknown';
}
export function decodeWeather(data, location) {
  const required = [data?.current?.temperature_2m, data?.current?.relative_humidity_2m, data?.current?.weather_code, data?.current?.wind_speed_10m, data?.daily?.temperature_2m_max?.[0], data?.daily?.temperature_2m_min?.[0]];
  if (!required.every(Number.isFinite) || !Array.isArray(data?.hourly?.time) || !Array.isArray(data?.hourly?.temperature_2m)) throw new Error('Weather provider returned incomplete data.');
  const start = data.hourly.time.findIndex(time => time >= String(data.current.time).slice(0,13) + ':00');
  if (start < 0) throw new Error('Weather forecast does not cover the current observation.');
  const hourly = data.hourly.time.slice(start, start + 5).map((time, i) => {
    const temp = data.hourly.temperature_2m[start + i];
    const code=data.hourly.weather_code?.[start+i];
    if (!Number.isFinite(temp)||!Number.isFinite(code)) throw new Error('Weather forecast contains an invalid temperature or condition.');
    return { time: time.slice(11, 16), temp: Math.round(temp), icon: weatherCondition(code) };
  });
  return { temp: Math.round(required[0]), humidity: required[1], windSpeed: Math.round(required[3]), condition: weatherCondition(required[2]), high: Math.round(required[4]), low: Math.round(required[5]), location, hourly };
}
