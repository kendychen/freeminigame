export type TechniqueSlug = "serve" | "return" | "third-shot-drop" | "third-shot-drive"
  | "dink" | "volley" | "reset" | "lob" | "overhead" | "erne" | "atp" | "footwork";
export type Technique = { slug: TechniqueSlug; nameVi: string; nameEn: string; query: string };
export const TECHNIQUES: readonly Technique[] = [
  { slug: "serve", nameVi: "Giao bóng", nameEn: "Serve", query: "pickleball serve tutorial" },
  { slug: "return", nameVi: "Trả giao bóng", nameEn: "Return of serve", query: "pickleball return of serve tutorial" },
  { slug: "third-shot-drop", nameVi: "Bóng thứ ba thả", nameEn: "Third shot drop", query: "pickleball third shot drop tutorial" },
  { slug: "third-shot-drive", nameVi: "Bóng thứ ba đánh mạnh", nameEn: "Third shot drive", query: "pickleball third shot drive tutorial" },
  { slug: "dink", nameVi: "Dink", nameEn: "Dink", query: "pickleball dink tutorial" },
  { slug: "volley", nameVi: "Volley", nameEn: "Volley", query: "pickleball volley tutorial" },
  { slug: "reset", nameVi: "Reset bóng", nameEn: "Reset", query: "pickleball reset shot tutorial" },
  { slug: "lob", nameVi: "Lốp bóng", nameEn: "Lob", query: "pickleball lob tutorial" },
  { slug: "overhead", nameVi: "Đập bóng trên đầu", nameEn: "Overhead / Smash", query: "pickleball overhead smash tutorial" },
  { slug: "erne", nameVi: "Erne", nameEn: "Erne", query: "pickleball erne tutorial" },
  { slug: "atp", nameVi: "ATP (đánh vòng cột)", nameEn: "Around the post", query: "pickleball around the post ATP tutorial" },
  { slug: "footwork", nameVi: "Di chuyển & lên lưới", nameEn: "Footwork / Transition", query: "pickleball footwork transition zone tutorial" },
];

const SLUGS = new Set<string>(TECHNIQUES.map((t) => t.slug));

export function isTechniqueSlug(s: string): s is TechniqueSlug {
  return SLUGS.has(s);
}

export function getTechnique(slug: TechniqueSlug): Technique {
  const t = TECHNIQUES.find((x) => x.slug === slug);
  if (!t) throw new Error(`unknown technique ${slug}`);
  return t;
}
