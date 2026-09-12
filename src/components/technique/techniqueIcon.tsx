import type { LucideIcon } from "lucide-react";
import {
  Apple,
  Carrot,
  ChefHat,
  CookingPot,
  Flame,
  FlaskConical,
  Grid2x2,
  Layers,
  Utensils,
} from "lucide-react";

const ICONS_BY_SLUG: Record<string, LucideIcon> = {
  "knife-grip": Utensils,
  "peel-fruit": Apple,
  julienne: Carrot,
  mince: Grid2x2,
  slice: Layers,
  "preheat-pan": Flame,
  "stir-fry": CookingPot,
  "practice-eval-test": FlaskConical,
};

export function TechniqueIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = ICONS_BY_SLUG[slug] ?? ChefHat;
  return <Icon className={className} strokeWidth={2} aria-hidden />;
}
