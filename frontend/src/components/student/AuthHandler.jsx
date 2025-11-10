import { useEffect } from "react";
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate } from "react-router-dom";

const AuthHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const error = params.get("error");

    console.log("AuthHandler: URL params:", { token: token ? 'received' : 'not found', error });

    if (error) {
      console.error("OAuth error:", error);
      toast.error(`Login failed: ${error}. Please try again.`);
      navigate("/login", { replace: true });
      return;
    }

    if (token) {
      // Store token in localStorage for consistency with regular login
      localStorage.setItem("token", token);
      console.log("OAuth login successful, token stored in localStorage");
      navigate("/home", { replace: true });
    } else {
      console.error("No token received from OAuth callback");
      toast.error("No authentication token received. Please try again.");
      navigate("/login", { replace: true });
    }
  }, [location, navigate]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column'
    }}>
      <div>Processing login...</div>
      <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
        Please wait while we complete your authentication.
      </div>
    </div>
  );
};

export default AuthHandler;
