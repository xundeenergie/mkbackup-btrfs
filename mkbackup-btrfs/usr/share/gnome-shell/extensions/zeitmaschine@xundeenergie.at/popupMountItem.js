const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Util = imports.misc.util;
const Gtk = imports.gi.Gtk;

const ExtensionSystem = imports.ui.extensionSystem;
const ExtensionUtils = imports.misc.extensionUtils;

const MountMenuItem = new Lang.Class({
    Name: 'MountMenuItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(mount) {
	this.parent();

	this.label = new St.Label({ text: mount.get_name() });
	this.actor.add(this.label, { expand: true });
        this.actor.label_actor = this.label;

	this.mount = mount;

	let ejectIcon = new St.Icon({ icon_name: 'media-eject-symbolic',
				      style_class: 'popup-menu-icon ' });
    //let ejectIcon = mount.get_icon();
	let ejectButton = new St.Button({ child: ejectIcon });
	ejectButton.connect('clicked', Lang.bind(this, this._eject));
	this.actor.add(ejectButton);

        this._changedId = mount.connect('changed', Lang.bind(this, this._syncVisibility));
        this._syncVisibility();
    },

    destroy: function() {
        if (this._changedId) {
            this.mount.disconnect(this._changedId);
            this._changedId = 0;
        }

        this.parent();
    },

    _isInteresting: function() {
        if (!this.mount.can_eject() && !this.mount.can_unmount())
            return false;
        if (this.mount.is_shadowed())
            return false;

        let volume = this.mount.get_volume();

        if (volume == null) {
            // probably a GDaemonMount, could be network or
            // local, but we can't tell; assume it's local for now
            return true;
        }

        return volume.get_identifier('class') != 'network';
    },

    _syncVisibility: function() {
        this.actor.visible = this._isInteresting();
    },

    _eject: function() {
        let mountOp = new ShellMountOperation.ShellMountOperation(this.mount);

	if (this.mount.can_eject())
	    this.mount.eject_with_operation(Gio.MountUnmountFlags.NONE,
                                            mountOp.mountOp,
					    null, // Gio.Cancellable
					    Lang.bind(this, this._ejectFinish));
	else
	    this.mount.unmount_with_operation(Gio.MountUnmountFlags.NONE,
                                              mountOp.mountOp,
			                      null, // Gio.Cancellable
			                      Lang.bind(this, this._unmountFinish));
    },

    _unmountFinish: function(mount, result) {
	try {
	    mount.unmount_with_operation_finish(result);
	} catch(e) {
	    this._reportFailure(e);
	}
    },

    _ejectFinish: function(mount, result) {
	try {
	    mount.eject_with_operation_finish(result);
	} catch(e) {
	    this._reportFailure(e);
	}
    },

    _reportFailure: function(exception) {
	let msg = _("Ejecting drive '%s' failed:").format(this.mount.get_name());
	Main.notifyError(msg, exception.message);
    },

    activate: function(event) {
        let context = global.create_app_launch_context(event.get_time(), -1);
        Gio.AppInfo.launch_default_for_uri(this.mount.get_root().get_uri(),
                                           context);

	this.parent(event);
    }
});
