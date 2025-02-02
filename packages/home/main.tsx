/// <reference path="./globals.d.ts"/>
import "bootstrap";
import React from "react";
import ReactDOM from "react-dom";
import { configure } from "mobx";
import { observer } from "mobx-react";

import * as notification from "eez-studio-ui/notification";

import { handleDragAndDrop } from "home/drag-and-drop";
import { loadTabs, ProjectEditorTab, tabs } from "home/tabs-store";

import * as ImportInstrumentDefinitionModule from "instrument/import-instrument-definition";
import { LineMarkers } from "project-editor/flow/flow-editor/ConnectionLineComponent";
import { settingsController } from "./settings";

configure({ enforceActions: "observed" });

// make sure we store all the values waiting to be stored inside blur event handler
function blurAll() {
    var tmp = document.createElement("input");
    document.body.appendChild(tmp);
    tmp.focus();
    document.body.removeChild(tmp);
}

async function beforeAppClose() {
    blurAll();

    for (const tab of tabs.tabs) {
        if (tab.beforeAppClose) {
            if (!(await tab.beforeAppClose())) {
                return false;
            }
        }
    }

    const {
        destroyExtensions
    } = require("eez-studio-shared/extensions/extensions");
    destroyExtensions();

    return true;
}

EEZStudio.electron.ipcRenderer.on("beforeClose", async () => {
    if (await beforeAppClose()) {
        EEZStudio.electron.ipcRenderer.send("readyToClose");
    }
});

EEZStudio.electron.ipcRenderer.on("reload", async () => {
    if (await beforeAppClose()) {
        EEZStudio.electron.ipcRenderer.send("reload");
    }
});

EEZStudio.electron.ipcRenderer.on("switch-theme", async () => {
    settingsController.switchTheme(!settingsController.isDarkTheme);
});

EEZStudio.electron.ipcRenderer.on(
    "importInstrumentDefinitionFile",
    (sender: any, filePath: string) => {
        const { importInstrumentDefinition } =
            require("instrument/import-instrument-definition") as typeof ImportInstrumentDefinitionModule;
        importInstrumentDefinition(filePath);
    }
);

EEZStudio.electron.ipcRenderer.on("show-about-box", async () => {
    const { showAboutBox } = await import("eez-studio-ui/about-box");
    showAboutBox();
});

EEZStudio.electron.ipcRenderer.on(
    "open-project",
    async (sender: any, filePath: any) => {
        try {
            let tab = tabs.findProjectEditorTab(filePath);
            if (!tab) {
                tab = await ProjectEditorTab.addTab(filePath);
            }
            if (tab) {
                tab.makeActive();
            }
        } catch (err) {
            console.error(err);
        }
    }
);

EEZStudio.electron.ipcRenderer.on(
    "new-project",
    async (sender: any, filePath: any) => {
        try {
            const tab = await ProjectEditorTab.addTab();
            if (tab) {
                tab.makeActive();
            }
        } catch (err) {
            console.error(err);
        }
    }
);

EEZStudio.electron.ipcRenderer.on("command-palette", () => {
    if (tabs.activeTab && tabs.activeTab.showCommandPalette) {
        tabs.activeTab.showCommandPalette();
    }
});

@observer
class Main extends React.Component {
    render() {
        return (
            <>
                {this.props.children}
                {notification.container}
                <LineMarkers />
            </>
        );
    }
}

async function main() {
    const { loadExtensions } = await import(
        "eez-studio-shared/extensions/extensions"
    );
    await loadExtensions();

    loadTabs();

    const { App } = await import("home/app");
    ReactDOM.render(
        <Main>
            <App />
        </Main>,
        document.getElementById("EezStudio_Content")
    );

    handleDragAndDrop();
}

main();

//require("eez-studio-shared/module-stat");
