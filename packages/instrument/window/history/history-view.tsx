import React from "react";
import ReactDOM from "react-dom";
import { observable, computed, action, keys } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { readBinaryFile } from "eez-studio-shared/util-electron";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";
import { log } from "eez-studio-shared/activity-log";

import { IconAction, ButtonAction } from "eez-studio-ui/action";
import { Toolbar } from "eez-studio-ui/toolbar";
import { SideDock, DockablePanels } from "eez-studio-ui/side-dock";
import { SearchInput } from "eez-studio-ui/search-input";

import { extensions } from "eez-studio-shared/extensions/extensions";

import { IAppStore, INavigationStore } from "instrument/window/history/history";
import { HistoryListComponent } from "instrument/window/history/list-component";
import { IHistoryItem } from "instrument/window/history/item";
import { SearchResults } from "instrument/window/history/search-results";
import { FiltersComponent } from "instrument/window/history/filters";
import { Calendar } from "instrument/window/history/calendar";
import { SessionList } from "instrument/window/history/session/list-view";
import { Scrapbook } from "instrument/window/history/scrapbook";

import { showAddNoteDialog } from "instrument/window/note-dialog";

import {
    detectFileType,
    extractColumnFromCSVHeuristically
} from "instrument/connection/file-type";

////////////////////////////////////////////////////////////////////////////////

@observer
export class HistoryTools extends React.Component<{ appStore: IAppStore }, {}> {
    @bind
    addNote() {
        showAddNoteDialog(note => {
            beginTransaction("Add note");
            log(
                this.props.appStore.history.options.store,
                {
                    oid: this.props.appStore.history.oid,
                    type: "activity-log/note",
                    message: note
                },
                {
                    undoable: true
                }
            );
            commitTransaction();
        });
    }

    @bind
    async attachFile() {
        const result = await EEZStudio.remote.dialog.showOpenDialog({
            properties: ["openFile", "multiSelections"],
            filters: [{ name: "All Files", extensions: ["*"] }]
        });

        const filePaths = result.filePaths;
        if (filePaths) {
            filePaths.forEach(async filePath => {
                let data = await readBinaryFile(filePath);

                let message;

                if (filePath.toLowerCase().endsWith(".csv")) {
                    const result = extractColumnFromCSVHeuristically(data);
                    if (result) {
                        data = result.data;

                        message = {
                            state: "success",
                            fileType: { mime: "application/eez-raw" },
                            waveformDefinition: {
                                samplingRate: result.samplingRate,
                                format: 7, // FLOATS_64BIT
                                unitName: result.unitName,
                                color: result.color,
                                colorInverse: result.colorInverse,
                                label: result.label,
                                offset: 0,
                                scale: 1
                            },
                            viewOptions: {
                                axesLines: {
                                    type: "dynamic",
                                    steps: {
                                        x: [],
                                        y: []
                                    },
                                    majorSubdivision: {
                                        horizontal: 24,
                                        vertical: 8
                                    },
                                    minorSubdivision: {
                                        horizontal: 5,
                                        vertical: 5
                                    },
                                    snapToGrid: true,
                                    defaultZoomMode: "all"
                                }
                            },
                            dataLength: data.length
                        };
                    }
                }

                if (!message) {
                    const fileType = detectFileType(data, filePath);
                    const note = fileType.comment;
                    delete fileType.comment;
                    message = {
                        sourceFilePath: filePath,
                        state: "success",
                        fileType,
                        note,
                        dataLength: data.length
                    };
                }

                beginTransaction("Attach file");
                log(
                    this.props.appStore.history.options.store,
                    {
                        oid: this.props.appStore.history.oid,
                        type: "instrument/file-attachment",
                        message: JSON.stringify(message),
                        data: data
                    },
                    {
                        undoable: true
                    }
                );
                commitTransaction();
            });
        }
    }

    @bind
    addChart() {
        this.props.appStore.selectHistoryItems({
            historyItemType: "chart",
            message: "Select one or more waveform data items",
            okButtonText: "Add Chart",
            okButtonTitle: "Add chart",
            onOk: () => {
                const multiWaveformDefinition = {
                    waveformLinks: keys(
                        this.props.appStore.selectedHistoryItems
                    ).map(id => ({
                        id
                    }))
                };

                this.props.appStore.selectHistoryItems(undefined);

                beginTransaction("Add chart");
                log(
                    this.props.appStore.history.options.store,
                    {
                        oid: this.props.appStore.history.oid,
                        type: "instrument/chart",
                        message: JSON.stringify(multiWaveformDefinition)
                    },
                    {
                        undoable: true
                    }
                );
                commitTransaction();
            }
        });
    }

    @bind
    generateChart() {
        const numSamples = 128;
        const data = new Buffer(numSamples * 8);
        for (let i = 0; i < numSamples; ++i) {
            let value;
            if (i <= 10) {
                value = 1;
            } else if (i >= 118) {
                value = 1;
            } else {
                value = 0;
            }
            data.writeDoubleLE(value, i * 8);
        }

        beginTransaction("Generate chart");
        log(
            this.props.appStore.history.options.store,
            {
                oid: this.props.appStore.history.oid,
                type: "instrument/file-attachment",
                message: JSON.stringify({
                    state: "success",
                    fileType: { mime: "application/eez-raw" },
                    waveformDefinition: {
                        samplingRate: 1,
                        format: 7, // FLOATS_64BIT
                        unitName: "volt",
                        color: "blue",
                        colorInverse: "blue",
                        label: "Voltage",
                        offset: 0,
                        scale: 1
                    },
                    dataLength: data.length
                }),
                data
            },
            {
                undoable: true
            }
        );
        commitTransaction();
    }

    render() {
        const { appStore } = this.props;

        const tools: JSX.Element[] = [];

        if (appStore.selectHistoryItemsSpecification === undefined) {
            tools.push(
                <IconAction
                    key="addNote"
                    icon="material:comment"
                    title="Add note"
                    onClick={this.addNote}
                />,
                <IconAction
                    key="addFile"
                    icon="material:attach_file"
                    title="Attach file"
                    onClick={this.attachFile}
                />,
                <IconAction
                    key="addChart"
                    icon="material:insert_chart"
                    title="Add chart"
                    onClick={this.addChart}
                /> /*,
                <IconAction
                    key="generateChart"
                    icon="material:wb_auto"
                    title="Generate chart"
                    onClick={this.generateChart}
                />*/
            );

            // add tools from extensions
            const numToolsBefore = tools.length;
            extensions.forEach(extension => {
                if (extension.activityLogTools) {
                    extension.activityLogTools.forEach(activityLogTool => {
                        const controller = {
                            store: appStore.history.options.store,
                            selection: appStore.history.selection.items
                        };

                        let tool;

                        if (typeof activityLogTool === "function") {
                            tool = activityLogTool(controller);
                        } else {
                            if (activityLogTool.isEnabled(controller)) {
                                tool = (
                                    <IconAction
                                        key={activityLogTool.id}
                                        icon={activityLogTool.icon}
                                        title={activityLogTool.title}
                                        onClick={() =>
                                            activityLogTool.handler(controller)
                                        }
                                    />
                                );
                            }
                        }
                        if (tool) {
                            if (numToolsBefore === tools.length) {
                                tools.push(
                                    <div
                                        key={`separator_${numToolsBefore}`}
                                        style={{ width: 10 }}
                                    />
                                );
                            }
                            tools.push(tool);
                        }
                    });
                }
            });

            if (appStore.history.selection.canDelete) {
                tools.push(
                    <IconAction
                        key="delete"
                        icon="material:delete"
                        title="Delete selected history items"
                        style={{ marginLeft: 10 }}
                        onClick={appStore.history.deleteSelectedHistoryItems}
                    />
                );
            }

            if (appStore.deletedItemsHistory.deletedCount > 0) {
                const style =
                    appStore.history.selection.items.length === 0
                        ? { marginLeft: 20 }
                        : undefined;

                tools.push(
                    <ButtonAction
                        key="deletedItems"
                        text={`Deleted Items (${appStore.deletedItemsHistory.deletedCount})`}
                        title="Show deleted items"
                        onClick={
                            appStore.navigationStore
                                .navigateToDeletedHistoryItems
                        }
                        className="btn-sm"
                        style={style}
                    />
                );
            }
        }

        return tools;
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class HistoryView extends React.Component<{
    appStore: IAppStore;
    persistId: string;
    simple?: boolean;
}> {
    animationFrameRequestId: any;
    history: HistoryListComponent | null;
    sideDock: SideDock | null;

    @observable searchText: string = "";

    @bind
    frameAnimation() {
        if (this.sideDock) {
            this.sideDock.updateSize();
        }

        this.animationFrameRequestId = window.requestAnimationFrame(
            this.frameAnimation
        );
    }

    componentDidMount() {
        this.frameAnimation();

        if (!this.props.simple) {
            this.props.appStore.navigationStore.mainHistoryView = this;
        }
    }

    componentWillUnmount() {
        window.cancelAnimationFrame(this.animationFrameRequestId);

        if (!this.props.simple) {
            this.props.appStore.navigationStore.mainHistoryView = undefined;
        }
    }

    @bind
    onSelectHistoryItemsOk() {
        this.props.appStore.selectHistoryItemsSpecification!.onOk();
    }

    @bind
    onSelectHistoryItemsCancel() {
        this.props.appStore.selectHistoryItems(undefined);
    }

    @action.bound
    onSearchChange(event: any) {
        this.searchText = $(event.target).val() as string;
        this.props.appStore.history.search.search(this.searchText);
    }

    @bind
    registerComponents(factory: any) {
        const appStore = this.props.appStore;

        factory.registerComponent(
            "SearchResults",
            function (container: any, props: any) {
                ReactDOM.render(
                    <div
                        style={{
                            position: "absolute",
                            width: "100%",
                            height: "100%",
                            display: "flex"
                        }}
                    >
                        <SearchResults history={appStore.history} />
                    </div>,
                    container.getElement()[0]
                );
            }
        );

        factory.registerComponent(
            "Filters",
            function (container: any, props: any) {
                ReactDOM.render(
                    <FiltersComponent appStore={appStore} />,
                    container.getElement()[0]
                );
            }
        );

        factory.registerComponent(
            "Calendar",
            function (container: any, props: any) {
                ReactDOM.render(
                    <div
                        style={{
                            height: "100%",
                            overflow: "auto"
                        }}
                    >
                        <Calendar history={appStore.history} />
                    </div>,
                    container.getElement()[0]
                );
            }
        );

        factory.registerComponent(
            "Sessions",
            function (container: any, props: any) {
                ReactDOM.render(
                    <div
                        style={{
                            position: "absolute",
                            width: "100%",
                            height: "100%",
                            display: "flex"
                        }}
                    >
                        <SessionList
                            appStore={appStore}
                            history={appStore.history}
                        />
                    </div>,
                    container.getElement()[0]
                );
            }
        );

        factory.registerComponent(
            "Scrapbook",
            function (container: any, props: any) {
                ReactDOM.render(
                    <Scrapbook
                        appStore={appStore}
                        history={appStore.history}
                    />,
                    container.getElement()[0]
                );
            }
        );
    }

    get searchResultsItem() {
        return {
            id: "searchResults",
            type: "component",
            componentName: "SearchResults",
            componentState: {},
            title: "Search results",
            isClosable: false
        };
    }

    get filtersItem() {
        return {
            id: "filters",
            type: "component",
            componentName: "Filters",
            componentState: {},
            title: "Filters",
            isClosable: false
        };
    }

    get calendarItem() {
        return {
            id: "calendar",
            type: "component",
            componentName: "Calendar",
            componentState: {},
            title: "Calendar",
            isClosable: false
        };
    }

    get sessionsItem() {
        return {
            id: "sessions",
            type: "component",
            componentName: "Sessions",
            componentState: {},
            title: "Sessions",
            isClosable: false
        };
    }

    get scrapbookItem() {
        return {
            id: "scrapbook",
            type: "component",
            componentName: "Scrapbook",
            componentState: {},
            title: "Scrapbook",
            isClosable: false
        };
    }

    @computed
    get defaultLayoutConfig() {
        let content;
        if (this.props.appStore.history.search.searchActive) {
            if (this.props.appStore.history.isSessionsSupported) {
                content = [
                    {
                        type: "stack",
                        content: [
                            this.searchResultsItem,
                            this.calendarItem,
                            this.sessionsItem,
                            this.filtersItem,
                            this.scrapbookItem
                        ]
                    }
                ];
            } else {
                content = [
                    {
                        type: "stack",
                        content: [
                            this.searchResultsItem,
                            this.calendarItem,
                            this.filtersItem,
                            this.scrapbookItem
                        ]
                    }
                ];
            }
        } else {
            if (this.props.appStore.history.isSessionsSupported) {
                content = [
                    {
                        type: "stack",
                        content: [
                            this.calendarItem,
                            this.sessionsItem,
                            this.filtersItem,
                            this.scrapbookItem
                        ]
                    }
                ];
            } else {
                content = [
                    {
                        type: "stack",
                        content: [
                            this.calendarItem,
                            this.filtersItem,
                            this.scrapbookItem
                        ]
                    }
                ];
            }
        }

        const defaultLayoutConfig = {
            settings: DockablePanels.DEFAULT_SETTINGS,
            dimensions: DockablePanels.DEFAULT_DIMENSIONS,
            content
        };

        return defaultLayoutConfig;
    }

    renderHistoryComponentWithTools(historyComponent: JSX.Element) {
        const appStore = this.props.appStore;
        return (
            <div className="EezStudio_HistoryContainer">
                {appStore.selectHistoryItemsSpecification && (
                    <div className="EezStudio_HistoryHeader EezStudio_SlideInDownTransition">
                        <div>
                            {appStore.selectedHistoryItems.size > 0
                                ? `${appStore.selectedHistoryItems.size} selected`
                                : appStore.selectHistoryItemsSpecification
                                      .message}
                        </div>
                        <Toolbar>
                            {appStore.selectedHistoryItems.size > 0 && (
                                <ButtonAction
                                    text={
                                        appStore.selectHistoryItemsSpecification
                                            .okButtonText
                                    }
                                    title={
                                        appStore.selectHistoryItemsSpecification
                                            .okButtonTitle
                                    }
                                    className={
                                        appStore.selectHistoryItemsSpecification
                                            .alertDanger
                                            ? "btn-danger"
                                            : "btn-primary"
                                    }
                                    onClick={this.onSelectHistoryItemsOk}
                                />
                            )}
                            <ButtonAction
                                text="Cancel"
                                title="Cancel"
                                className="btn-secondary"
                                onClick={this.onSelectHistoryItemsCancel}
                            />
                        </Toolbar>
                    </div>
                )}
                <div
                    className="EezStudio_HistoryBody"
                    onClick={event => {
                        if (
                            $(event.target).closest(
                                ".EezStudio_HistoryItemEnclosure"
                            ).length === 0
                        ) {
                            // deselect all items
                            this.props.appStore.history.selection.selectItems(
                                []
                            );
                        }
                    }}
                    tabIndex={0}
                >
                    {historyComponent}
                </div>
            </div>
        );
    }

    render() {
        const appStore = this.props.appStore;

        const historyComponent = (
            <HistoryListComponent
                ref={ref => (this.history = ref)}
                appStore={appStore}
                history={appStore.history}
            />
        );

        if (this.props.simple) {
            return historyComponent;
        }

        const historyComponentWithTools =
            this.renderHistoryComponentWithTools(historyComponent);

        let input = (
            <SearchInput
                searchText={this.searchText}
                onChange={this.onSearchChange}
            />
        );

        let layoutId = "layout/3";
        if (this.props.appStore.history.search.searchActive) {
            layoutId += "/with-search-results";
        }
        if (!this.props.appStore.history.isSessionsSupported) {
            layoutId += "/without-sessions";
        }

        return (
            <SideDock
                ref={ref => (this.sideDock = ref)}
                persistId={this.props.persistId + "/side-dock-1"}
                layoutId={layoutId}
                defaultLayoutConfig={this.defaultLayoutConfig}
                registerComponents={this.registerComponents}
                header={input}
                width={420}
            >
                {historyComponentWithTools}
            </SideDock>
        );
    }
}

export function moveToTopOfHistory(historyView: HistoryView | undefined) {
    if (historyView && historyView.history) {
        historyView.history.moveToTop();
    }
}

export function moveToBottomOfHistory(historyView: HistoryView | undefined) {
    if (historyView && historyView.history) {
        historyView.history.moveToBottom();
    }
}

export function showHistoryItem(
    historyView: HistoryView | undefined,
    historyItem: IHistoryItem
) {
    if (historyView && historyView.history) {
        historyView.history.showHistoryItem(historyItem);
    }
}

export function showSessionsList(navigationStore: INavigationStore) {
    const sideDock =
        navigationStore.mainHistoryView &&
        navigationStore.mainHistoryView.sideDock;
    if (sideDock) {
        if (!sideDock.isOpen) {
            sideDock.toggleIsOpen();
        } else {
            if (sideDock.dockablePanels) {
                const items =
                    sideDock.dockablePanels.goldenLayout.root.getItemsById(
                        "sessions"
                    );
                if (items.length === 1) {
                    items[0].parent.setActiveContentItem(items[0]);
                }
            }
            return;
        }
    }
    // try again
    setTimeout(() => showSessionsList(navigationStore), 0);
}
