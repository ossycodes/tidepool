/** Deterministic covers: no image generation/network needed for a personal shelf. */
export function bookColour(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return ['sea', 'plum', 'ochre', 'forest', 'slate', 'rose'][
    Math.abs(hash) % 6
  ]!;
}
export function bookSize(id: string) {
  return ['short', 'medium', 'tall'][id.charCodeAt(id.length - 1) % 3]!;
}
