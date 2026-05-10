const FIRST = [
  "Axel", "Blaze", "Cruz", "Dash", "Ember", "Flint", "Gus", "Hawk",
  "Indy", "Jet", "Knox", "Lux", "Mack", "Nico", "Onyx", "Piston",
  "Quinn", "Rex", "Slick", "Turbo", "Vince", "Wyatt", "Zane", "Roxy",
  "Nitro", "Sable", "Reign", "Vega", "Trax", "Cinder",
];
const LAST = [
  "Steele", "Burnside", "Vortex", "Maverick", "Halloran", "Storm",
  "Mercer", "Banks", "Wilder", "Crank", "Drift", "Holt", "Reeves",
  "Sparks", "Granger", "Lane", "Vance", "Roman", "Cole", "Quartz",
  "Diesel", "Brick", "Stark", "Falcone", "Voss",
];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export const generateDriverName = () => `${pick(FIRST)} ${pick(LAST)}`;