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
const VolMenuItem = Me.imports.popupBkpVolumItem.PopupBKPItem;
var Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;

const refreshTime = 3.0;
let sLabel;
let icon;
let mainicon;
let extMediaName = 'external backup-drive';

//const DisabledIcon = 'my-caffeine-off-symbolic';
//const EnabledIcon = 'my-caffeine-on-symbolic';
const DisabledIcon = 'system-run-symbolic';
const EnabledIcon = 'system-run-symbolic';


const BackupManager = new Lang.Class({
    Name: 'BackupManager',
    Extends: PanelMenu.Button,

    _entries: [],

	_init: function() {

        this._drives = [ ];
        this._volumes = [ ];
        this._mounts = [ ];

        //Set a FileMonitor on the config-File. So the Config-File is only
        //read, when it changed.
        this.GF = Gio.File.new_for_path('/etc/mksnapshot.conf');
        this._monitorGF = this.GF.monitor_file(Gio.FileMonitorFlags.NONE,null,null,null)
        this._monitorGF.connect("changed", Lang.bind(this, function(monitor, file, o, event) {
            // without this test, _loadConfig() is called more than once!!
            if (event == Gio.FileMonitorEvent.CHANGES_DONE_HINT && ! /~$/.test(file.get_basename())) {
                this._loadConfig();
            }
        }));

        this._loadConfig();
        this.watchvolume = this._run_command('systemd-escape --path '+this.bkpmnt)+'.mount' 

		PanelMenu.Button.prototype._init.call(this, 0.0);

		//this._settings = Convenience.getSettings();
		//this._settings.connect('changed', Lang.bind(this, this._loadConfig));

		//this._loadConfig();


		let hbox = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
		mainicon = new St.Icon({icon_name: 'drive-harddisk-usb-symbolic', 
			style_class: 'system-status-icon'});

		sLabel = new St.Label({
			text: '---',
			//style_class: 'iospeed-label'
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
		
		//this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Fill the Menu
        // First a Entry to open backup-Location
		let bkpitem = this.menu.addAction(_("Open Backups"), function(event) {
			let context = global.create_app_launch_context(event.get_time(), -1);
			let GF = Gio.File.new_for_path('backup');
			Gio.AppInfo.launch_default_for_uri(GF.get_uri(),context);
		});

        this.extItem = new PopupTargetItem(extMediaName, this._check_service('mkbackup@BKP.target','active'));
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

        this._removedDriveId = this._monitor.connect('drive-disconnected', Lang.bind(this, function(monitor, drive) {
            log('DRIVE DISCONNECTED',drive.get_name())
            this.extItem.label.text = 'external backup-drive';
            this.drvsubmenu.destroy();
            //this._showDrive(mount);
        }));

        this._addedDriveId = this._monitor.connect('drive-connected', Lang.bind(this, function(monitor, drive) {
            log('DRIVE CONNECTED',drive.get_name());
            this.extItem.label.text = drive.get_name();
            log(drive.get_volumes());

            this._DriveAdded(drive);
            //this.drvsubmenu = new PopupMenu.PopupSubMenuMenuItem(_(drive.get_name()), true);
            //this.drvsubmenu.icon.icon_name = 'drive-harddisk-usb-symbolic';
            //this.drvsubmenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            //log(mount.get_name())
            //this._showDrive(drive);
        }));

        this._addedVolumeId = this._monitor.connect('volume-added', Lang.bind(this, function(monitor, volume){
            this._VolumeAdded(volume);
        }))

        this._removedVolumeId = this._monitor.connect('volume-removed', Lang.bind(this, function(monitor, volume){
            this._VolumeRemoved(volume);
        }))

        this._monitor.get_volumes().forEach(Lang.bind(this, function(volume) {
            this._VolumeAdded(volume);
            }));
            

        this._addedMountId = this._monitor.connect('mount-added', Lang.bind(this, function(monitor, mount) {
            log('MOUNT CONNECTED',mount.get_name())
            log(mount.get_name())
            let volume = mount.get_volume()
            log(volume.get_name(),volume.get_uuid())
            //log(mount.get_name())
            //this._showDrive(drive);
        }));

        //log(Gio.UnixMountPoint.get_device_path('/var/cache/backup'))
        return;
	},

    _DriveAdded: function(drive) {
        log('Drive added',drive.get_name())
        this.drvsubmenu = new PopupMenu.PopupSubMenuMenuItem(_(drive.get_name()), true);
        this.drvsubmenu.icon.icon_name = 'drive-harddisk-usb-symbolic';
        //this.drvsubmenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    },

    _VolumeRemoved: function(volume) {
        //Volume is removed, after it's mounted from system(d)
        log('VOLUME REMOVED',volume.get_name())
    },

    _VolumeAdded: function(volume) {
        //Volume is added, after it's unmounted from system(d)
        log('VOLUME CONNECTED',volume.get_name())
        log('ID',this._addedVolumeId)
        if (volume.get_drive() == null)
            return
        let drive = volume.get_drive()
        if ( !volume.can_mount() || !drive.is_removable())
            return
        log(volume.get_mount())
        log(volume.enumerate_identifiers())
        log(volume.get_identifier('uuid'))
        log(volume.get_identifier('unix-device'))
        log(volume.get_identifier('class'))
        log(volume.get_identifier('label'))

        let me
        try {
            me = this.drvsubmenu.menu._getMenuItems();
        } catch(e) {
            this._DriveAdded(drive)
        }
        me = this.drvsubmenu.menu._getMenuItems();

        let menuItem = new VolMenuItem(volume, false);

        let VF = Gio.File.new_for_path('/etc/udev/rules.d/99-ext-bkp-volume-u-'+volume.get_identifier('uuid')+'.rules');
        if (VF.query_exists(null)) {
            log('UDEV exists','/etc/udev/rules.d/99-ext-bkp-volume-u-'+volume.get_identifier('uuid')+'.rules')
            menuItem.setToggleState(true);
        } else {
            log('UDEV not exists','/etc/udev/rules.d/99-ext-bkp-volume-u-'+volume.get_identifier('uuid')+'.rules')
            menuItem.setToggleState(false);
        }


        this._removeItemByLabel(volume.get_name());
        this.drvsubmenu.menu.addMenuItem(menuItem);
        let connID = menuItem.connect('toggled', Lang.bind(this, function() {
            log('ACTIVE?',menuItem.state,menuItem.label.text)
            if (menuItem.state) {
                reg = 'register'
            } else {
                reg = 'unregister'
            }
            GLib.spawn_command_line_async(
                this._getCommand('mkbackup-'+reg+'@'+volume.get_identifier('unix-device')+'.service', 'start', 'system'));
        }));
        log(connID,volume.get_name())
        this.menu.addMenuItem(this.drvsubmenu,1);
    },

    _removeItemByLabel: function(label) { 
        log('LAB',label)
        let children = this.drvsubmenu.menu._getMenuItems(); 
        for (let i = 0; i < children.length; i++) { 
            let item = children[i]; 
            log('REM',item.label.text,label)
            if (item.label.text == label)
                item.destroy(); 
        } 
    }, 

    

    _addMount: function(mount) {
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
        let drive = volume.get_drive();
        let mount = volume.get_mount();
        if (drive != null && drive.is_removable()){
            log('SVDRIVE',drive.get_name(),drive.is_removable())
            log('SVVOL',volume.get_name(),volume.get_uuid(),drive.is_removable());
        }
    },

    _showDrive: function(drive) {
        //extMediaName = 'external backup-drive';
        log('SDDRIVE',drive.get_name(),drive.get_volumes(),drive.has_media(),drive.is_removable(),drive.has_volumes(),drive.enumerate_identifiers());
        if (drive.is_removable() && drive.has_volumes()) {
            //extMediaName = drive.get_name();
            log('SDDREMOV')

            drive.get_volumes().forEach(Lang.bind(this, function(volume) {
                if (volume.can_mount()){
                    log('SDVOL',volume.get_name());
                    if ( volume.get_mount() != null ) {
                        let mount = volume.get_mount();
                        log('SDMR',mount.get_root());
                    }
                }
            }));
        } else {
            log(drive.is_removable(),drive.has_volumes(),drive.get_volumes());
        }
    },

    _checkMount: function(mount) {
        log('CHECK MOUNT '+mount.can_unmount()+' '+mount.can_eject());
        log('VOLUME '+mount.get_volume());
        return(mount.can_unmount() || mount.can_eject())
    },

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
        let mounted = false;
        volumes.push(this.watchvolume)

        // TODO: find all Volumes on the drive, holding the backup and add this
        // volumes to the list
        volumes.push('home-jakob-Videos-extern.mount')
        volumes.push('home-media.mount')

        this.aout = GLib.spawn_command_line_sync(
            this._getCommand(this.services.join(' '), 'is-active', 'system'))[1].toString().split('\n');
        //log(this.aout);

        active = this.aout.indexOf('active') >= 0

        let vout = GLib.spawn_command_line_sync(
                this._getCommand(volumes.join(' '), 'is-active', 'system'))[1].toString().split('\n');
        mounted = vout.indexOf('active') >= 0

        this.bkpsubmenu.icon.style = (active ? "color: #ff0000;" : "color: revert;");
        mainicon.style = (mounted ? "color: #ff0000;" : "color: revert;");
        sLabel.set_text(mounted ? _("mounted") : "");

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
		let me = this.bkpsubmenu.menu._getMenuItems();
        //log(this.services.join(' '))

        let eout = GLib.spawn_command_line_sync(
            this._getCommand(this.services.join(' '), 'is-enabled', 'system'))[1].toString().split('\n');
        //log(eout);


		this._entries.forEach(Lang.bind(this, function(service,index,arr) {
            if (! arr[index].enabled == (eout[index] == 'enabled')) 
                arr[index].changed = true
            arr[index].enabled = (eout[index] == 'enabled' ? true : false)

            if (! arr[index].active == (this.aout[index] == 'active')) 
                arr[index].changed = true
            arr[index].active = (this.aout[index] == 'active' ? true : false)
        }));

		this._entries.forEach(Lang.bind(this, function(service,index,arr) {
			let serviceItem
			me.forEach(Lang.bind(this, function(item) {
				if ( item.label.text == service['name'] ) {
					arr[index].found = true;
					serviceItem = item;
					me.splice(me.indexOf(item),1);
				} 
			}));

            if ( arr[index].changed ) {
                if (arr[index].found) {
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


                //log('Changed',service.service)
            }
            //log('X',arr[index].service,arr[index].enabled,arr[index].active,arr[index].changed)
            arr[index].changed = false;
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
        //log('LOAD CONFIG')
        let intervals
        this.services = []
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
                this.services.push(obj.service)
                obj.type = "system";
                obj.enabled = false;
                obj.active = false;
                obj.changed = true;
                obj.found = false;
                obj.staticserv = false;

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
