"use client";

import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Uses the same derivation path convention as Phantom/Solflare (BIP44, Solana coin
 * type 501, all path segments hardened as required by ed25519/SLIP-0010) so a seed
 * phrase generated here can be imported into those wallets and produce the same
 * address, and vice versa.
 */
export function derivationPath(accountIndex = 0): string {
  return `m/44'/501'/${accountIndex}'/0'`;
}

export function generateMnemonic(wordCount: 12 | 24 = 12): string {
  const strength = wordCount === 24 ? 256 : 128;
  return bip39.generateMnemonic(strength);
}

export function isValidMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic.trim());
}

export function keypairFromMnemonic(mnemonic: string, accountIndex = 0): Keypair {
  const seed = bip39.mnemonicToSeedSync(mnemonic.trim());
  const { key } = derivePath(derivationPath(accountIndex), seed.toString("hex"));
  return Keypair.fromSeed(new Uint8Array(key));
}

export function keypairFromPrivateKey(privateKeyBase58: string): Keypair {
  const decoded = bs58.decode(privateKeyBase58.trim());
  return Keypair.fromSecretKey(decoded);
}

export function exportPrivateKeyBase58(keypair: Keypair): string {
  return bs58.encode(keypair.secretKey);
}

// ---------- Password-based encryption (Web Crypto, browser-native, no dependency) ----------

interface EncryptedBlob {
  cipherB64: string;
  saltB64: string;
  ivB64: string;
}

function toB64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function fromB64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 150_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptSecret(plaintext: string, password: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt);
  const enc = new TextEncoder();
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    enc.encode(plaintext) as BufferSource
  );
  return {
    cipherB64: toB64(new Uint8Array(cipherBuf)),
    saltB64: toB64(salt),
    ivB64: toB64(iv),
  };
}

export async function decryptSecret(blob: EncryptedBlob, password: string): Promise<string> {
  const salt = fromB64(blob.saltB64);
  const iv = fromB64(blob.ivB64);
  const key = await deriveAesKey(password, salt);
  const cipherBuf = fromB64(blob.cipherB64);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    cipherBuf as BufferSource
  );
  return new TextDecoder().decode(plainBuf);
  // Throws (DOMException: OperationError) if the password is wrong — callers should
  // catch this and show "incorrect password" rather than a raw error.
}

export type { EncryptedBlob };
