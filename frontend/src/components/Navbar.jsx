
function Navbar({ user, onNavigate, onLogout }) {
  return (
    <nav className="navbar">
      <div
        className="navbar-logo"
        onClick={() => onNavigate("home")}
        style={{ cursor: "pointer" }}
      >
        <img src="/products/Logo.png" alt="AssanMart Logo" />
        <span>AssanMart</span>
      </div>

      <div className="navbar-actions">
        <button onClick={() => onNavigate("home")}>
          Home
        </button>

        {!user ? (
          <>
            <button onClick={() => onNavigate("login")}>
              Login
            </button>

            <button onClick={() => onNavigate("signup")}>
              Sign Up
            </button>
          </>
        ) : (
          <>
            <span>Hi, {user.name}</span>

            <button onClick={onLogout}>
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
