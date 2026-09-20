import { ArrowUpRight } from "lucide-react";
import { useRef, useState } from "react";
import { CATEGORY_LABEL } from "../../../constants/issueCategories";
import { WARDS } from "../../../constants/issueConstants";
import { firstErrorKey, validateIssueDraft } from "../../../utils/validateIssue";
import Button from "../../ui/Button";
import { Input, Label, Select, Textarea } from "../../ui/Input";

function CitizenReportForm({ photos, onSubmit }) {
  const [draft, setDraft] = useState({
    title: "",
    category: "",
    ward: "",
    location: "",
    description: "",
  });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState("");
  const refs = {
    title: useRef(null),
    category: useRef(null),
    ward: useRef(null),
    location: useRef(null),
    description: useRef(null),
  };

  const setField = (name, value) => {
    setDraft((d) => ({ ...d, [name]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[name];
      return next;
    });
    setSuccess("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validateIssueDraft(draft);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      const key = firstErrorKey(nextErrors);
      refs[key]?.current?.focus();
      refs[key]?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const ward = WARDS.find((item) => item.name === draft.ward) || WARDS[0];
    onSubmit({ ...draft, lat: ward.lat, lng: ward.lng });
    setSuccess(
      photos.length
        ? "Report filed with photographic evidence."
        : "Report filed successfully."
    );
    setDraft({ title: "", category: "", ward: "", location: "", description: "" });
  };

  return (
    <form className="issue-form panel" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <div className="field">
          <Label htmlFor="title" required>
            Issue title
          </Label>
          <Input
            ref={refs.title}
            id="title"
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
            ref={refs.category}
            id="category"
            value={draft.category}
            invalid={Boolean(errors.category)}
            onChange={(e) => setField("category", e.target.value)}
          >
            <option value="">Select a category</option>
            {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          {errors.category ? <p className="field-error">{errors.category}</p> : null}
        </div>

        <div className="field">
          <Label htmlFor="ward" required>
            Ward
          </Label>
          <Select
            ref={refs.ward}
            id="ward"
            value={draft.ward}
            invalid={Boolean(errors.ward)}
            onChange={(e) => setField("ward", e.target.value)}
          >
            <option value="">Select a ward</option>
            {WARDS.map((ward) => (
              <option key={ward.name} value={ward.name}>
                {ward.name}
              </option>
            ))}
          </Select>
          {errors.ward ? <p className="field-error">{errors.ward}</p> : null}
        </div>

        <div className="field">
          <Label htmlFor="location" required>
            Issue location
          </Label>
          <Input
            ref={refs.location}
            id="location"
            value={draft.location}
            invalid={Boolean(errors.location)}
            placeholder="Street, landmark, or address"
            onChange={(e) => setField("location", e.target.value)}
          />
          {errors.location ? <p className="field-error">{errors.location}</p> : null}
        </div>

        <div className="field span-2">
          <Label htmlFor="description" required>
            Describe the issue
          </Label>
          <Textarea
            ref={refs.description}
            id="description"
            rows={7}
            value={draft.description}
            invalid={Boolean(errors.description)}
            placeholder="Explain what happened and how it is affecting the area..."
            onChange={(e) => setField("description", e.target.value)}
          />
          {errors.description ? (
            <p className="field-error">{errors.description}</p>
          ) : null}
        </div>
      </div>

      <div className="form-footer">
        <p className="mono">
          <span className="req">*</span> Required fields
        </p>
        <Button type="submit">
          Submit report
          <ArrowUpRight size={16} />
        </Button>
      </div>

      {success ? (
        <div className="success-box" role="status">
          {success}
        </div>
      ) : null}
    </form>
  );
}

export default CitizenReportForm;