var GLib = imports.gi.GLib;
var Gio = imports.gi.Gio;
var Gtk = imports.gi.Gtk;
var GObject = imports.gi.GObject;
var Lang = imports.lang;

var ExtensionUtils = imports.misc.extensionUtils;
var Me = ExtensionUtils.getCurrentExtension();
var Convenience = Me.imports.convenience;


var ServicesSystemdSettings = new GObject.Class({
    Name: 'Services-Systemd-Settings',
    Extends: Gtk.Grid,

    _init : function(params) {
        // Gtk Grid init
        this.parent(params);
        this.set_orientation(Gtk.Orientation.VERTICAL);
        this.margin = 20;

        // Open settings
        this._settings = Convenience.getSettings();
        this._settings.connect('changed', Lang.bind(this, this._refresh));

        this._changedPermitted = false;

        // Label
        var treeViewLabel = new Gtk.Label({ label: '<b>' + "Listed systemd Services:" + '</b>',
                                 use_markup: true,
                                 halign: Gtk.Align.START })
        this.add(treeViewLabel);


        // TreeView
        this._store = new Gtk.ListStore();
        this._store.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_STRING]);

        this._treeView = new Gtk.TreeView({ model: this._store,
                                            hexpand: true, vexpand: true });
        
        var selection = this._treeView.get_selection();
        selection.set_mode(Gtk.SelectionMode.SINGLE);
        selection.connect ('changed', Lang.bind (this, this._onSelectionChanged));


        var appColumn = new Gtk.TreeViewColumn({ expand: true,
                                                 title: "Label" });

        var nameRenderer = new Gtk.CellRendererText;
        appColumn.pack_start(nameRenderer, true);
        appColumn.add_attribute(nameRenderer, "text", 0);
        this._treeView.append_column(appColumn);

        var appColumn = new Gtk.TreeViewColumn({ expand: true,
                                                 title: "Service" });
        
        var nameRenderer = new Gtk.CellRendererText;
        appColumn.pack_start(nameRenderer, true);
        appColumn.add_attribute(nameRenderer, "text", 1);
        this._treeView.append_column(appColumn);

        var appColumn = new Gtk.TreeViewColumn({ expand: true,
                                                 title: "Type" });
        
        var nameRenderer = new Gtk.CellRendererText;
        appColumn.pack_start(nameRenderer, true);
        appColumn.add_attribute(nameRenderer, "text", 2);
        this._treeView.append_column(appColumn);

        this.add(this._treeView);

        // Devare Toolbar
        var toolbar = new Gtk.Toolbar();
        toolbar.get_style_context().add_class(Gtk.STYLE_CLASS_INLINE_TOOLBAR);
        toolbar.halign = 2;
        this.add(toolbar);

        var upButton = new Gtk.ToolButton({ stock_id: Gtk.STOCK_GO_UP });
        upButton.connect('clicked', Lang.bind(this, this._up));
        toolbar.add(upButton);

        var downButton = new Gtk.ToolButton({ stock_id: Gtk.STOCK_GO_DOWN });
        downButton.connect('clicked', Lang.bind(this, this._down));
        toolbar.add(downButton);

        var delButton = new Gtk.ToolButton({ stock_id: Gtk.STOCK_DELETE });
        delButton.connect('clicked', Lang.bind(this, this._devare));
        toolbar.add(delButton);

        this._selDepButtons = [upButton, downButton, delButton]

        // Add Grid
        var grid = new Gtk.Grid();

        //// Label
        var labelName = new Gtk.Label({label: "Label: "});
        labelName.halign = 2;

        this._displayName = new Gtk.Entry({ hexpand: true,
                                    margin_top: 5 });
        this._displayName.set_placeholder_text("Name in menu");

        var labelService = new Gtk.Label({label: "Service: "});
        labelService.halign = 2;

        this._availableSystemdServices = {
            //'system': this._getSystemdServicesList("system"),
            //'user': this._getSystemdServicesList("user"),
            'system': this._getSystemdTargetsList("system"),
            'user': this._getSystemdTargetsList("user"),
        }
        this._availableSystemdServices['all'] = this._availableSystemdServices['system'].concat(this._availableSystemdServices['user'])
        //this._availableSystemdServices['all'] = this._availableSystemdServices['systemtargets'].concat(this._availableSystemdServices['all'])
        //this._availableSystemdServices['all'] = this._availableSystemdServices['usertargets'].concat(this._availableSystemdServices['all'])

        var sListStore = new Gtk.ListStore();
        sListStore.set_column_types([GObject.TYPE_STRING, GObject.TYPE_INT]);

        for (var i in this._availableSystemdServices['all'])
            sListStore.set (sListStore.append(), [0], [this._availableSystemdServices['all'][i]]);

        this._systemName = new Gtk.Entry()
        this._systemName.set_placeholder_text("Systemd service name");
        var compvarion =  new Gtk.EntryCompvarion()
        this._systemName.set_compvarion(compvarion)
        compvarion.set_model(sListStore)

        compvarion.set_text_column(0)
        
        grid.attach(labelName, 1, 1, 1, 1);
        grid.attach_next_to(this._displayName, labelName, 1, 1, 1);

        grid.attach(labelService, 1, 2, 1, 1);
        grid.attach_next_to(this._systemName,labelService, 1, 1, 1);

        this.add(grid);

        var toolbar = new Gtk.Toolbar();
        toolbar.get_style_context().add_class(Gtk.STYLE_CLASS_INLINE_TOOLBAR);
        toolbar.halign = 2;
        this.add(toolbar);

        var addButton = new Gtk.ToolButton({ stock_id: Gtk.STOCK_ADD,
                                             label: "Add",
                                             is_important: true });

        addButton.connect('clicked', Lang.bind(this, this._add));
        toolbar.add(addButton);

        this._changedPermitted = true;
        this._refresh();
        this._onSelectionChanged();
    },

    _getSystemdTargetsList: function(type) {
        var [_, out, err, stat] = GLib.spawn_command_line_sync('sh -c "systemctl --' + type + ' list-unit-files --type=target | tail -n +2 | head -n -2 | awk \'{print $1}\'"');
        var allFiltered = out.toString().split("\n");
        return allFiltered.sort(
            function (a, b) {
                return a.toLowerCase().localeCompare(b.toLowerCase());
            })
    },

    _getSystemdServicesList: function(type) {
        var [_, out, err, stat] = GLib.spawn_command_line_sync('sh -c "systemctl --' + type + ' list-unit-files --type=service | tail -n +2 | head -n -2 | awk \'{print $1}\'"');
        var allFiltered = out.toString().split("\n");
        return allFiltered.sort(
            function (a, b) {
                return a.toLowerCase().localeCompare(b.toLowerCase());
            })
    },
    _getTypeOfService: function(service) {
        var type = "undefined"
        if (this._availableSystemdServices['systemtargets'].indexOf(service) != -1 && this._availableSystemdServices['system'].indexOf(service) != -1)
            type = "system"
        else if (this._availableSystemdServices['usertargets'].indexOf(service) != -1 && this._availableSystemdServices['user'].indexOf(service) != -1)
            type = "user"
        return type
    },

    _getIdFromIter: function(iter) {
        var displayName = this._store.get_value(iter, 0);
        var serviceName = this._store.get_value(iter, 1);
        var type = this._store.get_value(iter, 2);
        return JSON.stringify({"name": displayName, "service": serviceName, "type": type});
    },

    _add: function() {
        var displayName = this._displayName.text
        var serviceName = this._systemName.text

        if (displayName.trim().length > 0 && serviceName.trim().length > 0 ) {
            var type = this._getTypeOfService(serviceName)
            if (type == "undefined") {
                this._messageDialog = new Gtk.MessageDialog ({
                    title: "Warning",
                    modal: true,
                    buttons: Gtk.ButtonsType.OK,
                    message_type: Gtk.MessageType.WARNING,
                    text: "Service does not exist." 
                });
                this._messageDialog.connect('response', Lang.bind(this, function() {
                    this._messageDialog.close();
                }));
                this._messageDialog.show();
            } else {
                var id = JSON.stringify({"name": displayName, "service": serviceName, "type": type})
                var currentItems = this._settings.get_strv("zeitmaschine");
                var index = currentItems.indexOf(id);
                if (index < 0) {
                    this._changedPermitted = false;
                    currentItems.push(id);
                    this._settings.set_strv("zeitmaschine", currentItems);
                    this._store.set(this._store.append(), [0, 1, 2], [displayName, serviceName, type]);
                    this._changedPermitted = true;
                }
                this._displayName.text = ""
                this._systemName.text = ""
            }
            
        } else {
            this._messageDialog = new Gtk.MessageDialog ({
                //parent: this.get_toplevel(), 
                title: "Warning",
                modal: true,
                buttons: Gtk.ButtonsType.OK,
                message_type: Gtk.MessageType.WARNING,
                text: "No label and/or service specified." 
            });

            this._messageDialog.connect ('response', Lang.bind(this, function() {
                this._messageDialog.close();
            }));
            this._messageDialog.show();
        }
    },

    _up: function() {
        var [any, model, iter] = this._treeView.get_selection().get_selected();

        if (any) {
            var index = this._settings.get_strv("zeitmaschine").indexOf(this._getIdFromIter(iter));
            this._move(index, index - 1)
        }
    },
    _down: function() {
        var [any, model, iter] = this._treeView.get_selection().get_selected();

        if (any) {
            var index = this._settings.get_strv("zeitmaschine").indexOf(this._getIdFromIter(iter));
            this._move(index, index + 1)
        }
    },
    _move: function(oldIndex, newIndex) {
        var currentItems = this._settings.get_strv("zeitmaschine");

        if (oldIndex < 0 || oldIndex >= currentItems.length ||  
            newIndex < 0 || newIndex >= currentItems.length)
            return;

        currentItems.splice(newIndex, 0, currentItems.splice(oldIndex, 1)[0]);

        this._settings.set_strv("zeitmaschine", currentItems);

        this._treeView.get_selection().unselect_all();
        this._treeView.get_selection().select_path(Gtk.TreePath.new_from_string(String(newIndex))); 
    },
    _devare: function() {
        var [any, model, iter] = this._treeView.get_selection().get_selected();

        if (any) {
            var currentItems = this._settings.get_strv("zeitmaschine");
            var index = currentItems.indexOf(this._getIdFromIter(iter));

            if (index < 0)
                return;

            currentItems.splice(index, 1);
            this._settings.set_strv("zeitmaschine", currentItems);
            
            this._store.remove(iter);
        }
    },
    _onSelectionChanged: function() {
        var [any, model, iter] = this._treeView.get_selection().get_selected();
        if (any) {
            this._selDepButtons.forEach(function(value) {
                value.set_sensitive(true)
            });
        } else {
            this._selDepButtons.forEach(function(value) {
                value.set_sensitive(false)
            });
        } 
    },
    _refresh: function() {
        if (!this._changedPermitted)
            return;

        this._store.clear();

        var currentItems = this._settings.get_strv("zeitmaschien");
        var validItems = [ ];

        for (var i = 0; i < currentItems.length; i++) {
            var entry = JSON.parse(currentItems[i]);
            // REMOVE NOT EXISTING ENTRIES
            if (this._availableSystemdServices["all"].indexOf(entry["service"]) < 0)
                continue;

            // COMPABILITY
            if(!("type" in entry))
                entry["type"] = this._getTypeOfService(entry["service"])

            validItems.push(JSON.stringify(entry));

            var iter = this._store.append();
            this._store.set(iter,
                            [0, 1, 2],
                            [entry["name"], entry["service"], entry["type"]]);
        }

        this._changedPermitted = false
        this._settings.set_strv("zeitmaschine", validItems);
        this._changedPermitted = true
    }
});

function init() {
}

function buildPrefsWidget() {
    var widget = new ServicesSystemdSettings();
    widget.show_all();

    return widget;
}
