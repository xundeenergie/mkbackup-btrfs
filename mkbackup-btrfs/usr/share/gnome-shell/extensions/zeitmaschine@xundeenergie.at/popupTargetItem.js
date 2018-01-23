var Lang = imports.lang;
var PopupMenu = imports.ui.popupMenu;
var St = imports.gi.St;
var Clutter = imports.gi.Clutter;
var Util = imports.misc.util;
var Gtk = imports.gi.Gtk;

var ExtensionSystem = imports.ui.extensionSystem;
var ExtensionUtils = imports.misc.extensionUtils;

var PopupTargetItem = new Lang.Class({
    Name: 'PopupServiceItem',
    Extends: PopupMenu.PopupSwitchMenuItem,

    _init: function(text, active, params) {
        this.parent(text, active, params);

        this.actionButton = new St.Button({ x_align: 1,
                                             reactive: true,
                                             can_focus: true,
                                             track_hover: true,
                                             accessible_name: 'restart',
                                             style_class: 'system-menu-action services-systemd-button-reload' });

	}});


