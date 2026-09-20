import { Outlet } from "react-router-dom";
import { useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

function Layout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      {open ? (
        <button
          type="button"
          className="drawer-overlay"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div className="shell-main">
        <Navbar onMenu={() => setOpen(true)} />
        <div className="page-wrap">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default Layout;