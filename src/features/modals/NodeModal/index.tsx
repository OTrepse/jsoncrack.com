import React from "react";
import type { ModalProps } from "@mantine/core";
import {
  Modal,
  Stack,
  Text,
  ScrollArea,
  Flex,
  CloseButton,
  Button,
  TextInput,
  Group,
  Switch,
} from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import toast from "react-hot-toast";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useFile from "../../../store/useFile";
import useJson from "../../../store/useJson";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

// Parse JSON value from string
const parseJsonValue = (value: string, type: string) => {
  if (type === "boolean") {
    return value.toLowerCase() === "true";
  }
  if (type === "number") {
    const num = Number(value);
    if (isNaN(num)) throw new Error("Invalid number");
    return num;
  }
  if (type === "null") {
    return null;
  }
  return value; // string type
};

// Get value from nested object by path
const getValueByPath = (obj: any, path: (string | number)[]): any => {
  return path.reduce((current, key) => current?.[key], obj);
};

// Set value in nested object by path
const setValueByPath = (obj: any, path: (string | number)[], value: any): any => {
  if (path.length === 0) return value;

  const key = path[0];
  const remaining = path.slice(1);

  if (remaining.length === 0) {
    return { ...obj, [key]: value };
  }

  return { ...obj, [key]: setValueByPath(obj[key] || {}, remaining, value) };
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const setContents = useFile(state => state.setContents);
  const getJson = useJson(state => state.getJson);

  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");
  const [editKey, setEditKey] = React.useState("");
  const [editType, setEditType] = React.useState<"string" | "number" | "boolean" | "null">(
    "string"
  );

  React.useEffect(() => {
    if (nodeData?.text && nodeData.text.length > 0) {
      const firstRow = nodeData.text[0];
      setEditKey(firstRow.key?.toString() || "");
      setEditValue(firstRow.value?.toString() || "");
      setEditType((firstRow.type as any) || "string");
    }
  }, [nodeData, opened]);

  const handleSave = () => {
    try {
      if (!nodeData?.path) {
        toast.error("Cannot edit root node");
        return;
      }

      const jsonStr = getJson();
      const json = JSON.parse(jsonStr);

      // Parse the new value based on type
      const newValue = parseJsonValue(editValue, editType);

      // Update the JSON using the path
      const updatedJson = setValueByPath(json, nodeData.path, newValue);
      const newContents = JSON.stringify(updatedJson, null, 2);

      // Update the file contents
      setContents({ contents: newContents, hasChanges: true });

      toast.success("Node updated successfully!");
      setIsEditing(false);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update node");
    }
  };

  if (!nodeData) return null;

  const isRootNode = !nodeData.path || nodeData.path.length === 0;

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        {isEditing && !isRootNode ? (
          <>
            <Flex justify="space-between" align="center">
              <Text fz="xs" fw={500}>
                Edit Node
              </Text>
              <CloseButton onClick={() => setIsEditing(false)} />
            </Flex>

            <TextInput
              label="Key"
              placeholder="Node key"
              value={editKey}
              onChange={e => setEditKey(e.currentTarget.value)}
              disabled
              size="xs"
            />

            <TextInput
              label="Value"
              placeholder="Node value"
              value={editValue}
              onChange={e => setEditValue(e.currentTarget.value)}
              size="xs"
            />

            <Stack gap={8}>
              <Text fz="xs" fw={500}>
                Type
              </Text>
              <Group grow>
                {(["string", "number", "boolean", "null"] as const).map(type => (
                  <Button
                    key={type}
                    size="xs"
                    variant={editType === type ? "filled" : "light"}
                    onClick={() => setEditType(type)}
                  >
                    {type}
                  </Button>
                ))}
              </Group>
            </Stack>

            <Group justify="flex-end" grow>
              <Button variant="light" size="xs" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button size="xs" onClick={handleSave}>
                Save
              </Button>
            </Group>
          </>
        ) : (
          <>
            <Stack gap="xs">
              <Flex justify="space-between" align="center">
                <Text fz="xs" fw={500}>
                  Content
                </Text>
                <CloseButton onClick={onClose} />
              </Flex>
              <ScrollArea.Autosize mah={250} maw={600}>
                <CodeHighlight
                  code={normalizeNodeData(nodeData?.text ?? [])}
                  miw={350}
                  maw={600}
                  language="json"
                  withCopyButton
                />
              </ScrollArea.Autosize>
            </Stack>
            <Text fz="xs" fw={500}>
              JSON Path
            </Text>
            <ScrollArea.Autosize maw={600}>
              <CodeHighlight
                code={jsonPathToString(nodeData?.path)}
                miw={350}
                mah={250}
                language="json"
                copyLabel="Copy to clipboard"
                copiedLabel="Copied to clipboard"
                withCopyButton
              />
            </ScrollArea.Autosize>
            {!isRootNode && (
              <Button size="xs" onClick={() => setIsEditing(true)} fullWidth>
                Edit Node
              </Button>
            )}
          </>
        )}
      </Stack>
    </Modal>
  );
};
