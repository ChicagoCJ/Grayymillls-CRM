"""One-time Google Drive OAuth authorization for Graymills CRM Backup.

Requires: pip install google-auth-oauthlib google-api-python-client
Never commit the generated token. This helper does not upload CRM data.
"""
from pathlib import Path
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SECRETS = Path.home() / "Graymills-Secrets"
CLIENT_FILE = SECRETS / "google-oauth-client.json"
TOKEN_FILE = SECRETS / "google-drive-token.json"
SCOPES = ["https://www.googleapis.com/auth/drive.file"]

def main():
    if not CLIENT_FILE.is_file():
        raise SystemExit(f"Missing OAuth client file: {CLIENT_FILE}")
    if TOKEN_FILE.exists():
        raise SystemExit(f"Token file already exists: {TOKEN_FILE}. No overwrite performed.")
    flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_FILE), scopes=SCOPES)
    credentials = flow.run_local_server(host="localhost", port=0, open_browser=True, authorization_prompt_message="Open this URL to authorize the Graymills backup utility: {url}", access_type="offline", prompt="consent")
    if not credentials.refresh_token:
        raise SystemExit("Google did not return a refresh token; no credential saved.")
    SECRETS.mkdir(parents=True, exist_ok=True)
    TOKEN_FILE.write_text(credentials.to_json(), encoding="utf-8")
    try:
        import os
        os.chmod(TOKEN_FILE, 0o600)
    except OSError:
        pass
    service = build("drive", "v3", credentials=credentials, cache_discovery=False)
    info = service.about().get(fields="user(displayName,emailAddress)").execute()
    user = info.get("user", {})
    print("Authorization succeeded.")
    print("Authorized account:", user.get("emailAddress", "unknown"))
    print("Token saved outside GitHub to:", TOKEN_FILE)
    print("No CRM backup files were uploaded or accessed.")

if __name__ == "__main__":
    main()
