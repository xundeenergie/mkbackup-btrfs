# mkbackup-btrfs
Make snapshots recursively from btrfs-subvolumes
This scripts are written in python3 and replace https://github.com/xundeenergie/mkbtrbackup

You have to prepare your installation with some subvolumes.

First create a directory

    mkdir -p /var/cache/btrfs_pool_SYSTEM

and

    mkdir -p /var/cache/backup

The first is for the local HD, to mount the whole btrfs-partition, the btrfs-pool.
The second one is for the external HD to save the backup.
This two directories are hardcoded for the default-configuration in the python-skript.

Mount your btrfs-partition to /var/cache/btrfs_pool_SYSTEM

    mount -t btrfs -ocompress=lzo /dev/sdXY /var/cache/btrfs_pool_SYSTEM

You neet two major subvolumes.

One for your system, which is snapshotted on every upgrade/update, on successfull boots and so on.
The other one for data you will need accurat even if you boot from an older snapshot (recover your system, you need /home, /var/spool accurat - it's user-data!).

The first is called for example: "@debian"
The second one is hardcoded with "`__ALWAYSCURRENT__`"

```
btrfs subvol create /var/cache/btrfs_pool_SYSTEM/@debian
btrfs subvol create /var/cache/btrfs_pool_SYSTEM/__ALWAYSCURRENT__
```

The system mounts the default-subvolume on bootup. So be sure, that @debian is your default-subvolume.
prepare your /etc/fstab to mount the always current subvolumes from `__ALWAYSCURRENT__`
Create the following subvolumes there:
  home
  opt
  srv
  usr-local
  var-cache
  var-lib-mpd
  var-lib-named
  var-log
  var-opt
  var-spool
  var-spool-dovecot
  var-tmp
  var-www

Look at the fstab-example for mounting all this subvolumes.

Copy your data to this subvolumes

    cp --reflink=always -ar source destination

Reboot an check if all this subvolumes are mounted correctly. You can clean the original directories in @debian while they are overmounted with the new ones, if you go to /var/cache/btrfs_pool_SYSTEM/@debian/sub/vol/ume and delete it there. 

Be carefull. If you copy the systemd-units to your system, the timers and units are enabled!! Disable all the snapshotting with:

    systemctl stop mkbackup.target

and disable it

    systemctl disable mkbackup.target


Enable and start it if all the data and subvolume-structure is correct and working. 

You can make your first snapshot with:

    systemctl start mkbackup@manually.service

##mlocate:
To avoid, that mlocate searches the backups, edit its configuration

    /etc/updatedb.conf
    PRUNE_BIND_MOUNTS="yes"
    # PRUNENAMES=".git .bzr .hg .svn"
    PRUNEPATHS="/tmp /var/spool /media /backup /backup-local /var/cache/backup /var/cache/btrfs_pool_SYSTEM"
    PRUNEFS="NFS nfs nfs4 rpc_pipefs afs binfmt_misc proc smbfs autofs iso9660 ncpfs coda devpts ftpfs devfs mfs shfs sysfs cifs lustre tmpfs usbfs udf fuse.glusterfs fuse.sshfs curlftpfs fuse.MksnapshotFS.py"

==Ignore Subvolumes on creating a System-Snapshot
If you want to ignore a subvolume from making a backup-Snapshot, you can handle this on several ways.
The easiest way is to drop a Drop-In-File for example like this for a guest-session-home:

    editor /etc/mkbackup-btrfs.conf.d/guestsession.conf

    [DEFAULT]
    ignore = +/home/gast

The filename doesn't matter. But it must end in ".conf"
This can be done by placing such a Drop-In with a debian-package, or manually. 
You can choose, if it should be ignored generally or only on specific interval-snapshots.
The example above appends /home/gast to an existing list of ignored snapshots. 

    [DEFAULT]
    ignore = /home/gast

this replaces every ignore-list with only this subvolume "/home/gast"
the "+" before the subvolume means, that the subvolume(s) given are being appended to a existing list. Without a "+", the list is replaced by the given.

If you want to ignore a specific subvolume additionally on a specific interval (f.e. /var/www should not be backed up on hourly snapshots), place this in a file:

    [hourly]
    ignore = +/var/www

You can set the ignore-Option in every section also in /etc/mkbackup-btrfs.conf
It works the same way. DEFAULT is valid to every interval, and default-Values get overwritten or extended (missing or given "+") by the interval-sections

To ignore several subvolumes when using mkbackup-btrfs from commandline, just use the -i option (more than once)

    mkbackup -v -t manually -i /home/guest -i /var/www create SNP @debian

This overrides settings from config-files.


TODO:
- Regular-Expressions for ignoring subvolumes. Test and describe it in Todo

=Changelog

18.9.2016: 
	-added experimental new code btrfssubvols.py - not working yet!!
	-new library in /usr/lib/python3/dist-packages for config-parsing
	-new Fuse-Filesystem for usermounting the backups and snapshots in $HOME/backup
	
