// IDs use crypto.randomUUID(). Always string. Stored as keyPath in IDB.
export function uid(): string {
  return crypto.randomUUID()
}