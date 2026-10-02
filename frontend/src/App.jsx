import { BrowserRouter, Routes, Route } from "react-router-dom";

import UserMap from "./pages/User/UserMap";
import StaffMap from "./pages/Staff/StaffMap";
import AdminMap from "./pages/Admin/AdminMap";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserMap />} />
        <Route path="/user/map" element={<UserMap />} />
        <Route path="/staff/map" element={<StaffMap />} />
        <Route path="/admin/map" element={<AdminMap />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;