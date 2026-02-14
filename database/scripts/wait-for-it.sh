#!/bin/sh
# wait-for-it.sh
# Usage: ./wait-for-it.sh <HOST>:<PORT> [-t timeout]

# ANSI escape codes for colors
RED='\e[31m'
GREEN='\e[32m'
YELLOW='\e[33m'
BLUE='\e[34m'
NC='\e[0m' # No Color

if [ $# -lt 1 ]; then
  echo -e "${RED}❌ Usage: $0 <HOST>:<PORT> [-t timeout]${NC}"
  exit 1
fi

TARGET=$1
shift

HOST=$(echo "$TARGET" | cut -d: -f1)
PORT=$(echo "$TARGET" | cut -d: -f2)
TIMEOUT=30

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t)
      shift
      TIMEOUT=$1
      shift
      ;;
    *)
      shift
      ;;
  esac
done

echo -e "${BLUE}⌛ Waiting for ${YELLOW}$HOST:$PORT${BLUE} to be available (timeout ${TIMEOUT}s)...${NC}"
START_TIME=$(date +%s)

while true; do
  if nc -z "$HOST" "$PORT" 2>/dev/null; then
    echo -e "${GREEN}✅ $HOST:$PORT is available!${NC}"
    break
  fi

  NOW=$(date +%s)
  ELAPSED=$(( NOW - START_TIME ))
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    echo -e "${RED}❌ Timeout after ${TIMEOUT}s waiting for $HOST:$PORT.${NC}"
    exit 1
  fi

  sleep 1
done

exit 0
