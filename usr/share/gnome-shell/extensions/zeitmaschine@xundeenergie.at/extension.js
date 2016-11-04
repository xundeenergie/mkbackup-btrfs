const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Shell = imports.gi.Shell;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Util = imports.misc.util;
const PopupServiceItem = Me.imports.popupServiceItem.PopupServiceItem;
const PopupTargetItem = Me.imports.popupTargetItem.PopupTargetItem;
const PopupMenuItem = Me.imports.popupManuallyItem.PopupServiceItem;
//const MountMenuItem = Me.imports.popupMountItem.PopupMountItem;
var Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;

const refreshTime = 1.0;
let sLabel;
let icon;
let mainicon;

const DisabledIcon = 'my-caffeine-off-symbolic';
const EnabledIcon = 'my-caffeine-on-symbolic';


const BackupManager = new Lang.Class({
    Name: 'BackupManager',
    Extends: PanelMenu.Button,

    _entries: [],

	_init: function() {
		PanelMenu.Button.prototype._init.call(this, 0.0);

		this._settings = Convenience.getSettings();
		this._settings.connect('changed', Lang.bind(this, this._loadConfig));

		//this._loadConfig();

//this.mount = mount;

		let hbox = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
		mainicon = new St.Icon({icon_name: 'drive-harddisk-usb-symbolic', 
			style_class: 'system-status-icon'});

		sLabel = new St.Label({
			text: '---',
			style_class: 'iospeed-label'
		});

		hbox.add_child(sLabel);
		hbox.add_child(mainicon);
		hbox.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));

		this.actor.add_actor(hbox);
		this.actor.add_style_class_name('panel-status-button');

		this.actor.connect('button-press-event', Lang.bind(this, function() {
			//Mainloop.timeout_add_seconds(refreshTime, Lang.bind(this, this._refresh));
			this._refresh();
		}));

		Main.panel.addToStatusArea('backupManager', this);
		
		this._init_menu();
		this._refresh_main();
		this._refresh();

		this._monitor = Gio.VolumeMonitor.get();
		this._addedId = this._monitor.connect('mount-added', Lang.bind(this, function(monitor, mount) {
			this._checkMount(mount);
			//this._updateMenuVisibility();
		}));
		/*	this._addedId = this._monitor.connect('mount-added', Lang.bind(this, function(monitor, mount) {
		    this._addMount(mount);
		    this._updateMenuVisibility();
		}));
		this._removedId = this._monitor.connect('mount-removed', Lang.bind(this, function(monitor, mount) {
		    this._removeMount(mount);
		    this._updateMenuVisibility();
		}));*/

		this._mounts = [ ];

		this._monitor.get_mounts().forEach(Lang.bind(this, this._addMount));
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.menu.addAction(_("Open File"), function(event) {
			let context = global.create_app_launch_context(event.get_time(), -1);
			let GF = Gio.File.new_for_path('backup');
			Gio.AppInfo.launch_default_for_uri(GF.get_uri(),context);
		});

	},

    _addMount: function(mount) {
	//let item = new MountMenuItem(mount);
	//this._mounts.unshift(item);
	//this.menu.addMenuItem(item, 0);
    log('ADD MOUNT '+mount.get_uuid()+'|'+mount.can_unmount()+' '+mount.can_eject()+' '+mount.get_name()+' '+mount.get_default_location().toSource());
    },

    _checkMount: function(mount) {
        log('CHECK MOUNT '+mount.can_unmount()+' '+mount.can_eject());
        log('VOLUME '+mount.get_volume());
        return(mount.can_unmount() || mount.can_eject())
    },
    /*_addMount: function(mount) {
	let item = new MountMenuItem(mount);
	this._mounts.unshift(item);
	this.menu.addMenuItem(item, 0);
    },

    _removeMount: function(mount) {
	for (let i = 0; i < this._mounts.length; i++) {
	    let item = this._mounts[i];
	    if (item.mount == mount) {
		item.destroy();
		this._mounts.splice(i, 1);
		return;
	    }
	}
	log ('Removing a mount that was never added to the menu');
    },

 */
	_getCommand: function(service, action, type) {
		let command = "systemctl"

		command += " " + action
		command += " " + service
		command += " --" + type
		if (type == "system" && (action != 'is-active' && action != 'is-enabled'))
			command = "pkexec --user root " + command

		return 'sh -c "' + command + '; exit;"'
	},

    _refresh_main: function() {
        let active = false;
        //let active2 = false;
        let msg = '';
        let sc = '';

        let volumes = ['var-cache-backup.mount', 'home-jakob-Videos-extern.mount'];

        for (var vol in volumes) {
            let [_, out, err, stat] = GLib.spawn_command_line_sync(
                this._getCommand(volumes[vol], 'is-active', 'system'));
            
            active = (stat == 0 || active);
        };

        mainicon.style = (active ? "color: #ff0000;" : "color:#ffffff;");
        sLabel.set_text(active ? _("active") : "");
        /*let volumes = ['/var/cache/backup', '/home/jakob/Videos/extern'];
        for (var vol in volumes) {
            let stat = _checkMount(var);
            
            active = (stat == 0 || active);
        };*/

        /*if (!this.mount.can_eject() && !this.mount.can_unmount())
            return false;
        if (this.mount.is_shadowed())
            return false;
        let volume = this.mount.get_volume();

        if (volume == null) {
            // probably a GDaemonMount, could be network or
            // local, but we can't tell; assume it's local for now
            return true;
        }
        
        */

        Mainloop.timeout_add_seconds(refreshTime, Lang.bind(this, this._refresh_main));
        //log('ML',Mainloop.timeout_add_seconds(refreshTime, Lang.bind(this, this._refresh)));
	//Mainloop.source_remove('the id from above');
        return false;
    },

	_init_menu: function() {
		this.menu.removeAll();
		return true;
	},

	_refresh: function() {
		log('XXXXXXX')
		this._loadConfig();
		let me = this.menu._getMenuItems();
		this._entries.forEach(Lang.bind(this, function(service) {
			let enabled = false;
			let active = false;
			let transfer = service['tr'];
			let serviceItem
			
			let [_, eout, eerr, estat] = GLib.spawn_command_line_sync(
				this._getCommand(service['service'], 'is-enabled', 'system'));

			let enabled = (estat == 0);

			let [_, aout, aerr, astat] = GLib.spawn_command_line_sync(
				this._getCommand(service['service'], 'is-active', 'system'));

			let active = (astat == 0);
			let found = false

			me.forEach(Lang.bind(this, function(item) {
				if ( item.label.text == service['name'] ) {
					found = true;
					serviceItem = item;
					me.splice(me.indexOf(item),1);
				} 
			}));
			if (found) {
				//log('update',service['name']);
				if ( eout.toString().replace(/\n$/, "") == 'static' ) {
					serviceItem.setToggleState(active);
				} else {
					serviceItem.actionButton.child.icon_name = (active ? EnabledIcon : DisabledIcon);
					serviceItem.actionButton.child.style = (active ? "color: #ff0000;" : "color: revert;");
					if (transfer == "none")
						serviceItem.transferButton.label = "target";
					else
						serviceItem.transferButton.style = (transfer ? "text-decoration: revert;" : "text-decoration: line-through;");
				}
			} else {
				//log('new',service['name']);
				if ( eout.toString().replace(/\n$/, "") == 'static' ) {
					serviceItem = new PopupTargetItem(service['name'], active);
					this.menu.addMenuItem(serviceItem);
					
					serviceItem.connect('toggled', Lang.bind(this, function() {
						GLib.spawn_command_line_async(
							this._getCommand(service['service'], (active ? 'stop' : 'start'), service["type"]));
					}));
				} else {
					serviceItem = new PopupServiceItem(service['name'], enabled);
					this.menu.addMenuItem(serviceItem);

					serviceItem.connect('toggled', Lang.bind(this, function() {
						GLib.spawn_command_line_async(
							this._getCommand(service['service'], (enabled ? 'disable' : 'enable'), service["type"]));
					}));

					serviceItem.actionButton.connect('clicked', Lang.bind(this, function() {
						GLib.spawn_command_line_async(
							this._getCommand(service['service'], 'restart', service["type"]));
						this.menu.close();
					}));
					serviceItem.actionButton.child.icon_name = (active ? EnabledIcon : DisabledIcon);
					serviceItem.actionButton.child.style = (active ? "color: #ff0000;" : "color: revert;");
					if (transfer == "none")
						serviceItem.transferButton.label = "target";
					else
						serviceItem.transferButton.style = (transfer ? "text-decoration: revert;" : "text-decoration: line-through;");
				}
			}

		}));
		this.menu._getMenuItems().forEach(Lang.bind(this, function(item) {
			if ( me.length > 2 ) {
				for (let i = 2; i < me.length; i++) {
					if (item == me[i]) {
						item.destroy();
					}

				}
			}
		}));
		return

		this.menu.removeAll();
		this._monitor.get_mounts().forEach(Lang.bind(this, this._addMount));
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.menu.addAction(_("Open File"), function(event) {
			let appSystem = Shell.AppSystem.get_default();
			let app = appSystem.lookup_app('org.gnome.Nautilus.desktop');
			app.activate_full(-1, event.get_time());
		});

		this._entries.forEach(Lang.bind(this, function(service) {
			let enabled = false;
			let active = false;
			let transfer = service['tr'];

			let [_, eout, eerr, estat] = GLib.spawn_command_line_sync(
				this._getCommand(service['service'], 'is-enabled', 'system'));

			let enabled = (estat == 0);

			let [_, aout, aerr, astat] = GLib.spawn_command_line_sync(
				this._getCommand(service['service'], 'is-active', 'system'));

			let active = (astat == 0);

			if ( eout.toString().replace(/\n$/, "") == 'static' ) {
				let targetItem = new PopupTargetItem(service['name'], active);
				this.menu.addMenuItem(targetItem);
				
				targetItem.connect('toggled', Lang.bind(this, function() {
					GLib.spawn_command_line_async(
						this._getCommand(service['service'], (active ? 'stop' : 'start'), service["type"]));
				}));
			} else {
				let serviceItem = new PopupServiceItem(service['name'], enabled);
				this.menu.addMenuItem(serviceItem);

				serviceItem.connect('toggled', Lang.bind(this, function() {
					GLib.spawn_command_line_async(
						this._getCommand(service['service'], (enabled ? 'disable' : 'enable'), service["type"]));
				}));

				serviceItem.actionButton.connect('clicked', Lang.bind(this, function() {
					GLib.spawn_command_line_async(
						this._getCommand(service['service'], 'restart', service["type"]));
					this.menu.close();
				}));

				serviceItem.actionButton.child.icon_name = (active ? EnabledIcon : DisabledIcon);
				serviceItem.actionButton.child.style = (active ? "color: #ff0000;" : "color: revert;");
				if (transfer == "none")
					serviceItem.transferButton.label = "target";
				else
					serviceItem.transferButton.style = (transfer ? "text-decoration: revert;" : "text-decoration: line-through;");
			}


		}));

		if(this._entries.length > 0)
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		
		let item = new PopupMenu.PopupMenuItem(_("Make manually snapshot/backup"));
		item.connect('activate', Lang.bind(this, function() {
		    GLib.spawn_command_line_async(
			this._getCommand('mkbackup@manually.service', 'restart', 'system'));
			this.menu.close();
		    }));
		this.menu.addMenuItem(item);

		return true;
	},

    _loadConfig: function() {
	let intervals
        let services = []
        let kf = new GLib.KeyFile()
	let obj = new Object();
	obj.name = _('external drive');
	obj.interval = 'BKP';
	obj.service = "mkbackup@BKP.target";
	obj.type = "system";
	obj.tr = "none";
	this._entries = [];
	this._entries.push(obj);

	if(kf.load_from_file('/etc/mksnapshot.conf',GLib.KeyFileFlags.NONE)){
		//intervals = kf.get_groups()[0];
		kf.get_groups()[0].forEach(Lang.bind(this, function(interval) {
			let obj = new Object();
			let i = ""
			if (interval === 'DEFAULT')
				i = 'misc'
			else
				i = interval
			obj.name = i +' backups';
			obj.interval = interval;
			obj.service = "mkbackup@"+i+".service";
			obj.type = "system";
			try {
				obj.tr = (kf.get_value(interval,"transfer").toLowerCase() === "true");
			} catch(err) {
				obj.tr = (kf.get_value("DEFAULT","transfer").toLowerCase() === "true");
			}
			this._entries.push(obj)}));
	} 
    }
});

let backupManager;

function init(extensionMeta) {
    //Convenience.initTranslations();
    let theme = imports.gi.Gtk.IconTheme.get_default();
    theme.append_search_path(extensionMeta.path + "/icons");
}


function enable() {
	backupManager = new BackupManager();

}

function disable() {
	backupManager.destroy();
}
