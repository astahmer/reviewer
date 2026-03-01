import { FC, useState } from "react";

interface CustomPathsInputProps {
  customPaths: string[];
  onAddPath: (path: string) => void;
  onRemovePath: (path: string) => void;
}

export const CustomPathsInput: FC<CustomPathsInputProps> = ({
  customPaths,
  onAddPath,
  onRemovePath,
}) => {
  const [inputValue, setInputValue] = useState("");

  const handleAdd = () => {
    const path = inputValue.trim();
    if (path && !customPaths.includes(path)) {
      onAddPath(path);
      setInputValue("");
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <label className="block text-xs font-medium text-gray-700 mb-1">Custom Paths</label>
      <div className="flex gap-1">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add path to search for repos..."
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
        />
        <button
          onClick={handleAdd}
          className="rounded bg-blue-500 px-2 py-1 text-xs font-medium text-white hover:bg-blue-600"
        >
          Add
        </button>
      </div>
      {customPaths.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {customPaths.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs"
            >
              {p}
              <button
                onClick={() => onRemovePath(p)}
                className="text-gray-500 hover:text-red-500"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
