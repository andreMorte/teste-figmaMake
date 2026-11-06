import React, { useEffect, useState } from 'react';
import { PORTO_BLUE, PORTO_SAILS, PORTO_WORD } from './portoLogo';

/**
 * Abertura do link do participante (inspirada no exemplo enviado):
 * 1) pontos azuis girando em círculo (carregando) → 2) convergem para o centro →
 * 3) o quadrado azul da Porto surge → 4) as três velas entram como vento →
 * 5) a palavra "Porto" é revelada da esquerda para a direita → some quando o teste está pronto.
 */
const INTRO_MS = 3900; // duração da animação completa

export const PortoIntro: React.FC<{ ready: boolean; onDone: () => void }> = ({ ready, onDone }) => {
  const [played, setPlayed] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setPlayed(true), reduce ? 900 : INTRO_MS);
    return () => clearTimeout(t);
  }, []);

  // sai quando a animação terminou E o teste carregou (nunca prende mais de 8s)
  useEffect(() => {
    if (played && ready && !leaving) setLeaving(true);
  }, [played, ready, leaving]);
  useEffect(() => {
    const t = setTimeout(() => setLeaving(true), 8000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(onDone, 550);
    return () => clearTimeout(t);
  }, [leaving, onDone]);

  const dots = Array.from({ length: 10 });

  return (
    <div
      className={`fixed inset-0 z-[80] bg-white flex items-center justify-center transition-opacity duration-500 ${leaving ? 'opacity-0' : 'opacity-100'}`}
      role="status"
      aria-label="Carregando o teste"
    >
      <style>{`
        .pi-stage{display:flex;align-items:center;justify-content:center}
        .pi-symbol{position:relative;width:76px;height:76px;flex:none}
        .pi-orbit{position:absolute;inset:-18px;animation:pi-spin 1.1s linear 0s 1, pi-converge .45s cubic-bezier(.6,0,.4,1) 1.05s forwards}
        .pi-orbit span{position:absolute;left:50%;top:50%;width:9px;height:9px;margin:-4.5px;border-radius:999px;background:${PORTO_BLUE}}
        .pi-center{position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px;border-radius:999px;background:${PORTO_BLUE};opacity:0;animation:pi-dot .35s ease-out .25s forwards, pi-dot-out .2s ease-in 1.45s forwards}
        .pi-square{position:absolute;inset:0;transform:scale(0) rotate(-12deg);animation:pi-square .55s cubic-bezier(.34,1.56,.64,1) 1.45s forwards}
        .pi-sail{opacity:0;transform:translateX(-14px) skewX(-8deg);transform-box:fill-box;animation:pi-sail .5s cubic-bezier(.2,.8,.2,1) forwards}
        .pi-word{overflow:hidden;width:0;flex:none;animation:pi-reveal .75s cubic-bezier(.65,0,.35,1) 2.35s forwards}
        .pi-word svg{display:block;height:76px;width:auto;margin-left:14px;transform:translateY(10px);opacity:0;animation:pi-word .6s ease-out 2.45s forwards}
        @keyframes pi-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes pi-converge{to{transform:rotate(420deg) scale(0);opacity:0}}
        @keyframes pi-dot{to{opacity:1}}
        @keyframes pi-dot-out{to{opacity:0;transform:scale(2)}}
        @keyframes pi-square{to{transform:scale(1) rotate(0)}}
        @keyframes pi-sail{to{opacity:1;transform:none}}
        @keyframes pi-reveal{to{width:254px}}
        @keyframes pi-word{to{opacity:1;transform:none}}
        @media (max-width:420px){.pi-symbol{width:56px;height:56px}.pi-word svg{height:56px;margin-left:10px}@keyframes pi-reveal{to{width:188px}}}
        @media (prefers-reduced-motion: reduce){.pi-orbit,.pi-center{display:none}.pi-square,.pi-sail,.pi-word,.pi-word svg{animation-duration:.01s!important;animation-delay:0s!important}}
      `}</style>

      <div className="pi-stage">
        <div className="pi-symbol">
          <div className="pi-orbit" aria-hidden="true">
            {dots.map((_, i) => {
              const ang = (i / dots.length) * Math.PI * 2;
              const r = 38;
              return (
                <span
                  key={i}
                  style={{
                    transform: `translate(${Math.cos(ang) * r}px, ${Math.sin(ang) * r}px) scale(${0.35 + (i / dots.length) * 0.75})`,
                    opacity: 0.25 + (i / dots.length) * 0.75
                  }}
                />
              );
            })}
          </div>
          <div className="pi-center" aria-hidden="true" />
          <svg className="pi-square" viewBox="0 0 111 111" aria-hidden="true">
            <rect width="111" height="111" rx="13" fill={PORTO_BLUE} />
            {PORTO_SAILS.map((d, i) => (
              <path key={i} d={d} fill="#fff" className="pi-sail" style={{ animationDelay: `${1.8 + i * 0.14}s` }} />
            ))}
          </svg>
        </div>
        <div className="pi-word">
          <svg viewBox="0 0 351 114" aria-label="Porto">
            <path d={PORTO_WORD} fill={PORTO_BLUE} fillRule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
  );
};
