# openkmt.org

Le site de la fondation KMT · *Le logiciel libre africain.*

- `public/` : le site statique (une seule page HTML, CSS et JS en ligne, sans framework ni build).
- `functions/api/contribute.js` : fonction Cloudflare qui reçoit le formulaire « Contribuer » et le transmet sur Telegram (secrets Pages `TG_TOKEN`, `TG_CHAT`).
- Déploiement : chaque push sur `main` publie sur openkmt.org ; chaque pull request obtient une URL de prévisualisation.

## Travailler en local

```bash
npx wrangler@4 pages dev public
```

## Règles de marque
Palette Noir #16130F · Papyrus #F4EEE3 · Or #C9993B · Nil #2E5A5C · Sable #D8CFBD. Polices Space Grotesk + Manrope, aucune serif. Le signe et l'alphabet vivent dans [openkmt/brand](https://github.com/openkmt/brand).

## Licence
Code sous licence MIT. Le nom KMT et le signe sont des marques de la fondation : voir [openkmt/brand](https://github.com/openkmt/brand).
