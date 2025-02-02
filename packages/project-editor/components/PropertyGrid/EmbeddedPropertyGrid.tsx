import React from "react";
import { observable } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import { Icon } from "eez-studio-ui/icon";
import {
    findPropertyByNameInClassInfo,
    PropertyProps,
    getObjectPropertyDisplayName
} from "project-editor/core/object";
import { ProjectContext } from "project-editor/project/context";
import { Property } from "./Property";
import { PropertyGrid } from "./index";
import { propertyCollapsedStore } from "./PropertyCollapsedStore";

@observer
export class EmbeddedPropertyGrid extends React.Component<PropertyProps> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @observable collapsed = true;

    @bind
    toggleCollapsed() {
        propertyCollapsedStore.toggleColapsed(
            this.props.objects[0],
            this.props.propertyInfo
        );
    }

    @bind
    updateObject(propertyValues: Object) {
        this.context.undoManager.setCombineCommands(true);
        this.props.objects.forEach(object => {
            object = (object as any)[this.props.propertyInfo.name];
            this.context.updateObject(object, propertyValues);
        });
        this.context.undoManager.setCombineCommands(false);
    }

    render() {
        const { objects, propertyInfo } = this.props;

        if (!propertyInfo.propertyGridCollapsable) {
            return (
                <div className="EezStudio_EmbeddedNonCollapsablePropertyGrid">
                    <PropertyGrid
                        objects={this.props.objects.map(
                            object => (object as any)[propertyInfo.name]
                        )}
                    />
                </div>
            );
        }

        const collapsed = propertyCollapsedStore.isCollapsed(
            this.props.objects[0],
            this.props.propertyInfo
        );
        if (collapsed) {
            if (propertyInfo.propertyGridCollapsableDefaultPropertyName) {
                const defaultPropertyInfo = findPropertyByNameInClassInfo(
                    propertyInfo.typeClass!.classInfo,
                    propertyInfo.propertyGridCollapsableDefaultPropertyName
                )!;
                return (
                    <Property
                        propertyInfo={defaultPropertyInfo}
                        objects={this.props.objects.map(
                            object => (object as any)[propertyInfo.name]
                        )}
                        updateObject={this.updateObject}
                        readOnly={this.props.readOnly}
                    />
                );
            } else {
                return (
                    <div className="collapsable collapsed EezStudio_EmbeddedPropertyGrid">
                        <div onClick={this.toggleCollapsed}>
                            <Icon
                                icon={
                                    collapsed
                                        ? "material:keyboard_arrow_right"
                                        : "material:keyboard_arrow_down"
                                }
                                size={18}
                                className="triangle"
                            />
                            {getObjectPropertyDisplayName(
                                objects[0],
                                propertyInfo
                            )}
                        </div>
                    </div>
                );
            }
        }

        return (
            <div className="collapsable">
                <div onClick={this.toggleCollapsed}>
                    <Icon
                        icon="material:keyboard_arrow_down"
                        size={18}
                        className="triangle"
                    />
                    {getObjectPropertyDisplayName(objects[0], propertyInfo)}
                </div>
                <PropertyGrid
                    objects={this.props.objects.map(
                        object => (object as any)[propertyInfo.name]
                    )}
                />
            </div>
        );
    }
}
