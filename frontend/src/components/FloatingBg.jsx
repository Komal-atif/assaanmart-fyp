const ITEMS = ["🍎", "🥕", "🍞", "🥛", "🍪", "🧃", "🍅", "🧀", "🍋", "🥚"];

export default function FloatingBg() {
  return (
    <div className="am-float" aria-hidden="true">
      {ITEMS.map((e, i) => (
        <span key={i} style={{ "--i": i }}>{e}</span>
      ))}
    </div>
  );
}