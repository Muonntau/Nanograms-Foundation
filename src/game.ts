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
  group: THREE.Group;
  light: THREE.PointLight;
}

const POWERS: Record<PowerId, { name: string; line: string; cd: number }> = {
  1: { name: "Kinetic Lance", line: "A clean question, asked at speed.", cd: 0.38 },
  2: { name: "Gravity Singularity", line: "Gather what was separate. Then let it go.", cd: 3.4 },
  3: { name: "Seismic Shockwave", line: "The terrace remembers it is also ground.", cd: 2.15 },
  4: { name: "Solar Ember Beam", line: "Heat, patiently, until the form changes its mind.", cd: 0 },
  5: { name: "Differentiality Pulse", line: "z = 1/E. Gravity, briefly persuaded otherwise.", cd: 3.1 },
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
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1.4, 12.4),
    );
    this.playerCollider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.58, 0.3), player);
    this.playerBody = player;
    this.controller = this.world.createCharacterController(0.02);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    this.controller.enableAutostep(0.42, 0.18, true);
    this.controller.enableSnapToGround(0.3);
    this.controller.setMaxSlopeClimbAngle(Math.PI / 4);
    this.controller.setSlideEnabled(true);
    this.controller.setApplyImpulsesToDynamicBodies(true);

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
    stone.userData.read = id;
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

    window.addEventListener("keydown", (e) => this.onKey(e, true));
    window.addEventListener("keyup", (e) => this.onKey(e, false));
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

  private onKey(e: KeyboardEvent, down: boolean): void {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    if (down) this.keys.add(e.code);
    else this.keys.delete(e.code);
    if (!down) {
      if (e.code === "KeyF") this.solarDown = false;
      return;
    }
    if (this.mode === "cine" && (e.code === "Enter" || e.code === "Space")) {
      void this.audio.resume();
      this.beginPlay(false);
      return;
    }
    if (e.code === "Escape") this.closePanels();
    if (readerOpen() || helpOpen()) return;
    if (e.code >= "Digit1" && e.code <= "Digit5") this.setPower(Number(e.code.slice(5)) as PowerId);
    if (e.code === "KeyE") this.readAimed();
    if (e.code === "KeyR") {
      if (e.shiftKey) this.restoreAll();
      else this.restoreAimed();
    }
    if (e.code === "KeyC") this.toggleLook();
    if (e.code === "KeyM") {
      this.audio.setMuted(!this.audio.muted);
      const btn = document.getElementById("btn-sound");
      if (btn) btn.textContent = this.audio.muted ? "Muted" : "Sound";
    }
    if (e.code === "KeyF" && !e.repeat) {
      this.fireEdge = true;
      this.solarDown = true;
    }
    if (e.code === "Space") this.keys.add("Space");
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
    if (document.pointerLockElement === this.canvas) {
      this.fireEdge = true;
      this.solarDown = true;
      const up = () => {
        this.solarDown = false;
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointerup", up);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    const dx = e.clientX - this.pointer.x;
    const dy = e.clientY - this.pointer.y;
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    if (Math.hypot(dx, dy) > 2) this.pointer.moved = true;
    const locked = document.pointerLockElement === this.canvas;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (locked) {
      this.yaw -= e.movementX * 0.00215;
      this.pitch -= e.movementY * 0.00215;
    } else if (this.rightDown || (coarse && (e.buttons & 1) === 1 && this.pointer.moved)) {
      this.yaw -= dx * 0.0045;
      this.pitch -= dy * 0.004;
    }
    this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch));
  }

  private beginPlay(lock: boolean): void {
    this.mode = "play";
    document.getElementById("intro")?.classList.add("hide");
    const wing = WINGS[0];
    this.yaw = wing.yaw;
    this.pitch = -0.08;
    this.playerBody.setTranslation({ x: wing.x, y: 1.35, z: wing.z }, true);
    this.playerBody.setNextKinematicTranslation({ x: wing.x, y: 1.35, z: wing.z });
    if (lock) this.canvas.requestPointerLock();
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
      this.playerBody.setTranslation({ x: wing.x, y: 1.4, z: wing.z }, true);
      this.playerBody.setNextKinematicTranslation({ x: wing.x, y: 1.4, z: wing.z });
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
    const dt = Math.min(0.033, this.clock.getDelta());
    this.time += dt;
    this.fpsSmoothed = this.fpsSmoothed * 0.92 + (1 / Math.max(dt, 0.001)) * 0.08;
    this.fpsAcc += dt;
    if (this.fpsAcc > 0.3) {
      this.fpsAcc = 0;
      const fps = document.getElementById("fps");
      if (fps) fps.textContent = `${Math.round(this.fpsSmoothed)} fps`;
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
    this.stepPhysics(dt);
    this.syncMeshes();
    this.updateFields(dt);
    this.updateHeat(dt);
    this.updateAim();
    this.updatePowers(dt);
    this.vfx.update(dt);
    this.audio.update(dt);
    this.decor(dt);
    if (this.mode === "play") this.placeCamera();
    for (const id of [1, 2, 3, 4, 5] as PowerId[]) this.cd[id] = Math.max(0, this.cd[id] - dt);
    this.paintCooldowns();
    if (this.quality === "swift") this.renderer.render(this.scene, this.camera);
    else this.composer.render();
  }

  private stepPlayerLook(dt: number): void {
    const turn = 1.7 * dt;
    if (this.keys.has("ArrowLeft")) this.yaw += turn;
    if (this.keys.has("ArrowRight")) this.yaw -= turn;
    if (this.keys.has("ArrowUp")) this.pitch += turn * 0.8;
    if (this.keys.has("ArrowDown")) this.pitch -= turn * 0.8;
    this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch));
  }

  private stepPhysics(dt: number): void {
    let acc = dt;
    const step = 1 / 60;
    let n = 0;
    while (acc >= step && n < 3) {
      if (this.mode === "play") this.movePlayer(step);
      this.orbitPieces(step);
      this.world.step(this.queue);
      this.drainContacts();
      acc -= step;
      n++;
    }
  }

  private movePlayer(dt: number): void {
    const p = this.playerBody.translation();
    let forward = 0;
    let strafe = 0;
    if (this.keys.has("KeyW")) forward += 1;
    if (this.keys.has("KeyS")) forward -= 1;
    if (this.keys.has("KeyD")) strafe += 1;
    if (this.keys.has("KeyA")) strafe -= 1;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    let wx = fx * forward + rx * strafe;
    let wz = fz * forward + rz * strafe;
    const mag = Math.hypot(wx, wz);
    if (mag > 0) { wx /= mag; wz /= mag; }
    const typing = forward !== 0 || strafe !== 0;
    if (!typing && this.stroll) {
      const dx = this.stroll.x - p.x;
      const dz = this.stroll.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.55) {
        this.stroll = null;
        this.marker.visible = false;
      } else {
        wx = dx / d;
        wz = dz / d;
        if (document.pointerLockElement !== this.canvas && !this.rightDown) {
          this.yaw = Math.atan2(-wx, -wz);
        }
      }
    }
    const sprint = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const speed = (sprint ? 10.4 : 5.5) * (mag > 0 || this.stroll ? 1 : 0);
    if (this.grounded && this.vy <= 0) this.vy = 0;
    else this.vy -= 18 * dt;
    if (this.grounded) this.coyote = 0.12;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (this.keys.has("Space") && (this.grounded || this.coyote > 0)) {
      this.vy = 6.5;
      this.coyote = 0;
      this.keys.delete("Space");
    }
    this.controller.computeColliderMovement(
      this.playerCollider,
      { x: wx * speed * dt, y: this.vy * dt, z: wz * speed * dt },
    );
    const m = this.controller.computedMovement();
    const next = { x: p.x + m.x, y: p.y + m.y, z: p.z + m.z };
    this.playerBody.setNextKinematicTranslation(next);
    this.grounded = this.controller.computedGrounded();
    const horiz = Math.hypot(m.x, m.z) / dt;
    if (this.grounded && horiz > 0.8) {
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
    let budget = 4;
    this.queue.drainContactForceEvents((event) => {
      if (budget <= 0) return;
      const a = this.byHandle.get(event.collider1());
      const b = this.byHandle.get(event.collider2());
      const piece = a ?? b;
      if (!piece || this.time < piece.nextClack) return;
      if (event.totalForceMagnitude() < 40) return;
      piece.nextClack = this.time + 0.16;
      this.audio.shatter(piece.family, 0.45);
      budget--;
    });
    this.queue.drainCollisionEvents(() => undefined);
  }

  private syncMeshes(): void {
    for (const piece of this.pieces) {
      if (!piece.dynamic && !piece.spec.orbit) continue;
      const t = piece.body.translation();
      const r = piece.body.rotation();
      piece.mesh.position.set(t.x, t.y, t.z);
      piece.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      const v = piece.body.linvel();
      const sp = Math.hypot(v.x, v.y, v.z);
      if (sp > 26) {
        const k = 26 / sp;
        piece.body.setLinvel({ x: v.x * k, y: v.y * k, z: v.z * k }, true);
      }
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
      prompt.textContent = article ? `E  ·  ${article.title}` : "E  ·  Read";
      prompt.classList.add("show");
    } else prompt.classList.remove("show");
  }

  private updatePowers(dt: number): void {
    if (readerOpen()) {
      this.solarDown = false;
      this.fireEdge = false;
      this.audio.setBeam(false);
      this.beam.visible = false;
      return;
    }
    if (this.power === 4 && this.solarDown && this.mode === "play") {
      this.solarTick(dt);
    } else {
      this.audio.setBeam(false);
      if (this.power === 4) this.beam.visible = false;
    }
    if (this.fireEdge && this.mode === "play" && this.cd[this.power] <= 0 && this.power !== 4) {
      this.fireEdge = false;
      this.cast(this.power);
      this.cd[this.power] = POWERS[this.power].cd;
    } else if (this.power === 4) {
      this.fireEdge = false;
    }
    if (!this.keys.has("KeyF") && this.power !== 4) this.solarDown = false;
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.button !== 0 || this.mode !== "play") return;
    if (document.pointerLockElement === this.canvas) return;
    if (this.pointer.moved) return;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const reads = this.raycaster.intersectObjects(this.aimables, false);
    const read = reads.find((hit) => hit.distance < 9 && hit.object.userData.read);
    if (read) {
      this.openReader(String(read.object.userData.read));
      return;
    }
    const grounds = this.raycaster.intersectObjects(this.built.grounds, false);
    const ground = grounds[0];
    if (!ground) return;
    this.stroll = ground.point.clone();
    this.marker.visible = true;
    this.marker.position.set(ground.point.x, ground.point.y + 0.08, ground.point.z);
  }

  private cast(power: PowerId): void {
    if (power === 1) this.lance();
    else if (power === 2) this.singularity();
    else if (power === 3) this.seismic();
    else if (power === 5) this.differentiality();
  }

  private forward(): THREE.Vector3 {
    const v = new THREE.Vector3(0, 0, -1);
    v.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));
    return v.normalize();
  }

  private rayHit(max = 40): { point: THREE.Vector3; piece: Piece | null } | null {
    const dir = this.forward();
    const origin = this.camera.position.clone().addScaledVector(dir, 0.35);
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRay(
      ray, max, true, undefined, undefined, undefined, this.playerBody,
      (collider) => !this.passThrough.has(collider.handle),
    );
    if (!hit) return null;
    const point = origin.clone().addScaledVector(dir, hit.timeOfImpact);
    return { point, piece: this.byHandle.get(hit.collider.handle) ?? null };
  }

  private lance(): void {
    const dir = this.forward();
    let ox = this.camera.position.x + dir.x * 0.4;
    let oy = this.camera.position.y + dir.y * 0.4;
    let oz = this.camera.position.z + dir.z * 0.4;
    let remain = 34;
    const skip = new Set<number>([this.playerCollider.handle, ...this.passThrough]);
    const punched: Piece[] = [];
    let end = new THREE.Vector3(ox + dir.x * 18, oy + dir.y * 18, oz + dir.z * 18);
    for (let i = 0; i < 8 && remain > 0.2; i++) {
      const ray = new RAPIER.Ray({ x: ox, y: oy, z: oz }, dir);
      const hit = this.world.castRay(ray, remain, true, undefined, undefined, undefined, undefined, (c) => !skip.has(c.handle));
      if (!hit) break;
      const toi = hit.timeOfImpact;
      const px = ox + dir.x * toi;
      const py = oy + dir.y * toi;
      const pz = oz + dir.z * toi;
      end = new THREE.Vector3(px, py, pz);
      const piece = this.byHandle.get(hit.collider.handle);
      if (!piece) {
        this.vfx.burst(end, "#d7c4a4", 10, 3, -2);
        break;
      }
      punched.push(piece);
      skip.add(hit.collider.handle);
      this.kick(piece, dir.x * 16, dir.y * 4 + 2, dir.z * 16, 1);
      this.splash(end, 1.1, piece, dir, 5);
      this.vfx.burst(end, piece.family === "metal" ? "#ffe1a8" : "#ffb15a", 16, 6);
      this.vfx.flash(end, "#ffd2a0", 10);
      ox = px + dir.x * 0.2;
      oy = py + dir.y * 0.2;
      oz = pz + dir.z * 0.2;
      remain -= toi + 0.2;
    }
    this.showBeam(this.camera.position.clone().addScaledVector(dir, 0.4), end, "#fff1d2", 0.07);
    this.audio.shatter(punched[0]?.family ?? "metal", 0.9);
    this.trauma = Math.max(this.trauma, 0.28);
  }

  private singularity(): void {
    const aim = this.aimPoint(8, 16);
    const group = new THREE.Group();
    group.position.copy(aim);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.7 + i * 0.45, 0.035, 8, 32),
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
    const light = new THREE.PointLight("#e4b56a", 6, 12, 2);
    group.add(light);
    this.scene.add(group);
    this.fields.push({ kind: "sing", x: aim.x, y: aim.y, z: aim.z, age: 0, boomed: false, group, light });
    this.audio.setHum(1);
    this.trauma = Math.max(this.trauma, 0.2);
  }

  private seismic(): void {
    const p = this.playerBody.translation();
    const origin = new THREE.Vector3(p.x, 0.2, p.z);
    for (const piece of this.pieces) {
      const t = piece.body.translation();
      const dx = t.x - p.x;
      const dz = t.z - p.z;
      const d = Math.hypot(dx, dz, t.y * 0.3);
      if (d > 9.5) continue;
      const fall = 1 - d / 9.5;
      const len = Math.hypot(dx, dz) || 1;
      this.kick(piece, (dx / len) * 10 * fall, 11 + 6 * fall, (dz / len) * 10 * fall, Math.max(0.7, fall));
    }
    this.vfx.shockwave(origin, "#ffb15a", 9);
    this.vfx.burst(origin, "#c4b49a", 28, 5, -1);
    this.vfx.flash(new THREE.Vector3(p.x, 1, p.z), "#ffb066", 16);
    this.audio.boom();
    let reached = 0;
    for (const piece of this.pieces) {
      const t = piece.body.translation();
      if (Math.hypot(t.x - p.x, t.z - p.z) < 9.5) reached++;
    }
    if (reached === 0) this.toast("Step closer. The wave needs a sculpture.");
    this.trauma = Math.max(this.trauma, this.reduceMotion ? 0 : 0.72);
  }

  private solarTick(dt: number): void {
    const dir = this.forward();
    const start = this.camera.position.clone().addScaledVector(dir, 0.45);
    const hit = this.rayHit(28);
    const end = hit ? hit.point : start.clone().addScaledVector(dir, 16);
    this.showBeam(start, end, "#ff7a2a", 0.12, true);
    this.beam.scale.x = 1.8;
    this.beam.scale.z = 1.8;
    this.audio.setBeam(true);
    if (!hit?.piece) return;
    this.addHeat(hit.piece, dt * 1.15);
    const t = hit.piece.body.translation();
    const pos = new THREE.Vector3(t.x, t.y, t.z);
    for (const other of this.piecesNear(pos, 0.9)) {
      if (other !== hit.piece) this.addHeat(other, dt * 0.35);
    }
    if (Math.random() < dt * 18) this.vfx.burst(end, "#ff8a3a", 4, 2, -1);
  }

  private differentiality(): void {
    const aim = this.aimPoint(5, 14);
    const group = new THREE.Group();
    group.position.copy(aim);
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.2, 1),
      new THREE.MeshBasicMaterial({
        color: "#9ff3d4",
        wireframe: true,
        transparent: true,
        opacity: 0.45,
        toneMapped: false,
      }),
    );
    group.add(shell);
    const light = new THREE.PointLight("#9ff3d4", 4, 10, 2);
    group.add(light);
    this.scene.add(group);
    this.fields.push({ kind: "invert", x: aim.x, y: aim.y, z: aim.z, age: 0, boomed: false, group, light });
    for (const piece of this.piecesNear(aim, 6)) {
      this.wake(piece);
      piece.body.setGravityScale(-0.42, true);
      const v = piece.body.linvel();
      piece.body.setLinvel({ x: v.x * 0.4, y: Math.max(v.y, 0.4), z: v.z * 0.4 }, true);
    }
    this.audio.toneLift();
    this.trauma = Math.max(this.trauma, 0.18);
  }

  private updateFields(dt: number): void {
    for (let i = this.fields.length - 1; i >= 0; i--) {
      const field = this.fields[i];
      field.age += dt;
      field.group.rotation.y += dt * (field.kind === "sing" ? 2.4 : 0.6);
      field.group.rotation.x += dt * 0.8;
      if (field.kind === "sing") {
        const pull = field.age < 2.2;
        for (const piece of this.piecesNear(new THREE.Vector3(field.x, field.y, field.z), 7.2)) {
          const t = piece.body.translation();
          const dx = field.x - t.x;
          const dy = field.y - t.y;
          const dz = field.z - t.z;
          const dist = Math.hypot(dx, dy, dz) || 0.001;
          this.wake(piece);
          if (pull) {
            const v = piece.body.linvel();
            const s = (1 - dist / 7.2) * 8;
            const tx = -dz / dist;
            const tz = dx / dist;
            piece.body.setLinvel({
              x: v.x * 0.9 + (dx / dist) * s + tx * 2.2,
              y: v.y * 0.9 + (dy / dist) * s * 0.65 + 0.3,
              z: v.z * 0.9 + (dz / dist) * s + tz * 2.2,
            }, true);
          }
        }
        if (!pull && !field.boomed) {
          field.boomed = true;
          const at = new THREE.Vector3(field.x, field.y, field.z);
          for (const piece of this.piecesNear(at, 7.5)) {
            const t = piece.body.translation();
            const dx = t.x - field.x;
            const dy = t.y - field.y;
            const dz = t.z - field.z;
            const dist = Math.hypot(dx, dy, dz) || 1;
            this.kick(piece, (dx / dist) * 12, 5 + dy / dist * 4, (dz / dist) * 12, 1);
          }
          this.vfx.shockwave(at, "#e4b56a", 7);
          this.vfx.burst(at, "#ffd7a0", 30, 8);
          this.audio.boom();
          this.trauma = Math.max(this.trauma, 0.55);
          this.audio.setHum(0);
        }
        if (field.age > 2.7) {
          this.scene.remove(field.group);
          this.fields.splice(i, 1);
          this.audio.setHum(0);
        }
      } else if (field.age > 2.05 && !field.boomed) {
        field.boomed = true;
        for (const piece of this.piecesNear(new THREE.Vector3(field.x, field.y, field.z), 6.2)) {
          piece.body.setGravityScale(2.8, true);
          const v = piece.body.linvel();
          piece.body.setLinvel({ x: v.x, y: Math.min(v.y, 0) - 3.5, z: v.z }, true);
        }
        this.audio.boom();
        this.trauma = Math.max(this.trauma, 0.4);
      } else if (field.age > 2.7) {
        for (const piece of this.pieces) piece.body.setGravityScale(1, true);
        this.scene.remove(field.group);
        this.fields.splice(i, 1);
      }
    }
  }

  private updateHeat(dt: number): void {
    for (const piece of this.pieces) {
      if (piece.heat <= 0) continue;
      if (!piece.hot) piece.heat = Math.max(0, piece.heat - dt * 0.12);
      else piece.heat = Math.max(0.55, piece.heat - dt * 0.05);
      const k = Math.min(1, piece.heat);
      piece.mat.emissive.r = piece.baseEmissive.r + (1 - piece.baseEmissive.r) * k;
      piece.mat.emissive.g = piece.baseEmissive.g * (1 - k) + 0.28 * k;
      piece.mat.emissive.b = piece.baseEmissive.b * (1 - k * 0.85);
      piece.mat.emissiveIntensity = piece.baseEm + k * 2.4;
    }
  }

  private addHeat(piece: Piece, amount: number): void {
    piece.heat += amount;
    if (piece.heat >= 1 && !piece.hot) this.detonate(piece, 0);
  }

  private detonate(piece: Piece, depth: number): void {
    if (piece.hot || depth > 10) {
      piece.hot = true;
      return;
    }
    piece.hot = true;
    piece.heat = 1;
    const t = piece.body.translation();
    const pos = new THREE.Vector3(t.x, t.y, t.z);
    this.kick(piece, (Math.random() - 0.5) * 8, 4 + Math.random() * 3, (Math.random() - 0.5) * 8, 0.8);
    this.vfx.burst(pos, "#ff6a1a", 12, 4);
    this.audio.shatter(piece.family, 0.7);
    for (const other of this.piecesNear(pos, 1.45)) {
      if (other === piece || other.hot) continue;
      other.heat += 0.55;
      if (other.heat >= 1) this.detonate(other, depth + 1);
    }
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

  private piecesNear(pos: THREE.Vector3, radius: number): Piece[] {
    const r2 = radius * radius;
    const out: Piece[] = [];
    for (const piece of this.pieces) {
      const t = piece.body.translation();
      const dx = t.x - pos.x;
      const dy = t.y - pos.y;
      const dz = t.z - pos.z;
      if (dx * dx + dy * dy + dz * dz <= r2) out.push(piece);
    }
    return out;
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
      for (const hoop of work.hoops) hoop.visible = false;
    }
  }

  private kick(piece: Piece, vx: number, vy: number, vz: number, heftScale: number): void {
    this.wake(piece);
    const mass = piece.body.mass();
    const heft = mass > 50 ? 0.5 : mass > 20 ? 0.75 : 1;
    const k = heft * heftScale;
    const v = piece.body.linvel();
    piece.body.setLinvel({ x: v.x + vx * k, y: v.y + vy * k, z: v.z + vz * k }, true);
    piece.body.applyTorqueImpulse({
      x: (Math.random() - 0.5) * 3.5,
      y: (Math.random() - 0.5) * 3.5,
      z: (Math.random() - 0.5) * 3.5,
    }, true);
  }

  private splash(pos: THREE.Vector3, radius: number, ignore: Piece, dir: THREE.Vector3, speed: number): void {
    for (const piece of this.piecesNear(pos, radius)) {
      if (piece === ignore) continue;
      this.kick(piece, dir.x * speed + (Math.random() - 0.5) * 3, 2, dir.z * speed + (Math.random() - 0.5) * 3, 0.65);
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
    if (!id || id === "bust" || id === "guardian") {
      this.toast("Face a campus sculpture, or restore the whole terrace.");
      return;
    }
    this.restoreIds([id]);
  }

  private restoreAll(): void {
    this.restoreIds(this.works.map((w) => w.def.id));
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
    this.toast(ids.length > 1 ? "The campus is whole again." : "Restored.");
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
