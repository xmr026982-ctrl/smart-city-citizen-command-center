import { useNavigate } from "react-router-dom";
import { setRole } from "../../store/authStore";

const DOORS = [
  { role: "citizen", title: "Citizen", to: "/citizen" },
  { role: "staff", title: "Staff", to: "/staff" },
  { role: "admin", title: "Admin", to: "/admin" },
];

function Roledoor() {
  const navigate = useNavigate();

  const enter = (door) => {
    setRole(door.role);
    navigate(door.to);
  };

  return (
    <main className="role-door">
      <p className="eyebrow">Smart City</p>
      <h1>Enter a desk</h1>
      <div className="door-row">
        {DOORS.map((door) => (
          <button key={door.role} type="button" onClick={() => enter(door)}>
            {door.title}
          </button>
        ))}
      </div>
    </main>
  );
}

export default Roledoor;