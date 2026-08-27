export type TechniqueSlug = "serve" | "return" | "third-shot-drop" | "third-shot-drive"
  | "dink" | "volley" | "reset" | "lob" | "overhead" | "erne" | "atp" | "footwork";
export type Technique = { slug: TechniqueSlug; nameVi: string; nameEn: string; query: string; queryVi: string };
export const TECHNIQUES: readonly Technique[] = [
  { slug: "serve", nameVi: "Giao bóng", nameEn: "Serve", query: "pickleball serve tutorial", queryVi: "hướng dẫn giao bóng pickleball" },
  { slug: "return", nameVi: "Trả giao bóng", nameEn: "Return of serve", query: "pickleball return of serve tutorial", queryVi: "hướng dẫn trả giao bóng pickleball" },
  { slug: "third-shot-drop", nameVi: "Bóng thứ ba thả", nameEn: "Third shot drop", query: "pickleball third shot drop tutorial", queryVi: "hướng dẫn third shot drop pickleball" },
  { slug: "third-shot-drive", nameVi: "Bóng thứ ba đánh mạnh", nameEn: "Third shot drive", query: "pickleball third shot drive tutorial", queryVi: "hướng dẫn third shot drive pickleball" },
  { slug: "dink", nameVi: "Dink", nameEn: "Dink", query: "pickleball dink tutorial", queryVi: "hướng dẫn dink pickleball" },
  { slug: "volley", nameVi: "Volley", nameEn: "Volley", query: "pickleball volley tutorial", queryVi: "hướng dẫn volley pickleball" },
  { slug: "reset", nameVi: "Reset bóng", nameEn: "Reset", query: "pickleball reset shot tutorial", queryVi: "hướng dẫn reset bóng pickleball" },
  { slug: "lob", nameVi: "Lốp bóng", nameEn: "Lob", query: "pickleball lob tutorial", queryVi: "hướng dẫn lốp bóng pickleball" },
  { slug: "overhead", nameVi: "Đập bóng trên đầu", nameEn: "Overhead / Smash", query: "pickleball overhead smash tutorial", queryVi: "hướng dẫn đập bóng smash pickleball" },
  { slug: "erne", nameVi: "Erne", nameEn: "Erne", query: "pickleball erne tutorial", queryVi: "hướng dẫn erne pickleball" },
  { slug: "atp", nameVi: "ATP (đánh vòng cột)", nameEn: "Around the post", query: "pickleball around the post ATP tutorial", queryVi: "hướng dẫn ATP đánh vòng cột pickleball" },
  { slug: "footwork", nameVi: "Di chuyển & lên lưới", nameEn: "Footwork / Transition", query: "pickleball footwork transition zone tutorial", queryVi: "hướng dẫn di chuyển footwork pickleball" },
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
