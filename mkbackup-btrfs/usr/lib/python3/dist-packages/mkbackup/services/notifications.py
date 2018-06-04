import dbus
import dbus.service
import random
import time
import os

from gi.repository import GLib

from mkbackup_btrfs_config import Config, MountInfo, connect, Myos, __version__
config = Config()

from system_notification_emitter import Emitter
class Notification(Emitter):
    def __init__(self):
        super().__init__(conn=dbus.SystemBus(), object_path='/at/xundeenergie/notifications/advanced/Notification')

class Intervals:
    def __init__(self, bus_name, base_path="/at/xundeenergie/mkbackup"):
        #super().__init__(bus_name, "/at/xundeenergie/mkbackup")
        self.base_path = base_path
        self._bus = dbus.SystemBus()
#        self.stati = dict()
#        self.stati[None] = None
        self.notification = Notification()

        for intv in config.ListIntervals():
#            self.stati[intv] = dict()
#            self.stati[intv]['progress'] = 0
#            self.stati[intv]['trans'] = config.getTransfer(intv)
#            self.stati[intv]['lastrun'] = 0 
#            self.stati[intv]['finished'] = True
            #self._set_listeners(os.path.join(base_path, intv))
#            self.stati[intv]['methods'] = Properties(bus_name,
#                    os.path.join(base_path, intv))
            Properties(bus_name, os.path.join(base_path, intv), intv)

    def _set_listeners(self,dbus_path):
        """
        dbus-send --system "/at/xundeenergie/mkbackup"
        --dest="at.xundeenergie.mkbackup"
        "at.xundeenergie.mkbackup.Status.progress" string:hourly "int16:10"
        """
        update = self._bus.add_signal_receiver(
                path=dbus_path, 
                handler_function=self._progress,
                dbus_interface="at.xundeenergie.mkbackup.Status",
                signal_name='update')

        finished = self._bus.add_signal_receiver(
                path=dbus_path, 
                handler_function=self._finished,
                dbus_interface="at.xundeenergie.mkbackup.Status",
                signal_name='finished')

        start = self._bus.add_signal_receiver(
                path=dbus_path, 
                handler_function=self._start,
                dbus_interface="at.xundeenergie.mkbackup.Status",
                signal_name='start')

        reset = self._bus.add_signal_receiver(
                path=dbus_path, 
                handler_function=self._reset,
                dbus_interface="at.xundeenergie.mkbackup.Status",
                signal_name='reset')

    def _remove_listeners(self,intv):
        update = self._bus.remove_signal_receiver(
                path=dbus_path, 
                dbus_interface="at.xundeenergie.mkbackup.Status",
                signal_name='update')

        finished = self._bus.remove_signal_receiver(
                path=dbus_path, 
                dbus_interface="at.xundeenergie.mkbackup.Status",
                signal_name='finished')

        start = self._bus.remove_signal_receiver(
                path=dbus_path, 
                dbus_interface="at.xundeenergie.mkbackup.Status",
                signal_name='start')

        reset = self._bus.remove_signal_receiver(
                path=dbus_path, 
                dbus_interface="at.xundeenergie.mkbackup.Status",
                signal_name='reset')

        try:
            del self.state[intv]
        except KeyError as ex:
            print("No such key: '%s'" % ex.message)


    def _start(self, intv):
        self.stati[intv]['progress'] = 0
        if self.stati[intv]['finished']:
            print("Reset %s first" % (intv))
            return
        print("%s start" % (intv))

    def _progress(self, intv, progr):
        if progr >= 0 and not self.stati[intv]['finished']:
            if 0 < self.stati[intv]['progress'] + progr <= 99: 
                self.stati[intv]['progress'] += progr
                print("%s run progress: %i/100%%" % (str(intv),
                    int(self.stati[intv]['progress'])))
            else:
                self.stati[intv]['progress'] = 99
        self.sig_update(intv, self.stati[intv]['progress'])
        print("Progress: %s" % (self.stati[intv]['progress']))

    def _finished(self, intv):
        self.stati[intv]['finished'] = True
        self.stati[intv]['progress'] = 100
        self._send_notification(body="%s finished" % (intv))
        self.sig_update(intv, self.stati[intv]['progress'])
        print("%s finished" % (intv))

    def _reset(self, intv):
        self.stati[intv]['finished'] = False
        self.stati[intv]['progress'] = 0
        print("%s reset" % (intv))

    def _send_notification(self, header="backup", body="Unconfigured Message"):
        msg = dict()
        msg['sender'] = "mkbackup"
        msg['header'] = header
        msg['body'] = body 
        self.notification.normal(msg)


class AllStati(dbus.service.Object):
    def __init__(self, bus_name, base_path="/at/xundeenergie/mkbackup"):
        super().__init__(bus_name, base_path)

    @dbus.service.method("at.xundeenergie.mkbackup",
                         in_signature='', out_signature='v')
    def Intervals(self):
        return config.ListIntervals()

MY_INTERFACE = 'at.xundeenergie.mkbackup.Properties'

class Status(dbus.service.Object):
    def __init__(self, bus_name, base_path, intv, stati):
        super().__init__(bus_name, base_path+'/'+intv)
        self.interface_name = base_path+'/'+intv
        self.property_name  = intv
        self.status = stati

    @dbus.service.method("at.xundeenergie.mkbackup.Status",
                         in_signature='', out_signature='v')
    def Progress(self):
        return self.status['progress']

    @dbus.service.method("at.xundeenergie.mkbackup.Status",
                         in_signature='', out_signature='a{sv}')
    def Props(self):
        return {
                'progress': self.status['progress'], 
                'transfer': self.status['trans'],
                'lastrun' : self.status['lastrun'],
                'finished': self.status['finished']
                }

    @dbus.service.signal("at.xundeenergie.mkbackup.Status", signature='si')
    def sig_update(self, intv, progr):
        pass

    @dbus.service.signal("at.xundeenergie.mkbackup.Status", signature='si')
    def sig_finished(self, intv, progr):
        pass

class Properties(dbus.service.Object):
    def __init__(self, bus_name, bus_path, interval):
        super().__init__(bus_name, bus_path)
        self.interface_name = dbus.PROPERTIES_IFACE
        self.interface = "at.xundeenergie.mkbackup.Status"
        self.interval = interval
        self.properties = dict()
        self.properties[self.interface] = dict()
        self.properties[self.interface]['progress'] = 0
        self.properties[self.interface]['transfer'] = config.getTransfer(interval)
        self.properties[self.interface]['lastrun'] = 0
        self.properties[self.interface]['finished'] = True
        from dbus import Interface
 
    @dbus.service.method(dbus.PROPERTIES_IFACE,
                         in_signature='ss', out_signature='v')
    def Get(self, interface_name, property_name):
        return self.GetAll(interface_name)[property_name]

    @dbus.service.method(dbus.PROPERTIES_IFACE,
                         in_signature='s', out_signature='a{sv}')
    def GetAll(self, interface_name):
        print('I', interface_name, 'sI', self.interface, 'P', self.properties,
                'PP',self.properties[interface_name])
        if interface_name == self.interface:
            return self.properties[interface_name]
        else:
            raise dbus.exceptions.DBusException(
                'com.example.UnknownInterface',
                'The Foo object does not implement the %s interface'
                    % interface_name)

    @dbus.service.method(dbus.PROPERTIES_IFACE,
                         in_signature='ssv')
    def Set(self, interface_name, property_name, new_value):
        # validate the property name and value, update internal state…
        """https://recalll.co/ask/v/topic/D-Bus-D-Feet-Send-Dictionary-of-String%2CVariants-in-Python-Syntax/5565e1372bd273d7108b7b82
        __import__('gi.repository.GLib', globals(), locals(), ['Variant']).Variant("s", "value")"""
        if interface_name == self.interface:
            self.properties[str(interface_name)][str(property_name)] = new_value
            self.PropertiesChanged(str(interface_name),
                { str(property_name): new_value }, [])

    @dbus.service.signal(dbus.PROPERTIES_IFACE,
                         signature='sa{sv}as')
    def PropertiesChanged(self, interface_name, changed_properties,
                          invalidated_properties):
        pass
#class Notifications(dbus.service.Object):
#    def __init__(self, bus_name):
#        super().__init__(bus_name, "/at/xundeenergie/mkbackup/Status")
#
#        random.seed()
#
#    @dbus.service.method("at.xundeenergie.mkbackup.Status",
#                         in_signature='i', out_signature='s')
#    def quick(self, bits=8):
#        return str(random.getrandbits(bits))
#
#    @dbus.service.method("at.xundeenergie.mkbackup.Status",
#                         in_signature='i', out_signature='s')
#    def slow(self, bits=8):
#        thread = SlowThread(bits, self.slow_result)
#        return thread.thread_id
#
#    @dbus.service.signal("at.xundeenergie.mkbackup.Status", signature='ss')
#    def slow_result(self, thread_id, result):
#        pass
#   
#   
