var Lang = imports.lang;
var PopupMenu = imports.ui.popupMenu;
var St = imports.gi.St;
var Clutter = imports.gi.Clutter;
var Util = imports.misc.util;
var Gtk = imports.gi.Gtk;

var ExtensionSystem = imports.ui.extensionSystem;
var ExtensionUtils = imports.misc.extensionUtils;

var DriveMenuItem = new Lang.Class({
    Name: 'DriveMenuItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(drive) {
	this.parent();

	this.label = new St.Label({ text: drive.get_name() });
	this.actor.add(this.label, { expand: true });
        this.actor.label_actor = this.label;

	this.drive = drive;

	var ejectIcon = new St.Icon({ icon_name: 'drive-harddisk-usb-symbolic',
				      style_class: 'popup-menu-icon ' });
    //var ejectIcon = mount.get_icon();
	var ejectButton = new St.Button({ child: ejectIcon });
//	ejectButton.connect('clicked', Lang.bind(this, this._eject));
	this.actor.add(ejectButton);

//        this._changedId = mount.connect('changed', Lang.bind(this, this._syncVisibility));
//        this._syncVisibility();
    }

});
