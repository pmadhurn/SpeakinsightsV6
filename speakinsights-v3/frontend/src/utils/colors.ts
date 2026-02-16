const AVATAR_COLORS = [
  '#22D3EE', // cyan
  '#A78BFA', // lavender
  '#34D399', // emerald
  '#FB923C', // orange
  '#F472B6', // pink
  '#60A5FA', // blue
  '#FBBF24', // amber
  '#A3E635', // lime
  '#E879F9', // fuchsia
  '#2DD4BF', // teal
];

/**
 * Get deterministic avatar color from name
 */
export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit int
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

/**
 * Get avatar background with reduced opacity
 */
export function getAvatarBg(name: string, opacity = 0.2): string {
  const color = getAvatarColor(name);
  // Convert hex to rgb
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Get sentiment color
 */
export function getSentimentColor(score: number): string {
  if (score >= 0.3) return '#34D399';  // positive = green
  if (score <= -0.3) return '#F87171'; // negative = red
  return '#FBBF24';                     // neutral = amber
}
