import { Point, Rect } from "eez-studio-shared/geometry";
import type { ITreeObjectAdapter } from "project-editor/core/objectAdapter";

import { DocumentStoreClass } from "project-editor/core/store";

import type { Transform } from "project-editor/flow/flow-editor/transform";
import type { InputPropertyValue } from "project-editor/flow/runtime";
import { Component } from "project-editor/flow/component";

export interface IFlowContext {
    dataContext: IDataContext;
    flowState?: IFlowState;
    document: IDocument;
    DocumentStore: DocumentStoreClass;
    viewState: IViewState;
    editorOptions: IEditorOptions;
    frontFace: boolean;

    overrideDataContext(dataContextOverridesObject: any): IFlowContext;
    overrideFlowState(component: Component): IFlowContext;
}

export interface IVariable {
    name: string;
    type: string;
    defaultValue: any;
    defaultMinValue: any;
    defaultMaxValue: any;
    defaultValueList: any;
}

export interface IDataContext {
    createWithDefaultValueOverrides(defaultValueOverrides: any): IDataContext;
    createWithLocalVariables(variables: IVariable[]): IDataContext;

    get(variableName: string): any;
    set(variableName: string, value: any): void;

    getEnumValue(variableName: string): number;
    getBool(variableName: string): boolean;
    getValueList(variableName: string): string[];
    getMin(variableName: string): number;
    getMax(variableName: string): number;
}

export interface IFlowState {
    getFlowStateByComponent(component: Component): IFlowState | undefined;

    getInputValue(component: Component, input: string): any;
    getPropertyValue(component: Component, propertyName: string): any;
    getInputPropertyValue(
        component: Component,
        input: string
    ): InputPropertyValue | undefined;

    getComponentRunningState<T>(component: Component): T;
    setComponentRunningState<T>(component: Component, runningState: T): void;

    dataContext: IDataContext;

    getVariable(component: Component, variableName: string): any;
    setVariable(component: Component, variableName: string, value: any): void;
}

export interface IDocument {
    DocumentStore: DocumentStoreClass;

    flow: ITreeObjectAdapter;

    selectedConnectionLines: ITreeObjectAdapter[];
    nonSelectedConnectionLines: ITreeObjectAdapter[];

    findObjectById(id: string): ITreeObjectAdapter | undefined;
    findObjectParent(
        object: ITreeObjectAdapter
    ): ITreeObjectAdapter | undefined;

    // view
    objectFromPoint(point: Point):
        | {
              id: string;
              connectionInput?: string;
              connectionOutput?: string;
          }
        | undefined;
    getObjectsInsideRect(rect: Rect): ITreeObjectAdapter[];

    // misc.
    createContextMenu(objects: ITreeObjectAdapter[]): Electron.Menu | undefined;
    duplicateSelection(): void;
    pasteSelection(): void;

    // events
    onDragStart(): void;
    onDragEnd(): void;

    //
    connectionExists(
        sourceObjectId: string,
        connectionOutput: string,
        targetObjectId: string,
        connectionInput: string
    ): boolean;
    connect(
        sourceObjectId: string,
        connectionOutput: string,
        targetObjectId: string,
        connectionInput: string
    ): void;
}

export interface IViewState {
    containerId: string;

    transform: Transform;
    resetTransform(): void;

    // selection
    selectedObjects: ITreeObjectAdapter[];
    getResizeHandlers: () => IResizeHandler[] | undefined;

    isObjectSelected(object: ITreeObjectAdapter): boolean;
    isObjectIdSelected(id: string): boolean;

    selectObject(object: ITreeObjectAdapter): void;
    selectObjects(objects: ITreeObjectAdapter[]): void;
    deselectAllObjects(): void;

    moveSelection(
        where:
            | "left"
            | "up"
            | "right"
            | "down"
            | "home-x"
            | "end-x"
            | "home-y"
            | "end-y"
    ): void;

    dxMouseDrag: number | undefined;
    dyMouseDrag: number | undefined;
}

export interface IEditorOptions {
    center?: Point;
    filterSnapLines?: (node: ITreeObjectAdapter) => boolean;
}

export type HandleType =
    | "nw-resize"
    | "n-resize"
    | "ne-resize"
    | "w-resize"
    | "e-resize"
    | "sw-resize"
    | "s-resize"
    | "se-resize";

export interface IResizeHandler {
    // Top-left: 0, 0
    // Bottom-right: 100, 100
    // Left: 0 50
    // ...
    x: number;
    y: number;
    type: HandleType;
    columnIndex?: number;
    rowIndex?: number;
}
