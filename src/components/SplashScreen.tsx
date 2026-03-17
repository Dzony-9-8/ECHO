import { useEffect, useState, useRef } from "react";

interface Props {
  onComplete: () => void;
}

const HACKER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~`";
const ECHO_CHARS = ["E", "C", "H", "O", " ", "A", "I"];
const TAGLINE_WORDS = ["YOUR", "VISION,", "REALIZED", "FREE"];

function randomChar() {
  return HACKER_CHARS[Math.floor(Math.random() * HACKER_CHARS.length)];
}

// CSS injected once — mirrors the original animation keyframes
const SPLASH_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');

@keyframes echo-drawEye {
  to { stroke-dashoffset: 0; }
}
@keyframes echo-fadeIn {
  to { opacity: 1; }
}
@keyframes echo-openEyeTop {
  0%  { transform: scaleY(1); }
  100%{ transform: scaleY(0); }
}
@keyframes echo-openEyeBottom {
  0%  { transform: scaleY(1); }
  100%{ transform: scaleY(0); }
}
@keyframes echo-eyeGlitch {
  0%,90%,100% { transform: translate(0); filter: none; }
  92% { transform: translate(-2px, 1px); filter: drop-shadow(-2px 0 #ff0080) drop-shadow(2px 0 #00ffff); }
  94% { transform: translate(2px, -1px); filter: drop-shadow(2px 0 #ff0080) drop-shadow(-2px 0 #00ffff); }
  96% { transform: translate(-1px,-1px); }
  98% { transform: translate(1px,1px); }
}
@keyframes echo-bracketMove {
  0%  { left: -220px; opacity: 0; }
  50% { opacity: 1; }
  70% { left: 0; opacity: 1; }
  100%{ left: 0; opacity: 0; }
}
@keyframes echo-charGlitch {
  0%,85%,100% { transform: translate(0); text-shadow: 0 0 10px #00ff41, 0 0 20px #00ff41, 0 0 30px #00ff41; }
  87% { transform: translate(-3px, 2px) skewX(-2deg); text-shadow: -3px 0 #ff0080, 3px 0 #00ffff; }
  89% { transform: translate(3px, -2px) skewX(2deg); text-shadow: 3px 0 #ff0080, -3px 0 #00ffff; }
  91% { transform: translate(-2px,-1px) skewX(-1deg); }
  93% { transform: translate(2px,1px) skewX(1deg); }
  95% { transform: translate(-1px,2px); }
  97% { transform: translate(1px,-2px); }
}
@keyframes echo-scanScroll {
  0%   { background-position: 0 0; }
  100% { background-position: 0 100px; }
}
@keyframes echo-splashFadeOut {
  from { opacity: 1; }
  to   { opacity: 0; pointer-events: none; }
}
@keyframes echo-progressFill {
  from { width: 0%; }
  to   { width: 100%; }
}
`;

const SplashScreen = ({ onComplete }: Props) => {
  const [echoChars, setEchoChars] = useState<string[]>(ECHO_CHARS.map(() => ""));
  const [taglineChars, setTaglineChars] = useState<string[][]>(
    TAGLINE_WORDS.map((w) => Array.from(w).map(() => ""))
  );
  const [echoVisible, setEchoVisible] = useState<boolean[]>(ECHO_CHARS.map(() => false));
  const [taglineVisible, setTaglineVisible] = useState<boolean[][]>(
    TAGLINE_WORDS.map((w) => Array.from(w).map(() => false))
  );
  const [fadingOut, setFadingOut] = useState(false);
  const styleInjected = useRef(false);

  // Inject global CSS once
  useEffect(() => {
    if (styleInjected.current) return;
    styleInjected.current = true;
    const style = document.createElement("style");
    style.textContent = SPLASH_STYLES;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // Hacker-decrypt the ECHO AI characters
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const baseDelay = 1900;

    ECHO_CHARS.forEach((finalChar, index) => {
      const charDelay = baseDelay + index * 120;
      let cycles = 0;
      const maxCycles = 5;

      timers.push(
        setTimeout(() => {
          const interval = setInterval(() => {
            if (cycles < maxCycles) {
              const r = randomChar();
              setEchoChars((prev) => {
                const n = [...prev];
                n[index] = r;
                return n;
              });
              cycles++;
            } else {
              clearInterval(interval);
              setEchoChars((prev) => {
                const n = [...prev];
                n[index] = finalChar === " " ? "\u00a0" : finalChar;
                return n;
              });
              setEchoVisible((prev) => {
                const n = [...prev];
                n[index] = true;
                return n;
              });
            }
          }, 50);
        }, charDelay)
      );
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  // Hacker-decrypt the tagline characters
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const baseDelay = 3000;
    let globalIndex = 0;

    TAGLINE_WORDS.forEach((word, wi) => {
      Array.from(word).forEach((finalChar, ci) => {
        const charDelay = baseDelay + globalIndex * 60;
        const gi = globalIndex;
        let cycles = 0;
        const maxCycles = 4;

        timers.push(
          setTimeout(() => {
            const interval = setInterval(() => {
              if (cycles < maxCycles) {
                const r = randomChar();
                setTaglineChars((prev) => {
                  const n = prev.map((row) => [...row]);
                  n[wi][ci] = r;
                  return n;
                });
                cycles++;
              } else {
                clearInterval(interval);
                setTaglineChars((prev) => {
                  const n = prev.map((row) => [...row]);
                  n[wi][ci] = finalChar;
                  return n;
                });
                setTaglineVisible((prev) => {
                  const n = prev.map((row) => [...row]);
                  n[wi][ci] = true;
                  return n;
                });
              }
            }, 40);
          }, charDelay)
        );
        globalIndex++;
      });
      globalIndex++; // gap for space between words
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  // Fade out and call onComplete after animation finishes
  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadingOut(true), 4400);
    const doneTimer = setTimeout(() => onComplete(), 4900);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        animation: fadingOut ? "echo-splashFadeOut 0.5s ease-out forwards" : undefined,
      }}
    >
      {/* Scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "repeating-linear-gradient(0deg, rgba(0,255,65,0.03) 0px, rgba(0,255,65,0.03) 1px, transparent 1px, transparent 2px)",
          zIndex: 100,
          animation: "echo-scanScroll 3s linear infinite",
        }}
      />

      {/* Noise overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.03,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          zIndex: 99,
        }}
      />

      {/* Logo container */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "15px", position: "relative", zIndex: 1 }}>

        {/* Eye */}
        <div style={{ position: "relative", width: 140, height: 75 }}>
          {/* Eyelid top */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "50%",
              background: "#000",
              zIndex: 10,
              transformOrigin: "top",
              animation: "echo-openEyeTop 0.6s ease-out 0.2s forwards",
            }}
          />
          {/* Eyelid bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "100%",
              height: "50%",
              background: "#000",
              zIndex: 10,
              transformOrigin: "bottom",
              animation: "echo-openEyeBottom 0.6s ease-out 0.2s forwards",
            }}
          />
          <svg
            width={140}
            height={75}
            viewBox="0 0 140 75"
            style={{ animation: "echo-eyeGlitch 2.5s infinite 1.5s" }}
          >
            <path
              d="M5 37.5 Q70 -15 135 37.5 Q70 90 5 37.5 Z"
              fill="none"
              stroke="#00ff41"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={400}
              strokeDashoffset={400}
              style={{ animation: "echo-drawEye 0.8s ease-out forwards, echo-eyeGlitch 2.5s infinite 1.7s" }}
            />
            <circle
              cx={70} cy={37.5} r={20}
              fill="none" stroke="#00ff41" strokeWidth={2.5}
              style={{ opacity: 0, animation: "echo-fadeIn 0.3s ease-out 0.8s forwards, echo-eyeGlitch 2.5s infinite 1.9s" }}
            />
            <circle
              cx={70} cy={37.5} r={11}
              fill="#00ff41"
              style={{ opacity: 0, animation: "echo-fadeIn 0.3s ease-out 1s forwards, echo-eyeGlitch 2.5s infinite 2.1s" }}
            />
            <circle
              cx={78} cy={30} r={4}
              fill="#000"
              style={{ opacity: 0, animation: "echo-fadeIn 0.3s ease-out 1.1s forwards" }}
            />
          </svg>
        </div>

        {/* Main text */}
        <div style={{ display: "flex", alignItems: "center", position: "relative", minHeight: 90 }}>
          {/* Angle bracket flash */}
          <span
            style={{
              fontFamily: "'VT323', 'Share Tech Mono', monospace",
              fontSize: 80,
              color: "#00ff41",
              position: "absolute",
              opacity: 0,
              textShadow: "0 0 10px #00ff41, 0 0 20px #00ff41",
              animation: "echo-bracketMove 0.6s ease-out 1.3s forwards",
            }}
          >
            &gt;
          </span>

          {/* ECHO AI */}
          <div
            style={{
              display: "flex",
              fontFamily: "'VT323', 'Share Tech Mono', monospace",
              fontSize: 80,
              color: "#00ff41",
              letterSpacing: 6,
              marginLeft: 30,
            }}
          >
            {ECHO_CHARS.map((_, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity: echoChars[i] ? 1 : 0,
                  animation: echoVisible[i]
                    ? `echo-charGlitch 2s infinite ${i * 0.1}s`
                    : undefined,
                  minWidth: echoChars[i] === "\u00a0" ? "0.4em" : undefined,
                }}
              >
                {echoChars[i] || ""}
              </span>
            ))}
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontFamily: "'VT323', 'Share Tech Mono', monospace",
            fontSize: 24,
            color: "#00ff41",
            letterSpacing: 6,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 10,
            marginTop: 0,
          }}
        >
          {TAGLINE_WORDS.map((word, wi) => (
            <div key={wi} style={{ display: "flex" }}>
              {Array.from(word).map((_, ci) => (
                <span
                  key={ci}
                  style={{
                    display: "inline-block",
                    opacity: taglineChars[wi][ci] ? 1 : 0,
                    animation: taglineVisible[wi][ci]
                      ? `echo-charGlitch 2.5s infinite ${(wi * 4 + ci) * 0.08}s`
                      : undefined,
                  }}
                >
                  {taglineChars[wi][ci] || ""}
                </span>
              ))}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: 220,
            height: 2,
            background: "rgba(0,255,65,0.15)",
            borderRadius: 1,
            marginTop: 20,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              background: "#00ff41",
              boxShadow: "0 0 8px #00ff41",
              animation: "echo-progressFill 4s linear forwards",
            }}
          />
        </div>

        {/* Boot text */}
        <span
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: 11,
            color: "rgba(0,255,65,0.5)",
            letterSpacing: 3,
            marginTop: 6,
            animation: "echo-fadeIn 0.4s ease-out 0.5s forwards",
            opacity: 0,
          }}
        >
          INITIALIZING ECHO SYSTEM...
        </span>
      </div>
    </div>
  );
};

export default SplashScreen;
