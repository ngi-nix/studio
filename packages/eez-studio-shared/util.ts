import MobXModule from "mobx";
import MomentModule from "moment";
import stringify from "json-stable-stringify";

import * as GeometryModule from "eez-studio-shared/geometry";

import * as I10nModule from "eez-studio-shared/i10n";

export function parseXmlString(xmlString: string) {
    // remove UTF-8 BOM
    if (xmlString.startsWith("\ufeff")) {
        xmlString = xmlString.slice("\ufeff".length);
    }
    let parser = new DOMParser();
    return parser.parseFromString(xmlString, "text/xml");
}

export function getBoundingClientRectOfChildNodes(element: Element) {
    const { BoundingRectBuilder } =
        require("eez-studio-shared/geometry") as typeof GeometryModule;
    let boundingRectBuilder = new BoundingRectBuilder();
    element.childNodes.forEach(node => {
        if (node instanceof Element) {
            boundingRectBuilder.addRect(
                getBoundingClientRectIncludingChildNodes(node)
            );
        }
    });
    return boundingRectBuilder.getRect()!;
}

export function getBoundingClientRectIncludingChildNodes(element: Element) {
    const { BoundingRectBuilder } =
        require("eez-studio-shared/geometry") as typeof GeometryModule;
    let boundingRectBuilder = new BoundingRectBuilder();
    boundingRectBuilder.addRect(element.getBoundingClientRect());
    boundingRectBuilder.addRect(getBoundingClientRectOfChildNodes(element));
    return boundingRectBuilder.getRect()!;
}

export function formatNumber(
    value: number,
    base: number,
    width: number
): string {
    return ("0".repeat(width) + value.toString(base))
        .substr(-width)
        .toUpperCase();
}

export function formatTransferSpeed(speed: number) {
    let ordinals = ["", "K", "M", "G", "T", "P", "E"];

    let bandwidth = speed * 8; // bits per second

    let rate = bandwidth;
    let ordinal = 0;
    while (rate > 1024) {
        rate /= 1024;
        ordinal++;
    }

    return `${Math.round(rate * 10) / 10} ${ordinals[ordinal]}b/s`;
}

export function objectClone(obj: any) {
    const { toJS } = require("mobx") as typeof MobXModule;

    let a: any = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key) && !key.startsWith("$eez_noser")) {
            a[key] = obj[key];
        }
    }

    return JSON.parse(
        JSON.stringify(toJS(a), (key: string, value: any) => {
            return key.startsWith("$") || key.startsWith("_eez_")
                ? undefined
                : value;
        })
    );
}

export function objectEqual<T>(a: T, b: T) {
    const { toJS } = require("mobx") as typeof MobXModule;
    const astr = stringify(toJS(a));
    const bstr = stringify(toJS(b));
    return astr === bstr;
}

export function clamp(value: number, min: number, max: number) {
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
}

var moment: typeof MomentModule | undefined;
var userLocale: string;
var localeData: MomentModule.Locale;
var localeWeekdays: string[];
var defaultDateFormat: string;
var defaultTimeFormat: string;
var defaultDateTimeFormat: string;

export function getMoment() {
    if (!moment) {
        moment = require("moment") as typeof MomentModule;
        require("moment-duration-format")(moment);
        const { getLocale, getDateFormat, getTimeFormat } =
            require("eez-studio-shared/i10n") as typeof I10nModule;
        userLocale = getLocale();
        localeData = getMoment().localeData(userLocale);
        localeWeekdays = localeData.weekdays();
        moment.locale(userLocale);
        defaultDateFormat = getDateFormat();
        defaultTimeFormat = getTimeFormat();
        defaultDateTimeFormat = defaultDateFormat + " " + defaultTimeFormat;
    }
    return moment;
}

export function formatDateTimeLong(date: Date) {
    return getMoment()(date).format(defaultDateTimeFormat);
}

export function formatDate(date: Date, format?: string) {
    return getMoment()(date).format(format || defaultDateFormat);
}

export function formatDuration(duration: number) {
    return getMoment().duration(duration).format("d __, h __, m __, s __", {
        userLocale
    });
}

export function getFirstDayOfWeek() {
    return localeData.firstDayOfWeek();
}

export function getDayOfWeek(date: Date) {
    const dayFromSunday = date.getDay();
    let day = dayFromSunday - getFirstDayOfWeek();
    if (day < 0) {
        day = 7 + day;
    }
    return day;
}

export function getDayOfWeekName(dayOfWeek: number) {
    return localeWeekdays[dayOfWeek];
}

export function getWeekNumber(date: Date) {
    return getMoment()(date).week();
}

let reservedKeybindings: string[] | undefined = undefined;

function getReservedKeybindings() {
    if (!reservedKeybindings) {
        reservedKeybindings = EEZStudio.electron.ipcRenderer
            .sendSync("getReservedKeybindings")
            .concat([
                "Insert",
                "Delete",
                "Home",
                "End",
                "Pageup",
                "Pagedown",
                "Scrolllock",
                "Pause",
                "Arrowleft",
                "Arrowright",
                "Arrowup",
                "Arrowdown",
                "Backspace",
                "Tab",
                "Ctrl+C",
                "Ctrl+V"
            ]);
        console.log("Reserved keybindings", reservedKeybindings);
    }
    return reservedKeybindings!;
}

function keybindingEqual(keybinding1: string, keybinding2: string) {
    const keybinding1Parts = keybinding1.toLowerCase().split("+");
    const keybinding2Parts = keybinding2.toLowerCase().split("+");

    if (keybinding1Parts.length !== keybinding2Parts.length) {
        return false;
    }

    for (let i = 0; i < keybinding1Parts.length; i++) {
        if (keybinding2Parts.indexOf(keybinding1Parts[i]) === -1) {
            return false;
        }
    }

    return true;
}

export function isReserverdKeybinding(keybinding: string) {
    let reservedKeybindings = getReservedKeybindings();

    for (let i = 0; i < reservedKeybindings.length; i++) {
        if (keybindingEqual(keybinding, reservedKeybindings[i])) {
            return true;
        }
    }

    return false;
}

export function mnemonicLabel(label: string): string {
    const os = require("os");

    if (os.platform() != "win32") {
        return label.replace(/\(&&\w\)|&&/g, ""); // no mnemonic support on mac/linux
    }

    return label.replace(/&&/g, "&");
}

export async function confirmSave({
    saveCallback,
    dontSaveCallback,
    cancelCallback
}: {
    saveCallback: () => void;
    dontSaveCallback: () => void;
    cancelCallback: () => void;
}) {
    enum ConfirmResult {
        SAVE,
        DONT_SAVE,
        CANCEL
    }

    const saveButtton = {
        label: mnemonicLabel("&&Save"),
        result: ConfirmResult.SAVE
    };
    const dontSaveButton = {
        label: mnemonicLabel("Do&&n't Save"),
        result: ConfirmResult.DONT_SAVE
    };
    const cancelButton = { label: "Cancel", result: ConfirmResult.CANCEL };

    const os = require("os");

    const buttons: any[] = [];
    if (os.platform() == "win32") {
        buttons.push(saveButtton, dontSaveButton, cancelButton);
    } else if (os.platform() == "linux") {
        buttons.push(dontSaveButton, cancelButton, saveButtton);
    } else {
        buttons.push(saveButtton, cancelButton, dontSaveButton);
    }

    let opts: Electron.MessageBoxOptions = {
        type: "warning",
        title: document.title,
        message: "Do you want to save changes?",
        detail: "Your changes will be lost if you don't save them.",
        noLink: true,
        buttons: buttons.map(b => b.label),
        cancelId: buttons.indexOf(cancelButton)
    };

    if (os.platform() == "linux") {
        opts.defaultId = 2;
    }

    const result = await EEZStudio.remote.dialog.showMessageBox(
        EEZStudio.remote.getCurrentWindow(),
        opts
    );
    const buttonIndex = result.response;
    let choice = buttons[buttonIndex].result;
    if (choice == ConfirmResult.SAVE) {
        saveCallback();
    } else if (choice == ConfirmResult.DONT_SAVE) {
        dontSaveCallback();
    } else {
        cancelCallback();
    }
}

export async function delay(time: number) {
    return new Promise(resolve => setTimeout(resolve, time));
}

export const studioVersion = require("../../package.json").version;

export function compareVersions(v1: string, v2: string) {
    const v1Parts = v1
        .toString()
        .split(".")
        .map(x => parseInt(x));

    const v2Parts = v2
        .toString()
        .split(".")
        .map(x => parseInt(x));

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); ++i) {
        if (isNaN(v1Parts[i])) {
            if (isNaN(v2Parts[i])) {
                return 0;
            }
            return -1;
        }

        if (isNaN(v2Parts[i])) {
            return 1;
        }

        if (v1Parts[i] < v2Parts[i]) {
            return -1;
        }

        if (v1Parts[i] > v2Parts[i]) {
            return 1;
        }
    }

    return 0;
}

////////////////////////////////////////////////////////////////////////////////

export function sendSimpleMessage(message: string, args: any) {
    EEZStudio.remote.BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send("shared/simple-message", {
            message,
            args
        });
    });
}

export function onSimpleMessage(
    message: string,
    callback: (args: any) => void
) {
    EEZStudio.electron.ipcRenderer.on(
        "shared/simple-message",
        (
            event: any,
            args: {
                message: string;
                args: any;
            }
        ) => {
            if (args.message === message) {
                callback(args.args);
            }
        }
    );
}

export function remap(
    x: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
) {
    return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}
