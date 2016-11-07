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
const MountMenuItem = Me.imports.popupMountItem.MountMenuItem;
const DriveMenuItem = Me.imports.popupDriveItem.DriveMenuItem;
var Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;

const refreshTime = 3.0;
let sLabel;
let icon;
let mainicon;
let hostname;
let extMediaName = 'external backup-drive';

const DisabledIcon = 'my-caffeine-off-symbolic';
const EnabledIcon = 'my-caffeine-on-symbolic';


const BackupManager = new Lang.Class({
    Name: 'BackupManager',
    Extends: PanelMenu.Button,

    _entries: [],

	_init: function() {

        //Set a FileMonitor on the config-File. So the Config-File is only
        //read, when it changed.
        this.GF = Gio.File.new_for_path('/etc/mksnapshot.conf');
        this._monitorGF = this.GF.monitor_file(Gio.FileMonitorFlags.NONE,null,null,null)
        this._monitorGF.set_rate_limit(650);
        this._monitorGF.connect("changed", Lang.bind(this, function(monitor, file,o, event) {
            // without this test, _loadConfig() is called more than once!!
            if (event == Gio.FileMonitorEvent.CHANGES_DONE_HINT && ! /~$/.test(file.get_basename())) {
                this._loadConfig();
            }
        }));

        hostname = this._run_command('hostname');
        this._loadConfig();
        this.watchvolume = this._run_command('systemd-escape --path '+this.bkpmnt)+'.mount' 

        //log(this.watchvolume)
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
			this._refresh();
		}));

		Main.panel.addToStatusArea('backupManager', this);
		
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		let bkpitem = this.menu.addAction(_("Open Backups"), function(event) {
			let context = global.create_app_launch_context(event.get_time(), -1);
			let GF = Gio.File.new_for_path('backup');
			Gio.AppInfo.launch_default_for_uri(GF.get_uri(),context);
		});

        this.extItem = new PopupTargetItem(extMediaName, false);
        this.menu.addMenuItem(this.extItem);
        
        this.extItem.connect('toggled', Lang.bind(this, function() {
            GLib.spawn_command_line_async(
                this._getCommand('mkbackup@BKP.target', (this._check_service('mkbackup@BKP.target','active') ? 'stop' : 'start'), 'system'));
        }));

        this.bkpsubmenu = new PopupMenu.PopupSubMenuMenuItem(_('Backup-Intervalle'), true);
        this.bkpsubmenu.icon.icon_name = 'drive-harddisk-usb-symbolic';
        this.menu.addMenuItem(this.bkpsubmenu);

		if(this._entries.length > 0)
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		
		let item = new PopupMenu.PopupMenuItem(_("Make manually snapshot/backup"));
		item.connect('activate', Lang.bind(this, function() {
		    GLib.spawn_command_line_async(
			this._getCommand('mkbackup@manually.service', 'restart', 'system'));
			this.menu.close();
		    }));
		this.menu.addMenuItem(item);

        this._refreshID = Mainloop.timeout_add_seconds(refreshTime, Lang.bind(this, this._refresh_panel));
        // New Volumes to use as backup-media
        this._monitor = Gio.VolumeMonitor.get();
        this._monitor.get_volumes().forEach(Lang.bind(this, this._showVolume));

        //log(Gio.UnixMountPoint.get_device_path('/var/cache/backup'))
        return;
	},

    _run_command: function(COMMAND) {
        let output = "";
        try {
                output = GLib.spawn_command_line_sync(COMMAND, null, null, null, null);
            } catch(e) {
                throw e;
            }

        return output[1].toString().replace(/\n$/, "") + "";
    },



    _showVolume: function(volume) {
        //log(volume.get_name());
        let drive = volume.get_drive();
        let mount = volume.get_mount();
        if (drive != null && mount != null){
            //log(drive.has_volumes(),volume.get_uuid());
            extMediaName = drive.get_name();
            this.extItem.label.text = drive.get_name();
            //log('VOL',drive.get_name(),volume.get_name(),mount.get_name(),'volume can mount:',volume.can_mount())
        }
    },

    _showDrive: function(drive) {
        log('DRIVE',drive.get_name(),drive.get_volumes(),drive.has_media(),drive.is_removable(),drive.has_volumes(),drive.enumerate_identifiers());
        if (drive.is_removable() && drive.has_media()) {
            log('D',drive.get_name(),drive.get_volumes());
            let submenu = new PopupMenu.PopupSubMenuMenuItem(_(drive.get_name()), true);
            submenu.icon.icon_name = 'drive-harddisk-usb-symbolic';
            submenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            let menuItem = new PopupMenuItem('BLA');
            submenu.menu.addMenuItem(menuItem);

            //log('VOLUME',volume.get_name(),volume.get_uuid(),volume.get_icon(),volume.get_mount(),volume.can_mount(),volume.can_eject());
            drive.get_volumes().forEach(Lang.bind(this, function(volume) {
                if (volume.can_mount()){
                    let menuItem = new PopupMenuItem(volume.get_name());
                    submenu.menu.addMenuItem(menuItem);
                    if ( volume.get_mount() != null ) {
                        let mount = volume.get_mount();
                        log('MR',mount.get_root());
                    }
                }
            
            
            }));
            this.menu.addMenuItem(submenu,1);
        }

    },

    _addMount: function(mount) {
        log('MOUNT',mount.get_drive(),mount.get_volume())
        if( mount.get_drive()){
            let d = mount.get_drive();
            log('DN',d.get_name());
        
        } else
            log('NOK')
            
	//let item = new MountMenuItem(mount);
	//this._mounts.unshift(item);
	//this.menu.addMenuItem(item, 0);
    //log('ADD MOUNT '+mount.get_uuid()+'|'+mount.can_unmount()+' '+mount.can_eject()+' '+mount.get_name()+' '+mount.get_default_location().toSource());
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

    _refresh_panel : function() {

        let active = false;
        let volumes = []
        volumes.push(this.watchvolume)

        volumes.push('home-jakob-Videos-extern.mount')
        //let volumes = ['var-cache-backup.mount', 'home-jakob-Videos-extern.mount'];

        for (var vol in volumes) {
            let [_, out, err, stat] = GLib.spawn_command_line_sync(
                this._getCommand(volumes[vol], 'is-active', 'system'));
            
            active = (stat == 0 || active);
        };

        mainicon.style = (active ? "color: #ff0000;" : "color: revert;");
        sLabel.set_text(active ? _("active") : "");

		if (this.menu.isOpen) {
            //Menu is open
            let me = this.menu._getMenuItems();
			me.forEach(Lang.bind(this, function(item) {
                //log(item.label.text)
				if ( item.label.text == extMediaName ) {
                    item.setToggleState(this._check_service('mkbackup@BKP.target','active'));
				} 
			}));
            if (this.bkpsubmenu.menu.isOpen)  {
                //Submenu Backu-intervals open
                this._refresh();
            }
        }

        if (this._refreshID != 0)
                Mainloop.source_remove(this._refreshID);
        this._refreshID = Mainloop.timeout_add_seconds(refreshTime, Lang.bind(this, this._refresh_panel));
        GLib.Source.set_name_by_id(this._refreshID, '[gnome-shell] this._refresh_panel');
        return false;
    },

    _check_service: function(service,stat) {
        let [_, aout, aerr, astat] = GLib.spawn_command_line_sync(
                            this._getCommand(service, 'is-'+stat, 'system'));

        return (astat == 0);

    },

	_refresh: function() {
		
		//log('refresh menu 1, menu is open:',this.menu.isOpen)
		//log('refresh submenu , menu is open:',this.bkpsubmenu.menu.isOpen)
		//this._loadConfig();
		let me = this.bkpsubmenu.menu._getMenuItems();
        //log(this._entries)
		this._entries.forEach(Lang.bind(this, function(service) {
            service.enabled = false;
            service.staticserv = false;
            service.staticserv = false;
            service.active = false;
            service.found = false;
			let serviceItem
			
			let [_, eout, eerr, estat] = GLib.spawn_command_line_sync(
				this._getCommand(service['service'], 'is-enabled', 'system'));

            if ( eout.toString().replace(/\n$/, "") == 'static' ) 
                service.staticserv = true;

			service.enabled = (estat == 0);

			let [_, aout, aerr, astat] = GLib.spawn_command_line_sync(
				this._getCommand(service['service'], 'is-active', 'system'));

			service.active = (astat == 0);

			me.forEach(Lang.bind(this, function(item) {
				if ( item.label.text == service['name'] ) {
					service.found = true;
					serviceItem = item;
					me.splice(me.indexOf(item),1);
				} 
			}));

            //log('S',service['found'],service.found)
			if (service.found) {
				//log('update',service['name']);
				if ( service.staticserv ) {
					serviceItem.setToggleState(service.active);
				} else  {
					serviceItem.setToggleState(service.enabled);
				}
			} else {
				//log('new',service['name']);
				if ( service.staticserv ) {
					serviceItem = new PopupTargetItem(service['name'], service.active);
					this.bkpsubmenu.menu.addMenuItem(serviceItem);
					
					serviceItem.connect('toggled', Lang.bind(this, function() {
						GLib.spawn_command_line_async(
							this._getCommand(service['service'], (this._check_service(service.service, 'active') ? 'stop' : 'start'), service["type"]));
					}));
				} else {
					serviceItem = new PopupServiceItem(service['name'], service.enabled);
					this.bkpsubmenu.menu.addMenuItem(serviceItem);

					serviceItem.connect('toggled', Lang.bind(this, function() {
						GLib.spawn_command_line_async(
							this._getCommand(service['service'], (this._check_service(service.service, 'enabled') ? 'disable' : 'enable'), service["type"]));
					}));

					serviceItem.actionButton.connect('clicked', Lang.bind(this, function() {
						GLib.spawn_command_line_async(
							this._getCommand(service['service'], (this._check_service(service.service, 'active') ? 'stop' : 'start'), service["type"]));
						this.menu.close();
					}));
				}
			}
            if (serviceItem.actionButton.child) {
                serviceItem.actionButton.child.icon_name = (service.active ? EnabledIcon : DisabledIcon);
                serviceItem.actionButton.child.style = (service.active ? "color: #ff0000;" : "color: revert;");
            };
            if (serviceItem.transferButton) {
                serviceItem.transferButton.style = (service.tr ? "text-decoration: revert;" : "text-decoration: line-through;");
            };
		}));

		this.bkpsubmenu.menu._getMenuItems().forEach(Lang.bind(this, function(item) {
            let mic = 0
			if ( me.length > mic ) {
				for (let i = mic; i < me.length; i++) {
					if (item == me[i]) {
                        log('DESTROY',me[i].label.text);
						item.destroy();

					}

				}
			}
		}));


		return true;
	},

    _loadConfig: function() {
        log('LOAD CONFIG')
        let intervals
        let services = []
        let kf = new GLib.KeyFile()
        let obj = new Object();
        this._entries = [];

        if(kf.load_from_file('/etc/mksnapshot.conf',GLib.KeyFileFlags.NONE)){
            //intervals = kf.get_groups()[0];
            this.bkpmnt = kf.get_value('DEFAULT','bkpmnt')

            //log('BKP',this.bkppath)
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
