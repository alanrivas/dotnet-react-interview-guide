import React, { useState, useEffect } from 'react';
import styles from './styles.module.css';

interface QuizEntry {
  key: string;
  label: string;
}

interface LevelProgress {
  nivel: string;
  emoji: string;
  color: string;
  quizzes: QuizEntry[];
  link: string;
}

const LEVELS: LevelProgress[] = [
  {
    nivel: 'Junior',
    emoji: '🟢',
    color: 'var(--level-junior-color, #22c55e)',
    link: '/docs/junior',
    quizzes: [
      { key: 'junior-poo', label: 'POO en C#' },
      { key: 'junior-react-basico', label: 'React Básico' },
      { key: 'junior-testing-basico', label: 'Testing Básico' },
    ],
  },
  {
    nivel: 'Semi-Senior',
    emoji: '🟡',
    color: 'var(--level-semi-color, #eab308)',
    link: '/docs/semi-senior',
    quizzes: [
      { key: 'semi-aspnet-core', label: 'ASP.NET Core' },
      { key: 'semi-entity-framework', label: 'Entity Framework' },
      { key: 'semi-react-avanzado', label: 'React Avanzado' },
      { key: 'semi-inyeccion-dependencias', label: 'Dependency Injection' },
      { key: 'semi-autenticacion-oauth', label: 'OAuth & JWT' },
      { key: 'semi-apis-rest', label: 'APIs REST' },
      { key: 'semi-csharp-avanzado', label: 'C# Avanzado' },
      { key: 'semi-testing-backend', label: 'Testing' },
      { key: 'semi-sql-avanzado', label: 'SQL Avanzado' },
      { key: 'semi-ef-core-performance', label: 'EF Core Performance' },
      { key: 'semi-react-19', label: 'React 19' },
      { key: 'semi-playwright-e2e', label: 'Playwright E2E' },
      { key: 'semi-cors-avanzado', label: 'CORS Avanzado' },
    ],
  },
  {
    nivel: 'Senior',
    emoji: '🔴',
    color: 'var(--level-senior-color, #ef4444)',
    link: '/docs/senior',
    quizzes: [
      { key: 'senior-application-insights', label: 'Application Insights' },
    ],
  },
];

const STORAGE_PREFIX = 'quizsection-';

interface Result {
  score: number;
  total: number;
  completedAt: string;
}

function readResult(key: string): Result | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as Result) : null;
  } catch {
    return null;
  }
}

function scoreClass(score: number, total: number): string {
  const pct = total > 0 ? score / total : 0;
  if (pct >= 0.8) return styles.dotGood;
  if (pct >= 0.6) return styles.dotOk;
  return styles.dotBad;
}

export default function ProgressDashboard(): React.ReactElement {
  const [results, setResults] = useState<Record<string, Result | null>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const map: Record<string, Result | null> = {};
    LEVELS.forEach(level =>
      level.quizzes.forEach(q => {
        map[q.key] = readResult(q.key);
      })
    );
    setResults(map);
  }, []);

  const totalQuizzes = LEVELS.reduce((s, l) => s + l.quizzes.length, 0);
  const totalCompleted = Object.values(results).filter(Boolean).length;
  const globalPct = totalQuizzes > 0 ? Math.round((totalCompleted / totalQuizzes) * 100) : 0;

  return (
    <div className={styles.dashboard}>
      <div className={styles.headerRow}>
        <span className={styles.title}>📈 Tu progreso de estudio</span>
        <span className={styles.globalBadge}>{totalCompleted}/{totalQuizzes} quizzes completados</span>
      </div>

      <div className={styles.globalBar}>
        <div className={styles.globalFill} style={{ width: `${globalPct}%` }} />
      </div>

      <div className={styles.levelsRow}>
        {LEVELS.map(level => {
          const completed = level.quizzes.filter(q => results[q.key] !== null && results[q.key] !== undefined).length;
          const pct = level.quizzes.length > 0 ? Math.round((completed / level.quizzes.length) * 100) : 0;
          const isOpen = expanded === level.nivel;

          return (
            <div key={level.nivel} className={styles.levelBlock} style={{ '--level-color': level.color } as React.CSSProperties}>
              <button
                className={styles.levelHeader}
                onClick={() => setExpanded(isOpen ? null : level.nivel)}
              >
                <span className={styles.levelEmoji}>{level.emoji}</span>
                <span className={styles.levelName}>{level.nivel}</span>
                <span className={styles.levelPct}>{completed}/{level.quizzes.length}</span>
                <span className={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
              </button>

              <div className={styles.levelBar}>
                <div className={styles.levelFill} style={{ width: `${pct}%` }} />
              </div>

              {isOpen && (
                <ul className={styles.quizList}>
                  {level.quizzes.map(q => {
                    const r = results[q.key];
                    return (
                      <li key={q.key} className={styles.quizItem}>
                        <span
                          className={`${styles.dot} ${r ? scoreClass(r.score, r.total) : styles.dotEmpty}`}
                        />
                        <span className={styles.quizLabel}>{q.label}</span>
                        {r && (
                          <span className={styles.quizScore}>
                            {r.score}/{r.total} ({Math.round((r.score / r.total) * 100)}%)
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {totalCompleted === 0 && (
        <p className={styles.emptyHint}>
          Completa los mini-quizzes en cada documento para ver tu progreso aquí.
        </p>
      )}
    </div>
  );
}
