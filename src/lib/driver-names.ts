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
const pickDriver = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export const generateDriverName = () => `${pickDriver(FIRST)} ${pickDriver(LAST)}`;

const TEAM_PREFIXES = [
  "Raging", "Crimson", "Iron", "Thunder", "Black",
  "Savage", "Neon", "Phantom", "Blazing", "Shadow",
  "Nitro", "Infernal", "Rogue", "Apex", "Titan",
  "Storm", "Steel", "Venom", "Turbo", "Silver",
  "Golden", "Rapid", "Furious", "Midnight", "Scarlet",
  "Atomic", "Arctic", "Vicious", "Burning", "Obsidian",
];

const TEAM_SUFFIXES = [
  "Bulls", "Vipers", "Wolves", "Falcons", "Phantoms",
  "Reapers", "Talons", "Jackals", "Predators", "Racers",
  "Syndicate", "Legion", "Titans", "Velocity", "Motorsport",
  "Autosport", "Racing", "Engineering", "Dynamics", "GP",
  "Circuit", "Torque", "Pistons", "Eclipse", "Vanguard",
  "Dominion", "Renegades", "Stormbreak", "Performance", "Works",
];
const pickTeam = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export const generateTeamName = () => `${pickTeam(TEAM_PREFIXES)} ${pickTeam(TEAM_SUFFIXES)}`;

const SPONSOR_NAMES = [
  "BeanBoy Coffee",
  "Torque Insurance",
  "Uncle Tony’s Tyres",
  "Grease Goblin Garage",
  "Budget Brakes",
  "Biscuit Fuel Co.",
  "Dodgy Dave’s Motors",
  "Turbo Noodles",
  "Penguin Energy Drink",
  "Maximum Beige",
  "Goblin Tools",
  "Mystery Octane",
  "Loose Lug Nuts Ltd",
  "Chicken Speedworks",
  "Soggy Sandwiches",
  "Angry Wrench Racing",
  "Tax Write-Off Motors",
  "Flatspot Tyres",
  "Questionable Mechanics",
  "The Clutch Clinic",
  "Suspicious Oils",
  "Grandad’s Car Wash",
  "Mildly Dangerous Parts",
  "Discount Turbo Warehouse",
  "Wobble Alignment Centre",
  "Caution Wet Paint",
  "Instant Regret Racing",
  "Pothole Performance",
  "Brake Fluid & Sons",
  "Probably Fine Engineering",
  "Fast-ish Logistics",
  "Rustbucket Industries",
  "Microwave Burritos",
  "Oversteer Energy",
  "Spicy Bearings",
  "Big Mikes Tiny Cars",
  "Garage Floor Pizza",
  "Almost Legal Racing",
  "Excessive Downforce Co.",
  "The Dent Wizard",
  "Emergency Duct Tape",
  "Late Apex Brewery",
  "Tiny Engine Huge Dreams",
  "Bonk! Collision Repair",
  "Shifty Gearboxes",
  "Premium Air Fresheners",
  "Third Place Industries",
  "Bumper Delete Customs",
  "Cold Chips Cafe",
  "Noisy Exhaust Emporium",
];
const pickSponsor = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export const getRandomSponsorName = () => pickSponsor(SPONSOR_NAMES);