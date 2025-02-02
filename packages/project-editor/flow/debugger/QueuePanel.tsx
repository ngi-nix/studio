import React from "react";
import { observer } from "mobx-react";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { ProjectContext } from "project-editor/project/context";
import { Panel } from "project-editor/components/Panel";
import { action, computed, IObservableValue } from "mobx";
import { getLabel } from "project-editor/core/object";
import { QueueTask } from "project-editor/flow/runtime";
import { RightArrow } from "project-editor/flow/action-components";
import { IconAction } from "eez-studio-ui/action";

////////////////////////////////////////////////////////////////////////////////

@observer
export class QueuePanel extends React.Component<{
    collapsed: IObservableValue<boolean>;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <Panel
                id="project-editor/debugger/queue"
                title="Queue"
                collapsed={this.props.collapsed}
                buttons={[
                    <IconAction
                        key="resume"
                        icon={
                            <svg viewBox="0 0 500 607.333984375">
                                <path d="M486 278.667c9.333 6.667 14 15.333 14 26 0 9.333-4.667 17.333-14 24l-428 266c-16 10.667-29.667 12.667-41 6-11.333-6.667-17-20-17-40v-514c0-20 5.667-33.333 17-40C28.333 0 42 2 58 12.667l428 266" />
                            </svg>
                        }
                        iconSize={16}
                        title="Resume"
                        onClick={() => this.context.runtimeStore.resume()}
                        enabled={this.context.runtimeStore.isPaused}
                    />,
                    <IconAction
                        key="pause"
                        icon={
                            <svg viewBox="0 0 530 700">
                                <path d="M440 0c60 0 90 21.333 90 64v570c0 44-30 66-90 66s-90-22-90-66V64c0-42.667 30-64 90-64M90 0c60 0 90 21.333 90 64v570c0 44-30 66-90 66S0 678 0 634V64C0 21.333 30 0 90 0" />
                            </svg>
                        }
                        iconSize={16}
                        title="Pause"
                        onClick={() => this.context.runtimeStore.pause()}
                        enabled={!this.context.runtimeStore.isPaused}
                    />,
                    <IconAction
                        key="single-step"
                        icon={
                            <svg viewBox="0 0 43 38">
                                <path d="M10 0h1v5h-1a5 5 0 0 0-5 5v14a5 5 0 0 0 5 5h1v-4l6.75 6.5L11 38v-4h-1C4.477 34 0 29.523 0 24V10C0 4.477 4.477 0 10 0zm7 5h26v5H17V5zm3 8h23v5H20v-5zm-3 8h26v5H17v-5z" />
                            </svg>
                        }
                        iconSize={18}
                        style={{ marginTop: 4 }}
                        title="Single step"
                        onClick={() =>
                            this.context.runtimeStore.runSingleStep()
                        }
                        enabled={this.context.runtimeStore.isPaused}
                    />,
                    <IconAction
                        key="restart"
                        icon={
                            <svg
                                viewBox="0 0 24 24"
                                strokeWidth="2"
                                stroke="currentColor"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path
                                    stroke="none"
                                    d="M0 0h24v24H0z"
                                    fill="none"
                                ></path>
                                <path d="M4.05 11a8 8 0 1 1 .5 4m-.5 5v-5h5"></path>
                            </svg>
                        }
                        iconSize={18}
                        style={{ marginTop: 4, color: "green" }}
                        title="Restart"
                        onClick={async () => {
                            await this.context.runtimeStore.setEditorMode();
                            await this.context.runtimeStore.setRuntimeMode(
                                true
                            );
                        }}
                        enabled={this.context.runtimeStore.isPaused}
                    />
                ]}
                body={
                    this.context.runtimeStore.isPaused ? <QueueList /> : <div />
                }
            />
        );
    }
}

@observer
class QueueList extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed get rootNode(): ITreeNode<QueueTask> {
        function getQueueTaskLabel(queueTask: QueueTask) {
            if (
                queueTask.connectionLine &&
                queueTask.connectionLine.sourceComponent &&
                queueTask.connectionLine.targetComponent
            ) {
                return (
                    <div>
                        {`${getLabel(
                            queueTask.connectionLine.sourceComponent
                        )}:${queueTask.connectionLine.output}`}
                        <RightArrow />{" "}
                        {`${getLabel(
                            queueTask.connectionLine.targetComponent
                        )}:${queueTask.connectionLine.input}`}
                    </div>
                );
            } else {
                return <div>{getLabel(queueTask.component)}</div>;
            }
        }

        function getChildren(queueTasks: QueueTask[]): ITreeNode<QueueTask>[] {
            return queueTasks.map(queueTask => ({
                id: queueTask.id.toString(),
                label: getQueueTaskLabel(queueTask),
                children: [],
                selected: queueTask == selectedQueueTask,
                expanded: false,
                data: queueTask
            }));
        }

        const selectedQueueTask = this.context.runtimeStore.selectedQueueTask;

        return {
            id: "root",
            label: "",
            children: getChildren(this.context.runtimeStore.queue),
            selected: false,
            expanded: true
        };
    }

    @action.bound
    selectNode(node?: ITreeNode<QueueTask>) {
        const queueTask = node && node.data;

        this.context.runtimeStore.selectQueueTask(queueTask);

        if (queueTask) {
            this.context.runtimeStore.showQueueTask(queueTask);
        }
    }

    render() {
        return (
            <Tree
                showOnlyChildren={true}
                rootNode={this.rootNode}
                selectNode={this.selectNode}
            />
        );
    }
}
