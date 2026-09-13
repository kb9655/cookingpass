---
name: loading-animation
description: Adds a short branded CSS splash or spinner for first-load and route waits. Use when adding loading animation, PageLoader, 로딩, splash, or bouncing orbs, and when choosing between a loader and a skeleton.
---

# Loading Animation

Use a short CSS loader for first paint and route data waits. Keep skeletons for list placeholders after the content shape is known.

## Related skills

- `ui-ux-pro-max`: run `python scripts/search.py "loading animation" --domain ux`
- Figma motion to code: `figma-implement-motion` plus `get_motion_context`

## App pattern (Cooking Pass)

Use `PageLoader` from `src/components/common/Feedback.tsx`.

```tsx
{loading ? <PageLoader label={t("pageLoading")} /> : <Content />}
```

Rules:

- Three bouncing accent orbs, 720ms, staggered delays
- Honor `prefers-reduced-motion` (already on `.page-loader-orb`)
- Do not add Lottie or generated images
- Do not block the whole app shell; keep header and tabs visible
- Copy keys: `pageLoading` in `src/i18n/messages.ts`

## When not to use

- Inline form submit: disable the button and change its label
- Known card grids after first load: `CardSkeleton` is fine
