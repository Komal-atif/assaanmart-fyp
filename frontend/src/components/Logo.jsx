import { useState } from "react";

// Logo: public/products/Logo.png (agar load na ho to cart emoji dikhega)
export default function Logo({ size = 90, className = "" }) {
  const [bad, setBad] = useState(false);
  if (bad) return <span className={className} style={{ fontSize: size * 0.7 }}>🛒</span>;
  return (
    <img
      src="/products/Logo.png"
      alt="AssanMart"
      width={size}
      height={size}
      className={"am-logo " + className}
      onError={() => setBad(true)}
    />
  );
}