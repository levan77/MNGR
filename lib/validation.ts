// E.164-style phone: optional +, 8–15 digits
export function isValidPhone(phone: string): boolean {
  return /^\+?[1-9]\d{7,14}$/.test(phone.replace(/\s/g, ''));
}

// At least two space-separated tokens, each 2+ chars
export function isValidName(name: string): boolean {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 && parts.every(p => p.length >= 2);
}

export function formatPhone(phone: string): string {
  return phone.replace(/\s/g, '');
}
