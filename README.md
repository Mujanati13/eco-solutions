# 🛍️ Guide d'Utilisation 
 https://api.albech.me
## 📋 Table des Matières
1. [Introduction](#introduction)
2. [Connexion au système](#connexion)
3. [Tableau de bord](#tableau-de-bord)
4. [Gestion des commandes](#gestion-des-commandes)
5. [Suivi des commandes](#suivi-des-commandes)
6. [Gestion des produits et stock](#gestion-des-produits)
7. [Rapports et statistiques](#rapports-et-statistiques)
8. [Profil utilisateur](#profil-utilisateur)
9. [Langues et paramètres](#langues-et-paramètres)
10. [Conseils et bonnes pratiques](#conseils)
11. [FAQ - Questions fréquentes](#faq)

---

## 🌟 Introduction {#introduction}

Bienvenue dans le système de gestion des commandes **Eco-S** ! Cette plateforme vous permet de gérer facilement toutes vos commandes avec paiement à la livraison. Le système est disponible en **français**, **anglais** et **arabe** avec support de l'écriture de droite à gauche.

### Que peut faire ce système ?
- ✅ Gérer les commandes clients
- ✅ Suivre l'état des livraisons
- ✅ Gérer les produits et le stock
- ✅ Distribuer les tâches aux employés
- ✅ Générer des rapports de performance
- ✅ Intégrer avec Google Sheets
- ✅ Support multilingue (FR/EN/AR)

---

## 🔐 Connexion au Système {#connexion}

### Comment se connecter
1. **Ouvrez votre navigateur web** (Chrome, Firefox, Safari, Edge)
2. **Tapez l'adresse du site** fournie par votre administrateur
3. **Entrez vos identifiants** :
   - Nom d'utilisateur ou email
   - Mot de passe
4. **Cliquez sur "Se connecter"**

### Types d'utilisateurs
- **👑 Administrateur** : Accès complet à toutes les fonctionnalités
- **👥 Superviseur** : Gestion d'équipe et supervision des commandes
- **👤 Employé** : Traitement des commandes assignées
- **🔧 Personnalisé** : Accès limité selon les permissions

> **💡 Conseil** : Si vous oubliez votre mot de passe, contactez votre administrateur.

---

## 📊 Tableau de Bord {#tableau-de-bord}

Le tableau de bord est votre **page d'accueil** après connexion. Il affiche un résumé de vos activités.

### Ce que vous voyez sur le tableau de bord

#### 📈 Statistiques Principales
- **Commandes totales** : Nombre total de commandes
- **Commandes en attente** : Commandes non encore traitées
- **Commandes confirmées** : Commandes acceptées et en cours
- **Commandes livrées** : Commandes complétées avec succès

#### 📋 Commandes Récentes
- Liste des dernières commandes créées
- Informations client (nom, téléphone)
- État actuel de chaque commande
- Montant de la commande

#### 📊 Graphiques (pour Administrateurs/Superviseurs)
- **Graphique en secteurs** : Répartition des commandes par statut
- **Graphique de tendances** : Évolution des commandes dans le temps
- **Performance d'équipe** : Classement des employés

### Actions Rapides (selon vos permissions)
- **📤 Importer des commandes** : Charger des commandes depuis Excel
- **🔄 Distribuer les commandes** : Assigner des commandes aux employés
- **📊 Actualiser les données** : Mettre à jour les statistiques

---

## 🛒 Gestion des Commandes {#gestion-des-commandes}

### Voir les Commandes

#### Pour les Administrateurs/Superviseurs
Vous avez accès à **plusieurs onglets** :
- **📋 Toutes les commandes** : Vue complète de toutes les commandes
- **❌ Non assignées** : Commandes sans employé désigné
- **✅ Assignées** : Commandes avec un employé responsable
- **⚠️ En retard** : Commandes de plus de 7 jours non livrées

#### Pour les Employés
Vous voyez :
- **📝 Mes commandes** : Toutes vos commandes assignées
- **⚠️ En retard** : Vos commandes en retard

### Informations des Commandes
Chaque commande affiche :
- **🔢 Numéro de commande** : Identifiant unique
- **👤 Nom du client** : Nom complet
- **📞 Téléphone** : Numéro de contact
- **📍 Adresse** : Adresse de livraison complète
- **🏙️ Ville/Wilaya** : Localisation
- **📦 Produit** : Nom et variante du produit
- **💰 Montant** : Prix total
- **📅 Date de création** : Quand la commande a été créée
- **👨‍💼 Assigné à** : Employé responsable
- **🔄 Statut** : État actuel

### États des Commandes
- **🟡 En attente (pending)** : Nouvelle commande
- **🔵 Confirmée (confirmed)** : Client a confirmé
- **🚚 En livraison (shipped)** : Colis expédié
- **✅ Livrée (delivered)** : Commande complétée
- **❌ Annulée (cancelled)** : Commande annulée
- **↩️ Retournée (returned)** : Colis retourné

### Créer une Nouvelle Commande
1. **Cliquez sur le bouton "Nouvelle commande"**
2. **Remplissez les informations client** :
   - Nom complet
   - Numéro de téléphone
   - Adresse complète
   - Ville et wilaya
3. **Sélectionnez le produit et sa variante**
4. **Vérifiez le montant**
5. **Cliquez sur "Créer"**

### Modifier une Commande
1. **Trouvez la commande** dans la liste
2. **Cliquez sur l'icône de modification** ✏️
3. **Changez les informations nécessaires**
4. **Sauvegardez** les modifications

### Filtrer et Rechercher
- **🔍 Barre de recherche** : Tapez le nom du client ou numéro de commande
- **📋 Filtre par statut** : Sélectionnez un état spécifique
- **👤 Filtre par employé** : Voir les commandes d'un employé (Admin seulement)

---

## 📍 Suivi des Commandes {#suivi-des-commandes}

### Mettre à Jour l'État d'une Commande
1. **Ouvrez la commande** en cliquant dessus
2. **Changez le statut** selon la situation :
   - ⏳ **En attente** → 🔵 **Confirmée** (après contact client)
   - 🔵 **Confirmée** → 🚚 **En livraison** (colis expédié)
   - 🚚 **En livraison** → ✅ **Livrée** (livraison réussie)
   - Ou ❌ **Annulée**/↩️ **Retournée** si problème
3. **Ajoutez un commentaire** si nécessaire
4. **Sauvegardez**

### Historique des Modifications
Chaque commande garde un **historique complet** :
- Qui a fait quoi et quand
- Changements de statut
- Commentaires ajoutés
- Dates de chaque action

### Intégration Ecotrack
Si votre commande est liée à **Ecotrack** :
- Le suivi sera automatiquement synchronisé
- Vous verrez l'icône de synchronisation 🔄
- Les mises à jour de livraison seront automatiques

---

## 📦 Gestion des Produits et Stock {#gestion-des-produits}

### Voir les Produits
- **Liste complète** de tous vos produits
- **Informations** : nom, SKU, prix, stock disponible
- **Catégories** pour organiser vos produits
- **Variantes** (tailles, couleurs, etc.)

### Gérer le Stock
- **📊 Niveaux de stock** actuels
- **⚠️ Alertes stock faible** automatiques
- **📈 Mouvements de stock** (entrées/sorties)
- **📍 Emplacements** multiples

### Actions sur les Produits
- **➕ Ajouter** un nouveau produit
- **✏️ Modifier** les informations
- **🗂️ Organiser** par catégories
- **📊 Suivre** les mouvements

---

## 📊 Rapports et Statistiques {#rapports-et-statistiques}

### Types de Rapports Disponibles

#### 📈 Rapports de Vente
- **Ventes par période** (jour, semaine, mois)
- **Produits les plus vendus**
- **Performance par ville/wilaya**
- **Tendances de revenus**

#### 👥 Rapports d'Équipe
- **Performance des employés**
- **Taux de livraison réussis**
- **Temps de traitement moyen**
- **Classement des équipes**

#### 📊 Rapports de Stock
- **État du stock par produit**
- **Mouvements récents**
- **Alertes stock faible**
- **Historique des approvisionnements**

### Comment Générer un Rapport
1. **Allez dans la section "Rapports"**
2. **Choisissez le type** de rapport souhaité
3. **Sélectionnez la période** (dates de début et fin)
4. **Appliquez les filtres** si nécessaire
5. **Cliquez sur "Générer"**
6. **Exportez** en Excel si souhaité

---

## 👤 Profil Utilisateur {#profil-utilisateur}

### Gestion de Votre Profil
- **👤 Informations personnelles** : nom, prénom, email
- **🔒 Changer le mot de passe**
- **🎯 Voir vos permissions**
- **📊 Vos statistiques personnelles**

### Comment Modifier Votre Profil
1. **Cliquez sur votre nom** en haut à droite
2. **Sélectionnez "Profil"**
3. **Modifiez** les informations souhaitées
4. **Sauvegardez** les changements

---

## 🌍 Langues et Paramètres {#langues-et-paramètres}

### Changer la Langue
1. **Cliquez sur l'icône langue** 🌍 en haut à droite
2. **Choisissez** votre langue :
   - 🇫🇷 **Français**
   - 🇬🇧 **English**
   - 🇩🇿 **العربية** (avec support droite-à-gauche)

### Interface Adaptative
- **📱 Mobile-friendly** : Fonctionne sur téléphone et tablette
- **🔄 Mise à jour automatique** des données
- **💾 Sauvegarde automatique** de vos préférences

---

## 💡 Conseils et Bonnes Pratiques {#conseils}

### 🏆 Conseils pour une Utilisation Efficace

#### Pour les Employés
- ✅ **Vérifiez vos commandes** assignées quotidiennement
- ✅ **Mettez à jour les statuts** rapidement après chaque action
- ✅ **Contactez les clients** pour confirmer avant livraison
- ✅ **Ajoutez des commentaires** pour les cas spéciaux
- ✅ **Signalez les problèmes** à votre superviseur

#### Pour les Superviseurs
- ✅ **Distribuez les commandes** équitablement
- ✅ **Surveillez les commandes en retard**
- ✅ **Vérifiez la performance** de l'équipe régulièrement
- ✅ **Aidez les employés** en difficulté
- ✅ **Générez des rapports** hebdomadaires

#### Pour les Administrateurs
- ✅ **Importez les commandes** depuis Excel/Google Sheets
- ✅ **Gérez les permissions** utilisateurs
- ✅ **Surveillez les performances** globales
- ✅ **Configurez les intégrations** nécessaires
- ✅ **Sauvegardez les données** régulièrement

---

## ❓ FAQ - Questions Fréquentes {#faq}

### 🔐 Connexion et Accès
**Q: J'ai oublié mon mot de passe, que faire ?**
R: Contactez votre administrateur système pour réinitialiser votre mot de passe.

**Q: Pourquoi ne vois-je pas certaines fonctionnalités ?**
R: Votre accès dépend de vos permissions. Contactez votre administrateur si vous avez besoin d'accès supplémentaires.

### 📱 Interface et Navigation
**Q: Le site fonctionne-t-il sur mobile ?**
R: Oui ! Le système est entièrement adaptatif et fonctionne parfaitement sur téléphones et tablettes.

**Q: Comment changer la langue ?**
R: Cliquez sur l'icône 🌍 en haut à droite et sélectionnez votre langue préférée.

### 🛒 Gestion des Commandes
**Q: Comment modifier une commande déjà créée ?**
R: Cliquez sur l'icône ✏️ à côté de la commande, modifiez les informations et sauvegardez.

**Q: Qui peut voir mes commandes ?**
R: Les employés voient uniquement leurs commandes assignées. Les superviseurs et administrateurs voient toutes les commandes.

**Q: Comment signaler un problème avec une commande ?**
R: Ajoutez un commentaire détaillé dans la commande et changez le statut approprié. Contactez votre superviseur si nécessaire.

### 📊 Rapports et Statistiques
**Q: À quelle fréquence les données se mettent-elles à jour ?**
R: Les données se mettent à jour en temps réel. Vous pouvez aussi cliquer sur "Actualiser" pour forcer une mise à jour.

**Q: Puis-je exporter les rapports ?**
R: Oui, la plupart des rapports peuvent être exportés en format Excel.

### 📦 Stock et Produits
**Q: Comment ajouter un nouveau produit ?**
R: Allez dans "Stock" → "Produits" → Cliquez sur "Ajouter un produit" (nécessite les permissions appropriées).

**Q: Comment gérer les variantes de produits ?**
R: Dans la fiche produit, vous pouvez ajouter des variantes (taille, couleur, etc.) avec des prix différents.

*Guide créé pour le système Eco-S - Version 1.0*
*Dernière mise à jour : Juillet 2025*
