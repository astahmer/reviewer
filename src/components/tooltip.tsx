import { FC, ReactNode } from "react";
import * as Ark from "@ark-ui/react";

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

export const Tooltip: FC<TooltipProps> = ({ content, children, side = "top", delay = 200 }) => {
  return (
    <Ark.Tooltip.Root openDelay={delay} positioning={{ placement: side }}>
      <Ark.Tooltip.Trigger asChild>{children}</Ark.Tooltip.Trigger>
      <Ark.Tooltip.Positioner>
        <Ark.Tooltip.Content
          className="px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg whitespace-nowrap"
          style={{
            zIndex: 1000,
          }}
        >
          {content}
        </Ark.Tooltip.Content>
      </Ark.Tooltip.Positioner>
    </Ark.Tooltip.Root>
  );
};
