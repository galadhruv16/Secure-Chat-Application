/**
 * Updated ProtectedRoute component.
 * Uses new auth session management and handles forced re-authentication.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isAuthenticated } from "../services/authSession";

export default function ProtectedRoute({ children }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login");
    }
  }, [navigate]);

  return isAuthenticated() ? children : null;
}
