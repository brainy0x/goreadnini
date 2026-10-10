// pin.js — the Haven's PIN is a simple lock to keep casual eyes out; it doesn't encrypt the writing.
// The PIN is also kept in the private synced profile so it can be shown again if forgotten.

const toHex = (bytes) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')

export async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`)
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
}

export async function makePinRecord(pin) {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(12)))
  return { salt, hash: await hashPin(pin, salt), pin, len: pin.length }
}

export async function checkPin(pin, record) {
  if (!record?.hash || !record?.salt) return false
  return (await hashPin(pin, record.salt)) === record.hash
}
