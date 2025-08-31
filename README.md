# FPL Butler

En smart webapp som henter data fra Fantasy Premier League (FPL) API-et og genererer automatisk ukentlige oppdateringer for din private liga.

## Hvordan komme i gang

Du trenger Node.js installert på maskinen din for å kjøre dette prosjektet.

### Installer avhengigheter
Åpne en terminal i prosjektmappen og kjør følgende kommando for å installere alle nødvendige pakker:

```bash
npm install
```

### Start utviklingsserveren
Når installasjonen er ferdig, start applikasjonen med denne kommandoen:

```bash
npm run dev
```

### Åpne i nettleseren
Terminalen vil vise deg en lokal URL (vanligvis http://localhost:5173). Åpne denne i nettleseren din for å bruke appen.

## Automatisk oppdatering (Vercel Cron)

FPL Butler har innebygd støtte for automatiske oppdateringer via Vercel Cron Jobs som kjører hver time.

### Test cron-funksjonalitet lokalt

**Merk:** Vercel serverless functions kjører kun i produksjon på Vercel. For lokal testing kan du kjøre et enkelt script:

```bash
# Test cron-logikken direkte med Node.js
node -e "
import('./api/cron/check-gw.js').then(async m => {
  const result = await m.runCheck();
  console.log('Cron test result:', JSON.stringify(result, null, 2));
}).catch(console.error);
"
```

Eller kjør `npm run preview` og deploy til Vercel for full testing.

### Sett opp automatisk deploy-trigger (valgfritt)

For å automatisk bygge siden på nytt når en gameweek er ferdig:

1. **Opprett en Deploy Hook i Vercel:**
   - Gå til ditt Vercel prosjekt
   - Naviger til **Settings** → **Git** → **Deploy Hooks**
   - Klikk **Create Hook**
   - Gi den et navn (f.eks. "FPL Gameweek Completed")
   - Velg branch (vanligvis `main`)
   - Kopier den genererte URL-en

2. **Legg til miljøvariabel:**
   - Gå til **Settings** → **Environment Variables**
   - Opprett en ny variabel:
     - **Name:** `VERCEL_DEPLOY_HOOK_URL`
     - **Value:** [URL fra steg 1]
     - **Environments:** Production (og Development hvis ønsket)

3. **Deploy på nytt:**
   - Push endringer til git eller trigger en manual deploy
   - Cron jobben vil nå automatisk trigge nye builds når gameweeks er ferdig

### Cron-funksjonalitet

- **Frekvens:** Hver time (0 * * * * - UTC)
- **Funksjon:** Sjekker om nåværende gameweek er ferdig
- **Handling:** Oppdaterer intern state og trigger optional rebuild
- **Sikkerhet:** Idempotent - kjører bare action én gang per gameweek

## Hvordan bruke appen

Appen henter automatisk data for liga 155099 og viser:
- Topp 3 og bunn 3 lag
- Ukestatistikk (vinner, taper, bevegelser, chips, etc.)
- Høydepunkter fra runden
- AI-generert butlervurdering

