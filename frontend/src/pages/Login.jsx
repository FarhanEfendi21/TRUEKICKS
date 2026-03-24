import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { useCart } from "../Context/CartContext";
import { useWishlist } from "../Context/WishlistContext";

export default function Login() {
  const navigate = useNavigate();
  const { refreshCart } = useCart();
  const { refreshWishlist } = useWishlist();

  // State Form
  const [activeTab, setActiveTab] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Validation states
  const [touched, setTouched] = useState({
    email: false,
    password: false,
    confirmPassword: false,
    fullName: false
  });

  // === VALIDATION HELPERS ===
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const getPasswordStrength = (pass) => {
    if (!pass) return { level: "", color: "", width: "0%" };
    if (pass.length < 6) return { level: "Too short", color: "#ef4444", width: "20%" };
    if (pass.length < 8) return { level: "Weak", color: "#f97316", width: "40%" };

    const hasUppercase = /[A-Z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);

    const score = [hasUppercase, hasNumber, hasSpecial].filter(Boolean).length;

    if (score === 0) return { level: "Fair", color: "#eab308", width: "50%" };
    if (score === 1) return { level: "Good", color: "#22c55e", width: "70%" };
    if (score >= 2) return { level: "Strong", color: "#16a34a", width: "100%" };

    return { level: "Fair", color: "#eab308", width: "50%" };
  };

  const passwordStrength = getPasswordStrength(password);

  // === CLEAR FORM ON TAB SWITCH ===
  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setFullName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setTouched({
      email: false,
      password: false,
      confirmPassword: false,
      fullName: false
    });
  };

  // === FUNGSI UTAMA LOGIN & REGISTER ===
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // VALIDATION
    if (activeTab === "signup" && !fullName.trim()) {
      toast.error("Full Name is required");
      return;
    }

    if (!validateEmail(normalizedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    // Confirm password validation for signup
    if (activeTab === "signup" && password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

      if (activeTab === "signup") {
        // --- LOGIC REGISTER ---
        await axios.post(`${API_URL}/api/register`, {
          full_name: fullName.trim(),
          email: normalizedEmail,
          password: password,
        });

        toast.success("Registration Successful! Please Log In.");

        // Clear old profile image for new account
        localStorage.removeItem("profileImage");

        // Pindah ke tab Login otomatis
        handleTabSwitch("login");
        setEmail(normalizedEmail); // Keep email for convenience
      } else {
        // --- LOGIC LOGIN ---
        const response = await axios.post(`${API_URL}/api/login`, {
          email: normalizedEmail,
          password: password,
        });

        // SAFETY: Pastikan tidak menyimpan password di localStorage
        const userData = response.data.user;
        if (userData.password) delete userData.password;

        // Simpan data bersih ke LocalStorage (JWT Token kini diamankan via HttpOnly Cookie dari server)
        localStorage.setItem("user", JSON.stringify(userData));
        // localStorage.removeItem("token"); // Cleanup legacy tokens just in case

        refreshCart();
        refreshWishlist();

        toast.success("Welcome back!", { duration: 2000 });

        // Delay sedikit agar toast terbaca sebelum pindah
        setTimeout(() => {
          navigate("/home");
        }, 1000);
      }
    } catch (error) {
      console.error("Auth Error:", error);
      if (error.response) {
        const errDataMsg = error.response.data.message || "Authentication failed";
        // Check if the error message is raw HTML (like Cloudflare 521 error when Supabase is down)
        if (typeof errDataMsg === 'string' && (errDataMsg.includes("<!DOCTYPE html>") || errDataMsg.includes("521: Web server is down"))) {
          toast.error("Database (Supabase) is unavailable or paused. Please restore it in your dashboard.");
        } else {
          toast.error(errDataMsg);
        }
      } else {
        toast.error("Network Error. Check your connection.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // === FUNGSI GUEST MODE ===
  const handleGuestLogin = () => {
    localStorage.removeItem("user");

    refreshCart();
    refreshWishlist();

    toast("Continue as Guest", {
      icon: "👀",
      style: {
        borderRadius: "10px",
        background: "#333",
        color: "#fff",
      },
    });

    setTimeout(() => {
      navigate("/home");
    }, 800);
  };

  // === VALIDATION ERROR GETTERS ===
  const getEmailError = () => {
    if (!touched.email) return null;
    if (!email) return "Email is required";
    if (!validateEmail(email)) return "Invalid email format";
    return null;
  };

  const getPasswordError = () => {
    if (!touched.password) return null;
    if (!password) return "Password is required";
    if (password.length < 6) return "At least 6 characters required";
    return null;
  };

  const getConfirmPasswordError = () => {
    if (!touched.confirmPassword || activeTab !== "signup") return null;
    if (!confirmPassword) return "Please confirm your password";
    if (password !== confirmPassword) return "Passwords do not match";
    return null;
  };

  const emailError = getEmailError();
  const passwordError = getPasswordError();
  const confirmPasswordError = getConfirmPasswordError();

  return (
    <div className="min-h-screen flex items-center justify-center font-poppins bg-[#FAFAFA] px-4">
      <Toaster position="top-center" reverseOrder={false} />

      <div className="w-full max-w-[420px]">
        {/* LOGO */}
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-black italic tracking-tighter text-gray-900 select-none">
            TRUE<span className="text-[#FF5500]">KICKS</span>
          </h1>
          <p className="text-gray-400 text-sm mt-2 font-medium tracking-wide">
            Welcome back to the game.
          </p>
        </div>

        {/* CARD CONTAINER */}
        <div className="w-full bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
          {/* TAB SWITCHER */}
          <div className="flex mb-6 relative">
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gray-200"></div>
            <button
              onClick={() => handleTabSwitch("signup")}
              className={`w-1/2 pb-3 text-base font-bold transition-all relative ${activeTab === "signup"
                ? "text-gray-900"
                : "text-gray-400 hover:text-gray-600"
                }`}
            >
              Sign Up
              {activeTab === "signup" && (
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-black rounded-full"></div>
              )}
            </button>
            <button
              onClick={() => handleTabSwitch("login")}
              className={`w-1/2 pb-3 text-base font-bold transition-all relative ${activeTab === "login"
                ? "text-gray-900"
                : "text-gray-400 hover:text-gray-600"
                }`}
            >
              Log In
              {activeTab === "login" && (
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-black rounded-full"></div>
              )}
            </button>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {/* Input Nama (Sign Up Only) */}
            {activeTab === "signup" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 ml-1 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-black focus:bg-white transition-all text-sm font-medium"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={() => setTouched({ ...touched, fullName: true })}
                />
              </div>
            )}

            {/* Input Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 ml-1 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                autoComplete="off"
                className={`w-full px-4 py-3 bg-gray-50 border rounded-xl outline-none focus:bg-white transition-all text-sm font-medium ${emailError ? "border-red-400 focus:border-red-500" : "border-gray-200 focus:border-black"
                  }`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched({ ...touched, email: true })}
              />
              {emailError && (
                <p className="text-xs text-red-500 ml-1 mt-1">{emailError}</p>
              )}
            </div>

            {/* Input Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 ml-1 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  className={`w-full px-4 py-3 bg-gray-50 border rounded-xl outline-none focus:bg-white transition-all text-sm font-medium pr-12 ${passwordError ? "border-red-400 focus:border-red-500" : "border-gray-200 focus:border-black"
                    }`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched({ ...touched, password: true })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs text-red-500 ml-1 mt-1">{passwordError}</p>
              )}

              {/* Password Strength Indicator (Signup only) */}
              {activeTab === "signup" && password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Password strength</span>
                    <span className="text-xs font-medium" style={{ color: passwordStrength.color }}>
                      {passwordStrength.level}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: passwordStrength.width,
                        backgroundColor: passwordStrength.color
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password (Sign Up Only) */}
            {activeTab === "signup" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 ml-1 uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="Re-enter your password"
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-xl outline-none focus:bg-white transition-all text-sm font-medium pr-12 ${confirmPasswordError ? "border-red-400 focus:border-red-500" :
                      (confirmPassword && password === confirmPassword) ? "border-green-400" : "border-gray-200 focus:border-black"
                      }`}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => setTouched({ ...touched, confirmPassword: true })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
                  >
                    {showConfirmPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                  {/* Check mark for matching passwords */}
                  {confirmPassword && password === confirmPassword && (
                    <div className="absolute right-12 top-1/2 -translate-y-1/2 text-green-500">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                  )}
                </div>
                {confirmPasswordError && (
                  <p className="text-xs text-red-500 ml-1 mt-1">{confirmPasswordError}</p>
                )}
              </div>
            )}

            {/* Tombol Aksi */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-black text-white py-4 rounded-xl font-bold text-sm hover:bg-gray-800 hover:shadow-lg transition-all active:scale-[0.98] flex justify-center items-center gap-2 mt-6 shadow-lg shadow-black/20"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : activeTab === "login" ? (
                "Log In"
              ) : (
                "Create Account"
              )}
            </button>

            {/* Text Login/Sign up switch */}
            <div className="text-center mt-4">
              <p className="text-xs text-gray-600">
                {activeTab === "login"
                  ? "Don't have an account?"
                  : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => handleTabSwitch(activeTab === "login" ? "signup" : "login")}
                  className="text-[#FF5500] font-bold hover:underline ml-1"
                >
                  {activeTab === "login" ? "Sign Up" : "Log In"}
                </button>
              </p>
            </div>
          </form>
        </div>

        {/* === GUEST MODE BUTTON === */}
        <div className="mt-8 text-center">
          <button
            onClick={handleGuestLogin}
            className="w-full max-w-xs mx-auto flex items-center justify-center gap-3 
                bg-white border border-gray-300 shadow-sm 
                hover:shadow-md hover:border-gray-400 
                text-gray-800 font-semibold 
                px-5 py-3 rounded-xl 
                transition-all duration-300 
                hover:-translate-y-0.5 active:scale-95 group"
          >
            <span className="tracking-wide">Continue as Guest</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5 transition-transform group-hover:translate-x-1"
            >
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
