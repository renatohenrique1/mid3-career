async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashPassword(password: string, salt: string) {
  // Salt so identical passwords don't share hashes.
  return sha256(`${salt.toLowerCase()}::${password}`)
}

export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

/** Chave estável para login/unicidade (case-insensitive). */
export function nameKey(name: string) {
  return normalizeName(name).toLowerCase()
}

/** Mantido para contas antigas que usavam username. */
export function normalizeUsername(username: string) {
  return username.trim().toLowerCase()
}
