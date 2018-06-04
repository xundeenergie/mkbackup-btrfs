"""Emmitter functionality."""
#import dbus
#import dbus.service
import dbus
#import dbus.glib
#import dbus.exceptions
import sys

class Emitter:
    def __init__(self, conn=None, object_path=None, bus_name=None):
        """Initialize the emitter DBUS service object."""
        #dbus.service.Object.__init__(self, conn=conn, object_path=object_path)
        self._bus=dbus.SystemBus()
        try:
            self.proxy = self._bus.get_object(bus_name, object_path)
            self.emitter_iface = dbus.Interface(self.proxy, 
                    'org.freedesktop.DBus.Properties')
            print(self.emitter_iface.GetAll('at.xundeenergie.mkbackup.Status'))
        except dbus.exceptions.DBusException as e:
            print("Failed to initialize D-Bus object: '%s'" % (str(e)))
            sys.exit(2)

    def Reset(self, *args, **kwargs):
        self.emitter_iface.Set("at.xundeenergie.mkbackup.Status", "status", "reset")
        print(self.emitter_iface.Get("at.xundeenergie.mkbackup.Status", "progress"))

    def Start(self, *args, **kwargs):
        self.emitter_iface.Set("at.xundeenergie.mkbackup.Status", "status", "running")
        print(self.emitter_iface.Get("at.xundeenergie.mkbackup.Status", "progress"))

    def Finished(self, *args, **kwargs):
        self.emitter_iface.Set("at.xundeenergie.mkbackup.Status", "status", "finished")
        print(self.emitter_iface.Get("at.xundeenergie.mkbackup.Status", "progress"))

    def Update(self, *args, **kwargs):
        self.emitter_iface.Set("at.xundeenergie.mkbackup.Status", "progress", args[0])
        print(self.emitter_iface.Get("at.xundeenergie.mkbackup.Status", "progress"))



""" Example to use
progress = Emitter(dbus.SystemBus(),
        '/at/xundeenergie/mkbackup/Status')

progress.start(
        {'intv': 'hourly'})

progress.update(
        {'intv': 'hourly', 'progr': 5})

progress.finished(
        {'intv': 'hourly'})

progress.reset(
        {'intv': 'hourly'})
"""
