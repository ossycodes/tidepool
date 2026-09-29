// Links to a reader's public reading list (/shared/:id).

export function shareUrl(shareId: string): string {
  return `${window.location.origin}/shared/${shareId}`
}

/** Copies text to the clipboard; false when the browser won't allow it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
