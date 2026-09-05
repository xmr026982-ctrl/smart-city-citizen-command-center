import AdminDashboard from "./pages/AdminDashboard";
import ModeratorPanel from "./pages/ModeratorPanel";
import NotificationCenter from "./components/NotificationCenter";

function App() {
  return (
    
    <>
      <AdminDashboard />
      <ModeratorPanel />
      <div className="min-h-screen bg-slate-950 p-8">
        <NotificationCenter />
      </div>
    </>
  );
}

export default App;