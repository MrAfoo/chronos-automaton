// ============================================================================
// DATA MODEL: SUB-PART SPECIFICATIONS, WEAR CONDITIONS & DIAGNOSTIC SEQUENCING
// ============================================================================

export type PartCondition = "nominal" | "advisory" | "critical";

export interface ButterflyPartSpec {
  id: string;
  label: string;
  subtitle: string;
  specs: string;
  explodedOffset: [number, number, number];
  condition: PartCondition;
  tolerance: string;
}

export const CONDITION_CONFIG = {
  nominal: {
    label: "NOMINAL",
    color: "#4ade80",
    colorHex: 0x4ade80,
    textColor: "text-emerald-400",
    borderBadge: "border-emerald-500/50 bg-emerald-950/80 text-emerald-300",
    glowColor: "rgba(74, 222, 128, 0.4)",
    haloColor: "#4ade80",
  },
  advisory: {
    label: "ADVISORY",
    color: "#fbbf24",
    colorHex: 0xfbbf24,
    textColor: "text-amber-400",
    borderBadge: "border-amber-500/60 bg-amber-950/80 text-amber-300",
    glowColor: "rgba(251, 191, 36, 0.5)",
    haloColor: "#fbbf24",
  },
  critical: {
    label: "CRITICAL",
    color: "#f87171",
    colorHex: 0xf87171,
    textColor: "text-red-400",
    borderBadge: "border-red-500/70 bg-red-950/80 text-red-300",
    glowColor: "rgba(248, 113, 113, 0.6)",
    haloColor: "#f87171",
  },
} as const;

export const BUTTERFLY_PARTS: Record<string, ButterflyPartSpec> = {
  "left-upper-wing": {
    id: "left-upper-wing",
    label: "Left Forewing Assembly",
    subtitle: "Dichroic Stained-Glass Spar",
    specs: "Physical transmission 0.92, warm amber tint, tapered brass structural spars, titanium cross-truss ribbing. Caliber transmission nominal.",
    explodedOffset: [-3.8, 1.8, 1.2],
    condition: "nominal",
    tolerance: "99.4% Nominal",
  },
  "right-upper-wing": {
    id: "right-upper-wing",
    label: "Right Forewing Assembly",
    subtitle: "Dichroic Stained-Glass Spar",
    specs: "Physical transmission 0.92, warm amber tint, tapered brass structural spars, titanium cross-truss ribbing. Caliber transmission nominal.",
    explodedOffset: [3.8, 1.8, 1.2],
    condition: "nominal",
    tolerance: "99.2% Nominal",
  },
  "left-lower-wing": {
    id: "left-lower-wing",
    label: "Left Hindwing Assembly",
    subtitle: "Scalloped Swallowtail Foil",
    specs: "Physical transmission 0.90, jewel emerald tint, brass trailing bezel, root escapement gear collar. Aerodynamic balance nominal.",
    explodedOffset: [-3.0, -1.8, -1.2],
    condition: "nominal",
    tolerance: "98.8% Nominal",
  },
  "right-lower-wing": {
    id: "right-lower-wing",
    label: "Right Hindwing Assembly",
    subtitle: "Scalloped Swallowtail Foil",
    specs: "Physical transmission 0.90, jewel emerald tint, brass trailing bezel, root escapement gear collar. Aerodynamic balance nominal.",
    explodedOffset: [3.0, -1.8, -1.2],
    condition: "nominal",
    tolerance: "98.9% Nominal",
  },
  head: {
    id: "head",
    label: "Faceted Sensorium Head",
    subtitle: "Optical Compound Core",
    specs: "Faceted icosahedron gunmetal shell, dual ruby compound eye bezels, coiled brass mainspring proboscis. Optical sensors aligned.",
    explodedOffset: [0, 1.8, 3.4],
    condition: "nominal",
    tolerance: "99.6% Nominal",
  },
  "left-antenna": {
    id: "left-antenna",
    label: "Left Antenna Array",
    subtitle: "Escapement Sensor Mast",
    specs: "Curved 5-stage articulated stem ending in an 8-tooth escapement finial gear — minor tooth backlash detected, service advised.",
    explodedOffset: [-1.8, 3.6, 2.2],
    condition: "advisory",
    tolerance: "92.4% Advisory",
  },
  "right-antenna": {
    id: "right-antenna",
    label: "Right Antenna Array",
    subtitle: "Escapement Sensor Mast",
    specs: "Curved 5-stage articulated brass stem ending in an 8-tooth escapement finial gear spinning at 28,800 vph. Gear teeth within factory specs.",
    explodedOffset: [1.8, 3.6, 2.2],
    condition: "nominal",
    tolerance: "99.1% Nominal",
  },
  "main-gear": {
    id: "main-gear",
    label: "Master Drive Gear",
    subtitle: "Central Escapement Caliber",
    specs: "14-tooth polished brass spur gear driving dual-wing transmission. Mesh friction 0.04 Nm nominal, teeth polished.",
    explodedOffset: [0, 2.6, 0.4],
    condition: "nominal",
    tolerance: "99.5% Nominal",
  },
  "pinion-gear": {
    id: "pinion-gear",
    label: "Secondary Reduction Pinion",
    subtitle: "Torque Governor",
    specs: "10-tooth hardened gunmetal gear (1:1.75 reduction) — micro-abrasion detected on leading flank, inspect at next overhaul.",
    explodedOffset: [0, -2.2, -0.6],
    condition: "advisory",
    tolerance: "88.2% Advisory",
  },
  "left-bevel-gear": {
    id: "left-bevel-gear",
    label: "Left Bevel Pinion",
    subtitle: "45° Wing Transmission",
    specs: "8-tooth brass bevel pinion — bearing friction and excessive angular play detected, immediate horology maintenance required.",
    explodedOffset: [-2.2, 1.4, 0.2],
    condition: "critical",
    tolerance: "76.4% Critical",
  },
  "right-bevel-gear": {
    id: "right-bevel-gear",
    label: "Right Bevel Pinion",
    subtitle: "45° Wing Transmission",
    specs: "8-tooth brass bevel pinion converting central longitudinal rotation into transverse wing flapping torque. Smooth mesh, zero play.",
    explodedOffset: [2.2, 1.4, 0.2],
    condition: "nominal",
    tolerance: "98.7% Nominal",
  },
  "thorax-chassis": {
    id: "thorax-chassis",
    label: "Thorax Engine Capsule",
    subtitle: "Pressurized Mainframe",
    specs: "Machined gunmetal cylinder chassis with dual brass reinforcement rings, spine plates, and viewport. Structural integrity nominal.",
    explodedOffset: [0, 0, 0],
    condition: "nominal",
    tolerance: "100% Nominal",
  },
  abdomen: {
    id: "abdomen",
    label: "Articulated Tail Abdomen",
    subtitle: "6-Stage Kinetic Counterweight",
    specs: "6 interlocking ribbed gunmetal segments with brass rivet girdles, breathing curl joints, and needle stinger. Kinetic pivot flex nominal.",
    explodedOffset: [0, -1.8, -4.2],
    condition: "nominal",
    tolerance: "99.0% Nominal",
  },
  "fore-legs": {
    id: "fore-legs",
    label: "Foreleg Pair",
    subtitle: "Articulated Landing Claws",
    specs: "Twin jointed rods with brass spherical knuckle hinges and polished needle claw tips. Joint articulation nominal.",
    explodedOffset: [0, -2.8, 1.8],
    condition: "nominal",
    tolerance: "99.3% Nominal",
  },
  "mid-legs": {
    id: "mid-legs",
    label: "Midleg Pair",
    subtitle: "Kinetic Suspension Rods",
    specs: "Tempered steel femur rods with polished chrome knee pivots and needle claws. Suspension damping verified.",
    explodedOffset: [0, -3.2, -0.2],
    condition: "nominal",
    tolerance: "98.9% Nominal",
  },
  "hind-legs": {
    id: "hind-legs",
    label: "Hindleg Pair",
    subtitle: "Trailing Stabilizers",
    specs: "Extended-reach brass and steel leg rods providing aerodynamic balance in high-speed flight. Pivot alignment nominal.",
    explodedOffset: [0, -3.6, -2.0],
    condition: "nominal",
    tolerance: "99.5% Nominal",
  },
};

// Summary helper for condition tallies
export function getPartConditionSummary() {
  let critical = 0;
  let advisory = 0;
  let nominal = 0;
  for (const part of Object.values(BUTTERFLY_PARTS)) {
    if (part.condition === "critical") critical++;
    else if (part.condition === "advisory") advisory++;
    else nominal++;
  }
  return {
    critical,
    advisory,
    nominal,
    total: critical + advisory + nominal,
  };
}

// Ordered sequentially along the longitudinal Z scan axis (nose to tail)
export interface ScanPartInfo {
  id: string;
  triggerZ: number;
}

export const SCAN_PART_ORDER: ScanPartInfo[] = [
  { id: "left-antenna", triggerZ: 1.5 },
  { id: "right-antenna", triggerZ: 1.5 },
  { id: "head", triggerZ: 0.8 },
  { id: "fore-legs", triggerZ: 0.3 },
  { id: "left-upper-wing", triggerZ: 0.2 },
  { id: "right-upper-wing", triggerZ: 0.2 },
  { id: "main-gear", triggerZ: 0.1 },
  { id: "left-bevel-gear", triggerZ: 0.08 },
  { id: "right-bevel-gear", triggerZ: 0.08 },
  { id: "thorax-chassis", triggerZ: 0.0 },
  { id: "mid-legs", triggerZ: -0.06 },
  { id: "left-lower-wing", triggerZ: -0.16 },
  { id: "right-lower-wing", triggerZ: -0.16 },
  { id: "pinion-gear", triggerZ: -0.22 },
  { id: "hind-legs", triggerZ: -0.3 },
  { id: "abdomen", triggerZ: -0.7 },
];
