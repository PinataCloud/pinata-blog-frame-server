import { Context } from "hono";

export async function verifyGhostSignature(c: Context, payload: string, signature: string | undefined): Promise<boolean> {
  if (!signature) return false;

  // Parse the signature header
  const [hashValue, timestamp] = signature.split(', ');
  if (!hashValue || !timestamp) return false;

  const [algorithm, hash] = hashValue.split('=');
  const [, ts] = timestamp.split('=');

  if (algorithm !== 'sha256' || !hash || !ts) return false;

  // Create encoder for the payload
  const encoder = new TextEncoder();

  // Import the webhook secret as a CryptoKey
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(c.env.GHOST_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Calculate expected signature
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );

  // Convert the signature to hex string
  const expectedHash = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Verify hash matches and timestamp is recent (within 5 minutes)
  const timeDiff = Math.abs(Date.now() - parseInt(ts));
  const isRecent = timeDiff < 5 * 60 * 1000; // 5 minutes

  return hash === expectedHash && isRecent;
}
