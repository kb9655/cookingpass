export type RecipeParserId = "title-category-json-arrays";

export type RecipeDataset = {
  id: string;
  file: string;
  parser: RecipeParserId;
};

export const RECIPE_DATASETS: RecipeDataset[] = [
  {
    id: "demo-20",
    file: "/datasets/demo_recipes_20.csv",
    parser: "title-category-json-arrays",
  },
];
