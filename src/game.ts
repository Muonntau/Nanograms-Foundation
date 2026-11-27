import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MaterialLibrary, densityOf, soundFamily } from "./materials";
import { AudioBus } from "./audio";
import { Vfx } from "./vfx";
import { articleFor, type Article } from "./content";
import { SCULPTURES, WINGS, type PieceSpec, type SculptureDef, type WingInfo } from "./sculptures";
import { DRESSING, buildWorld, type BuiltWorld } from "./world";
import { campusProps, type PropSpec } from "./props";
import { publicUrl } from "./public-url";

type Quality = "high" | "balanced" | "swift";
type PowerId = 1 | 2 | 3 | 4 | 5;

interface Piece {
  spec: PieceSpec;
  sculptureId: string;
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  home: { x: number; y: number; z: number; qx: number; qy: number; qz: number; qw: number };
  baseColor: THREE.Color;
  baseEmissive: THREE.Color;
  baseEm: number;
  heat: number;
  hot: boolean;
  dynamic: boolean;
  family: "glass" | "metal" | "stone" | "wood";
  nextClack: number;
}

interface LiveWork {
  def: SculptureDef;
  intact: boolean;
  hoops: THREE.Object3D[];
}

interface Field {
  kind: "sing" | "invert";
  x: number;
  y: number;
  z: number;
  age: number;
  boomed: boolean;
  dropped: boolean;
  group: THREE.Group;
  light: THREE.PointLight;
  affected: Array<{ body: RAPIER.RigidBody; gravity: number }>;
}

interface LiveProp {
  spec: PropSpec;
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  pivot: RAPIER.RigidBody | null;
  joint: RAPIER.ImpulseJoint | null;
  light: THREE.PointLight | null;
  fragile: boolean;
  core: boolean;
  shard: boolean;
  alive: boolean;
  spent: boolean;
  removed: boolean;
  fuse: number;
  family: "glass" | "metal" | "stone" | "wood";
  gravityScale: number;
  nextClack: number;
}

interface Missile {
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  kind: "meteor" | "orb";
  exploded: boolean;
  life: number;
  removed: boolean;
}

interface Actor {
  body: RAPIER.RigidBody;
  piece?: Piece;
  prop?: LiveProp;
}

const POWERS: Record<PowerId, { name: string; line: string; cd: number }> = {
  1: { name: "Kinetic Force Blast", line: "A directional shock. The room is asked to move.", cd: 0.42 },
  2: { name: "Singularity", line: "A gravity well. Orbit, then the fling.", cd: 3.1 },
  3: { name: "Differentiality Inversion", line: "z = 1/E. Nearby mass forgets which way is down.", cd: 2.8 },
  4: { name: "Fracture Beam", line: "The form was a suggestion. Shards remember otherwise.", cd: 0.28 },
  5: { name: "Orbital Slam", line: "A meteor with the campus’s full attention.", cd: 2.4 },
};

const LOOK = { exposure: 0.58, sun: 4.4, env: 1.05, hemi: 0.95, fog: 0.0018 };

export class Game {
  readonly sculptureCount = SCULPTURES.length;
  private readonly canvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private sun!: THREE.DirectionalLight;
  private world!: RAPIER.World;
  private queue!: RAPIER.EventQueue;
  private controller!: RAPIER.KinematicCharacterController;
  private playerBody!: RAPIER.RigidBody;
  private playerCollider!: RAPIER.Collider;
  private mats!: MaterialLibrary;
  private audio = new AudioBus();
  private vfx!: Vfx;
  private built!: BuiltWorld;
  private pieces: Piece[] = [];
  private byHandle = new Map<number, Piece>();
  private works: LiveWork[] = [];
  private aimables: THREE.Object3D[] = [];
  private fields: Field[] = [];
  private raycaster = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = -0.12;
  private vy = 0;
  private grounded = false;
  private coyote = 0;
  private mode: "cine" | "play" = "cine";
  private quality: Quality = "balanced";
  private power: PowerId = 1;
  private cd: Record<PowerId, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  private fireEdge = false;
  private solarDown = false;
  private rightDown = false;
  private pointer = { x: 0, y: 0, dx: 0, dy: 0, moved: false };
  private stroll: THREE.Vector3 | null = null;
  private marker!: THREE.Mesh;
  private beam!: THREE.Mesh;
  private trauma = 0;
  private foot = 0;
  private reduceMotion = false;
  private fpsSmoothed = 60;
  private fpsAcc = 0;
  private time = 0;
  private travelLock = false;
  private aimed: string | null = null;
  private passThrough = new Set<number>();
  private props: LiveProp[] = [];
  private propByHandle = new Map<number, LiveProp>();
  private missiles: Missile[] = [];
  private missileByHandle = new Map<number, Missile>();
  private afterStep: Array<() => void> = [];
  private physAcc = 0;
  private velX = 0;
  private velZ = 0;
  private stuck = 0;
  private jumpQueued = 0;
  private timeScale = 1;
  private lowG = false;
  private slow = false;
  private kicks = 0;
  private destroyed = 0;
  private clickArmed = false;
  private beamHold = 0;
  private shardCount = 0;
  private physSteps = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  async load(progress: (text: string) => void): Promise<void> {
    progress("Warming the stone");
    const previousWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      const text = args.map(String).join(" ");
      if (text.includes("deprecated parameters for the initialization function")) return;
      previousWarn.apply(console, args);
    };
    await RAPIER.init();
    console.warn = previousWarn;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    if (!this.renderer.getContext()) throw new Error("WebGL is unavailable in this browser.");
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = LOOK.exposure;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x8a6248, LOOK.fog);
    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.08, 420);
    this.camera.rotation.order = "YXZ";

    this.mats = await MaterialLibrary.load();
    this.mats.setAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));

    progress("Setting the amber light");
    const hdr = await new RGBELoader().loadAsync(publicUrl("assets/hdri/qwantani_sunset_puresky_2k.hdr"));
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    this.scene.background = hdr;
    this.scene.backgroundIntensity = 0.34;
    this.scene.backgroundRotation = new THREE.Euler(0, Math.PI, 0);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromEquirectangular(hdr).texture;
    this.scene.environmentIntensity = LOOK.env;
    this.scene.environmentRotation = new THREE.Euler(0, Math.PI, 0);
    pmrem.dispose();

    this.sun = new THREE.DirectionalLight("#ffc48a", LOOK.sun);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 80;
    this.sun.shadow.camera.left = -24;
    this.sun.shadow.camera.right = 24;
    this.sun.shadow.camera.top = 24;
    this.sun.shadow.camera.bottom = -24;
    this.sun.shadow.bias = -0.00018;
    this.sun.shadow.normalBias = 0.04;
    this.sun.position.set(22, 28, 8);
    this.sun.target.position.set(0, 2, -6);
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(new THREE.HemisphereLight("#ffe0c2", "#3a4030", LOOK.hemi));
    const fill = new THREE.DirectionalLight("#ffd2a8", 1.15);
    fill.position.set(-16, 10, 12);
    this.scene.add(fill);

    this.world = new RAPIER.World({ x: 0, y: -12, z: 0 });
    this.world.timestep = 1 / 60;
    this.world.integrationParameters.numSolverIterations = 6;
    this.queue = new RAPIER.EventQueue(true);

    progress("Raising the colonnade");
    this.built = buildWorld(this.mats);
    this.scene.add(this.built.group);
    for (const col of this.built.colliders) {
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(col.x, col.y, col.z));
      const desc = col.kind === "box"
        ? RAPIER.ColliderDesc.cuboid(col.hx, col.hy, col.hz)
        : RAPIER.ColliderDesc.cylinder(col.halfH, col.r);
      this.world.createCollider(desc.setFriction(0.85).setRestitution(0.02), body);
    }

    progress("Setting the sculptures on their plinths");
    this.spawnSculptures();
    await this.loadDressing();

    this.vfx = new Vfx(this.scene);
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.48, 28),
      new THREE.MeshBasicMaterial({ color: "#e4b56a", transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.scene.add(this.marker);
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.06, 1, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: "#ffd2a0",
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.beam.visible = false;
    this.beam.frustumCulled = false;
    this.scene.add(this.beam);

    const player = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(0, 2.35, 12.4)
        .setCanSleep(false)
        .lockRotations()
        .setCcdEnabled(true),
    );
    this.playerCollider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.5, 0.28).setFriction(0.02).setRestitution(0),
      player,
    );
    this.playerBody = player;
    this.playerBody.setEnabled(true);
    this.controller = this.world.createCharacterController(0.01);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    this.controller.enableAutostep(0.48, 0.22, false);
    this.controller.enableSnapToGround(0.5);
    this.controller.setMaxSlopeClimbAngle(Math.PI * 0.3);
    this.controller.setMinSlopeSlideAngle(Math.PI * 0.36);
    this.controller.setSlideEnabled(true);
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.controller.setCharacterMass(85);
    this.rebuildProps();

    const renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.38, 0.42, 0.86);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    progress("Listening for the terrace wind");
    await this.audio.load();
    this.bindUi();
    this.applyQuality(this.quality);
    window.addEventListener("resize", () => this.resize());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private spawnSculptures(): void {
    for (const def of SCULPTURES) {
      const live: LiveWork = { def, intact: true, hoops: [] };
      for (const spec of def.pieces) {
        const piece = this.makePiece(def, spec);
        this.pieces.push(piece);
        this.byHandle.set(piece.collider.handle, piece);
        this.aimables.push(piece.mesh);
      }
      if (def.hoops) {
        const anchor = new THREE.Group();
        anchor.position.set(def.origin[0], def.origin[1], def.origin[2]);
        for (const hoop of def.hoops) {
          const mesh = new THREE.Mesh(
            new THREE.TorusGeometry(hoop.radius, hoop.tube, 10, 40),
            this.mats.clone(hoop.mat),
          );
          mesh.position.set(hoop.pos[0], hoop.pos[1], hoop.pos[2]);
          mesh.rotation.set(hoop.rot[0], hoop.rot[1], hoop.rot[2]);
          mesh.userData.spin = hoop.spin;
          anchor.add(mesh);
        }
        this.scene.add(anchor);
        live.hoops.push(anchor);
      }
      this.addPlaque(def.id, def.origin[0] + def.plaqueAt[0], def.origin[2] + def.plaqueAt[2], def.plaqueYaw);
      this.works.push(live);
    }
    this.addPlaque("bust", DRESSING.bust.x + 0.9, DRESSING.bust.z + 0.2, 0.4);
    this.addPlaque("guardian", DRESSING.cat.x + 0.9, DRESSING.cat.z + 0.4, 0.2);
  }

  private makePiece(def: SculptureDef, spec: PieceSpec): Piece {
    const geo = geometryFor(spec);
    const mat = this.mats.clone(spec.mat);
    const mesh = new THREE.Mesh(geo, mat);
    const maxDim = Math.max(...spec.size);
    mesh.castShadow = maxDim > 0.22;
    mesh.receiveShadow = true;
    mesh.userData.read = def.id;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(spec.rot?.[0] ?? 0, spec.rot?.[1] ?? 0, spec.rot?.[2] ?? 0, "XYZ"));
    let x = def.origin[0] + spec.pos[0];
    const y = def.origin[1] + spec.pos[1];
    let z = def.origin[2] + spec.pos[2];
    if (spec.orbit) {
      x += Math.cos(spec.orbit.phase) * spec.orbit.r;
      z += Math.sin(spec.orbit.phase) * spec.orbit.r;
    }
    const bodyDesc = (spec.orbit ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.fixed())
      .setTranslation(x, y, z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setLinearDamping(0.14)
      .setAngularDamping(0.45)
      .setCanSleep(true);
    const body = this.world.createRigidBody(bodyDesc);
    const collider = this.world.createCollider(colliderFor(spec), body);
    mesh.position.set(x, y, z);
    mesh.quaternion.copy(q);
    this.scene.add(mesh);
    if (maxDim < 0.34) body.enableCcd(true);
    return {
      spec, sculptureId: def.id, mesh, mat, body, collider,
      home: { x, y, z, qx: q.x, qy: q.y, qz: q.z, qw: q.w },
      baseColor: mat.color.clone(),
      baseEmissive: mat.emissive.clone(),
      baseEm: mat.emissiveIntensity,
      heat: 0, hot: false, dynamic: false,
      family: soundFamily(spec.mat),
      nextClack: 0,
    };
  }

  private addPlaque(id: string, x: number, z: number, yaw: number): void {
    const article = articleFor(id);
    if (!article) return;
    const group = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, 0.16), this.mats.arch.column);
    post.position.y = -0.5;
    post.castShadow = true;
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.7, 0.07), this.mats.arch.wall);
    stone.castShadow = true;
    const tex = plaqueTexture(article);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 0.56),
      new THREE.MeshStandardMaterial({
        map: tex,
        emissive: "#fff6ea",
        emissiveMap: tex,
        emissiveIntensity: 0.4,
        roughness: 0.72,
      }),
    );
    face.position.z = 0.042;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), this.mats.clone("mint"));
    gem.position.y = 0.48;
    gem.userData.bob = id.length;
    face.userData.read = id;
    face.userData.plaque = true;
    stone.userData.read = id;
    stone.userData.plaque = true;
    group.add(post, stone, face, gem);
    group.position.set(x, 1.2, z);
    group.rotation.y = yaw;
    this.scene.add(group);
    this.aimables.push(face, stone);
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0.6, z));
    const plaqueCollider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.6, 0.12), body);
    this.passThrough.add(plaqueCollider.handle);
  }

  private async loadDressing(): Promise<void> {
    const loader = new GLTFLoader();
    await this.placeModel(loader, publicUrl("assets/models/marble_bust/marble_bust_01.gltf"), DRESSING.bust, 1.75, "bust");
    await this.placeModel(loader, publicUrl("assets/models/concrete_cat/concrete_cat_statue.gltf"), DRESSING.cat, 2.15, "guardian");
  }

  private async placeModel(
    loader: GLTFLoader,
    url: string,
    anchor: { x: number; z: number; top: number; yaw: number },
    scale: number,
    id: string,
  ): Promise<void> {
    try {
      const gltf = await loader.loadAsync(url);
      const root = gltf.scene;
      root.scale.setScalar(scale);
      root.rotation.y = anchor.yaw;
      root.position.set(anchor.x, 0, anchor.z);
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      root.position.y += anchor.top - box.min.y;
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.read = id;
        this.aimables.push(mesh);
      });
      this.scene.add(root);
      root.updateMatrixWorld(true);
      const sized = new THREE.Box3().setFromObject(root);
      const size = sized.getSize(new THREE.Vector3());
      const center = sized.getCenter(new THREE.Vector3());
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(size.x * 0.28, size.y * 0.45, size.z * 0.28).setFriction(0.8),
        body,
      );
    } catch (err) {
      console.error(err);
    }
  }

  private bindUi(): void {
    const $ = <T extends HTMLElement>(id: string) => {
      const node = document.getElementById(id);
      if (!node) throw new Error(`Missing #${id}`);
      return node as T;
    };
    $("intro-count").textContent = String(this.sculptureCount);
    $("btn-enter").addEventListener("click", () => {
      void this.audio.resume();
      this.beginPlay(true);
    });
    $("btn-stroll").addEventListener("click", () => {
      void this.audio.resume();
      this.beginPlay(false);
    });
    document.querySelectorAll<HTMLButtonElement>("[data-wing]").forEach((btn) => {
      btn.addEventListener("click", () => {
        void this.audio.resume();
        const wing = WINGS.find((w) => w.id === btn.dataset.wing);
        if (!wing) return;
        if (this.mode === "cine") this.beginPlay(false);
        this.travel(wing);
      });
    });
    $("nav-archive").addEventListener("click", () => {
      void this.audio.resume();
      this.openCredits();
    });
    document.querySelectorAll<HTMLButtonElement>("[data-power]").forEach((btn) => {
      btn.addEventListener("click", () => {
        void this.audio.resume();
        this.setPower(Number(btn.dataset.power) as PowerId);
      });
    });
    const cast = $("btn-cast");
    cast.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      void this.audio.resume();
      this.fireEdge = true;
      this.solarDown = true;
    });
    const castUp = () => { this.solarDown = false; };
    cast.addEventListener("pointerup", castUp);
    cast.addEventListener("pointerleave", castUp);
    $("btn-restore").addEventListener("click", () => this.restoreAimed());
    $("btn-restore-all").addEventListener("click", () => this.restoreAll());
    $("btn-look").addEventListener("click", () => this.toggleLook());
    $("btn-help").addEventListener("click", () => this.togglePanel("help"));
    $("help-close").addEventListener("click", () => this.closePanels());
    $("reader-close").addEventListener("click", () => this.closePanels());
    $("credits-close").addEventListener("click", () => this.closePanels());
    $("btn-sound").addEventListener("click", () => {
      this.audio.setMuted(!this.audio.muted);
      $("btn-sound").textContent = this.audio.muted ? "Muted" : "Sound";
      $("btn-sound").setAttribute("aria-pressed", String(this.audio.muted));
    });
    $("volume").addEventListener("input", (e) => {
      const v = Number((e.target as HTMLInputElement).value);
      this.audio.setVolume(v);
      if (this.audio.muted) {
        this.audio.setMuted(false);
        $("btn-sound").textContent = "Sound";
      }
    });
    $("btn-quality").addEventListener("click", () => {
      const order: Quality[] = ["high", "balanced", "swift"];
      this.applyQuality(order[(order.indexOf(this.quality) + 1) % order.length]);
    });
    document.querySelectorAll<HTMLButtonElement>("[data-k]").forEach((btn) => {
      const code = btn.dataset.k ?? "";
      const down = (e: Event) => { e.preventDefault(); this.keys.add(code); };
      const up = () => this.keys.delete(code);
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointerleave", up);
    });
    const touchCast = document.getElementById("touch-cast");
    touchCast?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.fireEdge = true;
      this.solarDown = true;
    });
    touchCast?.addEventListener("pointerup", castUp);
    document.getElementById("touch-read")?.addEventListener("click", () => this.readAimed());
    document.getElementById("touch-look")?.addEventListener("click", () => this.toggleLook());

    window.addEventListener("keydown", (e) => this.onKey(e, true), true);
    window.addEventListener("keyup", (e) => this.onKey(e, false), true);
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.canvas.addEventListener("pointerup", (e) => this.onPointerUp(e));
    window.addEventListener("pointerup", () => { this.rightDown = false; });
    window.addEventListener("pointermove", (e) => this.onPointerMove(e));
    document.addEventListener("pointerlockchange", () => {
      const locked = document.pointerLockElement === this.canvas;
      $("btn-look").textContent = locked ? "Release" : "Look";
      $("crosshair").classList.toggle("show", locked && this.mode === "play");
    });
    void this.fillCredits();
    this.setPower(1);
  }

  private eventCode(e: KeyboardEvent): string {
    if (e.code && e.code !== "Unidentified") return e.code;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const map: Record<string, string> = {
      w: "KeyW", a: "KeyA", s: "KeyS", d: "KeyD",
      q: "KeyQ", e: "KeyE", f: "KeyF", g: "KeyG", t: "KeyT", r: "KeyR",
      c: "KeyC", m: "KeyM", x: "KeyX",
      " ": "Space",
      arrowup: "ArrowUp", arrowdown: "ArrowDown", arrowleft: "ArrowLeft", arrowright: "ArrowRight",
      shift: "ShiftLeft", escape: "Escape", enter: "Enter",
      "1": "Digit1", "2": "Digit2", "3": "Digit3", "4": "Digit4", "5": "Digit5",
    };
    return map[key] ?? map[e.key] ?? e.key;
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    if (this.mode === "play" && tag === "BUTTON") target?.blur();
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const code = this.eventCode(e);
    if (this.mode === "play" && (code === "Space" || code.startsWith("Arrow"))) e.preventDefault();
    if (down) this.keys.add(code);
    else this.keys.delete(code);
    if (!down) {
      if (code === "KeyF") this.solarDown = false;
      return;
    }
    if (this.mode === "cine" && (code === "Enter" || code === "Space")) {
      e.preventDefault();
      void this.audio.resume();
      this.beginPlay(false);
      return;
    }
    if (code === "Escape") {
      this.closePanels();
      if (document.pointerLockElement) document.exitPointerLock();
      return;
    }
    if (readerOpen() || helpOpen() || creditsOpen()) return;
    if (code >= "Digit1" && code <= "Digit5" && !e.repeat) this.setPower(Number(code.slice(5)) as PowerId);
    if (code === "KeyX" && !e.repeat) this.readAimed();
    if (code === "KeyR" && !e.repeat) {
      if (e.shiftKey || e.getModifierState("Shift")) this.restoreAll();
      else this.restoreAimed();
    }
    if (code === "KeyC" && !e.repeat) this.toggleLook();
    if (code === "KeyM" && !e.repeat) {
      this.audio.setMuted(!this.audio.muted);
      const btn = document.getElementById("btn-sound");
      if (btn) btn.textContent = this.audio.muted ? "Muted" : "Sound";
    }
    if (code === "KeyF" && !e.repeat && this.mode === "play") this.launchOrb();
    if (code === "KeyG" && !e.repeat && this.mode === "play") this.toggleLowG();
    if (code === "KeyT" && !e.repeat && this.mode === "play") this.toggleSlow();
    if (code === "Space" && !e.repeat && this.mode === "play") this.jumpQueued = 0.18;
  }

  private onPointerDown(e: PointerEvent): void {
    void this.audio.resume();
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    this.pointer.moved = false;
    if (e.button === 2) {
      this.rightDown = true;
      return;
    }
    if (e.button !== 0 || this.mode !== "play") return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== this.canvas) active.blur();
    if (document.pointerLockElement === this.canvas) {
      this.fireEdge = true;
      this.solarDown = true;
    } else {
      this.clickArmed = true;
    }
  }

  private onPointerMove(e: PointerEvent): void {
    const dx = e.clientX - this.pointer.x;
    const dy = e.clientY - this.pointer.y;
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    if (Math.hypot(dx, dy) > 2) this.pointer.moved = true;
    const locked = document.pointerLockElement === this.canvas;
    const dragging = this.rightDown || (e.buttons & 1) === 1 || (e.buttons & 2) === 2;
    if (locked) {
      this.yaw -= e.movementX * 0.00215;
      this.pitch -= e.movementY * 0.0019;
    } else if (dragging && this.mode === "play") {
      this.yaw -= dx * 0.0046;
      this.pitch -= dy * 0.004;
    }
    this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch));
  }

  private beginPlay(lock: boolean): void {
    this.mode = "play";
    document.getElementById("intro")?.classList.add("hide");
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    this.canvas.focus({ preventScroll: true });
    const wing = WINGS[0];
    this.yaw = wing.yaw;
    this.pitch = -0.08;
    this.velX = 0;
    this.velZ = 0;
    this.vy = 0;
    this.stuck = 0;
    this.jumpQueued = 0;
    this.placePlayer(wing.x, wing.z);
    document.getElementById("crosshair")?.classList.add("show");
    if (lock) {
      const req = this.canvas.requestPointerLock();
      void Promise.resolve(req).catch(() => undefined);
    }
  }

  private toggleLook(): void {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    else this.canvas.requestPointerLock();
  }

  private travel(wing: WingInfo): void {
    if (this.travelLock) return;
    this.travelLock = true;
    const fade = document.getElementById("fade");
    fade?.classList.add("on");
    window.setTimeout(() => {
      this.yaw = wing.yaw;
      this.pitch = -0.06;
      this.vy = 0;
      this.stroll = null;
      this.marker.visible = false;
      this.velX = 0;
      this.velZ = 0;
      this.placePlayer(wing.x, wing.z);
      this.audio.whoosh();
      fade?.classList.remove("on");
      this.travelLock = false;
    }, 280);
  }

  private setPower(id: PowerId): void {
    if (this.power !== id) this.audio.switchPower();
    this.power = id;
    const info = POWERS[id];
    const name = document.getElementById("power-name");
    const line = document.getElementById("power-line");
    if (name) name.textContent = info.name;
    if (line) line.textContent = info.line;
    document.querySelectorAll<HTMLButtonElement>("[data-power]").forEach((btn) => {
      btn.classList.toggle("on", Number(btn.dataset.power) === id);
    });
    this.audio.setBeam(false);
  }

  private frame(): void {
    const dt = Math.min(0.25, this.clock.getDelta());
    const sim = dt * this.timeScale;
    this.time += sim;
    this.fpsSmoothed = this.fpsSmoothed * 0.92 + (1 / Math.max(dt, 0.001)) * 0.08;
    this.fpsAcc += dt;
    if (this.fpsAcc > 0.3) {
      this.fpsAcc = 0;
      const fps = document.getElementById("fps");
      if (fps) fps.textContent = `${Math.round(this.fpsSmoothed)} fps`;
      this.paintSandbox();
    }
    if (this.mode === "cine") {
      const t = this.time * (this.reduceMotion ? 0.015 : 0.06);
      this.camera.position.set(7 + Math.sin(t) * 3, 3.6, 17.5);
      this.camera.lookAt(-0.5, 2.6, -8);
      this.sun.position.set(12, 18, 24);
      this.sun.target.position.set(0, 2, -8);
      this.sun.target.updateMatrixWorld();
    } else {
      this.stepPlayerLook(dt);
    }
    this.stepPhysics(sim);
    this.flushAfterStep();
    this.syncMeshes();
    this.updateFuses(sim);
    this.flushAfterStep();
    this.updateFields(sim);
    this.updateAim();
    this.updatePowers(sim);
    this.vfx.update(sim);
    this.audio.update(dt);
    this.decor(sim);
    this.paintProbe();
    if (this.mode === "play") this.placeCamera();
    for (const id of [1, 2, 3, 4, 5] as PowerId[]) this.cd[id] = Math.max(0, this.cd[id] - dt);
    this.paintCooldowns();
    if (this.quality === "swift") this.renderer.render(this.scene, this.camera);
    else this.composer.render();
  }

  private stepPlayerLook(dt: number): void {
    const turn = 1.85 * dt;
    if (this.keys.has("KeyQ")) this.yaw += turn;
    if (this.keys.has("KeyE")) this.yaw -= turn;
    this.pitch = Math.max(-1.2, Math.min(1.15, this.pitch));
  }

  private stepPhysics(dt: number): void {
    this.physAcc += dt;
    const step = 1 / 60;
    let n = 0;
    while (this.physAcc >= step && n < 15) {
      if (this.mode === "play") this.movePlayer(step);
      this.orbitPieces(step);
      this.world.timestep = step;
      this.world.step(this.queue);
      this.drainContacts();
      this.physAcc -= step;
      this.physSteps++;
      n++;
    }
    if (n === 15) this.physAcc = 0;
  }

  private placePlayer(x: number, z: number): void {
    const y = 2.35;
    this.playerBody.setEnabled(true);
    this.playerBody.wakeUp();
    this.playerBody.setTranslation({ x, y, z }, true);
    this.playerBody.setNextKinematicTranslation({ x, y, z });
    this.playerBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.vy = 0;
    this.grounded = false;
    this.stuck = 0;
  }

  private movePlayer(dt: number): void {
    const p = this.playerBody.translation();
    if (p.y < 0.35) this.placePlayer(p.x, p.z);
    let forward = 0;
    let strafe = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) forward += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) forward -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) strafe += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) strafe -= 1;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    let wx = fx * forward + rx * strafe;
    let wz = fz * forward + rz * strafe;
    const mag = Math.hypot(wx, wz);
    if (mag > 0) { wx /= mag; wz /= mag; }
    const typing = forward !== 0 || strafe !== 0;
    const here = this.playerBody.translation();
    if (!typing && this.stroll) {
      const dx = this.stroll.x - here.x;
      const dz = this.stroll.z - here.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.55) {
        this.stroll = null;
        this.marker.visible = false;
      } else {
        wx = dx / d;
        wz = dz / d;
      }
    }
    const moving = typing || this.stroll !== null;
    const sprint = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const max = (sprint ? 11.4 : 6.5) * (moving ? 1 : 0);
    const rate = (moving ? 16 : 22) * dt;
    const blend = 1 - Math.exp(-rate);
    this.velX += (wx * max - this.velX) * blend;
    this.velZ += (wz * max - this.velZ) * blend;
    if (!moving && Math.hypot(this.velX, this.velZ) < 0.05) {
      this.velX = 0;
      this.velZ = 0;
    }
    const gravity = this.lowG ? 3.6 : 21;
    if (this.grounded && this.vy <= 0) this.vy = 0;
    else this.vy -= gravity * dt;
    this.vy = Math.max(-28, this.vy);
    if (this.grounded) this.coyote = 0.14;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (this.jumpQueued > 0) {
      this.jumpQueued -= dt;
      if (this.grounded || this.coyote > 0) {
        this.vy = this.lowG ? 5.6 : 7.7;
        this.grounded = false;
        this.coyote = 0;
        this.jumpQueued = 0;
      }
    }
    this.controller.computeColliderMovement(this.playerCollider, {
      x: this.velX * dt,
      y: this.vy * dt,
      z: this.velZ * dt,
    });
    const m = this.controller.computedMovement();
    const next = { x: here.x + m.x, y: here.y + m.y, z: here.z + m.z };
    const horiz = Math.hypot(m.x, m.z);
    if (moving && horiz < 0.0015) {
      this.stuck += 1;
      if (this.stuck === 8 || this.stuck === 16) {
        next.y += 0.42;
        this.vy = Math.max(this.vy, 2.2);
      }
    } else if (horiz > 0.004) this.stuck = 0;
    this.playerBody.setNextKinematicTranslation(next);
    this.grounded = this.controller.computedGrounded();
    const speed = horiz / dt;
    if (this.grounded && speed > 0.8) {
      this.foot -= dt;
      if (this.foot <= 0) {
        this.foot = sprint ? 0.28 : 0.46;
        this.audio.footstep(sprint);
      }
    }
  }

  private orbitPieces(timeStep: number): void {
    for (const piece of this.pieces) {
      const orbit = piece.spec.orbit;
      if (!orbit || piece.dynamic) continue;
      const work = this.works.find((w) => w.def.id === piece.sculptureId);
      if (!work) continue;
      const a = this.time * orbit.speed + orbit.phase;
      const x = work.def.origin[0] + piece.spec.pos[0] + Math.cos(a) * orbit.r;
      const y = work.def.origin[1] + piece.spec.pos[1];
      const z = work.def.origin[2] + piece.spec.pos[2] + Math.sin(a) * orbit.r;
      piece.body.setNextKinematicTranslation({ x, y, z });
      void timeStep;
    }
  }

  private drainContacts(): void {
    let budget = 6;
    this.queue.drainContactForceEvents((event) => {
      const force = event.totalForceMagnitude();
      const missile = this.missileByHandle.get(event.collider1()) ?? this.missileByHandle.get(event.collider2());
      if (missile && !missile.exploded && force > (missile.kind === "meteor" ? 35 : 28)) {
        this.afterStep.push(() => this.explodeMissile(missile));
      }
      const prop = this.propByHandle.get(event.collider1()) ?? this.propByHandle.get(event.collider2());
      if (prop && prop.alive && force > 80) {
        const vel = prop.body.linvel();
        const speed = Math.hypot(vel.x, vel.y, vel.z);
        if (prop.core && !prop.spent && speed > 4 && force > 140) this.armCore(prop, 0.05);
        else if (prop.fragile && !prop.shard && speed > 6.5 && force > 280) this.shatterProp(prop);
        else if (budget > 0 && speed > 1.2 && this.time >= prop.nextClack) {
          prop.nextClack = this.time + 0.14;
          this.audio.shatter(prop.family, 0.4);
          budget--;
        }
      }
      const piece = this.byHandle.get(event.collider1()) ?? this.byHandle.get(event.collider2());
      if (piece && budget > 0 && this.time >= piece.nextClack && force > 40) {
        piece.nextClack = this.time + 0.16;
        this.audio.shatter(piece.family, 0.45);
        budget--;
      }
    });
    this.queue.drainCollisionEvents(() => undefined);
  }

  private syncBody(mesh: THREE.Object3D, body: RAPIER.RigidBody, cap: number): void {
    const t = body.translation();
    const r = body.rotation();
    mesh.position.set(t.x, t.y, t.z);
    mesh.quaternion.set(r.x, r.y, r.z, r.w);
    const v = body.linvel();
    const sp = Math.hypot(v.x, v.y, v.z);
    if (sp > cap) {
      const k = cap / sp;
      body.setLinvel({ x: v.x * k, y: v.y * k, z: v.z * k }, true);
    }
  }

  private syncMeshes(): void {
    for (const piece of this.pieces) {
      if (!piece.dynamic && !piece.spec.orbit) continue;
      this.syncBody(piece.mesh, piece.body, 32);
    }
    for (const prop of this.props) {
      if (!prop.alive || prop.removed) continue;
      this.syncBody(prop.mesh, prop.body, 36);
    }
    for (const missile of this.missiles) {
      if (missile.removed) continue;
      this.syncBody(missile.mesh, missile.body, 48);
    }
  }

  private updateAim(): void {
    if (this.mode !== "play") return;
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hits = this.raycaster.intersectObjects(this.aimables, false);
    const hit = hits.find((h) => h.distance < 7.5 && h.object.userData.read);
    this.aimed = hit ? String(hit.object.userData.read) : this.nearestAhead();
    const prompt = document.getElementById("prompt");
    if (!prompt) return;
    if (this.aimed && !readerOpen()) {
      const article = articleFor(this.aimed);
      prompt.textContent = article ? `X  ·  ${article.title}` : "X  ·  Read";
      prompt.classList.add("show");
    } else prompt.classList.remove("show");
  }

  private updatePowers(dt: number): void {
    if (readerOpen() || helpOpen() || creditsOpen()) {
      this.solarDown = false;
      this.fireEdge = false;
      this.audio.setBeam(false);
      this.beam.visible = false;
      return;
    }
    const armed = this.fireEdge && this.mode === "play" && this.cd[this.power] <= 0;
    if (armed) {
      this.fireEdge = false;
      this.cast(this.power);
      this.cd[this.power] = POWERS[this.power].cd;
    } else this.fireEdge = false;
    if (this.power === 4 && this.solarDown && this.mode === "play") {
      this.beamHold += dt;
      this.audio.setBeam(true);
      if (this.beamHold > 0.16) {
        this.beamHold = 0;
        this.fracture();
      }
    } else {
      this.audio.setBeam(false);
      this.beamHold = 0;
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.button === 2) this.rightDown = false;
    if (e.button !== 0 || this.mode !== "play") return;
    const locked = document.pointerLockElement === this.canvas;
    if (locked && !this.clickArmed) {
      this.solarDown = false;
      return;
    }
    if (!this.clickArmed) return;
    this.clickArmed = false;
    this.solarDown = false;
    if (this.pointer.moved) return;
    const plaque = this.plaqueUnder(e);
    if (plaque) {
      this.openReader(plaque);
      return;
    }
    this.fireEdge = true;
    const req = this.canvas.requestPointerLock();
    void Promise.resolve(req).catch(() => undefined);
  }

  private plaqueUnder(e: PointerEvent): string | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const reads = this.raycaster.intersectObjects(this.aimables, false);
    const read = reads.find((hit) => hit.distance < 9 && hit.object.userData.plaque);
    return read ? String(read.object.userData.read) : null;
  }

  private cast(power: PowerId): void {
    if (power === 1) this.blast();
    else if (power === 2) this.singularity();
    else if (power === 3) this.differentiality();
    else if (power === 4) this.fracture();
    else this.launchMeteor();
  }

  private forward(): THREE.Vector3 {
    const v = new THREE.Vector3(0, 0, -1);
    v.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));
    return v.normalize();
  }

  private rayHit(max = 40): { point: THREE.Vector3; piece: Piece | null; prop: LiveProp | null } | null {
    const dir = this.forward();
    const origin = this.camera.position.clone().addScaledVector(dir, 0.35);
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRay(
      ray, max, true, undefined, undefined, undefined, this.playerBody,
      (collider) => !this.passThrough.has(collider.handle),
    );
    if (!hit) return null;
    const point = origin.clone().addScaledVector(dir, hit.timeOfImpact);
    const prop = this.propByHandle.get(hit.collider.handle) ?? null;
    return { point, piece: this.byHandle.get(hit.collider.handle) ?? null, prop: prop && prop.alive ? prop : null };
  }

  private blast(): void {
    const dir = this.forward();
    const hit = this.rayHit(16);
    const focus = hit ? hit.point : this.camera.position.clone().addScaledVector(dir, 6.5);
    this.radialBlast(focus.x, focus.y, focus.z, 6.8, 14, 7, dir, false);
    this.showBeam(this.camera.position.clone().addScaledVector(dir, 0.35), focus.clone().addScaledVector(dir, 1.2), "#fff1d2", 0.16);
    this.vfx.shockwave(new THREE.Vector3(focus.x, 0.3, focus.z), "#ffb15a", 6.4);
    this.vfx.burst(focus, "#ffe1a8", 26, 7);
    this.vfx.flash(focus, "#ffd2a0", 14);
    this.audio.boom();
    this.trauma = Math.max(this.trauma, this.reduceMotion ? 0.1 : 0.42);
  }

  private singularity(): void {
    const aim = this.aimPoint(6, 14);
    const group = new THREE.Group();
    group.position.copy(aim);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.7 + i * 0.5, 0.04, 8, 32),
        new THREE.MeshBasicMaterial({
          color: i === 1 ? "#2a2418" : "#e4b56a",
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      ring.rotation.x = i * 0.6;
      group.add(ring);
    }
    const light = new THREE.PointLight("#e4b56a", 8, 16, 2);
    group.add(light);
    this.scene.add(group);
    this.fields.push({
      kind: "sing", x: aim.x, y: aim.y, z: aim.z, age: 0, boomed: false, dropped: false,
      group, light, affected: [],
    });
    this.audio.setHum(1);
    this.trauma = Math.max(this.trauma, 0.22);
  }

  private differentiality(): void {
    const aim = this.aimPoint(4, 12);
    const group = new THREE.Group();
    group.position.copy(aim);
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.4, 1),
      new THREE.MeshBasicMaterial({
        color: "#9ff3d4",
        wireframe: true,
        transparent: true,
        opacity: 0.5,
        toneMapped: false,
      }),
    );
    group.add(shell);
    const light = new THREE.PointLight("#9ff3d4", 6, 14, 2);
    group.add(light);
    this.scene.add(group);
    const affected: Field["affected"] = [];
    this.eachActorNear(aim.x, aim.y, aim.z, 6.4, (actor) => {
      if (actor.prop?.core && !actor.prop.spent) {
        this.armCore(actor.prop, 0.2);
        return;
      }
      if (actor.piece) this.wake(actor.piece);
      affected.push({ body: actor.body, gravity: actor.body.gravityScale() });
      actor.body.setGravityScale(-1.15, true);
      const v = actor.body.linvel();
      actor.body.setLinvel({ x: v.x * 0.35, y: Math.max(v.y, 2.4), z: v.z * 0.35 }, true);
      this.kicks++;
    });
    this.fields.push({
      kind: "invert", x: aim.x, y: aim.y, z: aim.z, age: 0, boomed: false, dropped: false,
      group, light, affected,
    });
    this.audio.toneLift();
    this.trauma = Math.max(this.trauma, 0.2);
  }

  private fracture(): void {
    const dir = this.forward();
    const start = this.camera.position.clone().addScaledVector(dir, 0.4);
    const hit = this.rayHit(32);
    const end = hit ? hit.point : start.clone().addScaledVector(dir, 14);
    this.showBeam(start, end, "#fff6ea", 0.08, true);
    if (hit?.piece) {
      const t = hit.piece.body.translation();
      this.fractureSculpture(hit.piece.sculptureId, new THREE.Vector3(t.x, t.y, t.z));
      this.vfx.burst(end, "#f6f0e4", 18, 5);
    } else if (hit?.prop) {
      if (hit.prop.core) this.armCore(hit.prop, 0.02);
      else if (hit.prop.fragile && !hit.prop.shard) this.shatterProp(hit.prop);
      else this.shove(hit.prop.body, dir.x * 14, 5, dir.z * 14, undefined, hit.prop);
      this.radialBlast(end.x, end.y, end.z, 2.6, 8, 3.5, dir, true);
    } else {
      this.radialBlast(end.x, end.y, end.z, 2.4, 7, 3, dir, true);
    }
    this.audio.shatter("stone", 0.8);
    this.trauma = Math.max(this.trauma, 0.18);
  }

  private fractureSculpture(id: string, origin: THREE.Vector3): void {
    for (const piece of this.pieces) {
      if (piece.sculptureId !== id) continue;
      const t = piece.body.translation();
      const dx = t.x - origin.x;
      const dy = t.y - origin.y;
      const dz = t.z - origin.z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      this.shove(
        piece.body,
        (dx / dist) * 8 + (Math.random() - 0.5) * 2,
        3.5 + Math.random() * 3,
        (dz / dist) * 8 + (Math.random() - 0.5) * 2,
        piece,
      );
    }
  }

  private launchMeteor(): void {
    const aim = this.aimPoint(4, 12);
    const dir = this.forward();
    const start = new THREE.Vector3(aim.x - dir.x * 1.5, Math.max(8, aim.y + 15), aim.z - dir.z * 1.5);
    const velocity = new THREE.Vector3(aim.x - start.x, aim.y - start.y, aim.z - start.z);
    const len = velocity.length() || 1;
    velocity.multiplyScalar(28 / len);
    this.spawnMissile(start, velocity, 0.74, 80, "meteor", "obsidian");
    this.audio.whoosh();
    this.trauma = Math.max(this.trauma, 0.15);
  }

  private launchOrb(): void {
    const dir = this.forward();
    const start = this.camera.position.clone().addScaledVector(dir, 1.15);
    this.spawnMissile(start, dir.multiplyScalar(23), 0.44, 60, "orb", "gold");
    this.audio.whoosh();
  }

  private spawnMissile(
    start: THREE.Vector3,
    velocity: THREE.Vector3,
    radius: number,
    density: number,
    kind: Missile["kind"],
    mat: "obsidian" | "gold",
  ): void {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 14), this.mats.clone(mat));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(start.x, start.y, start.z)
        .setLinvel(velocity.x, velocity.y, velocity.z)
        .setCanSleep(false)
        .setCcdEnabled(true)
        .setLinearDamping(0.04)
        .setAngularDamping(0.08),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(radius).setDensity(density).setFriction(0.45).setRestitution(0.2),
      body,
    );
    collider.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
    collider.setContactForceEventThreshold(kind === "meteor" ? 30 : 22);
    const missile: Missile = { mesh, body, collider, kind, exploded: false, life: 0, removed: false };
    this.missiles.push(missile);
    this.missileByHandle.set(collider.handle, missile);
    this.scene.add(mesh);
  }

  private explodeMissile(missile: Missile): void {
    if (missile.exploded || missile.removed) return;
    missile.exploded = true;
    const t = missile.body.translation();
    if (missile.kind === "meteor") {
      this.radialBlast(t.x, t.y, t.z, 12.5, 18, 11, null, true);
      this.vfx.shockwave(new THREE.Vector3(t.x, 0.35, t.z), "#ffb15a", 12);
      this.vfx.burst(new THREE.Vector3(t.x, t.y, t.z), "#ffd7a0", 36, 9);
      this.vfx.flash(new THREE.Vector3(t.x, t.y + 0.4, t.z), "#ffb066", 22);
      this.audio.boom();
      this.trauma = Math.max(this.trauma, this.reduceMotion ? 0.2 : 0.95);
      this.destroyed++;
    } else {
      this.radialBlast(t.x, t.y, t.z, 3.4, 9, 4, null, false);
      this.vfx.burst(new THREE.Vector3(t.x, t.y, t.z), "#e4b56a", 14, 5);
      this.audio.shatter("metal", 0.7);
      this.trauma = Math.max(this.trauma, 0.28);
    }
  }

  private updateFields(dt: number): void {
    for (let i = this.fields.length - 1; i >= 0; i--) {
      const field = this.fields[i];
      field.age += dt;
      field.group.rotation.y += dt * (field.kind === "sing" ? 2.6 : 0.7);
      field.group.rotation.x += dt * 0.7;
      if (field.kind === "sing") {
        const pull = field.age < 2.15;
        this.eachActorNear(field.x, field.y, field.z, 7.6, (actor) => {
          if (actor.prop?.core && !actor.prop.spent && field.age > 0.15) {
            this.armCore(actor.prop, 0.08);
            return;
          }
          const t = actor.body.translation();
          const dx = field.x - t.x;
          const dy = field.y + 0.4 - t.y;
          const dz = field.z - t.z;
          const dist = Math.hypot(dx, dy, dz) || 0.001;
          if (actor.piece) this.wake(actor.piece);
          actor.body.wakeUp();
          if (pull) {
            const v = actor.body.linvel();
            const s = (1 - dist / 7.6) * 11;
            const tx = -dz / dist;
            const tz = dx / dist;
            actor.body.setLinvel({
              x: v.x * 0.82 + (dx / dist) * s + tx * 4.2,
              y: v.y * 0.82 + (dy / dist) * s * 0.85 + 1.6,
              z: v.z * 0.82 + (dz / dist) * s + tz * 4.2,
            }, true);
            this.kicks++;
          }
        });
        if (!pull && !field.boomed) {
          field.boomed = true;
          this.radialBlast(field.x, field.y, field.z, 8, 13, 6, null, false);
          this.vfx.shockwave(new THREE.Vector3(field.x, field.y, field.z), "#e4b56a", 7.5);
          this.vfx.burst(new THREE.Vector3(field.x, field.y, field.z), "#ffd7a0", 28, 8);
          this.audio.boom();
          this.trauma = Math.max(this.trauma, 0.55);
          this.audio.setHum(0);
        }
        if (field.age > 2.7) {
          this.scene.remove(field.group);
          this.fields.splice(i, 1);
          this.audio.setHum(0);
        }
      } else if (!field.dropped && field.age > 1.65) {
        field.dropped = true;
        for (const entry of field.affected) {
          entry.body.setGravityScale(2.7, true);
          const v = entry.body.linvel();
          entry.body.setLinvel({ x: v.x, y: Math.min(v.y, 0) - 4, z: v.z }, true);
        }
        this.audio.boom();
        this.trauma = Math.max(this.trauma, 0.4);
      } else if (field.age > 2.55) {
        for (const entry of field.affected) entry.body.setGravityScale(entry.gravity, true);
        this.scene.remove(field.group);
        this.fields.splice(i, 1);
      }
    }
  }

  private eachActorNear(x: number, y: number, z: number, radius: number, fn: (actor: Actor) => void): number {
    const r2 = radius * radius;
    let n = 0;
    const take = (px: number, py: number, pz: number) => {
      const dx = px - x;
      const dy = py - y;
      const dz = pz - z;
      return dx * dx + dy * dy + dz * dz <= r2;
    };
    for (const piece of this.pieces) {
      const t = piece.body.translation();
      if (!take(t.x, t.y, t.z)) continue;
      fn({ body: piece.body, piece });
      n++;
    }
    for (const prop of this.props) {
      if (!prop.alive || prop.removed) continue;
      const t = prop.body.translation();
      if (!take(t.x, t.y, t.z)) continue;
      fn({ body: prop.body, prop });
      n++;
    }
    for (const missile of this.missiles) {
      if (missile.removed) continue;
      const t = missile.body.translation();
      if (!take(t.x, t.y, t.z)) continue;
      fn({ body: missile.body });
      n++;
    }
    return n;
  }

  private radialBlast(
    x: number, y: number, z: number,
    radius: number, speed: number, lift: number,
    dir: THREE.Vector3 | null,
    shatterFragile: boolean,
  ): number {
    let n = 0;
    this.eachActorNear(x, y, z, radius, (actor) => {
      const t = actor.body.translation();
      const dx = t.x - x;
      const dy = t.y - y;
      const dz = t.z - z;
      const dist = Math.hypot(dx, dy, dz) || 0.001;
      const fall = Math.max(0, 1 - dist / radius);
      if (actor.prop?.core && !actor.prop.spent) {
        this.armCore(actor.prop, 0.04 + (1 - fall) * 0.18);
        n++;
        return;
      }
      if (shatterFragile && actor.prop?.fragile && !actor.prop.shard) {
        this.shatterProp(actor.prop);
        n++;
        return;
      }
      const nx = dx / dist;
      const nz = dz / dist;
      const bias = dir ? 0.75 : 0;
      this.shove(
        actor.body,
        (nx * speed + (dir ? dir.x * speed * bias : 0)) * (0.4 + fall),
        lift * (0.45 + fall) + Math.max(0, dy / dist) * 2,
        (nz * speed + (dir ? dir.z * speed * bias : 0)) * (0.4 + fall),
        actor.piece,
        actor.prop,
      );
      n++;
    });
    return n;
  }

  private shove(
    body: RAPIER.RigidBody,
    vx: number, vy: number, vz: number,
    piece?: Piece,
    prop?: LiveProp,
  ): void {
    if (piece) this.wake(piece);
    if (prop) {
      if (!prop.alive || prop.removed) return;
      if (prop.core && !prop.spent) {
        this.armCore(prop, 0.03);
        return;
      }
      prop.body.wakeUp();
      if (prop.gravityScale < 0.25) prop.body.setGravityScale(0.4, true);
    }
    body.wakeUp();
    const mass = body.mass();
    const heft = mass > 90 ? 0.4 : mass > 40 ? 0.68 : 1;
    const v = body.linvel();
    body.setLinvel({
      x: v.x * 0.35 + vx * heft,
      y: v.y * 0.35 + vy * heft,
      z: v.z * 0.35 + vz * heft,
    }, true);
    body.applyTorqueImpulse({
      x: (Math.random() - 0.5) * 4.5,
      y: (Math.random() - 0.5) * 4.5,
      z: (Math.random() - 0.5) * 4.5,
    }, true);
    this.kicks++;
  }

  private aimPoint(minDist: number, fallback: number): THREE.Vector3 {
    const hit = this.rayHit(32);
    const dir = this.forward();
    if (hit && hit.point.distanceTo(this.camera.position) > minDist) {
      return hit.point.clone().setY(Math.max(1.1, hit.point.y));
    }
    const p = this.camera.position.clone().addScaledVector(dir, fallback);
    p.y = Math.max(1.2, p.y);
    return p;
  }

  private wake(piece: Piece): void {
    if (piece.dynamic) return;
    piece.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    piece.dynamic = true;
    piece.collider.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
    piece.collider.setContactForceEventThreshold(45);
    const work = this.works.find((w) => w.def.id === piece.sculptureId);
    if (work && work.intact) {
      work.intact = false;
      this.destroyed++;
      for (const hoop of work.hoops) hoop.visible = false;
    }
  }

  private showBeam(start: THREE.Vector3, end: THREE.Vector3, color: string, radius: number, persist = false): void {
    const dir = end.clone().sub(start);
    const len = Math.max(0.2, dir.length());
    dir.multiplyScalar(1 / len);
    this.beam.visible = true;
    this.beam.position.copy(start).addScaledVector(dir, len / 2);
    this.beam.scale.set(radius / 0.05, len, radius / 0.05);
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    (this.beam.material as THREE.MeshBasicMaterial).color.set(color);
    if (!persist) window.setTimeout(() => { if (!this.solarDown) this.beam.visible = false; }, 80);
  }

  private restoreAimed(): void {
    const id = this.aimed ?? this.nearestDamaged();
    if (id && id !== "bust" && id !== "guardian") this.restoreIds([id]);
    this.rebuildProps();
    this.toast(id && id !== "bust" && id !== "guardian" ? "Restored, and the props are set again." : "The props are set again.");
  }

  private restoreAll(): void {
    this.restoreIds(this.works.map((w) => w.def.id));
    this.rebuildProps();
    this.clearFields();
    this.destroyed = 0;
    this.kicks = 0;
    this.toast("The campus is whole again.");
  }

  private nearestAhead(): string | null {
    const p = this.playerBody.translation();
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    let best: string | null = null;
    let bestD = 8.5;
    for (const work of this.works) {
      const dx = work.def.origin[0] - p.x;
      const dz = work.def.origin[2] - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.4 || d > bestD) continue;
      if ((dx * fx + dz * fz) / d < 0.2) continue;
      bestD = d;
      best = work.def.id;
    }
    return best;
  }

  private nearestDamaged(): string | null {
    const p = this.playerBody.translation();
    let best: string | null = null;
    let dist = 18;
    for (const work of this.works) {
      if (work.intact) continue;
      const dx = work.def.origin[0] - p.x;
      const dz = work.def.origin[2] - p.z;
      const d = Math.hypot(dx, dz);
      if (d < dist) { dist = d; best = work.def.id; }
    }
    return best;
  }

  private restoreIds(ids: string[]): void {
    const set = new Set(ids);
    for (const piece of this.pieces) {
      if (!set.has(piece.sculptureId)) continue;
      const orbit = Boolean(piece.spec.orbit);
      piece.body.setBodyType(orbit ? RAPIER.RigidBodyType.KinematicPositionBased : RAPIER.RigidBodyType.Fixed, true);
      piece.body.setTranslation({ x: piece.home.x, y: piece.home.y, z: piece.home.z }, true);
      piece.body.setRotation({ x: piece.home.qx, y: piece.home.qy, z: piece.home.qz, w: piece.home.qw }, true);
      piece.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      piece.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      piece.body.setGravityScale(1, true);
      piece.dynamic = false;
      piece.heat = 0;
      piece.hot = false;
      piece.mat.color.copy(piece.baseColor);
      piece.mat.emissive.copy(piece.baseEmissive);
      piece.mat.emissiveIntensity = piece.baseEm;
      piece.mesh.position.set(piece.home.x, piece.home.y, piece.home.z);
      piece.mesh.quaternion.set(piece.home.qx, piece.home.qy, piece.home.qz, piece.home.qw);
    }
    for (const work of this.works) {
      if (!set.has(work.def.id)) continue;
      work.intact = true;
      for (const hoop of work.hoops) hoop.visible = true;
    }
    this.audio.restore();
  }

  private readAimed(): void {
    if (this.aimed) this.openReader(this.aimed);
  }

  private openReader(id: string): void {
    const article = articleFor(id);
    if (!article) return;
    if (document.pointerLockElement) document.exitPointerLock();
    this.solarDown = false;
    fillArticle(article);
    document.getElementById("reader")?.classList.add("open");
    document.getElementById("help")?.classList.remove("open");
    document.getElementById("credits")?.classList.remove("open");
  }

  private openCredits(): void {
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById("credits")?.classList.add("open");
    document.getElementById("reader")?.classList.remove("open");
  }

  private togglePanel(id: string): void {
    const node = document.getElementById(id);
    if (!node) return;
    const open = node.classList.toggle("open");
    if (open && document.pointerLockElement) document.exitPointerLock();
  }

  private closePanels(): void {
    document.getElementById("reader")?.classList.remove("open");
    document.getElementById("help")?.classList.remove("open");
    document.getElementById("credits")?.classList.remove("open");
  }

  private async fillCredits(): Promise<void> {
    const host = document.getElementById("credits-body");
    if (!host) return;
    let items: Array<{ name: string; author: string; license: string; source: string; use: string }> = [];
    try {
      const res = await fetch(publicUrl("assets/credits.json"));
      items = await res.json();
    } catch {
      items = [];
    }
    host.replaceChildren();
    const note = document.createElement("p");
    note.textContent = "Textures, the sunset sky, and the two furnished scans are CC0 from Poly Haven. Impacts and footsteps are CC0 recordings by Kenney. Wind, hums, beams, and shockwave tones are synthesized in the browser. Type is Cormorant Garamond and Inter, used under the SIL Open Font License.";
    host.append(note);
    for (const item of items) {
      const block = document.createElement("article");
      const h = document.createElement("h3");
      h.textContent = item.name;
      const p = document.createElement("p");
      p.textContent = `${item.author}. ${item.license}. ${item.use}.`;
      const a = document.createElement("a");
      a.href = item.source;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = item.source.replace(/^https?:\/\//, "");
      block.append(h, p, a);
      host.append(block);
    }
  }

  private toast(text: string): void {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = text;
    node.classList.add("show");
    window.setTimeout(() => node.classList.remove("show"), 2200);
  }

  private rebuildProps(): void {
    this.clearDynamics();
    for (const spec of campusProps()) this.spawnProp(spec, false);
  }

  private clearDynamics(): void {
    for (const prop of this.props) {
      if (prop.joint) this.world.removeImpulseJoint(prop.joint, false);
      if (!prop.removed) this.world.removeRigidBody(prop.body);
      if (prop.pivot) this.world.removeRigidBody(prop.pivot);
      this.scene.remove(prop.mesh);
      prop.mesh.geometry.dispose();
      prop.removed = true;
      prop.alive = false;
    }
    for (const missile of this.missiles) {
      if (!missile.removed) this.world.removeRigidBody(missile.body);
      this.scene.remove(missile.mesh);
      missile.mesh.geometry.dispose();
      missile.removed = true;
    }
    this.props = [];
    this.propByHandle.clear();
    this.missiles = [];
    this.missileByHandle.clear();
    this.shardCount = 0;
    this.afterStep = [];
  }

  private clearFields(): void {
    for (const field of this.fields) this.scene.remove(field.group);
    this.fields = [];
    this.audio.setHum(0);
    this.audio.setBeam(false);
    this.beam.visible = false;
  }

  private spawnProp(spec: PropSpec, shard: boolean): LiveProp | null {
    const mesh = new THREE.Mesh(geometryFor(spec), this.mats.templates[spec.mat]);
    mesh.castShadow = false;
    mesh.receiveShadow = !shard;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(spec.rot?.[0] ?? 0, spec.rot?.[1] ?? 0, spec.rot?.[2] ?? 0, "XYZ"));
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spec.pos[0], spec.pos[1], spec.pos[2])
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setGravityScale(spec.gravityScale)
        .setLinearDamping(spec.damping)
        .setAngularDamping(spec.adamping)
        .setCanSleep(spec.canSleep)
        .setCcdEnabled(spec.ccd),
    );
    const collider = this.world.createCollider(
      colliderFor(spec).setDensity(spec.density).setFriction(spec.friction).setRestitution(spec.restitution),
      body,
    );
    collider.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
    collider.setContactForceEventThreshold(spec.fragile || spec.core ? 40 : 80);
    let pivot: RAPIER.RigidBody | null = null;
    let joint: RAPIER.ImpulseJoint | null = null;
    if (spec.pendulum) {
      const [px, py, pz] = spec.pendulum;
      pivot = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(px, py, pz));
      joint = this.world.createImpulseJoint(
        RAPIER.JointData.spherical(
          { x: 0, y: 0, z: 0 },
          { x: px - spec.pos[0], y: py - spec.pos[1], z: pz - spec.pos[2] },
        ),
        pivot,
        body,
        true,
      );
      body.setLinvel({ x: 1.6, y: 0, z: 0.45 }, true);
    }
    const light: THREE.PointLight | null = null;
    mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    mesh.quaternion.copy(q);
    this.scene.add(mesh);
    const prop: LiveProp = {
      spec, mesh, body, collider, pivot, joint, light,
      fragile: spec.fragile,
      core: spec.core,
      shard,
      alive: true,
      spent: false,
      removed: false,
      fuse: 0,
      family: soundFamily(spec.mat),
      gravityScale: spec.gravityScale,
      nextClack: 0,
    };
    this.props.push(prop);
    this.propByHandle.set(collider.handle, prop);
    if (shard) this.shardCount++;
    return prop;
  }

  private shatterProp(prop: LiveProp): void {
    if (!prop.alive || prop.removed || prop.shard) return;
    prop.alive = false;
    prop.spent = true;
    const t = prop.body.translation();
    const pos = new THREE.Vector3(t.x, t.y, t.z);
    const mat = prop.spec.mat;
    const family = prop.family;
    this.afterStep.push(() => {
      this.removeProp(prop);
      this.spawnShards(pos, mat);
      this.destroyed++;
      this.vfx.burst(pos, family === "wood" ? "#c4a574" : "#f4efe4", 14, 4.5);
      this.audio.shatter(family, 0.75);
    });
  }

  private spawnShards(pos: THREE.Vector3, mat: PropSpec["mat"]): void {
    const count = 5;
    if (this.shardCount > 140) return;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const spec: PropSpec = {
        shape: "box",
        mat,
        pos: [pos.x + Math.cos(ang) * 0.18, pos.y + 0.12 + (i % 2) * 0.08, pos.z + Math.sin(ang) * 0.18],
        size: [0.16 + (i % 3) * 0.04, 0.1, 0.14],
        rot: [i, ang, i * 0.4],
        density: 10,
        restitution: 0.2,
        friction: 0.5,
        fragile: false,
        core: false,
        gravityScale: 1,
        ccd: true,
        pendulum: null,
        damping: 0.15,
        adamping: 0.25,
        canSleep: true,
        tag: "shard",
        castShadow: false,
      };
      const prop = this.spawnProp(spec, true);
      prop?.body.setLinvel({
        x: Math.cos(ang) * (4 + i),
        y: 3 + Math.random() * 3,
        z: Math.sin(ang) * (4 + i),
      }, true);
    }
  }

  private removeProp(prop: LiveProp): void {
    if (prop.removed) return;
    prop.removed = true;
    prop.alive = false;
    this.propByHandle.delete(prop.collider.handle);
    if (prop.joint) this.world.removeImpulseJoint(prop.joint, true);
    prop.joint = null;
    this.world.removeRigidBody(prop.body);
    if (prop.pivot) this.world.removeRigidBody(prop.pivot);
    prop.pivot = null;
    this.scene.remove(prop.mesh);
    prop.mesh.geometry.dispose();
    if (prop.shard) this.shardCount = Math.max(0, this.shardCount - 1);
  }

  private armCore(prop: LiveProp, delay: number): void {
    if (!prop.core || prop.spent || !prop.alive) return;
    prop.spent = true;
    prop.fuse = Math.max(0.02, delay);
  }

  private updateFuses(dt: number): void {
    for (const prop of this.props) {
      if (!prop.alive || !prop.spent || prop.fuse <= 0) continue;
      prop.fuse -= dt;
      if (prop.fuse <= 0) {
        prop.fuse = 0;
        this.detonateCore(prop);
      }
    }
    for (const missile of this.missiles) {
      if (missile.removed || missile.exploded) continue;
      missile.life += dt;
      if (missile.kind === "meteor" && missile.life > 2.4) this.explodeMissile(missile);
    }
  }

  private detonateCore(prop: LiveProp): void {
    if (!prop.alive || prop.removed) return;
    const t = prop.body.translation();
    const pos = new THREE.Vector3(t.x, t.y, t.z);
    prop.alive = false;
    this.afterStep.push(() => {
      this.removeProp(prop);
      this.radialBlast(pos.x, pos.y, pos.z, 7.4, 15, 9, null, true);
      this.vfx.shockwave(new THREE.Vector3(pos.x, 0.4, pos.z), "#ffb15a", 7.2);
      this.vfx.burst(pos, "#ffd2a0", 30, 8);
      this.vfx.flash(pos, "#ffb066", 18);
      this.audio.boom();
      this.trauma = Math.max(this.trauma, this.reduceMotion ? 0.15 : 0.7);
      this.destroyed++;
      for (const other of this.props) {
        if (!other.alive || !other.core || other.spent) continue;
        const o = other.body.translation();
        if (Math.hypot(o.x - pos.x, o.y - pos.y, o.z - pos.z) < 7.6) this.armCore(other, 0.16);
      }
    });
  }

  private flushAfterStep(): void {
    if (this.afterStep.length === 0) return;
    const jobs = this.afterStep;
    this.afterStep = [];
    for (const job of jobs) job();
  }

  private toggleLowG(): void {
    this.lowG = !this.lowG;
    this.world.gravity = { x: 0, y: this.lowG ? -1.9 : -12.5, z: 0 };
    this.paintSandbox();
    this.toast(this.lowG ? "Lunar gravity. The campus exhales." : "Gravity restored.");
  }

  private toggleSlow(): void {
    this.slow = !this.slow;
    this.timeScale = this.slow ? 0.25 : 1;
    this.paintSandbox();
    this.toast(this.slow ? "Bullet time. A quarter speed." : "Time restored.");
  }

  private paintSandbox(): void {
    document.getElementById("flag-lowg")?.classList.toggle("on", this.lowG);
    document.getElementById("flag-slow")?.classList.toggle("on", this.slow);
    const bodies = document.getElementById("stat-bodies");
    const broke = document.getElementById("stat-broke");
    if (bodies) bodies.textContent = `${this.countAwake()} active`;
    if (broke) broke.textContent = `${this.destroyed} broken`;
  }

  private countAwake(): number {
    let n = 0;
    for (const piece of this.pieces) if (piece.dynamic && !piece.body.isSleeping()) n++;
    for (const prop of this.props) if (prop.alive && !prop.removed && !prop.body.isSleeping()) n++;
    for (const missile of this.missiles) if (!missile.removed && !missile.body.isSleeping()) n++;
    return n;
  }

  private paintProbe(): void {
    const node = document.getElementById("probe");
    if (!node) return;
    const p = this.playerBody.translation();
    let sx = 0;
    let sz = 0;
    let n = 0;
    for (const prop of this.props) {
      if (!prop.alive || prop.removed) continue;
      const t = prop.body.translation();
      sx += t.x;
      sz += t.z;
      n++;
    }
    for (const piece of this.pieces) {
      if (!piece.dynamic) continue;
      const t = piece.body.translation();
      sx += t.x;
      sz += t.z;
      n++;
    }
    node.dataset.x = p.x.toFixed(3);
    node.dataset.y = p.y.toFixed(3);
    node.dataset.z = p.z.toFixed(3);
    node.dataset.kicks = String(this.kicks);
    node.dataset.broken = String(this.destroyed);
    node.dataset.awake = String(this.countAwake());
    node.dataset.sig = `${n}:${sx.toFixed(1)}:${sz.toFixed(1)}`;
    node.dataset.mode = this.mode;
    node.dataset.ground = this.grounded ? "1" : "0";
    node.dataset.stuck = String(this.stuck);
    node.dataset.steps = String(this.physSteps);
  }

  private placeCamera(): void {
    const p = this.playerBody.translation();
    this.camera.position.set(p.x, p.y + 0.68, p.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;
    if (!this.reduceMotion && this.trauma > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.trauma * 0.16;
      this.camera.position.y += (Math.random() - 0.5) * this.trauma * 0.1;
      this.camera.rotation.z = (Math.random() - 0.5) * this.trauma * 0.02;
      this.trauma = Math.max(0, this.trauma - 0.016 * 2.4);
    } else this.trauma = 0;
    this.sun.position.set(p.x + 10, 20, p.z + 18);
    this.sun.target.position.set(p.x, 1.4, p.z - 8);
    this.sun.target.updateMatrixWorld();
  }

  private decor(dt: number): void {
    for (const work of this.works) {
      if (!work.intact) continue;
      work.hoops.forEach((anchor) => {
        anchor.traverse((obj) => {
          if (obj.userData.spin) obj.rotation.y += dt * Number(obj.userData.spin);
        });
      });
    }
    for (const obj of this.built.spins) {
      const circle = obj.userData.circle as { cx: number; cz: number; r: number; y: number; speed: number; phase: number } | undefined;
      if (circle) {
        const a = this.time * circle.speed + circle.phase;
        obj.position.set(circle.cx + Math.cos(a) * circle.r, circle.y, circle.cz + Math.sin(a) * circle.r);
      } else if (obj.userData.spin) obj.rotation.y += dt * Number(obj.userData.spin);
    }
    this.built.lanterns.forEach((light, i) => {
      const base = Number(light.userData.base ?? light.intensity);
      light.intensity = base * (0.9 + Math.sin(this.time * 2.4 + i) * 0.1);
    });
    this.scene.traverse((obj) => {
      if (obj.userData.bob) obj.position.y = 0.48 + Math.sin(this.time * 2 + Number(obj.userData.bob)) * 0.05;
    });
    const motes = this.built.motes;
    const base = motes.userData.moteBase as Float32Array | undefined;
    if (base) {
      const attr = motes.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < base.length / 3; i++) {
        const a = this.time * 0.35 + i * 0.7;
        attr.setXYZ(
          i,
          base[i * 3] + Math.sin(a) * 0.55,
          base[i * 3 + 1] + Math.sin(a * 0.8 + i) * 0.28,
          base[i * 3 + 2] + Math.cos(a * 0.9) * 0.55,
        );
      }
      attr.needsUpdate = true;
    }
    if (this.stroll && this.marker.visible) this.marker.rotation.z += dt;
    const bodyPos = this.playerBody.translation();
    const wing = nearestWing(bodyPos.x, bodyPos.z);
    const kicker = document.getElementById("wing-kicker");
    const line = document.getElementById("wing-line");
    if (kicker) kicker.textContent = wing.name;
    if (line) line.textContent = wing.line;
    document.querySelectorAll<HTMLButtonElement>("[data-wing]").forEach((btn) => {
      btn.classList.toggle("here", btn.dataset.wing === wing.id);
    });
  }

  private paintCooldowns(): void {
    document.querySelectorAll<HTMLButtonElement>("[data-power]").forEach((btn) => {
      const id = Number(btn.dataset.power) as PowerId;
      const max = POWERS[id].cd;
      btn.style.setProperty("--p", max > 0 ? String(this.cd[id] / max) : "0");
    });
  }

  private applyQuality(q: Quality): void {
    this.quality = q;
    const btn = document.getElementById("btn-quality");
    if (btn) btn.textContent = q === "high" ? "High" : q === "balanced" ? "Balanced" : "Swift";
    const dpr = q === "high" ? Math.min(window.devicePixelRatio, 1.6) : q === "balanced" ? Math.min(window.devicePixelRatio, 1.25) : 1;
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = q !== "swift";
    const size = q === "high" ? 2048 : 1024;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    this.bloom.enabled = q !== "swift";
    this.vfx && (this.vfx.sparks = q !== "swift");
    this.resize();
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
  }
}

function nearestWing(x: number, z: number): WingInfo {
  let best = WINGS[0];
  let d = Infinity;
  for (const wing of WINGS) {
    const dd = (x - wing.x) ** 2 + (z - wing.z) ** 2;
    if (dd < d) { d = dd; best = wing; }
  }
  return best;
}

function readerOpen(): boolean {
  return document.getElementById("reader")?.classList.contains("open") ?? false;
}
function helpOpen(): boolean {
  return document.getElementById("help")?.classList.contains("open") ?? false;
}
function creditsOpen(): boolean {
  return document.getElementById("credits")?.classList.contains("open") ?? false;
}

function geometryFor(spec: PieceSpec): THREE.BufferGeometry {
  switch (spec.shape) {
    case "box": return new THREE.BoxGeometry(spec.size[0], spec.size[1], spec.size[2]);
    case "cyl": return new THREE.CylinderGeometry(spec.size[0], spec.size[1], spec.size[2], 12);
    case "sph": return new THREE.SphereGeometry(spec.size[0], 16, 12);
    case "cone": return new THREE.ConeGeometry(spec.size[0], spec.size[1], 10);
    case "oct": return new THREE.OctahedronGeometry(spec.size[0], 0);
    case "ico": return new THREE.IcosahedronGeometry(spec.size[0], spec.size[0] > 0.6 ? 1 : 0);
    case "dod": return new THREE.DodecahedronGeometry(spec.size[0], 0);
    case "cap": return new THREE.CapsuleGeometry(spec.size[0], spec.size[1], 5, 10);
    default: return new THREE.BoxGeometry(0.2, 0.2, 0.2);
  }
}

function colliderFor(spec: PieceSpec): RAPIER.ColliderDesc {
  let desc: RAPIER.ColliderDesc | null;
  switch (spec.shape) {
    case "box":
      desc = RAPIER.ColliderDesc.cuboid(spec.size[0] / 2, spec.size[1] / 2, spec.size[2] / 2);
      break;
    case "cyl":
      desc = RAPIER.ColliderDesc.cylinder(spec.size[2] / 2, Math.max(spec.size[0], spec.size[1]));
      break;
    case "sph":
    case "oct":
    case "ico":
    case "dod":
      desc = RAPIER.ColliderDesc.ball(spec.size[0] * (spec.shape === "sph" ? 1 : 0.92));
      break;
    case "cap":
      desc = RAPIER.ColliderDesc.capsule(spec.size[1] / 2, spec.size[0]);
      break;
    case "cone": {
      const geo = new THREE.ConeGeometry(spec.size[0], spec.size[1], 8);
      desc = RAPIER.ColliderDesc.convexHull(flatPositions(geo)) ?? RAPIER.ColliderDesc.ball(spec.size[0]);
      geo.dispose();
      break;
    }
    default:
      desc = RAPIER.ColliderDesc.ball(0.2);
  }
  const glassy = spec.mat === "amber" || spec.mat === "chrome" || spec.mat === "gold" || spec.mat === "mint";
  return desc.setDensity(densityOf(spec.mat)).setFriction(0.72).setRestitution(glassy ? 0.28 : 0.06);
}

function flatPositions(geo: THREE.BufferGeometry): Float32Array {
  const pos = geo.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    arr[i * 3] = pos.getX(i);
    arr[i * 3 + 1] = pos.getY(i);
    arr[i * 3 + 2] = pos.getZ(i);
  }
  return arr;
}

function plaqueTexture(article: Article): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 320;
  const g = c.getContext("2d");
  if (!g) return new THREE.CanvasTexture(c);
  g.fillStyle = "#17160f";
  g.fillRect(0, 0, 512, 320);
  g.strokeStyle = "#c6a15b";
  g.lineWidth = 8;
  g.strokeRect(10, 10, 492, 300);
  g.fillStyle = "#c6a15b";
  g.font = "500 22px Georgia, serif";
  g.fillText(article.kicker.toUpperCase(), 32, 58);
  g.fillStyle = "#f6f0e4";
  g.font = "600 42px Georgia, serif";
  wrapText(g, article.title, 32, 118, 448, 48);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function wrapText(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number): void {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > max && line) {
      g.fillText(line, x, y);
      line = word;
      y += lh;
    } else line = test;
  }
  if (line) g.fillText(line, x, y);
}

function fillArticle(article: Article): void {
  const kicker = document.getElementById("reader-kicker");
  const title = document.getElementById("reader-title");
  const status = document.getElementById("reader-status");
  const body = document.getElementById("reader-body");
  const links = document.getElementById("reader-links");
  if (kicker) kicker.textContent = article.kicker;
  if (title) title.textContent = article.title;
  if (status) status.textContent = article.status;
  if (body) {
    body.replaceChildren();
    const lede = document.createElement("p");
    lede.className = "lede";
    lede.textContent = article.lede;
    body.append(lede);
    for (const paragraph of article.body) {
      const p = document.createElement("p");
      p.textContent = paragraph;
      body.append(p);
    }
    if (article.quote) {
      const q = document.createElement("blockquote");
      q.textContent = article.quote;
      body.append(q);
    }
    if (article.principles) {
      const ol = document.createElement("ol");
      for (const line of article.principles) {
        const li = document.createElement("li");
        li.textContent = line;
        ol.append(li);
      }
      body.append(ol);
    }
    if (article.note) {
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = article.note;
      body.append(note);
    }
  }
  if (links) {
    links.replaceChildren();
    for (const link of article.links) {
      const a = document.createElement("a");
      a.href = link.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = link.label;
      links.append(a);
    }
  }
}
