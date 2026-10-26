import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCalendar, remainingSeconds, decodeWeather, encodePCM16, parseSportsSeason, weatherCondition } from '../src/services/widgetLogic.mjs';
test('focus timers use absolute deadlines across unmount, suspend and restart', () => {
  assert.equal(remainingSeconds(25_000, 10, 20_001), 5);
  assert.equal(remainingSeconds(25_000, 10, 30_000), 0);
  assert.equal(remainingSeconds(null, 14, 30_000), 14);
});

test('sports seasons retain provider labels and never infer a year for an empty field', () => {
  assert.equal(parseSportsSeason('2026'),'2026');
  assert.equal(parseSportsSeason(' 2025-2026 '),'2025-2026');
  assert.equal(parseSportsSeason(''),undefined);
  assert.equal(parseSportsSeason(),undefined);
  for(const value of ['26','2025/2026','2025-26','2026&league=1'])assert.throws(()=>parseSportsSeason(value),/YYYY/);
});
test('calendar unfolds text and preserves UTC and all-day events', () => {
  const events = parseCalendar('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a\r\nSUMMARY:A long\r\n  title\\, yes\r\nDTSTART:20261025T100000Z\r\nDTEND:20261025T110000Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Day\r\nDTSTART;VALUE=DATE:20261026\r\nEND:VEVENT\r\nEND:VCALENDAR');
  assert.equal(events[0].title, 'A long title, yes');
  assert.equal(events[0].start, '2026-10-25T10:00:00.000Z');
  assert.equal(events[1].allDay, true);
});
test('calendar rejects recurrence instead of silently losing occurrences', () => {
  assert.throws(() => parseCalendar('BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Weekly\nDTSTART:20261025T100000Z\nRRULE:FREQ=WEEKLY\nEND:VEVENT\nEND:VCALENDAR'), /Repeating/);
  assert.throws(() => parseCalendar('not a calendar'), /iCalendar/);
  assert.throws(() => parseCalendar('BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Wrong day\nDTSTART;VALUE=DATE:20260230\nEND:VEVENT\nEND:VCALENDAR'), /invalid date/);
  assert.throws(() => parseCalendar('BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Wrong time\nDTSTART:20260230T100000Z\nEND:VEVENT\nEND:VCALENDAR'), /invalid date/);
  assert.throws(() => parseCalendar('BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Repeat dates\nDTSTART:20261025T100000Z\nRDATE:20261026T100000Z\nEND:VEVENT\nEND:VCALENDAR'), /Repeating/);
});
test('weather uses actual hourly samples and rejects missing current data', () => {
  const result = decodeWeather({ current: { temperature_2m: 20, relative_humidity_2m: 45, weather_code: 0, wind_speed_10m: 5, time: '2026-10-25T12:15' }, daily: { temperature_2m_max: [23], temperature_2m_min: [15] }, hourly: { time: ['2026-10-25T11:00', '2026-10-25T12:00', '2026-10-25T13:00'], temperature_2m: [17, 19, 21], weather_code: [0, 3, 61] } }, 'Chosen city');
  assert.deepEqual(result.hourly.map(h => h.temp), [19, 21]);
  assert.equal(result.hourly[1].icon, 'Rain');
  assert.throws(() => decodeWeather({}, 'x'), /incomplete/);
  assert.equal(weatherCondition(999),'Condition unknown');
  assert.throws(()=>decodeWeather({current:{temperature_2m:20,relative_humidity_2m:45,weather_code:0,wind_speed_10m:5,time:'2026-10-25T12:15'},daily:{temperature_2m_max:[23],temperature_2m_min:[15]},hourly:{time:['2026-10-25T12:00'],temperature_2m:[19]}},'x'),/condition/);
});
test('voice PCM clips input and emits little-endian signed 16-bit samples', () => {
  assert.deepEqual([...encodePCM16(new Float32Array([-2,-1,0,1,2]))],[0,128,0,128,0,0,255,127,255,127]);
});
