import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Slot component — merges props onto its single child.
 * Drop-in replacement for @radix-ui/react-slot Slot.
 *
 * Used by Button with `asChild` prop to allow rendering as Link/a/button/etc.
 */
interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
}

const Slot = React.forwardRef<HTMLElement, SlotProps>(
  ({ children, ...props }, ref) => {
    if (React.isValidElement(children)) {
      const childProps = children.props as Record<string, unknown>;
      return React.cloneElement(children, {
        ...props,
        ...childProps,
        ref,
        className: cn(
          props.className as string,
          childProps.className as string
        ),
      }) as React.ReactElement;
    }
    return null;
  }
);
Slot.displayName = "Slot";

export { Slot };