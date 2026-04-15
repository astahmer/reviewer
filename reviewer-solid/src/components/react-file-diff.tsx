import type { FileDiffMetadata } from "@pierre/diffs";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import React from "react";
import { FileDiff as PierreReactFileDiff } from "@pierre/diffs/react";
import { createRoot, type Root } from "react-dom/client";

interface ReactFileDiffProps {
  fileDiff: FileDiffMetadata;
  options: {
    theme: string;
    diffStyle: "unified" | "split";
    overflow: "wrap" | "scroll";
    disableLineNumbers: boolean;
  };
}

export function ReactFileDiff(props: ReactFileDiffProps) {
  let containerRef: HTMLDivElement | undefined;
  const [root, setRoot] = createSignal<Root | undefined>(undefined);

  onMount(() => {
    if (!containerRef) {
      return;
    }

    setRoot(createRoot(containerRef));
  });

  createEffect(() => {
    const reactRoot = root();

    if (!reactRoot) {
      return;
    }

    reactRoot.render(
      React.createElement(PierreReactFileDiff, {
        fileDiff: props.fileDiff,
        options: props.options,
      }),
    );
  });

  onCleanup(() => {
    root()?.unmount();
  });

  return <div ref={(element) => (containerRef = element)} />;
}
