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
import Sessions from "./pages/Sessions";
import SecurityCenter from "./pages/SecurityCenter";
import ProtectedRoute from "./components/ProtectedRoute";
import { initSocket, disconnectSocket } from "./services/socket";
import { isAuthenticated } from "./services/authSession";
import "./index.css";

function App() {
  useEffect(() => {
    if (isAuthenticated()) {
      initSocket();
    }

    return () => {
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
        <Route
          path="/sessions"
          element={
            <ProtectedRoute>
              <Sessions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security"
          element={
            <ProtectedRoute>
              <SecurityCenter />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/chat" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
