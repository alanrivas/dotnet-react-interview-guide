import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './styles.module.css';

interface InterviewTimerProps {
  /** Duración total en minutos */
  minutes: number;
}

type TimerState = 'idle' | 'running' | 'paused' | 'done';

export default function InterviewTimer({ minutes }: InterviewTimerProps): React.ReactElement {
  const totalSeconds = minutes * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const start = useCallback(() => {
    setTimerState('running');
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setTimerState('done');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const pause = () => {
    clear();
    setTimerState('paused');
  };

  const reset = () => {
    clear();
    setRemaining(totalSeconds);
    setTimerState('idle');
  };

  useEffect(() => () => clear(), []);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const progress = ((totalSeconds - remaining) / totalSeconds) * 100;

  const urgency =
    remaining <= 5 * 60 ? 'critical' :
    remaining <= 10 * 60 ? 'warning' :
    'normal';

  return (
    <div className={`${styles.timer} ${styles[urgency]} ${timerState === 'done' ? styles.done : ''}`}>
      <div className={styles.header}>
        <span className={styles.label}>⏱ Temporizador de entrevista</span>
        <span className={styles.totalLabel}>{minutes} minutos</span>
      </div>

      <div className={styles.display}>{timerState === 'done' ? '¡Tiempo!' : display}</div>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      {urgency === 'warning' && timerState === 'running' && (
        <p className={styles.alert}>⚠️ Quedan menos de 10 minutos — ve cerrando respuestas</p>
      )}
      {urgency === 'critical' && timerState === 'running' && (
        <p className={styles.alert}>🔴 Menos de 5 minutos — resume y concluye</p>
      )}
      {timerState === 'done' && (
        <p className={styles.alert}>⏰ El tiempo de la entrevista ha terminado</p>
      )}

      <div className={styles.controls}>
        {timerState === 'idle' && (
          <button className={styles.btnStart} onClick={start}>▶ Iniciar</button>
        )}
        {timerState === 'running' && (
          <button className={styles.btnPause} onClick={pause}>⏸ Pausar</button>
        )}
        {timerState === 'paused' && (
          <>
            <button className={styles.btnStart} onClick={start}>▶ Continuar</button>
            <button className={styles.btnReset} onClick={reset}>↺ Reiniciar</button>
          </>
        )}
        {(timerState === 'done' || timerState === 'running') && (
          <button className={styles.btnReset} onClick={reset}>↺ Reiniciar</button>
        )}
      </div>
    </div>
  );
}
