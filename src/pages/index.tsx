import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './index.module.css';

// ─── Data ──────────────────────────────────────────────────

const stats = [
  { value: '90+',  label: 'Documentos técnicos' },
  { value: '3',    label: 'Niveles de estudio'  },
  { value: '200+', label: 'Preguntas reales'    },
  { value: 'Quiz', label: 'Interactivos'        },
];

const niveles = [
  {
    emoji: '🟢',
    titulo: 'Junior',
    subtitulo: '0 – 2 años de experiencia',
    docs: '20 docs',
    horas: '~60h',
    temas: ['C# Fundamentos', 'POO', '.NET & LINQ', 'SQL Básico', 'React Básico', 'JavaScript & TS', 'HTML & CSS', 'Git', 'HTTP & REST'],
    link: '/docs/junior',
    color: 'var(--level-junior-color)',
  },
  {
    emoji: '🟡',
    titulo: 'Semi-Senior',
    subtitulo: '2 – 5 años de experiencia',
    docs: '27 docs',
    horas: '~95h',
    temas: ['C# Avanzado', 'ASP.NET Core', 'Entity Framework', 'APIs REST', 'React Avanzado', 'Testing', 'Patrones SOLID', 'SQL Avanzado', 'Docker', 'Redis'],
    link: '/docs/semi-senior',
    color: 'var(--level-semi-color)',
  },
  {
    emoji: '🔴',
    titulo: 'Senior',
    subtitulo: '5+ años de experiencia',
    docs: '48 docs',
    horas: '~115h',
    temas: ['Arquitectura', 'Clean Architecture & DDD', 'Microservicios', 'System Design', 'Performance', 'Seguridad', 'DevOps & K8s', 'Liderazgo Técnico'],
    link: '/docs/senior',
    color: 'var(--level-senior-color)',
  },
];

const recursos = [
  {
    emoji: '📖',
    titulo: 'Glosario Técnico',
    desc: '60+ términos clave explicados en 1-2 oraciones, listos para usar en entrevista.',
    link: '/docs/glosario',
    color: '#8b5cf6',
  },
  {
    emoji: '⚖️',
    titulo: 'Comparativas',
    desc: '20+ tablas "¿cuándo usar X vs Y?" con trade-offs claros para cada decisión técnica.',
    link: '/docs/comparativas',
    color: '#3b82f6',
  },
  {
    emoji: '📚',
    titulo: 'Recursos Recomendados',
    desc: 'Libros, cursos y canales por nivel, con planes de estudio de 2 y 6 semanas.',
    link: '/docs/recursos',
    color: '#10b981',
  },
  {
    emoji: '🎭',
    titulo: 'Método STAR',
    desc: 'Framework para responder preguntas conductuales con ejemplos completos por nivel.',
    link: '/docs/comportamiento-star',
    color: '#f59e0b',
  },
];

// ─── Components ────────────────────────────────────────────

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={styles.heroBanner}>
      <div className="container">
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>Guía de Entrevistas Técnicas</div>
          <Heading as="h1" className={styles.heroTitle}>
            {siteConfig.title}
          </Heading>
          <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
          <div className={styles.stackBadges}>
            {['.NET 8', 'C# 12', 'ASP.NET Core', 'React 18', 'TypeScript', 'SQL Server'].map(b => (
              <span key={b} className={styles.stackBadge}>{b}</span>
            ))}
          </div>
          <div className={styles.heroButtons}>
            <Link className={clsx('button button--lg', styles.btnPrimary)} to="/docs/junior">
              📚 Comenzar por nivel
            </Link>
            <Link className={clsx('button button--lg', styles.btnSecondary)} to="/docs/comportamiento-star">
              🎯 Preparar entrevista
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

function StatsBar() {
  return (
    <div className={styles.statsBar}>
      <div className="container">
        <div className={styles.statsGrid}>
          {stats.map((s, i) => (
            <div key={i} className={styles.statItem}>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NivelesSection() {
  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <Heading as="h2">🎯 Elige tu nivel</Heading>
          <p>Contenido diseñado para cada etapa de tu carrera como Full Stack Developer</p>
        </div>
        <div className={styles.levelsGrid}>
          {niveles.map((n) => (
            <div
              key={n.titulo}
              className={styles.levelCard}
              style={{'--card-color': n.color} as React.CSSProperties}
            >
              <div className={styles.levelIcon} style={{'--card-color': n.color} as React.CSSProperties}>
                {n.emoji}
              </div>
              <h3 className={styles.levelTitle}>{n.titulo}</h3>
              <p className={styles.levelYears}>{n.subtitulo}</p>
              <div className={styles.levelMeta}>
                <span className={styles.levelMetaBadge} style={{'--card-color': n.color} as React.CSSProperties}>
                  {n.docs}
                </span>
                <span className={styles.levelMetaBadge} style={{'--card-color': n.color} as React.CSSProperties}>
                  {n.horas}
                </span>
              </div>
              <div className={styles.levelTopics}>
                {n.temas.map(t => (
                  <span key={t} className={styles.levelTopic}>{t}</span>
                ))}
              </div>
              <Link
                to={n.link}
                className={styles.levelCta}
                style={{'--card-color': n.color} as React.CSSProperties}
              >
                Estudiar nivel {n.titulo} →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RecursosSection() {
  return (
    <section className={clsx(styles.section, styles.sectionAlt)}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <Heading as="h2">🗂️ Recursos transversales</Heading>
          <p>Referencia rápida que complementa el estudio de cualquier nivel</p>
        </div>
        <div className={styles.resourceGrid}>
          {recursos.map((r, i) => (
            <Link
              key={i}
              to={r.link}
              className={styles.resourceCard}
              style={{'--card-color': r.color} as React.CSSProperties}
            >
              <div className={styles.resourceEmoji} style={{'--card-color': r.color} as React.CSSProperties}>
                {r.emoji}
              </div>
              <h3 className={styles.resourceTitle}>{r.titulo}</h3>
              <p className={styles.resourceDesc}>{r.desc}</p>
              <span className={styles.resourceLink} style={{color: r.color}}>
                Ver {r.titulo} →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function PathSection() {
  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.pathSection}>
          <div className={styles.pathText}>
            <Heading as="h2">🚀 ¿Cómo usar esta guía?</Heading>
            <p>
              Elige tu nivel, estudia los temas con ejemplos de código real,
              practica con los ejercicios de live coding y mide tu progreso
              con los simulacros interactivos.
            </p>
            <Link className={clsx('button button--lg', styles.btnPrimary)} to="/docs/junior">
              Empezar ahora →
            </Link>
          </div>
          <div className={styles.pathCode}>
            <pre className={styles.codeBlock}>{`1. Elige nivel  →  🟢 Junior / 🟡 Semi-Senior / 🔴 Senior

2. Estudia       →  Teoría + código + ejemplos reales

3. Practica      →  Live Coding · Banco de Preguntas

4. Simula        →  Simulacro completo con Quiz interactivo

5. Repasa        →  Glosario · Comparativas · Método STAR

¡Listo para la entrevista! 🎯`}</pre>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Page ──────────────────────────────────────────────────

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Guía completa de preparación para entrevistas Full Stack .NET + React — Junior, Semi-Senior y Senior">
      <HomepageHeader />
      <StatsBar />
      <main>
        <NivelesSection />
        <RecursosSection />
        <PathSection />
      </main>
    </Layout>
  );
}
