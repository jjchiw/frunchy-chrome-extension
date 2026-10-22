#!/usr/bin/env bash
# Uploads a zip to an existing Chrome Web Store item and submits it for review.
#
# Usage: publish-chrome.sh <zip>
#
# Required environment:
#   CHROME_PUBLISHER_ID, CHROME_EXTENSION_ID   the item to update
#   CHROME_CLIENT_ID, CHROME_CLIENT_SECRET     the OAuth client (Web application)
#   CHROME_REFRESH_TOKEN                       refresh token for scope
#                                              https://www.googleapis.com/auth/chromewebstore
# Optional environment:
#   PUBLISH_TYPE   DEFAULT_PUBLISH (default) or STAGED_PUBLISH
#   VERSION        if set, the uploaded package's version must equal it
#   TOKEN_URL, API_BASE, POLL_SECONDS
#                  test-only: point the script at a fake server and poll faster
#
# Calls the Chrome Web Store API v2: https://developer.chrome.com/docs/webstore/using-api
# Needs bash, curl and jq. It never prints secrets: they are masked in GitHub Actions,
# the token request and the Authorization header travel on stdin instead of in the
# process arguments, and a token response is never printed.
set -euo pipefail

TOKEN_URL="${TOKEN_URL:-https://oauth2.googleapis.com/token}"
API_BASE="${API_BASE:-https://chromewebstore.googleapis.com}"
PUBLISH_TYPE="${PUBLISH_TYPE:-DEFAULT_PUBLISH}"
VERSION="${VERSION:-}"
POLL_SECONDS="${POLL_SECONDS:-10}"

fail() {
    echo "error: $*" >&2
    exit 1
}

[ "$#" -eq 1 ] || fail "usage: publish-chrome.sh <zip>"
zip="$1"
[ -f "$zip" ] || fail "zip not found: $zip"

for name in CHROME_PUBLISHER_ID CHROME_EXTENSION_ID CHROME_CLIENT_ID CHROME_CLIENT_SECRET CHROME_REFRESH_TOKEN; do
    [ -n "${!name:-}" ] || fail "$name is empty or not set"
done
case "$PUBLISH_TYPE" in
    DEFAULT_PUBLISH | STAGED_PUBLISH) ;;
    *) fail "PUBLISH_TYPE must be DEFAULT_PUBLISH or STAGED_PUBLISH" ;;
esac

# Mask before any network call.
if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    echo "::add-mask::$CHROME_CLIENT_ID"
    echo "::add-mask::$CHROME_CLIENT_SECRET"
    echo "::add-mask::$CHROME_REFRESH_TOKEN"
fi

item="publishers/$CHROME_PUBLISHER_ID/items/$CHROME_EXTENSION_ID"

# 1. Access token. jq reads the secrets from the environment and the form body goes
# to curl on stdin, so neither appears in any process arguments.
export CHROME_CLIENT_ID CHROME_CLIENT_SECRET CHROME_REFRESH_TOKEN
token_response=$(
    jq -rn '[
        "client_id=" + ($ENV.CHROME_CLIENT_ID | @uri),
        "client_secret=" + ($ENV.CHROME_CLIENT_SECRET | @uri),
        "refresh_token=" + ($ENV.CHROME_REFRESH_TOKEN | @uri),
        "grant_type=refresh_token"
    ] | join("&")' |
        curl --fail-with-body -sS -X POST "$TOKEN_URL" \
            -H "Content-Type: application/x-www-form-urlencoded" \
            --data-binary @- 2>/dev/null
) || fail "could not get an access token (check the OAuth client and the refresh token)"
access_token=$(printf '%s' "$token_response" | jq -r '.access_token // empty' 2>/dev/null) || access_token=""
unset token_response
[ -n "$access_token" ] || fail "the token response had no access_token"
if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    echo "::add-mask::$access_token"
fi

# Calls the API with the Authorization header given to curl as a config on stdin.
api() {
    local method="$1" url="$2"
    shift 2
    printf 'header = "Authorization: Bearer %s"\n' "$access_token" |
        curl --fail-with-body -sS --config - -X "$method" "$url" "$@"
}

# 2. Upload. API responses hold no secrets, so errors may print them.
response=$(api POST "$API_BASE/upload/v2/$item:upload" \
    -H "Content-Type: application/zip" --data-binary @"$zip") ||
    fail "upload failed: $response"
state=$(printf '%s' "$response" | jq -r '.uploadState // empty')
crx_version=$(printf '%s' "$response" | jq -r '.crxVersion // empty')

if [ "$state" = "IN_PROGRESS" ]; then
    echo "Upload is processing, waiting for it"
    for _ in $(seq 1 30); do
        sleep "$POLL_SECONDS"
        response=$(api GET "$API_BASE/v2/$item:fetchStatus") || fail "status check failed: $response"
        state=$(printf '%s' "$response" | jq -r '.lastAsyncUploadState // empty')
        [ "$state" = "IN_PROGRESS" ] || break
    done
    crx_version=$(printf '%s' "$response" | jq -r '.crxVersion // empty')
fi
if [ "$state" != "SUCCEEDED" ]; then
    echo "$response" >&2
    fail "upload did not succeed (state: ${state:-unknown})"
fi
echo "Uploaded ${crx_version:-$zip}"

# 3. The uploaded package must be the version we meant to release.
if [ -n "$VERSION" ] && [ -n "$crx_version" ] && [ "$crx_version" != "$VERSION" ]; then
    fail "uploaded version $crx_version, expected $VERSION"
fi

# 4. Submit for review.
body=$(jq -n --arg type "$PUBLISH_TYPE" '{publishType: $type}')
response=$(api POST "$API_BASE/v2/$item:publish" \
    -H "Content-Type: application/json" --data "$body") ||
    fail "publish failed: $response"
state=$(printf '%s' "$response" | jq -r '.state // empty')
printf '%s' "$response" | jq -r '.warningInfo.warnings[]? | "warning: \(.reason): \(.description)"'
case "$state" in
    PENDING_REVIEW | STAGED | PUBLISHED | PUBLISHED_TO_TESTERS)
        echo "Submitted: $state"
        ;;
    *)
        echo "$response" >&2
        fail "unexpected publish state: ${state:-unknown}"
        ;;
esac
