import type { LucideIcon } from "lucide-react";
import {
  Apple,
  Carrot,
  ChefHat,
  CookingPot,
  Droplets,
  FlaskConical,
  Grid2x2,
  Layers,
  Salad,
  Soup,
  Utensils,
} from "lucide-react";

const ICONS_BY_SLUG: Record<string, LucideIcon> = {
  "knife-grip": Utensils,
  "peel-fruit": Apple,
  julienne: Carrot,
  mince: Grid2x2,
  "nabak-cut": Layers,
  parboil: Soup,
  "stir-fry": CookingPot,
  boil: Droplets,
  "season-toss": Salad,
  "practice-eval-test": FlaskConical,
};

export function TechniqueIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = ICONS_BY_SLUG[slug] ?? ChefHat;
  return <Icon className={className} strokeWidth={2} aria-hidden />;
}
