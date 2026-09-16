type TechniqueGuideImage = {
  src: string;
  alt: string;
};

const GUIDE_IMAGES_BY_SLUG: Record<string, TechniqueGuideImage> = {
  "knife-grip": {
    src: "/images/lessons/guides/knife-grip-guide.png",
    alt: "칼 손잡이와 재료를 안전하게 잡는 자세 안내",
  },
  julienne: {
    src: "/images/lessons/guides/julienne-guide.png",
    alt: "재료를 가늘고 길게 채 써는 네 단계 안내",
  },
  "nabak-cut": {
    src: "/images/lessons/guides/nabak-cut-guide.png",
    alt: "재료를 납작하고 네모나게 나박 써는 네 단계 안내",
  },
  parboil: {
    src: "/images/lessons/guides/parboil-guide.png",
    alt: "끓는 물에 재료를 넣어 삶고 건지는 네 단계 안내",
  },
  "stir-fry": {
    src: "/images/lessons/guides/stir-fry-guide.png",
    alt: "팬을 예열하고 재료를 빠르게 볶는 네 단계 안내",
  },
};

export function getTechniqueGuideImage(slug: string): TechniqueGuideImage | null {
  return GUIDE_IMAGES_BY_SLUG[slug] ?? null;
}
