import { useState } from "react";
import { MapPin } from "lucide-react";
import { Input, Label, Select } from "../../ui/Input";
import LocationPickSheet from "./LocationPickSheet";

function IssueLocationPicker({ draft, errors, refs, wards, onChange, active, onStep }) {
  const [open, setOpen] = useState(false);
  const locked = !draft.ward;
  const cell = {
    position: "relative", borderRadius: 14, padding: 10,
    background: active ? "rgba(14,165,233,0.05)" : "transparent",
    boxShadow: active ? "inset 0 2px 0 #0ea5e9" : "none",
  };

  return (
    <>
      <div className="field" style={cell} onFocus={onStep}>
        <Label htmlFor="ward" required>Zone</Label>
        <Select id="ward" ref={refs.ward} value={draft.ward} invalid={Boolean(errors.ward)} onFocus={onStep} onChange={(event) => {
          onChange("ward", event.target.value);
          onChange("location", "");
          onChange("lat", null);
          onChange("lng", null);
          onStep?.();
        }}>
          <option value="">Select a zone</option>
          {wards.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
        </Select>
        {errors.ward ? <p className="field-error">{errors.ward}</p> : null}
      </div>
      <div className="field" style={cell}>
        <Label htmlFor="location" required>Issue location</Label>
        <Input id="location" ref={refs.location} value={draft.location} invalid={Boolean(errors.location)} readOnly placeholder={locked ? "Select a zone first" : "Open the map inside this zone"} onClick={() => { onStep?.(); if (!locked) setOpen(true); }} style={{ cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.72 : 1 }} />
        <p style={{ marginTop: 6, fontSize: 12, color: "var(--subtle)", display: "flex", gap: 6, alignItems: "center" }}>
          <MapPin size={12} />
          {draft.lat && draft.lng ? `${Number(draft.lat).toFixed(5)}, ${Number(draft.lng).toFixed(5)}` : "Coordinates arrive after the map pick"}
        </p>
        {errors.location ? <p className="field-error">{errors.location}</p> : null}
      </div>
      {open && <LocationPickSheet zone={draft.ward} onClose={() => setOpen(false)} />}
    </>
  );
}

export default IssueLocationPicker;