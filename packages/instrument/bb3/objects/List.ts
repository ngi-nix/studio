import { observable, action, computed, runInAction } from "mobx";

import { beginTransaction, commitTransaction } from "eez-studio-shared/store";
import { objectClone } from "eez-studio-shared/util";
import { makeCsvData, getValidFileNameFromFileName } from "eez-studio-shared/util-electron";

import { BaseList } from "instrument/window/lists/store-renderer";
import { Connection } from "instrument/window/connection";
import { ListHistoryItem } from "instrument/window/history/items/list";
import { createTableListFromHistoryItem } from "instrument/window/lists/factory";
import { getCsvDataColumnDefinitions } from "instrument/window/lists/lists";

import { removeQuotes, useConnection } from "instrument/bb3/helpers";
import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";

export interface IListOnInstrument {
    name: string;
    date: Date;
}

export async function getListsOnTheInstrument(connection: Connection) {
    const lists: IListOnInstrument[] = [];

    const filesInFolderAsOneString = await connection.query('MMEM:CAT? "/Lists"');
    const filesInFolderAsArray = removeQuotes(filesInFolderAsOneString).split('","');

    for (const fileInfoLine of filesInFolderAsArray) {
        const fileName = fileInfoLine.split(",")[0];
        if (fileName.toLowerCase().endsWith(".list")) {
            const name = fileName.substr(0, fileName.lastIndexOf("."));

            const dateStr = await connection.query(`MMEMory:DATE? "/Lists/${fileName}"`);
            const [year, month, day] = dateStr.split(",");
            const timeStr = await connection.query(`MMEMory:TIME? "/Lists/${fileName}"`);
            const [hours, minutes, seconds] = timeStr.split(",");
            const date = new Date(year, month - 1, day, hours, minutes, seconds);

            lists.push({
                name,
                date
            });
        }
    }

    return lists;
}

export class List {
    @observable listOnInstrument: IListOnInstrument | undefined;
    @observable busy: boolean = false;

    constructor(
        public bb3Instrument: BB3Instrument,
        listOnInstrument: IListOnInstrument | undefined,
        public studioList: BaseList | undefined
    ) {
        this.listOnInstrument = listOnInstrument;
    }

    @computed
    get baseName() {
        return this.listOnInstrument?.name ?? getValidFileNameFromFileName(this.studioList!.name);
    }

    @computed
    get fileName() {
        return `${this.baseName}.list`;
    }

    @computed
    get description() {
        return this.studioList?.description ?? "";
    }

    @computed
    get instrumentDate() {
        return this.listOnInstrument?.date;
    }

    @computed
    get studioDate() {
        return this.studioList?.modifiedAt;
    }

    @computed
    get instrumentVersionNewer() {
        return this.instrumentDate && (!this.studioDate || this.instrumentDate > this.studioDate);
    }

    @computed
    get studioVersionNewer() {
        return this.studioDate && (!this.instrumentDate || this.studioDate > this.instrumentDate);
    }

    get canDownload() {
        return !!this.listOnInstrument;
    }

    @action setBusy(value: boolean) {
        this.busy = value;
    }

    download = async () => {
        const listOnInstrument = this.listOnInstrument;
        if (!listOnInstrument) {
            return;
        }

        await useConnection(
            this,
            async connection => {
                const listHistoryItem: ListHistoryItem = await connection.query(
                    `MMEMory:UPLoad? "/Lists/${this.fileName}"`
                );

                const tableList = createTableListFromHistoryItem(
                    listHistoryItem,
                    this.bb3Instrument.appStore,
                    this.bb3Instrument.appStore.instrument!
                );

                tableList.description = this.description;
                tableList.modifiedAt = listOnInstrument.date;

                if (this.studioList) {
                    tableList.id = this.studioList.id;
                    tableList.name = this.studioList.name;
                    beginTransaction("Update instrument list");
                    this.bb3Instrument.appStore.instrumentListStore.updateObject(
                        objectClone(tableList)
                    );
                } else {
                    tableList.name = listOnInstrument.name;
                    beginTransaction("Import instrument list");
                    this.bb3Instrument.appStore.instrumentListStore.createObject(
                        objectClone(tableList)
                    );
                }

                commitTransaction();
            },
            false
        );
    };

    get canUpload() {
        return !!this.studioList;
    }

    upload = async () => {
        const studioList = this.studioList;
        if (!studioList) {
            return;
        }

        await useConnection(
            this,
            async connection => {
                const sourceData = makeCsvData(
                    studioList.tableListData,
                    getCsvDataColumnDefinitions(this.bb3Instrument.appStore.instrument!)
                );

                await new Promise<void>((resolve, reject) => {
                    const uploadInstructions = Object.assign(
                        {},
                        connection.instrument.defaultFileUploadInstructions,
                        {
                            sourceData,
                            sourceFileType: "application/octet-stream",
                            destinationFileName: this.fileName,
                            destinationFolderPath: "/Lists"
                        }
                    );

                    connection.upload(uploadInstructions, resolve, reject);
                });

                const dateStr = await connection.query(`MMEMory:DATE? "/Lists/${this.fileName}"`);
                const [year, month, day] = dateStr.split(",");
                const timeStr = await connection.query(`MMEMory:TIME? "/Lists/${this.fileName}"`);
                const [hours, minutes, seconds] = timeStr.split(",");

                const listOnInstrument = {
                    name: this.baseName,
                    date: new Date(year, month - 1, day, hours, minutes, seconds)
                };

                runInAction(() => {
                    this.listOnInstrument = listOnInstrument;
                });

                beginTransaction("Update instrument list modified date");
                this.bb3Instrument.appStore.instrumentListStore.updateObject({
                    id: studioList.id,
                    modifiedAt: listOnInstrument.date
                });
                commitTransaction();
            },
            true
        );
    };

    get canEdit() {
        return !!this.studioList;
    }

    edit = () => {
        if (this.studioList) {
            this.bb3Instrument.appStore.navigationStore.changeSelectedListId(this.studioList.id);
        }
    };
}
