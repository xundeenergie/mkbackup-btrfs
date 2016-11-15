#!/bin/sh

DEVICE="$1"; shift
ACTION="$1"; shift
MAINPID="$1"

[ x"$MAINPID" = "x" ] && exit 0
/bin/ps h -o command -p "$MAINPID" && /sbin/btrfs $ACTION cancel "$DEVICE" || exit 0
