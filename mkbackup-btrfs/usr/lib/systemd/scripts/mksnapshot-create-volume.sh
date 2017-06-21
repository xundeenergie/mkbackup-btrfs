#!/bin/bash

# Create udev-rule and mount-entry for new backup-volume

ACTION=$1
case $2 in
	-u)
		UUID=$3
		DEV=$(readlink -f /dev/disk/by-uuid/$UUID)
		PARTUUID="$(blkid /dev/disk/by-uuid/$UUID -o value -s PARTUUID)"
		;;
	u-*)
		UUID=${2#u-}
		DEV=$(readlink -f /dev/disk/by-uuid/$UUID)
		PARTUUID="$(blkid /dev/disk/by-uuid/$UUID -o value -s PARTUUID)"
		;;
	-p)
		PARTUUID=$3
		DEV=$(readlink -f /dev/disk/by-partuuid/$PARTUUID)
		UUID="$(blkid /dev/disk/by-partuuid/$PARTUUID -o value -s UUID)"
		;;
	p-*)
		PARTUUID=${2#p-}
		DEV=$(readlink -f /dev/disk/by-partuuid/$PARTUUID)
		UUID="$(blkid /dev/disk/by-partuuid/$PARTUUID -o value -s UUID)"
		;;
	d-*)
		DEV=${2#d-}
		UUID="$(blkid $DEV -o value -s UUID)"
		PARTUUID="$(blkid $DEV -o value -s PARTUUID)"
		;;
	*)
		DEV="$(/bin/systemd-escape -p -u $2)"
		UUID="$(blkid $DEV -o value -s UUID)"
		#PARTUUID="$(blkid $DEV -o value -s PARTUUID)"
		PRE="d-"
		;;
esac

#DESTUDEV="/tmp/"
#DESTSYSTEMD="/tmp/"
DESTUDEV="/etc/udev/rules.d/"
DESTSYSTEMD="/etc/systemd/system/"

SYSTEMCTL="/bin/systemctl"

echo "$ACTION ${DEV} | ${UUID} | ${PARTUUID}"

sleep 1

if [ "$DEV"x = "x" ] 
then
	TYPE="btrfs"
else
	TYPE="$(blkid $DEV -o value -s TYPE)"
	echo "T $TYPE | $DEV"
fi

if [ "$PARTUUID"x = "x" ]; then
	if [ "$UUID"x = "x" ]; then
		echo "$PARTUUID | $UUID | $DEV is no valid device"
		exit 3
	else
		DUUID="$UUID" #DUUID is uuid which is taken to use
		SUUID="ID_FS_UUID" #SUUID is the string for the udev-rule it's UUID or PARTUUID
		ID="uuid" #ID is also for the udev-rule. To look in /dev/disk/by-uuid or /dev/disk/by-partuuid
		PRE="u-"
	fi
else
	DUUID="$PARTUUID"
	SUUID="ID_PART_ENTRY_UUID"
	ID="partuuid"
	PRE="p-"
fi

#echo "$DUUID | $SUUID | $ID | $PRE"
# Start by udev
start () {

mkdir -p "${DESTSYSTEMD}var-cache-backup.mount.d/"

cat <<EOF > "${DESTSYSTEMD}var-cache-backup.mount.d/source.conf"
[Mount]
What=/dev/disk/by-${ID}/${DUUID}
EOF

$SYSTEMCTL daemon-reload

}

# Create udev-Rule for new external drive
register () {
cat <<EOF > "${DESTUDEV}99-ext-bkp-volume-${PRE}${DUUID}.rules"
ACTION=="add", KERNEL=="sd*", SUBSYSTEMS=="usb", ENV{${SUUID}}=="$DUUID", SYMLINK+="disk/mars", TAG+="systemd", ENV{SYSTEMD_WANTS}+="mkbackup-external@${PRE}${DUUID}.service", ENV{SYSTEMD_WANTS}+="mkbackup@BKP.target", ENV{SYSTEMD_WANTS}+="smartctl-fast@$(/bin/systemd-escape /dev/disk/by-${ID}/${DUUID}).service"

ACTION=="remove", KERNEL=="sd*", SUBSYSTEMS=="usb", ENV{${SUUID}}="$DUUID", \
RUN+="${SYSTEMCTL} --no-block stop mkbackup@BKP.target"

EOF

#echo "ACTION==\"add\", KERNEL==\"sd*\", SUBSYSTEMS==\"usb\", ENV{${SUUID}}==\"$DUUID\", SYMLINK+=\"disk/mars\", TAG+=\"systemd\", ENV{SYSTEMD_WANTS}+=\"mkbackup-external@${PRE}${DUUID}.service\", ENV{SYSTEMD_WANTS}+=\"mkbackup@BKP.target\", ENV{SYSTEMD_WANTS}+=\"smartctl-fast@$(/bin/systemd-escape /dev/disk/by-${ID}/${DUUID}).service\"
#
#ACTION==\"remove\", KERNEL==\"sd*\", SUBSYSTEMS==\"usb\", ENV{${SUUID}}=\"$DUUID\", \
#RUN+=\"${SYSTEMCTL} --no-block stop mkbackup@BKP.target\"" > "${DESTUDEV}99-ext-bkp-volume-${PRE}${DUUID}.rules"
}


# delete udev-rule, if external drive is not longer in use for backups.
unregister () {
[ -e "${DESTUDEV}99-ext-bkp-volume-${PRE}${DUUID}.rules" ] && rm "${DESTUDEV}99-ext-bkp-volume-${PRE}${DUUID}.rules"
}

case $TYPE in
	btrfs)
		;;
	*)
		echo "$DEV isn't a btrfs-filesystem. Exiting"; exit 1;;
esac

case $ACTION in
	register)
		#setup udev-rule for device
		register
		;;
	unregister)
		#delete udev-rule for device
		unregister ;;
	start)
		#activate device 
		start;;
	stop)
		#deactivate device
		stop ;;
	*)
		echo "$ACTION not recognized";
		exit 2;;
esac

$SYSTEMCTL daemon-reload
#/bin/systemctl 
exit 0
