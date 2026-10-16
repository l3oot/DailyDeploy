export const MOOD_KEYS = ["sad", "confused", "smile", "happy", "very_happy"] as const;

export type MoodKey = (typeof MOOD_KEYS)[number];

export const MOOD_SCORES: Record<MoodKey, number> = {
  sad: 1,
  confused: 2,
  smile: 3,
  happy: 4,
  very_happy: 5,
};

export function isMoodKey(value: string): value is MoodKey {
  return (MOOD_KEYS as readonly string[]).includes(value);
}
