import { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChatDashboard from "./pages/ChatDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import { initSocket, disconnectSocket } from "./services/socket";
import "./index.css";

function App() {
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      // Initialize socket when user is authenticated
      initSocket();
    }

    return () => {
      // Cleanup on unmount
      disconnectSocket();
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/chat" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
