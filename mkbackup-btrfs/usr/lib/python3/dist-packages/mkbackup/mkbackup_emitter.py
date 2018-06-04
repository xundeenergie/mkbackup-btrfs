"""Emmitter functionality."""
import dbus
import dbus.service
import dbus.glib


class Emitter(dbus.service.Object):
    """Emitter DBUS service object."""

    def __init__(self, conn=None, object_path=None, bus_name=None):
        """Initialize the emitter DBUS service object."""
        dbus.service.Object.__init__(self, conn=conn, object_path=object_path)

    @dbus.service.signal(dbus_interface='at.xundeenergie.mkbackup.Status')
    def update(self,*args,**kwargs):
        """Emmit a test signal."""
        print('Emitted a update signal')

    @dbus.service.signal(dbus_interface='at.xundeenergie.mkbackup.Status')
    def start(self,*args,**kwargs):
        """Emmit a test signal."""
        print('Emitted a start signal')

    @dbus.service.signal(dbus_interface='at.xundeenergie.mkbackup.Status')
    def finished(self,*args,**kwargs):
        """Emmit a test signal."""
        print('Emitted a finished signal')

    @dbus.service.signal(dbus_interface='at.xundeenergie.mkbackup.Status')
    def reset(self,*args,**kwargs):
        """Emmit a test signal."""
        print('Emitted a reset signal')

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
