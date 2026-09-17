import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import "./App.css";
// import your Layout / Navbar / Sidebar if you have them

function App() {
  return (
    <BrowserRouter>
      {/* If you have a Layout component, wrap it here */}
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;