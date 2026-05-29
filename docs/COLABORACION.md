# Trabajar en equipo (Git + Vercel)

## Flujo recomendado

1. Crear rama: `git checkout -b feature/nombre-del-cambio`
2. Hacer cambios y commit.
3. `git push -u origin feature/nombre-del-cambio`
4. Abrir **Pull Request** en GitHub hacia `main`.
5. Revisar que el build de Vercel en el PR sea verde (Preview).
6. Merge a `main` → deploy automático a https://fast-table.vercel.app

Evita pushear directo a `main` si dos personas editan a la vez.

## Qué carpeta toca cada cosa

| Cambio | Carpeta |
|--------|---------|
| Landing pública | `host/site/` |
| App (comensal, login, tabs) | `app/`, `components/` |
| Personal en web | `app/worker/`, `components/web/` |
| Auth en correos (páginas estáticas) | `host/site/auth/` |
| Despliegue / build del host | `host/scripts/`, `vercel.json` (raíz) |

## No subir al repo

- `.env` (cada quien el suyo local)
- `host/dist/` (se genera en Vercel con `npm run build:host`)

## Antes de mergear un rediseño grande

En tu PC:

```bash
npm run build:host
```

Si termina sin error, Vercel también debería desplegar bien.

## Conflictos frecuentes

- Mismo archivo en `app/` y `host/site/` → coordinar quién edita qué.
- No borrar `vercel.json` ni `host/` sin revisar con el equipo.
