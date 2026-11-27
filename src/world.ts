import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MaterialLibrary } from "./materials";

export interface BoxCol {
  kind: "box";
  x: number;
  y: number;
  z: number;
  hx: number;
  hy: number;
  hz: number;
}
export interface CylCol {
  kind: "cyl";
  x: number;
  y: number;
  z: number;
  halfH: number;
  r: number;
}
export type ColliderSpec = BoxCol | CylCol;

export interface BuiltWorld {
  group: THREE.Group;
  colliders: ColliderSpec[];
  grounds: THREE.Object3D[];
  lanterns: THREE.PointLight[];
  spins: THREE.Object3D[];
}

interface Court {
  hx: number;
  hz: number;
  x: number;
  z: number;
  openings: Array<"n" | "s" | "e" | "w">;
}

const COURTS: Court[] = [
  { x: 0, z: 0, hx: 17, hz: 17, openings: ["n", "s", "e", "w"] },
  { x: 64, z: 0, hx: 15, hz: 15, openings: ["w"] },
  { x: -64, z: 0, hx: 15, hz: 15, openings: ["e"] },
  { x: 0, z: -64, hx: 15, hz: 15, openings: ["s"] },
  { x: 0, z: 64, hx: 15, hz: 15, openings: ["n"] },
];

export const DRESSING = {
  bust: { x: -12.6, z: 10.6, top: 1.05, yaw: 0.5 },
  cat: { x: -8.3, z: -73.6, top: 0.52, yaw: 0.4 },
};

export function buildWorld(mats: MaterialLibrary): BuiltWorld {
  const group = new THREE.Group();
  const colliders: ColliderSpec[] = [];
  const grounds: THREE.Object3D[] = [];
  const spins: THREE.Object3D[] = [];
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();

  const push = (mat: THREE.Material, geo: THREE.BufferGeometry) => {
    const list = buckets.get(mat) ?? [];
    list.push(geo);
    buckets.set(mat, list);
  };
  const putBox = (
    mat: THREE.Material,
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    rot?: [number, number, number],
    tile = 2.4,
  ) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    scaleUvs(geo, Math.max(w, h, d) / tile);
    geo.applyMatrix4(compose(x, y, z, rot));
    push(mat, geo);
  };

  const garden = new THREE.Mesh(new THREE.CircleGeometry(120, 64), mats.arch.garden);
  garden.rotation.x = -Math.PI / 2;
  garden.position.y = 0;
  garden.receiveShadow = true;
  group.add(garden);
  grounds.push(garden);
  scaleUvs(garden.geometry, 28);

  colliders.push({ kind: "box", x: 0, y: -1.5, z: 0, hx: 140, hy: 1.5, hz: 140 });
  colliders.push({ kind: "box", x: 110, y: 4, z: 0, hx: 1, hy: 6, hz: 110 });
  colliders.push({ kind: "box", x: -110, y: 4, z: 0, hx: 1, hy: 6, hz: 110 });
  colliders.push({ kind: "box", x: 0, y: 4, z: 110, hx: 110, hy: 6, hz: 1 });
  colliders.push({ kind: "box", x: 0, y: 4, z: -110, hx: 110, hy: 6, hz: 1 });

  for (const court of COURTS) {
    putBox(mats.arch.floor, court.hx * 2, 0.36, court.hz * 2, court.x, -0.16, court.z, undefined, 3.2);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(court.hx * 2 - 0.4, court.hz * 2 - 0.4),
      mats.arch.floor,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(court.x, 0.07, court.z);
    floor.receiveShadow = true;
    group.add(floor);
    grounds.push(floor);

    const inlay = new THREE.Mesh(
      new THREE.TorusGeometry(Math.min(court.hx, court.hz) * 0.55, 0.045, 8, 64),
      mats.arch.trim,
    );
    inlay.rotation.x = Math.PI / 2;
    inlay.position.set(court.x, 0.06, court.z);
    group.add(inlay);

    addColonnade(court, mats, push, colliders);
    addArches(court, mats, putBox, colliders);
  }

  linkWalk(17, 0, 49, 0, mats, putBox, colliders, grounds, group);
  linkWalk(-17, 0, -49, 0, mats, putBox, colliders, grounds, group);
  linkWalk(0, -17, 0, -49, mats, putBox, colliders, grounds, group);
  linkWalk(0, 17, 0, 49, mats, putBox, colliders, grounds, group);

  addPool(mats, group, colliders, spins);
  addNookPergola(mats, putBox, colliders);
  addMercyWall(mats, putBox, colliders);
  addObservatoryRing(mats, group, spins);
  addTrees(mats, group, colliders);
  addRocks(mats, group, colliders);
  addPedestal(mats, putBox, colliders, DRESSING.bust.x, DRESSING.bust.z, DRESSING.bust.top);
  addPedestal(mats, putBox, colliders, DRESSING.cat.x, DRESSING.cat.z, DRESSING.cat.top);
  addLanternPosts(mats, group);

  for (const [mat, geos] of buckets) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged) continue;
    if (geos.length > 1) for (const g of geos) g.dispose();
    merged.computeVertexNormals();
    try { merged.computeTangents(); } catch { /* normal maps still read */ }
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  const lanterns = addLights();
  for (const light of lanterns) group.add(light);

  return { group, colliders, grounds, lanterns, spins };
}

function compose(x: number, y: number, z: number, rot?: [number, number, number]): THREE.Matrix4 {
  const q = new THREE.Quaternion();
  if (rot) q.setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], "XYZ"));
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
}

function scaleUvs(geo: THREE.BufferGeometry, scale: number): void {
  const uv = geo.getAttribute("uv");
  if (!uv) return;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * scale, uv.getY(i) * scale);
}

function addColonnade(
  court: Court,
  mats: MaterialLibrary,
  push: (mat: THREE.Material, geo: THREE.BufferGeometry) => void,
  colliders: ColliderSpec[],
): void {
  const edges: Array<{ side: "n" | "s" | "e" | "w"; x0: number; z0: number; x1: number; z1: number }> = [
    { side: "n", x0: court.x - court.hx + 1.2, z0: court.z - court.hz + 1.3, x1: court.x + court.hx - 1.2, z1: court.z - court.hz + 1.3 },
    { side: "s", x0: court.x - court.hx + 1.2, z0: court.z + court.hz - 1.3, x1: court.x + court.hx - 1.2, z1: court.z + court.hz - 1.3 },
    { side: "w", x0: court.x - court.hx + 1.3, z0: court.z - court.hz + 1.2, x1: court.x - court.hx + 1.3, z1: court.z + court.hz - 1.2 },
    { side: "e", x0: court.x + court.hx - 1.3, z0: court.z - court.hz + 1.2, x1: court.x + court.hx - 1.3, z1: court.z + court.hz - 1.2 },
  ];
  for (const edge of edges) {
    const len = Math.hypot(edge.x1 - edge.x0, edge.z1 - edge.z0);
    const n = Math.max(2, Math.round(len / 3.55));
    const open = court.openings.includes(edge.side);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (open && Math.abs(t - 0.5) < 0.18) continue;
      const x = edge.x0 + (edge.x1 - edge.x0) * t;
      const z = edge.z0 + (edge.z1 - edge.z0) * t;
      column(x, z, 5.4, 0.38, mats, push, colliders);
    }
  }
}

function column(
  x: number, z: number, h: number, r: number,
  mats: MaterialLibrary,
  push: (mat: THREE.Material, geo: THREE.BufferGeometry) => void,
  colliders: ColliderSpec[],
): void {
  const shaft = new THREE.CylinderGeometry(r * 0.92, r, h, 12);
  scaleUvs(shaft, h / 2.2);
  shaft.applyMatrix4(compose(x, h / 2 + 0.15, z));
  push(mats.arch.column, shaft);
  const base = new THREE.CylinderGeometry(r * 1.35, r * 1.5, 0.28, 10);
  base.applyMatrix4(compose(x, 0.14, z));
  push(mats.arch.column, base);
  const cap = new THREE.BoxGeometry(r * 2.5, 0.22, r * 2.5);
  cap.applyMatrix4(compose(x, h + 0.28, z));
  push(mats.arch.trim, cap);
  colliders.push({ kind: "cyl", x, y: h / 2 + 0.15, z, halfH: h / 2, r: r * 1.05 });
}

function addArches(
  court: Court,
  mats: MaterialLibrary,
  putBox: (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, rot?: [number, number, number], tile?: number) => void,
  colliders: ColliderSpec[],
): void {
  const spots: Record<"n" | "s" | "e" | "w", [number, number, number]> = {
    n: [court.x, court.z - court.hz + 1.3, 0],
    s: [court.x, court.z + court.hz - 1.3, 0],
    w: [court.x - court.hx + 1.3, court.z, 1],
    e: [court.x + court.hx - 1.3, court.z, 1],
  };
  for (const side of court.openings) {
    const [x, z, alongX] = spots[side];
    const y = 5.85;
    if (alongX) {
      putBox(mats.arch.wall, 0.7, 0.48, 7.4, x, y, z);
      putBox(mats.arch.trim, 0.28, 0.1, 7.1, x, y - 0.32, z);
      colliders.push({ kind: "box", x, y, z, hx: 0.35, hy: 0.24, hz: 3.7 });
    } else {
      putBox(mats.arch.wall, 7.4, 0.48, 0.7, x, y, z);
      putBox(mats.arch.trim, 7.1, 0.1, 0.28, x, y - 0.32, z);
      colliders.push({ kind: "box", x, y, z, hx: 3.7, hy: 0.24, hz: 0.35 });
    }
  }
}

function linkWalk(
  x0: number, z0: number, x1: number, z1: number,
  mats: MaterialLibrary,
  putBox: (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number) => void,
  colliders: ColliderSpec[],
  grounds: THREE.Object3D[],
  group: THREE.Group,
): void {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const mx = (x0 + x1) / 2;
  const mz = (z0 + z1) / 2;
  const alongX = Math.abs(dx) > Math.abs(dz);
  const width = 7.2;
  if (alongX) putBox(mats.arch.floor, len, 0.22, width, mx, -0.07, mz);
  else putBox(mats.arch.floor, width, 0.22, len, mx, -0.07, mz);

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(alongX ? len : width, alongX ? width : len), mats.arch.floor);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(mx, 0.06, mz);
  plane.receiveShadow = true;
  group.add(plane);
  grounds.push(plane);

  const railY = 0.38;
  const railH = 0.62;
  if (alongX) {
    for (const s of [-1, 1]) {
      putBox(mats.arch.wall, len, railH, 0.16, mx, railY, mz + s * (width / 2));
      colliders.push({ kind: "box", x: mx, y: railY, z: mz + s * (width / 2), hx: len / 2, hy: railH / 2, hz: 0.1 });
    }
  } else {
    for (const s of [-1, 1]) {
      putBox(mats.arch.wall, 0.16, railH, len, mx + s * (width / 2), railY, mz);
      colliders.push({ kind: "box", x: mx + s * (width / 2), y: railY, z: mz, hx: 0.1, hy: railH / 2, hz: len / 2 });
    }
  }
}

function addPool(
  mats: MaterialLibrary,
  group: THREE.Group,
  colliders: ColliderSpec[],
  spins: THREE.Object3D[],
): void {
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.65, 0.55, 32), mats.arch.wall);
  rim.position.set(0, 0.28, -2.2);
  rim.castShadow = true;
  rim.receiveShadow = true;
  group.add(rim);
  colliders.push({ kind: "cyl", x: 0, y: 0.28, z: -2.2, halfH: 0.28, r: 3.55 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(3.15, 40), mats.arch.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.52, -2.2);
  group.add(water);
  const mote = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), mats.clone("amber"));
  mote.position.set(0.8, 0.9, -2.2);
  mote.userData.circle = { cx: 0, cz: -2.2, r: 1.15, y: 0.9, speed: 0.55, phase: 0.4 };
  group.add(mote);
  spins.push(mote);
}

function addNookPergola(
  mats: MaterialLibrary,
  putBox: (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number) => void,
  colliders: ColliderSpec[],
): void {
  for (const x of [-6, 6]) {
    for (const z of [-70, -58]) {
      putBox(mats.arch.wood, 0.28, 3.6, 0.28, x, 1.8, z);
      colliders.push({ kind: "box", x, y: 1.8, z, hx: 0.16, hy: 1.8, hz: 0.16 });
    }
  }
  for (let i = 0; i < 5; i++) {
    putBox(mats.arch.wood, 12.4, 0.16, 0.22, 0, 3.7, -70 + i * 3);
  }
  putBox(mats.arch.wood, 0.2, 0.18, 12.2, -6, 3.55, -64);
  putBox(mats.arch.wood, 0.2, 0.18, 12.2, 6, 3.55, -64);
}

function addMercyWall(
  mats: MaterialLibrary,
  putBox: (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number) => void,
  colliders: ColliderSpec[],
): void {
  putBox(mats.arch.wall, 16, 4.4, 0.6, 0, 2.2, 78.4);
  colliders.push({ kind: "box", x: 0, y: 2.2, z: 78.4, hx: 8, hy: 2.2, hz: 0.35 });
  putBox(mats.arch.trim, 16.4, 0.16, 0.7, 0, 4.5, 78.4);
}

function addObservatoryRing(mats: MaterialLibrary, group: THREE.Group, spins: THREE.Object3D[]): void {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.08, 10, 80), mats.templates.chrome);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(-64, 7.4, 0);
  ring.userData.spin = 0.12;
  group.add(ring);
  spins.push(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.045, 8, 64), mats.templates.mint);
  ring2.rotation.x = Math.PI / 2.15;
  ring2.position.set(-64, 7.1, 0);
  ring2.userData.spin = -0.2;
  group.add(ring2);
  spins.push(ring2);
}

function addTrees(mats: MaterialLibrary, group: THREE.Group, colliders: ColliderSpec[]): void {
  const positions: Array<[number, number, number]> = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const r = 34 + (i % 3) * 7;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (blocked(x, z)) continue;
    positions.push([x, z, 0.85 + (i % 4) * 0.15]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.22, 1.8, 7);
  const crownGeo = new THREE.IcosahedronGeometry(1.15, 1);
  const trunks = new THREE.InstancedMesh(trunkGeo, mats.arch.bark, positions.length);
  const crowns = new THREE.InstancedMesh(crownGeo, mats.arch.foliage, positions.length);
  const dummy = new THREE.Object3D();
  positions.forEach(([x, z, s], i) => {
    dummy.position.set(x, 0.9, z);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 2.15 * s, z);
    dummy.scale.setScalar(1.15 * s);
    dummy.rotation.y = i;
    dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix);
    crowns.setColorAt(i, new THREE.Color().setHSL(0.28 + (i % 5) * 0.02, 0.35, 0.22 + (i % 3) * 0.03));
    colliders.push({ kind: "cyl", x, y: 0.9, z, halfH: 0.8, r: 0.28 });
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  crowns.receiveShadow = true;
  group.add(trunks, crowns);
}

function addRocks(mats: MaterialLibrary, group: THREE.Group, colliders: ColliderSpec[]): void {
  const geo = new THREE.DodecahedronGeometry(0.7, 0);
  const mesh = new THREE.InstancedMesh(geo, mats.arch.garden, 10);
  const dummy = new THREE.Object3D();
  const spots: Array<[number, number]> = [
    [24, 22], [-22, 24], [22, -20], [-24, -22],
    [40, 18], [-38, 16], [16, 40], [-18, -42],
    [70, 20], [-70, -18],
  ];
  spots.forEach(([x, z], i) => {
    dummy.position.set(x, 0.35, z);
    dummy.rotation.set(i, i * 0.7, i * 0.2);
    dummy.scale.set(1.2 + (i % 3) * 0.3, 0.7, 1 + (i % 2) * 0.4);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    colliders.push({ kind: "box", x, y: 0.35, z, hx: 0.7, hy: 0.35, hz: 0.6 });
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function addPedestal(
  mats: MaterialLibrary,
  putBox: (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number) => void,
  colliders: ColliderSpec[],
  x: number, z: number, top: number,
): void {
  putBox(mats.arch.column, 0.9, top, 0.9, x, top / 2, z);
  putBox(mats.arch.trim, 1.05, 0.08, 1.05, x, top + 0.04, z);
  colliders.push({ kind: "box", x, y: top / 2, z, hx: 0.48, hy: top / 2, hz: 0.48 });
}

function addLanternPosts(mats: MaterialLibrary, group: THREE.Group): void {
  const spots: Array<[number, number]> = [];
  for (let x = 22; x <= 44; x += 11) spots.push([x, 4.2], [x, -4.2], [-x, 4.2], [-x, -4.2]);
  for (let z = 22; z <= 44; z += 11) spots.push([4.2, z], [-4.2, z], [4.2, -z], [-4.2, -z]);
  const pole = new THREE.CylinderGeometry(0.05, 0.07, 2.4, 6);
  const globe = new THREE.SphereGeometry(0.14, 12, 10);
  const poles = new THREE.InstancedMesh(pole, mats.arch.bark, spots.length);
  const globes = new THREE.InstancedMesh(globe, mats.arch.lantern, spots.length);
  const dummy = new THREE.Object3D();
  spots.forEach(([x, z], i) => {
    dummy.position.set(x, 1.2, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 2.5, z);
    dummy.updateMatrix();
    globes.setMatrixAt(i, dummy.matrix);
  });
  group.add(poles, globes);
}

function addLights(): THREE.PointLight[] {
  const specs: Array<[number, number, number, string, number, number]> = [
    [0, 4.2, -9, "#ffb066", 8, 16],
    [0, 1.4, -2.2, "#ffc58a", 4, 10],
    [64, 3.6, -2, "#ffd089", 7, 18],
    [-64, 4.2, -1, "#9ff3d4", 5, 16],
    [0, 3.2, -66, "#ffb070", 8, 18],
    [7.2, 2.4, -74, "#ffc48a", 5, 10],
    [0, 3.4, 54, "#b8fff0", 4, 12],
    [8.6, 3.2, 72, "#e4b56a", 5, 12],
  ];
  return specs.map(([x, y, z, color, intensity, distance]) => {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(x, y, z);
    light.userData.base = intensity;
    return light;
  });
}

function blocked(x: number, z: number): boolean {
  const courts = [
    { x: 0, z: 0, h: 20 },
    { x: 64, z: 0, h: 18 },
    { x: -64, z: 0, h: 18 },
    { x: 0, z: 64, h: 18 },
    { x: 0, z: -64, h: 18 },
  ];
  for (const c of courts) {
    if (Math.abs(x - c.x) < c.h && Math.abs(z - c.z) < c.h) return true;
  }
  const onEast = Math.abs(z) < 6 && x > 14 && x < 54;
  const onWest = Math.abs(z) < 6 && x < -14 && x > -54;
  const onNorth = Math.abs(x) < 6 && z < -14 && z > -54;
  const onSouth = Math.abs(x) < 6 && z > 14 && z < 54;
  return onEast || onWest || onNorth || onSouth;
}
