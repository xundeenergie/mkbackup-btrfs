#!/bin/bash

SUBS="boot-grub-x86_64-efi home opt srv subs usr-local var-cache var-lib-mpd var-lib-named var-log var-opt var-spool var-spool-dovecot var-tmp var-virutal_machines var-www"
MAIN=@debian
ALWAYS=__ALWAYSCURRENT__
SSHOPTS=",ssd,discard"

BTRFS=/bin/btrfs
AWK=/usr/bin/gawk
GREP=/bin/grep
FINDMNT=/bin/findmnt
BLKID=/sbin/blkid
MKDIR=/bin/mkdir
MOUNT=/bin/mount
DEBOOTSTRAP=/usr/sbin/debootstrap

$BTRFS sub create "$MAIN"
$BTRFS sub create "$ALWAYS"

UUID=$($BLKID -s UUID -o value $($FINDMNT|$GREP $(pwd)|$AWK '{print $2}'))

cd "$ALWAYS"
for i in $SUBS
do
	"$BTRFS" sub create "$i"
	$MKDIR -p "../${MAIN}/$(echo $i|sed 's@-@/@g')"
	$MOUNT "UUID=${UUID}" "../${MAIN}/$(echo $i|sed 's@-@/@g')" -t btrfs -o "defaults,compress=lzo,nospace_cache,inode_cache,relatime${SSHOPTS},subvol=${ALWAYS}/${i}"
done
cd ..
mkdir -p "${MAIN}/etc"

echo "UUID=$UUID	/	btrfs	defaults,compress=lzo,nospace_cache,inode_cache,relatime${SSHOPTS}	0	0" > "${MAIN}/etc/fstab"

for i in $SUBS
do
	echo "UUID=$UUID	/$(echo $i|sed 's@-@/@g')	btrfs	defaults,compress=lzo,nospace_cache,inode_cache,relatime${SSHOPTS},subvol=${ALWAYS}/${i}	0	0" >> "${MAIN}/etc/fstab"
done
cp "${MAIN}/etc/fstab" "${MAIN}/etc/fstab.orig"

$DEBOOTSTRAP --arch amd64 jessie "${MAIN}" http://ftp.at.debian.org/debian

$MOUNT -o bind /dev "${MAIN}/dev"
$MOUNT -o bind /dev/pts "${MAIN}/dev/pts"
$MOUNT -t sysfs /sys "${MAIN}/sys"
$MOUNT -t proc /proc "${MAIN}/proc"
cp /proc/mounts "${MAIN}/etc/mtab"
cp /etc/resolv.conf "${MAIN}/etc/resolv.conf"

chroot "${MAIN}"
exit

UUID=03d34c21-a150-4e91-8470-a6346d04287a	/			btrfs	defaults,compress=lzo,nospace_cache,inode_cache,relatime,ssd,discard							0	0
UUID=03d34c21-a150-4e91-8470-a6346d04287a	/boot/grub/x86_64/efi	btrfs	defaults,compress=lzo,nospace_cache,inode_cache,relatime,ssd,discard,subvol=__ALWAYSCURRENT__/boot-grub-x86_64-efi	0	0


