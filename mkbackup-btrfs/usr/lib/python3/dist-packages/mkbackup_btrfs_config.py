from __future__ import (absolute_import, division, print_function,
        unicode_literals)
#from builtins import *

import sys
import subprocess
import socket
import os
import errno
import re
import paramiko

__author__ = "Jakobus Schuerz <jakobus.schuerz@gmail.com>"
__version__ = "0.04.0"


# Useful for very coarse version differentiation.
PY2 = sys.version_info[0] == 2
PY3 = sys.version_info[0] == 3
PY34 = sys.version_info[0:2] >= (3, 4)


if PY3:
    from configparser import ConfigParser
    from configparser import RawConfigParser, NoOptionError, NoSectionError
else:
    from ConfigParser import ConfigParser
    from ConfigParser import RawConfigParser, NoOptionError, NoSectionError

class Error(Exception):
    pass

class NoSubvolumeError(Error):
    def __init__(self):
        print("ERROR - Snapshot not found" )
    pass

class SSHConnectionError(Error):
    def __init__(self):
        print("ERROR - ssh-connection not available" )
    pass

def s2bool(s):
    return s.lower() in ['true','yes','y','1'] if s else False

# quote awk-argument in ssh-command
def quote_argument(argument):
    return '"%s"' % (
        argument
        .replace('\\', '\\\\')
        .replace('"', '\\"')
        .replace('$', '\\$')
        .replace('`', '\\`')
    )

def connect(conn=None):
    if conn == None:
        pass
    else:
        if not conn['active']:
            try:
                #if conn['conn'].is_active(): print("Session alive")
                #conn['conn'].close()
                conn['conn'].connect(conn['host'],conn['port'],conn['user'],auth_timeout=10)
                conn['active'] = True
                #print("open connection for %s@%s" % (conn['user'], conn['host']))
#            except (paramiko.BadHostKeyException,
#                    paramiko.AuthenticationException, paramiko.SSHException,
#                    socket.gaierror, socket.error) as e:
#                #print("C",e)
#                #raise e 
#                print("No connection to host %s" % (conn['host']))
#                return(False)
#            except (paramiko.BadHostKeyException, paramiko.AuthenticationException, paramiko.SSHException, socket.error) as e:
#                raise e 
            except:
                return(False)

            return(True)
            raise SSHConnectionError
        else:
            return(True)
#        try:
#            #if conn['conn'].is_active(): print("Session alive")
#            conn['conn'].close()
#            conn['conn'].connect(conn['host'],conn['port'],conn['user'])
#            print("open connection for %s@%s" % (conn['user'], conn['host']))
#        except (paramiko.BadHostKeyException, paramiko.AuthenticationException, paramiko.SSHException, socket.error) as e:
#            print("C",e)
#            raise e 
        

class MountInfo():
    def __init__(self,mountinfo='/proc/self/mountinfo',conn=None):
        self.mi = dict()
        if conn == None:
            mif = open(mountinfo)
        else:
            if connect(conn):
                #conn['conn'].connect(conn['host'],conn['port'],conn['user'])
                sftp_client = conn['conn'].open_sftp()
                mif = sftp_client.open(mountinfo)
            else:
                print("Host not reachable (MountInfo): %s" % (conn['host']))
                mif = open(mountinfo)
        try:
            for line in mif:
                if len(line.split()) == 10:
                    a,b,c,relpath,mntp,d,typ,fstype,dev,opts = line.split()
                else:
                    a,b,c,relpath,mntp,d,e,typ,fstype,dev,opts = line.split()
                mntp = mntp.replace('\\040',' ')
                self.mi[mntp] = dict()
                self.mi[mntp]['relpath'] = relpath
                self.mi[mntp]['typ'] = typ
                self.mi[mntp]['fstype'] = fstype
                self.mi[mntp]['dev'] = dev
                self.mi[mntp]['opts'] = opts
        finally:
            mif.close()
            
    def __check(self,mountpoint,attribute):
        if not mountpoint[0] == '/': 
            raise FileNotFoundError(errno.ENOENT, os.strerror(errno.ENOENT), mountpoint) 
        mp = mountpoint.rstrip('/')if len(mountpoint) > 1 else mountpoint
        rec = False
        rep = ''
        if os.path.exists(mp):
            try:
                rp = self.mi[mp][attribute]
                rep = mp
            except:
                rec = True
                a,rep,rp = self.__check(os.path.dirname(mp),attribute)
            return [rec,rep,rp]
        else:
            raise FileNotFoundError(errno.ENOENT, os.strerror(errno.ENOENT), mp) 

    def relpath(self,mountpoint):
        rec,rep,mp = self.__check(mountpoint,'relpath')
        #print(mountpoint,rec,rep,mp)
        if rec: return mp.replace(rep,'') + mountpoint
        return mp

    def fstype(self,mountpoint):
        return self.__check(mountpoint,'fstype')[2]

    def typ(self,mountpoint):
        return self.__check(mountpoint,'typ')[2]

    def device(self,mountpoint):
        return self.__check(mountpoint,'dev')[2]

class MyConfigParser(ConfigParser):
    comment = """replace get in Configparser to give the default-option, if a
                section doesn't exist, and option exists in default"""
    def get(self, section, option, **kw):
        try:
            return ConfigParser.get(self, section, option, raw=True)
        except:
            return ConfigParser.get(self, 'DEFAULT', option, raw=True)

class Myos():
    def __init__(self,dry=False):
        self.dry = dry
        pass

    def __run__(self,command,conn=None):
        if not conn == None:
            if connect(conn):
                out=''
                stdin, stdout, stderr = conn['conn'].exec_command(command)
                for line in stdout:
                    out += line
                return(out)
            else:
                print("Host not reachable (Myos): %s" % (conn['host']))

    def stat(self,path,conn=None):
        if not conn == None:
            command='/usr/bin/stat'
            return(self.__run__(command,conn))
        else:
            return os.stat(path)


    def path_isdir(self,path,conn=None):
        #print("myos.path",os.path.exists(path))
        if not conn == None:
            command='/bin/test -d %s' % (path)
            return(self.__run__(command,conn))
        else:
#            print("is local dir %s" % (path))
            return os.path.isdir(path)

    def path_isfile(self,path,conn=None):
        if not conn == None:
            command='/bin/test -f %s' % (path)
            return(self.__run__(command,conn))
        else:
#            print("is local file %s" % (path))
            return os.path.isfile(path)

    def path_realpath(self,path,conn=None):
        #print("myos.path",os.path.exists(path))
        if not conn == None:
            command='/usr/bin/realpath %s' % (path)
            return(self.__run__(command,conn))
        else:
#            print("local realpath for %s" % (path))
            return os.path.realpath(path)

    def path_exists(self,path,conn=None):
        #print("myos.path",os.path.exists(path))
        if not conn == None:
            command='/bin/test -e %s' % (path)
            return(self.__run__(command,conn))
        else:
#            print("exists-local %s" % (path))
            return os.path.exists(path)

    def remove(self,path,conn=None):
        if self.dry == True:
            print('Remove %s (dry run)' % (path))
            return
        else:
            if not conn == None:
                command='/bin/rm %s' % (path)
                return(self.__run__(command,conn))
            else:
    #            print("remove-local %s" % (path))
                return os.remove(path)

    def rename(self,From,To,conn=None):
        if self.dry == True:
            print('Rename %s to %s (dry run)' % (From,To))
            return
        else:
            if not conn == None:
    #            print("RENAME",From,To,conn['host'])
                command='/bin/mv %s %s' % (From,To)
                return(self.__run__(command,conn))
            else:
    #            print("rename-local %s %s" % (From,To))
                return os.rename(From,To)
            

    def path_islink(self,path,conn=None):
        if not conn == None:
            command='/bin/test -h %s' % (path)
            return(self.__run__(command,conn))
        else:
            return os.path.islink(path)

    def listdir(self,path,conn=None):
        if not conn == None:
            command='/bin/ls %s' % (path)
            return(self.__run__(command,conn))
        else:
            return os.listdir(path)


class Config():
    def __init__(self,cfile='/etc/mkbackup-btrfs.conf'):
        self.cfile = cfile
        #self.config = ConfigParser()
        self.config = MyConfigParser()
        #self.hostname = subprocess.check_output("/bin/hostname",shell=True).decode('utf8').split('\n')[0]
        self.hostname=socket.gethostname()
        self.mountinfo = MountInfo()
        self.syssubvol = self.mountinfo.relpath('/')[1:]
        #self.syssubvol=subprocess.check_output(['/usr/bin/grub-mkrelpath','/'], shell=False).decode('utf8').split("\n")[0].strip("/")
        self.ssh = dict()
        self.ssh_cons = dict()

        #if os.path.exists(self.cfile): 
        if Myos().path_exists(self.cfile): 
            pass #print('OK')
        else:
            print('Default-Config created at %s' % (self.cfile))
            self.CreateConfig()
        self._read()

        for i in self.ListIntervals() +['DEFAULT']:
            self.ssh[i] = dict()
            for s in ['SRC', 'SNP', 'BKP']:
                #print('X',self.getSSHLogin(s,i))
                self.ssh[i][s] = dict()
                if self.getSSHLogin(s,i) != None:
                    c,x,p,uh = self.getSSHLogin(s,i).strip().split(' ')
                    u,h = uh.split('@')
                    if not uh in self.ssh_cons:
                        self.ssh_cons[uh] = paramiko.SSHClient()
                        self.ssh_cons[uh].set_missing_host_key_policy(paramiko.AutoAddPolicy())
                        #self.ssh_cons[uh].connect(h, int(p), u)

                    #self.ssh[i][s]['conn'] = uh
                    self.ssh[i][s]['conn'] = self.ssh_cons[uh]
                    self.ssh[i][s]['host'] = h
                    self.ssh[i][s]['port'] = int(p)
                    self.ssh[i][s]['user'] = u
                    self.ssh[i][s]['creds'] = (h, int(p), u)
                    self.ssh[i][s]['active'] = False

                else:
                    self.ssh[i][s] = None
        
    def _read(self):

        csup = dict() #for each dropin-file a csup = config-superseed-dict-entry
        #self.config = ConfigParser()
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
                            #orig = self.config.get(j,k) if self.config.has_option(j,k) else ''
                            orig = ''
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
                            #print(self.config.get(j,k))
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


        # If directory, where mkbackup-btrfs is started from, is one of SNP or
        # BKP, set SRC to the configured path and store
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

    def getssh(self,tag,store):
        tg = tag if tag in self.ssh else 'DEFAULT'
        return(self.ssh[tg][store])

    def getSsh(self,tag):
        tg = tag if tag in self.ssh else 'DEFAULT'
        return(self.ssh[tg])

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
                'transfer': False,
                'notification': False,
                'notify_type': None}
        self.config['hourly'] = {'volumes':  '$S,__ALWAYSCURRENT__','interval': '24','transfer': True}
        self.config['daily'] = {'volumes': '$S,__ALWAYSCURRENT__','interval': '7','transfer': True}
        self.config['weekly'] = {'volumes': '$S,__ALWAYSCURRENT__','interval': '5','transfer': True}
        self.config['monthly'] = {'volumes': '$S,__ALWAYSCURRENT__','interval': '12','transfer': True}
        self.config['yearly'] = {'volumes': '$S,__ALWAYSCURRENT__','interval': '7','transfer': True}
        self.config['afterboot'] = {'volumes':  '$S','interval': '4','symlink': 'LASTBOOT'}
        self.config['aptupgrade'] = {'volumes':  '$S','interval': '6','symlink': 'BEFOREUPDATE'}
        self.config['dmin'] = {'volumes': '$S,__ALWAYSCURRENT__','interval': '6'}
        self.config['plugin'] = {'volumes': '$S,__ALWAYSCURRENT__','interval':
                '5','transfer': True, 'notification': True, 'notify_type':
                'mail'}
        self.config['manually'] = {'volumes': '$S,__ALWAYSCURRENT__','interval': '5','symlink': 'MANUALLY','transfer': True}

        with open(self.cfile, 'w') as configfile:
            try:
                self.config.write(configfile)
            except:
                exit("Failure during creation of config-file")
        return(self.config)

    def PrintConfig(self,tag=None,of=None):
        if tag == None:
            seclist = self.config.sections()
        else:
            seclist = [tag]

        out = list()
        if tag == None:
            out.append('[DEFAULT]')
            for j in self.config.defaults():
                out.append("%s = %s" % (j,self.__trnName(self.config.get('DEFAULT',j))))
            out.append('')

        #for i in self.config.sections() if tag == None else [tag]:
        for i in seclist:
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


    def getMountPath(self, store='SRC', tag='DEFAULT', shlogin=False, original=True):
        if store == 'SRC':
                path = self.config.get(tag,'SRC')
        elif store == 'SNP':
                path = self.config.get(tag,'SNPMNT')
        elif store == 'BKP':
               path = self.config.get(tag,'BKPMNT')
        else:
            print("EE - getMountPath: store %s is not allowed (%s) set path to SRC" % (store,tag))
            path = self.config.get('DEFAULT','SRC')
        #print('PATH',tag,path)

        _ssh = path.split(':')
        if len(_ssh) == 1:
            path = _ssh[0]
            SSH = None
        elif len(_ssh) == 2:
            userhost,path = _ssh
            port = '22'
            SSH = [userhost,port]
        elif len(_ssh) == 3:
            userhost,port,path = _ssh
            SSH = [userhost,port]

        if shlogin:
            return(SSH)
        else:
            if original:
                sshout = ''
                if SSH != None: sshout=':'.join(SSH)+':'
                return(sshout+'/'+path.strip('/'))
            else:
                return('/'+path.strip('/'))

        # avoid deleting of / - but it's buggy, so return above is inserted
        if '/'+path.strip('/') != "/":
            return('/'+path.strip('/'))
        else:
            return(None)

    def getSSHLogin(self,store='SRC',tag='DEFAULT'):
        if self.getMountPath(store=store,tag=tag,shlogin=True) is None:
            return(None)
        else:
            uh,p = self.getMountPath(store=store,tag=tag,shlogin=True)
            return('ssh -p %s %s ' % (p,uh))


    def getStoreName(self,store='SRC',tag='DEFAULT'):
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

    def getStorePath(self,store='SRC',tag='DEFAULT',original=False):
        sn = '/'+self.getStoreName(store=store,tag=tag) if len(self.getStoreName(store=store,tag=tag)) > 0 else ''
        return(self.getMountPath(store=store,tag=tag,original=original) + sn)

    def cmdsh(self,tag='DEFAULT',store='SRC',cmd=''):
        if self.getssh(tag,store) == None:
            return('',subprocess.check_output(cmd, shell=True).decode(),'')
        else:
            out = ''
            conn = self.getssh(tag,store)
            connect(conn)
            return conn['conn'].exec_command(cmd)

    def remotecommand(self,tag='DEFAULT',store='SRC',cmd='',stderr=None):
        if self.getssh(tag,store) == None:
            #print("noconn")
            try:
                ret = subprocess.run(cmd,stderr=stderr,stdout=subprocess.PIPE)
                if ret.returncode > 0:
                    pass 
            except subprocess.CalledProcessError as e:
                raise
            return ret.stdout.decode("utf-8").rstrip('/n')

        else:
            #print("conn",self.ssh[tag][store]['host'])
            out = ''
            conn = self.getssh(tag,store)
            if connect(conn):
                stdin, stdout, stderr = conn['conn'].exec_command(' '.join(cmd))
                if not stdout:
                    #print("Xr")
                    out = stdout.readlines()
                    err = stderr.readlines()
                    return(''.join(out) if len(err) == 0 else False)
                else:
                    #print("Yr",stdout.read().decode("utf-8"))
                    return(stdout.read().decode("utf-8")) 
            else:
                print("Host not reachable (remcomd): %s" % (conn['host']))
                return('')


    def getDevice(self,store='SRC',tag='DEFAULT'):
        mp = self.getMountPath(store=store,tag=tag,original=False)
        conn = self.getssh(tag,store)
        connect(conn)
        mi = MountInfo(conn=conn)
        amount=mi.fstype(mp)
        if mi.fstype(mp) == 'autofs':
            try:
                Myos().stat(self.getStorePath(store=store,tag=tag),conn=conn)
            except:
                Myos().stat(os.path.dirname(self.getStorePath(store=store,tag=tag)),conn=conn)
        mi = MountInfo(conn=self.getssh(tag,store))
        return(mi.device(mp) if mi.fstype(mp) != 'autofs' else None)

    def getUUID(self,store='SRC',tag='DEFAULT'):
        try:
            device = self.getDevice(store=store,tag=tag)
        except FileNotFoundError:
            #print("UID_NOENT")
            #raise FileNotFoundError(errno.ENOENT, os.strerror(errno.ENOENT), store + " " + tag) 
            raise 
        except:
            return None

        #print("DEVICE",device,store,tag)
        if device == None: return None
        cmd = ['/sbin/blkid', device.rstrip("\n"), '-o', 'value', '-s', 'UUID']
        uuid = self.remotecommand(tag,store,cmd)
        #print("UUID",uuid,store,tag,' '.join(cmd))
        return uuid.rstrip('\n') if uuid.rstrip('\n') != '' else None

    
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

    def getVolumes(self,tag='default'):
        #self._read()
        VOLSTRANS = []
        try:
            VOLS = self.config.get(tag,'volumes')
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

