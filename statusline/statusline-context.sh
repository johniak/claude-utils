#!/usr/bin/env bash
# Minimal statusline for Claude Code: context + weekly + session usage.
# CONTEXT: fill = window used %, banded green→orange→red with 1/3 & 2/3 markers.
# WEEK/SESSION: fill = quota used %, colored by PACE (green = under time pace,
#   red = over), with a white │ marker showing how much of the period elapsed.
#   So if the colored fill is left of │ you're under budget; right of it = over.
# All data comes from Claude Code's statusline JSON on stdin (no API calls).

input=$(cat)
RESET='\033[0m'
EMPTY='\033[38;2;75;82;95m'         # slate — unfilled buckets
SEPCOL='\033[38;2;71;85;105m'       # divider
MARK='\033[38;2;255;255;255m'       # white — time-elapsed marker
GREEN='\033[38;2;74;222;128m'
RED='\033[38;2;239;68;68m'
CW=20                                # context bar width
WW=10                                # week bar width
SW=10                                # session bar width
DUR_WEEK=604800                      # 7d in seconds
DUR_SESSION=18000                    # 5h in seconds

# ── pull values from stdin ─────────────────────────────────────────────────
# Fields are joined with \x1f (unit separator), NOT tab: tab is IFS whitespace,
# so bash collapses consecutive tabs and an empty field (e.g. no five_hour
# reset) would shift every later field left.
if command -v jq >/dev/null 2>&1; then
  IFS=$'\x1f' read -r ctx_pct wk_raw wk_reset se_raw se_reset model_name effort < <(printf '%s' "$input" | jq -r '
    [ (.context_window.used_percentage // 0 | floor | tostring),
      ((.rate_limits.seven_day.used_percentage // .rate_limits.seven_day.utilization // "none") | tostring),
      (.rate_limits.seven_day.resets_at // "" | tostring),
      ((.rate_limits.five_hour.used_percentage // .rate_limits.five_hour.utilization // "none") | tostring),
      (.rate_limits.five_hour.resets_at // "" | tostring),
      (.model.display_name // .model.id // "" | tostring),
      (.effort.level // "" | tostring)
    ] | join("\u001f")' 2>/dev/null)
else
  ctx_pct=$(printf '%s' "$input" | grep -o '"used_percentage"[^,}]*' | grep -o '[0-9.]*' | head -1)
  wk_raw="none"; se_raw="none"; model_name=""; effort=""
fi
ctx_pct=${ctx_pct%%.*}; [ -z "$ctx_pct" ] && ctx_pct=0
NOW=$(date +%s)

# ── epoch from epoch-int OR ISO string ────────────────────────────────────
to_epoch() {
  local v="$1"; [ -z "$v" ] && return
  if [[ "$v" =~ ^[0-9]+$ ]]; then printf '%s' "$v"; return; fi
  local clean="${v%.*}"; clean="${clean%Z}"; clean="${clean%%+*}"
  if date --version >/dev/null 2>&1; then date -u -d "${clean}Z" +%s 2>/dev/null
  else date -juf "%Y-%m-%dT%H:%M:%S" "$clean" +%s 2>/dev/null; fi
}

# ── CONTEXT bar: banded thirds ────────────────────────────────────────────
render_bar() {
  local pct=$1 width=$2 i c out=""
  [ "$pct" -lt 0 ] 2>/dev/null && pct=0; [ "$pct" -gt 100 ] 2>/dev/null && pct=100
  local filled=$(( pct * width / 100 ))
  local m1=$(( width / 3 )) m2=$(( 2 * width / 3 ))
  for ((i=1; i<=width; i++)); do
    if   [ "$i" -eq "$m1" ]; then out="${out}\033[38;2;251;146;60m⛁${RESET}"
    elif [ "$i" -eq "$m2" ]; then out="${out}\033[38;2;180;40;40m⛁${RESET}"
    elif [ "$i" -le "$filled" ]; then
      if   [ "$i" -lt "$m1" ]; then c="$GREEN"
      elif [ "$i" -lt "$m2" ]; then c='\033[38;2;251;146;60m'
      else c='\033[38;2;180;40;40m'; fi
      out="${out}${c}⛁${RESET}"
    else out="${out}${EMPTY}⛁${RESET}"; fi
  done
  printf '%s' "$out"
}

# ── USAGE bar: pace color + elapsed-time marker. render_usage <pct> <elapsed%> <width>
render_usage_bar() {
  local pct=$1 elapsed=$2 width=$3 i out=""
  [ "$pct" -lt 0 ] 2>/dev/null && pct=0; [ "$pct" -gt 100 ] 2>/dev/null && pct=100
  [ "$elapsed" -lt 0 ] 2>/dev/null && elapsed=0; [ "$elapsed" -gt 100 ] 2>/dev/null && elapsed=100
  local filled=$(( pct * width / 100 ))
  local mark=$(( elapsed * width / 100 )); [ "$mark" -lt 1 ] && mark=1; [ "$mark" -gt "$width" ] && mark="$width"
  local col="$GREEN"; [ "$pct" -gt "$elapsed" ] && col="$RED"
  for ((i=1; i<=width; i++)); do
    if   [ "$i" -eq "$mark" ]; then out="${out}${MARK}│${RESET}"
    elif [ "$i" -le "$filled" ]; then out="${out}${col}⛁${RESET}"
    else out="${out}${EMPTY}⛁${RESET}"; fi
  done
  printf '%s' "$out"
}

# ── context % color: green<40, amber<60, orange<80, rose>=80 ───────────────
pct_color() {
  local p=${1%%.*}; [ -z "$p" ] && p=0
  if   [ "$p" -ge 80 ]; then printf '\033[38;2;244;63;94m'
  elif [ "$p" -ge 60 ]; then printf '\033[38;2;251;146;60m'
  elif [ "$p" -ge 40 ]; then printf '\033[38;2;251;191;36m'
  else printf '%b' "$GREEN"; fi
}

# ── compact reset label: $2=1 → time-only ─────────────────────────────────
reset_label() {
  local epoch; epoch=$(to_epoch "$1"); local timeonly="${2:-0}"
  [ -z "$epoch" ] || [ "$epoch" -le 0 ] 2>/dev/null && return
  [ "$epoch" -le "$NOW" ] && { printf 'now'; return; }
  local rtime; rtime=$(date -r "$epoch" +%H:%M 2>/dev/null || date -d "@$epoch" +%H:%M 2>/dev/null)
  if [ "$timeonly" = "1" ]; then printf '%s' "$rtime"; return; fi
  local rday today; rday=$(date -r "$epoch" +%Y-%m-%d 2>/dev/null || date -d "@$epoch" +%Y-%m-%d 2>/dev/null)
  today=$(date +%Y-%m-%d)
  if [ "$rday" = "$today" ]; then printf 'TODAY %s' "$rtime"
  else local dow; dow=$(date -r "$epoch" +%a 2>/dev/null || date -d "@$epoch" +%a 2>/dev/null)
    printf '%s %s' "$(printf '%s' "$dow" | tr '[:lower:]' '[:upper:]')" "$rtime"; fi
}

# ── usage_segment <label> <lcol> <raw%> <reset> <width> <timeonly> <dur> ───
usage_segment() {
  local label="$1" lcol="$2" raw="$3" rst="$4" width="$5" timeonly="$6" dur="$7"
  [ -z "$raw" ] || [ "$raw" = "none" ] || [ "$raw" = "null" ] && return
  local p=${raw%%.*}; [ -z "$p" ] && p=0
  # elapsed % of the period: (dur - (reset - now)) / dur
  local elapsed=50 epoch; epoch=$(to_epoch "$rst")
  if [ -n "$epoch" ] && [ "$epoch" -gt 0 ] 2>/dev/null; then
    local remain=$(( epoch - NOW )); [ "$remain" -lt 0 ] && remain=0
    elapsed=$(( (dur - remain) * 100 / dur ))
  fi
  local bar reset seg
  bar=$(render_usage_bar "$p" "$elapsed" "$width")
  local pcol="$GREEN"; [ "$p" -gt "$elapsed" ] && pcol="$RED"
  seg=$(printf "%b%s${RESET} %b %b%s%%${RESET}%b│%b%b%s%%${RESET}" "$lcol" "$label" "$bar" "$pcol" "$p" "$SEPCOL" "$RESET" "$MARK" "$elapsed")
  reset=$(reset_label "$rst" "$timeonly")
  [ -n "$reset" ] && seg="${seg} $(printf '\033[38;2;148;163;184m⟳ %s\033[0m' "$reset")"
  printf '  %b│%b  %s' "$SEPCOL" "$RESET" "$seg"
}

# ── assemble ──────────────────────────────────────────────────────────────
ctx_bar=$(render_bar "$ctx_pct" "$CW")
out=""
if [ -n "$model_name" ]; then
  out=$(printf "\033[38;2;203;213;225m%s${RESET}" "$model_name")
  [ -n "$effort" ] && out="${out}$(printf " \033[38;2;100;116;139m·\033[0m \033[38;2;148;163;184m%s\033[0m" "$effort")"
  out="${out}  ${SEPCOL}│${RESET}  "
fi
out="${out}$(printf "🧠 %b $(pct_color "$ctx_pct")%s%%${RESET}" "$ctx_bar" "$ctx_pct")"
out="${out}$(usage_segment WEEK    '\033[38;2;194;139;62m' "$wk_raw" "$wk_reset" "$WW" 0 "$DUR_WEEK")"
out="${out}$(usage_segment SESSION '\033[38;2;125;211;252m' "$se_raw" "$se_reset" "$SW" 1 "$DUR_SESSION")"

printf '%b\n' "$out"
