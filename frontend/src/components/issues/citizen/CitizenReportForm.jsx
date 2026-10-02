import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_LABEL, ISSUE_CATEGORIES } from "../../../constants/issueCategories";
import { WARDS } from "../../../constants/issueConstants";
import { validateIssue } from "../../../utils/validateIssue";
import Button from "../../ui/Button";
import { Input, Label, Select, Textarea } from "../../ui/Input";
import IssueLocationPicker from "./IssueLocationPicker";

const EMPTY = { title: "", description: "", category: "", location: "", ward: "", lat: null, lng: null };
const DRAFT_KEY = "citizen-report-draft";

function CitizenReportForm({ onSubmit, returnedPin, step, onStep }) {
  const [draft, setDraft] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const refs = { title: useRef(null), category: useRef(null), ward: useRef(null), location: useRef(null), description: useRef(null) };
  const wardOptions = useMemo(() => WARDS, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(DRAFT_KEY);
    const base = saved ? { ...EMPTY, ...JSON.parse(saved) } : EMPTY;
    if (returnedPin?.zone) {
      setDraft({ ...base, ward: returnedPin.zone, location: returnedPin.label || base.location, lat: Number(returnedPin.lat), lng: Number(returnedPin.lng) });
      return;
    }
    setDraft(base);
  }, [returnedPin]);

  useEffect(() => { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); }, [draft]);

  const setField = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validateIssue(draft);
    if (!Number.isFinite(draft.lat) || !Number.isFinite(draft.lng)) nextErrors.location = "Pick the point on the map.";
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) {
      onStep(first === "ward" || first === "location" ? "locate" : "describe");
      refs[first]?.current?.focus();
      return;
    }
    onSubmit(draft);
    sessionStorage.removeItem(DRAFT_KEY);
    setDraft(EMPTY);
  };

  return (
    <form className="issue-form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <GlassCell active={step === "describe"} onFocus={() => onStep("describe")}>
          <Label htmlFor="title" required>Issue title</Label>
          <Input id="title" ref={refs.title} value={draft.title} invalid={Boolean(errors.title)} placeholder="Broken streetlight near the park" onFocus={() => onStep("describe")} onChange={(e) => setField("title", e.target.value)} />
          {errors.title ? <p className="field-error">{errors.title}</p> : null}
        </GlassCell>
        <GlassCell active={step === "describe"} onFocus={() => onStep("describe")}>
          <Label htmlFor="category" required>Issue category</Label>
          <Select id="category" ref={refs.category} value={draft.category} invalid={Boolean(errors.category)} onFocus={() => onStep("describe")} onChange={(e) => setField("category", e.target.value)}>
            <option value="">Select a category</option>
            {ISSUE_CATEGORIES.map((key) => <option key={key} value={key}>{CATEGORY_LABEL[key]}</option>)}
          </Select>
          {errors.category ? <p className="field-error">{errors.category}</p> : null}
        </GlassCell>
        <IssueLocationPicker draft={draft} errors={errors} refs={refs} wards={wardOptions} onChange={setField} active={step === "locate"} onStep={() => onStep("locate")} />
        <GlassCell active={step === "describe"} onFocus={() => onStep("describe")} wide>
          <Label htmlFor="description" required>Describe the issue</Label>
          <Textarea id="description" ref={refs.description} value={draft.description} invalid={Boolean(errors.description)} placeholder="What happened, and how is it affecting the area?" onFocus={() => onStep("describe")} onChange={(e) => setField("description", e.target.value)} />
          {errors.description ? <p className="field-error">{errors.description}</p> : null}
        </GlassCell>
      </div>
      <div className="form-footer">
        <p className="mono"><span className="req">*</span> Required fields</p>
        <Button type="submit">Submit report</Button>
      </div>
    </form>
  );
}

function GlassCell({ active, onFocus, wide, children }) {
  return (
    <div className={wide ? "field span-2" : "field"} onFocus={onFocus} style={{
      position: "relative", borderRadius: 14, padding: 10,
      background: active ? "rgba(14,165,233,0.05)" : "transparent",
      boxShadow: active ? "inset 0 2px 0 #0ea5e9" : "none",
      transition: "background 180ms, box-shadow 180ms",
    }}>
      {children}
    </div>
  );
}

export default CitizenReportForm;