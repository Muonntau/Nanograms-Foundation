import * as THREE from "three";

interface Mote {
  alive: boolean;
  life: number;
  max: number;
  vx: number;
  vy: number;
  vz: number;
  drag: number;
  grav: number;
  size: number;
}

interface Ring {
  mesh: THREE.Mesh;
  life: number;
  max: number;
  radius: number;
}

export class Vfx {
  readonly points: THREE.Points;
  private motes: Mote[] = [];
  private positions: Float32Array;
  private colors: Float32Array;
  private rings: Ring[] = [];
  private lights: THREE.PointLight[] = [];
  private lightLife: number[] = [];
  private ringGeo: THREE.RingGeometry;
  readonly group = new THREE.Group();
  sparks = true;

  constructor(scene: THREE.Scene) {
    const count = 700;
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.motes.push({
        alive: false,
        life: 0,
        max: 1,
        vx: 0,
        vy: 0,
        vz: 0,
        drag: 1,
        grav: 0,
        size: 1,
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.16,
      map: sprite(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 48);
    this.ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(
        this.ringGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffb15a,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({ mesh, life: 0, max: 1, radius: 1 });
    }
    for (let i = 0; i < 5; i++) {
      const light = new THREE.PointLight("#ffb15a", 0, 9, 2);
      light.visible = false;
      scene.add(light);
      this.lights.push(light);
      this.lightLife.push(0);
    }
    scene.add(this.group);
  }

  burst(
    pos: THREE.Vector3,
    color: THREE.ColorRepresentation,
    count: number,
    speed: number,
    grav = -4,
  ): void {
    if (!this.sparks) count = Math.min(count, 8);
    const c = new THREE.Color(color);
    let left = count;
    for (let i = 0; i < this.motes.length && left > 0; i++) {
      const m = this.motes[i];
      if (m.alive) continue;
      m.alive = true;
      m.max = 0.35 + Math.random() * 0.55;
      m.life = m.max;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const sp = speed * (0.4 + Math.random() * 0.9);
      m.vx = Math.sin(phi) * Math.cos(theta) * sp;
      m.vy = Math.abs(Math.cos(phi)) * sp * 0.85 + speed * 0.15;
      m.vz = Math.sin(phi) * Math.sin(theta) * sp;
      m.drag = 0.92 + Math.random() * 0.06;
      m.grav = grav;
      m.size = 1;
      this.positions[i * 3] = pos.x;
      this.positions[i * 3 + 1] = pos.y;
      this.positions[i * 3 + 2] = pos.z;
      this.colors[i * 3] = c.r;
      this.colors[i * 3 + 1] = c.g;
      this.colors[i * 3 + 2] = c.b;
      left--;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  shockwave(pos: THREE.Vector3, color: THREE.ColorRepresentation, radius: number): void {
    const ring = this.rings.find((r) => r.life <= 0);
    if (!ring) return;
    ring.life = 0.7;
    ring.max = 0.7;
    ring.radius = radius;
    ring.mesh.visible = true;
    ring.mesh.position.set(pos.x, pos.y + 0.08, pos.z);
    ring.mesh.scale.setScalar(0.4);
    (ring.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    (ring.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
  }

  flash(pos: THREE.Vector3, color: THREE.ColorRepresentation, intensity: number): void {
    let idx = this.lightLife.findIndex((l) => l <= 0);
    if (idx < 0) idx = 0;
    const light = this.lights[idx];
    light.visible = true;
    light.color.set(color);
    light.intensity = intensity;
    light.position.copy(pos);
    this.lightLife[idx] = 0.18;
  }

  update(dt: number): void {
    let dirty = false;
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      if (!m.alive) continue;
      m.life -= dt;
      if (m.life <= 0) {
        m.alive = false;
        this.positions[i * 3 + 1] = -100;
        dirty = true;
        continue;
      }
      m.vx *= m.drag;
      m.vy = m.vy * m.drag + m.grav * dt;
      m.vz *= m.drag;
      this.positions[i * 3] += m.vx * dt;
      this.positions[i * 3 + 1] += m.vy * dt;
      this.positions[i * 3 + 2] += m.vz * dt;
      const fade = m.life / m.max;
      this.colors[i * 3] *= 0.92 + 0.08 * fade;
      dirty = true;
    }
    if (dirty) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
    for (const ring of this.rings) {
      if (ring.life <= 0) continue;
      ring.life -= dt;
      const u = 1 - ring.life / ring.max;
      const s = 0.4 + u * ring.radius;
      ring.mesh.scale.setScalar(Math.max(0.1, s));
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - u) * 0.8);
      if (ring.life <= 0) ring.mesh.visible = false;
    }
    for (let i = 0; i < this.lights.length; i++) {
      if (this.lightLife[i] <= 0) continue;
      this.lightLife[i] -= dt;
      this.lights[i].intensity = Math.max(0, this.lightLife[i] / 0.18) * 14;
      if (this.lightLife[i] <= 0) this.lights[i].visible = false;
    }
  }
}

function sprite(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.4, "rgba(255,220,180,0.8)");
  grd.addColorStop(1, "rgba(255,180,80,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
