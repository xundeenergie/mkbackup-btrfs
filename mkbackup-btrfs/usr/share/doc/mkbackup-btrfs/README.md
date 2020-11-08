find Partition-UUID or UUID and register external HD with
'''
    systemctl start mkbackup-register@p-<PARTUUID>.service  # for PARTUUID
    systemctl start mkbackup-register@u-<UUID>.service      #for UUID
'''

Ignore this HD in udisks. Find ID_SERIAL with
'''
    udevadm info /dev/sdX
'''
create file /etc/udev/rules.d/98-ignore-backup-HD.rules

'''
ENV{ID_SERIAL}=="WD_Elements_10A8_575833314133353235354A4A-0:0", ENV{UDISKS_IGNORE}="1"
'''
