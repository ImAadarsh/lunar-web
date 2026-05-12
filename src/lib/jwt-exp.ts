/** Decode JWT payload `exp` (seconds since epoch) without verifying the signature. */
export function readJwtExpiresAt(accessToken: string): number | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    const payloadJson = base64UrlToUtf8(parts[1]);
    const payload = JSON.parse(payloadJson) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function base64UrlToUtf8(segment: string): string {
  const pad = segment.length % 4 === 0 ? "" : "=".repeat(4 - (segment.length % 4));
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
