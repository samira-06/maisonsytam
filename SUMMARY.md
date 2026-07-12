# Maison SYTAM — Summary

## Goal
Hijab e-commerce SPA **maisonsytam.com** — admin, orders, products, stock, analytics, notifications, delivery zones — sync via GitHub API

## Progress

### Done
- **GitHub sync implémentée** : admin peut push produits & commandes → GitHub (`data/products.json`, `data/orders.json`) via l'API GitHub
- **Champ Token GitHub** dans Paramètres (sauvegardé en localStorage admin)
- **Produits lus depuis GitHub Pages** côté client : `main.js` fetch `data/products.json?v=...`
- **Toutes les références Supabase supprimées** du code (aucun appel Supabase restant)
- **Fichiers supabase-config.js/supabase-loader.js supprimés**
- **data/products.json créé** avec produits initiaux (seed + date)
- **Page compte client** redesignée avec grille de cartes
- **Toggle "Disponible en tailles"** dans formulaire produit admin
- **DNS actif** : site en ligne sur **maisonsytam.com** (GitHub Pages)

### In Progress
- **(aucun)** — sync GitHub opérationnelle, site en ligne

## Architecture
- **Données** : localStorage (toujours) + GitHub API (sync)
- **Flux produits** : admin modifie → push GitHub → client fetch depuis GitHub Pages
- **Flux commandes** : client commande → localStorage → admin push GitHub (si token présent)
- **Token** : stocké uniquement en localStorage admin, jamais exposé client

## Key Files
- `js/github-sync.js` — API GitHub (get/push products & orders)
- `js/admin.js` — `_syncProductsToGitHub()`, `_syncProductsFromGitHub()`, `_syncOrdersToGitHub()`
- `data/products.json` — produits synchronisés (créé initial, mis à jour par admin)
- `js/main.js` — fetch produits depuis `data/products.json` côté client

## Credentials
- Admin: `mansourbadiya.html`, password `admin123`
