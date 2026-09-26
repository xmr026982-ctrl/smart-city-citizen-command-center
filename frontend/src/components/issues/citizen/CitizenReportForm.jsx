import { useMemo, useRef, useState } from "react";
import { CATEGORY_LABEL, ISSUE_CATEGORIES } from "../../../constants/issueCategories";
import { WARDS } from "../../../constants/issueConstants";
import { validateIssue } from "../../../utils/validateIssue";
import Button from "../../ui/Button";
import { Input, Label, Select, Textarea } from "../../ui/Input";
import IssueLocationPicker from "./IssueLocationPicker";

const EMPTY = {
  title: "",
  description: "",
  category: "",
  location: "",
  ward: "",
  lat: null,
  lng: null,
};

function CitizenReportForm({ onSubmit }) {
  const [draft, setDraft] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const refs = {
    title: useRef(null),
    category: useRef(null),
    ward: useRef(null),
    location: useRef(null),
    description: useRef(null),
  };

  const wardOptions = useMemo(() => WARDS, []);

  const setField = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validateIssue(draft);
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      refs[first]?.current?.focus();
      refs[first]?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    onSubmit(draft);
    setDraft(EMPTY);
  };

  return (
    <form className="issue-form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <div className="field">
          <Label htmlFor="title" required>
            Issue title
          </Label>
          <Input
            id="title"
            ref={refs.title}
            value={draft.title}
            invalid={Boolean(errors.title)}
            placeholder="Example: Broken streetlight near the park"
            onChange={(e) => setField("title", e.target.value)}
          />
          {errors.title ? <p className="field-error">{errors.title}</p> : null}
        </div>

        <div className="field">
          <Label htmlFor="category" required>
            Issue category
          </Label>
          <Select
            id="category"
            ref={refs.category}
            value={draft.category}
            invalid={Boolean(errors.category)}
            onChange={(e) => setField("category", e.target.value)}
          >
            <option value="">Select a category</option>
            {ISSUE_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {CATEGORY_LABEL[item]}
              </option>
            ))}
          </Select>
          {errors.category ? <p className="field-error">{errors.category}</p> : null}
        </div>

        <IssueLocationPicker
          draft={draft}
          errors={errors}
          refs={refs}
          wards={wardOptions}
          onChange={setField}
        />

        <div className="field span-2">
          <Label htmlFor="description" required>
            Describe the issue
          </Label>
          <Textarea
            id="description"
            ref={refs.description}
            value={draft.description}
            invalid={Boolean(errors.description)}
            placeholder="Explain what happened and how it is affecting the area..."
            onChange={(e) => setField("description", e.target.value)}
          />
          {errors.description ? <p className="field-error">{errors.description}</p> : null}
        </div>
      </div>

      <div className="form-footer">
        <p className="mono">
          <span className="req">*</span> Required fields
        </p>
        <Button type="submit">Submit report</Button>
      </div>
    </form>
  );
}

export default CitizenReportForm;