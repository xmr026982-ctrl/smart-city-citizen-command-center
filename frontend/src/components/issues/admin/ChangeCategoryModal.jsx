import { useState } from "react";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import Button from "../../ui/Button";
import { Select } from "../../ui/Input";

function ChangeCategoryModal({ issue, onClose, onSave }) {
  const [category, setCategory] = useState(issue?.category || "");

  if (!issue) return null;

  return (
    <div className="drawer-overlay" style={{ display: "grid", placeItems: "center" }}>
      <div className="panel" style={{ width: "min(420px, calc(100% - 32px))", padding: 24 }}>
        <h3>Category for {issue.id}</h3>
        <div style={{ margin: "16px 0" }}>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave?.(issue.id, category);
              onClose();
            }}
          >
            Update category
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ChangeCategoryModal;