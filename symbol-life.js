// A shared rhythm drives circulation inside a fixed body. Its radius, depth
// and scale stay constant; only the ink and ring details flow around it.
export function sampleLife(time) {
  const phase = time * Math.PI * 2 / 6.4;
  const breath = Math.sin(phase);
  const heart = phase * 2;
  const pulse = Math.pow((1 + Math.cos(heart)) / 2, 12)
    + .36 * Math.pow((1 + Math.cos(heart - .88)) / 2, 20);
  return {
    elapsed: time, phase, breath, pulse,
    bodyScale: 1,
    circulation: time * .27 + Math.sin(phase) * .065,
  };
}

export function sampleBand(life, index, outer) {
  const pair = Math.floor(index / 2);
  const direction = index % 2 === 0 ? 1 : -1;
  const wave = Math.sin(life.phase - pair * .38);
  return {
    x: direction * (outer ? .10 : .05),
    y: 0,
    z: direction * (life.circulation * (outer ? .60 : 1.35) + wave * .035),
    scale: 1,
  };
}

export function deformSurface(x, y, z, time, breath) {
  const angle = Math.atan2(y, x);
  const radius = Math.hypot(x, y);
  const ripple = (.006 + .002 * breath) * Math.sin(angle * 2 + time * .72)
    + .003 * Math.sin(angle * 4 - time * .36);
  return {
    x: radius * Math.cos(angle + ripple),
    y: radius * Math.sin(angle + ripple),
    z,
  };
}

// Shared by visible surfaces and their shadow depth materials.
export const LIVING_SURFACE_GLSL = `
  float livingAngle = atan(position.y, position.x);
  float livingRadius = length(position.xy);
  float livingRipple = (0.006 + 0.002 * uLifeBreath)
    * sin(livingAngle * 2.0 + uLifeTime * 0.72)
    + 0.003 * sin(livingAngle * 4.0 - uLifeTime * 0.36);
  transformed.xy = livingRadius * vec2(
    cos(livingAngle + livingRipple), sin(livingAngle + livingRipple));
`;
