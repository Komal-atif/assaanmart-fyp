import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import BrandHeader from '../components/BrandHeader';

const steps = [
  {
    title: 'Tap and speak',
    body: 'Press the mic and say what you need, like "Milk aur bread" in Urdu or English.',
  },
  {
    title: 'We understand you',
    body: 'AssanMart listens in both languages and turns your words into grocery items.',
  },
  {
    title: 'Check your basket',
    body: 'See the list, change quantities, and remove anything you did not mean to add.',
  },
  {
    title: 'Confirm, then checkout',
    body: 'Nothing is ordered until you confirm. Then pay and get your everyday groceries.',
  },
];

export default function HowToUseScreen() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#why-assanmart') {
      document.getElementById('why-assanmart')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash]);

  return (
    <div className="am-page">
      <BrandHeader active="how" />
      <main className="am-screen">
        <div className="am-eyebrow"><span className="am-dot" /> HOW TO USE</div>
        <h1 className="am-screen-title">Shop with your <span>voice</span> in four steps</h1>
        <p className="am-copy">No typing through long lists. Speak naturally, confirm the basket, and you are done.</p>
        <p className="am-urdu">Boliye, list check karein, phir order confirm karein.</p>
        <div className="am-steps">
          {steps.map((step, index) => (
            <article className="am-step" key={step.title}>
              <div className="am-step-num">{index + 1}</div>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
        <section className="am-why" id="why-assanmart">
          <h2>Why AssanMart?</h2>
          <ul>
            <li>Built for everyday Pakistani grocery shopping</li>
            <li>English and Urdu in the same conversation</li>
            <li>Friendly assistant that repeats items before you pay</li>
            <li>Simple enough for anyone at home to use</li>
          </ul>
        </section>
        <div className="am-actions" style={{ marginTop: 22 }}>
          <Link className="am-button" to="/login">Start shopping <span aria-hidden="true">→</span></Link>
          <Link className="am-secondary" to="/">Back to home</Link>
        </div>
      </main>
      <footer className="am-footer"><span>Aap boliye, hum shopping asaan banayen.</span><span>Confirm before checkout</span></footer>
    </div>
  );
}
