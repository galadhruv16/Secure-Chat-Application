import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { authService, userService } from "../services/api";
import { setAccessToken, setUser } from "../services/authSession";
import { initSocket } from "../services/socket";
import { hasLocalKeys, bootstrapE2EEKeys } from "../services/e2eeService";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [securityNotice, setSecurityNotice] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if redirected due to session revocation
  const reason = searchParams.get("reason");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSecurityNotice("");
    setLoading(true);

    try {
      const response = await authService.login(formData);
      // Store access token (refresh token is in HttpOnly cookie)
      setAccessToken(response.data.accessToken);
      setUser(response.data.user);

      // Show security notice if login from new device
      if (response.data.securityNotice) {
        setSecurityNotice(response.data.securityNotice);
      }

      // Bootstrap E2EE keys if not present on this device
      if (!hasLocalKeys()) {
        try {
          await bootstrapE2EEKeys(async (publicKeyJwk) => {
            await userService.uploadEncryptionKey(publicKeyJwk);
          });
        } catch (e2eeErr) {
          console.warn("E2EE key bootstrap failed:", e2eeErr);
          // Don't block login for E2EE key issues
        }
      }

      // Initialize authenticated socket
      initSocket();

      navigate("/chat");
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === "ACCOUNT_LOCKED") {
        setError(err.response?.data?.message || "Account is locked. Try again later.");
      } else {
        setError(err.response?.data?.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-blue-700">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">
          🔒 Secure Chat
        </h2>
        <p className="text-center text-gray-500 text-sm mb-6">
          End-to-end encrypted messaging
        </p>

        {reason === "session-revoked" && (
          <div className="mb-4 p-3 bg-orange-100 text-orange-700 rounded text-sm">
            ⚠ Your session was revoked. Please login again.
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        {securityNotice && (
          <div className="mb-4 p-3 bg-yellow-100 text-yellow-700 rounded text-sm">
            🛡️ {securityNotice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition duration-200"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="text-center text-gray-700 mt-6">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-blue-600 font-semibold hover:underline"
          >
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
