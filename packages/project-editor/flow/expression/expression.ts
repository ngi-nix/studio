import { Component } from "project-editor/flow/component";
import { Assets, DataBuffer } from "project-editor/features/page/build/assets";
import { getFlow, getProject, Project } from "project-editor/project/project";
import {
    binaryOperators,
    builtInConstants,
    builtInFunctions,
    CONDITIONAL_OPERATOR,
    logicalOperators,
    operationIndexes,
    unaryOperators
} from "./operations";
import { expressionParser, identifierParser } from "./grammar";
import {
    makeArrayElementInstruction,
    makeEndInstruction,
    makeOperationInstruction,
    makePushConstantInstruction,
    makePushGlobalVariableInstruction,
    makePushInputInstruction,
    makePushLocalVariableInstruction,
    makePushOutputInstruction
} from "./instructions";
import {
    getArrayElementTypeFromType,
    getEnumTypeNameFromType,
    getStructTypeNameFromType,
    isEnumType,
    VariableType
} from "project-editor/features/variable/variable";
import type { IDataContext, IFlowState } from "../flow-interfaces";
import { DocumentStoreClass } from "project-editor/core/store";

////////////////////////////////////////////////////////////////////////////////

export { operationIndexes } from "./operations";

////////////////////////////////////////////////////////////////////////////////

export function parseIdentifier(identifier: string) {
    try {
        const rootNode: ExpressionNode = identifierParser.parse(identifier);
        return rootNode && rootNode.type === "Identifier";
    } catch (err) {
        return false;
    }
}

export function checkExpression(
    component: Component,
    expression: string,
    assignable: boolean
) {
    if (expression == undefined) {
    } else if (typeof expression == "number") {
    } else {
        let rootNode;
        try {
            rootNode = expressionParser.parse(expression);
        } catch (err) {
            throw `Expression error: ${err}`;
        }
        findValueTypeInExpressionNode(component, rootNode, assignable);
        checkExpressionNode(component, rootNode);
    }
}

export function buildExpression(
    assets: Assets,
    dataBuffer: DataBuffer,
    component: Component,
    expression: string
) {
    let instructions;
    if (
        expression == undefined ||
        (typeof expression == "string" && expression.length == 0)
    ) {
        instructions = [makePushConstantInstruction(assets, undefined)];
    } else if (typeof expression == "number") {
        instructions = [makePushConstantInstruction(assets, expression)];
    } else {
        let rootNode;
        try {
            rootNode = expressionParser.parse(expression);
        } catch (err) {
            throw `Expression error: ${err}`;
        }
        findValueTypeInExpressionNode(component, rootNode, false);
        instructions = buildExpressionNode(assets, component, rootNode, false);
    }

    instructions.push(makeEndInstruction());

    instructions.forEach(instruction =>
        dataBuffer.writeUint16NonAligned(instruction)
    );
}

export function buildAssignableExpression(
    assets: Assets,
    dataBuffer: DataBuffer,
    component: Component,
    expression: string
) {
    function isAssignableExpression(node: ExpressionNode): boolean {
        if (node.type === "Identifier") {
            return true;
        }
        if (node.type === "ConditionalExpression") {
            return (
                isAssignableExpression(node.consequent) &&
                isAssignableExpression(node.alternate)
            );
        }
        if (node.type === "MemberExpression") {
            return true;
        }
        return false;
    }

    let rootNode;
    try {
        rootNode = expressionParser.parse(expression);
    } catch (err) {
        throw `Expression error: ${err}`;
    }

    findValueTypeInExpressionNode(component, rootNode, true);

    if (!isAssignableExpression(rootNode)) {
        console.log("Expression is not assignable", rootNode);
        throw `Expression is not assignable`;
    }

    const instructions = buildExpressionNode(assets, component, rootNode, true);

    instructions.push(makeEndInstruction());

    instructions.forEach(instruction =>
        dataBuffer.writeUint16NonAligned(instruction)
    );
}

export function evalConstantExpression(project: Project, expression: string) {
    let value;
    if (expression == undefined) {
        value = undefined;
    } else if (typeof expression == "number") {
        value = expression;
    } else {
        let rootNode;
        try {
            rootNode = expressionParser.parse(expression);
        } catch (err) {
            throw `Expression error: ${err}`;
        }

        try {
            value = evalConstantExpressionNode(project, rootNode);
        } catch (err) {
            console.error(err);
            value = null;
        }
    }

    return value;
}

export interface IExpressionContext {
    dataContext: IDataContext;
    flowState?: IFlowState;
    DocumentStore: DocumentStoreClass;
}

export function evalExpression(
    expressionContext: IExpressionContext,
    component: Component,
    expression: string
) {
    let value;

    if (expression == undefined) {
        value = undefined;
    } else if (typeof expression == "number") {
        value = expression;
    } else {
        let rootNode;
        try {
            rootNode = expressionParser.parse(expression);
        } catch (err) {
            throw `Expression error: ${err}`;
        }

        try {
            findValueTypeInExpressionNode(component, rootNode, false);

            value = evalExpressionWithContext(
                expressionContext,
                component,
                rootNode
            );
        } catch (err) {
            console.error(err);
            value = null;
        }
    }

    return value;
}

////////////////////////////////////////////////////////////////////////////////

type IdentifierExpressionNode = {
    type: "Identifier";
    name: string;
    valueType: VariableType;
};

type ExpressionNode =
    | {
          type: "Literal";
          value: any;
          valueType: VariableType;
      }
    | IdentifierExpressionNode
    | {
          type: "BinaryExpression";
          operator: string;
          left: ExpressionNode;
          right: ExpressionNode;
          valueType: VariableType;
      }
    | {
          type: "LogicalExpression";
          operator: string;
          left: ExpressionNode;
          right: ExpressionNode;
          valueType: VariableType;
      }
    | {
          type: "ArrayExpression";
          elements: ExpressionNode[];
          valueType: VariableType;
      }
    | {
          type: "ObjectExpression";
          properties: {
              key: {
                  type: "Identifier";
                  name: string;
              };
              value: ExpressionNode;
              kind: "init";
          }[];
          valueType: VariableType;
      }
    | {
          type: "MemberExpression";
          object: ExpressionNode;
          property: ExpressionNode;
          computed: boolean;
          valueType: VariableType;
      }
    | {
          type: "CallExpression";
          callee: ExpressionNode;
          arguments: ExpressionNode[];
          valueType: VariableType;
      }
    | {
          type: "ConditionalExpression";
          test: ExpressionNode;
          consequent: ExpressionNode;
          alternate: ExpressionNode;
          valueType: VariableType;
      }
    | {
          type: "UnaryExpression";
          operator: string;
          argument: ExpressionNode;
          valueType: VariableType;
      }
    | {
          type: "__Unknown";
          valueType: VariableType;
      };

type NonComputedPropertyExpressionNode = ExpressionNode & { name: string };

function findValueTypeInExpressionNode(
    component: Component,
    node: ExpressionNode,
    assignable: boolean
) {
    const project = getProject(component);

    if (node.type == "Literal") {
        if (typeof node.value === "boolean") {
            node.valueType = "boolean";
        } else if (typeof node.value === "number") {
            node.valueType = "double";
        } else if (typeof node.value === "string") {
            node.valueType = "string";
        } else {
            node.valueType = "undefined";
        }
    } else if (node.type == "Identifier") {
        if (assignable) {
            const output = component.buildOutputs.find(
                output => output.name === node.name
            );
            if (output) {
                node.valueType = "any";
                return;
            }
        } else {
            const input = component.buildInputs.find(
                input => input.name == node.name
            );
            if (input) {
                node.valueType = "any";
                return;
            }
        }

        const flow = getFlow(component);
        let localVariable = flow.localVariables.find(
            localVariable => localVariable.name == node.name
        );
        if (localVariable) {
            node.valueType = localVariable.type as VariableType;
            return;
        }

        let globalVariable = project.variables.globalVariables.find(
            globalVariable => globalVariable.name == node.name
        );
        if (globalVariable) {
            node.valueType = globalVariable.type as VariableType;
            return;
        }

        let enumDef = project.variables.enumsMap.get(node.name);
        if (!enumDef) {
            throw `identifier '${node.name}' is neither input or local or global variable or enum`;
        }

        node.valueType = `enum:${node.name}` as VariableType;
    } else if (node.type == "BinaryExpression") {
        let operator = binaryOperators[node.operator];
        if (!operator) {
            operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown binary operator '${node.operator}'`;
            }
        }
        findValueTypeInExpressionNode(component, node.left, assignable);
        findValueTypeInExpressionNode(component, node.right, assignable);
        node.valueType = operator.getValueType(
            node.left.valueType,
            node.right.valueType
        );
    } else if (node.type == "LogicalExpression") {
        const operator = logicalOperators[node.operator];
        if (!operator) {
            throw `Unknown logical operator '${node.operator}'`;
        }
        findValueTypeInExpressionNode(component, node.left, assignable);
        findValueTypeInExpressionNode(component, node.right, assignable);
        node.valueType = operator.getValueType(
            node.left.valueType,
            node.right.valueType
        );
    } else if (node.type == "UnaryExpression") {
        const operator = unaryOperators[node.operator];
        if (!operator) {
            throw `Unknown unary operator '${node.operator}'`;
        }
        findValueTypeInExpressionNode(component, node.argument, assignable);
        node.valueType = operator.getValueType(node.argument.valueType);
    } else if (node.type == "ConditionalExpression") {
        findValueTypeInExpressionNode(component, node.consequent, assignable);
        findValueTypeInExpressionNode(component, node.alternate, assignable);
        if (node.consequent.valueType != node.alternate.valueType) {
            throw "different types in conditional";
        }
        node.valueType = node.consequent.valueType;
    } else if (node.type == "CallExpression") {
        if (
            node.callee.type != "MemberExpression" ||
            node.callee.object.type != "Identifier" ||
            node.callee.property.type != "Identifier"
        ) {
            throw "Invalid call expression";
        }

        let functionName = `${node.callee.object.name}.${node.callee.property.name}`;

        const builtInFunction = builtInFunctions[functionName];
        if (builtInFunction == undefined) {
            throw `Unknown function '${functionName}'`;
        }

        const arity = builtInFunctions[functionName].arity;

        if (node.arguments.length != arity) {
            throw `In function '${functionName}' call expected ${arity} arguments, but got ${node.arguments.length}`;
        }

        node.arguments.forEach(argument =>
            findValueTypeInExpressionNode(component, argument, assignable)
        );

        node.valueType = builtInFunction.getValueType(
            ...node.arguments.map(node => node.valueType)
        );
    } else if (node.type == "MemberExpression") {
        findValueTypeInExpressionNode(component, node.object, assignable);
        if (isEnumType(node.object.valueType)) {
            const enumName = getEnumTypeNameFromType(node.object.valueType)!;
            const enumDef = project.variables.enumsMap.get(enumName)!;
            if (node.property.type != "Identifier") {
                throw `Invalid enum field type: '${node.property.type}'`;
            }
            const enumMember = enumDef.membersMap.get(node.property.name);
            if (!enumMember) {
                throw `Enum member '${node.property.name}' not found in enum '${enumName}'`;
            }
            node.valueType = "integer";
        } else {
            if (node.computed) {
                const valueType = getArrayElementTypeFromType(
                    node.object.valueType
                );
                if (!valueType) {
                    throw `Array type expected but found '${node.object.valueType}'`;
                }
                node.valueType = valueType as VariableType;
            } else {
                let structTypeName = getStructTypeNameFromType(
                    node.object.valueType
                );
                if (!structTypeName) {
                    structTypeName = node.object.valueType;
                }

                const project = getProject(component);
                const structure =
                    project.variables.structsMap.get(structTypeName);
                if (!structure) {
                    throw `Struct type expected but found '${node.object.valueType}'`;
                }

                if (node.property.type != "Identifier") {
                    throw `Invalid struct field type: '${node.property.type}'`;
                }

                const fieldName = node.property.name;

                const field = structure.fields.find(
                    field => field.name == fieldName
                );

                if (!field) {
                    throw `Struc field not found: '${fieldName}'`;
                }

                node.valueType = field.type as VariableType;
            }
        }
    } else if (node.type == "ArrayExpression") {
        node.elements.forEach(element =>
            findValueTypeInExpressionNode(component, element, assignable)
        );
        // TODO
    } else if (node.type == "ObjectExpression") {
        node.properties.forEach(property =>
            findValueTypeInExpressionNode(component, property.value, assignable)
        );
        // TODO
    } else {
        throw `Unknown expression node "${node.type}"`;
    }
}

function checkExpressionNode(component: Component, rootNode: ExpressionNode) {
    function checkNode(node: ExpressionNode) {
        if (node.type == "Literal") {
            return;
        }

        if (node.type == "Identifier") {
            const input = component.inputs.find(
                input => input.name == node.name
            );
            if (input != undefined) {
                return;
            }

            const flow = getFlow(component);
            let localVariableIndex = flow.localVariables.findIndex(
                localVariable => localVariable.name == node.name
            );
            if (localVariableIndex != -1) {
                return;
            }

            let globalVariableIndex =
                project.variables.globalVariables.findIndex(
                    globalVariable => globalVariable.name == node.name
                );
            if (globalVariableIndex != -1) {
                return;
            }

            throw `identifier '${node.name}' is neither input or local or global variable`;
        }

        if (node.type == "BinaryExpression") {
            let operator = binaryOperators[node.operator];
            if (!operator) {
                operator = logicalOperators[node.operator];
                if (!operator) {
                    throw `Unknown binary operator '${node.operator}'`;
                }
            }

            checkNode(node.left);
            checkNode(node.right);
        }

        if (node.type == "LogicalExpression") {
            const operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown logical operator '${node.operator}'`;
            }

            checkNode(node.left);
            checkNode(node.right);
        }

        if (node.type == "UnaryExpression") {
            const operator = unaryOperators[node.operator];
            if (!operator) {
                throw `Unknown unary operator '${node.operator}'`;
            }

            checkNode(node.argument);
        }

        if (node.type == "ConditionalExpression") {
            checkNode(node.test);
            checkNode(node.consequent);
            checkNode(node.alternate);
        }

        if (node.type == "CallExpression") {
            if (
                node.callee.type != "MemberExpression" ||
                node.callee.object.type != "Identifier" ||
                node.callee.property.type != "Identifier"
            ) {
                throw "Invalid call expression";
            }

            let functionName = `${node.callee.object.name}.${node.callee.property.name}`;

            const builtInFunction = builtInFunctions[functionName];
            if (builtInFunction == undefined) {
                throw `Unknown function '${functionName}'`;
            }

            const arity = builtInFunctions[functionName].arity;

            if (node.arguments.length != arity) {
                throw `In function '${functionName}' call expected ${arity} arguments, but got ${node.arguments.length}`;
            }

            node.arguments.forEach(checkNode);
        }

        if (node.type == "MemberExpression") {
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
                const enumDef = project.variables.enumsMap.get(
                    node.object.name
                );
                if (enumDef) {
                    const enumMember = enumDef.membersMap.get(
                        node.property.name
                    );
                    if (!enumMember) {
                        throw `Member '${node.property.name}' does not exist in enum '${node.object.name}'`;
                    }
                    return;
                }

                const builtInConstantName = `${node.object.name}.${node.property.name}`;
                const buildInConstantValue =
                    builtInConstants[builtInConstantName];
                if (buildInConstantValue != undefined) {
                    return;
                }

                console.log("Unknown constant 1", node);

                throw `Unknown constant '${builtInConstantName}'`;
            }

            console.log("TODO check MemberExpression", node);
            return;
        }

        if (node.type == "ArrayExpression") {
            console.log("TODO check ArrayExpression", node);
            return;
        }

        if (node.type == "ObjectExpression") {
            console.log("TODO check ObjectExpression", node);
            return;
        }

        throw `Unknown expression node "${node.type}"`;
    }

    const project = getProject(component);

    checkNode(rootNode);
}

function buildExpressionNode(
    assets: Assets,
    component: Component,
    node: ExpressionNode,
    assignable: boolean
): number[] {
    if (node.type == "Literal") {
        return [makePushConstantInstruction(assets, node.value)];
    }

    if (node.type == "Identifier") {
        if (assignable) {
            const outputIndex = component.buildOutputs.findIndex(
                output => output.name === node.name
            );
            if (outputIndex != -1) {
                return [makePushOutputInstruction(outputIndex)];
            }
        } else {
            const componentInputIndex = component.buildInputs.findIndex(
                input => input.name == node.name
            );
            if (componentInputIndex != -1) {
                const inputIndex = assets.getComponentInputIndex(
                    component,
                    node.name
                );
                return [makePushInputInstruction(inputIndex)];
            }
        }

        const flow = getFlow(component);
        let localVariableIndex = flow.localVariables.findIndex(
            localVariable => localVariable.name == node.name
        );
        if (localVariableIndex != -1) {
            return [makePushLocalVariableInstruction(localVariableIndex)];
        }

        let globalVariableIndex = assets.globalVariables.findIndex(
            globalVariable => globalVariable.name == node.name
        );
        if (globalVariableIndex != -1) {
            return [makePushGlobalVariableInstruction(globalVariableIndex)];
        }

        throw `identifier '${node.name}' is neither input or local or global variable`;
    }

    if (node.type == "BinaryExpression") {
        let operator = binaryOperators[node.operator];
        if (!operator) {
            operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown binary operator '${node.operator}'`;
            }
        }

        return [
            ...buildExpressionNode(assets, component, node.left, assignable),
            ...buildExpressionNode(assets, component, node.right, assignable),
            makeOperationInstruction(operationIndexes[operator.name])
        ];
    }

    if (node.type == "LogicalExpression") {
        const operator = logicalOperators[node.operator];
        if (!operator) {
            throw `Unknown logical operator '${node.operator}'`;
        }

        return [
            ...buildExpressionNode(assets, component, node.left, assignable),
            ...buildExpressionNode(assets, component, node.right, assignable),
            makeOperationInstruction(operationIndexes[operator.name])
        ];
    }

    if (node.type == "UnaryExpression") {
        const operator = unaryOperators[node.operator];
        if (!operator) {
            throw `Unknown unary operator '${node.operator}'`;
        }

        return [
            ...buildExpressionNode(
                assets,
                component,
                node.argument,
                assignable
            ),
            makeOperationInstruction(operationIndexes[operator.name])
        ];
    }

    if (node.type == "ConditionalExpression") {
        return [
            ...buildExpressionNode(assets, component, node.test, assignable),
            ...buildExpressionNode(
                assets,
                component,
                node.consequent,
                assignable
            ),
            ...buildExpressionNode(
                assets,
                component,
                node.alternate,
                assignable
            ),
            makeOperationInstruction(operationIndexes[CONDITIONAL_OPERATOR])
        ];
    }

    if (node.type == "CallExpression") {
        if (
            node.callee.type != "MemberExpression" ||
            node.callee.object.type != "Identifier" ||
            node.callee.property.type != "Identifier"
        ) {
            throw "Invalid call expression";
        }

        let functionName = `${node.callee.object.name}.${node.callee.property.name}`;

        const builtInFunction = builtInFunctions[functionName];
        if (builtInFunction == undefined) {
            throw `Unknown function '${functionName}'`;
        }

        const arity = builtInFunctions[functionName].arity;

        if (node.arguments.length != arity) {
            throw `In function '${functionName}' call expected ${arity} arguments, but got ${node.arguments.length}`;
        }

        return [
            ...node.arguments.reduce(
                (instructions, node) => [
                    ...instructions,
                    ...buildExpressionNode(assets, component, node, assignable)
                ],
                []
            ),
            makeOperationInstruction(operationIndexes[functionName])
        ];
    }

    if (node.type == "MemberExpression") {
        if (
            node.object.type == "Identifier" &&
            node.property.type == "Identifier"
        ) {
            const enumDef = assets.rootProject.variables.enumsMap.get(
                node.object.name
            );
            if (enumDef) {
                const enumMember = enumDef.membersMap.get(node.property.name);
                if (!enumMember) {
                    throw `Member '${node.property.name}' does not exist in enum '${node.object.name}'`;
                }
                return [
                    makePushConstantInstruction(
                        assets,
                        enumMember.value,
                        "integer"
                    )
                ];
            }

            const builtInConstantName = `${node.object.name}.${node.property.name}`;
            const buildInConstantValue = builtInConstants[builtInConstantName];
            if (buildInConstantValue != undefined) {
                return [
                    makePushConstantInstruction(
                        assets,
                        buildInConstantValue.value,
                        buildInConstantValue.valueType
                    )
                ];
            }
        }

        if (node.computed) {
            return [
                ...buildExpressionNode(
                    assets,
                    component,
                    node.object,
                    assignable
                ),
                ...buildExpressionNode(
                    assets,
                    component,
                    node.property,
                    assignable
                ),
                makeArrayElementInstruction()
            ];
        } else {
            const structTypeName = getStructTypeNameFromType(
                node.object.valueType
            )!;
            const project = getProject(component);
            const structure = project.variables.structsMap.get(structTypeName)!;
            const fieldName = (node.property as IdentifierExpressionNode).name;
            const fieldIndex = structure.fields
                .map(field => field.name)
                .sort()
                .indexOf(fieldName);

            return [
                ...buildExpressionNode(
                    assets,
                    component,
                    node.object,
                    assignable
                ),
                makePushConstantInstruction(assets, fieldIndex),
                makeArrayElementInstruction()
            ];
        }
    }

    if (node.type == "ArrayExpression") {
        console.log("TODO build ArrayExpression", node);
        return [];
    }

    if (node.type == "ObjectExpression") {
        console.log("TODO build ObjectExpression", node);
        return [];
    }

    throw `Unknown expression node "${node.type}"`;
}

function evalConstantExpressionNode(
    project: Project,
    rootNode: ExpressionNode
) {
    function evalNode(node: ExpressionNode): any {
        if (node.type == "Literal") {
            return node.value;
        }

        if (node.type == "Identifier") {
            throw `Can not evaulate during build`;
        }

        if (node.type == "BinaryExpression") {
            let operator = binaryOperators[node.operator];
            if (!operator) {
                operator = logicalOperators[node.operator];
                if (!operator) {
                    throw `Unknown binary operator '${node.operator}'`;
                }
            }

            return operator.eval(
                undefined,
                evalNode(node.left),
                evalNode(node.right)
            );
        }

        if (node.type == "LogicalExpression") {
            const operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown logical operator: ${node.operator}`;
            }

            return operator.eval(
                undefined,
                evalNode(node.left),
                evalNode(node.right)
            );
        }

        if (node.type == "UnaryExpression") {
            const operator = unaryOperators[node.operator];
            if (!operator) {
                throw `Unknown unary operator: ${node.operator}`;
            }

            return operator.eval(undefined, evalNode(node.argument));
        }

        if (node.type == "ConditionalExpression") {
            return evalNode(node.test)
                ? evalNode(node.consequent)
                : evalNode(node.alternate);
        }

        if (node.type == "CallExpression") {
            if (
                node.callee.type != "MemberExpression" ||
                node.callee.object.type != "Identifier" ||
                node.callee.property.type != "Identifier"
            ) {
                throw "Invalid call expression";
            }

            let functionName = `${node.callee.object.name}.${node.callee.property.name}`;

            const builtInFunction = builtInFunctions[functionName];
            if (builtInFunction == undefined) {
                throw `Unknown function '${functionName}'`;
            }

            const arity = builtInFunction.arity;

            if (node.arguments.length != arity) {
                throw `In function '${functionName}' call expected ${arity} arguments, but got ${node.arguments.length}`;
            }

            return builtInFunction.eval(
                undefined,
                ...node.arguments.map(evalNode)
            );
        }

        if (node.type == "MemberExpression") {
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
                const enumDef = project.variables.enumsMap.get(
                    node.object.name
                );
                if (enumDef) {
                    const enumMember = enumDef.membersMap.get(
                        node.property.name
                    );
                    if (!enumMember) {
                        throw `Member '${node.property.name}' does not exist in enum '${node.object.name}'`;
                    }
                    return enumMember.value;
                }

                const builtInConstantName = `${node.object.name}.${node.property.name}`;
                const buildInConstantValue =
                    builtInConstants[builtInConstantName];
                if (buildInConstantValue != undefined) {
                    return buildInConstantValue;
                }

                throw `Unknown constant '${builtInConstantName}'`;
            }

            console.log("TODO eval_constant MemberExpression", node);
            return [];
        }

        if (node.type == "ArrayExpression") {
            return node.elements.map(element => evalNode(element));
        }

        if (node.type == "ObjectExpression") {
            const object: any = {};

            for (const property of node.properties) {
                object[property.key.name] = evalNode(property.value);
            }

            return object;
        }

        throw `Unknown expression node "${node.type}"`;
    }

    return evalNode(rootNode);
}

function evalExpressionWithContext(
    expressionContext: IExpressionContext,
    component: Component,
    rootNode: ExpressionNode
) {
    function evalNode(node: ExpressionNode): any {
        if (node.type == "Literal") {
            return node.value;
        }

        if (node.type == "Identifier") {
            const input = component.inputs.find(
                input => input.name == node.name
            );
            if (input != undefined) {
                const flowState = expressionContext.flowState;
                if (!flowState) {
                    throw `cannot get input "${input.name}" value without flow state`;
                }

                const inputPropertyValue = flowState.getInputPropertyValue(
                    component,
                    input.name
                );

                return inputPropertyValue
                    ? inputPropertyValue.value
                    : undefined;
            }

            return expressionContext.dataContext.get(node.name);
        }

        if (node.type == "BinaryExpression") {
            let operator = binaryOperators[node.operator];
            if (!operator) {
                operator = logicalOperators[node.operator];
                if (!operator) {
                    throw `Unknown binary operator '${node.operator}'`;
                }
            }

            return operator.eval(
                expressionContext,
                evalNode(node.left),
                evalNode(node.right)
            );
        }

        if (node.type == "LogicalExpression") {
            const operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown logical operator: ${node.operator}`;
            }

            return operator.eval(
                expressionContext,
                evalNode(node.left),
                evalNode(node.right)
            );
        }

        if (node.type == "UnaryExpression") {
            const operator = unaryOperators[node.operator];
            if (!operator) {
                throw `Unknown unary operator: ${node.operator}`;
            }

            return operator.eval(expressionContext, evalNode(node.argument));
        }

        if (node.type == "ConditionalExpression") {
            return evalNode(node.test)
                ? evalNode(node.consequent)
                : evalNode(node.alternate);
        }

        if (node.type == "CallExpression") {
            if (
                node.callee.type != "MemberExpression" ||
                node.callee.object.type != "Identifier" ||
                node.callee.property.type != "Identifier"
            ) {
                throw "Invalid call expression";
            }

            let functionName = `${node.callee.object.name}.${node.callee.property.name}`;

            const builtInFunction = builtInFunctions[functionName];
            if (builtInFunction == undefined) {
                throw `Unknown function '${functionName}'`;
            }

            const arity = builtInFunction.arity;

            if (node.arguments.length != arity) {
                throw `In function '${functionName}' call expected ${arity} arguments, but got ${node.arguments.length}`;
            }

            return builtInFunction.eval(
                expressionContext,
                ...node.arguments.map(evalNode)
            );
        }

        if (node.type == "MemberExpression") {
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
                const enumDef =
                    expressionContext.DocumentStore.project.variables.enumsMap.get(
                        node.object.name
                    );
                if (enumDef) {
                    const enumMember = enumDef.membersMap.get(
                        node.property.name
                    );
                    if (!enumMember) {
                        throw `Member '${node.property.name}' does not exist in enum '${node.object.name}'`;
                    }
                    return enumMember.value;
                }

                const builtInConstantName = `${node.object.name}.${node.property.name}`;
                const buildInConstantValue =
                    builtInConstants[builtInConstantName];
                if (buildInConstantValue != undefined) {
                    return buildInConstantValue;
                }
            }

            const object = evalNode(node.object);
            if (object != undefined) {
                const property = node.computed
                    ? evalNode(node.property)
                    : (node.property as NonComputedPropertyExpressionNode).name;
                if (property != undefined) {
                    return object[property];
                }
            }

            return undefined;
        }

        if (node.type == "ArrayExpression") {
            console.log("TODO eval_in_flow ArrayExpression", node);
            return undefined;
        }

        if (node.type == "ObjectExpression") {
            console.log("TODO eval_in_flow ObjectExpression", node);
            return undefined;
        }

        throw `Unknown expression node "${node.type}"`;
    }

    return evalNode(rootNode);
}
