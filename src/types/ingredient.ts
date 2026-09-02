export type Ingredient = {
  id: string;
  name: string;
  default_unit: string;
  category: string;
};

export type RecipeIngredient = {
  ingredient_id: string;
  name: string;
  amount: number;
  unit: string;
  notes: string | null;
  category: string;
};

export type UserIngredient = {
  id: string;
  ingredient_id: string;
  name: string;
  amount: number;
  unit: string;
  expires_at: string | null;
  created_at: string;
  category: string;
  default_unit: string;
};
