var Lang = imports.lang;
var PopupMenu = imports.ui.popupMenu;
var St = imports.gi.St;
var Clutter = imports.gi.Clutter;
var Util = imports.misc.util;
var Gtk = imports.gi.Gtk;

var ExtensionSystem = imports.ui.extensionSystem;
var ExtensionUtils = imports.misc.extensionUtils;
var DisabledIcon = 'my-caffeine-off-symbolic';
var description = "Beschreibung";
//var DisabledIcon = 'gnome-spinner';

var PopupServiceItem = new Lang.Class({
    Name: 'PopupServiceItem',
    Extends: PopupMenu.PopupSwitchMenuItem,

    _init: function(text, active, params) {
        this.parent(text, active, params);

/*        this.descriptionLabel = new St.Button({
                label: description, 
                reactive: false, 
                x_align: St.Align.START,
                can_focus: false,
                accessible_name: 'description'});
        this.actor.add(this.descriptionLabel, {expand: true});
*/
        this.actionButton = new St.Button({ 
                x_align: 1,
                reactive: true,
                can_focus: true,
                track_hover: true,
                accessible_name: 'restart',
                style_class: 'system-menu-action services-systemd-button-reload' });

        var icon = new St.Icon({ icon_name: DisabledIcon }) 
        this.actionButton.child = icon;
        this.actor.add(this.actionButton, { expand: false, x_align: St.Align.END });

        this.transferButton = new St.Button({ 
                label: 'transfer',
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
