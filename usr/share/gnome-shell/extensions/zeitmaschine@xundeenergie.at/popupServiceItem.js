const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Util = imports.misc.util;
const Gtk = imports.gi.Gtk;

const ExtensionSystem = imports.ui.extensionSystem;
const ExtensionUtils = imports.misc.extensionUtils;
const DisabledIcon = 'my-caffeine-off-symbolic';
//const DisabledIcon = 'gnome-spinner';

const PopupServiceItem = new Lang.Class({
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

        let icon = new St.Icon({ icon_name: DisabledIcon }) 
        this.actionButton.child = icon;
        this.actor.add(this.actionButton, { expand: false, x_align: St.Align.END });

        this.transferButton = new St.Button({ label: 'transfer',
					     x_align: 1,
                                             reactive: true,
                                             can_focus: true,
                                             track_hover: true,
                                             accessible_name: 'transfer',
                                             style_class: 'system-menu-action services-systemd-button-transfer' });

        //this.transferButton.child = new St.Icon({ icon_name: 'media-eject-symbolic' });
        this.actor.add(this.transferButton, { expand: false, x_align: St.Align.END });
    },

});
