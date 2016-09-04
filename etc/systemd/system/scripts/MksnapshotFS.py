#!/usr/bin/python -u
#!/usr/bin/env python

#    Copyright (C) 2001  Jeff Epler  <jepler@unpythonic.dhs.org>
#    Copyright (C) 2006  Csaba Henk  <csaba.henk@creo.hu>
#
#    This program can be distributed under the terms of the GNU LGPL.
#    See the file COPYING.
#

import os, sys
from errno import *
from stat import *
import fcntl
# pull in some spaghetti to make this stuff work without fuse-py being installed
try:
    import _find_fuse_parts
except ImportError:
    pass
import fuse
from fuse import Fuse

# JS - Snapshotnamehandling, get the current user and so on
import getpass

from time import strptime, strftime
from datetime import datetime,date,time,timedelta

DEBUG = True

if not hasattr(fuse, '__version__'):
    raise RuntimeError, \
        "your fuse-py doesn't know of fuse.__version__, probably it's too old."

fuse.fuse_python_api = (0, 2)

fuse.feature_assert('stateful_files', 'has_init')


def flag2mode(flags):
    md = {os.O_RDONLY: 'r', os.O_WRONLY: 'w', os.O_RDWR: 'w+'}
    m = md[flags & (os.O_RDONLY | os.O_WRONLY | os.O_RDWR)]

    if flags | os.O_APPEND:
        m = m.replace('w', 'a', 1)

    return m


class Xmp(Fuse):

    def __init__(self, *args, **kw):

        Fuse.__init__(self, *args, **kw)

        if DEBUG:
            for i in args: print "ARG: "+i
            for i in kw: print "KW: "+i

        # do stuff to set up your filesystem here, if you want
        #import thread
        #thread.start_new_thread(self.mythread, ())
        #print self.local
        self.root='/var/cache/btrfs_pool_SYSTEM/'

        self.snapshots={}
        self.direntries=[]
        Xmp.realpath=""
        self.USER=getpass.getuser()
        self.HOME=os.environ['HOME']
        self.BDIRS={'local':'/var/cache/btrfs_pool_SYSTEM','extern':'/var/cache/backup'}
        
# JS - some helpers
    def translate(self,subvolname,location='local'):
        n = len(subvolname.split('.'))
        if n == 1:
            return subvolname+'--'+location
        elif n == 2:
            return subvolname+'--'+location
        elif n == 3:
            sndt = datetime.strptime(subvolname.split('.')[1],"%Y-%m-%d_%H:%M:%S") #snapshot-timestamp
            action = subvolname.split('.')[2]
            if action == 'manually':
                action="-manually"
            elif action == 'aptupgrade':
                action="-aptupgrade"
            else:
                action=""

            snd = datetime.date(sndt) #snapshot-date
            today = datetime.date(datetime.now())
            yesterday = datetime.date(datetime.now()-timedelta(days=1))
            dbyesterday = datetime.date(datetime.now()-timedelta(days=2))
            if snd == today:
                return datetime.strftime(sndt,'heute %H-%M-%S')+'--'+location+action
            elif snd == yesterday:
                return datetime.strftime(sndt,'gestern %H-%M-%S')+'--'+location+action
            elif snd == dbyesterday:
                return datetime.strftime(sndt,'vorgestern %H-%M-%S')+'--'+location+action
            else:
                return datetime.strftime(sndt,'%Y.%B.%d %H-%M-%S')+'--'+location+action
        else:
            return subvolname+'--'+location

    def __lsnapshots(self):
        print "ls snapshots"
        self.snapshots.clear()
        for location in self.BDIRS.iterkeys():
            if DEBUG == True: print 'Scan location '+location
            try:
                dirents = os.listdir(self.BDIRS[location])
            except:
                continue 
            for entry in dirents:
                if os.path.exists(self.BDIRS[location]+'/'+entry+self.HOME) \
                        and not os.path.islink(self.BDIRS[location]+'/'+entry):
                    self.snapshots[self.translate(entry,location=location)] \
                            = [self.BDIRS[location], '/'+entry+self.HOME+'/', location]


    def __realpath(self,path):
        ss = path.split('/')[1]
        sv = './'+'/'.join(path.split('/')[2:])
        if path == "/" and not self.root.strip('/') == self.BDIRS['local'].strip('/') and not self.root == self.BDIRS['extern'].strip('/'):
            Xmp.realpath = path
            return Xmp.realpath
        if ss in self.snapshots:
            self.root = self.snapshots[ss][0]
            Xmp.realpath = self.snapshots[ss][0]+self.snapshots[ss][1]+sv
            return Xmp.realpath
        else: 
            self.root = self.BDIRS['local']
            Xmp.realpath = self.root + path
            return Xmp.realpath

    def __lsdir(self,path):#
        print "ls dir"
        ss = path.split('/')[1]
        subdir = '/'+'/'.join(path.split('/')[2:])
        dirents = ['.', '..']
        if path == "/" and (self.root.strip('/') == self.BDIRS['local'].strip('/') or self.root == self.BDIRS['extern'].strip('/')):
            self.root = self.BDIRS['local']
            dirents.extend(self.snapshots.keys())
        elif ss in self.snapshots or path == "./":
            dirents.extend(os.listdir(self.__realpath(path)))
        else:
            self.root = self.BDIRS['local']
            dirents.extend(os.listdir(path))
        return dirents


#    def mythread(self):
#
#        """
#        The beauty of the FUSE python implementation is that with the python interp
#        running in foreground, you can have threads
#        """
#        print "mythread: started"
#        while 1:
#            time.sleep(120)
#            print "mythread: ticking"

    def getattr(self, path):
        if path == "/" and (self.root.strip('/') == self.BDIRS['local'].strip('/') or self.root == self.BDIRS['extern'].strip('/')):
            return os.lstat('.'+path)
        else:
            return os.lstat(self.__realpath(path))

    def readlink(self, path):
        return os.readlink(self.__realpath(path))

    def readdir(self, path, offset):
        if path == "/" and (self.root.strip('/') == self.BDIRS['local'].strip('/') or self.root == self.BDIRS['extern'].strip('/')):
            print path
        if path == "/": 
            self.__lsnapshots()
        for e in self.__lsdir(path):
            yield fuse.Direntry(e)

    def unlink(self, path):
        return -EROFS
        os.unlink("." + path)

    def rmdir(self, path):
        return -EROFS
        os.rmdir("." + path)

    def symlink(self, path, path1):
        return -EROFS
        os.symlink(path, "." + path1)

    def rename(self, path, path1):
        return -EROFS
        os.rename("." + path, "." + path1)

    def link(self, path, path1):
        return -EROFS
        os.link("." + path, "." + path1)

    def chmod(self, path, mode):
        return -EROFS
        os.chmod("." + path, mode)

    def chown(self, path, user, group):
        return -EROFS
        os.chown("." + path, user, group)

    def truncate(self, path, len):
        return -EROFS
        f = open("." + path, "a")
        f.truncate(len)
        f.close()

    def mknod(self, path, mode, dev):
        return -EROFS
        os.mknod("." + path, mode, dev)

    def mkdir(self, path, mode):
        return -EROFS
        os.mkdir("." + path, mode)

    def utime(self, path, times):
        os.utime(self.__realpath(path), times)

#    The following utimens method would do the same as the above utime method.
#    We can't make it better though as the Python stdlib doesn't know of
#    subsecond preciseness in acces/modify times.
#  
#    def utimens(self, path, ts_acc, ts_mod):
#      os.utime("." + path, (ts_acc.tv_sec, ts_mod.tv_sec))

    def access(self, path, mode):
        if DEBUG: print "access " + path + '||'+str(mode)
        if not os.access(self.__realpath(path), mode):
            return -EACCES

#    This is how we could add stub extended attribute handlers...
#    (We can't have ones which aptly delegate requests to the underlying fs
#    because Python lacks a standard xattr interface.)
#
#    def getxattr(self, path, name, size):
#        val = name.swapcase() + '@' + path
#        if size == 0:
#            # We are asked for size of the value.
#            return len(val)
#        return val
#
#    def listxattr(self, path, size):
#        # We use the "user" namespace to please XFS utils
#        aa = ["user." + a for a in ("foo", "bar")]
#        if size == 0:
#            # We are asked for size of the attr list, ie. joint size of attrs
#            # plus null separators.
#            return len("".join(aa)) + len(aa)
#        return aa

    def statfs(self):
        """
        Should return an object with statvfs attributes (f_bsize, f_frsize...).
        Eg., the return value of os.statvfs() is such a thing (since py 2.2).
        If you are not reusing an existing statvfs object, start with
        fuse.StatVFS(), and define the attributes.

        To provide usable information (ie., you want sensible df(1)
        output, you are suggested to specify the following attributes:

            - f_bsize - preferred size of file blocks, in bytes
            - f_frsize - fundamental size of file blcoks, in bytes
                [if you have no idea, use the same as blocksize]
            - f_blocks - total number of blocks in the filesystem
            - f_bfree - number of free blocks
            - f_files - total number of file inodes
            - f_ffree - nunber of free file inodes
        """

        return os.statvfs(".")

    def fsinit(self):
        print "fsinit"
        os.chdir(self.root)
        self.__lsnapshots()

    class XmpFile(object):

        def __init__(self, path, flags, *mode):
            path = Xmp.realpath
            #print "P: "+path
            self.file = os.fdopen(os.open(path, flags, *mode),
                                  flag2mode(flags))
            self.fd = self.file.fileno()

        def read(self, length, offset):
            self.file.seek(offset)
            return self.file.read(length)

        def write(self, buf, offset):
            return -EROFS
            self.file.seek(offset)
            self.file.write(buf)
            return len(buf)

        def release(self, flags):
            self.file.close()

        def _fflush(self):
            #return -EROFS
            if 'w' in self.file.mode or 'a' in self.file.mode:
                self.file.flush()

        def fsync(self, isfsyncfile):
            #return -EROFS
            self._fflush()
            if isfsyncfile and hasattr(os, 'fdatasync'):
                os.fdatasync(self.fd)
            else:
                os.fsync(self.fd)

        def flush(self):
            #return -EROFS
            self._fflush()
            # cf. xmp_flush() in fusexmp_fh.c
            os.close(os.dup(self.fd))

        def fgetattr(self):
            return os.fstat(self.fd)

        def ftruncate(self, len):
            return -EROFS
            self.file.truncate(len)

        def lock(self, cmd, owner, **kw):
            #return -EROFS
            # The code here is much rather just a demonstration of the locking
            # API than something which actually was seen to be useful.

            # Advisory file locking is pretty messy in Unix, and the Python
            # interface to this doesn't make it better.
            # We can't do fcntl(2)/F_GETLK from Python in a platfrom independent
            # way. The following implementation *might* work under Linux. 
            #
            # if cmd == fcntl.F_GETLK:
            #     import struct
            # 
            #     lockdata = struct.pack('hhQQi', kw['l_type'], os.SEEK_SET,
            #                            kw['l_start'], kw['l_len'], kw['l_pid'])
            #     ld2 = fcntl.fcntl(self.fd, fcntl.F_GETLK, lockdata)
            #     flockfields = ('l_type', 'l_whence', 'l_start', 'l_len', 'l_pid')
            #     uld2 = struct.unpack('hhQQi', ld2)
            #     res = {}
            #     for i in xrange(len(uld2)):
            #          res[flockfields[i]] = uld2[i]
            #  
            #     return fuse.Flock(**res)

            # Convert fcntl-ish lock parameters to Python's weird
            # lockf(3)/flock(2) medley locking API...
            op = { fcntl.F_UNLCK : fcntl.LOCK_UN,
                   fcntl.F_RDLCK : fcntl.LOCK_SH,
                   fcntl.F_WRLCK : fcntl.LOCK_EX }[kw['l_type']]
            if cmd == fcntl.F_GETLK:
                return -EOPNOTSUPP
            elif cmd == fcntl.F_SETLK:
                if op != fcntl.LOCK_UN:
                    op |= fcntl.LOCK_NB
            elif cmd == fcntl.F_SETLKW:
                pass
            else:
                return -EINVAL

            fcntl.lockf(self.fd, op, kw['l_start'], kw['l_len'])


    def main(self, *a, **kw):

        self.file_class = self.XmpFile

        return Fuse.main(self, *a, **kw)


def main():

    usage = """
Userspace nullfs-alike: mirror the filesystem tree from some point on.

""" + Fuse.fusage

    server = Xmp(version="%prog " + fuse.__version__,
                 usage=usage,
                 dash_s_do='setsingle')

    server.parser.add_option(mountopt="root", metavar="PATH", default='/var/cache/btrfs_pool_SYSTEM',
                             help="mirror filesystem from under PATH [default: %default]")
    server.parser.add_option(mountopt="local", metavar="LOCAL", default='/var/cache/btrfs_pool_SYSTEM',
                             help="set path to filesystem from internal HDD/SSD under PATH [default: %default]")
    server.parser.add_option(mountopt="extern", metavar="EXTERN", default='/var/cache/backup',
                             help="set path to filesystem from external HDD/SSD under PATH [default: %default]")
    server.parse(values=server, errex=1)

    try:
        if server.fuse_args.mount_expected():
            os.chdir(server.root)
    except OSError:
        print >> sys.stderr, "can't enter root of underlying filesystem"
        sys.exit(1)

    server.main()


if __name__ == '__main__':
    main()
