import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import { toast } from 'react-hot-toast';
// Removed UserContext import - will be replaced with direct token storage
import img5 from "../../assets/1.jpg";
import { FiEye, FiEyeOff } from "react-icons/fi";
// import DebugAuth from "./DebugAuth";
// import TestToken from "./TestToken";

const StudentLogin = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();
  const navigate = useNavigate();
  const [passwordVisible, setPasswordVisible] = useState(false);

  const onSubmit = async (data) => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_SERVER_URL}/student-api/login`,
        data
      );

      // Only store the token, user data will be fetched when needed
      localStorage.setItem("token", response.data.token);
      console.log("Login successful:", response.data);
      toast.success("Login Successful!");
      navigate("/home");
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
    }
  };

  // Google OAuth handler
  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_SERVER_URL}/auth/google`;
  };

  return (
    <div className="login-page" style={{ backgroundImage: `url(${img5})` }}>
      {/* <DebugAuth /> */}
      {/* <TestToken /> */}
      <div className="login-container">
        <div className="login-card">
          <h2 className="login-title">Student Login</h2>

          {/* Existing Roll Number + Password login */}
          <form onSubmit={handleSubmit(onSubmit)} className="login-form">
            <div className="form-group">
              <label className="form-label">Roll Number</label> 
              <input
                type="text"
                placeholder="Enter your roll number"
                {...register("rollNumber", {
                  required: "Roll number is required",
                })}
                className="responsive-input"
              />
              {errors.rollNumber && (
                <small className="error-message fade-in">
                  {errors.rollNumber.message}
                </small>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper">
                <input
                  type={passwordVisible ? "text" : "password"}
                  placeholder="Enter your password"
                  {...register("password", {
                    required: "Password is required",
                  })}
                  className="responsive-input"
                />
                <span
                  className="password-toggle-icon"
                  onClick={() => setPasswordVisible(!passwordVisible)}
                >
                  {passwordVisible ? <FiEyeOff /> : <FiEye />}
                </span>
              </div>
              {errors.password && (
                <small className="error-message fade-in">
                  {errors.password.message}
                </small>
              )}
            </div>

            <button type="submit" className="login-button">
              Login
            </button>
          </form>

          {/* Divider */}
          <div className="text-center mt-3">
            <span>OR</span>
          </div>

          {/* Google OAuth Login */}
          <button onClick={handleGoogleLogin} className="login-button google-btn">
            <i className="bi bi-google me-2"></i> Login with Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentLogin;
