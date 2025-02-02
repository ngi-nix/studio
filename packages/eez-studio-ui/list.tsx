import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Icon } from "eez-studio-ui/icon";

export interface IListNode<T = any> {
    id: string;
    label?: string;
    data: T;
    selected: boolean;
}

@observer
export class ListItem extends React.Component<
    {
        leftIcon?: React.ReactNode;
        leftIconSize?: number;
        leftIconClassName?: string;
        label: React.ReactNode;
        rightIcon?: React.ReactNode;
        rightIconSize?: number;
        rightIconClassName?: string;
    },
    {}
> {
    render() {
        let leftIcon;
        if (this.props.leftIcon) {
            if (typeof this.props.leftIcon == "string") {
                leftIcon = (
                    <Icon
                        icon={this.props.leftIcon}
                        size={this.props.leftIconSize}
                        className={this.props.leftIconClassName}
                    />
                );
            } else {
                leftIcon = this.props.leftIcon;
            }
        }

        let rightIcon;
        if (this.props.rightIcon) {
            if (typeof this.props.rightIcon == "string") {
                rightIcon = (
                    <Icon
                        icon={this.props.rightIcon}
                        size={this.props.rightIconSize}
                        className={this.props.rightIconClassName}
                    />
                );
            } else {
                leftIcon = this.props.leftIcon;
            }
        }

        return (
            <>
                <div>{leftIcon}</div>
                <div>{this.props.label}</div>
                <div>{rightIcon}</div>
            </>
        );
    }
}

@observer
export class List extends React.Component<
    {
        nodes: IListNode[];
        selectNode?: (node: IListNode) => void;
        renderNode?: (node: IListNode) => React.ReactNode;
        tabIndex?: any;
        className?: string;
        style?: React.CSSProperties;
    },
    {}
> {
    render() {
        const { renderNode, tabIndex } = this.props;

        let nodes = this.props.nodes.map(node => {
            let className = classNames("EezStudio_ListItem", {
                EezStudio_Selected: node.selected
            });

            return (
                <div
                    key={node.id}
                    className={className}
                    onClick={(e: any) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (this.props.selectNode) {
                            this.props.selectNode(node);
                        }
                    }}
                >
                    {renderNode ? renderNode(node) : node.label}
                </div>
            );
        });

        let className = classNames("EezStudio_List", this.props.className, {
            EezStudio_List_Selectable: !!this.props.selectNode
        });

        return (
            <div
                className={className}
                style={this.props.style}
                tabIndex={tabIndex}
            >
                {nodes}
            </div>
        );
    }
}

@observer
export class ListContainer extends React.Component<
    {
        tabIndex: any;
        minHeight?: number;
        maxHeight?: number;
    },
    {}
> {
    render() {
        const { minHeight, maxHeight } = this.props;
        return (
            <div
                className="EezStudio_ListContainer"
                tabIndex={this.props.tabIndex}
                style={{ minHeight, maxHeight }}
            >
                {this.props.children}
            </div>
        );
    }
}
