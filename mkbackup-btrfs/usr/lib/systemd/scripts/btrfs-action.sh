#!/bin/sh

DEVICE="$1"; shift
ACTION="$1"; shift
MAINPID="$1"
BTRFS=/bin/btrfs

[ x"$MAINPID" = "x" ] && exit 0
/bin/ps h -o command -p "$MAINPID" && $BTRFS $ACTION cancel "$DEVICE" || exit 0
