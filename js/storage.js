const PREFIX = 'equinox:draft:';

export async function hashText(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function getDraft(file) {
  try {
    const draft = JSON.parse(localStorage.getItem(PREFIX + file));
    return draft && draft.file === file && Array.isArray(draft.rooms) && typeof draft.baseHash === 'string'
      ? draft : null;
  } catch {
    return null;
  }
}

export function saveDraft(file, baseHash, rooms) {
  try {
    localStorage.setItem(PREFIX + file, JSON.stringify({ file, baseHash, rooms, savedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(file) {
  try {
    localStorage.removeItem(PREFIX + file);
  } catch {
    // storage unavailable
  }
}
