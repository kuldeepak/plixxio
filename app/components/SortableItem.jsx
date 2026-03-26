import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function SortableItem({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    cursor: "grab",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {/* Drag Handle + Content */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        
        {/* Drag Icon */}
        <div
          {...listeners}
          style={{
            cursor: "grab",
            padding: "6px",
            background: "#f1f1f1",
            borderRadius: "4px",
            border: "1px solid #ddd",
          }}
        >
          ☰
        </div>

        {/* Your actual option UI */}
        <div style={{ flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}