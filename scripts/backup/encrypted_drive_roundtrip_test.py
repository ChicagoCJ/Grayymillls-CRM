"""Graymills CRM 3.29A: encrypted Google Drive roundtrip using dummy data only.

Existing keys and tokens are read only. Creates a fresh encrypted test object,
downloads and verifies it, then removes only that newly created object.
"""
import hashlib
import io
import os
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload

KEY_FILE = Path("J:/CRM Backup Key/backup-encryption.key")
TOKEN_FILE = Path.home() / "Graymills-Secrets" / "google-drive-token.json"
SCOPE = ["https://www.googleapis.com/auth/drive.file"]
FOLDER_NAME = "Graymills CRM Backups"
FILENAME = "3.29A-encrypted-dummy-roundtrip-test.gmenc"
HEADER = b"GMCRM1"
AAD = b"graymills-crm-backup-v1"
DUMMY = b"Graymills CRM test archive: fictional content only. No CRM records.\n"

def main():
    if not KEY_FILE.is_file():
        raise SystemExit("FAIL: J: encryption key unavailable. No replacement will be generated.")
    key = KEY_FILE.read_bytes()
    if len(key) != 32:
        raise SystemExit("FAIL: working key is not exactly 32 bytes.")
    if not TOKEN_FILE.is_file():
        raise SystemExit("FAIL: Google OAuth token missing.")
    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), scopes=SCOPE)
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            # Don't overwrite existing token automatically in this test.
        else:
            raise SystemExit("FAIL: Google authorization unavailable.")
    nonce = os.urandom(12)
    cipher = HEADER + nonce + AESGCM(key).encrypt(nonce, DUMMY, AAD)
    if DUMMY in cipher:
        raise SystemExit("FAIL: plain text unexpectedly present in encrypted payload.")
    print("Local AES-256-GCM encryption: PASS")
    drive = build("drive", "v3", credentials=creds, cache_discovery=False)
    query = "name = 'Graymills CRM Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    resp = drive.files().list(q=query, fields="nextPageToken,files(id,name)", pageSize=100).execute()
    folders = resp.get("files", [])
    if len(folders) != 1:
        raise SystemExit("FAIL: expected exactly one accessible Graymills CRM Backups folder. No upload attempted.")
    file_id = None
    try:
        media = MediaIoBaseUpload(io.BytesIO(cipher), mimetype="application/octet-stream", resumable=False)
        created = drive.files().create(body={"name": FILENAME, "parents": [folders[0]["id"]]}, media_body=media, fields="id").execute()
        file_id = created["id"]
        print("Encrypted dummy file uploaded: PASS")
        request = drive.files().get_media(fileId=file_id)
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        downloaded = buffer.getvalue()
        if hashlib.sha256(downloaded).digest() != hashlib.sha256(cipher).digest():
            raise RuntimeError("FAIL: uploaded ciphertext differs from downloaded ciphertext.")
        print("Encrypted download integrity: PASS")
        if not downloaded.startswith(HEADER) or len(downloaded) < len(HEADER) + 12 + 16:
            raise RuntimeError("FAIL: invalid encrypted-file structure.")
        start = len(HEADER)
        restored = AESGCM(key).decrypt(downloaded[start:start+12], downloaded[start+12:], AAD)
        if restored != DUMMY:
            raise RuntimeError("FAIL: restored content does not match original dummy archive.")
        print("Decrypt and restore original content: PASS")
        try:
            AESGCM(AESGCM.generate_key(bit_length=256)).decrypt(downloaded[start:start+12], downloaded[start+12:], AAD)
        except ValueError:
            print("Wrong key rejected: PASS")
        except Exception:
            print("Wrong key rejected: PASS")
        else:
            raise RuntimeError("FAIL: wrong key unexpectedly decrypted payload.")
        print("SUCCESS: encrypted Google Drive backup/restore roundtrip verified.")
    finally:
        if file_id:
            try:
                drive.files().delete(fileId=file_id).execute()
                print("Temporary encrypted test file deleted.")
            except Exception as exc:
                print("WARNING: temporary test object could not be deleted; please inspect backup folder.")
                print(type(exc).__name__)

if __name__ == "__main__":
    main()
