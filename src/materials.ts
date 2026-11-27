import * as THREE from "three";
import { publicUrl } from "./public-url";

export type MatId =
  | "obsidian"
  | "olive"
  | "marble"
  | "chrome"
  | "gold"
  | "amber"
  | "mint"
  | "wood"
  | "graphite";

export const MAT_IDS: MatId[] = [
  "obsidian",
  "olive",
  "marble",
  "chrome",
  "gold",
  "amber",
  "mint",
  "wood",
  "graphite",
];

type Maps = {
  diff: THREE.Texture;
  nor: THREE.Texture;
  rough: THREE.Texture;
};

async function loadTexture(url: string, color: boolean): Promise<THREE.Texture> {
  const loader = new THREE.TextureLoader();
  const tex = await loader.loadAsync(url);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
  return tex;
}

async function loadMaps(slug: string): Promise<Maps> {
  const base = publicUrl(`assets/textures/${slug}`);
  const [diff, nor, rough] = await Promise.all([
    loadTexture(`${base}/diff.jpg`, true),
    loadTexture(`${base}/nor.jpg`, false),
    loadTexture(`${base}/rough.jpg`, false),
  ]);
  return { diff, nor, rough };
}

function std(
  maps: Maps | null,
  opts: {
    color: string;
    roughness: number;
    metalness: number;
    emissive?: string;
    emissiveIntensity?: number;
    normalScale?: number;
    env?: number;
  },
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: opts.color,
    roughness: opts.roughness,
    metalness: opts.metalness,
    emissive: opts.emissive ?? "#000000",
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    envMapIntensity: opts.env ?? 0.85,
    map: maps?.diff ?? null,
    normalMap: maps?.nor ?? null,
    roughnessMap: maps?.rough ?? null,
  });
  if (opts.normalScale && mat.normalMap) {
    mat.normalScale.set(opts.normalScale, opts.normalScale);
  }
  return mat;
}

export class MaterialLibrary {
  templates: Record<MatId, THREE.MeshStandardMaterial>;
  arch: {
    column: THREE.MeshStandardMaterial;
    wall: THREE.MeshStandardMaterial;
    floor: THREE.MeshStandardMaterial;
    garden: THREE.MeshStandardMaterial;
    wood: THREE.MeshStandardMaterial;
    foliage: THREE.MeshStandardMaterial;
    bark: THREE.MeshStandardMaterial;
    water: THREE.MeshStandardMaterial;
    lantern: THREE.MeshStandardMaterial;
    gold: THREE.MeshStandardMaterial;
    trim: THREE.MeshStandardMaterial;
  };
  private textures: THREE.Texture[] = [];

  private constructor(
    templates: Record<MatId, THREE.MeshStandardMaterial>,
    arch: MaterialLibrary["arch"],
    textures: THREE.Texture[],
  ) {
    this.templates = templates;
    this.arch = arch;
    this.textures = textures;
  }

  static async load(): Promise<MaterialLibrary> {
    const [marble, metal, wood, plaster, slate, rock] = await Promise.all([
      loadMaps("marble_01"),
      loadMaps("metal_plate"),
      loadMaps("dark_wooden_planks"),
      loadMaps("plastered_stone_wall"),
      loadMaps("slate_floor"),
      loadMaps("rocky_terrain"),
    ]);
    const textures = [marble, metal, wood, plaster, slate, rock].flatMap((m) => [
      m.diff,
      m.nor,
      m.rough,
    ]);

    const templates: Record<MatId, THREE.MeshStandardMaterial> = {
      obsidian: std(plaster, {
        color: "#3c4338",
        roughness: 0.92,
        metalness: 0.06,
        normalScale: 0.8,
        env: 0.45,
      }),
      olive: std(plaster, {
        color: "#6d7460",
        roughness: 0.88,
        metalness: 0.04,
        normalScale: 0.7,
        env: 0.5,
      }),
      marble: std(marble, {
        color: "#f3eadc",
        roughness: 0.48,
        metalness: 0.02,
        normalScale: 0.45,
        env: 0.7,
      }),
      chrome: std(metal, {
        color: "#e4ebf1",
        roughness: 0.18,
        metalness: 1,
        normalScale: 0.35,
        env: 1.15,
      }),
      gold: std(metal, {
        color: "#e4b56a",
        roughness: 0.34,
        metalness: 1,
        emissive: "#3a2408",
        emissiveIntensity: 0.08,
        normalScale: 0.3,
        env: 1.05,
      }),
      amber: std(null, {
        color: "#ffb15a",
        roughness: 0.16,
        metalness: 0.12,
        emissive: "#e07020",
        emissiveIntensity: 0.55,
        env: 1.2,
      }),
      mint: std(null, {
        color: "#d7fff4",
        roughness: 0.28,
        metalness: 0.18,
        emissive: "#5dffe0",
        emissiveIntensity: 1.55,
        env: 0.9,
      }),
      wood: std(wood, {
        color: "#b08458",
        roughness: 0.72,
        metalness: 0.02,
        normalScale: 0.6,
        env: 0.4,
      }),
      graphite: std(metal, {
        color: "#5e656d",
        roughness: 0.46,
        metalness: 0.86,
        normalScale: 0.4,
        env: 0.8,
      }),
    };

    const arch = {
      column: std(plaster, {
        color: "#8d9078",
        roughness: 0.9,
        metalness: 0.03,
        normalScale: 0.75,
        env: 0.45,
      }),
      wall: std(plaster, {
        color: "#3e463c",
        roughness: 0.94,
        metalness: 0.04,
        normalScale: 0.8,
        env: 0.35,
      }),
      floor: std(slate, {
        color: "#c9c2b4",
        roughness: 0.78,
        metalness: 0.04,
        normalScale: 0.55,
        env: 0.4,
      }),
      garden: std(rock, {
        color: "#6a7558",
        roughness: 0.96,
        metalness: 0,
        normalScale: 0.9,
        env: 0.3,
      }),
      wood: std(wood, {
        color: "#7a5a3c",
        roughness: 0.8,
        metalness: 0.02,
        normalScale: 0.55,
        env: 0.35,
      }),
      foliage: new THREE.MeshStandardMaterial({
        color: "#2c4634",
        roughness: 0.9,
        metalness: 0,
        emissive: "#0e2216",
        emissiveIntensity: 0.12,
      }),
      bark: std(wood, {
        color: "#4a382c",
        roughness: 0.9,
        metalness: 0,
        normalScale: 0.5,
      }),
      water: new THREE.MeshStandardMaterial({
        color: "#1a3330",
        roughness: 0.06,
        metalness: 0.55,
        transparent: true,
        opacity: 0.88,
        envMapIntensity: 1.5,
      }),
      lantern: new THREE.MeshStandardMaterial({
        color: "#ffd7a8",
        emissive: "#ff9a3c",
        emissiveIntensity: 2.1,
        roughness: 0.35,
      }),
      gold: templates.gold,
      trim: std(metal, {
        color: "#c6a15b",
        roughness: 0.4,
        metalness: 1,
        env: 1,
      }),
    };

    return new MaterialLibrary(templates, arch, textures);
  }

  setAnisotropy(n: number): void {
    for (const tex of this.textures) tex.anisotropy = n;
  }

  clone(id: MatId): THREE.MeshStandardMaterial {
    return this.templates[id].clone();
  }
}

export function soundFamily(id: MatId): "glass" | "metal" | "stone" | "wood" {
  if (id === "amber" || id === "mint") return "glass";
  if (id === "chrome" || id === "gold" || id === "graphite") return "metal";
  if (id === "wood") return "wood";
  return "stone";
}

export function densityOf(id: MatId): number {
  switch (id) {
    case "chrome":
    case "gold":
    case "graphite":
      return 240;
    case "amber":
    case "mint":
      return 80;
    case "wood":
      return 90;
    default:
      return 170;
  }
}
