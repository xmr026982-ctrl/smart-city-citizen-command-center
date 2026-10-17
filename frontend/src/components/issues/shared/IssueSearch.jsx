import { Input } from "../../ui/Input";

function IssueSearch({ value, onChange, placeholder = "Search ID, title, location" }) {
  return <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export default IssueSearch;