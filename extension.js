'use strict';

const Main = imports.ui.main;
const WorkspaceManager = global.workspace_manager;
const {Display} = imports.gi.Meta;
const {St} = imports.gi;
const Util = imports.misc.util;

const getPrimaryMonitor = () => new Display().get_primary_monitor();
const getCurrentTime = () => global.get_current_time();
const getActiveWorkspace = () => WorkspaceManager.get_active_workspace();
const getWorkspacesQuantity = () => WorkspaceManager.get_n_workspaces();
const getWorkspaceByIndex = (index) => WorkspaceManager.get_workspace_by_index(index);
const displayWorkspaceView = () => Util.spawn([
    'dbus-send',
    '--session', 
    '--dest=com.System76.Cosmic', 
    '--type=method_call', 
    '/com/System76/Cosmic', 
    'com.System76.Cosmic.ToggleWorkspaces'
]);

class WorkspaceIndicator {
    constructor(workspace) {
        this._workspace = workspace;

        const workspaceLabel = `${this._workspace.index() + 1}`;
        this._indicatorWidget = St.Button.new_with_label(workspaceLabel);
        this._indicatorWidget.set_style_class_name('workspace-indicator');

        this._eventWindowAddedId = this._workspace.connect('window-added', () => this.updateState());
        this._eventWindowRemovedId = this._workspace.connect('window-removed', () => this.updateState());
        this._eventClickId = this._indicatorWidget.connect('clicked', () => this._workspace.activate(getCurrentTime()));

        this.updateState();
    }

    getWidget() {
        return this._indicatorWidget;
    }

    updateState() {
        const currentWorkspaceIndex = this._workspace.index();
        const activeWorkspaceIndex = getActiveWorkspace().index();

        if (currentWorkspaceIndex === activeWorkspaceIndex) {
            this._indicatorWidget.add_style_class_name('active');
            this._indicatorWidget.show();
        } else {
            this._indicatorWidget.remove_style_class_name('active');
        }
    }

    destroy() {
        this._workspace.disconnect(this._eventWindowAddedId);
        this._workspace.disconnect(this._eventWindowRemovedId);
        this._indicatorWidget.disconnect(this._eventClickId);

        this._indicatorWidget.destroy();
        this._indicatorWidget = null;
        this._workspace = null;
    }
}


class WorkspaceIndicatorsManager {
    constructor() {
        this._indicators = [];
    }

    create() {
        this._indicators = Array.from({length: getWorkspacesQuantity()}, (_, index) => {
            return new WorkspaceIndicator(getWorkspaceByIndex(index));
        });
        return this._indicators;
    }

    updateStates() {
        this._indicators.forEach((indicator) => indicator.updateState());
    }

    destroy() {
        this._indicators.forEach((indicator) => indicator.destroy());
        this._indicators = [];
    }

    recreate() {
        this.destroy();
        return this.create();
    }
}

class WorkspaceLayout {
    constructor(indicatorsManager) {
        this._indicatorsManager = indicatorsManager;

        this._layoutWidget = St.BoxLayout.new();
        this._layoutWidget.set_style_class_name('workspace-layout');

        this._indicatorContainer = St.BoxLayout.new();
        this._indicatorContainer.set_style_class_name('indicator-container');

        this._showButton = St.Button.new_with_label('⟐'); 
        this._showButton.set_style_class_name('workspace-nav-button');

        // TODO: dirty hack for location
        Main.panel._leftBox.add_child(this._layoutWidget);
        this._layoutWidget.add_child(this._indicatorContainer);
        this._layoutWidget.add_child(this._showButton);

        this._eventWorkspaceAddedId = WorkspaceManager.connect('notify::n-workspaces', () => this._render());
        this._eventWorkspaceRemovedId = WorkspaceManager.connect('workspace-removed', () => this._render());
        this._eventWorkspaceSwitchedId = WorkspaceManager.connect('workspace-switched', () => this._render(false));
        this._eventShowButtonClicked = this._showButton.connect('clicked', displayWorkspaceView);

        this._render();
    }

    _render(forcibly = true) {
        if (forcibly) {
            this._indicatorsManager.recreate().forEach(indicator => this._indicatorContainer.add_child(indicator.getWidget()));
        } else {
            this._indicatorsManager.updateStates();
        }
    }

    destroy() {
        WorkspaceManager.disconnect(this._eventWorkspaceAddedId);
        WorkspaceManager.disconnect(this._eventWorkspaceRemovedId);
        WorkspaceManager.disconnect(this._eventWorkspaceSwitchedId);
        WorkspaceManager.disconnect(this._eventShowButtonClicked);

        this._indicatorsManager.destroy();
        this._indicatorsManager = null;

        // TODO: dirty hack for location
        Main.panel._leftBox.remove_child(this._layoutWidget);

        this._layoutWidget.destroy();
        this._layoutWidget = null;

        this._indicatorContainer.destroy();
        this._indicatorContainer = null;

        this._showButton.destroy();
        this._showButton = null;
    }
}

class Extension {
    enable() {
        const indicatorsManager = new WorkspaceIndicatorsManager();
        this._layout = new WorkspaceLayout(indicatorsManager);
    }

    disable() {
        this._layout.destroy();
        this._layout = null;
    }
}

function init() {
    return new Extension();
}
