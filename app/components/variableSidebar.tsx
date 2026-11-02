import { FLOW_VARIABLES } from "@/variables";
import { cn } from "@/lib/utils";

interface VariableSidebarProps {
  onInsert?: (variable: string) => void;
}

/**
 * Sidebar showing available Liquid variables.
 * Users click a variable to insert it into the subject line / HTML body.
 */
export function VariableSidebar({ onInsert }: VariableSidebarProps) {
  const handleInsert = (name: string) => {
    const liquid = `{{ ${name} }}`;
    if (onInsert) {
      onInsert(liquid);
    } else {
      navigator.clipboard.writeText(liquid).then(() => {
        console.log(`Copied: ${liquid}`);
      });
    }
  };

  return (
    <div className="bg-muted border rounded-md p-4">
      <h3 className="text-sm font-semibold text-foreground mb-2">
        Available variables
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Click a variable to insert it at the cursor position. Or copy manually
        as <code className="bg-background px-1 py-0.5 rounded">{"{{ variable }}"}</code>.
      </p>
      <div className="space-y-4">
        {FLOW_VARIABLES.map((group) => (
          <div key={group.group}>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {group.group}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => handleInsert(item.name)}
                  title={item.description}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded text-xs font-mono",
                    "bg-background border border-border hover:border-primary hover:bg-accent",
                    "transition-colors flex items-center justify-between group"
                  )}
                >
                  <span className="text-foreground">{`{{ ${item.name} }}`}</span>
                  <span className="text-muted-foreground group-hover:text-primary">
                    +
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
