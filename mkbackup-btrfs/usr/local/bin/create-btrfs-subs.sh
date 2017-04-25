#!/bin/bash

case $1 in
    -h)
        cat <<EOF
 Create a partition with btrfs
 Mount it to a free mountpoint (for example /mnt)
 change directory to this mountpoint (cd /mnt)
 run this script
EOF
        exit 0
        ;;
    *)
        ;;
esac

SUBS="boot-grub-x86_64-efi home opt srv subs usr-local var-cache var-lib-mpd var-lib-named var-log var-opt var-spool var-spool-dovecot var-mail var-tmp var-virutal_machines var-www"
ARCH="amd64"
DIST="stretch"
MAIN="@debian-${DIST}"
ALWAYS="__ALWAYSCURRENT__"
SSD=true

NO=""
RELATIME="rel" #rel or no or empty
if SSD
then
	SSDOPTS=",ssd,discard"
	NO="no"
	RELATIME="no"
fi

BTRFS=/bin/btrfs
AWK=/usr/bin/awk
GREP=/bin/grep
FINDMNT=/bin/findmnt
BLKID=/sbin/blkid
MKDIR=/bin/mkdir
MOUNT=/bin/mount
DEBOOTSTRAP=/usr/sbin/debootstrap
SYSTEMDESCAPE=/bin/systemd-escape

$BTRFS sub create "$MAIN"
$BTRFS sub create "$ALWAYS"

UUID=$($BLKID -s UUID -o value $($FINDMNT|$GREP $(pwd)|$AWK '{print $2}'))

cd "$ALWAYS"
for i in $SUBS
do
	"$BTRFS" sub create "$i"
        #$MKDIR -p "../${MAIN}/$(echo $i|sed 's@-@/@g')"
	#$MOUNT "UUID=${UUID}" "../${MAIN}/$(echo $i|sed 's@-@/@g')" -t btrfs -o "defaults,compress=lzo,${NO}space_cache,${NO}inode_cache,${RELATIME}atime${SSDOPTS},subvol=${ALWAYS}/${i}"
	$MKDIR -p "../${MAIN}/$($SYSTEMDESCAPE -pu $i)"
	$MOUNT "UUID=${UUID}" "../${MAIN}/$($SYSTEMDESCAPE -pu $i)" -t btrfs -o "defaults,compress=lzo,${NO}space_cache,${NO}inode_cache,${RELATIME}atime${SSDOPTS},subvol=${ALWAYS}/${i}"
done
cd ..
mkdir -p "${MAIN}/etc"

echo "UUID=$UUID	/	btrfs	defaults,compress=lzo,${NO}nospace_cache,${NO}inode_cache,${RELATIME}atime${SSDOPTS}	0	0" > "${MAIN}/etc/fstab"
echo "UUID=$UUID	/var/cache/btrfs_pool_SYSTEM	btrfs	defaults,compress=lzo,${NO}space_cache,${NO}inode_cache,${RELATIME}atime${SSDOPTS},subvol=/	0	0" >> "${MAIN}/etc/fstab"

for i in $SUBS
do
	#echo "UUID=$UUID	/$(echo $i|sed 's@-@/@g')	btrfs	defaults,compress=lzo,${NO}space_cache,${NO}inode_cache,${RELATIME}atime${SSDOPTS},subvol=${ALWAYS}/${i}	0	0" >> "${MAIN}/etc/fstab"
	echo "UUID=$UUID	/$($SYSTEMDESCAPE -pu $i)	btrfs	defaults,compress=lzo,${NO}space_cache,${NO}inode_cache,${RELATIME}atime${SSDOPTS},subvol=${ALWAYS}/${i}	0	0" >> "${MAIN}/etc/fstab"
done


cp "${MAIN}/etc/fstab" "${MAIN}/etc/fstab.orig"

cat <<EOF
Now your BTRFS-Subvolumes are created and mounted.
You can now install your system with debootstrap 

Install with debootstrap? [Y/n]
EOF

read i
case i in
    N|n)
        echo "Exit skript"
        ;;
    Y|y) 
        $DEBOOTSTRAP --arch "${ARCH}" "${DIST}" "${MAIN}" http://ftp.at.debian.org/debian

        $MOUNT -o bind /dev "${MAIN}/dev"
        $MOUNT -o bind /dev/pts "${MAIN}/dev/pts"
        $MOUNT -t sysfs /sys "${MAIN}/sys"
        $MOUNT -t proc /proc "${MAIN}/proc"
        cp /proc/mounts "${MAIN}/etc/mtab"
        cp /etc/resolv.conf "${MAIN}/etc/resolv.conf"

        chroot "${MAIN}"
        cat <<EOF 
        You are now in the chroot, groundsystem is now installed. Now install other packages.
        add new users, and add them to several groups
        add grub2 or refind and initramfs
        try apt install linux-image task-desktop task-german-desktop console-setup tzdata
EOF
        ;;
esac




exit 0

#UUID=03d34c21-a150-4e91-8470-a6346d04287a	/			btrfs	defaults,compress=lzo,nospace_cache,inode_cache,relatime,ssd,discard							0	0
#UUID=03d34c21-a150-4e91-8470-a6346d04287a	/boot/grub/x86_64/efi	btrfs	defaults,compress=lzo,nospace_cache,inode_cache,relatime,ssd,discard,subvol=__ALWAYSCURRENT__/boot-grub-x86_64-efi	0	0


