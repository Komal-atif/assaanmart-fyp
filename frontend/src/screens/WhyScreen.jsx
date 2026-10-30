import { useNavigate } from "react-router-dom";
import FloatingBg from "../components/FloatingBg";
import Logo from "../components/Logo";

const WHY = [
  { e: "🎙️", bg: "#FFD6E8", t: "Voice-first", d: "Bolo aur order karo. Haath se dhoondne ki mehnat khatam." },
  { e: "🗣️", bg: "#D4EEFF", t: "Apni zubaan mein", d: "Urdu, English aur Roman Urdu, jaise tum bolte ho." },
  { e: "🧠", bg: "#E8E4FF", t: "Smart AI agent", d: "Tumhari baat samajh kar sahi product aur size dhoondta hai." },
  { e: "📦", bg: "#FFE9B8", t: "362 products", d: "9 categories: ration, beverages, dairy, snacks, personal care aur bohat kuch." },
  { e: "⚡", bg: "#D9F5D3", t: "Tez aur aasan", d: "Kam clicks, kam typing. Seedha kaam ki baat." },
  { e: "👨‍👩‍👧", bg: "#FFE0CC", t: "Sab ke liye", d: "Bade, chhote, sab asani se istemal kar saken." },
];

export default function WhyScreen() {
  const nav = useNavigate();
  return (
    <div className="am-page">
      <FloatingBg />
      <div className="wy-wrap">
        <Logo size={80} className="" />
        <h1 className="am-title">Assan<span style={{ color: "var(--pink)" }}>Mart</span> kyun? 💜</h1>
        <p className="am-sub">Pakistan ke liye bana voice-first grocery agent</p>
        <div className="wy-grid">
          {WHY.map((w, i) => (
            <div className="wy-card" key={w.t} style={{ "--i": i, "--bg": w.bg }}>
              <div className="wy-ico">{w.e}</div>
              <h3>{w.t}</h3>
              <p>{w.d}</p>
            </div>
          ))}
        </div>
        <div className="wy-cta">
          <button className="am-btn" onClick={() => nav("/signup")}>Account banao 🚀</button>
          <button className="am-btn ghost" onClick={() => nav("/login")}>Login</button>
        </div>
      </div>
    </div>
  );
}