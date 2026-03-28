# Guía de contribución

## Requisitos previos

- Node.js >= 20
- npm >= 10
- Git

## Setup local

```bash
git clone https://github.com/alanrivas/dotnet-react-interview-guide.git
cd dotnet-react-interview-guide
npm install
npm start
```

El sitio queda disponible en `http://localhost:3000`.

## Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `npm start` | Servidor de desarrollo con hot reload |
| `npm run build` | Build de producción en `/build` |
| `npm run typecheck` | Verificación de tipos TypeScript |
| `npm run lint` | Linting con ESLint |
| `npm run lint:fix` | Corregir errores de lint automáticamente |
| `npm run format` | Formatear código con Prettier |
| `npm run validate` | typecheck + lint + build (antes de un PR) |

## Estructura del proyecto

```
docs/           Contenido en Markdown/MDX organizado por nivel
  junior/       0-2 años de experiencia
  semi-senior/  2-5 años de experiencia
  senior/       5+ años (incluye subdirectorios por área)
src/
  components/   Componentes React reutilizables (Quiz, etc.)
  data/         Datos estáticos (homepage.ts)
  pages/        Páginas de Docusaurus (index.tsx)
  css/          Estilos globales y variables CSS
static/         Archivos estáticos (imágenes, CNAME)
```

## Agregar contenido

1. Crea un archivo `.md` o `.mdx` en la carpeta del nivel correspondiente (`docs/junior/`, `docs/semi-senior/`, `docs/senior/`).
2. Agrega el frontmatter:

```markdown
---
id: mi-tema
title: Mi Tema
sidebar_position: 10
---
```

3. Si el archivo usa el componente `Quiz`, usa extensión `.mdx`:

```mdx
import Quiz from '@site/src/components/Quiz';

<Quiz
  question="¿Qué hace X?"
  options={['Opción A', 'Opción B', 'Opción C']}
  correctIndex={1}
  explanations={['Por esto A está mal', 'Correcto porque...', 'Por esto C está mal']}
/>
```

## Deployment

El sitio se despliega automáticamente a [dotnet-react-interview-guide.alanrivas.me](https://dotnet-react-interview-guide.alanrivas.me) con cada push a `main` via GitHub Actions.
