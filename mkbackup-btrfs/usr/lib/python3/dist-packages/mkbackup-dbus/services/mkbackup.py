import dbus
import dbus.service
import random
import time
import os

from mkbackup_btrfs_config import Config, MountInfo, connect, Myos, __version__

config = Config()

class MkBackup:
    def __init__(self, bus_name, base_path):
#        self._bus = dbus.SystemBus()
#        self.notification = Notification()
        Intervals(bus_name, base_path)

        for intv in config.ListIntervals():
            Properties(bus_name, os.path.join(base_path, intv), intv)

class Intervals(dbus.service.Object):
    def __init__(self, bus_name, bus_path):
        super().__init__(bus_name, bus_path)

    @dbus.service.method(dbus_interface='at.xundeenergie.mkbackup.Intervals', 
           in_signature='', out_signature='v')
    def Names(self):
        return config.ListIntervals()
    
class Properties(dbus.service.Object):
    def __init__(self, bus_name, bus_path, interval):
        super().__init__(bus_name, bus_path)
        self.interface = "at.xundeenergie.mkbackup.Status"
        self.interval = interval
        self.STATI = ['reset', 'stop', 'running', 'finished']
        self.properties = dict()
        self.properties[self.interface] = dict()
        self.properties[self.interface]['progress'] = 0 # 0-100 
        self.properties[self.interface]['status'] = 'stop' # stop, running, finished, reset
        self.properties[self.interface]['transfer'] = config.getTransfer(interval)
        self.properties[self.interface]['lastrun'] = 0 # datetime
        self.properties[self.interface]['finished'] = True # Boolean
        self.properties[self.interface]['name'] = interval # Boolean
        self.properties['function'] = dict()
        self.properties['function']['progress'] = self.update_progress
        self.properties['function']['status'] = self.update_status
#        self.properties['function']['lastrun'] = self.update_lastrun
        from dbus import Interface
 
    def update_progress(self, interface, incr):
        print("Update progress: %i / %i, %s" % (float(incr),
            self.properties[interface]['progress'],self.properties[interface]['status']))
        if self.properties[interface]['status'] == 'running':
            if 0 < self.properties[interface]['progress'] + float(incr) < 100:
                #self.properties[interface]['progress'] = self.properties[interface]['progress'] + float(incr)
                self.properties[interface]['progress'] += float(incr)
            elif self.properties[interface]['progress'] + float(incr) >= 100:
                self.properties[interface]['progress'] = 99
            else:
                print('B', incr, type(incr))
        return self.properties[interface]['progress']

    def update_status(self, interface, status):
        if status in self.STATI:
            print("Update status: %s" % status)
            print("Status: ", self.properties[interface]['status'])
            if status == 'finished':
                self.properties[interface]['status'] = status
                self.properties[interface]['progress'] = 100
            elif status == 'stop':
                self.properties[interface]['status'] = status
                self.properties[interface]['progres'] = 0
            elif status == 'reset':
                self.properties[interface]['status'] = 'running'
                self.properties[interface]['progress'] = 0
        print("status: ", self.properties[interface]['status'])
        return self.properties[interface]['status']

    @dbus.service.method(dbus.PROPERTIES_IFACE,
                         in_signature='ss', out_signature='v')
    def Get(self, interface_name, property_name):
        return self.GetAll(interface_name)[property_name]

    @dbus.service.method(dbus.PROPERTIES_IFACE,
                         in_signature='s', out_signature='a{sv}')
    def GetAll(self, interface_name):
        if interface_name == self.interface:
            return self.properties[interface_name]
        else:
            raise dbus.exceptions.DBusException(
                'at.xundeenergie.mkbackup.UnknownInterface',
                'The Foo object does not implement the %s interface'
                    % interface_name)

    @dbus.service.method(dbus.PROPERTIES_IFACE,
                         in_signature='ssv')
    def Set(self, interface_name, property_name, new_value):
        # validate the property name and value, update internal state…
        """https://recalll.co/ask/v/topic/D-Bus-D-Feet-Send-Dictionary-of-String%2CVariants-in-Python-Syntax/5565e1372bd273d7108b7b82
        __import__('gi.repository.GLib', globals(), locals(), ['Variant']).Variant("s", "value")"""
        if interface_name in self.properties:
            if property_name in self.properties[interface_name]:
                func = self.properties['function'].get(property_name)
                new_value = func(interface_name, new_value)
                #self.properties[str(interface_name)][str(property_name)] = new_value
                self.PropertiesChanged(interface_name,
                    { property_name: new_value, 'interval': self.interval}, [])
        else:
            raise dbus.exceptions.DBusException(
                'at.xundeenergie.mkbackup.UnknownInterface',
                'The Foo object does not implement the %s interface'
                    % interface_name)

    @dbus.service.signal(dbus.PROPERTIES_IFACE,
                         signature='sa{sv}as')
    def PropertiesChanged(self, interface_name, changed_properties,
                          invalidated_properties):
        pass
