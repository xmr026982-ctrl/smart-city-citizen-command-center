import { Input, Label, Select } from "../../ui/Input";

function IssueLocationPicker({ draft, errors, refs, wards, onChange }) {
  return (
    <>
      <div className="field">
        <Label htmlFor="ward" required>
          Zone
        </Label>
        <Select
          id="ward"
          ref={refs.ward}
          value={draft.ward}
          invalid={Boolean(errors.ward)}
          onChange={(e) => {
            const next = wards.find((item) => item.name === e.target.value);
            onChange("ward", e.target.value);
            onChange("lat", next?.lat ?? null);
            onChange("lng", next?.lng ?? null);
          }}
        >
          <option value="">Select a zone</option>
          {wards.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
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
          id="location"
          ref={refs.location}
          value={draft.location}
          invalid={Boolean(errors.location)}
          placeholder="Nearby street, gate, park, or shop"
          onChange={(e) => onChange("location", e.target.value)}
        />
        {errors.location ? <p className="field-error">{errors.location}</p> : null}
      </div>
    </>
  );
}

export default IssueLocationPicker;