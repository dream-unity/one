// A shared rhythm drives the entire organism. Opposite surface points remain
// opposite, so breathing and circulation cannot translate the body.
export function sampleLife(time) {
  const phase = time * Math.PI * 2 / 6.4;
  const breath = Math.sin(phase);
  const heart = phase * 2;
  const pulse = Math.pow((1 + Math.cos(heart)) / 2, 12)
    + .36 * Math.pow((1 + Math.cos(heart - .88)) / 2, 20);
  return {
    elapsed: time, phase, breath, pulse,
    bodyScale: 1 + breath * .027 + pulse * .004,
    circulation: time * .27 + Math.sin(phase) * .065,
    opening: .5 + breath * .5,
  };
}

export function sampleBand(life, index, outer) {
  const pair = Math.floor(index / 2);
  const direction = index % 2 === 0 ? 1 : -1;
  const wave = Math.sin(life.phase - pair * .38);
  const precession = life.elapsed * .38;
  const openness = .18 + life.opening * .19;
  return {
    x: direction * Math.cos(precession) * openness * (outer ? 1 : .55),
    y: direction * Math.sin(precession) * openness * (outer ? 1 : .55),
    z: direction * (life.circulation * (outer ? .60 : 1.35) + wave * .035),
    scale: 1 + wave * (outer ? .022 : .034) + life.pulse * (outer ? .003 : .009),
  };
}

export function deformSurface(x, y, z, time, breath) {
  const angle = Math.atan2(y, x);
  const radius = Math.hypot(x, y);
  const radial = 1 + (.009 + .005 * breath) * Math.sin(angle * 2 + time * .72)
    + .003 * Math.sin(angle * 4 - time * .36);
  return {
    x: x * radial,
    y: y * radial,
    z: z + .025 * radius * Math.sin(angle * 3 + time * .48),
  };
}

// Shared by visible surfaces and their shadow depth materials.
export const LIVING_SURFACE_GLSL = `
  float livingAngle = atan(position.y, position.x);
  float livingRadius = length(position.xy);
  float livingRadial = 1.0 + (0.009 + 0.005 * uLifeBreath)
    * sin(livingAngle * 2.0 + uLifeTime * 0.72)
    + 0.003 * sin(livingAngle * 4.0 - uLifeTime * 0.36);
  transformed.xy *= livingRadial;
  transformed.z += 0.025 * livingRadius
    * sin(livingAngle * 3.0 + uLifeTime * 0.48);
`;
