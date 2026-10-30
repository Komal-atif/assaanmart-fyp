import { Link } from 'react-router-dom';

export default function BrandHeader({ active }) {
  return (
    <header className="am-header">
      <Link to="/" className="am-logo">
        <img src="/products/Logo.png" alt="AssanMart" />
        <span>Assan<b>Mart</b></span>
      </Link>
      <nav className="am-nav">
        <Link to="/" className={active === 'home' ? 'am-link am-link-active' : 'am-link'}>Home</Link>
        <Link to="/how-to-use" className={active === 'how' ? 'am-link am-link-active' : 'am-link'}>How to use</Link>
        <Link to="/login" className={active === 'login' ? 'am-link am-link-active' : 'am-link'}{active === 'signup' ? 'am-link am-link-active' : 'am-link'}>Sign in</Link>
      </nav>
    </header>
  );
}
