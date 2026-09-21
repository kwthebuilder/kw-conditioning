/**
 * Jump metrics from video frame counts. Pure arithmetic, no video.
 *
 * flight time  = air frames ÷ frames per second
 * jump height  = g × flight² ÷ 8, in cm
 * RSI          = flight time ÷ contact time
 */
export const G = 9.81;

export function flightTime(airFrames: number, fps: number): number {
  if (!(fps > 0) || !(airFrames >= 0)) throw new Error('frames and fps must be positive numbers');
  return airFrames / fps;
}

export function jumpHeightCm(flightSeconds: number): number {
  return ((G * flightSeconds * flightSeconds) / 8) * 100;
}

export function rsi(flightSeconds: number, contactSeconds: number): number {
  if (!(contactSeconds > 0)) throw new Error('contact time must be positive');
  return flightSeconds / contactSeconds;
}

export interface JumpFrames {
  fps: number;
  air: number;
  /** Ground contact frames; needed for RSI. */
  ground?: number;
}

export interface JumpMetrics {
  flight_s: number;
  height_cm: number;
  contact_s?: number;
  rsi?: number;
}

export function jumpFromFrames(f: JumpFrames): JumpMetrics {
  const flight = flightTime(f.air, f.fps);
  const out: JumpMetrics = { flight_s: flight, height_cm: jumpHeightCm(flight) };
  if (f.ground !== undefined) {
    const contact = f.ground / f.fps;
    out.contact_s = contact;
    out.rsi = rsi(flight, contact);
  }
  return out;
}

/** Display rounding: height to one decimal, RSI to two. */
export const roundHeight = (cm: number): number => Math.round(cm * 10) / 10;
export const roundRsi = (r: number): number => Math.round(r * 100) / 100;

/** Mean of the finite numbers in the list, or null if none. */
export function mean(values: (number | null | undefined)[]): number | null {
  const xs = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
