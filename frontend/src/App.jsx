import { BrowserRouter } from "react-router-dom";

import AppRoutes from "./routes/AppRoutes.jsx";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="smart-city-app">
        <AppRoutes />
      </div>
    </BrowserRouter>
  );
}

export default App;