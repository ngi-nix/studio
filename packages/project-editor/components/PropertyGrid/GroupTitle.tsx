import React from "react";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import classNames from "classnames";
import {
    IEezObject,
    IPropertyGridGroupDefinition
} from "project-editor/core/object";
import { groupCollapsedStore } from "./GroupCollapsedStore";
import { Icon } from "eez-studio-ui/icon";

@observer
export class GroupTitle extends React.Component<{
    group: IPropertyGridGroupDefinition;
    object: IEezObject;
}> {
    @bind
    toggleCollapsed() {
        groupCollapsedStore.toggleColapsed(this.props.group);
    }

    render() {
        const { group } = this.props;

        const collapsed = groupCollapsedStore.isCollapsed(group);

        return (
            <tr>
                <td colSpan={3} className="group-cell">
                    <div
                        className={classNames("group-container", {
                            collapsed
                        })}
                        onClick={this.toggleCollapsed}
                    >
                        <div className="group-title">
                            <Icon
                                icon={
                                    collapsed
                                        ? "material:keyboard_arrow_right"
                                        : "material:keyboard_arrow_down"
                                }
                                size={18}
                                className="triangle"
                            />
                            {group.title}
                        </div>
                    </div>
                </td>
            </tr>
        );
    }
}
