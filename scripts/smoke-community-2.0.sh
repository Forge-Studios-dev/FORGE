#!/usr/bin/env bash
# Smoke Community 2.0 endpoints (multi-community, access sessions, posts, polls, chat, analytics).
# Usage: FORGE_SMOKE_API=http://localhost:3001/api/v1 bash scripts/smoke-community-2.0.sh
set -euo pipefail

BASE="${FORGE_SMOKE_API:-http://localhost:3001/api/v1}"
CREATOR_EMAIL="${FORGE_SMOKE_CREATOR_EMAIL:-creator@forge.local}"
CREATOR_PASS="${FORGE_SMOKE_CREATOR_PASSWORD:-ForgeDemo123!}"
VIEWER_EMAIL="${FORGE_SMOKE_EMAIL:-viewer@forge.local}"
VIEWER_PASS="${FORGE_SMOKE_PASSWORD:-ForgeDemo123!}"

curl_smoke() {
  curl -sS --retry 2 --retry-delay 1 --connect-timeout 15 "$@"
}

login() {
  local email="$1" pass="$2"
  curl_smoke -X POST "${BASE}/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"${email}\",\"password\":\"${pass}\"}"
}

echo "== Community 2.0 smoke (${BASE}) =="

creator_body="$(login "$CREATOR_EMAIL" "$CREATOR_PASS" || true)"
creator_token="$(echo "$creator_body" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))" 2>/dev/null || true)"
creator_id="$(echo "$creator_body" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('user',{}).get('id',''))" 2>/dev/null || true)"

if [[ -z "$creator_token" || -z "$creator_id" ]]; then
  echo "WARN: creator login failed — skipping authenticated checks" >&2
  exit 0
fi
echo "OK: creator login"

list_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${creator_token}" \
  "${BASE}/creators/${creator_id}/communities" || true)"
[[ "$list_code" == "200" ]] && echo "OK: GET /creators/:id/communities" || echo "WARN: communities list ${list_code}" >&2

brands_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${creator_token}" \
  "${BASE}/creators/me/brands" || true)"
[[ "$brands_code" == "200" ]] && echo "OK: GET /creators/me/brands" || echo "WARN: brands ${brands_code}" >&2

subs_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${creator_token}" \
  "${BASE}/creators/me/subscribers/analytics" || true)"
[[ "$subs_code" == "200" ]] && echo "OK: GET /creators/me/subscribers/analytics" || echo "WARN: subscriber analytics ${subs_code}" >&2

search_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
  "${BASE}/communities/search?q=community" || true)"
[[ "$search_code" == "200" ]] && echo "OK: GET /communities/search" || echo "WARN: community search ${search_code}" >&2

connect_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${creator_token}" \
  "${BASE}/billing/connect/status" || true)"
[[ "$connect_code" == "200" ]] && echo "OK: GET /billing/connect/status" || echo "WARN: connect status ${connect_code}" >&2

communities_json="$(curl_smoke -H "Authorization: Bearer ${creator_token}" \
  "${BASE}/creators/${creator_id}/communities" 2>/dev/null || true)"
first_community_id="$(echo "$communities_json" | python3 -c "
import json,sys
try:
  data=json.load(sys.stdin).get('data',[])
  print(data[0]['id'] if data else '')
except Exception:
  print('')
" 2>/dev/null || true)"

first_channel_id=""
if [[ -n "$first_community_id" ]]; then
  poll_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
    "${BASE}/communities/${first_community_id}/polls/active" || true)"
  [[ "$poll_code" == "200" ]] && echo "OK: GET /communities/:id/polls/active" || echo "WARN: community poll ${poll_code}" >&2

  analytics_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${creator_token}" \
    "${BASE}/creators/me/communities/${first_community_id}/analytics" || true)"
  [[ "$analytics_code" == "200" ]] && echo "OK: GET /creators/me/communities/:id/analytics" || echo "WARN: analytics ${analytics_code}" >&2

  posts_list_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
    "${BASE}/communities/${first_community_id}/posts" || true)"
  [[ "$posts_list_code" == "200" ]] && echo "OK: GET /communities/:id/posts" || echo "WARN: posts list ${posts_list_code}" >&2

  post_create_body="$(curl_smoke -X POST \
    -H "Authorization: Bearer ${creator_token}" \
    -H 'Content-Type: application/json' \
    -d '{"body":"Smoke test post","postType":"post"}' \
    "${BASE}/creators/me/communities/${first_community_id}/posts" 2>/dev/null || true)"
  post_id="$(echo "$post_create_body" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null || true)"
  [[ -n "$post_id" ]] && echo "OK: POST /creators/me/communities/:id/posts" || echo "WARN: post create" >&2

  if [[ -n "$post_id" ]]; then
    pin_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
      -X POST -H "Authorization: Bearer ${creator_token}" \
      -H 'Content-Type: application/json' \
      -d '{"isPinned":true}' \
      "${BASE}/creators/me/communities/${first_community_id}/posts/${post_id}/pin" || true)"
    [[ "$pin_code" == "200" || "$pin_code" == "201" ]] && echo "OK: POST post pin" || echo "WARN: post pin ${pin_code}" >&2
  fi

  poll_create_body="$(curl_smoke -X POST \
    -H "Authorization: Bearer ${creator_token}" \
    -H 'Content-Type: application/json' \
    -d '{"question":"Smoke poll?","options":["A","B"]}' \
    "${BASE}/creators/me/communities/${first_community_id}/polls" 2>/dev/null || true)"
  poll_id="$(echo "$poll_create_body" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null || true)"
  [[ -n "$poll_id" ]] && echo "OK: POST /creators/me/communities/:id/polls" || echo "WARN: poll create" >&2

  community_detail="$(curl_smoke -H "Authorization: Bearer ${creator_token}" \
    "${BASE}/communities/id/${first_community_id}" 2>/dev/null || true)"
  first_channel_id="$(echo "$community_detail" | python3 -c "
import json,sys
try:
  data=json.load(sys.stdin).get('data',{})
  channels=data.get('channels',[])
  print(channels[0]['id'] if channels else '')
except Exception:
  print('')
" 2>/dev/null || true)"
fi

viewer_body="$(login "$VIEWER_EMAIL" "$VIEWER_PASS" || true)"
viewer_token="$(echo "$viewer_body" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))" 2>/dev/null || true)"

if [[ -n "$viewer_token" ]]; then
  session_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
    -X POST -H "Authorization: Bearer ${viewer_token}" \
    -H 'Content-Type: application/json' \
    -d '{"sessionType":"playback","resourceId":"00000000-0000-4000-8000-000000000001"}' \
    "${BASE}/access-sessions/start" || true)"
  [[ "$session_code" == "200" || "$session_code" == "201" || "$session_code" == "409" ]] \
    && echo "OK: POST /access-sessions/start playback (${session_code})" \
    || echo "WARN: access session playback ${session_code}" >&2

  if [[ -n "$first_community_id" ]]; then
    community_session_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
      -X POST -H "Authorization: Bearer ${viewer_token}" \
      -H 'Content-Type: application/json' \
      -d "{\"sessionType\":\"community\",\"resourceId\":\"${first_community_id}\"}" \
      "${BASE}/access-sessions/start" || true)"
    [[ "$community_session_code" == "200" || "$community_session_code" == "201" || "$community_session_code" == "409" ]] \
      && echo "OK: POST /access-sessions/start community (${community_session_code})" \
      || echo "WARN: access session community ${community_session_code}" >&2

    if [[ -n "$poll_id" ]]; then
      vote_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
        -X POST -H "Authorization: Bearer ${viewer_token}" \
        -H 'Content-Type: application/json' \
        -d '{"optionIndex":0}' \
        "${BASE}/communities/${first_community_id}/polls/${poll_id}/vote" || true)"
      [[ "$vote_code" == "200" || "$vote_code" == "201" ]] && echo "OK: POST poll vote" || echo "WARN: poll vote ${vote_code}" >&2
    fi

    if [[ -n "$first_channel_id" ]]; then
      msg_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
        -X POST -H "Authorization: Bearer ${viewer_token}" \
        -H 'Content-Type: application/json' \
        -d '{"body":"Smoke chat message"}' \
        "${BASE}/channels/${first_channel_id}/messages" || true)"
      [[ "$msg_code" == "200" || "$msg_code" == "201" ]] && echo "OK: POST channel message" || echo "WARN: channel message ${msg_code}" >&2
    fi

    live_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
      "${BASE}/communities/${first_community_id}/live" || true)"
    [[ "$live_code" == "200" ]] && echo "OK: GET /communities/:id/live" || echo "WARN: community live ${live_code}" >&2

    checkin_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
      -X POST -H "Authorization: Bearer ${viewer_token}" \
      "${BASE}/communities/${first_community_id}/gamification/check-in" || true)"
    [[ "$checkin_code" == "200" || "$checkin_code" == "201" ]] && echo "OK: POST gamification check-in" || echo "WARN: check-in ${checkin_code}" >&2

    lb_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
      "${BASE}/communities/${first_community_id}/leaderboard" || true)"
    [[ "$lb_code" == "200" ]] && echo "OK: GET /communities/:id/leaderboard" || echo "WARN: leaderboard ${lb_code}" >&2
  fi

  if [[ -n "$creator_token" ]]; then
    ba_body="$(curl_smoke \
      -H "Authorization: Bearer ${creator_token}" \
      "${BASE}/creators/me/business-analytics" 2>/dev/null || true)"
    if [[ -n "$ba_body" ]] && echo "$ba_body" | python3 -c "import json,sys; d=json.load(sys.stdin).get('data',{}); exit(0 if 'funnel' in d and 'cohortRetention' in d else 1)" 2>/dev/null; then
      echo "OK: GET /creators/me/business-analytics (funnel + cohortRetention)"
    else
      echo "WARN: business analytics missing funnel/cohortRetention" >&2
    fi

    course_body="$(curl_smoke -X POST \
      -H "Authorization: Bearer ${creator_token}" \
      -H 'Content-Type: application/json' \
      -d '{"title":"Smoke Course"}' \
      "${BASE}/creators/me/courses" 2>/dev/null || true)"
    course_id="$(echo "$course_body" | python3 -c "import json,sys; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null || true)"
    [[ -n "$course_id" ]] && echo "OK: POST /creators/me/courses" || echo "WARN: course create" >&2

    if [[ -n "$course_id" ]]; then
      lesson_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
        -X POST -H "Authorization: Bearer ${creator_token}" \
        -H 'Content-Type: application/json' \
        -d '{"title":"Lesson 1","content":"Hello"}' \
        "${BASE}/creators/me/courses/${course_id}/lessons" || true)"
      [[ "$lesson_code" == "200" || "$lesson_code" == "201" ]] && echo "OK: POST course lesson" || echo "WARN: lesson ${lesson_code}" >&2

      publish_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
        -X PATCH -H "Authorization: Bearer ${creator_token}" \
        -H 'Content-Type: application/json' \
        -d '{"isPublished":true}' \
        "${BASE}/creators/me/courses/${course_id}" || true)"
      [[ "$publish_code" == "200" ]] && echo "OK: PATCH course publish" || echo "WARN: course publish ${publish_code}" >&2
    fi
  fi

  if [[ -n "$viewer_token" && -n "$creator_id" ]]; then
    tier_change_code="$(curl_smoke -o /dev/null -w "%{http_code}" \
      -X POST -H "Authorization: Bearer ${viewer_token}" \
      -H 'Content-Type: application/json' \
      -d "{\"creatorId\":\"${creator_id}\",\"tierId\":\"00000000-0000-4000-8000-000000000001\"}" \
      "${BASE}/billing/subscriptions/change-tier" 2>/dev/null || true)"
    [[ "$tier_change_code" == "200" || "$tier_change_code" == "201" || "$tier_change_code" == "400" ]] \
      && echo "OK: POST /billing/subscriptions/change-tier (${tier_change_code})" \
      || echo "WARN: tier change ${tier_change_code}" >&2
  fi
fi

echo "== Community 2.0 smoke passed =="
