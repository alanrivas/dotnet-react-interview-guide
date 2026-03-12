import React, { useState } from 'react';
import styles from './styles.module.css';

interface QuizProps {
  question: string;
  options: string[];
  correctIndex: number;
  /** Una explicación por opción, en el mismo orden que `options`. */
  explanations: string[];
}

export default function Quiz({ question, options, correctIndex, explanations }: QuizProps): JSX.Element {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;
  const isCorrect = selected === correctIndex;

  const handleSelect = (index: number) => {
    if (!answered) setSelected(index);
  };

  const reset = () => setSelected(null);

  return (
    <div className={styles.quizCard}>
      <p className={styles.question}>❓ {question}</p>

      <ul className={styles.optionsList}>
        {options.map((option, i) => {
          let optionClass = styles.option;
          if (answered) {
            if (i === correctIndex) optionClass = `${styles.option} ${styles.correct}`;
            else if (i === selected) optionClass = `${styles.option} ${styles.incorrect}`;
            else optionClass = `${styles.option} ${styles.disabled}`;
          }
          return (
            <li key={i}>
              <button
                className={optionClass}
                onClick={() => handleSelect(i)}
                disabled={answered && i !== selected && i !== correctIndex}
              >
                <span className={styles.optionLetter}>{String.fromCharCode(65 + i)}</span>
                {option}
              </button>
            </li>
          );
        })}
      </ul>

      {answered && (
        <div className={isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect}>
          <strong>{isCorrect ? '✅ ¡Correcto!' : `❌ Incorrecto — la respuesta correcta es ${String.fromCharCode(65 + correctIndex)}`}</strong>
          <p className={styles.explanation}>{explanations[selected]}</p>
          {!isCorrect && (
            <div className={styles.correctHint}>
              <strong>💡 ¿Por qué {String.fromCharCode(65 + correctIndex)} es correcta?</strong>
              <p className={styles.explanation}>{explanations[correctIndex]}</p>
            </div>
          )}
          <button className={styles.retryBtn} onClick={reset}>🔄 Reintentar</button>
        </div>
      )}
    </div>
  );
}
