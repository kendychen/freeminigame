const RESERVED = new Set([
  "api",
  "admin",
  "auth",
  "login",
  "signup",
  "dashboard",
  "embed",
  "display",
  "quick",
  "t",
  "s",
]);

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export function ensureSafeSlug(input: string): string {
  let s = slugify(input);
  if (!s) s = "tour";
  if (RESERVED.has(s)) s = `${s}-1`;
  return s;
}

export function withRandomSuffix(slug: string): string {
  const r = Math.random().toString(36).slice(2, 6);
  return `${slug}-${r}`;
}
