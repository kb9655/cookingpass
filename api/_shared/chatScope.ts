const unrelatedRequestPatterns = [
  /(?:코드|프로그램|스크립트|웹\s*사이트|앱)\s*(?:를|을|좀)?\s*(?:짜|작성|만들|구현|개발)/i,
  /(?:코딩|프로그래밍|파이썬|자바스크립트|타입스크립트)\s*(?:해|으로|코드)/i,
  /(?:역할\s*극|롤\s*플레(?:이|잉))\s*(?:을|를|좀)?\s*(?:해|하자|시작)/i,
  /(?:write|build|create|generate)\s+(?:me\s+)?(?:a\s+)?(?:(?:python|java|javascript|typescript|react)\s+)?(?:code|program|script|website|app)\b/i,
  /(?:role\s*-?\s*play|pretend\s+(?:you\s+are|to\s+be)|act\s+as)\b/i,
  /(?:ignore|reveal|override)\s+(?:all\s+)?(?:previous|system|developer)\s+(?:instructions?|prompts?)/i,
  /(?:이전|시스템|개발자)\s*(?:지침|명령|프롬프트).*(?:무시|공개|덮어)/i,
];

export function isClearlyUnrelatedRequest(text: string): boolean {
  return unrelatedRequestPatterns.some((pattern) => pattern.test(text.trim()));
}
