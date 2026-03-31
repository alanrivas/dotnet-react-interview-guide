import React, { useState, useEffect } from 'react';
import styles from './styles.module.css';

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface StoredResult {
  score: number;
  total: number;
  completedAt: string;
}

interface QuizSectionProps {
  /** Clave única para persistir el resultado en localStorage */
  storageKey: string;
  /** Lista de preguntas */
  questions: Question[];
  /** Título opcional del bloque */
  title?: string;
}

export default function QuizSection({ storageKey, questions, title = '🧠 Mini-Quiz' }: QuizSectionProps): React.ReactElement {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [lastResult, setLastResult] = useState<StoredResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const storageFullKey = `quizsection-${storageKey}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageFullKey);
      if (raw) setLastResult(JSON.parse(raw) as StoredResult);
    } catch {
      // ignore
    }
  }, [storageFullKey]);

  const current = questions[currentIndex];
  const answered = selected !== null;
  const isCorrect = selected === current?.correctIndex;
  const totalQuestions = questions.length;

  const handleSelect = (index: number) => {
    if (answered) return;
    setSelected(index);
    if (index === current.correctIndex) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (currentIndex + 1 >= totalQuestions) {
      const finalResult: StoredResult = { score, total: totalQuestions, completedAt: new Date().toISOString() };
      try {
        localStorage.setItem(storageFullKey, JSON.stringify(finalResult));
      } catch {
        // ignore
      }
      setLastResult(finalResult);
      setFinished(true);
    } else {
      setCurrentIndex(i => i + 1);
      setSelected(null);
    }
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  const scorePercent = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const scoreLabel =
    scorePercent >= 80 ? '🟢 Excelente' :
    scorePercent >= 60 ? '🟡 Bien' :
    '🔴 Repasar';

  if (finished) {
    return (
      <div className={styles.section}>
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
        </div>
        <div className={styles.scoreBoard}>
          <div className={styles.scoreCircle} data-level={scorePercent >= 80 ? 'good' : scorePercent >= 60 ? 'ok' : 'bad'}>
            <span className={styles.scoreNumber}>{score}/{totalQuestions}</span>
            <span className={styles.scorePercent}>{scorePercent}%</span>
          </div>
          <p className={styles.scoreLabel}>{scoreLabel}</p>
          {scorePercent < 80 && (
            <p className={styles.scoreHint}>Repasa los temas donde fallaste y vuelve a intentarlo.</p>
          )}
          <button className={styles.retryBtn} onClick={handleRetry}>🔄 Intentar de nuevo</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <span className={styles.progress}>{currentIndex + 1}/{totalQuestions}</span>
      </div>

      {lastResult && !finished && (
        <div className={styles.lastResult}>
          <button className={styles.historyToggle} onClick={() => setShowHistory(h => !h)}>
            {showHistory ? '▲' : '▼'} Último resultado: {lastResult.score}/{lastResult.total} · {formatDate(lastResult.completedAt)}
          </button>
        </div>
      )}

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${((currentIndex) / totalQuestions) * 100}%` }} />
      </div>

      <p className={styles.question}>❓ {current.question}</p>

      <ul className={styles.optionsList}>
        {current.options.map((option, i) => {
          let cls = styles.option;
          if (answered) {
            if (i === current.correctIndex) cls = `${styles.option} ${styles.correct}`;
            else if (i === selected) cls = `${styles.option} ${styles.incorrect}`;
            else cls = `${styles.option} ${styles.dimmed}`;
          }
          return (
            <li key={i}>
              <button className={cls} onClick={() => handleSelect(i)} disabled={answered && i !== selected && i !== current.correctIndex}>
                <span className={styles.letter}>{String.fromCharCode(65 + i)}</span>
                {option}
              </button>
            </li>
          );
        })}
      </ul>

      {answered && (
        <div className={isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect}>
          <strong>{isCorrect ? '✅ ¡Correcto!' : `❌ Incorrecto — la respuesta es ${String.fromCharCode(65 + current.correctIndex)}`}</strong>
          <p className={styles.explanation}>{current.explanation}</p>
          <button className={styles.nextBtn} onClick={handleNext}>
            {currentIndex + 1 >= totalQuestions ? '📊 Ver resultado' : 'Siguiente →'}
          </button>
        </div>
      )}
    </div>
  );
}
