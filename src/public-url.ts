/** Resolve a file in `public/` against Vite's base, so GitHub Pages subpaths and local preview both work. */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "./";
  const clean = path.replace(/^\/+/, "");
  return `${base}${clean}`;
}
