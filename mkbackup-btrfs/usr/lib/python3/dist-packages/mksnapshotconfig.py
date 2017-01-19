import sys
import subprocess
import socket
import os
import errno

__author__ = "Jakobus Schuerz <jakobus.schuerz@gmail.com>"
__version__ = "0.01.0"


# Useful for very coarse version differentiation.
PY2 = sys.version_info[0] == 2
PY3 = sys.version_info[0] == 3
PY34 = sys.version_info[0:2] >= (3, 4)


if PY3:
    from configparser import ConfigParser
else:
    from ConfigParser import ConfigParser

def s2bool(s):
    return s.lower() in ['true','yes','y','1'] if s else False

class Config():
    def __init__(self,cfile='/etc/mkbackup-btrfs.conf'):
        self.cfile = cfile
        self.config = ConfigParser()
        #self.hostname = subprocess.check_output("/bin/hostname",shell=True).decode('utf8').split('\n')[0]
        self.hostname=socket.gethostname()
        self.syssubvol=subprocess.check_output(['/usr/bin/grub-mkrelpath','/'], shell=False).decode('utf8').split("\n")[0].strip("/")

        if os.path.exists(self.cfile): 
            pass #print('OK')
        else:
            print('Default-Config created at %s' % (self.cfile))
            self.CreateConfig()
        self.config.read(self.cfile)
        psrc = os.getcwd()
        if   '/'+psrc.strip('/') == self.config.get('DEFAULT','SNPMNT')+'/'+self.config.get('DEFAULT','snpstore').strip('/'):
            self.config.set('DEFAULT','SRC', self.config.get('DEFAULT','SNPMNT'))
            self.config.set('DEFAULT','srcstore', self.config.get('DEFAULT','snpstore'))
        if   '/'+psrc.strip('/') == self.config.get('DEFAULT','SNPMNT'):
            self.config.set('DEFAULT','SRC', self.config.get('DEFAULT','SNPMNT'))
            self.config.set('DEFAULT','srcstore', self.config.get('DEFAULT','snpstore'))
        elif '/'+psrc.strip('/') == self.config.get('DEFAULT','BKPMNT')+'/'+self.config.get('DEFAULT','bkpstore').strip('/'):
            self.config.set('DEFAULT','SRC', self.config.get('DEFAULT','BKPMNT'))
            self.config.set('DEFAULT','srcstore', self.config.get('DEFAULT','bkpstore'))
        elif '/'+psrc.strip('/') == self.config.get('DEFAULT','BKPMNT'):
            self.config.set('DEFAULT','SRC', self.config.get('DEFAULT','BKPMNT'))
            self.config.set('DEFAULT','srcstore', self.__trnName(self.config.get('DEFAULT','bkpstore')))
        else:
            self.config.set('DEFAULT','SRC', psrc)
            self.config.set('DEFAULT','srcstore', '')
        
        self.config.read(self.cfile)

    def CreateConfig(self):
        self.config['DEFAULT'] = {'SNPMNT': '/var/cache/btrfs_pool_SYSTEM',
                             'BKPMNT': '/var/cache/backup',
                             'snpstore': '',
                             'bkpstore': '$h',
                             'volumes': '$S,__ALWAYSCURRENT__',
                             'interval': 5,
                             'symlink': 'LAST',
                             'transfer': False }
        self.config['hourly'] = {'volumes':  '$S,__ALWAYSCURRENT__','interval': '24','transfer': True}
        self.config['daily'] = {'volumes': '$S,__ALWAYSCURRENT__','interval': '7','transfer': True}
        self.config['weekly'] = {'volumes': '$S,__ALWAYSCURRENT__','interval': '5','transfer': True}
        self.config['monthly'] = {'volumes': '$S,__ALWAYSCURRENT__','interval': '12','transfer': True}
        self.config['yearly'] = {'volumes': '$S,__ALWAYSCURRENT__','interval': '7','transfer': True}
        self.config['afterboot'] = {'volumes':  '$S','interval': '4','symlink': 'LASTBOOT'}
        self.config['aptupgrade'] = {'volumes':  '$S','interval': '6','symlink': 'BEFOREUPDATE'}
        self.config['dmin'] = {'volumes': '$S,__ALWAYSCURRENT__','interval': '6'}
        self.config['plugin'] = {'volumes': '$S,__ALWAYSCURRENT__','interval': '5','transfer': True}
        self.config['manually'] = {'volumes': '$S,__ALWAYSCURRENT__','interval': '5','symlink': 'MANUALLY','transfer': True}

        with open(self.cfile, 'w') as configfile:
            try:
                self.config.write(configfile)
            except:
                exit("Failure during creation of config-file")
        return(self.config)

    def ReadConfig(self):
        self.config.read(self.cfile)
        for i in self.config:
            #print(i)
            for j in self.config[i]:
                print(j+':',self.config[i][j])

    def ListIntervals(self):
        LST = []
        self.config.read(self.cfile)
        for i in self.config:
            if i != 'DEFAULT':
                LST.append(i) 
            else:
                LST.append('misc')
        return(LST)

    def ListIntervalsFull(self):
        LST = []
        self.config.read(self.cfile)
        for i in self.config:
            if i != 'DEFAULT':
                LST.append(i+': '+str(self.config.get(i,'interval'))) 
            else:
                LST.append('misc: '+str(self.config.get(i,'interval')))
        return(LST)

    def ListSymlinkNames(self):
        LST = []
        self.config.read(self.cfile)
        for i in self.config:
            LST.append(self.config.get(i,'symlink'))
        return(list(set(LST)))


    def getStorePath(self,store='SRC'):
        if store == 'SRC':
            path = '/'+self.config.get('DEFAULT','SRC').strip('/')+'/'+self.config.get('DEFAULT','srcstore').strip('/')
        if store == 'SNP':
            path = '/'+self.config.get('DEFAULT','SNPMNT').strip('/')+'/'+self.__trnName(self.config.get('DEFAULT','snpstore').strip('/'))
        if store == 'BKP':
            path = '/'+self.config.get('DEFAULT','BKPMNT').strip('/')+'/'+self.__trnName(self.config.get('DEFAULT','bkpstore').strip('/'))

        # listing in / raises error, when next return is deleted. 
        return('/'+path.strip('/'))
        # avoid deleting of / - but it's buggy, so return above is inserted
        if '/'+path.strip('/') != "/":
            return('/'+path.strip('/'))
        else:
            return(None)

    def getMountPath(self,store='SRC'):
        if store == 'SRC':
            path = '/'+self.config.get('DEFAULT','SRC').strip('/')
        elif store == 'SNP':
            path = '/'+self.config.get('DEFAULT','SNPMNT').strip('/')
        elif store == 'BKP':
            path = '/'+self.config.get('DEFAULT','BKPMNT').strip('/')

        # listing in / raises error, when next return is deleted. 
        return('/'+path.strip('/'))
        # avoid deleting of / - but it's buggy, so return above is inserted
        if '/'+path.strip('/') != "/":
            return('/'+path.strip('/'))
        else:
            return(None)

    def getDevice(self,store='SRC'):
        mp = self.getMountPath(store=store)
        #cmd = """awk -F " " '$1 !~ /systemd-1/ && $2 == "%s" && $3 == "btrfs" {printf $1}' /proc/mounts""" % (mp)
        cmd = """awk -F " " '$2 == "%s" && $3 == "autofs" {printf $1}' /proc/mounts""" % (mp)
        amount =  subprocess.check_output(cmd, shell=True).decode()
        if amount == '':
            pass
        elif amount == 'systemd-1':
            os.stat(self.getStorePath(store=store))
        else:
            print("don't know")
            return None

        cmd = """awk -F " " '$2 == "%s" && $3 == "btrfs" {printf $1}' /proc/mounts""" % (mp)
        device =  subprocess.check_output(cmd, shell=True).decode()
        if device == '':
            return None
        else:
            return device


        #return device if device != '' else None

    def getUUID(self,store='SRC'):
        device = self.getDevice(store=store)
        if device == None: return None
        cmd = "/sbin/blkid %s -o value -s 'UUID'" % (device)
        uuid =  subprocess.check_output(cmd, shell=True).decode().partition('\n')[0]
        return uuid if uuid != '' else None

    
    def setBKPPath(self,mount):
        self.config['DEFAULT']['BKPMNT'] = mount

    def setBKPStore(self,store):
        self.config['DEFAULT']['bkpstore'] = store

    def setSNPPath(self,mount):
        self.config['DEFAULT']['SNPMNT'] = mount

    def setSNPStore(self,store):
        self.config['DEFAULT']['snpstore'] = store

    def getStoreName(self,store='SRC'):
        if store == 'SRC':
            path = self.config.get('DEFAULT','srcstore').strip('/')
        elif store == 'SNP':
            path = self.__trnName(self.config.get('DEFAULT','snpstore').strip('/'))
        elif store == 'BKP':
            path = self.__trnName(self.config.get('DEFAULT','bkpstore').strip('/'))
        if '/'+path.strip('/') != "/":
            return(path.strip('/'))
        else:
            return('')

    def getInterval(self,intv='misc'):
        try:
            return(self.config.get(intv,'interval'))
        except:
            return(self.config.get('DEFAULT','interval'))

    def getTransfer(self,intv='misc'):
        try:
            return(s2bool(self.config.get(intv,'transfer')))
        except:
            return(s2bool(self.config.get('DEFAULT','transfer')))

    def getSymLink(self,intv='misc'):
        try:
            return(self.config.get(intv,'symlink'))
        except:
            return(self.config.get('DEFAULT','symlink'))

    def getIsDefault(self,intv='misc'):
        try:
            self.config.get(intv,'interval')
            return(intv)
        except:
            return('default')

    def getVolumes(self,intv='default'):
        VOLSTRANS = []
        try:
            VOLS = self.config.get(intv,'volumes')
        except:
            VOLS = self.config.get('DEFAULT','volumes')
        for vol in VOLS.split(','):
            VOLSTRANS.append(self.__trnName(vol))
        return(VOLSTRANS)

    def ListIntVolumes(self):
        VOLSTRANS = []
        for intv in self.ListIntervals():
            try:
                VOLS = self.config.get(intv,'volumes')
            except:
                VOLS = self.config.get('DEFAULT','volumes')
            VOLS = VOLS.split(',')
            for i, item in enumerate(VOLS):
                VOLS[i] = self.__trnName(item)
            VOLSTRANS.append('\t'+intv+': '+' '.join(VOLS))
        return(VOLSTRANS)


    def __trnName(self,short):
        if short == "$S": return(self.syssubvol)
        elif short == "$h": return(self.hostname)
        else: return(short)

