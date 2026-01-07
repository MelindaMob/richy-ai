
# Notes de développement Richy.ai## Date: [Date actuelle]---## 📋 RÉSUMÉ DES MODIFICATIONS### ✅ Fonctionnalités implémentées1. **Système d'inscription avec vérification téléphonique**   - Vérification SMS via Twilio   - Format +33 forcé pour les numéros français   - Validation du format avant envoi   - Un seul essai gratuit par numéro2. **Choix de plan obligatoire**   - Page `/register/pricing-choice` obligatoire après inscription   - Deux plans : Essai Gratuit (trial) ou Accès Premium (direct)   - Aucune subscription créée avant le choix du plan3. **Système de limitations selon le plan**   - **Trial** : 5 messages chat, 1 validation, 0 prompt/builder   - **Premium** : Accès illimité à tous les agents   - Limitations appliquées via `checkUsageLimits` dans tous les agents4. **Webhook Stripe amélioré**   - Respect du `plan_type` choisi par l'utilisateur   - Création de subscription avec bonnes limitations   - Synchronisation avec Supabase---## 📁 FICHIERS CRÉÉS### Nouveaux fichiers- `src/lib/supabase/admin.ts` - Client Supabase avec service role key- `src/app/api/auth/phone-verify/send/route.ts` - Envoi code SMS- `src/app/api/auth/phone-verify/confirm/route.ts` - Vérification code- `src/app/api/stripe/sync-subscription/route.ts` - Synchronisation manuelle- `src/app/(dashboard)/dashboard/dashboard-header.tsx` - Header avec déconnexion- `src/app/(dashboard)/dashboard/locked-agent-card.tsx` - Carte agent bloqué- `src/app/(dashboard)/dashboard/payment-success/page.tsx` - Page succès paiement- `src/app/(dashboard)/builder/page.tsx` - Page Builder (créée car manquante)- `src/app/(auth)/register/pricing-choice/page.tsx` - Choix du plan- `src/app/onboarding/pricing/page.tsx` - Page pricing avec sync### Composants- `src/components/PhoneVerification.tsx` - Composant vérification téléphone- `src/components/CheckoutModal.tsx` - Modal Stripe checkout- `src/components/UpgradeModal.tsx` - Modal upgrade---## 📝 FICHIERS MODIFIÉS### Routes API- `src/app/api/agents/chat/route.ts` - Ajout checkUsageLimits + thread_id- `src/app/api/agents/validator/route.ts` - Ajout checkUsageLimits- `src/app/api/agents/prompt/route.ts` - Ajout checkUsageLimits + gestion erreur 403- `src/app/api/agents/builder/route.ts` - Ajout checkUsageLimits + gestion erreur 403- `src/app/api/stripe/webhook/route.ts` - Logique complète pour respecter plan_type- `src/app/api/stripe/create-checkout-session/route.ts` - Trial period + metadata### Pages- `src/app/(auth)/register/page.tsx` - Intégration PhoneVerification + redirection pricing-choice- `src/app/(auth)/login/page.tsx` - Vérification subscription avant redirection- `src/app/(dashboard)/dashboard/page.tsx` - Affichage locked cards pour trial- `src/app/(dashboard)/prompt/page.tsx` - Gestion erreur 403 avec UpgradeModal- `src/app/(dashboard)/builder/page.tsx` - Gestion erreur 403 avec UpgradeModal### Utilitaires- `src/lib/check-limits.ts` - Logique complète de vérification des limites- `middleware.ts` - Protection routes dashboard + exclusion routes /register/*---## 🔧 CONFIGURATION BASE DE DONNÉES### Table `phone_verifications`CREATE TABLE IF NOT EXISTS phone_verifications (  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  phone_hash TEXT NOT NULL,  phone_last_4 TEXT NOT NULL,  country_code TEXT NOT NULL,  verification_code TEXT, -- À ajouter si n'existe pas  code_expires_at TIMESTAMPTZ,  verified BOOLEAN DEFAULT FALSE,  verified_at TIMESTAMPTZ,  created_at TIMESTAMPTZ DEFAULT NOW());### Table `subscriptions`Colonnes importantes :- `user_id` (UUID, primary key)- `stripe_customer_id` (TEXT)- `stripe_subscription_id` (TEXT)- `stripe_price_id` (TEXT)- `status` (TEXT: 'trialing', 'active', 'canceled', 'past_due', 'pending')- `plan_type` (TEXT: 'trial' ou 'direct') - **CRUCIAL**- `trial_limitations` (JSONB: `{chat_messages: 5, validator_uses: 1, prompt_uses: 0, builder_uses: 0}` ou NULL)- `trial_ends_at` (TIMESTAMPTZ)- `current_period_end` (TIMESTAMPTZ)### Table `usage_tracking`CREATE TABLE IF NOT EXISTS usage_tracking (  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  user_id UUID NOT NULL REFERENCES auth.users(id),  agent_type TEXT NOT NULL, -- 'chat', 'validator', 'prompt', 'builder'  usage_date DATE NOT NULL,  usage_count INTEGER DEFAULT 0,  UNIQUE(user_id, agent_type, usage_date));---## 🔑 VARIABLES D'ENVIRONNEMENT### Twilio (pour vérification téléphone)
Table subscriptions
Colonnes importantes :
user_id (UUID, primary key)
stripe_customer_id (TEXT)
stripe_subscription_id (TEXT)
stripe_price_id (TEXT)
status (TEXT: 'trialing', 'active', 'canceled', 'past_due', 'pending')
plan_type (TEXT: 'trial' ou 'direct') - CRUCIAL
trial_limitations (JSONB: {chat_messages: 5, validator_uses: 1, prompt_uses: 0, builder_uses: 0} ou NULL)
trial_ends_at (TIMESTAMPTZ)
current_period_end (TIMESTAMPTZ)
Table usage_tracking
CREATE TABLE IF NOT EXISTS usage_tracking (  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  user_id UUID NOT NULL REFERENCES auth.users(id),  agent_type TEXT NOT NULL, -- 'chat', 'validator', 'prompt', 'builder'  usage_date DATE NOT NULL,  usage_count INTEGER DEFAULT 0,  UNIQUE(user_id, agent_type, usage_date));
🔑 VARIABLES D'ENVIRONNEMENT
Twilio (pour vérification téléphone)
TWILIO_ACCOUNT_SID=...TWILIO_AUTH_TOKEN=...TWILIO_PHONE_NUMBER=...
Stripe
STRIPE_SECRET_KEY=...STRIPE_PUBLISHABLE_KEY=...STRIPE_WEBHOOK_SECRET=...STRIPE_PRICE_DIRECT_ID=... (même price ID pour trial et direct)idation format téléphone français   - Clic "Suivant" → passe à vérification téléphone2. **Vérification téléphone**   - Composant `PhoneVerification`   - Envoi code SMS via Twilio   - Vérification code   - Vérification que le numéro n'est pas déjà utilisé3. **Création compte**   - `supabase.auth.signUp()` appelé après vérification téléphone   - Mise à jour profil avec infos   - **AUCUNE subscription créée**4. **Redirection obligatoire**   - `window.location.href = '/register/pricing-choice'`   - L'utilisateur DOIT choisir son plan5. **Choix du plan**   - Page `/register/pricing-choice`   - Deux options : Trial ou Direct   - Ouverture `CheckoutModal` avec Stripe6. **Création subscription**   - Via Stripe Checkout   - Metadata avec `plan_type: 'trial'` ou `'direct'`   - Webhook crée la subscription avec bonnes limitations7. **Redirection dashboard**   - Après paiement → `/dashboard/payment-success`   - Appel automatique `/api/stripe/sync-subscription`   - Puis redirection `/dashboard`---## 🎯 LOGIQUE DES LIMITATIONS### Plan Trial (`plan_type: 'trial'`)- `trial_limitations`: `{chat_messages: 5, validator_uses: 1, prompt_uses: 0, builder_uses: 0}`- `status`: `'trialing'`- `trial_ends_at`: Date + 3 jours- Agents Prompt et Builder : affichés comme bloqués (LockedAgentCard)- Badge "Essai gratuit" avec jours restants### Plan Direct (`plan_type: 'direct'`)- `trial_limitations`: `NULL`- `status`: `'active'`- `trial_ends_at`: `NULL`- Accès illimité à tous les agents- Badge "Premium"### Vérification dans `check-limits.ts`1. Récupère subscription depuis table `subscriptions`2. Si `plan_type === 'trial'` → applique limitations (même si `trial_limitations` est NULL, utilise défaut)3. Si `plan_type === 'direct'` ou pas de `trial_limitations` → accès illimité4. Vérifie `usage_tracking` pour le jour actuel5. Incrémente le compteur si autorisé---## 🐛 PROBLÈMES RÉSOLUS1. **Redirection vers dashboard au lieu de pricing-choice**   - ✅ Changé `emailRedirectTo` vers `/register/pricing-choice`   - ✅ Utilisé `window.location.href` au lieu de `router.push`   - ✅ Middleware exclut routes `/register/*`2. **Utilisateur mis en premium directement**   - ✅ Webhook utilise `plan_type` du metadata (choix utilisateur)   - ✅ Aucune subscription créée avant choix du plan   - ✅ Limitations appliquées selon `plan_type`3. **Restrictions non appliquées**   - ✅ `checkUsageLimits` ajouté dans tous les agents   - ✅ Vérification `plan_type === 'trial'` pour forcer limitations   - ✅ LockedAgentCard pour Prompt et Builder en trial4. **Tables vides (payments, subscription_events, usage_tracking)**   - ✅ Webhook log dans `subscription_events`   - ✅ Webhook crée entrées dans `payments` (même pour 0€ trial)   - ✅ `checkUsageLimits` incrémente `usage_tracking`5. **stripe_subscription_id et stripe_price_id vides**   - ✅ Webhook utilise `onConflict: 'user_id'` pour updates   - ✅ Route `/api/stripe/sync-subscription` pour synchronisation manuelle   - ✅ Suppression anciennes subscriptions (garder une seule)6. **Erreur "The default export is not a React Component" sur /builder**   - ✅ Créé `src/app/(dashboard)/builder/page.tsx` (était vide)7. **Erreur "Cannot read properties of undefined (reading 'getUser')"**   - ✅ Ajouté `await` avant `createClient()` dans builder/route.ts8. **Validation téléphone**   - ✅ +33 forcé au début   - ✅ Formatage automatique avec espaces   - ✅ Validation format français avant envoi   - ✅ Message d'erreur si format invalide---## 🔍 POINTS D'ATTENTION### Webhook Stripe- Le `plan_type` vient du `metadata.plan_type` de la subscription Stripe- C'est ce que l'utilisateur a choisi sur `pricing-choice`- Si `plan_type === 'trial'` → limitations appliquées- Si `plan_type === 'direct'` → pas de limitations (premium)### Middleware- Ne touche PAS aux routes `/register/*`- Protège uniquement `/dashboard/*`- Redirige vers `/onboarding/pricing` si pas de subscription valide### Vérification téléphone- Table `phone_verifications` doit avoir colonne `verification_code` (TEXT)- Si colonne n'existe pas, le code est envoyé mais pas vérifiable en BDD- Hash du numéro stocké dans `phone_hash` pour sécurité### Limitations- Si `plan_type === 'trial'` mais `trial_limitations` est NULL → utilise défaut- Si `plan_type === 'direct'` → `trial_limitations` doit être NULL- `checkUsageLimits` vérifie `plan_type` en priorité---## 📦 COMMANDES GIT# Voir les modificationsgit status# Ajouter tous les fichiersgit add .# Commitgit commit -m "Fix: Redirection pricing-choice, validation téléphone +33, webhook et limitations selon plan choisi"# Push (si besoin de forcer)git push --force-with-lease origin main---## 🚀 PROCHAINES ÉTAPES POSSIBLES- [ ] Ajouter colonne `verification_code` à `phone_verifications` si manquante- [ ] Tester le flux complet d'inscription → choix plan → paiement → dashboard- [ ] Vérifier que les limitations s'appliquent correctement en trial- [ ] Tester la synchronisation manuelle depuis pricing page- [ ] Vérifier que le bouton de déconnexion fonctionne---## 📞 SUPPORTEn cas de problème :1. Vérifier les logs du webhook Stripe2. Vérifier les logs de `checkUsageLimits` dans la console3. Vérifier la table `subscriptions` dans Supabase4. Vérifier que `plan_type` est bien défini (trial ou direct)5. Vérifier que `trial_limitations` est NULL pour direct, défini pour trial---**Dernière mise à jour : [Date actuelle]**
Supabase
NEXT_PUBLIC_SUPABASE_URL=...NEXT_PUBLIC_SUPABASE_ANON_KEY=...SUPABASE_SERVICE_ROLE_KEY=... (pour webhook)
🔄 FLUX D'INSCRIPTION
Page /register
Formulaire : email, password, nom, entreprise, téléphone (+33 forcé)
Validation format téléphone français
Clic "Suivant" → passe à vérification téléphone
Vérification téléphone
Composant PhoneVerification
Envoi code SMS via Twilio
Vérification code
Vérification que le numéro n'est pas déjà utilisé
Création compte
supabase.auth.signUp() appelé après vérification téléphone
Mise à jour profil avec infos
AUCUNE subscription créée
Redirection obligatoire
window.location.href = '/register/pricing-choice'
L'utilisateur DOIT choisir son plan
Choix du plan
Page /register/pricing-choice
Deux options : Trial ou Direct
Ouverture CheckoutModal avec Stripe
Création subscription
Via Stripe Checkout
Metadata avec plan_type: 'trial' ou 'direct'
Webhook crée la subscription avec bonnes limitations
Redirection dashboard
Après paiement → /dashboard/payment-success
Appel automatique /api/stripe/sync-subscription
Puis redirection /dashboard
🎯 LOGIQUE DES LIMITATIONS
Plan Trial (plan_type: 'trial')
trial_limitations: {chat_messages: 5, validator_uses: 1, prompt_uses: 0, builder_uses: 0}
status: 'trialing'
trial_ends_at: Date + 3 jours
Agents Prompt et Builder : affichés comme bloqués (LockedAgentCard)
Badge "Essai gratuit" avec jours restants
Plan Direct (plan_type: 'direct')
trial_limitations: NULL
status: 'active'
trial_ends_at: NULL
Accès illimité à tous les agents
Badge "Premium"
Vérification dans check-limits.ts
Récupère subscription depuis table subscriptions
Si plan_type === 'trial' → applique limitations (même si trial_limitations est NULL, utilise défaut)
Si plan_type === 'direct' ou pas de trial_limitations → accès illimité
Vérifie usage_tracking pour le jour actuel
Incrémente le compteur si autorisé
🐛 PROBLÈMES RÉSOLUS
Redirection vers dashboard au lieu de pricing-choice
✅ Changé emailRedirectTo vers /register/pricing-choice
✅ Utilisé window.location.href au lieu de router.push
✅ Middleware exclut routes /register/*
Utilisateur mis en premium directement
✅ Webhook utilise plan_type du metadata (choix utilisateur)
✅ Aucune subscription créée avant choix du plan
✅ Limitations appliquées selon plan_type
Restrictions non appliquées
✅ checkUsageLimits ajouté dans tous les agents
✅ Vérification plan_type === 'trial' pour forcer limitations
✅ LockedAgentCard pour Prompt et Builder en trial
Tables vides (payments, subscription_events, usage_tracking)
✅ Webhook log dans subscription_events
✅ Webhook crée entrées dans payments (même pour 0€ trial)
✅ checkUsageLimits incrémente usage_tracking
stripe_subscription_id et stripe_price_id vides
✅ Webhook utilise onConflict: 'user_id' pour updates
✅ Route /api/stripe/sync-subscription pour synchronisation manuelle
✅ Suppression anciennes subscriptions (garder une seule)
Erreur "The default export is not a React Component" sur /builder
✅ Créé src/app/(dashboard)/builder/page.tsx (était vide)
Erreur "Cannot read properties of undefined (reading 'getUser')"
✅ Ajouté await avant createClient() dans builder/route.ts
Validation téléphone
✅ +33 forcé au début
✅ Formatage automatique avec espaces
✅ Validation format français avant envoi
✅ Message d'erreur si format invalide
🔍 POINTS D'ATTENTION
Webhook Stripe
Le plan_type vient du metadata.plan_type de la subscription Stripe
C'est ce que l'utilisateur a choisi sur pricing-choice
Si plan_type === 'trial' → limitations appliquées
Si plan_type === 'direct' → pas de limitations (premium)
Middleware
Ne touche PAS aux routes /register/*
Protège uniquement /dashboard/*
Redirige vers /onboarding/pricing si pas de subscription valide
Vérification téléphone
Table phone_verifications doit avoir colonne verification_code (TEXT)
Si colonne n'existe pas, le code est envoyé mais pas vérifiable en BDD
Hash du numéro stocké dans phone_hash pour sécurité
Limitations
Si plan_type === 'trial' mais trial_limitations est NULL → utilise défaut
Si plan_type === 'direct' → trial_limitations doit être NULL
checkUsageLimits vérifie plan_type en priorité
📦 COMMANDES GIT
# Voir les modificationsgit status# Ajouter tous les fichiersgit add .# Commitgit commit -m "Fix: Redirection pricing-choice, validation téléphone +33, webhook et limitations selon plan choisi"# Push (si besoin de forcer)git push --force-with-lease origin main
🚀 PROCHAINES ÉTAPES POSSIBLES
[ ] Ajouter colonne verification_code à phone_verifications si manquante
[ ] Tester le flux complet d'inscription → choix plan → paiement → dashboard
[ ] Vérifier que les limitations s'appliquent correctement en trial
[ ] Tester la synchronisation manuelle depuis pricing page
[ ] Vérifier que le bouton de déconnexion fonctionne
📞 SUPPORT
En cas de problème :
Vérifier les logs du webhook Stripe
Vérifier les logs de checkUsageLimits dans la console
Vérifier la table subscriptions dans Supabase
Vérifier que plan_type est bien défini (trial ou direct)
Vérifier que trial_limitations est NULL pour direct, défini pour trial