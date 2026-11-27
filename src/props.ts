import type { MatId } from "./materials";
import { SCULPTURES, type Shape } from "./sculptures";

/** A dynamic campus prop. Positions are world-space; the mesh sits on its center. */
export interface PropSpec {
  shape: Shape;
  mat: MatId;
  pos: [number, number, number];
  size: number[];
  rot?: [number, number, number];
  density: number;
  restitution: number;
  friction: number;
  fragile: boolean;
  core: boolean;
  gravityScale: number;
  ccd: boolean;
  /** World-space pivot for a spherical joint. Null for free bodies. */
  pendulum: [number, number, number] | null;
  damping: number;
  adamping: number;
  canSleep: boolean;
  tag: string;
  castShadow: boolean;
}

const CLEAR: Record<string, number> = {
  gateway: 4.4,
  affinity: 7.4,
  squad: 5.8,
  compass: 3.4,
  wilds: 3.3,
  miasmore: 4.4,
  shift: 3.4,
  threefold: 3.0,
  tea: 2.4,
};

function blocked(x: number, z: number): boolean {
  for (const sculpture of SCULPTURES) {
    const reach = CLEAR[sculpture.id] ?? 2.7;
    const dx = x - sculpture.origin[0];
    const dz = z - sculpture.origin[2];
    if (dx * dx + dz * dz < reach * reach) return true;
  }
  if (x * x + (z + 2.2) * (z + 2.2) < 4.4 * 4.4) return true;
  if ((x + 12.6) ** 2 + (z - 10.6) ** 2 < 2.2 ** 2) return true;
  if ((x + 8.3) ** 2 + (z + 73.6) ** 2 < 2.2 ** 2) return true;
  const travels: Array<[number, number]> = [[0, 12.4], [50.5, 0], [-50.5, 0], [0, -50.5], [0, 50.2]];
  for (const [tx, tz] of travels) {
    if ((x - tx) ** 2 + (z - tz) ** 2 < 2.4 ** 2) return true;
  }
  if (Math.abs(z) < 3.35 && Math.abs(x) > 15 && Math.abs(x) < 51) return true;
  if (Math.abs(x) < 3.35 && Math.abs(z) > 15 && Math.abs(z) < 51) return true;
  const courts: Array<[number, number]> = [[0, 0], [64, 0], [-64, 0], [0, -64], [0, 64]];
  for (const [cx, cz] of courts) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        if (Math.abs(x - (cx + sx * 12.2)) < 2.5 && Math.abs(z - (cz + sz * 12.2)) < 2.5) return true;
      }
    }
  }
  for (const px of [-6, 6]) {
    for (const pz of [-70, -58]) {
      if ((x - px) ** 2 + (z - pz) ** 2 < 1.1 ** 2) return true;
    }
  }
  if (Math.abs(z - 78.4) < 1.3 && Math.abs(x) < 9) return true;
  if (Math.abs(x) > 108 || Math.abs(z) > 108) return true;
  return false;
}

function base(partial: Omit<PropSpec, "rot" | "pendulum" | "castShadow"> & Partial<PropSpec>): PropSpec {
  return {
    rot: partial.rot,
    pendulum: partial.pendulum ?? null,
    castShadow: partial.castShadow ?? true,
    ...partial,
  };
}

export function campusProps(): PropSpec[] {
  const out: PropSpec[] = [];
  const add = (spec: PropSpec) => {
    if (blocked(spec.pos[0], spec.pos[2])) return;
    out.push(spec);
  };

  const stack = (
    x: number, z: number, count: number,
    w: number, h: number, d: number,
    mat: MatId, density: number, tag: string, fragile = false,
  ) => {
    for (let i = 0; i < count; i++) {
      const jx = ((i % 3) - 1) * 0.012;
      const jz = ((i % 2) - 0.5) * 0.012;
      add(base({
        shape: "box",
        mat,
        pos: [x + jx, h / 2 + 0.08 + i * (h + 0.02), z + jz],
        size: [w, h, d],
        rot: [0, (i % 2) * 0.03, 0],
        density,
        restitution: 0.08,
        friction: 0.78,
        fragile,
        core: false,
        gravityScale: 1,
        ccd: h < 0.2,
        damping: 0.22,
        adamping: 0.4,
        canSleep: true,
        tag,
        castShadow: h > 0.2,
      }));
    }
  };

  const dominos = (x0: number, z0: number, x1: number, z1: number, n: number) => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz) || 1;
    const yaw = Math.atan2(-dz / len, dx / len);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      add(base({
        shape: "box",
        mat: i % 2 === 0 ? "marble" : "olive",
        pos: [x0 + dx * t, 0.64, z0 + dz * t],
        size: [0.14, 1.08, 0.42],
        rot: [0, yaw, 0],
        density: 16,
        restitution: 0.04,
        friction: 0.48,
        fragile: false,
        core: false,
        gravityScale: 1,
        ccd: true,
        damping: 0.12,
        adamping: 0.28,
        canSleep: true,
        tag: "domino",
        castShadow: false,
      }));
    }
  };

  const urn = (x: number, z: number, amphora = false) => {
    add(base({
      shape: "cyl",
      mat: amphora ? "olive" : "marble",
      pos: [x, amphora ? 0.52 : 0.42, z],
      size: amphora ? [0.22, 0.32, 0.86] : [0.26, 0.3, 0.62],
      density: 18,
      restitution: 0.06,
      friction: 0.62,
      fragile: true,
      core: false,
      gravityScale: 1,
      ccd: true,
      damping: 0.2,
      adamping: 0.35,
      canSleep: true,
      tag: amphora ? "amphora" : "urn",
    }));
  };

  const sphere = (x: number, z: number, r: number, mat: MatId) => {
    add(base({
      shape: "sph",
      mat,
      pos: [x, r + 0.1, z],
      size: [r],
      density: mat === "gold" || mat === "chrome" ? 32 : 26,
      restitution: 0.42,
      friction: 0.32,
      fragile: false,
      core: false,
      gravityScale: 1,
      ccd: true,
      damping: 0.08,
      adamping: 0.12,
      canSleep: true,
      tag: "sphere",
    }));
  };

  const core = (x: number, z: number) => {
    add(base({
      shape: "sph",
      mat: "amber",
      pos: [x, 0.48, z],
      size: [0.4],
      density: 14,
      restitution: 0.18,
      friction: 0.45,
      fragile: false,
      core: true,
      gravityScale: 1,
      ccd: true,
      damping: 0.15,
      adamping: 0.2,
      canSleep: true,
      tag: "core",
    }));
  };

  const crystal = (x: number, y: number, z: number, r: number) => {
    add(base({
      shape: r > 0.34 ? "ico" : "oct",
      mat: "mint",
      pos: [x, y, z],
      size: [r],
      density: 6,
      restitution: 0.2,
      friction: 0.18,
      fragile: false,
      core: false,
      gravityScale: 0,
      ccd: true,
      damping: 0.55,
      adamping: 0.4,
      canSleep: false,
      tag: "crystal",
      castShadow: false,
    }));
  };

  const pendulum = (x: number, z: number, mat: MatId) => {
    const pivotY = 5.35;
    const bobY = 3.15;
    add(base({
      shape: "oct",
      mat,
      pos: [x, bobY, z],
      size: [0.36],
      density: 14,
      restitution: 0.12,
      friction: 0.4,
      fragile: false,
      core: false,
      gravityScale: 1,
      ccd: true,
      pendulum: [x, pivotY, z],
      damping: 0.04,
      adamping: 0.08,
      canSleep: false,
      tag: "pendulum",
    }));
  };

  const arch = (x: number, z: number, yaw: number) => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const span = 0.85;
    const pillars: Array<[number, number]> = [[-span, 0], [span, 0]];
    for (const [lx, lz] of pillars) {
      const wx = x + lx * c - lz * s;
      const wz = z + lx * s + lz * c;
      add(base({
        shape: "cyl",
        mat: "olive",
        pos: [wx, 1.05, wz],
        size: [0.16, 0.18, 1.9],
        rot: [0, yaw, 0],
        density: 22,
        restitution: 0.05,
        friction: 0.7,
        fragile: false,
        core: false,
        gravityScale: 1,
        ccd: false,
        damping: 0.2,
        adamping: 0.35,
        canSleep: true,
        tag: "arch",
      }));
    }
    add(base({
      shape: "box",
      mat: "marble",
      pos: [x, 2.12, z],
      size: [2.05, 0.22, 0.38],
      rot: [0, yaw, 0],
      density: 20,
      restitution: 0.04,
      friction: 0.66,
      fragile: false,
      core: false,
      gravityScale: 1,
      ccd: false,
      damping: 0.18,
      adamping: 0.3,
      canSleep: true,
      tag: "arch",
    }));
  };

  const pillars = (x: number, z: number) => {
    const spots: Array<[number, number]> = [[0, 0], [0.7, 0.15], [-0.55, 0.45], [0.2, -0.6]];
    spots.forEach(([ox, oz], i) => {
      const h = 1.7 + (i % 3) * 0.35;
      add(base({
        shape: "cyl",
        mat: i % 2 ? "obsidian" : "olive",
        pos: [x + ox, h / 2 + 0.08, z + oz],
        size: [0.16, 0.2, h],
        density: 20,
        restitution: 0.06,
        friction: 0.62,
        fragile: false,
        core: false,
        gravityScale: 1,
        ccd: false,
        damping: 0.16,
        adamping: 0.3,
        canSleep: true,
        tag: "pillar",
      }));
    });
  };

  // Grand Terrace — stacks, dominos, urns, spheres, an unstable arch, a pendulum.
  stack(9.2, -6.4, 5, 0.72, 0.48, 0.72, "obsidian", 48, "monolith");
  stack(-6.4, 9.4, 4, 0.64, 0.42, 0.64, "marble", 40, "monolith");
  dominos(-8.2, 8.4, -3.2, 8.4, 8);
  dominos(3.4, -11.2, 8.6, -11.2, 7);
  for (const [x, z] of [[11.2, -1.2], [10.4, -2.4], [-10.6, -7.4], [-9.6, -8.6]] as Array<[number, number]>) urn(x, z, z < -8);
  sphere(10.6, 7.6, 0.42, "gold");
  sphere(-10.2, -5.2, 0.5, "obsidian");
  sphere(4.8, 10.8, 0.34, "chrome");
  core(7.4, 10.6);
  core(-11.2, 2.4);
  arch(-3.6, -10.4, 0.4);
  pendulum(-10.8, 6.6, "chrome");
  pillars(6.2, 11.6);
  stack(11.4, 5.2, 3, 0.62, 0.62, 0.62, "wood", 16, "crate", true);

  // Nanogram Studio — obelisk court, outside the affinity ring.
  stack(74.2, 5.4, 5, 0.7, 0.46, 0.7, "graphite", 46, "monolith");
  stack(54.6, 7.2, 4, 0.6, 0.5, 0.6, "obsidian", 42, "monolith");
  dominos(56.2, 10.4, 63.4, 10.6, 9);
  dominos(72.4, -11.2, 76.2, -6.4, 7);
  for (const [x, z] of [[75.4, 1.2], [73.6, 2.2], [53.4, -4.2]] as Array<[number, number]>) urn(x, z, x > 74);
  sphere(70.5, 10.2, 0.46, "gold");
  sphere(58.4, -10.4, 0.4, "obsidian");
  sphere(76.2, 8.4, 0.32, "chrome");
  core(60.2, 11.4);
  core(75.6, -2.4);
  arch(68.4, 11.2, 0.2);
  pendulum(76.4, -6.2, "gold");
  pillars(52.8, 4.6);
  stack(55.2, 11.2, 3, 0.58, 0.58, 0.58, "wood", 15, "crate", true);

  // E&G Observatory — floating crystals, brass spheres, equation-side stacks.
  const crystals: Array<[number, number, number, number]> = [
    [-58.4, 2.4, 8.6, 0.28],
    [-57.2, 3.3, 9.4, 0.22],
    [-59.6, 1.8, 9.8, 0.34],
    [-56.4, 2.9, 7.6, 0.2],
    [-60.4, 3.6, 8.2, 0.26],
    [-72.2, 2.2, 10.4, 0.3],
    [-73.4, 3.1, 11.2, 0.18],
    [-71.2, 1.7, 11.6, 0.24],
    [-70.2, 2.8, -10.6, 0.32],
    [-71.6, 3.5, -9.4, 0.2],
    [-56.8, 2.1, -10.2, 0.26],
    [-55.6, 3.2, -11.2, 0.22],
  ];
  for (const [x, y, z, r] of crystals) crystal(x, y, z, r);
  stack(-74.6, -4.2, 4, 0.66, 0.44, 0.66, "obsidian", 40, "monolith");
  stack(-54.2, -8.4, 4, 0.58, 0.5, 0.58, "graphite", 38, "monolith");
  dominos(-76.4, 1.2, -76.4, 8.4, 8);
  sphere(-56.2, -12.2, 0.48, "obsidian");
  sphere(-74.2, 11.6, 0.36, "gold");
  sphere(-52.6, 8.8, 0.4, "chrome");
  core(-52.4, -3.6);
  core(-75.4, -10.2);
  core(-58.6, 11.6);
  arch(-70.4, -11.4, 1.2);
  pendulum(-55.2, 11.4, "chrome");
  pillars(-76.6, -8.2);
  for (const [x, z] of [[-53.2, 10.4], [-75.2, 4.6], [-52.8, -11.4]] as Array<[number, number]>) urn(x, z, true);
  stack(-58.2, -12.2, 3, 0.55, 0.55, 0.55, "wood", 14, "crate", true);

  // Mirthea's Nook — books, lanterns, crates, a warm stack.
  stack(11.2, -60.4, 7, 0.46, 0.08, 0.32, "wood", 12, "book", false);
  stack(10.4, -61.2, 5, 0.42, 0.07, 0.3, "olive", 12, "book", false);
  stack(-11.4, -62.4, 6, 0.44, 0.08, 0.3, "wood", 12, "book", false);
  for (const [x, z] of [[12.2, -68.4], [11.4, -72.2], [10.2, -75.4], [-12.2, -68.8]] as Array<[number, number]>) {
    add(base({
      shape: "oct",
      mat: "amber",
      pos: [x, 0.32, z],
      size: [0.22],
      density: 8,
      restitution: 0.1,
      friction: 0.55,
      fragile: true,
      core: false,
      gravityScale: 1,
      ccd: true,
      damping: 0.25,
      adamping: 0.35,
      canSleep: true,
      tag: "lantern",
      castShadow: false,
    }));
  }
  stack(12.4, -64.6, 3, 0.56, 0.56, 0.56, "wood", 15, "crate", true);
  stack(-12.4, -58.4, 3, 0.6, 0.5, 0.6, "olive", 18, "crate", true);
  dominos(8.4, -77.2, 13.2, -77.2, 7);
  sphere(-12.2, -74.8, 0.36, "gold");
  sphere(4.6, -78.2, 0.3, "chrome");
  core(12.2, -56.4);
  core(-11.6, -76.6);
  pendulum(0.2, -77.6, "amber");
  pillars(13.2, -64.2);
  urn(12.6, -58.8, true);
  urn(-11.2, -55.4, false);

  // Horizon courtyard (Mercy) — towers, dominos, arch, cores along the edge.
  stack(12.4, 58.2, 5, 0.7, 0.5, 0.7, "obsidian", 46, "monolith");
  stack(-12.6, 70.4, 4, 0.62, 0.46, 0.62, "marble", 40, "monolith");
  dominos(-13.2, 62.4, -13.2, 72.2, 8);
  dominos(8.4, 56.4, 13.2, 56.4, 6);
  sphere(-12.4, 76.2, 0.46, "obsidian");
  sphere(13.2, 64.4, 0.38, "gold");
  sphere(6.4, 77.2, 0.32, "chrome");
  core(13.2, 76.4);
  core(-13.2, 56.6);
  arch(12.2, 70.6, 0.6);
  pendulum(-5.4, 70.8, "gold");
  pillars(12.6, 62.4);
  for (const [x, z] of [[-11.4, 64.6], [-10.2, 66.2], [11.6, 74.2]] as Array<[number, number]>) urn(x, z, z > 70);
  stack(-12.2, 60.2, 3, 0.58, 0.58, 0.58, "wood", 15, "crate", true);

  // Linking courtyards, just off the walks so the path stays clear.
  stack(28.4, 6.4, 4, 0.58, 0.42, 0.58, "obsidian", 36, "monolith");
  dominos(36.2, -6.6, 43.4, -6.6, 8);
  sphere(44.6, 6.5, 0.4, "gold");
  core(24.2, -6.4);
  urn(40.2, 6.6, true);
  stack(-30.2, 6.5, 4, 0.55, 0.4, 0.55, "marble", 34, "monolith");
  dominos(-42.4, -6.5, -34.2, -6.5, 8);
  sphere(-24.6, -6.6, 0.44, "obsidian");
  core(-46.2, 6.4);
  urn(-38.4, 6.5, false);
  stack(6.5, -28.4, 4, 0.56, 0.4, 0.56, "olive", 32, "monolith");
  dominos(-6.6, -40.2, -6.6, -32.4, 8);
  sphere(6.4, -44.6, 0.36, "chrome");
  core(-6.5, -24.4);
  stack(-6.5, 30.2, 4, 0.6, 0.44, 0.6, "graphite", 36, "monolith");
  dominos(6.6, 34.2, 6.6, 42.4, 8);
  sphere(-6.4, 45.2, 0.42, "gold");
  core(6.5, 24.6);
  urn(-6.6, 38.4, true);

  return out;
}
