import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { formatDateTimeLong } from "eez-studio-shared/util";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";
import { IActivityLogEntry, logUpdate } from "eez-studio-shared/activity-log";

import { Balloon } from "eez-studio-ui/balloon";
import { PropertyList, StaticRichTextProperty } from "eez-studio-ui/properties";
import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";

import { showEditNoteDialog } from "instrument/window/note-dialog";

import { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";
import { PreventDraggable } from "instrument/window/history/helper";

////////////////////////////////////////////////////////////////////////////////

@observer
export class NoteHistoryItemComponent extends React.Component<
    {
        historyItem: NoteHistoryItem;
    },
    {}
> {
    @bind
    handleEditNote() {
        showEditNoteDialog(this.props.historyItem.message, note => {
            beginTransaction("Edit note");
            logUpdate(
                this.props.historyItem.appStore.history.options.store,
                {
                    id: this.props.historyItem.id,
                    oid: this.props.historyItem.appStore!.history.oid,
                    message: note
                },
                {
                    undoable: true
                }
            );
            commitTransaction();
        });
    }

    render() {
        return (
            <div
                className="EezStudio_NoteHistoryItem"
                onDoubleClick={this.handleEditNote}
            >
                <Balloon>
                    <p>
                        <small className="EezStudio_HistoryItemDate">
                            {formatDateTimeLong(this.props.historyItem.date)}
                        </small>
                    </p>
                    {this.props.historyItem.sourceDescriptionElement}
                    <PreventDraggable tag="div">
                        <PropertyList>
                            <StaticRichTextProperty
                                value={this.props.historyItem.message}
                            />
                        </PropertyList>
                    </PreventDraggable>
                </Balloon>
                <Toolbar>
                    <IconAction
                        icon="material:edit"
                        title="Edit note"
                        onClick={this.handleEditNote}
                    />
                </Toolbar>
            </div>
        );
    }
}

export class NoteHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore: IAppStore) {
        super(activityLogEntry, appStore);
    }

    get info() {
        return (
            <Balloon>
                <PropertyList>
                    <StaticRichTextProperty value={this.message} />
                </PropertyList>
            </Balloon>
        );
    }

    @computed
    get listItemElement(): JSX.Element | null {
        return <NoteHistoryItemComponent historyItem={this} />;
    }
}
