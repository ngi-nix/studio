import React from "react";
import { observable, computed } from "mobx";
import { observer } from "mobx-react";

import { _map, _zipObject } from "eez-studio-shared/algorithm";
import { strToColor16 } from "eez-studio-shared/color";

import {
    ClassInfo,
    PropertyInfo,
    registerClass,
    IEezObject,
    EezObject,
    InheritedValue,
    PropertyType,
    getProperty,
    getChildOfObject,
    MessageType,
    NavigationComponent,
    PropertyProps,
    isAnyPropertyModified,
    getParent
} from "project-editor/core/object";
import {
    SimpleNavigationStoreClass,
    getDocumentStore
} from "project-editor/core/store";
import { validators } from "eez-studio-shared/validation";
import * as output from "project-editor/core/output";
import { ListNavigation } from "project-editor/components/ListNavigation";
import { onSelectItem } from "project-editor/components/SelectItem";
import { Splitter } from "eez-studio-ui/splitter";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    Project,
    findReferencedObject,
    getProject
} from "project-editor/project/project";
import { PropertiesPanel } from "project-editor/project/PropertiesPanel";

import { findFont } from "project-editor/features/font/font";
import { drawText } from "project-editor/flow/draw";
import {
    getThemedColor,
    ThemesSideView
} from "project-editor/features/style/theme";
import { Font } from "project-editor/features/font/font";
import { ProjectContext } from "project-editor/project/context";
import { Component } from "project-editor/flow/component";
import { metrics } from "project-editor/features/style/metrics";

const { MenuItem } = EEZStudio.remote || {};

////////////////////////////////////////////////////////////////////////////////

export function isWidgetParentOfStyle(object: IEezObject) {
    while (true) {
        if (object instanceof Component) {
            return true;
        }
        if (!getParent(object)) {
            return false;
        }
        object = getParent(object);
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class StyleEditor extends React.Component<{
    width: number;
    height: number;
    text: string;
    style: Style;
}> {
    render() {
        const { width, height, text, style } = this.props;

        let canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        drawStylePreview(canvas, style, text);

        return (
            <img
                className="EezStudio_StyleEditorImg"
                src={canvas.toDataURL()}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class StylesNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get navigationObject() {
        return this.props.navigationObject;
    }

    @computed
    get style() {
        const navigationStore =
            this.props.navigationStore || this.context.navigationStore;

        if (navigationStore.selectedPanel) {
            if (navigationStore.selectedPanel.selectedObject instanceof Style) {
                return navigationStore.selectedPanel.selectedObject;
            }
        }

        if (navigationStore.selectedObject instanceof Style) {
            return navigationStore.selectedObject;
        }

        return undefined;
    }

    render() {
        if (this.props.navigationStore) {
            // used in select style dialog
            return (
                <Splitter
                    type="horizontal"
                    persistId="project-editor/styles-dialog"
                    sizes="320px|100%|320px"
                    childrenOverflow="hidden|hidden|hidden"
                >
                    <ListNavigation
                        id={this.props.id}
                        navigationObject={this.navigationObject}
                        navigationStore={this.props.navigationStore}
                        dragAndDropManager={this.props.dragAndDropManager}
                        onDoubleClickItem={this.props.onDoubleClickItem}
                        filter={(style: Style) =>
                            this.context.project.masterProject ==
                            getProject(style)
                                ? style.id != undefined
                                : true
                        }
                    />

                    <Splitter
                        type="vertical"
                        persistId={`project-editor/styles-dialog-middle-splitter`}
                        sizes={`160px|100%`}
                        childrenOverflow="hidden|hidden"
                    >
                        {this.style ? (
                            <StyleEditor
                                style={this.style}
                                width={Math.ceil(480 / 3)}
                                height={Math.ceil(272 / 3)}
                                text="A"
                            />
                        ) : (
                            <div />
                        )}
                        <PropertiesPanel
                            object={this.style}
                            navigationStore={this.props.navigationStore}
                        />
                    </Splitter>

                    <ThemesSideView
                        navigationStore={
                            new SimpleNavigationStoreClass(undefined)
                        }
                        dragAndDropManager={this.props.dragAndDropManager}
                    />
                </Splitter>
            );
        } else {
            // used in global navigation
            return (
                <Splitter
                    type="horizontal"
                    persistId="project-editor/styles-dialog"
                    sizes="240px|100%|400px|240px"
                    childrenOverflow="hidden|hidden|hidden|hidden"
                >
                    <ListNavigation
                        id={this.props.id}
                        navigationObject={this.navigationObject}
                    />
                    {this.style ? (
                        <StyleEditor
                            style={this.style}
                            width={480}
                            height={272}
                            text="Hello!"
                        />
                    ) : (
                        <div />
                    )}
                    <PropertiesPanel object={this.style} />
                    <ThemesSideView />
                </Splitter>
            );
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

const idProperty: PropertyInfo = {
    name: "id",
    type: PropertyType.Number,
    inheritable: false,
    isOptional: true,
    unique: true,
    hideInPropertyGrid: isWidgetParentOfStyle,
    defaultValue: undefined
};

const nameProperty: PropertyInfo = {
    name: "name",
    type: PropertyType.String,
    unique: true,
    hideInPropertyGrid: isWidgetParentOfStyle
};

const descriptionProperty: PropertyInfo = {
    name: "description",
    type: PropertyType.MultilineText,
    hideInPropertyGrid: isWidgetParentOfStyle
};

const inheritFromProperty: PropertyInfo = {
    name: "inheritFrom",
    type: PropertyType.ObjectReference,
    referencedObjectCollectionPath: "styles",
    onSelect: (object: IEezObject, propertyInfo: PropertyInfo) =>
        onSelectItem(object, propertyInfo, {
            title: propertyInfo.onSelectTitle!,
            width: 1200
        }),
    onSelectTitle: "Select Style",
    propertyMenu: (props: PropertyProps): Electron.MenuItem[] => {
        const DocumentStore = getDocumentStore(props.objects[0]);

        let menuItems: Electron.MenuItem[] = [];

        if (isAnyPropertyModified(props)) {
            menuItems.push(
                new MenuItem({
                    label: "Reset All Modifications",
                    click: () => {
                        const propertyValues: any = {};
                        properties.forEach(propertyInfo => {
                            if (propertyInfo.inheritable) {
                                propertyValues[propertyInfo.name] = undefined;
                            }
                        });
                        props.updateObject(propertyValues);
                    }
                })
            );

            if (props.objects.length === 1) {
                const object = props.objects[0] as Style;

                menuItems.push(
                    new MenuItem({
                        label: "Create New Style",
                        click: () => {
                            return showGenericDialog({
                                dialogDefinition: {
                                    title: "New Style",
                                    fields: [
                                        {
                                            name: "name",
                                            type: "string",
                                            validators: [
                                                validators.required,
                                                validators.unique(
                                                    {},
                                                    DocumentStore.project.styles
                                                )
                                            ]
                                        }
                                    ]
                                },
                                values: {}
                            }).then(result => {
                                DocumentStore.undoManager.setCombineCommands(
                                    true
                                );

                                const stylePropertyValues: any = {};
                                const objectPropertyValues: any = {};

                                properties.forEach(propertyInfo => {
                                    stylePropertyValues[propertyInfo.name] =
                                        getProperty(object, propertyInfo.name);

                                    objectPropertyValues[propertyInfo.name] =
                                        undefined;
                                });

                                stylePropertyValues.name = result.values.name;

                                objectPropertyValues.inheritFrom =
                                    result.values.name;

                                DocumentStore.addObject(
                                    DocumentStore.project.styles,
                                    stylePropertyValues
                                );
                                DocumentStore.updateObject(
                                    object,
                                    objectPropertyValues
                                );

                                DocumentStore.undoManager.setCombineCommands(
                                    false
                                );
                            });
                        }
                    })
                );

                const style = findStyle(
                    DocumentStore.project,
                    (props.objects[0] as Style).inheritFrom
                );
                if (style) {
                    menuItems.push(
                        new MenuItem({
                            label: "Update Style",
                            click: () => {
                                DocumentStore.undoManager.setCombineCommands(
                                    true
                                );

                                const stylePropertyValues: any = {};
                                const objectPropertyValues: any = {};
                                properties.forEach(propertyInfo => {
                                    if (
                                        propertyInfo.inheritable &&
                                        getProperty(
                                            object,
                                            propertyInfo.name
                                        ) !== undefined
                                    ) {
                                        stylePropertyValues[propertyInfo.name] =
                                            getProperty(
                                                object,
                                                propertyInfo.name
                                            );

                                        objectPropertyValues[
                                            propertyInfo.name
                                        ] = undefined;
                                    }
                                });

                                DocumentStore.updateObject(
                                    style,
                                    stylePropertyValues
                                );
                                DocumentStore.updateObject(
                                    object,
                                    objectPropertyValues
                                );

                                DocumentStore.undoManager.setCombineCommands(
                                    false
                                );
                            }
                        })
                    );
                }
            }
        }

        return menuItems;
    }
};

const fontProperty: PropertyInfo = {
    name: "font",
    type: PropertyType.ObjectReference,
    referencedObjectCollectionPath: "fonts",
    defaultValue: undefined,
    inheritable: true
};

const alignHorizontalProperty: PropertyInfo = {
    name: "alignHorizontal",
    type: PropertyType.Enum,
    enumItems: [
        {
            id: "center"
        },
        {
            id: "left"
        },
        {
            id: "right"
        }
    ],
    defaultValue: "center",
    inheritable: true
};

const alignVerticalProperty: PropertyInfo = {
    name: "alignVertical",
    type: PropertyType.Enum,
    enumItems: [
        {
            id: "center"
        },
        {
            id: "top"
        },
        {
            id: "bottom"
        }
    ],
    defaultValue: "center",
    inheritable: true
};

const colorProperty: PropertyInfo = {
    name: "color",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#000000",
    inheritable: true
};

const backgroundColorProperty: PropertyInfo = {
    name: "backgroundColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#ffffff",
    inheritable: true
};

const activeColorProperty: PropertyInfo = {
    name: "activeColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#ffffff",
    inheritable: true,
    hideInPropertyGrid: (object: IEezObject) =>
        getDocumentStore(object).project.settings.general.projectVersion ===
        "v1"
};

const activeBackgroundColorProperty: PropertyInfo = {
    name: "activeBackgroundColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#000000",
    inheritable: true,
    hideInPropertyGrid: (object: IEezObject) =>
        getDocumentStore(object).project.settings.general.projectVersion ===
        "v1"
};

const focusColorProperty: PropertyInfo = {
    name: "focusColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#ffffff",
    inheritable: true,
    hideInPropertyGrid: (object: IEezObject) =>
        getDocumentStore(object).project.settings.general.projectVersion ===
        "v1"
};

const focusBackgroundColorProperty: PropertyInfo = {
    name: "focusBackgroundColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#000000",
    inheritable: true,
    hideInPropertyGrid: (object: IEezObject) =>
        getDocumentStore(object).project.settings.general.projectVersion ===
        "v1"
};

const borderSizeProperty: PropertyInfo = {
    name: "borderSize",
    type: PropertyType.String,
    defaultValue: "0",
    inheritable: true
};

const borderRadiusProperty: PropertyInfo = {
    name: "borderRadius",
    type: PropertyType.Number,
    defaultValue: 0,
    inheritable: true
};

const borderColorProperty: PropertyInfo = {
    name: "borderColor",
    type: PropertyType.ThemedColor,
    referencedObjectCollectionPath: "colors",
    defaultValue: "#000000",
    inheritable: true
};

const paddingProperty: PropertyInfo = {
    name: "padding",
    type: PropertyType.String,
    defaultValue: "0",
    inheritable: true
};

const marginProperty: PropertyInfo = {
    name: "margin",
    type: PropertyType.String,
    defaultValue: "0",
    inheritable: true
};

const opacityProperty: PropertyInfo = {
    name: "opacity",
    type: PropertyType.Number,
    defaultValue: 255,
    inheritable: true
};

const blinkProperty: PropertyInfo = {
    name: "blink",
    type: PropertyType.Boolean,
    defaultValue: false,
    inheritable: true
};

const alwaysBuildProperty: PropertyInfo = {
    name: "alwaysBuild",
    type: PropertyType.Boolean,
    defaultValue: false,
    inheritable: false,
    hideInPropertyGrid: isWidgetParentOfStyle
};

const properties = [
    idProperty,
    nameProperty,
    descriptionProperty,
    inheritFromProperty,
    fontProperty,
    alignHorizontalProperty,
    alignVerticalProperty,
    colorProperty,
    backgroundColorProperty,
    activeColorProperty,
    activeBackgroundColorProperty,
    focusColorProperty,
    focusBackgroundColorProperty,
    borderSizeProperty,
    borderRadiusProperty,
    borderColorProperty,
    paddingProperty,
    marginProperty,
    opacityProperty,
    blinkProperty,
    alwaysBuildProperty
];

const propertiesMap: { [propertyName: string]: PropertyInfo } = _zipObject(
    _map(properties, p => p.name),
    _map(properties, p => p)
) as any;

////////////////////////////////////////////////////////////////////////////////

function getInheritedValue(
    styleObject: Style,
    propertyName: string,
    visited: Style[],
    translateThemedColors?: boolean
): InheritedValue {
    if (translateThemedColors == undefined) {
        translateThemedColors = true;
    }

    if (visited.indexOf(styleObject) != -1) {
        return undefined;
    } else {
        visited.push(styleObject);
    }

    let value = getProperty(styleObject, propertyName);
    if (value !== undefined) {
        if (
            translateThemedColors &&
            (propertyName === "color" ||
                propertyName === "backgroundColor" ||
                propertyName === "activeColor" ||
                propertyName === "activeBackgroundColor" ||
                propertyName === "focusColor" ||
                propertyName === "focusBackgroundColor" ||
                propertyName === "borderColor")
        ) {
            value = getThemedColor(getDocumentStore(styleObject), value);
        }

        return {
            value: value,
            source: styleObject
        };
    }

    if (styleObject.inheritFrom) {
        let inheritFromStyleObject = findStyle(
            getProject(styleObject),
            styleObject.inheritFrom
        );

        if (inheritFromStyleObject) {
            return getInheritedValue(
                inheritFromStyleObject,
                propertyName,
                visited,
                translateThemedColors
            );
        }
    }

    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

export class Style extends EezObject {
    @observable id: number | undefined;
    @observable name: string;
    @observable description?: string;
    @observable inheritFrom?: string;
    @observable alwaysBuild: boolean;

    @observable font?: string;
    @observable alignHorizontal?: string;
    @observable alignVertical?: string;
    @observable color?: string;
    @observable backgroundColor?: string;
    @observable activeColor?: string;
    @observable activeBackgroundColor?: string;
    @observable focusColor?: string;
    @observable focusBackgroundColor?: string;
    @observable borderSize?: string;
    @observable borderRadius?: number;
    @observable borderColor?: string;
    @observable padding?: string;
    @observable margin?: string;
    @observable opacity: number;
    @observable blink?: boolean;

    static classInfo: ClassInfo = {
        properties,
        beforeLoadHook(object: Style, jsObject: any) {
            if (
                jsObject.paddingHorizontal !== undefined ||
                jsObject.paddingVertical !== undefined
            ) {
                const paddingHorizontal = jsObject.paddingHorizontal || 0;
                const paddingVertical = jsObject.paddingVertical || 0;

                delete jsObject.paddingHorizontal;
                delete jsObject.paddingVertical;

                if (paddingHorizontal !== paddingVertical) {
                    jsObject.padding =
                        paddingVertical + " " + paddingHorizontal;
                } else {
                    jsObject.padding = paddingHorizontal;
                }
            }
        },
        isPropertyMenuSupported: true,
        newItem: (object: IEezObject) => {
            return Promise.resolve({
                name: "Style"
            });
        },
        getInheritedValue: (styleObject: Style, propertyName: string) =>
            getInheritedValue(styleObject, propertyName, [], false),
        navigationComponentId: "styles",
        isEditorSupported: (object: IEezObject) =>
            !isWidgetParentOfStyle(object),
        navigationComponent: StylesNavigation,
        icon: "format_color_fill",
        defaultValue: {},
        check: (object: Style) => {
            let messages: output.Message[] = [];

            const Projectstore = getDocumentStore(object);

            if (Projectstore.isDashboardProject) {
                return messages;
            }

            if (object.id != undefined) {
                if (!(object.id > 0 || object.id < 32768)) {
                    messages.push(
                        new output.Message(
                            MessageType.ERROR,
                            `"Id": invalid value, should be greater then 0 and less then 32768.`,
                            getChildOfObject(object, "id")
                        )
                    );
                } else {
                    if (
                        Projectstore.project.allStyleIdToStyleMap.get(
                            object.id
                        )!.length > 1
                    ) {
                        messages.push(
                            output.propertyNotUniqueMessage(object, "id")
                        );
                    }
                }
            }

            if (
                object.inheritFrom &&
                !findStyle(Projectstore.project, object.inheritFrom)
            ) {
                messages.push(
                    output.propertyNotFoundMessage(object, "inheritFrom")
                );
            } else {
                // if (!object.fontName) {
                //     messages.push(output.propertyNotFoundMessage(object, "font"));
                // }

                let borderSizeError = Style.getRect(
                    object.borderSizeProperty
                ).error;
                if (borderSizeError) {
                    messages.push(
                        new output.Message(
                            MessageType.ERROR,
                            `"Border size": ${borderSizeError}.`,
                            getChildOfObject(object, "borderSize")
                        )
                    );
                }

                let borderRadius = object.borderRadiusProperty;
                if (borderRadius < 0) {
                    messages.push(
                        output.propertyInvalidValueMessage(
                            object,
                            "borderRadius"
                        )
                    );
                }

                let alignHorizontal = object.alignHorizontalProperty;
                if (
                    alignHorizontal != "left" &&
                    alignHorizontal != "center" &&
                    alignHorizontal != "right"
                ) {
                    messages.push(
                        output.propertyInvalidValueMessage(
                            object,
                            "alignHorizontal"
                        )
                    );
                }

                let alignVertical = object.alignVerticalProperty;
                if (
                    alignVertical != "top" &&
                    alignVertical != "center" &&
                    alignVertical != "bottom"
                ) {
                    messages.push(
                        output.propertyInvalidValueMessage(
                            object,
                            "alignVertical"
                        )
                    );
                }

                if (isNaN(object.color16)) {
                    messages.push(
                        output.propertyInvalidValueMessage(object, "color")
                    );
                }

                if (isNaN(object.backgroundColor16)) {
                    messages.push(
                        output.propertyInvalidValueMessage(
                            object,
                            "backgroundColor"
                        )
                    );
                }

                if (
                    Projectstore.project.settings.general.projectVersion !==
                    "v1"
                ) {
                    if (isNaN(object.activeColor16)) {
                        messages.push(
                            output.propertyInvalidValueMessage(
                                object,
                                "activeColor"
                            )
                        );
                    }

                    if (isNaN(object.activeBackgroundColor16)) {
                        messages.push(
                            output.propertyInvalidValueMessage(
                                object,
                                "activeBackgroundColor"
                            )
                        );
                    }

                    if (isNaN(object.focusColor16)) {
                        messages.push(
                            output.propertyInvalidValueMessage(
                                object,
                                "focusColor"
                            )
                        );
                    }

                    if (isNaN(object.focusBackgroundColor16)) {
                        messages.push(
                            output.propertyInvalidValueMessage(
                                object,
                                "focusBackgroundColor"
                            )
                        );
                    }
                }

                if (isNaN(object.borderColor16)) {
                    messages.push(
                        output.propertyInvalidValueMessage(
                            object,
                            "borderColor"
                        )
                    );
                }

                let paddingError = Style.getRect(object.paddingProperty).error;
                if (paddingError) {
                    messages.push(
                        new output.Message(
                            MessageType.ERROR,
                            `"Padding": ${paddingError}.`,
                            getChildOfObject(object, "padding")
                        )
                    );
                }

                let marginError = Style.getRect(object.marginProperty).error;
                if (marginError) {
                    messages.push(
                        new output.Message(
                            MessageType.ERROR,
                            `"Margin": ${marginError}.`,
                            getChildOfObject(object, "margin")
                        )
                    );
                }
            }

            return messages;
        }
    };

    @computed({
        keepAlive: true
    })
    get fontName(): string {
        return getStyleProperty(this, "font");
    }

    @computed({
        keepAlive: true
    })
    get fontObject(): Font | undefined {
        if (this.font) {
            return findFont(getProject(this), this.font);
        }

        if (this.inheritFrom) {
            let inheritFromStyleObject = findStyle(
                getProject(this),
                this.inheritFrom
            );

            if (inheritFromStyleObject) {
                return getInheritedValue(inheritFromStyleObject, "fontObject", [
                    this
                ])?.value as Font;
            }
        }

        return undefined;
    }

    static getRect(value: string) {
        let error;
        let top = 0;
        let right = 0;
        let bottom = 0;
        let left = 0;

        if (value !== undefined) {
            if (typeof value === "number") {
                if (!Number.isFinite(value)) {
                    error = `value is not a valid number`;
                } else if (value < 0) {
                    error = `value must be >= 0 && <= 25`;
                } else if (value > 255) {
                    error = `value must be >= 0 && <= 255`;
                } else {
                    top = right = bottom = left = value;
                }
            } else if (typeof value === "string") {
                const x = value.trim().split(/\W+/);

                if (x.length === 1) {
                    const value = parseInt(x[0]);
                    if (!Number.isFinite(value)) {
                        error = `value is not a valid number`;
                    } else if (value < 0) {
                        error = `value must be >= 0 && <= 255`;
                    } else if (value > 255) {
                        error = `value must be >= 0 && <= 255`;
                    } else {
                        top = right = bottom = left = value;
                    }
                } else if (x.length === 2) {
                    const topBottomValue = parseInt(x[0]);
                    if (!Number.isFinite(topBottomValue)) {
                        error = `"top/bottom" value is not a valid number`;
                    } else if (topBottomValue < 0) {
                        error = `"top/bottom" value must be >= 0 && <= 255`;
                    } else if (topBottomValue > 255) {
                        error = `"top/bottom" value must be >= 0 && <= 255`;
                    } else {
                        top = bottom = topBottomValue;
                    }

                    const rightLeftValue = parseInt(x[1]);
                    if (!Number.isFinite(rightLeftValue)) {
                        error = `"right/left" value is not a valid number`;
                    } else if (rightLeftValue < 0) {
                        error = `"right/left" value must be >= 0 && <= 255`;
                    } else if (rightLeftValue > 255) {
                        error = `"right/left" value must be >= 0 && <= 255`;
                    } else {
                        right = left = rightLeftValue;
                    }
                } else if (x.length === 3) {
                    const topLeftValue = parseInt(x[0]);
                    if (!Number.isFinite(topLeftValue)) {
                        error = `"top/left" value is not a valid number`;
                    } else if (topLeftValue < 0) {
                        error = `"top/left" value must be >= 0 && <= 255`;
                    } else if (topLeftValue > 255) {
                        error = `"top/left" value must be >= 0 && <= 255`;
                    } else {
                        top = left = topLeftValue;
                    }

                    const rightValue = parseInt(x[1]);
                    if (!Number.isFinite(rightValue)) {
                        error = `"right" value is not a valid number`;
                    } else if (rightValue < 0) {
                        error = `"right" value must be >= 0 && <= 255`;
                    } else if (rightValue > 255) {
                        error = `"right" value must be >= 0 && <= 255`;
                    } else {
                        right = rightValue;
                    }

                    const bottomValue = parseInt(x[2]);
                    if (!Number.isFinite(bottomValue)) {
                        error = `"bottom" value is not a valid number`;
                    } else if (bottomValue < 0) {
                        error = `"bottom" value must be >= 0 && <= 255`;
                    } else if (bottomValue > 255) {
                        error = `"bottom" value must be >= 0 && <= 255`;
                    } else {
                        bottom = bottomValue;
                    }
                } else if (x.length === 4) {
                    const topValue = parseInt(x[0]);
                    if (!Number.isFinite(topValue)) {
                        error = `"top" value is not a valid number`;
                    } else if (topValue < 0) {
                        error = `"top" value must be >= 0 && <= 255`;
                    } else if (topValue > 255) {
                        error = `"top" value must be >= 0 && <= 255`;
                    } else {
                        top = topValue;
                    }

                    const rightValue = parseInt(x[1]);
                    if (!Number.isFinite(rightValue)) {
                        error = `"right" value is not a valid number`;
                    } else if (rightValue < 0) {
                        error = `"right" value must be >= 0 && <= 255`;
                    } else if (rightValue > 255) {
                        error = `"right" value must be >= 0 && <= 255`;
                    } else {
                        right = rightValue;
                    }

                    const bottomValue = parseInt(x[2]);
                    if (!Number.isFinite(bottomValue)) {
                        error = `"bottom" value is not a valid number`;
                    } else if (bottomValue < 0) {
                        error = `"bottom" value must be >= 0 && <= 255`;
                    } else if (bottomValue > 255) {
                        error = `"bottom" value must be >= 0 && <= 255`;
                    } else {
                        bottom = bottomValue;
                    }

                    const leftValue = parseInt(x[3]);
                    if (!Number.isFinite(leftValue)) {
                        error = `"left" value is not a valid number`;
                    } else if (leftValue < 0) {
                        error = `"left" value must be >= 0 && <= 255`;
                    } else if (leftValue > 255) {
                        error = `"left" value must be >= 0 && <= 255`;
                    } else {
                        left = leftValue;
                    }
                } else {
                    error = `invalid value`;
                }
            } else {
                error = "invalid value type";
            }
        }

        return {
            error,
            rect: {
                top,
                right,
                bottom,
                left
            }
        };
    }

    @computed({
        keepAlive: true
    })
    get borderSizeProperty(): string {
        return getStyleProperty(this, "borderSize");
    }

    @computed({
        keepAlive: true
    })
    get borderSizeRect() {
        return Style.getRect(this.borderSizeProperty).rect;
    }

    @computed({
        keepAlive: true
    })
    get borderRadiusProperty(): number {
        return getStyleProperty(this, "borderRadius");
    }

    @computed({
        keepAlive: true
    })
    get alignHorizontalProperty(): string {
        return getStyleProperty(this, "alignHorizontal");
    }

    @computed({
        keepAlive: true
    })
    get alignVerticalProperty(): string {
        return getStyleProperty(this, "alignVertical");
    }

    @computed({
        keepAlive: true
    })
    get colorProperty(): string {
        return getStyleProperty(this, "color");
    }

    @computed({
        keepAlive: true
    })
    get color16(): number {
        return strToColor16(this.colorProperty);
    }

    @computed({
        keepAlive: true
    })
    get backgroundColorProperty(): string {
        return getStyleProperty(this, "backgroundColor");
    }

    @computed({
        keepAlive: true
    })
    get backgroundColor16(): number {
        return strToColor16(this.backgroundColorProperty);
    }

    @computed({
        keepAlive: true
    })
    get activeColorProperty(): string {
        return getStyleProperty(this, "activeColor");
    }

    @computed({
        keepAlive: true
    })
    get activeColor16(): number {
        return strToColor16(this.activeColorProperty);
    }

    @computed({
        keepAlive: true
    })
    get activeBackgroundColorProperty(): string {
        return getStyleProperty(this, "activeBackgroundColor");
    }

    @computed({
        keepAlive: true
    })
    get activeBackgroundColor16(): number {
        return strToColor16(this.activeBackgroundColorProperty);
    }

    @computed({
        keepAlive: true
    })
    get focusColorProperty(): string {
        return getStyleProperty(this, "focusColor");
    }

    @computed({
        keepAlive: true
    })
    get focusColor16(): number {
        return strToColor16(this.focusColorProperty);
    }

    @computed({
        keepAlive: true
    })
    get focusBackgroundColorProperty(): string {
        return getStyleProperty(this, "focusBackgroundColor");
    }

    @computed({
        keepAlive: true
    })
    get focusBackgroundColor16(): number {
        return strToColor16(this.focusBackgroundColorProperty);
    }

    @computed({
        keepAlive: true
    })
    get borderColorProperty(): string {
        return getStyleProperty(this, "borderColor");
    }

    @computed({
        keepAlive: true
    })
    get borderColor16(): number {
        return strToColor16(this.borderColorProperty);
    }

    @computed({
        keepAlive: true
    })
    get paddingProperty(): string {
        return getStyleProperty(this, "padding");
    }

    @computed({
        keepAlive: true
    })
    get paddingRect() {
        return Style.getRect(this.paddingProperty).rect;
    }

    @computed({
        keepAlive: true
    })
    get marginProperty(): string {
        return getStyleProperty(this, "margin");
    }

    @computed({
        keepAlive: true
    })
    get marginRect() {
        return Style.getRect(this.marginProperty).rect;
    }

    @computed({
        keepAlive: true
    })
    get opacityProperty(): number {
        const opacity = getStyleProperty(this, "opacity");
        if (isNaN(opacity)) {
            return 255;
        }
        return opacity;
    }

    @computed({
        keepAlive: true
    })
    get blinkProperty(): number {
        return getStyleProperty(this, "blink");
    }

    compareTo(otherStyle: Style): boolean {
        return (
            this.fontName === otherStyle.fontName &&
            this.alignHorizontalProperty ===
                otherStyle.alignHorizontalProperty &&
            this.alignVerticalProperty === otherStyle.alignVerticalProperty &&
            this.colorProperty === otherStyle.colorProperty &&
            this.backgroundColorProperty ===
                otherStyle.backgroundColorProperty &&
            this.activeColorProperty === otherStyle.activeColorProperty &&
            this.activeBackgroundColorProperty ===
                otherStyle.activeBackgroundColorProperty &&
            this.focusColorProperty === otherStyle.focusColorProperty &&
            this.focusBackgroundColorProperty ===
                otherStyle.focusBackgroundColorProperty &&
            this.borderSizeProperty === otherStyle.borderSizeProperty &&
            this.borderRadiusProperty === otherStyle.borderRadiusProperty &&
            this.borderColorProperty === otherStyle.borderColorProperty &&
            this.paddingProperty === otherStyle.paddingProperty &&
            this.marginProperty === otherStyle.marginProperty &&
            this.opacityProperty === otherStyle.opacityProperty &&
            this.blinkProperty === otherStyle.blinkProperty
        );
    }
}

registerClass(Style);

////////////////////////////////////////////////////////////////////////////////

export function getStyleProperty(
    style: Style,
    propertyName: string,
    translateThemedColors?: boolean
): any {
    let inheritedValue = getInheritedValue(
        style,
        propertyName,
        [],
        translateThemedColors
    );
    if (inheritedValue) {
        return inheritedValue.value;
    }

    return propertiesMap[propertyName].defaultValue;
}

export function drawStylePreview(
    canvas: HTMLCanvasElement,
    style: Style,
    text: string
) {
    let ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (ctx) {
        ctx.save();
        if (canvas.width > canvas.height) {
            drawText(
                ctx,
                text,
                0,
                0,
                canvas.width / 2,
                canvas.height,
                style,
                false
            );
            drawText(
                ctx,
                text,
                canvas.width / 2,
                0,
                canvas.width / 2,
                canvas.height,
                style,
                true
            );
        } else {
            drawText(
                ctx,
                text,
                0,
                0,
                canvas.width,
                canvas.height / 2,
                style,
                false
            );
            drawText(
                ctx,
                text,
                0,
                canvas.height / 2,
                canvas.width,
                canvas.height / 2,
                style,
                true
            );
        }
        ctx.restore();
    }
}

////////////////////////////////////////////////////////////////////////////////

export function findStyle(project: Project, styleName: string | undefined) {
    if (styleName == undefined) {
        return undefined;
    }

    return findReferencedObject(project, "styles", styleName) as
        | Style
        | undefined;
}

////////////////////////////////////////////////////////////////////////////////

export default {
    name: "eezstudio-project-feature-style",
    version: "0.1.0",
    description: "Styles support for your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    eezStudioExtension: {
        displayName: "Styles",
        category: "project-feature",
        implementation: {
            projectFeature: {
                mandatory: false,
                key: "styles",
                type: PropertyType.Array,
                typeClass: Style,
                icon: "format_color_fill",
                create: () => [],
                metrics,
                toJsHook: (jsObject: Project, project: Project) => {
                    //
                    jsObject.colors.forEach((color: any) => delete color.id);

                    jsObject.themes.forEach((theme: any, i: number) => {
                        delete theme.id;
                        theme.colors = project.themes[i].colors;
                    });

                    delete (jsObject as Partial<Project>).themeColors;
                }
            }
        }
    }
};
