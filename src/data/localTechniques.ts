import type { Technique } from "../types/technique";

export const LOCAL_TECHNIQUES: (Technique & { keywords: string[] })[] = [
  {
    id: "a1111111-1111-4111-8111-111111111101",
    slug: "knife-grip",
    name: "칼 잡는 법",
    description: "칼 손잡이와 손가락 위치를 안정적으로 잡아 기본 칼질을 준비합니다.",
    difficulty: 1,
    estimated_minutes: 5,
    learning_goals: [],
    required_tools: ["칼", "도마"],
    precautions: [],
    stage_number: 1,
    keywords: ["knife", "chop", "dice", "cut"],
  },
  {
    id: "a1111111-1111-4111-8111-111111111102",
    slug: "peel-fruit",
    name: "과일 껍질 벗기기",
    description: "과일과 채소의 껍질을 일정한 두께로 벗깁니다.",
    difficulty: 2,
    estimated_minutes: 8,
    learning_goals: [],
    required_tools: ["칼", "도마"],
    precautions: [],
    stage_number: 2,
    keywords: ["peel", "peeled", "shuck"],
  },
  {
    id: "a1111111-1111-4111-8111-111111111103",
    slug: "julienne",
    name: "채썰기",
    description: "재료를 먼저 편으로 썬 뒤 가늘고 긴 채로 썹니다.",
    difficulty: 2,
    estimated_minutes: 10,
    learning_goals: [],
    required_tools: ["칼", "도마"],
    precautions: [],
    stage_number: 3,
    keywords: ["julienne", "thin strip", "shred"],
  },
  {
    id: "a1111111-1111-4111-8111-111111111104",
    slug: "mince",
    name: "다지기",
    description: "마늘, 파처럼 작게 다져야 하는 재료를 균일하게 다집니다.",
    difficulty: 2,
    estimated_minutes: 8,
    learning_goals: [],
    required_tools: ["칼", "도마"],
    precautions: [],
    stage_number: 4,
    keywords: ["mince", "minced", "finely chop"],
  },
  {
    id: "a1111111-1111-4111-8111-111111111105",
    slug: "slice",
    name: "썰기",
    description: "재료를 먹기 좋은 두께의 편으로 썹니다.",
    difficulty: 1,
    estimated_minutes: 7,
    learning_goals: [],
    required_tools: ["칼", "도마"],
    precautions: [],
    stage_number: 5,
    keywords: ["slice", "sliced", "cut into"],
  },
  {
    id: "a1111111-1111-4111-8111-111111111106",
    slug: "preheat-pan",
    name: "팬 예열하기",
    description: "팬을 미리 달궈 재료가 눌러붙지 않게 준비합니다.",
    difficulty: 1,
    estimated_minutes: 5,
    learning_goals: [],
    required_tools: ["프라이팬"],
    precautions: [],
    stage_number: 6,
    keywords: ["preheat", "heat a skillet", "heat a pan", "hot pan"],
  },
  {
    id: "a1111111-1111-4111-8111-111111111107",
    slug: "stir-fry",
    name: "볶기",
    description: "재료를 넣고 빠르게 섞어 겉은 향이 나고 속은 익게 볶습니다.",
    difficulty: 3,
    estimated_minutes: 12,
    learning_goals: [],
    required_tools: ["프라이팬", "주걱"],
    precautions: [],
    stage_number: 7,
    keywords: ["stir-fry", "stir fry", "saute", "sauté", "fry"],
  },
];

export function inferTechniqueIds(text: string): string[] {
  const haystack = text.toLowerCase();
  return LOCAL_TECHNIQUES.filter((technique) =>
    technique.keywords.some((keyword) => haystack.includes(keyword)),
  ).map((technique) => technique.id);
}

export function getLocalTechnique(id: string) {
  return LOCAL_TECHNIQUES.find((technique) => technique.id === id) ?? null;
}
