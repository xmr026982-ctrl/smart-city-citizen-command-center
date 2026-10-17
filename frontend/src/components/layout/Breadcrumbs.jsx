import { Link } from "react-router-dom";

function Breadcrumbs({ items = [] }) {
  return (
    <nav className="mono" style={{ marginBottom: 16 }}>
      {items.map((item, index) => (
        <span key={item.label}>
          {item.to ? <Link to={item.to}>{item.label}</Link> : item.label}
          {index < items.length - 1 ? " / " : ""}
        </span>
      ))}
    </nav>
  );
}

export default Breadcrumbs;