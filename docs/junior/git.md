---
id: git
title: Git - Control de Versiones
sidebar_position: 7
---

# Git — Control de Versiones 🟢

## Comandos esenciales

```bash
# Configuración inicial
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"

# Iniciar repositorio
git init
git clone https://github.com/usuario/repo.git

# Estado y cambios
git status
git diff
git diff --staged  # cambios en staging area

# Staging y commits
git add archivo.cs          # archivo específico
git add .                   # todos los cambios
git commit -m "feat: agregar login de usuarios"

# Historial
git log --oneline --graph
git show <commit-hash>
```

---

## Flujo de trabajo con ramas

```bash
# Crear y cambiar de rama
git branch feature/login
git checkout feature/login
git checkout -b feature/login  # crear y cambiar en un comando

# Listar ramas
git branch          # locales
git branch -r       # remotas
git branch -a       # todas

# Merge
git checkout main
git merge feature/login

# Rebase (historial más limpio)
git checkout feature/login
git rebase main

# Eliminar rama
git branch -d feature/login       # solo si está mergeada
git branch -D feature/login       # forzar eliminación
```

---

## Trabajar con remoto

```bash
# Ver remotos
git remote -v

# Agregar remoto
git remote add origin https://github.com/user/repo.git

# Push y pull
git push origin feature/login
git pull origin main

# Fetch (descarga sin mergear)
git fetch origin

# Push con tracking
git push -u origin feature/login  # establece upstream
```

---

## Deshacer cambios

```bash
# Deshacer cambios no commiteados
git restore archivo.cs          # descarta cambios en working directory
git restore --staged archivo.cs # quita del staging area

# Amend (modificar último commit)
git commit --amend -m "nuevo mensaje"
git commit --amend --no-edit  # mismo mensaje, agregar cambios

# Revert (crea un commit que deshace otro — seguro para compartir)
git revert <commit-hash>

# Reset (CUIDADO: modifica el historial)
git reset --soft HEAD~1   # deshace commit, mantiene cambios en staging
git reset --mixed HEAD~1  # deshace commit, mantiene cambios en working dir
git reset --hard HEAD~1   # deshace commit Y descarta cambios (DESTRUCTIVO)
```

:::danger Regla importante
**Nunca uses `git reset --hard` o `git push --force` en ramas compartidas** (como `main` o `develop`). Puede destruir el trabajo de otros.
:::

---

## Git Flow — Estrategia de ramas

```
main          ─────●─────────────────●──────────────● (producción)
                   │                 │
develop       ─────●──●──●──●──●──●──●──●──         (integración)
                      │        │
feature       ────────●────────●                    (feature/login)
                               │
hotfix        ─────────────────●──●──               (hotfix/bug-critico)
```

**Ramas principales:**
- `main` / `master`: código en producción
- `develop`: integración de features

**Ramas de soporte:**
- `feature/*`: nuevas funcionalidades
- `hotfix/*`: correcciones urgentes en producción
- `release/*`: preparación de releases

---

## Conventional Commits

Formato estándar para mensajes de commit:

```
<tipo>(<scope>): <descripción>

[cuerpo opcional]

[footer opcional]
```

**Tipos:**
| Tipo | Uso |
|------|-----|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Documentación |
| `style` | Formato (no lógica) |
| `refactor` | Refactoring |
| `test` | Tests |
| `chore` | Tareas de mantenimiento |

```bash
git commit -m "feat(auth): agregar autenticación con JWT"
git commit -m "fix(api): corregir validación de email en registro"
git commit -m "docs: actualizar README con instrucciones de setup"
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre merge y rebase?**
> **Merge**: combina dos ramas creando un nuevo commit de merge. Preserva el historial completo. **Rebase**: mueve los commits de tu rama al final de otra, como si siempre hubieran partido de ahí. Historial más lineal pero modifica el historial (peligroso en ramas compartidas).

**2. ¿Qué es un pull request (PR)?**
> Una solicitud para integrar cambios de una rama a otra. Permite revisión de código, discusión y aprobación antes de hacer merge. También se llama "Merge Request" en GitLab.

**3. ¿Cómo resolverías un conflicto de merge?**
> 1. `git merge` o `git pull` genera conflictos
> 2. `git status` muestra los archivos conflictivos
> 3. Edito los archivos y elijo qué cambios conservar
> 4. `git add <archivo>` para marcar como resuelto
> 5. `git commit` para completar el merge

**4. ¿Qué es `.gitignore`?**
> Un archivo que lista patrones de archivos/directorios que Git debe ignorar (no trackear). Común ignorar: `node_modules/`, `bin/`, `obj/`, `.env`, `*.user`.
