export function remainingSeconds(deadline: number | null, paused: number, now?: number): number;
export type CalendarEvent = { id: string; title: string; start: string; end?: string; allDay: boolean; location?: string };
export function parseCalendar(text: string): CalendarEvent[];
export function encodePCM16(samples: Float32Array): Uint8Array;
export function parseSportsSeason(value?: string): string | undefined;
export function weatherCondition(code: number): string;
export function decodeWeather(data: unknown, location: string): import('../types').WeatherData;
