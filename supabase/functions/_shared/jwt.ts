import { create, getNumericDate, verify } from "https://deno.land/x/djwt@v2.8/mod.ts";

const encoder = new TextEncoder();

export async function jwtKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signAdminToken(adminId: number, secret: string): Promise<string> {
  const key = await jwtKey(secret);
  return create(
    { alg: "HS256", typ: "JWT" },
    { sub: String(adminId), exp: getNumericDate(60 * 60 * 24 * 7) },
    key,
  );
}

export async function verifyAdminToken(token: string, secret: string): Promise<{ sub: string }> {
  const key = await jwtKey(secret);
  const payload = await verify(token, key);
  return payload as { sub: string };
}
