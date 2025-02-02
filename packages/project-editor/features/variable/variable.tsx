import React from "react";
import { computed, action, observable, autorun, runInAction } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";

import { validators } from "eez-studio-shared/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    registerClass,
    IEezObject,
    EezObject,
    PropertyType,
    PropertyInfo,
    NavigationComponent,
    PropertyProps,
    getClassInfo
} from "project-editor/core/object";
import * as output from "project-editor/core/output";
import {
    findReferencedObject,
    getProject,
    Project
} from "project-editor/project/project";
import {
    ListNavigation,
    ListNavigationWithProperties
} from "project-editor/components/ListNavigation";
import { build } from "project-editor/features/variable/build";
import { metrics } from "project-editor/features/variable/metrics";
import type {
    IDataContext,
    IVariable
} from "project-editor/flow/flow-interfaces";
import { getDocumentStore } from "project-editor/core/store";
import { ProjectContext } from "project-editor/project/context";
import { Splitter } from "eez-studio-ui/splitter";
import { PropertiesPanel } from "project-editor/project/PropertiesPanel";
import { MenuNavigation } from "project-editor/components/MenuNavigation";
import { humanize } from "eez-studio-shared/string";
import { getPropertyValue } from "project-editor/components/PropertyGrid/utils";

const VariableIcon = (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        className="icon icon-tabler icon-tabler-variable"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M5 4c-2.5 5 -2.5 10 0 16m14 -16c2.5 5 2.5 10 0 16m-10 -11h1c1 0 1 1 2.016 3.527c.984 2.473 .984 3.473 1.984 3.473h1" />
        <path d="M8 16c1.5 0 3 -2 4 -3.5s2.5 -3.5 4 -3.5" />
    </svg>
);

////////////////////////////////////////////////////////////////////////////////

export type VariableType =
    | "integer"
    | "float"
    | "double"
    | "boolean"
    | "string"
    | "date"
    | "enum"
    | "struct"
    | "array"
    | "undefined"
    | "null"
    | "any";

const basicTypeNames = [
    "integer",
    "float",
    "double",
    "boolean",
    "string",
    "date"
];

////////////////////////////////////////////////////////////////////////////////

@observer
export class VariableTypeUI extends React.Component<PropertyProps> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    ref = React.createRef<HTMLSelectElement>();

    @observable _type: string;
    @observable updateCounter: number = 0;

    @computed get typePropertyInfo() {
        return getClassInfo(this.props.objects[0]).properties.find(
            propertyInfo => propertyInfo.name === "type"
        )!;
    }

    @disposeOnUnmount
    changeDocumentDisposer = autorun(() => {
        this.updateCounter;
        if (this.context.project) {
            const getPropertyValueResultForType = getPropertyValue(
                this.props.objects,
                this.typePropertyInfo
            );

            let type = getPropertyValueResultForType
                ? getPropertyValueResultForType.value
                : "";

            if (type == undefined) {
                type = "";
            }

            runInAction(() => {
                this._type = type;
            });
        }
    });

    componentDidMount() {
        let el = this.ref.current;
        if (el) {
            $(el).on("focus", () => {
                this.context.undoManager.setCombineCommands(true);
            });

            $(el).on("blur", () => {
                this.context.undoManager.setCombineCommands(false);
            });
        }
    }

    @action
    componentDidUpdate() {
        this.updateCounter++;
    }

    onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const type = event.target.value;

        runInAction(() => (this._type = type));

        this.props.updateObject({
            type
        });
    };

    render() {
        const basicTypes = basicTypeNames.map(basicTypeName => {
            return (
                <option key={basicTypeName} value={basicTypeName}>
                    {humanize(basicTypeName)}
                </option>
            );
        });

        basicTypes.unshift(<option key="__empty" value="" />);

        const project = getProject(this.props.objects[0]);

        const enums = project.variables.enums.map(enumDef => (
            <option key={enumDef.name} value={`enum:${enumDef.name}`}>
                {enumDef.name}
            </option>
        ));

        const structures = project.variables.structures.map(struct => (
            <option key={struct.name} value={`struct:${struct.name}`}>
                {struct.name}
            </option>
        ));

        const arrayOfBasicTypes = basicTypeNames.map(basicTypeName => {
            return (
                <option
                    key={`array:${basicTypeName}`}
                    value={`array:${basicTypeName}`}
                >
                    {humanize(basicTypeName)}
                </option>
            );
        });

        const arrayOfEnums = project.variables.enums.map(enumDef => (
            <option key={enumDef.name} value={`array:enum:${enumDef.name}`}>
                {enumDef.name}
            </option>
        ));

        const arrayOfStructures = project.variables.structures.map(struct => (
            <option key={struct.name} value={`array:struct:${struct.name}`}>
                {struct.name}
            </option>
        ));

        return (
            <select
                ref={this.ref}
                className="form-select"
                value={this._type}
                onChange={this.onChange}
            >
                {basicTypes}
                {enums.length > 0 && (
                    <optgroup label="Enumerations">{enums}</optgroup>
                )}
                {structures.length > 0 && (
                    <optgroup label="Structures">{structures}</optgroup>
                )}
                <optgroup label="Array of">{arrayOfBasicTypes}</optgroup>
                {arrayOfEnums.length > 0 && (
                    <optgroup label="Array of Enumerations">
                        {arrayOfEnums}
                    </optgroup>
                )}
                {arrayOfStructures.length > 0 && (
                    <optgroup label="Array of Structures">
                        {arrayOfStructures}
                    </optgroup>
                )}
            </select>
        );
    }
}

export const variableTypeUIProperty = {
    name: "variableTypeUI",
    displayName: "Type",
    type: PropertyType.Any,
    computed: true,
    propertyGridColumnComponent: VariableTypeUI
};

////////////////////////////////////////////////////////////////////////////////

export const variableTypeProperty: PropertyInfo = {
    name: "type",
    type: PropertyType.String,
    hideInPropertyGrid: true
};

////////////////////////////////////////////////////////////////////////////////

function migrateType(objectJS: any) {
    if (objectJS.type == "list") {
        objectJS.type = "array";
    } else if (objectJS.type == "struct") {
        objectJS.type = `struct:${objectJS.structure}`;
        delete objectJS.structure;
    } else if (objectJS.type == "enum") {
        objectJS.type = `enum:${objectJS.enum}`;
        delete objectJS.enum;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class Variable extends EezObject {
    @observable name: string;
    @observable description?: string;

    @observable type: string;

    @observable defaultValue: string;
    @observable defaultValueList: string;
    @observable defaultMinValue: number;
    @observable defaultMaxValue: number;

    @observable usedIn?: string[];

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            variableTypeProperty,
            variableTypeUIProperty,
            {
                name: "defaultValue",
                type: PropertyType.MultilineText
            },
            {
                name: "defaultValueList",
                type: PropertyType.MultilineText
            },
            {
                name: "defaultMinValue",
                type: PropertyType.Number
            },
            {
                name: "defaultMaxValue",
                type: PropertyType.Number
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                referencedObjectCollectionPath: "settings/build/configurations",
                hideInPropertyGrid: (object: IEezObject) =>
                    getDocumentStore(object).isDashboardProject
            }
        ],
        beforeLoadHook: (object: Variable, objectJS: any) => {
            migrateType(objectJS);
        },
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Global Variable",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name
                });
            });
        },
        navigationComponent: ListNavigationWithProperties,
        navigationComponentId: "global-variables",
        icon: VariableIcon,
        check: (variable: Variable) => {
            let messages: output.Message[] = [];

            if (!variable.type) {
                messages.push(output.propertyNotSetMessage(variable, "type"));
            }

            if (!variable.defaultValue) {
                messages.push(
                    output.propertyNotSetMessage(variable, "defaultValue")
                );
            }

            return messages;
        }
    };
}

registerClass(Variable);

////////////////////////////////////////////////////////////////////////////////

export function findVariable(project: Project, variableName: string) {
    return findReferencedObject(
        project,
        "variables/globalVariables",
        variableName
    ) as Variable | undefined;
}

////////////////////////////////////////////////////////////////////////////////

const ENUM_TYPE_REGEXP = /^enum:(.*)/;
const STRUCT_TYPE_REGEXP = /^struct:(.*)/;
const ARRAY_TYPE_REGEXP = /^array:(.*)/;

export function isIntegerType(type: string) {
    return type == "integer";
}

export function isEnumType(type: string) {
    return type.match(ENUM_TYPE_REGEXP) != null;
}

export function isStructType(type: string) {
    return type.match(STRUCT_TYPE_REGEXP) != null;
}

export function isArrayType(type: string) {
    return type.match(ARRAY_TYPE_REGEXP) != null;
}

export function getArrayElementTypeFromType(type: string) {
    const result = type.match(ARRAY_TYPE_REGEXP);
    if (result == null) {
        return null;
    }
    return result[1];
}

export function getStructTypeNameFromType(type: string) {
    const result = type.match(STRUCT_TYPE_REGEXP);
    if (result == null) {
        return null;
    }
    return result[1];
}

export function getEnumTypeNameFromType(type: string) {
    const result = type.match(ENUM_TYPE_REGEXP);
    if (result == null) {
        return null;
    }
    return result[1];
}

export function isIntegerVariable(variable: Variable) {
    return isIntegerType(variable.type);
}

export function isEnumVariable(variable: Variable) {
    return isEnumType(variable.type);
}

export function isStructVariable(variable: Variable) {
    return isStructType(variable.type);
}

export function isArrayVariable(variable: Variable) {
    return isArrayType(variable.type);
}

export function getEnumTypeNameFromVariable(variable: Variable) {
    return getEnumTypeNameFromType(variable.type);
}

function getEnumValues(variable: Variable): any[] {
    return [];
}

////////////////////////////////////////////////////////////////////////////////

export class DataContext implements IDataContext {
    project: Project;
    parentDataContext: DataContext | undefined;
    defaultValueOverrides: any;
    localVariables: Map<string, IVariable> | undefined = undefined;
    @observable runtimeValues: Map<string, any>;

    constructor(
        project: Project,
        parentDataContext?: DataContext,
        defaultValueOverrides?: any,
        localVariables?: Map<string, IVariable>
    ) {
        this.project = project;
        this.parentDataContext = parentDataContext;
        this.defaultValueOverrides = defaultValueOverrides;
        this.localVariables = localVariables;
        this.runtimeValues = new Map<string, any>();
    }

    createWithDefaultValueOverrides(defaultValueOverrides: any): IDataContext {
        return new DataContext(this.project, this, defaultValueOverrides);
    }

    createWithLocalVariables(variablesArray: IVariable[]) {
        const localVariables = new Map<string, any>();
        variablesArray.forEach(variable => {
            localVariables.set(variable.name, variable);
        });
        return new DataContext(this.project, this, undefined, localVariables);
    }

    getRuntimeValue(variable: IVariable | undefined): {
        hasValue: boolean;
        value: any;
    } {
        if (variable) {
            if (this.runtimeValues.has(variable.name)) {
                return {
                    hasValue: this.runtimeValues.has(variable.name),
                    value: this.runtimeValues.get(variable.name)
                };
            }

            if (this.parentDataContext) {
                return this.parentDataContext.getRuntimeValue(variable);
            }
        }

        return { hasValue: false, value: undefined };
    }

    setRuntimeValue(variableName: string, value: any) {
        if (this.localVariables && this.localVariables.has(variableName)) {
            this.runtimeValues.set(variableName, value);
        } else {
            if (this.parentDataContext) {
                this.parentDataContext.setRuntimeValue(variableName, value);
            } else {
                const variable = findVariable(this.project, variableName);
                if (variable) {
                    this.runtimeValues.set(variableName, value);
                } else {
                    throw `variable "${variableName}" not found`;
                }
            }
        }
    }

    @action
    clearRuntimeValues() {
        this.runtimeValues.clear();
    }

    @action
    set(variableName: string, value: any) {
        this.setRuntimeValue(variableName, value);
    }

    findVariableDefaultValue(variableName: string): any {
        if (this.defaultValueOverrides) {
            const defaultValue = this.defaultValueOverrides[variableName];
            if (defaultValue != undefined) {
                return defaultValue;
            }
        }
        if (this.parentDataContext) {
            return this.parentDataContext.findVariableDefaultValue(
                variableName
            );
        }
        return undefined;
    }

    findVariable(variableName: string): IVariable | undefined {
        let variable: IVariable | undefined;

        // find local variable
        if (this.localVariables && this.localVariables.has(variableName)) {
            variable = this.localVariables.get(variableName);
        }

        if (!variable) {
            if (this.parentDataContext) {
                return this.parentDataContext.findVariable(variableName);
            }
        }

        if (!variable) {
            // find global variable
            variable = findVariable(this.project, variableName);
        }

        if (variableName === "$it") {
            return {
                name: "$it",
                type: "integer",
                defaultValue: 0,
                defaultMinValue: undefined,
                defaultMaxValue: undefined,
                defaultValueList: undefined
            };
        }

        return variable;
    }

    get(variableName: string): any {
        if (!variableName) {
            return undefined;
        }

        const parts = variableName.split(".");
        variableName = parts[0];

        if (variableName === undefined) {
            return undefined;
        }

        let value: any = undefined;

        const variable = this.findVariable(variableName);
        const { hasValue, value: value_ } = this.getRuntimeValue(variable);

        if (variable) {
            if (hasValue) {
                value = value_;
            } else {
                let defaultValue = this.findVariableDefaultValue(variableName);
                if (defaultValue == undefined) {
                    defaultValue = variable.defaultValue;
                }

                if (defaultValue !== undefined) {
                    if (isIntegerVariable(variable)) {
                        value = parseInt(defaultValue);
                        if (isNaN(value)) {
                            console.error(
                                "Invalid integer default value",
                                variable
                            );
                        }
                    } else if (isEnumVariable(variable)) {
                        // TODO this is invalid check
                        value = defaultValue;
                        if (getEnumValues(variable).indexOf(value) == -1) {
                            console.error(
                                "Invalid enum default value",
                                variable
                            );
                        }
                    } else if (variable.type == "float") {
                        value = parseFloat(defaultValue);
                        if (isNaN(value)) {
                            value = defaultValue;
                            console.error(
                                "Invalid float default value",
                                variable
                            );
                        }
                    } else if (variable.type == "boolean") {
                        defaultValue = defaultValue
                            .toString()
                            .trim()
                            .toLowerCase();
                        if (defaultValue == "1" || defaultValue == "true") {
                            value = true;
                        } else if (
                            defaultValue == "0" ||
                            defaultValue == "false"
                        ) {
                            value = false;
                        } else {
                            value = undefined;
                        }
                    } else if (variable.type == "array") {
                        try {
                            value =
                                typeof defaultValue === "string"
                                    ? JSON.parse(defaultValue)
                                    : defaultValue;
                        } catch (err) {
                            value = [];
                            console.error(
                                "Invalid array default value",
                                variable,
                                err
                            );
                        }
                    } else {
                        value = defaultValue;
                    }
                } else {
                    value = undefined;
                }
            }
        }

        for (let i = 1; i < parts.length; i++) {
            if (value == undefined) {
                return value;
            }

            value = value[parts[i]];
        }

        return value;
    }

    getBool(variableName: string): boolean {
        let value = this.get(variableName);

        if (typeof value === "boolean") {
            return value;
        }

        if (typeof value === "number" && Number.isInteger(value)) {
            return value ? true : false;
        }

        return false;
    }

    getEnumValue(variableName: string): number {
        let value = this.get(variableName);

        if (typeof value === "boolean") {
            return value ? 1 : 0;
        } else if (typeof value === "number" && Number.isInteger(value)) {
            return value;
        } else if (typeof value === "string") {
            let variable = this.findVariable(variableName);
            if (variable && isEnumVariable(variable)) {
                // TODO this is invalid check
                value = getEnumValues(variable).indexOf(value);
                if (value == -1) {
                    console.error("Invalid enum value", variable);
                    return 0;
                } else {
                    return value;
                }
            }
        }

        return 0;
    }

    getMin(variableName: string): number {
        let variable = this.findVariable(variableName);
        if (variable) {
            return variable.defaultMinValue;
        }

        return 0;
    }

    getMax(variableName: string): number {
        let variable = this.findVariable(variableName);
        if (variable) {
            return variable.defaultMaxValue;
        }

        return 1;
    }

    getValueList(variableName: string): string[] {
        let variable = this.findVariable(variableName);
        if (variable) {
            try {
                return JSON.parse(variable.defaultValueList);
            } catch (err) {
                console.error("Invalid value list", variable, err);
                return [];
            }
        }

        return [];
    }
}

////////////////////////////////////////////////////////////////////////////////

export class StructureField extends EezObject {
    @observable name: string;
    @observable type: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            variableTypeProperty,
            variableTypeUIProperty
        ],
        beforeLoadHook: (object: Variable, objectJS: any) => {
            migrateType(objectJS);
        },
        defaultValue: {},
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Structure Field",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name
                });
            });
        }
    };
}

registerClass(StructureField);

////////////////////////////////////////////////////////////////////////////////

@observer
export class StructureNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get object() {
        if (this.context.navigationStore.selectedPanel) {
            return this.context.navigationStore.selectedPanel.selectedObject;
        }
        return this.context.navigationStore.selectedObject;
    }

    render() {
        let structures = this.context.project.variables.structures;

        let selectedStructure =
            this.context.navigationStore.getNavigationSelectedObject(
                structures
            ) as Structure;

        return (
            <Splitter
                type="horizontal"
                persistId={`project-editor/navigation-${this.props.id}`}
                sizes={`240px|100%`}
                childrenOverflow="hidden"
            >
                <ListNavigation
                    id={this.props.id}
                    navigationObject={structures}
                />
                <PropertiesPanel object={selectedStructure} />
            </Splitter>
        );
    }
}

export class Structure extends EezObject {
    @observable name: string;
    @observable fields: StructureField[];

    static classInfo: ClassInfo = {
        label: (structure: Structure) => {
            return `${structure.name} (${structure.fields
                .map(field => field.name)
                .join(" | ")})`;
        },
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "fields",
                type: PropertyType.Array,
                typeClass: StructureField
            }
        ],
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Structure",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name
                });
            });
        },
        navigationComponent: StructureNavigation,
        navigationComponentId: "project-variables-structures",
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                className="icon icon-tabler icon-tabler-columns"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <line x1="4" y1="6" x2="9.5" y2="6" />
                <line x1="4" y1="10" x2="9.5" y2="10" />
                <line x1="4" y1="14" x2="9.5" y2="14" />
                <line x1="4" y1="18" x2="9.5" y2="18" />
                <line x1="14.5" y1="6" x2="20" y2="6" />
                <line x1="14.5" y1="10" x2="20" y2="10" />
                <line x1="14.5" y1="14" x2="20" y2="14" />
                <line x1="14.5" y1="18" x2="20" y2="18" />
            </svg>
        )
    };
}

registerClass(Structure);

////////////////////////////////////////////////////////////////////////////////

export class EnumMember extends EezObject {
    @observable name: string;
    @observable value: number;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "value",
                type: PropertyType.Number
            }
        ],
        defaultValue: {},
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Enum Member",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name
                });
            });
        }
    };
}

registerClass(EnumMember);

////////////////////////////////////////////////////////////////////////////////

@observer
export class EnumNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get object() {
        if (this.context.navigationStore.selectedPanel) {
            return this.context.navigationStore.selectedPanel.selectedObject;
        }
        return this.context.navigationStore.selectedObject;
    }

    render() {
        let enums = this.context.project.variables.enums;

        let selectedEnum =
            this.context.navigationStore.getNavigationSelectedObject(
                enums
            ) as Enum;

        return (
            <Splitter
                type="horizontal"
                persistId={`project-editor/navigation-${this.props.id}`}
                sizes={`240px|100%`}
                childrenOverflow="hidden"
            >
                <ListNavigation id={this.props.id} navigationObject={enums} />
                <PropertiesPanel object={selectedEnum} />
            </Splitter>
        );
    }
}

export class Enum extends EezObject {
    @observable name: string;
    @observable members: EnumMember[];

    static classInfo: ClassInfo = {
        label: (enumDef: Enum) => {
            return `${enumDef.name} (${enumDef.members
                .map(member => member.name)
                .join(" | ")})`;
        },
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "members",
                type: PropertyType.Array,
                typeClass: EnumMember
            }
        ],
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Enum",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name
                });
            });
        },
        navigationComponent: EnumNavigation,
        navigationComponentId: "project-variables-enums",
        icon: "format_list_numbered"
    };

    @computed get membersMap() {
        const map = new Map<string, EnumMember>();
        for (const member of this.members) {
            map.set(member.name, member);
        }
        return map;
    }
}

registerClass(Enum);

////////////////////////////////////////////////////////////////////////////////

@observer
export class ProjectVariablesNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <MenuNavigation
                id={this.props.id}
                navigationObject={this.context.project.variables}
            />
        );
    }
}

export class ProjectVariables extends EezObject {
    @observable globalVariables: Variable[];
    @observable structures: Structure[];
    @observable enums: Enum[];

    static classInfo: ClassInfo = {
        label: () => "Variables",
        properties: [
            {
                name: "globalVariables",
                type: PropertyType.Array,
                typeClass: Variable,
                hideInPropertyGrid: true
            },
            {
                name: "structures",
                type: PropertyType.Array,
                typeClass: Structure,
                hideInPropertyGrid: true
            },
            {
                name: "enums",
                type: PropertyType.Array,
                typeClass: Enum,
                hideInPropertyGrid: true
            }
        ],
        navigationComponent: ProjectVariablesNavigation,
        navigationComponentId: "projectVariables",
        defaultNavigationKey: "globalVariables",
        icon: VariableIcon,
        defaultValue: {
            globalVariables: [],
            structures: [],
            enums: []
        }
    };

    @computed({ keepAlive: true }) get enumsMap() {
        const map = new Map<string, Enum>();
        for (const enumDef of this.enums) {
            map.set(enumDef.name, enumDef);
        }
        return map;
    }

    @computed({ keepAlive: true }) get structsMap() {
        const map = new Map<string, Structure>();
        for (const structure of this.structures) {
            map.set(structure.name, structure);
        }
        return map;
    }
}

registerClass(ProjectVariables);

////////////////////////////////////////////////////////////////////////////////

export default {
    name: "eezstudio-project-feature-variables",
    version: "0.1.0",
    description: "Variables, Structures and Enums",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    eezStudioExtension: {
        displayName: "Variables",
        implementation: {
            projectFeature: {
                mandatory: false,
                key: "variables",
                type: PropertyType.Object,
                typeClass: ProjectVariables,
                icon: VariableIcon,
                create: () => {
                    return {
                        globalVariables: [],
                        structures: [],
                        enums: []
                    };
                },
                check: (object: IEezObject[]) => {
                    let messages: output.Message[] = [];

                    if (object.length > 32000) {
                        messages.push(
                            new output.Message(
                                output.Type.ERROR,
                                "Max. 32000 global variables are supported",
                                object
                            )
                        );
                    }

                    return messages;
                },
                build: build,
                metrics: metrics
            }
        }
    }
};
