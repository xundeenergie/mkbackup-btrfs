const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Util = imports.misc.util;
const Gtk = imports.gi.Gtk;

const ExtensionSystem = imports.ui.extensionSystem;
const ExtensionUtils = imports.misc.extensionUtils;

const DriveMenuItem = new Lang.Class({
    Name: 'DriveMenuItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(drive) {
	this.parent();

	this.label = new St.Label({ text: drive.get_name() });
	this.actor.add(this.label, { expand: true });
        this.actor.label_actor = this.label;

	this.drive = drive;

	let ejectIcon = new St.Icon({ icon_name: 'drive-harddisk-usb-symbolic',
				      style_class: 'popup-menu-icon ' });
    //let ejectIcon = mount.get_icon();
	let ejectButton = new St.Button({ child: ejectIcon });
//	ejectButton.connect('clicked', Lang.bind(this, this._eject));
	this.actor.add(ejectButton);

//        this._changedId = mount.connect('changed', Lang.bind(this, this._syncVisibility));
//        this._syncVisibility();
    }

});
