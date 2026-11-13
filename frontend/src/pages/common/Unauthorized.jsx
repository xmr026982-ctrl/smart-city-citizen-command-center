import { Link } from "react-router-dom";
import { getRole } from "../../store/authStore";

function Unauthorized() {
  const role = getRole();
  const home = role === "admin" ? "/admin" : role === "staff" ? "/staff" : "/citizen";

  return (
    <main className="page">
      <h1>This desk is closed</h1>
      <Link to={home}>Back to your desk</Link>
    </main>
  );
}

export default Unauthorized;