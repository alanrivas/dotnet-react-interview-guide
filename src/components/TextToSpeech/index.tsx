import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from '@docusaurus/router';
import styles from './styles.module.css';

type State = 'idle' | 'playing' | 'paused';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const SPEED_LABELS: Record<number, string> = {
  0.75: '0.75×',
  1: '1×',
  1.25: '1.25×',
  1.5: '1.5×',
  2: '2×',
};

function getPageText(): string {
  // Priority: article .markdown > main article > main
  const article =
    document.querySelector<HTMLElement>('article .markdown') ??
    document.querySelector<HTMLElement>('article') ??
    document.querySelector<HTMLElement>('main');

  if (!article) return '';

  // Clone to avoid modifying the DOM
  const clone = article.cloneNode(true) as HTMLElement;

  // Remove elements that shouldn't be read
  clone
    .querySelectorAll(
      'code, pre, .codeBlockContainer, nav, .pagination-nav, button, [aria-hidden="true"]',
    )
    .forEach((el) => el.remove());

  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export default function TextToSpeech(): React.ReactElement | null {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<State>('idle');
  const [speed, setSpeed] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const location = useLocation();

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  // Stop reading when navigating to a new page
  useEffect(() => {
    stop();
  }, [location.pathname]);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    utteranceRef.current = null;
    setState('idle');
  }, []);

  const play = useCallback(() => {
    const text = getPageText();
    if (!text) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = speed;

    utterance.onstart = () => setState('playing');
    utterance.onpause = () => setState('paused');
    utterance.onresume = () => setState('playing');
    utterance.onend = () => {
      setState('idle');
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setState('idle');
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setExpanded(true);
  }, [speed]);

  const pause = useCallback(() => {
    window.speechSynthesis.pause();
    setState('paused');
  }, []);

  const resume = useCallback(() => {
    window.speechSynthesis.resume();
    setState('playing');
  }, []);

  const changeSpeed = useCallback(
    (newSpeed: number) => {
      setSpeed(newSpeed);
      if (state === 'playing' || state === 'paused') {
        stop();
        // Small delay to restart with new speed
        setTimeout(() => {
          const text = getPageText();
          if (!text) return;
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'es-ES';
          utterance.rate = newSpeed;
          utterance.onstart = () => setState('playing');
          utterance.onend = () => {
            setState('idle');
            utteranceRef.current = null;
          };
          utterance.onerror = () => {
            setState('idle');
            utteranceRef.current = null;
          };
          utteranceRef.current = utterance;
          window.speechSynthesis.speak(utterance);
        }, 100);
      }
    },
    [state, stop],
  );

  if (!supported) return null;

  return (
    <div className={styles.container} role="region" aria-label="Lector de página">
      {/* Collapsed: just the trigger button */}
      {!expanded && state === 'idle' && (
        <button
          className={styles.triggerBtn}
          onClick={() => {
            setExpanded(true);
            play();
          }}
          aria-label="Leer esta página en voz alta"
          title="Leer página en voz alta"
        >
          <span aria-hidden="true">🔊</span>
          <span className={styles.triggerLabel}>Escuchar</span>
        </button>
      )}

      {/* Player panel */}
      {(expanded || state !== 'idle') && (
        <div className={styles.player}>
          <div className={styles.playerHeader}>
            <span className={styles.playerTitle}>
              {state === 'idle' && '🔊 Lector de voz'}
              {state === 'playing' && '▶ Leyendo...'}
              {state === 'paused' && '⏸ Pausado'}
            </span>
            <button
              className={styles.closeBtn}
              onClick={() => {
                stop();
                setExpanded(false);
              }}
              aria-label="Cerrar lector"
            >
              ✕
            </button>
          </div>

          <div className={styles.controls}>
            {state === 'idle' && (
              <button
                className={`${styles.ctrlBtn} ${styles.playBtn}`}
                onClick={play}
                aria-label="Reproducir"
              >
                ▶ Leer
              </button>
            )}
            {state === 'playing' && (
              <button
                className={`${styles.ctrlBtn} ${styles.pauseBtn}`}
                onClick={pause}
                aria-label="Pausar"
              >
                ⏸ Pausar
              </button>
            )}
            {state === 'paused' && (
              <button
                className={`${styles.ctrlBtn} ${styles.playBtn}`}
                onClick={resume}
                aria-label="Continuar"
              >
                ▶ Continuar
              </button>
            )}
            {state !== 'idle' && (
              <button
                className={`${styles.ctrlBtn} ${styles.stopBtn}`}
                onClick={stop}
                aria-label="Detener"
              >
                ⏹ Detener
              </button>
            )}
          </div>

          <div className={styles.speedRow} role="group" aria-label="Velocidad de lectura">
            <span className={styles.speedLabel}>Velocidad:</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                className={`${styles.speedBtn} ${speed === s ? styles.speedActive : ''}`}
                onClick={() => changeSpeed(s)}
                aria-pressed={speed === s}
                aria-label={`Velocidad ${SPEED_LABELS[s]}`}
              >
                {SPEED_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
