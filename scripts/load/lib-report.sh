#!/usr/bin/env bash
# Shared latency/status report for FORGE load-test-*.sh scripts.
# Usage: forge_load_report <raw_output_file> [evidence_file] [title]
# Raw lines: "<http_code> <time_total_seconds>"

forge_load_report() {
  local raw_file="${1:?raw file required}"
  local evidence_file="${2:-}"
  local title="${3:-FORGE load test}"
  local api_url="${FORGE_API_URL:-}"
  local iterations="${ITERATIONS:-}"
  local concurrency="${CONCURRENCY:-}"

  local report
  report=$(awk '
    {
      code = $1
      t = $2 + 0
      c[code]++
      if (t > 0) {
        times[++n] = t
        sum += t
      }
    }
    function percentile(p,    idx) {
      if (n < 1) return 0
      idx = int((p / 100) * n)
      if (idx < 1) idx = 1
      if (idx > n) idx = n
      return times[idx]
    }
    END {
      print "=== HTTP status counts ==="
      for (k in c) print k, c[k]
      if (n < 1) {
        print "=== Latency ==="
        print "no successful timing samples"
        exit 0
      }
      for (i = 1; i <= n; i++) {
        for (j = i + 1; j <= n; j++) {
          if (times[j] < times[i]) {
            tmp = times[i]; times[i] = times[j]; times[j] = tmp
          }
        }
      }
      print "=== Latency (seconds) ==="
      printf "samples %d\n", n
      printf "avg %.4f\n", sum / n
      printf "p50 %.4f\n", percentile(50)
      printf "p95 %.4f\n", percentile(95)
      printf "p99 %.4f\n", percentile(99)
      printf "max %.4f\n", times[n]
    }
  ' "$raw_file")

  echo "$report"

  if [[ -n "$evidence_file" ]]; then
    mkdir -p "$(dirname "$evidence_file")"
    {
      echo "# $title"
      echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
      echo "api: ${api_url}"
      echo "iterations: ${iterations}"
      echo "concurrency: ${concurrency}"
      echo
      echo "$report"
    } >"$evidence_file"
    echo "Wrote evidence → $evidence_file"
  fi
}
