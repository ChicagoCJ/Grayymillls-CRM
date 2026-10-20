"""3.29A - upload and independently verify the first encrypted PostgreSQL backup.

Only encrypted bytes are uploaded. Downloads ciphertext into memory, verifies
SHA-256 and decrypts in memory using the existing J: key. Leaves uploaded backup
on Drive. No Supabase access and never touches the source dump.
"""
import hashlib
import io
from datetime import datetime, timezone
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload

SOURCE = Path(r"C:\Graymills-CRM-Backup-Staging\graymills-first-test.dump.gmenc")
KEY = Path("J:/CRM Backup Key/backup-encryption.key")
TOKEN = Path.home() / "Graymills-Secrets" / "google-drive-token.json"
FOLDER = "Graymills CRM Backups"
MAGIC = b"GMCRM1"
AAD = b"graymills-crm-backup-v1"

def main():
    if not all(p.is_file() for p in (SOURCE, KEY, TOKEN)):
        raise SystemExit("Missing encrypted backup, working key, or Drive token.")
    key = KEY.read_bytes()
    if len(key) != 32:
        raise SystemExit("Invalid key size. No key regenerated.")
    encrypted = SOURCE.read_bytes()
    if not encrypted.startswith(MAGIC) or len(encrypted) < 34:
        raise SystemExit("Unrecognized encrypted-backup format.")
    pos = len(MAGIC)
    original = AESGCM(key).decrypt(encrypted[pos:pos+12], encrypted[pos+12:], AAD)
    if not original.startswith(b"PGDMP"):
        raise SystemExit("Decrypted payload is not a PostgreSQL custom-format dump.")
    digest = hashlib.sha256(encrypted).hexdigest()
    creds = Credentials.from_authorized_user_file(str(TOKEN), ["https://www.googleapis.com/auth/drive.file"])
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            raise SystemExit("Google Drive authorization expired or invalid.")
    drive = build("drive", "v3", credentials=creds, cache_discovery=False)
    folders = []
    page_token = None
    while True:
        result = drive.files().list(q="name = 'Graymills CRM Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",fields="nextPageToken,files(id,name)",pageSize=100,pageToken=page_token).execute()
        folders.extend(result.get("files", []))
        page_token = result.get("nextPageToken")
        if not page_token:
            break
    if len(folders) != 1:
        raise SystemExit("Expected exactly one accessible Graymills CRM Backups folder; no upload attempted.")
    name = "graymills-db-first-test-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + ".dump.gmenc"
    media = MediaIoBaseUpload(io.BytesIO(encrypted),mimetype="application/octet-stream",resumable=False)
    created = drive.files().create(body={"name":name,"parents":[folders[0]["id"]]},media_body=media,fields="id,name,size").execute()
    print("Encrypted backup uploaded:", created["name"])
    request = drive.files().get_media(fileId=created["id"])
    result_bytes = io.BytesIO()
    downloader = MediaIoBaseDownload(result_bytes, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    received = result_bytes.getvalue()
    if hashlib.sha256(received).hexdigest() != digest:
        raise RuntimeError("FAIL: downloaded ciphertext hash does not match uploaded file.")
    print("Downloaded encrypted backup SHA-256: PASS")
    restored = AESGCM(key).decrypt(received[pos:pos+12],received[pos+12:],AAD)
    if hashlib.sha256(restored).digest() != hashlib.sha256(original).digest():
        raise RuntimeError("FAIL: decrypted PostgreSQL backup mismatch.")
    print("Download, decrypt and compare PostgreSQL dump: PASS")
    print("SUCCESS: encrypted backup retained in Google Drive for recovery testing.")
    print("No plaintext database dump uploaded; no changes made to Supabase.")

if __name__ == "__main__":
    main()
