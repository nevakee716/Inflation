# Inflation en France

Dashboard de l'indice des prix à la consommation (IPC) de l'INSEE, poste par poste, avec des pondérations
ajustables pour voir l'inflation de son propre panier.

Stack : [TanStack Start](https://tanstack.com/start) (pré-rendu statique), [TanStack Charts](https://tanstack.com/charts),
shadcn/ui, Tailwind CSS v4.

## Démarrer

```sh
pnpm install
pnpm dev
pnpm build      # site statique dans dist/client
```

## Données

Le dashboard lit `data/insee/ipc.json`, produit et mis à jour par le bot de collecte INSEE. Tant que ce fichier
n'existe pas, il affiche `data/insee/ipc.demo.json` : des séries **synthétiques** (`pnpm data:demo` pour les
régénérer), signalées par un bandeau sur la page.

Format attendu (voir `src/lib/ipc.ts`) :

```jsonc
{
  "source": "INSEE BDM",
  "fetchedAt": "2026-10-29T08:00:00Z",
  "base": "2015=100",
  "series": [
    {
      "key": "01",            // code COICOP, "00" = ensemble
      "idbank": "0017xxxxx",
      "label": "Produits alimentaires et boissons non alcoolisées",
      "level": 1,             // 0 = ensemble, 1 = division, 2 = groupe
      "parent": "00",
      "weight": 1560,         // pondération pour 10 000, ou null
      "observations": [{ "date": "2024-01", "value": 118.52 }]
    }
  ]
}
```

## Calculs

- **Inflation sur un an** : glissement annuel de l'indice, `I(t) / I(t-12) - 1`.
- **Avec tes pondérations** : moyenne des glissements annuels des divisions (niveau 1), pondérée par les poids
  choisis. Avec les pondérations INSEE, elle approche l'indice officiel sans le reproduire exactement.
- **Hausse cumulée** : officielle d'après l'indice d'ensemble ; pour ton panier, indice chaîné mois par mois avec
  tes pondérations.
- **Contributions** : poids normalisé × glissement annuel de chaque division, en points.

## Déploiement

`.github/workflows/deploy.yml` construit et publie le site sur GitHub Pages à chaque push sur `main`, et après
chaque exécution réussie du workflow « Update INSEE data ». Dans les réglages du dépôt, *Pages → Source* doit
être sur **GitHub Actions**.
