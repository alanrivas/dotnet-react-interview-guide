export interface Stat {
  value: string;
  label: string;
}

export interface Nivel {
  emoji: string;
  titulo: string;
  subtitulo: string;
  docs: string;
  horas: string;
  temas: string[];
  link: string;
  color: string;
}

export interface Recurso {
  emoji: string;
  titulo: string;
  desc: string;
  link: string;
  color: string;
}

export const stats: Stat[] = [
  { value: '90+', label: 'Documentos técnicos' },
  { value: '3', label: 'Niveles de estudio' },
  { value: '200+', label: 'Preguntas reales' },
  { value: 'Quiz', label: 'Interactivos' },
];

export const niveles: Nivel[] = [
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

export const recursos: Recurso[] = [
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
