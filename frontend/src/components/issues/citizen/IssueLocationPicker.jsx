import { WARDS } from "../../../constants/issueConstants";
import { Label, Select } from "../../ui/Input";

function IssueLocationPicker({ value, onChange, invalid }) {
  return (
    <div className="field">
      <Label htmlFor="ward-picker" required>
        Ward
      </Label>
      <Select
        id="ward-picker"
        value={value}
        invalid={invalid}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select a ward</option>
        {WARDS.map((ward) => (
          <option key={ward.name} value={ward.name}>
            {ward.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

export default IssueLocationPicker;