import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Sun, Moon } from "lucide-react";
import backgroundImage from "../assets/1.jpg";
import logoDark from "../assets/vnrvjiet-logo.png";
import logoLight from "../assets/vnrvjiet-logo.png";
import { useAuthStore } from "../store/authStore";
import GoogleOAuthButton from "./GoogleOAuthButton";
import { useAdmin } from "../context/AdminContext";
import SEO, { SEO_CONFIGS } from "../utils/SEO";

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoading, error, forceResetAuthState } = useAuthStore();
  const { login: adminLogin } = useAdmin();

  const [theme, setTheme] = useState("dark");
  const isDark = theme === "dark";

  const themeStyles = {
    cardBg: isDark ? "rgba(15, 20, 35, 0.75)" : "rgba(220, 230, 250, 0.85)",
    cardBorder: isDark
      ? "1px solid rgba(255,255,255,0.15)"
      : "1px solid rgba(0,0,0,0.1)",
    textColor: isDark ? "#fff" : "#111",
    subText: isDark ? "#ccc" : "#555",
    overlay: isDark ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.35)",
  };

  // OAuth handling (no changes)
  useEffect(() => {
    const authStatus = searchParams.get("auth");
    const token = searchParams.get("token");
    const role = searchParams.get("role");
    const error = searchParams.get("error");

    if (authStatus === "success" && token && role) {
      localStorage.setItem("token", token);
      localStorage.setItem("auth-token", token);
      if (role === "security") localStorage.setItem("guard_token", token);
      if (role === "admin") adminLogin({ role: "admin" }, token);

      forceResetAuthState();
      toast.success("Successfully logged in with Google!");
      setTimeout(() => {
        const path =
          role === "security"
            ? "/security"
            : role === "student"
            ? "/student"
            : "/admin";
        navigate(path, { replace: true });
        window.location.reload();
      }, 100);
    } else if (error) {
      const decodedError = decodeURIComponent(error);
      if (decodedError.includes("official hostel email")) {
        toast.error("Please use your official hostel email to log in.");
      } else if (decodedError.includes("Unauthorized email")) {
        toast.error("Unauthorized email. Please use your institutional email.");
      } else {
        toast.error("Authentication failed. Please try again.");
      }
    }
  }, [searchParams, navigate, forceResetAuthState, adminLogin]);

  return (
    <>
      <SEO {...SEO_CONFIGS.login} />
      <div
        className="min-vh-100 d-flex align-items-center justify-content-center"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "relative",
          color: themeStyles.textColor,
          overflow: "hidden",
        }}
      >
      {/* Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: themeStyles.overlay,
          zIndex: 1,
        }}
      ></div>

      {/* Theme Toggle */}
      <button
        onClick={() => setTheme(isDark ? "light" : "dark")}
        style={{
          position: "absolute",
          top: "25px",
          right: "25px",
          zIndex: 3,
          background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          border: "none",
          borderRadius: "50%",
          padding: "8px",
          cursor: "pointer",
          color: isDark ? "#fff" : "#000",
          transition: "all 0.3s ease",
        }}
      >
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* Frosted Glass Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          zIndex: 2,
          width: "100%",
          maxWidth: "420px",
          padding: "2.2rem",
          borderRadius: "16px",
          background: themeStyles.cardBg,
          backdropFilter: "blur(14px)",
          border: themeStyles.cardBorder,
          boxShadow: isDark
            ? "0 8px 25px rgba(0,0,0,0.5)"
            : "0 8px 25px rgba(0,0,0,0.15)",
          textAlign: "center",
        }}
        className="login-card"
      >
        {/* Logo */}
        <div
          className="d-flex align-items-center justify-content-center mb-4"
          style={{ gap: "15px" }}
        >
          <img
            src={isDark ? logoDark : logoLight}
            alt="VNR Logo"
            style={{
              width: "75px",
              height: "75px",
              filter: isDark
                ? "drop-shadow(0px 0px 6px rgba(255,255,255,0.2))"
                : "drop-shadow(0px 0px 6px rgba(0,0,0,0.3))",
            }}
          />
          <div style={{ textAlign: "left" }}>
            <h2
              style={{
                margin: 0,
                fontWeight: "bold",
                color: themeStyles.textColor,
              }}
            >
              VNR VJIET
            </h2>
            <h5 style={{ margin: 0, color: themeStyles.subText }}>
              Hostel Login Portal
            </h5>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger py-2" role="alert">
            {error}
          </div>
        )}

        <p
          className="mb-4"
          style={{ fontSize: "0.95rem", color: themeStyles.subText }}
        >
          Sign in with your institutional Google account
        </p>

        {/* Google OAuth Button */}
        <div className="d-grid">
          <GoogleOAuthButton isLoading={isLoading} theme={theme} />
        </div>

        <p
          className="mt-3"
          style={{ fontSize: "0.85rem", color: themeStyles.subText }}
        >
          Students: Use your @vnrvjiet.in email
        </p>
      </motion.div>

      {/* Mobile Responsive Styles */}
      <style>
        {`
          @media (max-width: 768px) {
            .login-card {
              max-width: 340px !important;
              padding: 1.8rem !important;
              border-radius: 14px !important;
            }

            .login-card img {
              width: 60px !important;
              height: 60px !important;
            }

            .login-card h2 {
              font-size: 1.4rem !important;
            }

            .login-card h5 {
              font-size: 1rem !important;
            }

            .login-card p {
              font-size: 0.9rem !important;
            }

            button[style*="position: absolute"] {
              top: 15px !important;
              right: 15px !important;
              padding: 6px !important;
            }

            /* Google OAuth Button Mobile Styles */
            .login-card button[class*="w-full"] {
              padding: 0.6rem 1rem !important;
              font-size: 0.85rem !important;
            }

            .login-card button[class*="w-full"] img {
              width: 16px !important;
              height: 16px !important;
              margin-right: 8px !important;
            }

            .login-card button[class*="w-full"] span {
              font-size: 0.85rem !important;
            }
          }

          @media (max-width: 480px) {
            .login-card {
              max-width: 300px !important;
              padding: 1.5rem !important;
            }

            .login-card img {
              width: 55px !important;
              height: 55px !important;
            }

            .login-card h2 {
              font-size: 1.2rem !important;
            }

            .login-card h5 {
              font-size: 0.9rem !important;
            }

            .login-card p {
              font-size: 0.8rem !important;
            }

            /* Google OAuth Button Extra Small Mobile */
            .login-card button[class*="w-full"] {
              padding: 0.5rem 0.8rem !important;
              font-size: 0.8rem !important;
            }

            .login-card button[class*="w-full"] img {
              width: 14px !important;
              height: 14px !important;
              margin-right: 6px !important;
            }

            .login-card button[class*="w-full"] span {
              font-size: 0.8rem !important;
            }
          }
        `}
      </style>
    </div>
    </>
  );
};

export default LoginPage;
