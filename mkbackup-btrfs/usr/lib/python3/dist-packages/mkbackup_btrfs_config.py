from __future__ import (absolute_import, division, print_function,
        unicode_literals)
#from builtins import *

import sys
import subprocess
import socket
import os
import errno
import re

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
        self._read()

#        for i in ['DEFAULT']:
#            print('XX[%s]' %(i))
#            for j in self.config.defaults():
#                print("XX"+j+' = ',self.__trnName(self.config.get(i,j)))
#            print('')
#        
#        for i in self.config.sections():
#            print('XX[%s]' %(i))
#            for j in self.config.options(i):
#                print("XX"+j+' = ',self.__trnName(self.config.get(i,j)))
#            print('')
        
    def _read(self):

        csup = dict() #for each dropin-file a csup = config-superseed-dict-entry
        self.config = ConfigParser()
        self.config.read(self.cfile)
        self.csupdir = self.cfile+'.d'
        if os.path.exists(str(self.csupdir)) and os.path.isdir(str(self.csupdir)):
            for csuplst in os.listdir(self.csupdir):
                if csuplst.endswith('.conf'):
                    csup[csuplst] = ConfigParser()
                    csup[csuplst].read(self.csupdir+'/'+csuplst)

        # first superseed defaults
        for i in sorted(csup.keys()):
            # Set Options
            for j in ['DEFAULT']:
                for k in csup[i].defaults() if j == 'DEFAULT' else csup[i].options(j):
                    if self.config.has_section(j) or j == 'DEFAULT':
                        if k == 'ignore':
                            # only attend pattern on option 'ignore'
                            orig = self.config.get(j,k) + ',' if self.config.has_option(j,k) else ''
                        elif k == 'description':
                            # only attend pattern on option 'description'
                            orig = self.config.get(j,k) if self.config.has_option(j,k) else ''
                        else:
                            # if option is not ignore, do the same as without
                            # +, but remove + as first character
                            orig = ''
                        self.config.set(j,k,orig + re.sub('^\+','',csup[i].get(j,k)))
                        #self.config.set(j,k,re.sub('^\+*','',csup[i].get(j,k)))
                    else:
                        # add section
                        self.config.add_section(j)
                        for k in csup[i].options(j):
                            # add option to new section
                            self.config.set(j,k,re.sub('^\+','',csup[i].get(j,k)))

        # second superseed normal options
        for i in sorted(csup.keys()):
            for j in csup[i].sections():
                for k in csup[i].defaults() if j == 'DEFAULT' else csup[i].options(j):
                    if self.config.has_section(j) or j == 'DEFAULT':
                        if k == 'ignore':
                            # only attend pattern on option 'ignore'
                            orig = self.config.get(j,k) + ',' if self.config.has_option(j,k) else ''
                        elif k == 'description':
                            # only attend pattern on option 'description'
                            orig = self.config.get(j,k) if self.config.has_option(j,k) else ''
                        else:
                            # if option is not ignore, do the same as without
                            # +, but remove + as first character
                            orig = ''
                        self.config.set(j,k,orig + re.sub('^\+','',csup[i].get(j,k)))
                    else:
                        # add section
                        self.config.add_section(j)
                        for k in csup[i].options(j):
                            # add option to new section
                            self.config.set(j,k,re.sub('^\+','',csup[i].get(j,k)))


        psrc = os.getcwd()
        if   '/'+psrc.strip('/') == self.getMountPath('SNP')[1]:
            #print("A",self.getMountPath('SNP'))
            self.config.set('DEFAULT','SRC', ' '.join(self.getMountPath('SNP')))
            self.config.set('DEFAULT','srcstore', self.getStoreName('SNP'))
        elif   '/'+psrc.strip('/') == self.getMountPath('SNP')[1]+'/'+self.getStoreName('SNP'):
            #print("B")
            self.config.set('DEFAULT','SRC', ' '.join(self.getMountPath('SNP')))
            self.config.set('DEFAULT','srcstore', self.getStoreName('SNP'))
        elif '/'+psrc.strip('/') == self.getMountPath('BKP')[1]+'/'+self.getStoreName('BKP'):
            #print("C")
            self.config.set('DEFAULT','SRC', ' '.join(self.getMountPath('BKP')))
            self.config.set('DEFAULT','srcstore', self.getStoreName('BKP'))
        elif '/'+psrc.strip('/') == self.getMountPath('BKP')[1]:
            #print("D")
            self.config.set('DEFAULT','SRC', ' '.join(self.getMountPath('BKP')))
            self.config.set('DEFAULT','srcstore', self.getStoreName('BKP'))
        else:
            #print("E")
            self.config.set('DEFAULT','SRC', psrc)
            self.config.set('DEFAULT','srcstore', '')

#        for i in self.config.sections():
#            print('XX[%s]' %(i))
#            for j in self.config.options(i):
#                print("XX"+j+' = ',self.__trnName(self.config.get(i,j)))
#            print('')

    def CreateConfig(self):
        self.config['DEFAULT'] = {
                'Description': "Erstellt ein Backup",
                'SNPMNT': '/var/cache/btrfs_pool_SYSTEM',
                'BKPMNT': '/var/cache/backup',
                'snpstore': '',
                'bkpstore': '$h',
                'volumes': '$S,__ALWAYSCURRENT__',
                'interval': 5,
                'symlink': 'LAST',
                'transfer': False}
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

    def PrintConfig(self,tag,of=None):
        if tag == None:
            seclist = self.config.sections()
        else:
            seclist = [tag]

        out = list()
        #print( seclist, self.config.defaults())
        if tag == None:
            out.append('[DEFAULT]')
            for j in self.config.defaults():
                out.append("%s = %s" % (j,self.__trnName(self.config.get('DEFAULT',j))))
            out.append('')

        for i in self.config.sections() if tag == None else [tag]:
            out.append('[%s]' %(i))
            for j in self.config.options(i):
                out.append("%s = %s" % (j,self.__trnName(self.config.get(i,j))))
            out.append('')

        if of != None:
            with open(of, 'w') as f:
                try:
                    f.write('\n'.join(out))
                except:
                    raise
                    exit("Failure during creation of tmp-config-file")
        else:
            print('\n'.join(out))


    def ListIntervals(self):
        LST = []
        for i in self.config.sections():
            LST.append(i) 
        LST.append('misc')
        return(LST)

    def ListIntervalsFull(self):
        #self._read()
        LST = []
        for i in self.config.sections():
            LST.append(i+': '+str(self.config.get(i,'interval'))) 
        LST.append('misc: '+str(self.config.get(i,'interval')))
        return(LST)

    def ListSymlinkNames(self):
        #self._read()
        LST = []
        for i in self.config.sections():
            LST.append(self.config.get(i,'symlink'))
        return(list(set(LST)))


    def getMountPath(self,store='SRC',tag='DEFAULT',shlogin=False):
        if store == 'SRC':
            try:
                path = self.config.get(tag,'SRC')
            except:
                path = self.config.get('DEFAULT','SRC')
        elif store == 'SNP':
            try:
                path = self.config.get(tag,'SNPMNT')
            except:
                path = self.config.get('DEFAULT','SNPMNT')
        elif store == 'BKP':
            try:
                path = self.config.get(tag,'BKPMNT')
            except:
                path = self.config.get('DEFAULT','BKPMNT')

        _ssh = path.split(':')
        if len(_ssh) == 1:
            path = _ssh[0]
            SSH = ''
        elif len(_ssh) == 2:
            userhost,path = _ssh
            port = '22'
            SSH = [userhost,port]
        elif len(_ssh) == 3:
            userhost,port,path = _ssh
            SSH = [userhost,port]
        if shlogin:
            return(' '.join(SSH))
        else:
            return('/'+path.strip('/'))
        #return(' '.join(SSH) if shlogin else '/'+path.strip('/'))
        # avoid deleting of / - but it's buggy, so return above is inserted
        if '/'+path.strip('/') != "/":
            return('/'+path.strip('/'))
        else:
            return(None)

    def getSSHLogin(self,store='SRC',tag='DEFAULT'):
        return(self.getMountPath(store=store,tag=tag,shlogin=True))

    def getStoreName(self,store='SRC',tag='DEFAULT'):
        #self._read()
        if store == 'SRC':
            try:
                path = self.config.get(tag,'srcstore').strip('/')
            except:
                path = self.config.get('DEFAULT','srcstore').strip('/')
        elif store == 'SNP':
            try:
                path = self.__trnName(self.config.get(tag,'snpstore').strip('/'))
            except:
                path = self.__trnName(self.config.get('DEFAULT','snpstore').strip('/'))
        elif store == 'BKP':
            try:
                path = self.__trnName(self.config.get(tag,'bkpstore').strip('/'))
            except:
                path = self.__trnName(self.config.get('DEFAULT','bkpstore').strip('/'))
        if '/'+path.strip('/') != "/":
            return(path.strip('/'))
        else:
            return('')

    def getStorePath(self,store='SRC',tag='DEFAULT'):
        return(self.getMountPath(store=store,tag=tag) + '/' + self.getStoreName(store=store,tag=tag))

        if store == 'SRC':
            try:
                path = '/'+self.config.get(tag,'SRC').strip('/')+'/'+self.config.get(tag,'srcstore').strip('/')
            except:
                path = '/'+self.config.get('DEFAULT','SRC').strip('/')+'/'+self.config.get('DEFAULT','srcstore').strip('/')
        if store == 'SNP':
            try:
                path = '/'+self.config.get(tag,'SNPMNT').strip('/')+'/'+self.__trnName(self.config.get(tag,'snpstore').strip('/'))
            except:
                path = '/'+self.config.get('DEFAULT','SNPMNT').strip('/')+'/'+self.__trnName(self.config.get('DEFAULT','snpstore').strip('/'))
        if store == 'BKP':
            try:
                path = '/'+self.config.get(tag,'BKPMNT').strip('/')+'/'+self.__trnName(self.config.get(tag,'bkpstore').strip('/'))
            except:
                path = '/'+self.config.get('DEFAULT','BKPMNT').strip('/')+'/'+self.__trnName(self.config.get('DEFAULT','bkpstore').strip('/'))

        # listing in / raises error, when next return is deleted. 
        return('/'+path.strip('/'))
        # avoid deleting of / - but it's buggy, so return above is inserted
        if '/'+path.strip('/') != "/":
            return('/'+path.strip('/'))
        else:
            return(None)

    def getDevice(self,store='SRC',tag='DEFAULT'):
        #self._read()
        ssh, mp = self.getMountPath(store=store,tag=tag)
        #cmd = """awk -F " " '$1 !~ /systemd-1/ && $2 == "%s" && $3 == "btrfs" {printf $1}' /proc/mounts""" % (mp)
        cmd = """awk -F " " '$2 == "%s" && $3 == "autofs" {printf $1}' /proc/mounts""" % (mp)
        amount =  subprocess.check_output(cmd, shell=True).decode()
        if amount == '':
            pass
        elif amount == 'systemd-1':
            try:
                os.stat(self.getStorePath(store=store))
            except:
                os.stat(os.path.dirname(self.getStorePath(store=store)))
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

    def getUUID(self,store='SRC',tag='DEFAULT'):
        #self._read()
        device = self.getDevice(store=store,tag=tag)
        if device == None: return None
        cmd = "/sbin/blkid %s -o value -s 'UUID'" % (device)
        uuid =  subprocess.check_output(cmd, shell=True).decode().partition('\n')[0]
        return uuid if uuid != '' else None

    
    def setBKPPath(self,mount):
        #self._read()
        self.config['DEFAULT']['BKPMNT'] = mount

    def setBKPStore(self,store):
        #self._read()
        self.config['DEFAULT']['bkpstore'] = store

    def setSNPPath(self,mount):
        #self._read()
        self.config['DEFAULT']['SNPMNT'] = mount

    def setSNPStore(self,store):
        #self._read()
        self.config['DEFAULT']['snpstore'] = store

    def getInterval(self,intv='misc'):
        #self._read()
        try:
            return(self.config.get(intv,'interval'))
        except:
            return(self.config.get('DEFAULT','interval'))

    def getTransfer(self,intv='misc'):
        #self._read()
        try:
            return(s2bool(self.config.get(intv,'transfer')))
        except:
            return(s2bool(self.config.get('DEFAULT','transfer')))

    def getSymLink(self,intv='misc'):
        #self._read()
        try:
            return(self.config.get(intv,'symlink'))
        except:
            return(self.config.get('DEFAULT','symlink'))

    def getIsDefault(self,intv='misc'):
        #self._read()
        try:
            self.config.get(intv,'interval')
            return(intv)
        except:
            return('default')

    def getVolumes(self,intv='default'):
        #self._read()
        VOLSTRANS = []
        try:
            VOLS = self.config.get(intv,'volumes')
        except:
            VOLS = self.config.get('DEFAULT','volumes')
        for vol in VOLS.split(','):
            VOLSTRANS.append(self.__trnName(vol))
        return(VOLSTRANS)

    def ListIntVolumes(self):
        #self._read()
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

    def getIgnores(self,intv='misc'):
        try:
            r = self.config.get(intv,'ignore')
        except:
            try:
                r = self.config.get('DEFAULT','ignore')
            except:
                r=None
        return(None if r == '' or r == None else r)

    def __trnName(self,short):
        ret = list()
        for sh in short.split(','):
            if sh == "$S": ret.append(self.syssubvol)
            elif sh == "$h": ret.append(self.hostname)
            else: ret.append(sh)
        return(','.join(ret))

