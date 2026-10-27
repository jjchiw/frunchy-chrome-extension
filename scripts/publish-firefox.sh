#!/usr/bin/env bash
# Uploads a zip to an existing add-on on addons.mozilla.org (AMO) and submits it for review.
#
# Usage: publish-firefox.sh <zip> <source zip>
#
# Required environment:
#   AMO_JWT_ISSUER, AMO_JWT_SECRET   the API credentials from
#                                    https://addons.mozilla.org/developers/addon/api/key/
# Optional environment:
#   VERSION          if set, the uploaded package's version must equal it
#   ADDON_ID         the add-on's id (default frunchy@lacalabaza.xyz)
#   APPROVAL_NOTES   a file with notes for the reviewers (default store/firefox/approval-notes.md;
#                    skipped if it doesn't exist)
#   API_BASE, POLL_SECONDS
#                    test-only: point the script at a fake server and poll faster
#
# Calls the AMO API v5: https://mozilla.github.io/addons-server/topics/api/
# Needs bash, curl, jq and openssl. It never prints secrets: they are masked in GitHub Actions,
# and neither the secret nor a token appears in any process's arguments. The token is signed
# (HMAC-SHA256, by its definition) with printf, a bash builtin, and `openssl dgst` reading
# stdin, because `openssl dgst -hmac "$secret"` would put the secret in argv. The Authorization
# header travels to curl as a config on stdin. API responses hold no secrets, so errors may
# print them.
#
# The add-on must already exist: the first listed version is submitted by hand
# (store/firefox/README.md).
set -euo pipefail

API_BASE="${API_BASE:-https://addons.mozilla.org}"
ADDON_ID="${ADDON_ID:-frunchy@lacalabaza.xyz}"
APPROVAL_NOTES="${APPROVAL_NOTES:-store/firefox/approval-notes.md}"
VERSION="${VERSION:-}"
POLL_SECONDS="${POLL_SECONDS:-10}"

fail() {
    echo "error: $*" >&2
    exit 1
}

[ "$#" -eq 2 ] || fail "usage: publish-firefox.sh <zip> <source zip>"
zip="$1"
source_zip="$2"
[ -f "$zip" ] || fail "zip not found: $zip"
[ -f "$source_zip" ] || fail "source zip not found: $source_zip"

for name in AMO_JWT_ISSUER AMO_JWT_SECRET; do
    [ -n "${!name:-}" ] || fail "$name is empty or not set"
done

# Mask before any network call.
mask() {
    if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
        echo "::add-mask::$1"
    fi
}
mask "$AMO_JWT_ISSUER"
mask "$AMO_JWT_SECRET"

# jq reads the issuer from the environment, so it stays out of its arguments.
export AMO_JWT_ISSUER

hex() { od -An -v -tx1 | tr -d ' \n'; }
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

# HMAC-SHA256 by its definition: sha256((K ^ opad) || sha256((K ^ ipad) || message)), where K is
# the key zero-padded to the 64-byte block (hashed first if it is longer). The pads are kept as
# `\xNN` strings, since a bash variable can't hold a NUL byte, and written out by printf.
key_hex=$(printf '%s' "$AMO_JWT_SECRET" | hex)
if [ "${#key_hex}" -gt 128 ]; then
    key_hex=$(printf '%s' "$AMO_JWT_SECRET" | openssl dgst -sha256 -binary | hex)
fi
while [ "${#key_hex}" -lt 128 ]; do
    key_hex="${key_hex}00"
done
ipad=""
opad=""
for ((i = 0; i < 128; i += 2)); do
    byte=$((16#${key_hex:i:2}))
    printf -v esc '\\x%02x' $((byte ^ 0x36))
    ipad="$ipad$esc"
    printf -v esc '\\x%02x' $((byte ^ 0x5c))
    opad="$opad$esc"
done
unset key_hex byte esc

# The signature of $1, base64url.
sign() {
    {
        printf '%b' "$opad"
        { printf '%b' "$ipad"; printf '%s' "$1"; } | openssl dgst -sha256 -binary
    } | openssl dgst -sha256 -binary | b64url
}

# A new token (valid for 60 seconds; AMO allows up to 5 minutes) for every request.
jwt() {
    local now header claims
    now=$(date +%s)
    header=$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | b64url)
    claims=$(jq -cjn --arg jti "$(openssl rand -hex 16)" --argjson iat "$now" \
        '{iss: $ENV.AMO_JWT_ISSUER, jti: $jti, iat: $iat, exp: ($iat + 60)}' | b64url)
    printf '%s.%s.%s' "$header" "$claims" "$(sign "$header.$claims")"
}

# Calls the API and sets $status and $body. curl gets the Authorization header as a config on stdin.
status=""
body=""
call() {
    local method="$1" url="$2" token out
    shift 2
    token=$(jwt)
    mask "$token"
    out=$(printf 'header = "Authorization: JWT %s"\n' "$token" |
        curl -sS --config - -X "$method" "$url" -w '\n%{http_code}' "$@") ||
        fail "could not reach $url"
    status="${out##*$'\n'}"
    body="${out%$'\n'*}"
}

# Fails unless the last call answered 2xx. $1 says what was being done.
expect_ok() {
    case "$status" in
        2??) ;;
        401 | 403) fail "$1: AMO refused the credentials (HTTP $status); check AMO_JWT_ISSUER and AMO_JWT_SECRET: $body" ;;
        *) fail "$1 failed (HTTP $status): $body" ;;
    esac
}

# A field of the last response ($1 is a jq filter); empty if it is missing or the body isn't JSON.
field() { printf '%s' "$body" | jq -r "$1 // empty" 2>/dev/null || true; }

api="$API_BASE/api/v5/addons"

# 1. Upload.
call POST "$api/upload/" -F "upload=@$zip" -F channel=listed
expect_ok "upload"
uuid=$(field '.uuid')
[ -n "$uuid" ] || fail "the upload response had no uuid: $body"
echo "Uploaded $zip, waiting for AMO to validate it"

# 2. Wait for the validation.
processed=""
for _ in $(seq 1 60); do
    call GET "$api/upload/$uuid/"
    expect_ok "status check"
    processed=$(field '.processed')
    [ "$processed" != "true" ] || break
    sleep "$POLL_SECONDS"
done
[ "$processed" = "true" ] || fail "AMO did not finish validating the upload in time"
if [ "$(field '.valid')" != "true" ]; then
    printf '%s' "$body" | jq -r '.validation.messages[]? | "\(.type): \(.message) (\(.file // "no file"))"' >&2 || true
    fail "AMO rejected the upload"
fi
upload_version=$(field '.version')
echo "Validated ${upload_version:-$zip}"

# 3. The uploaded package must be the version we meant to release.
if [ -n "$VERSION" ] && [ "$upload_version" != "$VERSION" ]; then
    fail "uploaded version ${upload_version:-unknown}, expected $VERSION"
fi

# 4. Create the version with its source code. The source can only be sent as multipart.
call POST "$api/addon/$ADDON_ID/versions/" -F "upload=$uuid" -F "source=@$source_zip"
if [ "$status" = "404" ]; then
    fail "the add-on doesn't exist on AMO yet; submit the first version by hand (store/firefox/README.md)"
fi
expect_ok "creating the version"
version=$(field '.version')
[ -n "$version" ] || version="$upload_version"
file_status=$(field '.file.status')

# 5. Notes for the reviewers. They aren't a multipart field of the version call.
if [ -f "$APPROVAL_NOTES" ]; then
    notes=$(jq -Rs '{approval_notes: .}' "$APPROVAL_NOTES")
    call PATCH "$api/addon/$ADDON_ID/versions/$version/" \
        -H "Content-Type: application/json" --data "$notes"
    case "$status" in
        2??)
            notes_status=$(field '.file.status')
            file_status="${notes_status:-$file_status}"
            ;;
        *) fail "version $version was created, but its approval notes were not saved (HTTP $status): $body. Add them in the developer hub" ;;
    esac
else
    echo "No approval notes at $APPROVAL_NOTES, skipping them"
fi

echo "Submitted $version for review${file_status:+ (file status: $file_status)}"
