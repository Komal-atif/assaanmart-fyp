
import { useState } from "react";

import LandingPage from "./screens/LandingPage";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import Dashboard from "./screens/Dashboard";

import "./App.css";

function App() {
  const [currentPage, setCurrentPage] = useState("home");
  const [user, setUser] = useState(null);

  const handleNavigate = (page) => {
    setCurrentPage(page);
  };

  const handleLogin = (loginData) => {
    const loggedInUser = {
      name: loginData.email.split("@")[0],
      email: loginData.email,
    };

    setUser(loggedInUser);
    setCurrentPage("dashboard");
  };

  const handleSignup = (signupData) => {
    const newUser = {
      name: signupData.name,
      email: signupData.email,
    };

    setUser(newUser);
    setCurrentPage("dashboard");
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage("home");
  };

  return (
    <div className="app">
      {currentPage === "home" && (
        <LandingPage onNavigate={handleNavigate} />
      )}

      {currentPage === "login" && (
        <LoginScreen
          onNavigate={handleNavigate}
          onLogin={handleLogin}
        />
      )}

      {currentPage === "signup" && (
        <SignupScreen
          onNavigate={handleNavigate}
          onSignup={handleSignup}
        />
      )}

      {currentPage === "dashboard" && user && (
        <Dashboard
          user={user}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;
