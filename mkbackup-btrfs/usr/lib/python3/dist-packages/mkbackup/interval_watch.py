# -*- coding: utf-8 -*-
from __future__ import print_function

from gi.repository import GObject, Gtk, Gio
from mkbackup.uiloader import UILoader

import os

from dfeet.wnck_utils import IconTable

class IntervalBox(Gtk.Box):
    """class to represent a snapshot-interval"""
    def __init__(self, interval):
        super(IntervalBox, self).__init__(spacing=5, expand=True)
        self.__interval_name = interval
        self.__enabled = False
        self.__icon_table = IconTable.get_instance()
        self.__icon_image = Gtk.Image.new_from_pixbuf(self.__icon_table.default_icon)

        self.__hbox = Gtk.HBox(spacing=5, halign=Gtk.Align.START)
        self.pack_start(self.__hbox, True, True, 0)
        # icon
        self.__hbox.pack_start(self.__icon_image, True, True, 0)
        # other information
        self.__vbox_right = Gtk.VBox(spacing=5, expand=True)
        self.__hbox.pack_start(self.__vbox_right, True, True, 0)

        # first element
        self.__label_interval_name = Gtk.Label()
        self.__label_interval_name.set_halign(Gtk.Align.START)
        self.__vbox_right.pack_start(self.__label_interval_name, True, True, 0)
        # second element
        self.__label_info = Gtk.Label()
        self.__label_info.set_halign(Gtk.Align.START)
        self.__vbox_right.pack_start(self.__label_info, True, True, 0)
        # switch to enable/disable it
        self.__switch_enabled = Gtk.Switch()
        self.__switch_enabled.set_halign(Gtk.Align.START)
        self.__switch_enabled.connect('notify::active', self.on_switch_activated)
        self.__vbox_right.pack_start(self.__switch_enabled, True, True, 0)
        # transfer snapshot to backup
        self.__check_transfer = GtkCheckButton()
        self.__check_transfer.set_active(props['transfer'])
        self.__vbox_right.pack_start(self.__check_transfer, True, True, 0)
        # progressbar
        self.__progress = Gtk.ProgressBar()
        self.__progress.set_fraction(props['progress']/100)
        self.__vbox_right.pack_start(self.__progress, True, True, 0)
        # separator for the boxes
        self.pack_end(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL), True, True, 0)
        # update widget information
        self.__update_widget()
        self.show_all()


class IntervalWatch(object):
    """watch a given snapshot-interval"""
    def __init__(self, interval):
        self.__interval_name = interval
        
        # Setup ui
        ui = Gtk.Builder()
        ui.add_from_file("test.glade")
        
