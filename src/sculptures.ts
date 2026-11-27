import type { MatId } from "./materials";

export type Shape = "box" | "cyl" | "sph" | "cone" | "oct" | "ico" | "dod" | "cap";

export interface Orbit {
  r: number;
  speed: number;
  phase: number;
}

export interface PieceSpec {
  shape: Shape;
  pos: [number, number, number];
  size: number[];
  mat: MatId;
  rot?: [number, number, number];
  orbit?: Orbit;
}

export interface Hoop {
  radius: number;
  tube: number;
  pos: [number, number, number];
  rot: [number, number, number];
  mat: MatId;
  spin: number;
}

export type WingId = "terrace" | "studio" | "observatory" | "nook" | "mercy";

export interface SculptureDef {
  id: string;
  wing: WingId;
  origin: [number, number, number];
  plaqueAt: [number, number, number];
  plaqueYaw: number;
  pieces: PieceSpec[];
  hoops?: Hoop[];
}

export interface WingInfo {
  id: WingId;
  name: string;
  line: string;
  x: number;
  z: number;
  yaw: number;
}

export const WINGS: WingInfo[] = [
  { id: "terrace", name: "Grand Terrace", line: "Room for ambition. Respect for the work.", x: 0, z: 12.4, yaw: 0 },
  { id: "studio", name: "Nanogram Studio", line: "Make a world worth getting lost in.", x: 50.5, z: 0, yaw: -Math.PI / 2 },
  { id: "observatory", name: "E&G Observatory", line: "Ask bigger questions. Demand clearer answers.", x: -50.5, z: 0, yaw: Math.PI / 2 },
  { id: "nook", name: "Mirthea’s Nook", line: "Half angel. Half demon. Entirely a handful.", x: 0, z: -50.5, yaw: 0 },
  { id: "mercy", name: "Mercy & Paragon", line: "Worlds that stay with you.", x: 0, z: 50.2, yaw: Math.PI },
];

const box = (
  x: number, y: number, z: number,
  w: number, h: number, d: number,
  mat: MatId,
  rot?: [number, number, number],
): PieceSpec => ({ shape: "box", pos: [x, y, z], size: [w, h, d], mat, rot });

const cyl = (
  x: number, y: number, z: number,
  rt: number, rb: number, h: number,
  mat: MatId,
  rot?: [number, number, number],
): PieceSpec => ({ shape: "cyl", pos: [x, y, z], size: [rt, rb, h], mat, rot });

const sph = (x: number, y: number, z: number, r: number, mat: MatId): PieceSpec => ({
  shape: "sph", pos: [x, y, z], size: [r], mat,
});

function arcXY(
  cx: number, cy: number, cz: number,
  radius: number, a0: number, a1: number, count: number,
  radial: number, depth: number, mat: MatId,
): PieceSpec[] {
  const span = (a1 - a0) / count;
  const out: PieceSpec[] = [];
  for (let i = 0; i < count; i++) {
    const a = a0 + span * (i + 0.5);
    out.push(box(
      cx + Math.cos(a) * radius,
      cy + Math.sin(a) * radius,
      cz,
      Math.abs(span) * radius * 0.72,
      radial,
      depth,
      mat,
      [0, 0, a + Math.PI / 2],
    ));
  }
  return out;
}

function arcXZ(
  cx: number, cy: number, cz: number,
  radius: number, count: number,
  radial: number, height: number, mat: MatId,
  a0 = 0, a1 = Math.PI * 2,
): PieceSpec[] {
  const span = (a1 - a0) / count;
  const out: PieceSpec[] = [];
  for (let i = 0; i < count; i++) {
    const a = a0 + span * (i + 0.5);
    out.push(box(
      cx + Math.cos(a) * radius,
      cy,
      cz + Math.sin(a) * radius,
      Math.abs(span) * radius * 0.72,
      height,
      radial,
      mat,
      [0, a + Math.PI / 2, 0],
    ));
  }
  return out;
}

function pillar(x: number, z: number, h: number, r: number, mat: MatId, gem: MatId): PieceSpec[] {
  return [
    box(x, 0.14, z, r * 2.6, 0.28, r * 2.6, "marble"),
    cyl(x, 0.28 + h / 2, z, r * 0.92, r * 1.08, h, mat),
    sph(x, 0.36 + h + r * 0.55, z, r * 0.48, gem),
  ];
}

function gateway(): PieceSpec[] {
  const pieces: PieceSpec[] = [];
  for (const x of [-2.7, 2.7]) {
    pieces.push(
      box(x, 0.22, 0, 1.35, 0.44, 1.35, "marble"),
      box(x, 2.45, 0, 0.92, 4.0, 0.92, "obsidian"),
      box(x, 4.62, 0, 1.2, 0.34, 1.2, "olive"),
      sph(x, 5.05, 0, 0.28, "gold"),
      box(x, 2.5, 0.56, 0.18, 3.2, 0.08, "gold"),
    );
  }
  pieces.push(
    ...arcXY(0, 4.55, 0, 2.7, Math.PI * 0.08, Math.PI * 0.92, 7, 0.42, 0.72, "chrome"),
    box(-1.15, 3.35, 0, 0.7, 1.15, 0.08, "amber"),
    box(1.15, 3.35, 0, 0.7, 1.15, 0.08, "amber"),
    box(0, 0.06, 1.4, 2.4, 0.1, 1.1, "gold"),
    ...arcXZ(0, 6.55, 0, 1.15, 8, 0.12, 0.1, "gold"),
  );
  return pieces;
}

function agency(): PieceSpec[] {
  return [
    box(0, 0.16, 0, 1.8, 0.32, 1.5, "marble"),
    box(-0.22, 0.95, 0.08, 0.28, 1.15, 0.3, "olive"),
    box(0.24, 0.9, -0.12, 0.26, 1.05, 0.28, "olive", [0.25, 0, 0]),
    box(0, 1.7, 0, 0.72, 0.4, 0.38, "obsidian"),
    box(0, 2.28, 0, 0.58, 0.78, 0.34, "olive"),
    box(0, 2.35, 0.22, 0.36, 0.5, 0.06, "gold"),
    sph(0, 2.92, 0, 0.24, "marble"),
    box(0.55, 2.35, 0.05, 0.5, 0.14, 0.14, "olive"),
    box(1.05, 2.22, 0.2, 0.42, 0.12, 0.12, "gold", [0, 0.2, -0.5]),
    sph(1.32, 2.08, 0.32, 0.09, "mint"),
    box(-0.08, 1.9, -0.32, 0.55, 1.35, 0.06, "graphite", [0.18, 0, 0.04]),
    box(0.22, 1.75, -0.4, 0.4, 1.15, 0.05, "obsidian", [0.22, 0.1, -0.05]),
    ...arcXY(0, 2.95, -0.08, 0.42, 0.4, Math.PI - 0.4, 5, 0.07, 0.07, "gold"),
  ];
}

function evidence(): PieceSpec[] {
  return [
    box(0, 0.14, 0, 1.7, 0.28, 1.3, "obsidian"),
    cyl(0, 0.85, 0, 0.18, 0.28, 1.15, "graphite"),
    box(0, 1.5, 0, 1.15, 0.08, 0.72, "marble", [0.15, 0.1, 0]),
    box(0.05, 1.58, 0.02, 1.05, 0.06, 0.62, "olive", [-0.2, -0.15, 0]),
    ...arcXY(0, 2.15, 0, 0.72, 0.2, Math.PI - 0.2, 7, 0.1, 0.1, "chrome"),
    box(0, 2.15, 0, 0.85, 0.85, 0.05, "amber"),
    sph(-0.55, 1.85, 0.35, 0.08, "mint"),
    sph(0.48, 2.45, 0.2, 0.07, "gold"),
    box(0, 1.15, 0.45, 0.45, 0.06, 0.32, "gold"),
  ];
}

function compass(): PieceSpec[] {
  const mats: MatId[] = ["gold", "graphite", "wood"];
  const gems: MatId[] = ["amber", "mint", "olive"];
  const pieces: PieceSpec[] = [
    cyl(0, 0.1, 0, 2.5, 2.5, 0.2, "marble"),
    cyl(0, 0.38, 0, 0.42, 0.55, 0.4, "obsidian"),
    sph(0, 0.85, 0, 0.32, "gold"),
  ];
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    const x = Math.cos(a) * 1.7;
    const z = Math.sin(a) * 1.7;
    const px = Math.cos(a);
    const pz = Math.sin(a);
    pieces.push(
      box(x - pz * 0.45, 0.55, z + px * 0.45, 0.22, 0.9, 0.22, mats[i]),
      box(x + pz * 0.45, 0.55, z - px * 0.45, 0.22, 0.9, 0.22, mats[i]),
      box(x, 1.08, z, 1.15, 0.16, 0.22, mats[i], [0, -a, 0]),
      sph(x, 1.32, z, 0.12, gems[i]),
    );
  }
  return pieces;
}

function wilds(): PieceSpec[] {
  const pieces: PieceSpec[] = [
    cyl(0, 0.18, 0, 2.1, 2.3, 0.36, "obsidian"),
    cyl(0, 0.48, 0, 1.35, 1.5, 0.28, "marble"),
    { shape: "ico", pos: [0, 1.85, 0], size: [0.85], mat: "olive" },
    sph(0, 1.85, 0, 0.28, "mint"),
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = Math.cos(a) * 1.15;
    const z = Math.sin(a) * 1.15;
    pieces.push(
      cyl(x * 0.55, 1.7, z * 0.55, 0.07, 0.1, 1.15, "gold", [Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9]),
      { shape: "oct", pos: [x * 1.15, 2.15 + (i % 2) * 0.25, z * 1.15], size: [0.22], mat: i % 2 ? "mint" : "amber" },
    );
  }
  pieces.push(...arcXZ(0, 2.7, 0, 1.45, 8, 0.1, 0.08, "chrome"));
  return pieces;
}

function affinity(): PieceSpec[] {
  const order: { mat: MatId; gem: MatId }[] = [
    { mat: "gold", gem: "amber" },
    { mat: "graphite", gem: "obsidian" },
    { mat: "marble", gem: "gold" },
    { mat: "obsidian", gem: "graphite" },
    { mat: "olive", gem: "amber" },
    { mat: "chrome", gem: "mint" },
    { mat: "marble", gem: "chrome" },
    { mat: "olive", gem: "mint" },
  ];
  const pieces: PieceSpec[] = [];
  order.forEach((p, i) => {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    pieces.push(...pillar(Math.cos(a) * 6.4, Math.sin(a) * 6.4, 2.4 + (i % 3) * 0.25, 0.28, p.mat, p.gem));
  });
  return pieces;
}

function genesis(): PieceSpec[] {
  const figure = (x: number, wing: MatId, body: MatId): PieceSpec[] => [
    box(x, 0.7, 0, 0.32, 1.15, 0.26, body),
    sph(x, 1.48, 0, 0.2, "marble"),
    box(x - 0.45, 1.05, -0.05, 0.7, 0.08, 0.28, wing, [0, 0, 0.35]),
    box(x + 0.45, 1.05, -0.05, 0.7, 0.08, 0.28, wing, [0, 0, -0.35]),
  ];
  return [
    cyl(0, 0.12, 0, 2.2, 2.2, 0.24, "obsidian"),
    ...figure(-0.7, "gold", "olive"),
    ...figure(0.7, "graphite", "obsidian"),
    cyl(0, 0.45, 0, 0.35, 0.45, 0.45, "marble"),
    sph(-1.5, 0.55, 0.2, 0.1, "amber"),
    sph(-1.2, 0.7, -0.7, 0.09, "mint"),
    sph(1.4, 0.6, 0.5, 0.1, "gold"),
    sph(1.15, 0.85, -0.45, 0.08, "chrome"),
    sph(0, 1.15, 0.9, 0.1, "mint"),
    sph(0.2, 0.9, -1.2, 0.09, "amber"),
  ];
}

function pod(): PieceSpec[] {
  return [
    { shape: "cap", pos: [0, 1.2, 0], size: [0.5, 1.55], mat: "chrome", rot: [0, 0, Math.PI / 2] },
    box(-0.45, 1.82, 0, 0.35, 0.12, 0.55, "gold"),
    box(0.15, 1.86, 0, 0.35, 0.12, 0.55, "gold"),
    box(0.7, 1.8, 0, 0.3, 0.1, 0.48, "chrome"),
    box(0.15, 1.2, 0.62, 0.7, 0.28, 0.06, "amber"),
    cyl(-0.45, 0.4, 0.28, 0.08, 0.12, 0.7, "graphite"),
    cyl(0.45, 0.4, -0.28, 0.08, 0.12, 0.7, "graphite"),
    { shape: "cone", pos: [1.85, 1.2, 0], size: [0.38, 0.55], mat: "gold", rot: [0, 0, -Math.PI / 2] },
    ...arcXZ(0, 0.1, 0, 1.25, 8, 0.14, 0.1, "obsidian"),
    sph(0, 1.2, -0.62, 0.1, "mint"),
  ];
}

function frame(): PieceSpec[] {
  return [
    box(-1.25, 1.7, 0, 0.14, 3.05, 0.16, "gold"),
    box(1.25, 1.7, 0, 0.14, 3.05, 0.16, "gold"),
    box(0, 3.28, 0, 2.35, 0.14, 0.16, "gold"),
    box(0, 0.22, 0, 2.35, 0.16, 0.2, "gold"),
    box(0, 1.7, -0.12, 2.05, 2.7, 0.06, "obsidian"),
    box(-0.45, 0.7, 0.05, 0.55, 0.35, 0.35, "olive"),
    box(0.15, 0.95, 0.08, 0.4, 0.7, 0.3, "marble"),
    box(0.55, 0.6, 0.02, 0.35, 0.4, 0.4, "olive"),
    sph(-0.2, 1.7, 0.12, 0.16, "mint"),
    box(0.1, 2.15, 0.1, 0.7, 0.08, 0.25, "amber"),
    cyl(-1.25, 0.12, 0.35, 0.18, 0.22, 0.2, "obsidian"),
    cyl(1.25, 0.12, 0.35, 0.18, 0.22, 0.2, "obsidian"),
  ];
}

function deck(): PieceSpec[] {
  const pieces: PieceSpec[] = [
    cyl(0, 0.1, 0, 1.15, 1.25, 0.2, "obsidian"),
    cyl(0, 1.3, 0, 0.06, 0.06, 2.2, "mint"),
  ];
  for (let i = 0; i < 10; i++) {
    const a = i * 0.55;
    const rad = 0.35 + i * 0.06;
    pieces.push(box(
      Math.cos(a) * rad,
      0.32 + i * 0.18,
      Math.sin(a) * rad,
      0.62,
      0.045,
      0.4,
      i % 2 ? "wood" : "gold",
      [0, a, 0.08],
    ));
  }
  return pieces;
}

function differentiality(): PieceSpec[] {
  const pieces: PieceSpec[] = [
    box(0, 0.16, 0, 1.8, 0.32, 1.8, "obsidian"),
    cyl(0, 2.5, 0, 0.08, 0.1, 4.3, "gold"),
    sph(0, 4.75, 0, 0.14, "mint"),
    box(0, 0.45, 0.7, 0.9, 0.08, 0.4, "marble"),
  ];
  const heights = [1.1, 1.7, 2.3, 2.9, 3.5, 4.1];
  heights.forEach((y, i) => {
    pieces.push({
      shape: "box",
      pos: [0, y, 0],
      size: [0.22, 0.22, 0.22],
      mat: i % 2 ? "chrome" : "amber",
      orbit: { r: 0.55 + (i % 3) * 0.28, speed: 0.35 + i * 0.06, phase: i * 1.1 },
    });
  });
  return pieces;
}

function twinlens(): PieceSpec[] {
  return [
    box(0, 0.16, 0, 3.4, 0.32, 1.3, "obsidian"),
    cyl(-1.15, 0.7, 0, 0.12, 0.16, 0.9, "graphite"),
    cyl(1.15, 0.7, 0, 0.12, 0.16, 0.9, "olive"),
    ...arcXY(-1.05, 1.85, 0, 0.78, 0, Math.PI * 2, 8, 0.12, 0.1, "chrome"),
    ...arcXY(1.05, 1.85, 0, 0.78, 0, Math.PI * 2, 8, 0.12, 0.1, "amber"),
    sph(0, 1.85, 0, 0.16, "mint"),
    sph(0, 2.55, 0, 0.08, "gold"),
  ];
}

function lattice(): PieceSpec[] {
  const pieces: PieceSpec[] = [box(0, 0.35, 0, 2.5, 0.7, 2.5, "obsidian")];
  for (let x = -1; x <= 1; x++) {
    for (let y = 0; y <= 2; y++) {
      for (let z = -1; z <= 1; z++) {
        if (Math.abs(x) + Math.abs(y - 1) + Math.abs(z) === 0) continue;
        pieces.push(sph(x * 0.62, 1.15 + y * 0.62, z * 0.62, 0.11, (x + y + z) % 2 === 0 ? "mint" : "chrome"));
      }
    }
  }
  return pieces;
}

function threefold(): PieceSpec[] {
  return [
    cyl(0, 0.12, 0, 2.0, 2.15, 0.24, "marble"),
    sph(0, 1.15, 0, 0.28, "gold"),
    box(-1.15, 1.15, 0.15, 0.7, 0.7, 0.7, "olive"),
    { shape: "cone", pos: [1.15, 1.2, 0.1], size: [0.48, 1.15], mat: "amber" },
    sph(0.05, 1.35, -1.15, 0.48, "chrome"),
    sph(-1.15, 1.7, 0.15, 0.1, "mint"),
    box(0, 0.4, 1.15, 0.7, 0.08, 0.28, "graphite"),
  ];
}

function tea(): PieceSpec[] {
  return [
    cyl(0, 0.08, 0, 1.25, 1.25, 0.12, "marble"),
    cyl(0, 0.55, 0, 0.72, 0.58, 0.85, "olive"),
    cyl(0, 0.95, 0, 0.62, 0.62, 0.08, "amber"),
    ...arcXZ(0, 1.02, 0, 0.78, 8, 0.1, 0.08, "gold"),
    ...arcXY(0.95, 0.7, 0, 0.32, -0.4, Math.PI + 0.4, 4, 0.08, 0.08, "gold"),
    box(0.35, 1.15, 0.15, 0.16, 0.16, 0.16, "marble"),
    sph(0.9, 1.45, 0.4, 0.1, "mint"),
  ];
}

function starchart(): PieceSpec[] {
  const pieces: PieceSpec[] = [
    box(0, 0.42, 0, 2.4, 0.12, 1.5, "wood"),
    box(-1.0, 0.22, -0.55, 0.12, 0.44, 0.12, "olive"),
    box(1.0, 0.22, -0.55, 0.12, 0.44, 0.12, "olive"),
    box(-1.0, 0.22, 0.55, 0.12, 0.44, 0.12, "olive"),
    box(1.0, 0.22, 0.55, 0.12, 0.44, 0.12, "olive"),
    ...arcXZ(0, 0.55, 0, 0.85, 10, 0.06, 0.045, "gold"),
    ...arcXZ(0, 0.58, 0, 0.5, 8, 0.05, 0.04, "chrome"),
  ];
  const stars: [number, number, number][] = [
    [-0.7, 0.85, -0.25],
    [0.15, 1.15, 0.1],
    [0.6, 0.75, -0.35],
    [-0.2, 0.95, 0.4],
    [0.35, 1.35, -0.15],
    [-0.45, 0.7, 0.15],
  ];
  for (const [x, y, z] of stars) {
    pieces.push(cyl(x, (y + 0.5) / 2, z, 0.015, 0.015, y - 0.5, "gold"));
    pieces.push(sph(x, y, z, 0.07, "amber"));
  }
  return pieces;
}

function lantern(): PieceSpec[] {
  const pieces: PieceSpec[] = [
    cyl(0, 0.12, 0, 0.55, 0.7, 0.24, "obsidian"),
    sph(0, 1.55, 0, 0.28, "amber"),
    { shape: "cone", pos: [0, 2.85, 0], size: [0.48, 0.55], mat: "gold" },
    box(-0.55, 1.7, 0, 0.45, 0.08, 0.22, "gold", [0, 0, 0.4]),
    box(0.55, 1.7, 0, 0.45, 0.08, 0.22, "gold", [0, 0, -0.4]),
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    pieces.push(box(Math.cos(a) * 0.42, 1.55, Math.sin(a) * 0.42, 0.08, 1.15, 0.22, i % 2 ? "amber" : "olive", [0, -a, 0]));
  }
  pieces.push({
    shape: "sph",
    pos: [0, 2.15, 0],
    size: [0.08],
    mat: "mint",
    orbit: { r: 0.7, speed: 0.8, phase: 0 },
  });
  return pieces;
}

function creed(): PieceSpec[] {
  return [
    box(0, 0.2, 0, 1.8, 0.4, 1.1, "marble"),
    box(0, 2.45, 0, 0.42, 4.1, 1.35, "obsidian"),
    box(0, 2.45, 0.72, 0.08, 3.6, 0.06, "gold"),
    box(0.28, 2.45, 0, 0.06, 3.8, 1.15, "gold"),
    ...arcXY(0, 3.3, 0.95, 0.38, 0, Math.PI * 2, 6, 0.07, 0.07, "gold"),
    ...arcXY(0.15, 3.3, 0.95, 0.38, 0, Math.PI * 2, 6, 0.07, 0.07, "chrome"),
    { shape: "cone", pos: [-0.22, 4.7, 0.2], size: [0.08, 0.22], mat: "gold" },
    { shape: "cone", pos: [0, 4.82, 0.2], size: [0.08, 0.28], mat: "gold" },
    { shape: "cone", pos: [0.22, 4.7, 0.2], size: [0.08, 0.22], mat: "gold" },
    sph(0, 0.7, 0.85, 0.1, "amber"),
  ];
}

function palimpsest(): PieceSpec[] {
  const pieces: PieceSpec[] = [box(0, 0.16, 0, 2.4, 0.32, 1.6, "obsidian")];
  for (let i = 0; i < 5; i++) {
    pieces.push(box(
      -0.15 + i * 0.08,
      1.3 + i * 0.12,
      -0.35 + i * 0.22,
      1.5 - i * 0.08,
      2.1 - i * 0.12,
      0.06,
      i % 2 ? "chrome" : "amber",
    ));
  }
  pieces.push(
    box(-0.4, 0.55, 0.7, 0.22, 0.4, 0.22, "olive"),
    box(-0.05, 0.7, 0.85, 0.28, 0.7, 0.22, "marble"),
    box(0.35, 0.5, 0.65, 0.2, 0.35, 0.2, "graphite"),
    sph(0.1, 1.3, 0.95, 0.08, "mint"),
  );
  return pieces;
}

function miasmore(): PieceSpec[] {
  const mats: MatId[] = ["marble", "graphite", "obsidian"];
  const pieces: PieceSpec[] = [box(0, 0.1, 0, 6.2, 0.2, 1.4, "olive")];
  mats.forEach((mat, i) => {
    const x = (i - 1) * 2.05;
    const h = 2.3 + i * 0.25;
    pieces.push(
      box(x - 0.45, h / 2 + 0.2, 0, 0.16, h, 0.28, mat),
      box(x + 0.45, h / 2 + 0.2, 0, 0.16, h, 0.28, mat),
      box(x, h + 0.28, 0, 1.1, 0.16, 0.32, mat),
      sph(x, h + 0.5, 0, 0.09, i === 2 ? "amber" : "gold"),
    );
  });
  return pieces;
}

function shift(): PieceSpec[] {
  return [
    ...arcXY(0, 2.35, 0, 2.15, Math.PI * 0.08, Math.PI * 0.5, 4, 0.32, 0.55, "obsidian"),
    ...arcXY(0, 2.35, 0, 2.15, Math.PI * 0.5, Math.PI * 0.92, 4, 0.32, 0.55, "chrome"),
    sph(0, 4.5, 0, 0.16, "mint"),
    box(-1.15, 0.08, 0.4, 0.9, 0.08, 0.35, "gold"),
    box(1.15, 0.08, 0.4, 0.9, 0.08, 0.35, "chrome"),
    cyl(-2.15, 1.15, 0, 0.18, 0.24, 2.2, "olive"),
    cyl(2.15, 1.15, 0, 0.16, 0.2, 2.2, "graphite"),
  ];
}

function squad(): PieceSpec[] {
  const pieces: PieceSpec[] = [
    cyl(0, 0.12, 0, 4.3, 4.5, 0.24, "obsidian"),
    cyl(0, 0.55, 0, 2.15, 2.15, 0.7, "marble"),
  ];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    pieces.push({
      shape: "sph",
      pos: [Math.cos(a) * 3.15, 1.25, Math.sin(a) * 3.15],
      size: [0.1],
      mat: i % 4 === 0 ? "mint" : "gold",
      orbit: { r: 0, speed: 0.18, phase: a },
    });
  }
  // orbit r 0 would collapse; set r on a shared center instead via pos at origin and r 3.15
  for (const p of pieces) {
    if (p.orbit && p.shape === "sph" && p.size[0] === 0.1) {
      p.orbit.r = 3.15;
      p.orbit.phase = Math.atan2(p.pos[2], p.pos[0]);
      p.pos = [0, 1.25, 0];
    }
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.15;
    pieces.push(...pillar(Math.cos(a) * 4.55, Math.sin(a) * 4.55, 1.7, 0.16, "olive", "mint"));
  }
  return pieces;
}

export const SCULPTURES: SculptureDef[] = [
  { id: "gateway", wing: "terrace", origin: [0, 0, -9.5], plaqueAt: [3.6, 0, 2.2], plaqueYaw: -0.6, pieces: gateway(), hoops: [] },
  { id: "agency", wing: "terrace", origin: [-8.2, 0, 2.4], plaqueAt: [0, 0, 1.7], plaqueYaw: 0, pieces: agency() },
  { id: "evidence", wing: "terrace", origin: [8.2, 0, 2.4], plaqueAt: [0, 0, 1.6], plaqueYaw: 0, pieces: evidence() },
  { id: "compass", wing: "terrace", origin: [0, 0, 6.2], plaqueAt: [0, 0, 3.2], plaqueYaw: 0, pieces: compass() },
  { id: "wilds", wing: "studio", origin: [64, 0, -2], plaqueAt: [-3.4, 0, 2.4], plaqueYaw: -Math.PI / 2, pieces: wilds(),
    hoops: [
      { radius: 1.7, tube: 0.035, pos: [0, 1.9, 0], rot: [Math.PI / 2, 0, 0], mat: "mint", spin: 0.4 },
      { radius: 2.05, tube: 0.025, pos: [0, 1.9, 0], rot: [Math.PI / 2.2, 0.4, 0], mat: "gold", spin: -0.25 },
    ] },
  { id: "affinity", wing: "studio", origin: [64, 0, -2], plaqueAt: [-7.6, 0, 3.5], plaqueYaw: -Math.PI / 2, pieces: affinity() },
  { id: "genesis", wing: "studio", origin: [64, 0, 8.2], plaqueAt: [0, 0, 2.6], plaqueYaw: 0, pieces: genesis() },
  { id: "pod", wing: "studio", origin: [55.2, 0, -8], plaqueAt: [0, 0, 2.2], plaqueYaw: 0, pieces: pod() },
  { id: "frame", wing: "studio", origin: [73.2, 0, -7.5], plaqueAt: [0, 0, 1.5], plaqueYaw: 0, pieces: frame() },
  { id: "deck", wing: "studio", origin: [73.4, 0, 7.6], plaqueAt: [1.8, 0, 0.2], plaqueYaw: Math.PI / 2, pieces: deck() },
  { id: "differentiality", wing: "observatory", origin: [-64, 0, -1.5], plaqueAt: [0, 0, 2.3], plaqueYaw: 0, pieces: differentiality() },
  { id: "twinlens", wing: "observatory", origin: [-64, 0, -9], plaqueAt: [0, 0, 1.8], plaqueYaw: 0, pieces: twinlens() },
  { id: "lattice", wing: "observatory", origin: [-73.2, 0, 6.2], plaqueAt: [0, 0, 2.1], plaqueYaw: 0, pieces: lattice() },
  { id: "threefold", wing: "observatory", origin: [-54.8, 0, 6.4], plaqueAt: [0, 0, 2.4], plaqueYaw: 0, pieces: threefold() },
  { id: "tea", wing: "nook", origin: [0, 0, -66], plaqueAt: [1.8, 0, 1.3], plaqueYaw: 0.5, pieces: tea(),
    hoops: [{ radius: 0.62, tube: 0.04, pos: [0, 1.85, 0], rot: [1.1, 0.2, 0.3], mat: "gold", spin: 0.35 }] },
  { id: "starchart", wing: "nook", origin: [-7.4, 0, -56.5], plaqueAt: [0, 0, 1.5], plaqueYaw: 0, pieces: starchart() },
  { id: "lantern", wing: "nook", origin: [7.2, 0, -74.2], plaqueAt: [1.4, 0, 1.2], plaqueYaw: 0.8, pieces: lantern() },
  { id: "creed", wing: "mercy", origin: [8.6, 0, 72.5], plaqueAt: [0, 0, 1.6], plaqueYaw: Math.PI, pieces: creed() },
  { id: "palimpsest", wing: "mercy", origin: [-8.8, 0, 59.5], plaqueAt: [0, 0, 1.8], plaqueYaw: Math.PI, pieces: palimpsest() },
  { id: "miasmore", wing: "mercy", origin: [0, 0, 75.2], plaqueAt: [0, 0, 1.8], plaqueYaw: Math.PI, pieces: miasmore() },
  { id: "shift", wing: "mercy", origin: [0, 0, 54.2], plaqueAt: [3.2, 0, 0.4], plaqueYaw: Math.PI / 2, pieces: shift() },
  { id: "squad", wing: "mercy", origin: [0, 0, 66], plaqueAt: [0, 0, 5.4], plaqueYaw: Math.PI, pieces: squad() },
];

export function sculptureById(id: string): SculptureDef | undefined {
  return SCULPTURES.find((s) => s.id === id);
}
