#!/usr/bin/python3 -u

import argparse
import re
import datetime

import subprocess
import os
from mksnapshotconfig import Config

class SubVolume:
    what = 'store all informations about a btrfs-Subvolume'

    def __init__(self,args,name,store='SRC'):
        self.timestamp    = datetime.datetime.now().strftime('%Y-%m-%d_%H:%M:%S')
        self.tag          = args.tag
        self.exist        = True
        self.config       = Config()
        self.store        = store
        self.storepath    = self.config.getStorePath(self.store)
        self.mountpath    = self.config.getMountPath(self.store)
        self.storename    = self.config.getStoreName(self.store)
        self.path         = ''
        self.dir          = ''
        if store    == 'SRC':
            self.name     = os.path.basename(name)
        else:
            self.name     = name
        self.basename     = name.split('.')[0]
        self.uuid         = '' #UUID
        self.puuid        = '' #Parent-UUID
        self.ruuid        = '' #Received UUID
        self.ctime        = '' #Creation Time
        self.svid         = 0 #subvolume-ID
        self.gen          = 0 # Generation
        self.cgen         = 0 #Generation at creationtime
        self.pid          = 0 #Parent ID
        self.tlid         = 0 #Top level ID
        self.flags        = 0 #Flags
        self.snapshots    = [] #List of snapshots made from this subvolume
        self.parent       = ''
        self.subvolsshort = []
        self.subvolumes   = []

        self.translate={'Name':'name',
                        'UUID':'uuid',
                        'Parent UUID':'puuid',
                        'Received UUID':'ruuid',
                        'Creation time':'ctime',
                        'Subvolume ID':'svid',
                        'Generation':'gen',
                        'Gen at creation':'cgen',
                        'Parent ID':'pid',
                        'Top level ID':'tlid',
                        'Flags':'flags',
                        'Snapshot(s)':'snapshots'}
        self.main()

    def tr_att(self,att):
        if att in self.translate:
            return self.translate[att]
        else:
            return att

    def read_subvol_info(self):
        subvolume_data = dict()
        cmd = ['btrfs','subvolume','show',self.storepath+'/'+self.name]
        sv = False
        snaps=[]
        try:
            for line in subprocess.check_output(cmd,stderr=subprocess.DEVNULL).splitlines():
                args = [arg.strip() for arg in str(line, encoding='utf8').split(': ')]
                if len(args) > 1:
                    subvolume_data[self.tr_att(args[0])]=args[1]
                    setattr(self, self.tr_att(args[0]), args[1])
                elif sv:
                    snaps.append(args[0])
                else:
                    if args[0] == 'Snapshot(s):': 
                        sv = True
                    else:
                        subvolume_data['path']=args[0]
                        self.path=args[0]
            self.snapshots = snaps
            self.dir       = os.path.dirname(subvolume_data['path'])
            subvolume_data['snapshots'] = self.snapshots
            subvolume_data['dir']       = self.dir
            return(subvolume_data)
        except:
            self.exist = False
            return

    def get_parent(self):
        cmd = ['btrfs','subvolume','list','-o','-u',self.dir]
        for line in subprocess.check_output(cmd,stderr=subprocess.DEVNULL).splitlines():
            args = [arg.strip() for arg in str(line, encoding='utf8').split(' ')]
            if args[8] == self.puuid:
                self.parent=args[10:]

    def list_sisters(self,older=False,store='SRC',subvol='/'):
        self.get_parent()
        SNAPS = dict()
        BKPS  = dict()
        regex = re.compile('.part$')

        # get older sisters in SNP
        cmd = ['btrfs','subvolume','list','-u','-q','-R','-c','--sort=-ogen',self.config.getStorePath(store)+subvol]
        for line in subprocess.check_output(cmd,stderr=subprocess.DEVNULL).splitlines():
            args = [arg.strip() for arg in str(line, encoding='utf8').split(' ')]
            name = ' '.join(args[16:])
            if args[10] == self.puuid and not regex.search(name):
                SNAPS[name] = {'gen':args[3],'cgen':args[5],'puuid':args[10],'ruuid':args[12],'uuid':args[14]}
        self.sisters = SNAPS
        return SNAPS

    def read_subvolumes(self,name):
        os.chdir(self.mountpath)
        cmd = ['btrfs','subvolume','list','-o',name]
        subs=[]
        subsshort=[]
        try:
            for line in subprocess.check_output(cmd,stderr=subprocess.DEVNULL).splitlines():
                args = [arg.strip() for arg in str(line, encoding='utf8').split(' ')]
                for i in [' '.join(args).partition("path ")[2]]:
                    sep = self.name+'/'
                    subsshort.extend([i.partition(sep)[2]])
                    subs.extend([i])
                    #subsshort.extend(self.read_subvolumes(i).partition[sep][2])
                    A = self.read_subvolumes(i)
                    subs.extend(A)
                    subsshort.extend([i.partition(sep)[2] for i in A])
                    #print(A)
            self.subvolumes = subs
            self.subvolsshort = subsshort
        except:
            self.exist = False
            self.subvolumes = subs
            self.subvolsshort = subsshort
        return(subs)
                


    def main(self):
        print('XXXX')
        self.read_subvol_info()
        self.read_subvolumes(self.storename+'/'+self.name)
        #self.subvolumes = self.read_subvolumes(self.storename+'/'+self.name)

def main(args):
    for st in args.store:
        for s in args.snapshot:
            L=SubVolume(ags,s,store=st)
            L.main()
            L.list_sisters()
            #for i in reversed(L.snapshots):
            #    print(i) 

def checksubvol(path):
    if os.path.exists(path):
        finfo = os.stat(path)
        if finfo.st_ino == 256:
            return True
        else:
            return False
    else:
        return None

def create(args):
    for st in args.store:
        for s in args.snapshot:
            L=SubVolume(args,s,store=st)
            print(L.subvolumes)
            #L.main()
            print(L.subvolsshort)
            print(L.name)
            X = L.subvolsshort
            try:
                L.subvolsshort.insert(0, '')
            except:
                L.subovlsshort.append('')
            for sub in X:
            #for sub in L.subvolsshort:
                #print(L.basename+'/'+sub)
                #print(sub)
                inode = checksubvol(L.basename+'/'+sub)
                if inode == True:
                    dest = L.basename+'.'+L.timestamp+'.'+L.tag+'/'+sub
                    dinode = checksubvol(dest)
                    cmd = ['btrfs','subvolume','snapshot',L.dir+'/'+L.name+'/'+sub,dest]
                    print(cmd)
                    if dinode == True:
                        print('subvol: '+dest)
                    elif dinode == False:
                        print('dir: '+dest)

                    else:
                        print('create snapshot: '+dest)

                elif inode == False:
                    print('not existing: '+sub)
                else:
                    print('not existing')
                #print(L.dir,sub)
            else:
                pass

def lists(args):
    lst = []
    for st in args.store:
        for s in args.snapshot:
            L=SubVolume(args,s,store=st)
            L.main()
            print(L.dir,L.name)
            fp=''
            if args.shortpath == True: fp=L.name+'/'
            if args.mountpath == True: fp=L.storename+'/'+L.name+'/'
            if args.fullpath == True: fp=L.storepath+'/'+L.name+'/'
            if args.snap:
                if args.reverse:
                    for i in reversed(L.snapshots):
                        lst.append(fp+i)
                else:
                    for i in L.snapshots:
                        lst.append(fp+i)
            else:
                if args.reverse:
                    for i in reversed(L.subvolsshort):
                        lst.append(fp+i)
                else:
                    for i in L.subvolsshort:
                        lst.append(fp+i)
    for l in lst: print(l)
    return(lst)

def delete(args):
    delsubs = []
    for st in args.store:
        for s in args.snapshot:
            L=SubVolume(args,s,store=st)
            L.main()
            for i in reversed(L.subvolumes):
                delsubs.append(L.mountpath+'/'+i)
    print('delete: '+str(delsubs))

def send_receive(subvol,parent,dest):
    args = ['btrfs','send','-p',parent,subvol]
    args2 = ['btrfs', 'receive',dest]
    process_curl = subprocess.Popen(args, stdout=subprocess.PIPE,
                                    shell=False)
    process_wc = subprocess.Popen(args2, stdin=process_curl.stdout,
                                  stdout=subprocess.PIPE, shell=False)
    # Allow process_curl to receive a SIGPIPE if process_wc exits.
    process_curl.stdout.close()
    return process_wc.communicate()[0]

def transfer(args):
    config=Config()
    trnsubs = dict()
    gen = 0

    for s in args.snapshot:
        L=SubVolume(args,s,store='SNP')
        L.main()
        L.get_parent()
        L.list_sisters()
        cmd=['btrfs','subvolume','list','-R','-u','-q','-c',config.getStorePath('BKP')]
        for line in subprocess.check_output(cmd,stderr=subprocess.DEVNULL).splitlines():
            args = [arg.strip() for arg in str(line, encoding='utf8').split(' ')]
            for snp in L.sisters.keys():
                if args[12] == L.sisters[snp]['uuid'] and L.sisters[snp]['gen'] < L.gen:
                    trnsubs[snp] = L.sisters[snp]['cgen']
        v=list(trnsubs.values())
        k=list(trnsubs.keys())
        L.ypar = k[v.index(max(v))]
        print('-p',L.ypar,L.name)



config=Config()
parser = argparse.ArgumentParser()
parser.add_argument('--version', action='version', version='0.1.0')
parser.add_argument('-V', '--systemvolumes', action='store_true',
        default=False, help='''take the systemvolumes from config. store is
        always SNP''')
parser.add_argument('-t', '--tag', help='''one of %s''' % (config.ListIntervals()))
subparsers = parser.add_subparsers()

list_parser=subparsers.add_parser('list')
list_parser.add_argument("store", 
                        default='SRC', 
                        nargs='*',
                        help='one of SRC, BKP or SNP - where is the snapshot located')
list_parser.add_argument('-r', '--reverse', action='store_true', default=False)
list_parser.add_argument('--snap', action='store_true', default=False, help='list snapshots from the queried snapshot')
list_parser.add_argument('-f', '--fullpath', action='store_true', default=False, help='print full path from /')
list_parser.add_argument('-s', '--shortpath', action='store_true', default=False, help='print path including snapshotname')
list_parser.add_argument('-m', '--mountpath', action='store_true', default=False, help='print path relative to mountpoint of btrfs')
list_parser.set_defaults(func=lists)

create_parser=subparsers.add_parser('create')
create_parser.add_argument("store", 
                        default='SRC', 
                        nargs='*',
                        help='one of SRC, BKP or SNP - where is the snapshot located')
create_parser.set_defaults(func=create)

delete_parser=subparsers.add_parser('delete')
delete_parser.add_argument("store", 
                        default='SRC', 
                        nargs='*',
                        help='one of SRC, BKP or SNP - where is the snapshot located')
delete_parser.set_defaults(func=delete)

transfer_parser=subparsers.add_parser('transfer')
transfer_parser.add_argument("store", 
                        default='SRC', 
                        nargs='*',
                        help='one of SRC, BKP or SNP - where is the snapshot located')
transfer_parser.set_defaults(func=transfer)



if __name__ == '__main__':
    args = parser.parse_args()
    config=Config()
    #args = parser.parse_known_args()
    snst = []
    #snst.extend(args.snapshot)
    snst.extend(args.store)
    #args.snapshot.clear()
    args.snapshot = []
    args.store = []
    for i in snst:
        if i == 'SNP' or i == 'SRC' or i == 'BKP':
            args.store.extend([i])
        else:
            args.snapshot.extend([i])
    if args.systemvolumes:
        print(config.getVolumes())
        args.snapshot=config.getVolumes()
        args.store=['SNP']
    if args.store == []: args.store=['SRC']

    #print(args.store)
    #print(args.snapshot)
    print(args)
    args.func(args)

