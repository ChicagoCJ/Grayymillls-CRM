"""Graymills CRM 3.29A - encrypt and verify an existing pg_dump archive locally.

File format: GMCRM1 (6 bytes) + random 12-byte nonce + AES-256-GCM ciphertext/tag.
Compatible with the earlier dummy Drive round-trip test. Small-file approach:
loads dump into memory; replace with streaming encryption for larger backups.
No network calls, no changes to the source dump, no key generation.
"""
import hashlib
import os
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

SOURCE = Path(r"C:\Graymills-CRM-Backup-Staging\graymills-first-test.dump")
TARGET = Path(r"C:\Graymills-CRM-Backup-Staging\graymills-first-test.dump.gmenc")
KEY = Path("J:/CRM Backup Key/backup-encryption.key")
MAGIC = b"GMCRM1"
AAD = b"graymills-crm-backup-v1"
MAX_SIZE = 100 * 1024 * 1024

def main():
    if not SOURCE.is_file():
        raise SystemExit(f"Missing source dump: {SOURCE}")
    if TARGET.exists():
        raise SystemExit(f"Encrypted target already exists; refusing to overwrite: {TARGET}")
    if not KEY.is_file():
        raise SystemExit(f"Working encryption key unavailable: {KEY}")
    key = KEY.read_bytes()
    if len(key) != 32:
        raise SystemExit("Existing encryption key must be 32 bytes; no key changed.")
    if SOURCE.stat().st_size > MAX_SIZE:
        raise SystemExit("Source exceeds 100 MiB; streaming implementation required.")
    plain = SOURCE.read_bytes()
    if not plain.startswith(b"PGDMP"):
        raise SystemExit("Source does not appear to be a PostgreSQL custom-format dump.")
    nonce = os.urandom(12)
    ciphertext = MAGIC + nonce + AESGCM(key).encrypt(nonce, plain, AAD)
    # x mode prevents overwriting existing encrypted backup
    with TARGET.open("xb") as out:
        out.write(ciphertext)
    saved = TARGET.read_bytes()
    if saved != ciphertext:
        raise SystemExit("ERROR: saved encrypted file does not match generated data.")
    recovered = AESGCM(key).decrypt(saved[len(MAGIC):len(MAGIC)+12], saved[len(MAGIC)+12:], AAD)
    if hashlib.sha256(recovered).digest() != hashlib.sha256(plain).digest():
        raise SystemExit("ERROR: restored content differs from the PostgreSQL dump.")
    print("AES-256-GCM encryption: PASS")
    print("Encrypted file read-back: PASS")
    print("SHA-256 decryption roundtrip: PASS")
    print("Plaintext source preserved:", SOURCE)
    print("Encrypted output:", TARGET)
    print("Source size (bytes):", len(plain))
    print("Encrypted size (bytes):", len(saved))
    print("No key changes, Google Drive uploads, or Supabase changes performed.")

if __name__ == "__main__":
    main()
