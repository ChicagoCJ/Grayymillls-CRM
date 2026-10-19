"""3.29A — generate a private AES-256 key and round-trip dummy data locally.

No CRM records or network operations. Never prints key contents.
"""
import hashlib
import os
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT = Path.home() / "Graymills-Secrets"
KEY = ROOT / "backup-encryption.key"
DUMMY = b"Graymills CRM encrypted backup test. Fictional sample only.\n"
MAGIC = b"GMCRM1"
AAD = b"graymills-crm-backup-v1"

def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    if KEY.exists():
        raw_key = KEY.read_bytes()
        if len(raw_key) != 32:
            raise SystemExit("Existing key invalid length; stop and investigate. No key overwritten.")
        print("Using existing 256-bit key.")
    else:
        raw_key = AESGCM.generate_key(bit_length=256)
        fd = os.open(KEY, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(raw_key)
        except Exception:
            KEY.unlink(missing_ok=True)
            raise
        print("Generated new private 256-bit encryption key.")
    nonce = os.urandom(12)
    encrypted = MAGIC + nonce + AESGCM(raw_key).encrypt(nonce, DUMMY, AAD)
    assert DUMMY not in encrypted
    if not encrypted.startswith(MAGIC):
        raise RuntimeError("Bad envelope")
    decrypted = AESGCM(raw_key).decrypt(encrypted[len(MAGIC):len(MAGIC)+12],encrypted[len(MAGIC)+12:],AAD)
    if hashlib.sha256(decrypted).digest() != hashlib.sha256(DUMMY).digest():
        raise RuntimeError("Decryption/integrity mismatch")
    try:
        AESGCM(AESGCM.generate_key(bit_length=256)).decrypt(nonce, encrypted[len(MAGIC)+12:], AAD)
    except Exception:
        print("Wrong-key rejection: passed.")
    else:
        raise RuntimeError("Unexpected decryption with wrong key")
    print("AES-256-GCM encrypt/decrypt: passed.")
    print("SHA-256 roundtrip verification: passed.")
    print("Encryption key stored at:", KEY)
    print("IMPORTANT: Make an offline recovery copy of this key; never upload it with backups.")
    print("No CRM data accessed and no file uploaded.")

if __name__ == "__main__":
    main()
