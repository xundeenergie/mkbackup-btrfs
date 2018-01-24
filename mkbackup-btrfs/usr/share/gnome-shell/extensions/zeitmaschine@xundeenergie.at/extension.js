var GLib = imports.gi.GLib;
var Lang = imports.lang;
var Main = imports.ui.main;
var PanelMenu = imports.ui.panelMenu;
var PopupMenu = imports.ui.popupMenu;

var St = imports.gi.St;
var Shell = imports.gi.Shell;

var Gettext = imports.gettext.domain('gnome-shell-extensions');
var _ = Gettext.gettext;

var ExtensionUtils = imports.misc.extensionUtils;
var Me = ExtensionUtils.getCurrentExtension();
var Convenience = Me.imports.convenience;
var Util = imports.misc.util;
var PopupServiceItem = Me.imports.popupServiceItem.PopupServiceItem;
var PopupTargetItem = Me.imports.popupTargetItem.PopupTargetItem;
var PopupMenuItem = Me.imports.popupManuallyItem.PopupServiceItem;
var MountMenuItem = Me.imports.popupMountItem.MountMenuItem;
var DriveMenuItem = Me.imports.popupDriveItem.DriveMenuItem;
var VolMenuItem = Me.imports.popupBkpVolumItem.PopupBKPItem;
var Gio = imports.gi.Gio;
var Mainloop = imports.mainloop;

var refreshTime = 3.0;
var MainLabel;
var icon;
var MainIcon;
var ExtIcon;
var extMediaName = 'external backup-drive';
var Drives = new Object();

//var DisabledIcon = 'my-caffeine-off-symbolic';
//var EnabledIcon = 'my-caffeine-on-symbolic';
var DisabledIcon = 'system-run-symbolic';
var EnabledIcon = 'system-run-symbolic';
//var ConfFile = '/etc/mkbackup-btrfs.conf';
var ConfFile = '/tmp/mkbackup-btrfs.conf.tmp';


var BackupManager = new Lang.Class({
    Name: 'BackupManager',
    Extends: PanelMenu.Button,

    _entries: [],

	_init: function() {

        this._drives = [ ];
        this._volumes = [ ];
        this._mounts = [ ];

        //Set a FileMonitor on the config-File. So the Config-File is only
        //read, when it changed.
        this.GF = Gio.File.new_for_path(ConfFile);
        //this._monitorConf = this.GF.monitor_file(Gio.FileMonitorFlags.NONE,null,null,null)
        this._monitorConf = this.GF.monitor_file(Gio.FileMonitorFlags.NONE,null)
        this._monitorConf.connect("changed", Lang.bind(this, function(monitor, file, o, event) {
            // without this test, _loadConfig() is called more than once!!
            if (event == Gio.FileMonitorEvent.CHANGES_DONE_HINT && ! /~$/.test(file.get_basename())) {
                this._loadConfig();
            }
        }));

        this._loadConfig();
        this.watchvolume = this._run_command('systemd-escape --path '+this.bkpmnt)+'.mount' 

		PanelMenu.Button.prototype._init.call(this, 0.0);

		var hbox = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
		MainIcon = new St.Icon({icon_name: 'drive-harddisk-usb-symbolic', 
                                style_class: 'system-status-icon'});
		ExtIcon = new St.Icon({icon_name: 'drive-harddisk-usb-symbolic', 
                                style_class: 'system-status-icon'});
        ExtIcon.hide();

		MainLabel = new St.Label({ text: '---',
		});

		hbox.add_child(MainLabel);
		hbox.add_child(MainIcon);
		hbox.add_child(ExtIcon);
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
		var bkpitem = this.menu.addAction(_("Open Backups"), function(event) {
			var context = global.create_app_launch_context(event.get_time(), -1);
			var GF = Gio.File.new_for_path('backup');
			Gio.AppInfo.launch_default_for_uri(GF.get_uri(),context);
		});

        this.extItem = new PopupTargetItem(extMediaName, this._check_service('mkbackup@BKP.target','active'));
        this.extItem.connect('toggled', Lang.bind(this, function() {
            GLib.spawn_command_line_async(
                this._getCommand('mkbackup@BKP.target', 
                                (this._check_service('mkbackup@BKP.target','active') ? 'stop' : 'start'), 
                                'system'));
        }));
        this.menu.addMenuItem(this.extItem);

		this.snapitem = new PopupMenu.PopupMenuItem(_("Take snapshot now"));
		this.snapitem.connect('activate', Lang.bind(this, function() {
		    GLib.spawn_command_line_async(
			this._getCommand('mkbackup@manually.service', 'restart', 'system'));
			this.menu.close();
		    }));
		this.menu.addMenuItem(this.snapitem);

        this.bkpsubmenu = new PopupMenu.PopupSubMenuMenuItem(_("Backup-Intervalle"), true);
        this.bkpsubmenu.icon.icon_name = 'system-run-symbolic';
        this.menu.addMenuItem(this.bkpsubmenu);

        //this.descrsubmenu = new PopupMenu.PopupSubMenuMenuItem(_("Info"), true);
        //this.descrsubmenu.icon.icon_name = 'system-run-symbolic';
        //this.bkpsubmenu.addMenuItem(this.descrsubmenu);

		if(this._entries.length > 0)
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		
        this._refreshID = Mainloop.timeout_add_seconds(refreshTime, Lang.bind(this, this._refresh_panel));
        // New Volumes to use as backup-media
        this._monitor = Gio.VolumeMonitor.get();

        this._addedDriveId = this._monitor.connect('drive-connected', Lang.bind(this, function(monitor, drive) {
            log('DRIVE CONNECTED',drive.get_name());
            this._DriveAdded(drive);
        }));

        this._removedDriveId = this._monitor.connect('drive-disconnected', Lang.bind(this, function(monitor, drive) {
            log('DRIVE DISCONNECTED',drive.get_name(),this._removedDriveId)
            this._DriveRemoved(drive);
            //this.extItem.label.text = _("external backup-drive");
            //this.drvsubmenu.destroy();
        }));

        this._addedVolumeId = this._monitor.connect('volume-added', Lang.bind(this, function(monitor, volume){
            this._addVolume(volume);
            this._VolumeAdded(volume);
            log('VOLUMES',JSON.stringify(this._drives))
        }))

        this._removedVolumeId = this._monitor.connect('volume-removed', Lang.bind(this, function(monitor, volume){
            //this._VolumeRemoved(volume);
        }))

        /*this._monitor.get_volumes().forEach(Lang.bind(this, function(volume) {
            this._VolumeAdded(volume);
            }));
            

        this._addedMountId = this._monitor.connect('mount-added', Lang.bind(this, function(monitor, mount) {
            log('MOUNT CONNECTED',mount.get_name())
            log(mount.get_name())
            var volume = mount.get_volume()
            log(volume.get_name(),volume.get_uuid())
            //log(mount.get_name())
            //this._showDrive(drive);
        }));*/

        //log(Gio.UnixMountPoint.get_device_path('/var/cache/backup'))
        return;
	},

    _DriveAdded: function(drive) {
        var Dident = drive.enumerate_identifiers();
        var u_dev = drive.get_identifier('unix-device');
        var d_name =  drive.get_name();
        //log('DRIVE unix-device',u_dev,d_name)
        this._drives[d_name] = new Object()
        this._drives[d_name]['drive'] = drive;
        this._drives[d_name]['device'] = drive.get_identifier('unix-device'); 
        //this._drives[d_name]['uuid']   = drive.get_identifier('uuid'); 
        this._drives[d_name]['volumes'] = new Object()
        log("ABCDE",this._drives[d_name]['device']);
        /*if (drive.has_volumes()) {
            log('DHV',drive.get_volumes());
            var VList = drive.get_volumes();
            VList.forEach(Lang.bind(this, function(volume){
                var v_name = volume.get_name();
                log(v_name)
                this._drives[d_name]['volumes'][v_name] = this._addVolume(volume);
            }));
            //VList.free()
        } else {
            log('DHNV',drive.get_volumes());
        };
        log('VOLUMES',JSON.stringify(this._drives))
        log('X',this._drives['ST1000LM024 HN-M101MBB']['device'])
        */
        /*
        this.drvsubmenu = new PopupMenu.PopupSubMenuMenuItem(drive.get_name(), true);
        this.drvsubmenu.icon.icon_name = 'drive-harddisk-usb-symbolic';
        this.menu.addMenuItem(this.drvsubmenu);
        */
        //log('Drive added',drive.get_name())
        //this.drvsubmenu = new PopupMenu.PopupSubMenuMenuItem(_(drive.get_name()), true);
        //this.drvsubmenu.icon.icon_name = 'drive-harddisk-usb-symbolic';
        //this.drvsubmenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    },

    _addVolume: function(volume) {
        var drives = volume.get_drive();
        //log('D',drives.get_name())
        //log('V',volume.get_name())
        //this._drives[drives.get_name()][volume.get_name()] = volume;
        volume.enumerate_identifiers();
        var vol = new Object()
        //log(volume.get_identifier('uuid'))
        //log(volume.get_identifier('unix-device'))
        //log(volume.get_identifier('class'))
        //log(volume.get_identifier('label'))
        //vol['volume'] = volume;
        //vol['uuid'] = volume.get_identifier('uuid');
        //vol['u_device'] = volume.get_identifier('unix-device');
        //vol['vclass'] = volume.get_identifier('class');
        //vol['label'] = volume.get_identifier('label');
        //this._drives[drives.get_name()]['volumes'][volume.get_name()] = v_name;
        return vol
    },

    _DriveRemoved: function(drive) {
        var me = this.menu._getMenuItems();
        this._removeItemByLabel(this.menu, drive.get_name());


        //this.drvsubmenu.destroy();
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
        var drive = volume.get_drive()
        if ( !volume.can_mount() || !drive.is_removable())
            return
        log(volume.get_mount())
        log(volume.enumerate_identifiers())
        log(volume.get_identifier('uuid'))
        log(volume.get_identifier('unix-device'))
        log(volume.get_identifier('class'))
        log(volume.get_identifier('label'))
        var dr = volume.get_drive()
        this._drives[dr.get_name()] = dr
        log(dr.get_name())
        log(dr.enumerate_identifiers())
        log(dr.get_identifier('unix-device'))

        var me
        try {
            me = this.drvsubmenu.menu._getMenuItems();
        } catch(e) {
            this._DriveAdded(drive)
        }
        //me = this.drvsubmenu.menu._getMenuItems();

        var menuItem = new VolMenuItem(volume, false);

        var VF = Gio.File.new_for_path('/etc/udev/rules.d/99-ext-bkp-volume-u-'+volume.get_identifier('uuid')+'.rules');
        if (VF.query_exists(null)) {
            log('UDEV exists','/etc/udev/rules.d/99-ext-bkp-volume-u-'+volume.get_identifier('uuid')+'.rules')
            menuItem.setToggleState(true);
        } else {
            log('UDEV not exists','/etc/udev/rules.d/99-ext-bkp-volume-u-'+volume.get_identifier('uuid')+'.rules')
            menuItem.setToggleState(false);
        }


        //this._removeItemByLabel(this.drvsubmenu.menu, volume.get_name());
        //this.drvsubmenu.menu.addMenuItem(menuItem);
        var connID = menuItem.connect('toggled', Lang.bind(this, function() {
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
        //this.menu.addMenuItem(this.drvsubmenu,1);
    },

    _removeItemByLabel: function(menu, label) { 
        log('LAB',label)
        var children = menu._getMenuItems(); 
        for (var i = 0; i < children.length; i++) { 
            var item = children[i]; 
            log('REM',item.label.text,label)
            if (item.label.text == label)
                log('DESTROY',item.label.text)
                //item.destroy(); 
        } 
    }, 

    

    _addMount: function(mount) {
        var item = new MountMenuItem(mount);
        this._mounts.unshift(item);
        this.menu.addMenuItem(item, 0);
    },

    _removeMount: function(mount) {
        for (var i = 0; i < this._mounts.length; i++) {
            var item = this._mounts[i];
            if (item.mount == mount) {
            item.destroy();
            this._mounts.splice(i, 1);
            return;
            }
        }
        log ('Removing a mount that was never added to the menu');
    },

    _run_command: function(COMMAND) {
        var output = "";
        try {
                //output = GLib.spawn_command_line_sync(COMMAND, null, null, null, null);
                output = GLib.spawn_command_line_sync(COMMAND);
            } catch(e) {
                throw e;
            }

        return output[1].toString().replace(/\n$/, "") + "";
    },



    _showVolume: function(volume) {
        var drive = volume.get_drive();
        var mount = volume.get_mount();
        if (drive != null && drive.is_removable()){
            log('SVDRIVE',drive.get_name(),drive.is_removable())
            log('SVVOL',volume.get_name(),volume.get_uuid(),drive.is_removable());
        }
    },

    _showDrive: function(drive) {
        //extMediaName = 'external backup-drive';
        log('SDDRIVE',drive.get_name(),drive.get_volumes(),drive.has_media(),drive.is_removable(),drive.has_volumes(),drive.enumerate_identifiers());
        if (drive.is_removable() && drive.has_volumes()) {
            extMediaName = drive.get_name();
            log('SDDREMOV')

            drive.get_volumes().forEach(Lang.bind(this, function(volume) {
                if (volume.can_mount()){
                    log('SDVOL',volume.get_name());
                    if ( volume.get_mount() != null ) {
                        var mount = volume.get_mount();
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
		var command = "systemctl"

		command += " " + action
		command += " " + service
		command += " --" + type
		if (type == "system" && (action != 'is-active' && action != 'is-enabled'))
			command = "pkexec --user root " + command

		return 'sh -c "' + command + '; exit;"'
	},

    _getDriveMounted: function(udevice) {
        command = "/bin/grep"
        command += " " + udevice
        command += "/proc/mounts"
        return 'sh -c "' + command + '; exit:"'
    },

    _refresh_panel : function() {

        //log('YY',this._drives['ST1000LM024 HN-M101MBB']['volumes'])
        //log('YY',this._drives['ST1000LM024 HN-M101MBB'])
        var active = false;
        var volumes = []
        var mounted = false;
        volumes.push(this.watchvolume)

        // TODO: find all Volumes on the drive, holding the backup and add this
        // volumes to the list
        volumes.push('home-jakob-Videos-extern.mount')
        volumes.push('home-media.mount')
        //for (var d in this._drives['ST1000LM024 HN-M101MBB']) {
        /*for (var d in this._drives) {
            log("D",d,this._drives[d].get_name());
        };*/

        this.aout = GLib.spawn_command_line_sync(
            this._getCommand(this.services.join(' '), 'is-active', 'system'))[1].toString().split('\n');
        //log(this.aout.indexOf('active'));

        var apos = this.aout.indexOf('active')
        active = this.aout.indexOf('active') >= 0

        var vout = GLib.spawn_command_line_sync(
                this._getCommand(volumes.join(' '), 'is-active', 'system'))[1].toString().split('\n');
        mounted = vout.indexOf('active') >= 0

        //log(active);
        this.bkpsubmenu.icon.style = (active ? "color: #ff0000;" : "color: revert;");
        MainIcon.style = (mounted ? "color: #ff0000;" : "color: revert;");
        ExtIcon.style = (mounted ? "color: #ff0000;" : "color: revert;");
        (mounted ? ExtIcon.show() : ExtIcon.hide());
        
        //ExtIcon.actor = (mounted ? "visibile = true;" : "visible = false;");
        var mlabel = (mounted ? _("mounted") : "");
        var alabel = (active ? this.services[apos] : "");
        MainLabel.set_text(mlabel + ' ' + alabel);
        //MainLabel.set_text(mounted ? _("mounted") : "");
        //MainLabel.set_text(active ? this.services[apos] : "");

		if (this.menu.isOpen) {
            //Menu is open
            var me = this.menu._getMenuItems();
			me.forEach(Lang.bind(this, function(item) {
                //log(item.label.text)
				if ( item.label.text == extMediaName ) {
                    item.setToggleState(this._check_service('mkbackup@BKP.target','active'));
				} 
			}));
            if (this.bkpsubmenu.menu.isOpen)  {
                //Submenu Backu-intervals open
                this._refresh();
            };
            this._refresh();
        }

        if (this._refreshID != 0)
                Mainloop.source_remove(this._refreshID);
        this._refreshID = Mainloop.timeout_add_seconds(refreshTime, Lang.bind(this, this._refresh_panel));
        GLib.Source.set_name_by_id(this._refreshID, '[gnome-shell] this._refresh_panel');
        return false;
    },

    _check_service: function(service,stat) {
        var [_, aout, aerr, astat] = GLib.spawn_command_line_sync(
            this._getCommand(service, 'is-'+stat, 'system'));
        return (astat == 0);
    },

	_refresh: function() {
		var me = this.bkpsubmenu.menu._getMenuItems();
        //log(this.services.join(' '))

        var eout = GLib.spawn_command_line_sync(
            this._getCommand(this.services.join(' '), 'is-enabled', 'system'))[1].toString().split('\n');
        //log(eout);

        this.aout = GLib.spawn_command_line_sync(
            this._getCommand(this.services.join(' '), 'is-active', 'system'))[1].toString().split('\n');

		this._entries.forEach(Lang.bind(this, function(service,index,arr) {
            if (! arr[index].enabled == (eout[index] == 'enabled')) 
                arr[index].changed = true
            arr[index].enabled = (eout[index] == 'enabled' ? true : false)

            if (! arr[index].active == (this.aout[index] == 'active')) 
                arr[index].changed = true
            arr[index].active = (this.aout[index] == 'active' ? true : false)
        }));

		this._entries.forEach(Lang.bind(this, function(service,index,arr) {
			var serviceItem
			me.forEach(Lang.bind(this, function(item) {
				if ( item.label.text == service['descr']+' ('+service['name'] + ')' ) {
					arr[index].found = true;
					serviceItem = item;
					me.splice(me.indexOf(item),1);
				} 
			}));

            if ( arr[index].changed ) {
                if (arr[index].found) {
                    if ( service.staticserv ) {
                        serviceItem.setToggleState(service.active);
                    } else  {
                        serviceItem.setToggleState(service.enabled);
                    }
                } else {
                    if ( service.staticserv ) {
                        serviceItem = new PopupTargetItem(service['descr']+' ('+service['name'] + ')', service.active);
                        this.bkpsubmenu.menu.addMenuItem(serviceItem);
                        
                        serviceItem.connect('toggled', Lang.bind(this, function() {
                            GLib.spawn_command_line_async(
                                this._getCommand(service['service'], (this._check_service(service.service, 'active') ? 'stop' : 'start'), service["type"]));
                        }));
                    } else {
                        serviceItem = new PopupServiceItem(service['descr']+' ('+service['name'] + ')', service.enabled);
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
                if (serviceItem.descriptionLabel) {
                    serviceItem.descriptionLabel.label = service.descr;
                };


                //log('Changed',service.service)
            }
            //log('X',arr[index].service,arr[index].enabled,arr[index].active,arr[index].changed)
            arr[index].changed = false;
        }));

		this.bkpsubmenu.menu._getMenuItems().forEach(Lang.bind(this, function(item) {
            var mic = 0
			if ( me.length > mic ) {
				for (var i = mic; i < me.length; i++) {
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
        var intervals
        this.services = []
        var kf = new GLib.KeyFile()
        var obj = new Object();
        this._entries = [];

        if(kf.load_from_file(ConfFile,GLib.KeyFileFlags.NONE)){
            //intervals = kf.get_groups()[0];
            this.bkpmnt = kf.get_value('DEFAULT','bkpmnt')

            //log('BKP',this.bkppath)
            kf.get_groups()[0].forEach(Lang.bind(this, function(interval) {
                var obj = new Object();
                var i = ""
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

                try {
                    obj.descr = (kf.get_value(interval,"description"));
                } catch(err) {
                    try {
                    obj.descr = (kf.get_value("DEFAULT","description"));
                    } catch(err) {
                        obj.descr = "";
                    }
                }
            this._entries.push(obj)}));
        } 
    }
});

var backupManager;

function init(extensionMeta) {
    //Convenience.initTranslations();
    var theme = imports.gi.Gtk.IconTheme.get_default();
    theme.append_search_path(extensionMeta.path + "/icons");
}


function enable() {
	backupManager = new BackupManager();

}

function disable() {
	backupManager.destroy();
}
