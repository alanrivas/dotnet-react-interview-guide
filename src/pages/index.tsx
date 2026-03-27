import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          🚀 {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs">
            📚 Comenzar la Guía →
          </Link>
        </div>
      </div>
    </header>
  );
}

function NivelesSection() {
  const niveles = [
    {
      emoji: '🟢',
      titulo: 'Junior',
      subtitulo: '0 - 2 años',
      temas: ['C# Fundamentos', 'POO', '.NET Básico', 'SQL Básico', 'React Básico', 'HTML & CSS', 'Git'],
      link: '/docs/junior/csharp-fundamentos',
      color: 'var(--level-junior-color)',
    },
    {
      emoji: '🟡',
      titulo: 'Semi-Senior',
      subtitulo: '2 - 5 años',
      temas: ['C# Avanzado', 'ASP.NET Core', 'Entity Framework', 'APIs REST', 'React Avanzado', 'Testing', 'Patrones de Diseño', 'SQL Avanzado'],
      link: '/docs/semi-senior/csharp-avanzado',
      color: 'var(--level-semi-color)',
    },
    {
      emoji: '🔴',
      titulo: 'Senior',
      subtitulo: '5+ años',
      temas: ['Arquitectura', 'Clean Architecture & DDD', 'Microservicios', 'Performance', 'Seguridad', 'DevOps & CI/CD', 'System Design', 'Liderazgo Técnico'],
      link: '/docs/senior/arquitectura',
      color: 'var(--level-senior-color)',
    },
  ];

  return (
    <section style={{padding: '3rem 0', background: 'var(--ifm-background-color)'}}>
      <div className="container">
        <h2 style={{textAlign: 'center', marginBottom: '2rem', fontSize: '2rem'}}>
          Elige tu nivel
        </h2>
        <div className="row">
          {niveles.map((nivel) => (
            <div key={nivel.titulo} className="col col--4">
              <div className="card shadow--md" style={{height: '100%', marginBottom: '1rem'}}>
                <div className="card__header" style={{borderLeft: `4px solid ${nivel.color}`}}>
                  <h3>{nivel.emoji} {nivel.titulo}</h3>
                  <p style={{color: 'var(--ifm-color-emphasis-600)', margin: 0}}>{nivel.subtitulo}</p>
                </div>
                <div className="card__body">
                  <ul style={{paddingLeft: '1.2rem'}}>
                    {nivel.temas.map(tema => (
                      <li key={tema} style={{marginBottom: '0.3rem'}}>{tema}</li>
                    ))}
                  </ul>
                </div>
                <div className="card__footer">
                  <Link className="button button--primary button--block" to={nivel.link}>
                    Estudiar nivel {nivel.titulo} →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Guía completa de preparación para entrevistas Full Stack .NET + React">
      <HomepageHeader />
      <main>
        <NivelesSection />
      </main>
    </Layout>
  );
}
