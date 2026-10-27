#!/usr/bin/env bash
# Uploads a zip to an existing Microsoft Edge Add-ons product and submits it for certification.
#
# Usage: publish-edge.sh <zip>
#
# Required environment:
#   EDGE_PRODUCT_ID                the product's id (Partner Center, the extension's overview)
#   EDGE_CLIENT_ID, EDGE_API_KEY   the API credentials from Partner Center, Publish API
# Optional environment:
#   CERT_NOTES   a file with notes for the certification testers (default
#                store/edge/certification-notes.md; an empty note is sent if it doesn't exist)
#   API_BASE, POLL_SECONDS
#                test-only: point the script at a fake server and poll faster
#
# Calls the Edge Add-ons Update API v1.1:
# https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api
# Needs bash, curl and jq. It never prints secrets: they are masked in GitHub Actions, and the
# two credential headers travel to curl as a config on stdin instead of in the process
# arguments. API responses hold no secrets, so errors may print them.
#
# The product must already exist: the first version is submitted by hand (store/edge/README.md).
set -euo pipefail

API_BASE="${API_BASE:-https://api.addons.microsoftedge.microsoft.com}"
CERT_NOTES="${CERT_NOTES:-store/edge/certification-notes.md}"
POLL_SECONDS="${POLL_SECONDS:-10}"

fail() {
    echo "error: $*" >&2
    exit 1
}

[ "$#" -eq 1 ] || fail "usage: publish-edge.sh <zip>"
zip="$1"
[ -f "$zip" ] || fail "zip not found: $zip"

for name in EDGE_PRODUCT_ID EDGE_CLIENT_ID EDGE_API_KEY; do
    [ -n "${!name:-}" ] || fail "$name is empty or not set"
done

# Mask before any network call.
if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    echo "::add-mask::$EDGE_CLIENT_ID"
    echo "::add-mask::$EDGE_API_KEY"
fi

# curl writes the response headers here, to read the operation id from `Location`.
headers_file=$(mktemp "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/publish-edge.XXXXXX")
trap 'rm -f "$headers_file"' EXIT

# Calls the API and sets $status and $body. curl gets both credential headers as a config on
# stdin (printf is a builtin, so the values never reach an argument list).
status=""
body=""
call() {
    local method="$1" url="$2" out
    shift 2
    : >"$headers_file"
    out=$(printf 'header = "Authorization: ApiKey %s"\nheader = "X-ClientID: %s"\n' \
        "$EDGE_API_KEY" "$EDGE_CLIENT_ID" |
        curl -sS --config - -X "$method" "$url" -D "$headers_file" -w '\n%{http_code}' "$@") ||
        fail "could not reach $url"
    status="${out##*$'\n'}"
    body="${out%$'\n'*}"
}

# Fails unless the last call answered 2xx. $1 says what was being done.
expect_ok() {
    case "$status" in
        2??) ;;
        401 | 403) fail "$1: Edge refused the credentials (HTTP $status); check EDGE_CLIENT_ID and EDGE_API_KEY. API keys expire: renew it in Partner Center (Publish API): $body" ;;
        *) fail "$1 failed (HTTP $status): $body" ;;
    esac
}

# A field of the last response ($1 is a jq filter); empty if it is missing or the body isn't JSON.
field() { printf '%s' "$body" | jq -r "$1 // empty" 2>/dev/null || true; }

# The operation id of a 202 answer: the last path segment of `Location` (it may be the id alone
# or a full URL).
operation_id() {
    local location
    location=$(tr -d '\r' <"$headers_file" | awk 'tolower($1) == "location:" { print $2 }' | tail -n 1)
    location="${location%/}"
    printf '%s' "${location##*/}"
}

# Polls an operation ($1) until it stops being InProgress. Leaves its response in $body and its
# status in $op_status; fails if it doesn't finish in time.
op_status=""
wait_for() {
    op_status=""
    for _ in $(seq 1 60); do
        call GET "$1"
        expect_ok "status check"
        op_status=$(field '.status')
        [ "$op_status" = "InProgress" ] || return 0
        sleep "$POLL_SECONDS"
    done
    fail "Edge did not finish the operation in time"
}

# Prints the message, error code and errors of a failed operation.
print_failure() {
    local message code
    message=$(field '.message')
    code=$(field '.errorCode')
    [ -z "$message" ] || echo "message: $message" >&2
    [ -z "$code" ] || echo "errorCode: $code" >&2
    printf '%s' "$body" | jq -r '.errors[]? | if type == "string" then . else (.message // tostring) end | "error detail: \(.)"' >&2 || true
}

product="$API_BASE/v1/products/$EDGE_PRODUCT_ID/submissions"

# 1. Upload the package to the draft.
call POST "$product/draft/package" -H "Content-Type: application/zip" --data-binary @"$zip"
expect_ok "upload"
op=$(operation_id)
[ -n "$op" ] || fail "the upload response had no Location header: $body"
echo "Uploaded $zip, waiting for Edge to process it"

# 2. Wait for the upload to be processed.
wait_for "$product/draft/package/operations/$op"
case "$op_status" in
    Succeeded) echo "Processed the upload" ;;
    Failed)
        print_failure
        fail "Edge rejected the upload"
        ;;
    *) fail "unexpected upload status: ${op_status:-unknown}: $body" ;;
esac

# 3. Submit the draft for certification, with the notes for the testers.
if [ -f "$CERT_NOTES" ]; then
    notes=$(jq -Rs '{notes: .}' "$CERT_NOTES")
else
    echo "No certification notes at $CERT_NOTES, sending an empty note"
    notes='{"notes":""}'
fi
call POST "$product" -H "Content-Type: application/json" --data "$notes"
expect_ok "submitting for certification"
op=$(operation_id)
[ -n "$op" ] || fail "the submission response had no Location header: $body"

# 4. Wait for the submission.
wait_for "$product/operations/$op"
case "$op_status" in
    Succeeded) echo "Submitted for certification: $(field '.message')" ;;
    Failed)
        print_failure
        case "$(field '.errorCode')" in
            InProgressSubmission) fail "a previous version is still in certification; re-run this job when it ends" ;;
            NoModulesUpdated) fail "this package was already submitted" ;;
            CreateNotAllowed) fail "the product has no submitted version yet; submit the first version by hand (store/edge/README.md)" ;;
            *) fail "Edge did not accept the submission" ;;
        esac
        ;;
    *) fail "unexpected submission status: ${op_status:-unknown}: $body" ;;
esac
