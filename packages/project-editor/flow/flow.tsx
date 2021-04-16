import React from "react";
import { guid } from "eez-studio-shared/guid";
import { humanize } from "eez-studio-shared/string";
import { action, computed, observable, runInAction } from "mobx";
import { objectToClipboardData } from "project-editor/core/clipboard";
import {
    ClassInfo,
    cloneObject,
    EezObject,
    getLabel,
    getParent,
    IEditorState,
    IEezObject,
    isSubclassOf,
    PropertyInfo,
    PropertyType,
    registerClass
} from "project-editor/core/object";
import {
    ITreeObjectAdapter,
    TreeObjectAdapter
} from "project-editor/core/objectAdapter";
import { visitObjects } from "project-editor/core/search";
import { getDocumentStore } from "project-editor/core/store";
import { Component } from "project-editor/flow/component";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { Rect } from "eez-studio-shared/geometry";
import { deleteObject, updateObject } from "project-editor/core/commands";

////////////////////////////////////////////////////////////////////////////////

export class ConnectionLine extends EezObject {
    @observable source: string;
    @observable output: string;
    @observable target: string;
    @observable input: string;

    @observable _active: boolean;

    static classInfo: ClassInfo = {
        label: (connectionLine: ConnectionLine) => {
            return `${getLabel(connectionLine.sourceComponent!)}@${humanize(
                connectionLine.output
            )} ➝ ${getLabel(connectionLine.targetComponent!)}@${humanize(
                connectionLine.input
            )}`;
        },

        properties: [
            {
                name: "source",
                type: PropertyType.String,
                hideInPropertyGrid: true
            },
            {
                name: "output",
                type: PropertyType.String,
                hideInPropertyGrid: true
            },
            {
                name: "target",
                type: PropertyType.String,
                hideInPropertyGrid: true
            },
            {
                name: "input",
                type: PropertyType.String,
                hideInPropertyGrid: true
            }
        ],

        isSelectable: () => true
    };

    @computed get sourceComponent() {
        const page = getParent(getParent(this)) as Flow;
        return page.wiredComponents.get(this.source);
    }

    @computed get targetComponent() {
        const page = getParent(getParent(this)) as Flow;
        return page.wiredComponents.get(this.target);
    }

    @computed get sourcePosition() {
        if (!(this.sourceComponent && this.sourceComponent._geometry)) {
            return undefined;
        }

        const outputGeometry = this.sourceComponent._geometry.outputs[
            this.output
        ];
        if (!outputGeometry) {
            return undefined;
        }

        return {
            x:
                this.sourceComponent.absolutePositionPoint.x +
                outputGeometry.position.x,
            y:
                this.sourceComponent.absolutePositionPoint.y +
                outputGeometry.position.y
        };
    }

    @computed get targetPosition() {
        if (!(this.targetComponent && this.targetComponent._geometry)) {
            return undefined;
        }
        const inputGeometry = this.targetComponent._geometry.inputs[this.input];
        if (!inputGeometry) {
            return undefined;
        }

        return {
            x:
                this.targetComponent.absolutePositionPoint.x +
                inputGeometry.position.x,
            y:
                this.targetComponent.absolutePositionPoint.y +
                inputGeometry.position.y
        };
    }

    @computed get sourceRect() {
        if (!(this.sourceComponent && this.sourceComponent._geometry)) {
            return {
                left: 0,
                top: 0,
                width: 0,
                height: 0
            };
        }

        return this.sourceComponent._geometry;
    }

    @computed get targetRect() {
        if (!(this.targetComponent && this.targetComponent._geometry)) {
            return {
                left: 0,
                top: 0,
                width: 0,
                height: 0
            };
        }

        return this.targetComponent._geometry;
    }

    get active() {
        return this._active;
    }

    _setActiveTimeoutId: any;

    @action
    setActive() {
        this._active = true;

        if (this._setActiveTimeoutId) {
            clearTimeout(this._setActiveTimeoutId);
        }

        this._setActiveTimeoutId = setTimeout(() => {
            this._setActiveTimeoutId = undefined;
            runInAction(() => (this._active = false));
        }, 100);
    }
}

registerClass(ConnectionLine);

////////////////////////////////////////////////////////////////////////////////

export abstract class Flow extends EezObject {
    static classInfo: ClassInfo = {
        properties: [
            {
                name: "components",
                type: PropertyType.Array,
                typeClass: Component,
                hideInPropertyGrid: true
            },
            {
                name: "connectionLines",
                type: PropertyType.Array,
                typeClass: ConnectionLine,
                hideInPropertyGrid: true
            }
        ],
        findPastePlaceInside: (
            flow: Flow,
            classInfo: ClassInfo,
            isSingleObject: boolean
        ): IEezObject | PropertyInfo | undefined => {
            if (flow) {
                if (isSubclassOf(classInfo, Component.classInfo)) {
                    return flow.components;
                } else if (classInfo === FlowFragment.classInfo) {
                    return flow;
                }
            }
            return undefined;
        },

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            if (jsObject.connectionLines) {
                for (let i = 1; i < jsObject.connectionLines.length; i++) {
                    for (let j = 0; j < i; j++) {
                        const a = jsObject.connectionLines[i];
                        const b = jsObject.connectionLines[j];
                        if (
                            a.source == b.source &&
                            a.output == b.output &&
                            a.target == b.target &&
                            a.input == b.input
                        ) {
                            console.log("duplicate", a);
                        }
                    }
                }
            }
        }
    };

    components: Component[];
    connectionLines: ConnectionLine[];

    @computed get wiredComponents() {
        const components = new Map<string, Component>();

        const v = visitObjects(this.components);
        while (true) {
            let visitResult = v.next();
            if (visitResult.done) {
                break;
            }
            if (visitResult.value instanceof Component) {
                const component = visitResult.value;
                components.set(component.wireID, component);
            }
        }

        return components;
    }

    objectsToClipboardData(objects: IEezObject[]) {
        const flowFragment = new FlowFragment();
        flowFragment.addObjects(this, objects);
        return objectToClipboardData(flowFragment);
    }

    pasteFlowFragment(flowFragment: FlowFragment) {
        const DocumentStore = getDocumentStore(this);

        DocumentStore.UndoManager.setCombineCommands(true);

        flowFragment.rewire();

        flowFragment.components.forEach(widget => {
            widget.left += 20;
            widget.top += 20;
        });

        DocumentStore.addObjects(
            this.connectionLines,
            flowFragment.connectionLines
        );

        const widgets = DocumentStore.addObjects(
            this.components,
            flowFragment.components
        );

        DocumentStore.UndoManager.setCombineCommands(false);

        return widgets;
    }

    deleteConnectionLines(component: Component) {
        this.connectionLines
            .filter(
                connectionLine =>
                    connectionLine.sourceComponent == component ||
                    connectionLine.targetComponent == component
            )
            .forEach(connectionLine => deleteObject(connectionLine));
    }

    deleteConnectionLinesToInput(component: Component, input: string) {
        this.connectionLines
            .filter(
                connectionLine =>
                    connectionLine.targetComponent == component &&
                    connectionLine.input == input
            )
            .forEach(connectionLine => deleteObject(connectionLine));
    }

    deleteConnectionLinesFromOutput(component: Component, output: string) {
        this.connectionLines
            .filter(
                connectionLine =>
                    connectionLine.sourceComponent == component &&
                    connectionLine.output == output
            )
            .forEach(connectionLine => deleteObject(connectionLine));
    }

    rerouteConnectionLinesInput(
        component: Component,
        inputBefore: string,
        inputAfter: string
    ) {
        this.connectionLines
            .filter(
                connectionLine =>
                    connectionLine.targetComponent == component &&
                    connectionLine.input == inputBefore
            )
            .forEach(connectionLine =>
                updateObject(connectionLine, {
                    input: inputAfter
                })
            );
    }

    rerouteConnectionLinesOutput(
        component: Component,
        outputBefore: string,
        outputAfter: string
    ) {
        this.connectionLines
            .filter(
                connectionLine =>
                    connectionLine.sourceComponent == component &&
                    connectionLine.output == outputBefore
            )
            .forEach(connectionLine =>
                updateObject(connectionLine, {
                    output: outputAfter
                })
            );
    }

    abstract get pageRect(): Rect;

    abstract renderComponents(flowContext: IFlowContext): React.ReactNode;
}

////////////////////////////////////////////////////////////////////////////////

export class FlowFragment extends EezObject {
    components: Component[];
    connectionLines: ConnectionLine[];

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "components",
                type: PropertyType.Array,
                typeClass: Component
            },
            {
                name: "connectionLines",
                type: PropertyType.Array,
                typeClass: ConnectionLine
            }
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            if (jsObject.widgets) {
                jsObject.components = jsObject.widgets;
                delete jsObject.widgets;
            }
        }
    };

    addObjects(flow: Flow, objects: IEezObject[]) {
        this.components = [];
        this.connectionLines = [];

        const DocumentStore = getDocumentStore(flow);

        const wireIDMap = new Map<string, string>();

        objects.forEach((object: Component) => {
            const clone = cloneObject(DocumentStore, object) as Component;
            wireIDMap.set(object.wireID, object.wireID);
            this.components.push(clone);
        });

        flow.connectionLines.forEach(connectionLine => {
            const source = wireIDMap.get(connectionLine.source);
            const target = wireIDMap.get(connectionLine.target);
            if (source && target) {
                const clone = cloneObject(
                    DocumentStore,
                    connectionLine
                ) as ConnectionLine;
                this.connectionLines.push(clone);
            }
        });
    }

    rewire() {
        const wireIDMap = new Map<string, string>();

        this.components.forEach((object: Component) => {
            const wireID = guid();
            wireIDMap.set(object.wireID, wireID);
            object.wireID = wireID;
        });

        this.connectionLines.forEach(connectionLine => {
            const newSource = wireIDMap.get(connectionLine.source)!;
            const newTarget = wireIDMap.get(connectionLine.target)!;
            connectionLine.source = newSource;
            connectionLine.target = newTarget;
        });
    }
}

registerClass(FlowFragment);

////////////////////////////////////////////////////////////////////////////////

export class FlowTabState implements IEditorState {
    flow: Flow;
    componentContainerDisplayItem: ITreeObjectAdapter;

    constructor(object: IEezObject) {
        this.flow = object as Flow;
        this.componentContainerDisplayItem = new TreeObjectAdapter(this.flow);
    }

    @computed
    get selectedObject(): IEezObject | undefined {
        return this.componentContainerDisplayItem.selectedObject || this.flow;
    }

    @computed
    get selectedObjects() {
        return this.componentContainerDisplayItem.selectedObjects;
    }

    loadState(state: any) {
        this.componentContainerDisplayItem.loadState(state);
    }

    saveState() {
        return this.componentContainerDisplayItem.saveState();
    }

    @action
    selectObject(object: IEezObject) {
        let ancestor: IEezObject | undefined;
        for (ancestor = object; ancestor; ancestor = getParent(ancestor)) {
            let item = this.componentContainerDisplayItem.getObjectAdapter(
                ancestor
            );
            if (item) {
                this.componentContainerDisplayItem.selectItems([item]);
                return;
            }
        }
    }

    @action
    selectObjects(objects: IEezObject[]) {
        const items: ITreeObjectAdapter[] = [];

        for (let i = 0; i < objects.length; i++) {
            const object = objects[i];

            let ancestor: IEezObject | undefined;
            for (ancestor = object; ancestor; ancestor = getParent(ancestor)) {
                let item = this.componentContainerDisplayItem.getObjectAdapter(
                    ancestor
                );
                if (item) {
                    items.push(item);
                    break;
                }
            }
        }

        this.componentContainerDisplayItem.selectItems(items);
    }
}