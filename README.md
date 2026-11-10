# Ziko — API de boutique

API réalisée pour le test back-end d'Angelot Mpata : produits, commandes et paiements idempotents. Stack demandée : **Node.js + TypeScript + PostgreSQL**, avec Express 5.

Le dossier `frontend/` contient une interface de présentation en **React, Vite et CSS** connectée à cette API.

- **Application publique (frontend)** : [Ouvrir la boutique Ziko](https://ziko-test-technique.angelotmpata.net).
- **Dépôt GitHub public** : [DevAngelot/ziko-test-technique](https://github.com/DevAngelot/ziko-test-technique).
- **État de l’API et de PostgreSQL** : [Vérifier le service](https://ziko-test-technique.angelotmpata.net/api/health).

L’interface utilise la véritable API et PostgreSQL. Elle sert de démonstration au test backend ; les paiements restent simulés, sans débit Mobile Money réel. Une commande contient un seul produit, conformément au sujet. L’authentification et le panier multi-produits sont des évolutions possibles, pas des fonctionnalités déjà présentes.

## Démarrer sur son ordinateur

Récupérer le projet avec Git, puis se placer à sa racine :

```sh
git clone https://github.com/DevAngelot/ziko-test-technique.git
cd ziko-test-technique
```

Choisir ensuite le démarrage avec Docker ou l’installation manuelle ci-dessous. Le dépôt contient les deux applications ; le README commun explique leur lancement.

### Avec Docker

Installer Docker avec Docker Compose, puis, à la racine du dépôt :

```sh
docker compose up --build
```

Interface : `http://localhost:5173`. API : `http://localhost:3000`. Vérification : `GET /health`. PostgreSQL démarre, puis les tables sont créées automatiquement. Le volume `ziko_data` conserve les données. Pour arrêter : `docker compose down`.

La configuration Compose utilise des identifiants fictifs réservés à la démonstration locale. Elle n'utilise pas le fichier `.env` personnel et n'expose pas le port PostgreSQL à l'hôte.

### Sans Docker

Prérequis : Node.js 24, npm et PostgreSQL 17 ou compatible. Créer une base et un utilisateur disposant du droit de créer un schéma dans cette base. Par exemple, avec un compte administrateur PostgreSQL et une installation neuve :

```sql
CREATE USER ziko WITH PASSWORD 'local_demo_password';
CREATE DATABASE ziko OWNER ziko;
```

Ensuite :

```sh
cd backend
npm ci
```

Copier `.env.example` vers `.env` **seulement si `.env` n'existe pas déjà**, puis renseigner `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. Sous PowerShell : `Copy-Item .env.example .env`. Sous macOS/Linux : `cp .env.example .env`.

```sh
npm run migrate
npm run dev
```

Le serveur écoute le `PORT` du `.env` (3000 dans l'exemple). Les URL de cette documentation utilisent 3000 : les adapter si nécessaire. Ne jamais publier `.env`.

Pour exécuter la version compilée :

```sh
npm run build
npm start
```

### Lancer l’interface sans Docker

Garder le backend démarré et ouvrir un second terminal, depuis la racine :

```sh
cd frontend
npm ci
npm run dev
```

Ouvrir `http://localhost:5173`. Vite transmet les appels `/api` au backend, en lisant uniquement son port depuis `backend/.env`. Les identifiants PostgreSQL ne sont pas exposés au navigateur. Aucun fichier `.env` supplémentaire n’est nécessaire pour le frontend. Sous PowerShell, utiliser `npm.cmd` si `npm.ps1` est bloqué.

Pour vérifier la version de production : `npm run build`, puis `npm run preview` depuis `frontend`. Le backend doit rester démarré. Avec Docker, Nginx sert l’interface et transmet les appels à l’API.

### Parcours de présentation

La sidebar sépare les opérations en cinq pages : **Créer un produit**, **Liste des produits**, **Passer une commande**, **Payer une commande** et **Commandes**. Sélectionner un produit dans la liste ouvre la création de commande ; une commande créée ouvre la page de paiement. Chaque menu est accessible directement et reste accessible après rechargement.

Le menu **Commandes** affiche la liste depuis PostgreSQL, de la plus récente à la plus ancienne. Filtrer par statut, puis cliquer sur une commande pour consulter son produit, sa quantité, ses montants, ses dates et son paiement. Depuis les détails, un bouton permet de payer une commande en attente ou de tester le rejeu d’une commande payée.

1. Ajouter un produit, par exemple Café, prix 2 500 CDF, stock 10.
2. Sélectionner ce produit et créer une commande de quantité 2 : statut « En attente », stock toujours à 10.
3. Confirmer le paiement avec l’identifiant proposé : statut « Payée », stock à 8.
4. Cliquer sur « Rejouer le même paiement » : confirmation du rejeu, stock toujours à 8.
5. Envoyer un autre identifiant sur la commande payée pour montrer le refus du second paiement.

Le premier paiement réussi apparaît en vert. Un rejeu apparaît en rouge avec « Double paiement bloqué » : le paiement initial reste valide, sans nouveau décompte. L’API conserve sa réponse idempotente `200` avec `replayed: true`. Les refus (stock insuffisant, paiement déjà utilisé, commande introuvable) et les données invalides s’affichent également en rouge, avec une explication et les corrections possibles.

Le formulaire de consultation récupère une commande par son UUID, y compris après rechargement de la page. Pour présenter le stock insuffisant, demander une quantité supérieure au stock : l’API renvoie son message d’erreur. Les nombres entiers, bornes et champs obligatoires sont vérifiés dans les formulaires et dans le backend. L’interface ne crée aucune donnée automatiquement.

## API

Toutes les requêtes d'écriture utilisent `Content-Type: application/json`.

Les chemins ci-dessous sont relatifs à l’API : utiliser `http://localhost:3000` en local, ou `https://ziko-test-technique.angelotmpata.net/api` pour la version en ligne. Par exemple, la liste publique des produits est accessible à `/api/products` sur le domaine de l’application.

| Méthode | Chemin                      | Corps                                       | Résultat                                        |
| ------- | --------------------------- | ------------------------------------------- | ----------------------------------------------- |
| POST    | `/products`                 | `{"name":"Café","price":2500,"stock":10}`   | 201, produit créé                               |
| GET     | `/products`                 | —                                           | 200, liste des produits                         |
| POST    | `/orders`                   | `{"productId":"UUID_PRODUIT","quantity":2}` | 201, commande `pending`                         |
| POST    | `/orders/UUID_COMMANDE/pay` | `{"paymentId":"MM-001"}`                    | 200, commande `paid`                            |
| GET     | `/orders/UUID_COMMANDE`     | —                                           | 200, commande et statut                         |
| GET     | `/orders`                   | —                                           | 200, liste des commandes avec produit et statut |
| GET     | `/health`                   | —                                           | 200 si PostgreSQL répond                        |

Les prix sont en francs congolais (CDF), sans décimales. Prix et quantité : entiers de 1 à 2 147 483 647. Stock : entier de 0 à 2 147 483 647. Le prix strictement positif est un choix métier de cet exercice. Le nom contient de 1 à 200 caractères après retrait des espaces autour. `paymentId` contient de 1 à 100 caractères : lettres ASCII, chiffres, tirets ou underscores ; sa casse est significative. Les champs inconnus et les chaînes à la place de nombres sont refusés.

Une commande conserve `unitPrice`, le prix au moment de sa création. `totalPrice` est une **chaîne décimale entière** calculée par PostgreSQL, pour rester exact même au-delà de la précision entière de JavaScript. Exemple : `"5000"`.

Premier paiement :

```json
{
  "order": { "id": "…", "status": "paid", "paymentId": "MM-001" },
  "replayed": false,
  "message": "Paiement enregistré. Stock diminué une seule fois."
}
```

Le champ `order` contient aussi le produit, la quantité, les prix et les dates. Un appel répété avec le même identifiant renvoie 200, la même commande et `replayed: true`. Cela permet au client de savoir que le premier appel a réussi malgré une éventuelle coupure réseau.

| Situation                                       | HTTP | Code                                    |
| ----------------------------------------------- | ---- | --------------------------------------- |
| Données invalides                               | 400  | `VALIDATION_ERROR`                      |
| JSON mal formé                                  | 400  | `INVALID_JSON`                          |
| Produit ou commande absent                      | 404  | `PRODUCT_NOT_FOUND` / `ORDER_NOT_FOUND` |
| Stock insuffisant, à la création ou au paiement | 409  | `INSUFFICIENT_STOCK`                    |
| Commande payée, autre identifiant présenté      | 409  | `ORDER_ALREADY_PAID`                    |
| Identifiant utilisé pour une autre commande     | 409  | `PAYMENT_ID_ALREADY_USED`               |
| Corps supérieur à 16 ko                         | 413  | `PAYLOAD_TOO_LARGE`                     |

Exemple d'erreur : `{"error":{"code":"INSUFFICIENT_STOCK","message":"Stock insuffisant pour cette commande."}}`.

## Pourquoi cette protection contre le double paiement ?

Le paiement s'exécute dans une transaction PostgreSQL, sur une seule connexion :

1. `BEGIN`, puis lecture de la commande avec `FOR UPDATE`. Deux paiements de la même commande sont ainsi traités l'un après l'autre.
2. Si elle est déjà payée, renvoyer un succès de rejeu ou un conflit selon l'identifiant, sans modifier le stock.
3. Enregistrer le statut payé et l'identifiant. Une contrainte `UNIQUE` interdit l'utilisation du même identifiant sur deux commandes, y compris simultanément.
4. Diminuer le stock avec `UPDATE … WHERE stock >= quantité`. PostgreSQL protège cette modification concurrente ; le stock ne peut pas devenir négatif.
5. `COMMIT` si tout réussit. Sinon `ROLLBACK` annule aussi le statut et l'identifiant de paiement.

La création de commande ne réserve pas le stock : le sujet demande sa diminution au paiement. Le stock est donc revérifié au paiement. Deux commandes en attente peuvent viser le dernier article, mais une seule pourra être payée.

Le serveur **ne contacte aucun opérateur Mobile Money et ne débite aucun compte réel**. L'identifiant reçu simule une confirmation d'opérateur. La garantie porte sur l'enregistrement du paiement et le décompte de stock dans cette base. Un vrai débit externe demanderait aussi l'idempotence de l'opérateur et des notifications vérifiées.

Références : [verrous PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html), [gestion des erreurs asynchrones Express 5](https://expressjs.com/en/5x/guide/error-handling/).

## Organisation et choix

```text
backend/src/
  Config/         environnement et pool PostgreSQL
  Routes/         chemins HTTP des produits et commandes
  Controllers/    validation des requetes et reponses HTTP
  Services/       regles metier et transactions
  Models/         types des donnees et requetes SQL avec pg
  Database/       schema SQL et migration
  Validators/     schemas Zod
  Middlewares/    gestion centralisee des erreurs
  Errors/         erreurs metier
  app.ts          assemblage Express et injection du pool
  server.ts       demarrage et arret du serveur
```

- TypeScript : respecter le sujet et détecter des erreurs de programmation avant l'exécution. Zod reste nécessaire pour les données reçues à l'exécution.
- Express : peu de configuration pour cinq opérations, avec transmission automatique des erreurs des routes asynchrones au gestionnaire central.
- SQL avec `pg` : transactions, contraintes et verrous visibles, faciles à expliquer ; pas d'ORM nécessaire ici.
- Paramètres `$1`, `$2` : les valeurs utilisateur ne sont jamais concaténées au SQL.
- UUID : identifiants générés côté serveur, sans extension PostgreSQL supplémentaire.
- Schéma `ziko` : tables isolées des éventuelles autres tables de la base.
- Une commande contient un seul produit, conformément au sujet. Pas d’authentification ni de panier multiple. L’interface React facilite la présentation des opérations de l’API.

## Tests et démonstration

Pour formater le projet avec Prettier, depuis `backend` : `npm run format`.
Pour vérifier le formatage sans modifier les fichiers : `npm run format:check`.
Dans VS Code, installer l'extension recommandée **Prettier - Code formatter** ;
le formatage à l'enregistrement est configuré pour ce projet. Le `.env`, les
dépendances et les fichiers compilés sont exclus du formatage.

Depuis `backend`, avec une connexion PostgreSQL valide :

```sh
npm run build
npm test
```

Les onze tests d'intégration utilisent un **vrai PostgreSQL**, sans simulation de ses verrous. Ils couvrent le parcours nominal, vingt paiements identiques simultanés, deux paiements différents sur une commande, l'unicité entre commandes, la concurrence sur le dernier stock, le rollback et une nouvelle tentative, les données invalides, les absences, les contraintes SQL et les grands montants.

Les tests créent leurs propres produits et suppriment uniquement les données qu'ils ont créées. Une base dédiée est recommandée ; la CI GitHub utilise `ziko_test`. Aucune commande `TRUNCATE` n'est utilisée. Si le processus est interrompu brutalement, des données de test peuvent rester.

Pour une démonstration complète, démarrer l'API puis ouvrir un second terminal :

```sh
cd backend
npm run demo
```

Le script utilise `PORT` du `.env`, sauf si `API_URL` est fourni. Il affiche les requêtes/réponses et vérifie que le stock final est 8. Il conserve le produit et la commande de démonstration pour pouvoir les consulter. Pour ralentir l'affichage sous PowerShell : `$env:DEMO_PAUSE_MS='10000'`, puis `npm run demo`.

Un fichier [requests.http](backend/requests.http) permet aussi une exécution manuelle avec un client HTTP compatible.

## Avec davantage de temps

Le périmètre actuel privilégie les cinq opérations demandées et la protection contre le double paiement. Pour transformer cette démonstration en application de boutique, les évolutions seraient introduites progressivement, avec des tests à chaque étape. Les éléments ci-dessous sont **à développer**, sauf lorsqu’un mécanisme existant est explicitement mentionné.

### Priorité 1 : protéger les comptes et fiabiliser l’exploitation

| Évolution                                 | Comportement attendu et raison                                                                                                                                                                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comptes clients et connexion              | Inscription, connexion, déconnexion et récupération de compte. Stocker uniquement des mots de passe hachés et protéger les sessions. Un client retrouve ses commandes après connexion.                                                          |
| Droits administrateur et client           | Réserver la création et la gestion des produits à l’administrateur. Vérifier côté API qu’un client peut consulter et payer uniquement ses propres commandes ; masquer un bouton dans React ne suffit pas.                                       |
| Protection des accès et suivi des erreurs | Limiter les tentatives de connexion et les appels excessifs. Ajouter des logs structurés avec un identifiant de requête et des alertes de disponibilité, sans enregistrer de secrets. Cela facilite le diagnostic d’un paiement ou d’une panne. |
| Sauvegardes et évolution de la base       | Programmer des sauvegardes PostgreSQL, conserver une copie hors du VPS et tester leur restauration. Ajouter des migrations versionnées et séparer les droits du compte de migration de ceux de l’application.                                   |

HTTPS, le reverse proxy Nginx et le redémarrage du backend avec PM2 sont **déjà en place**. Le guide d’administration fournit une commande de sauvegarde manuelle ; une sauvegarde périodique avec restauration testée reste à mettre en œuvre.

### Priorité 2 : enrichir les achats et la gestion du catalogue

| Évolution                        | Comportement attendu et raison                                                                                                                                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panier multi-produits            | Ajouter, retirer et modifier les quantités de plusieurs produits. Créer des lignes de commande conservant le prix de chaque article au moment de l’achat et calculer un total exact.                                              |
| Paiement atomique d’un panier    | Vérifier et diminuer les stocks de toutes les lignes dans une transaction. Si un article manque, ne valider aucun paiement ni décompte partiel. Verrouiller les produits dans un ordre stable et tester les achats simultanés.    |
| Gestion des produits et du stock | Modifier les fiches, ajouter descriptions, catégories et images, puis archiver les produits retirés de la vente sans perdre l’historique des commandes. Journaliser les réapprovisionnements et corrections de stock.             |
| Recherche et pagination          | Rechercher les produits et les commandes, filtrer les commandes par date et statut, puis paginer les résultats côté API. Éviter de charger tout le catalogue ou tout l’historique en une requête.                                 |
| Cycle de vie des commandes       | Ajouter annulation, préparation, expédition et livraison avec des transitions autorisées. Définir les règles de réservation et d’expiration du stock avant leur implémentation, et empêcher toute restitution de stock en double. |

### Priorité 3 : intégrer un paiement réel et accompagner la montée en charge

| Évolution                               | Comportement attendu et raison                                                                                                                                                                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intégration Mobile Money                | Choisir un opérateur, utiliser son environnement de test et vérifier les notifications signées, le montant, la devise et le destinataire. Un identifiant envoyé par le navigateur ne serait plus suffisant pour déclarer une commande payée.                                                                |
| Paiements asynchrones et remboursements | Gérer les confirmations tardives, échecs et notifications répétées. Utiliser l’idempotence de l’opérateur, rapprocher les transactions avec la base et prévoir des remboursements traçables sans double exécution. Une transaction PostgreSQL seule ne peut pas annuler un débit chez un opérateur externe. |
| Notifications et justificatifs          | Envoyer une confirmation après validation du paiement, fournir un reçu et suivre la livraison. Prévoir une file de tâches avec reprise des échecs pour qu’un problème d’envoi ne fasse pas échouer le paiement.                                                                                             |
| Qualité et performances                 | Compléter les tests API par des tests navigateur automatisés et des tests de charge. Mesurer les temps de réponse, optimiser les requêtes et les index, puis dimensionner l’hébergement selon les résultats.                                                                                                |

Le critère à conserver à chaque évolution est le même : **un paiement ne doit jamais provoquer deux décomptes**, même après une coupure réseau ou lors de requêtes simultanées. Les nouvelles fonctionnalités doivent préserver les contrôles de stock et la cohérence des commandes.

La création actuelle du schéma est réexécutable, mais `CREATE TABLE IF NOT EXISTS` ne met pas à jour une ancienne définition de table. C'est adapté à cette première version ; une évolution demanderait une migration explicite.

## État des bonus

| Bonus                      | État                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests automatiques         | Onze tests PostgreSQL réussis lors de la vérification du 9 novembre 2026.                                                                                       |
| Docker en une commande     | `backend/Dockerfile` et `compose.yaml` fournis pour `docker compose up --build`. Exécution non vérifiée dans cet environnement, où Docker n'est pas disponible. |
| Mise en ligne avec un lien | https://ziko-test-technique.angelotmpata.net — frontend Nginx, backend PM2, PostgreSQL et HTTPS Certbot. Parcours complet vérifié dans le navigateur.           |

Le workflow `.github/workflows/ci.yml` compile et teste l'API avec PostgreSQL à chaque push ou pull request sur GitHub. Son exécution distante reste à vérifier après publication.

## Déploiement facultatif

Consulter le [guide d’administration du VPS](ADMINISTRATION.md) pour les emplacements, PM2, les logs, les mises à jour, Nginx, HTTPS et PostgreSQL.

### Autre hébergeur

Sur un hébergeur compatible Node.js, utiliser `backend` comme répertoire de travail :

- Installation et compilation : `npm ci && npm run build`.
- Création du schéma : `npm run migrate:prod`.
- Démarrage : `npm start`.
- Variables : `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL` et le `PORT` fourni par l'hébergeur.
- Vérification : `GET /health`.

La base PostgreSQL doit être accessible depuis l'hébergeur. Activer `DB_SSL=true` si elle exige TLS avec un certificat reconnu. Le compte de migration doit pouvoir créer le schéma `ziko`. Utiliser des données de démonstration : cette API d'exercice n'a pas d'authentification.

## Remise du test

Le dépôt GitHub est public et l’application HTTPS est accessible, vérifications effectuées le **10 novembre 2026**. Le README présente le lancement local, les choix techniques et leurs raisons, ainsi que les améliorations envisagées, conformément aux éléments demandés dans le sujet. Les fichiers `.env`, `node_modules/` et `dist/` sont exclus par `.gitignore` ; ne pas les publier.

La vidéo de 1 à 2 minutes et l’envoi restent à confirmer. Envoyer le lien GitHub, la vidéo et le lien de démonstration à Jonathan sur WhatsApp avant le **jeudi 12 novembre 2026 à 18 h** (fuseau non précisé dans le sujet). La mise en ligne est un bonus facultatif ; elle ne remplace pas la vidéo. Préparer également l’échange de 30 minutes : le sujet autorise l’IA, mais demande de pouvoir expliquer chaque partie du code.
