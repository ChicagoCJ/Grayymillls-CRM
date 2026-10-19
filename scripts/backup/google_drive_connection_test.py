"""Safe Google Drive upload/download smoke test; uses no CRM data."""
import hashlib
import io
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload

SCOPE = "https://www.googleapis.com/auth/drive.file"
TOKEN = Path.home() / "Graymills-Secrets" / "google-drive-token.json"
FOLDER_NAME = "Graymills CRM Backups"
TEST_NAME = "graymills-drive-connection-test.txt"
TEST_CONTENT = b"Graymills CRM Backup Google Drive connection test. No customer data.\n"

def main():
    if not TOKEN.is_file():
        raise SystemExit("Authorization token missing; rerun A3.4.")
    creds = Credentials.from_authorized_user_file(str(TOKEN), scopes=[SCOPE])
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            TOKEN.write_text(creds.to_json(), encoding="utf-8")
        else:
            raise SystemExit("Authorization invalid; repeat OAuth authorization.")
    drive = build("drive", "v3", credentials=creds, cache_discovery=False)
    escaped = FOLDER_NAME.replace("\\", "\\\\").replace("'", "\\'")
    result = drive.files().list(q=f"name = '{escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false", fields="files(id,name),nextPageToken", page_size=100).execute()
    folders = result.get("files", [])
    if len(folders) > 1:
        raise SystemExit("Multiple matching backup folders found. Resolve ambiguity before upload.")
    if folders:
        folder_id = folders[0]["id"]
        print("Using existing app-accessible backup folder.")
    else:
        folder = drive.files().create(body={"name": FOLDER_NAME, "mimeType": "application/vnd.google-apps.folder"}, fields="id").execute()
        folder_id = folder["id"]
        print("Created dedicated backup folder.")
    created_id = None
    try:
        media = MediaIoBaseUpload(io.BytesIO(TEST_CONTENT), mimetype="text/plain", resumable=False)
        result = drive.files().create(body={"name": TEST_NAME, "parents": [folder_id]}, media_body=media, fields="id,name,size").execute()
        created_id = result["id"]
        request = drive.files().get_media(fileId=created_id)
        downloaded = io.BytesIO()
        downloader = MediaIoBaseDownload(downloaded, request)
        finished = False
        while not finished:
            _, finished = downloader.next_chunk()
        actual = downloaded.getvalue()
        if hashlib.sha256(actual).digest() != hashlib.sha256(TEST_CONTENT).digest():
            raise SystemExit("FAILED: uploaded and downloaded content differ.")
        print("SUCCESS: uploaded and downloaded test content match (SHA-256).")
        print("No CRM/customer data used.")
    finally:
        if created_id:
            try:
                drive.files().delete(fileId=created_id).execute()
                print("Temporary test file deleted.")
            except Exception:
                print("Warning: could not delete temporary test file; remove it from the Drive folder.")

if __name__ == "__main__":
    main()
