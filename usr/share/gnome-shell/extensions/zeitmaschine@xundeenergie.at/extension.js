const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Util = imports.misc.util;
const PopupServiceItem = Me.imports.popupServiceItem.PopupServiceItem;
const PopupMenuItem = Me.imports.popupManuallyItem.PopupServiceItem;
var Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;

const refreshTime = 1.0;
let sLabel;
let icon;

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

	    this._loadConfig();

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
			this._refresh();
		}));

		Main.panel.addToStatusArea('backupManager', this);
		
        this._init_menu();
        this._refresh_main();
        
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
	    let appSystem = Shell.AppSystem.get_default();
	    let app = appSystem.lookup_app('org.gnome.Nautilus.desktop');
	    app.activate_full(-1, event.get_time());
	});

        //icon.style_class = 'disk-active-icon';
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
        sLabel.set_text(active ? "active" : "");
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
        return false;
    },

	_init_menu: function() {
		this.menu.removeAll();
		this._entries.forEach(Lang.bind(this, function(service) {
			let enabled = false;
			let active = false;

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
            serviceItem.actionButton.child.style = (active ? "color: #ff0000;" : "color:#ffffff;");

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

	_refresh: function() {
		this.menu.removeAll();
		this._entries.forEach(Lang.bind(this, function(service) {
			let enabled = false;
			let active = false;

			let [_, out, err, stat] = GLib.spawn_command_line_sync(
				this._getCommand(service['service'], 'is-enabled', 'system'));
			
			let enabled = (stat == 0);

			let [_, out, err, stat] = GLib.spawn_command_line_sync(
				this._getCommand(service['service'], 'is-active', 'system'));
			
			let active = (stat == 0);

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
            serviceItem.actionButton.child.style = (active ? "color: #ff0000;" : "color:#ffffff;");

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
        //let kf = new GLib.KeyFile()
        //log('K:'+kf.load_from_file('/etc/mksnapshot.conf',kf,GLib.KeyFile.NONE,null))
        //log(kf.key_file_get_keys())

        let intervals = ['dmin', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'afterboot', 'aptupgrade', 'manually'];
        //let intervals = [];
        let services = []
        for (let i = 0; i < intervals.length; i++) {
            var obj = new Object();
            obj.name = intervals[i]+' backups';
            obj.service = "mkbackup@"+intervals[i]+".service";
            obj.type = "system";
            services.push(obj);
        };
        //let entries = this._settings.get_strv("zeitmaschine");
        //let default_units = [{"name": "backup target", "service": "mkbackup@BKP.target", "type": "system"}];
        //entries = default_units.concat(entries);
        log('SER '+services.length+' '+JSON.stringify(services));
        this._entries = []
        for (let i = 0; i < services.length; i++) {
	        let service = services[i];
            //log(JSON.stringify(default_systemds.concat(entries)));
	        if (!("type" in service))
	        	service["type"] = "system"
	        this._entries.push(service);
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
