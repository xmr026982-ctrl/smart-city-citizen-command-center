import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="page">
        <TopBar />
        <Outlet />
      </div>
    </div>
  );
}

export default AppLayout;