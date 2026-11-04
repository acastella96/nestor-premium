# Compartir el joc entre mòbils (Supabase)

Amb això, el mòbil de la Clàudia porta la ruta i els organitzadors, des dels seus mòbils, veuen on és i posen el veredicte de cada prova. Només qui sap el PIN pot posar "Quota pagada" o "Pagament rebutjat", i ho comprova el servidor.

## 1. Crear el projecte

1. Entra a <https://supabase.com> i inicia sessió (es pot fer amb el compte de GitHub).
2. **New project**. Nom: `nestor-premium`. Regió: **Central EU (Frankfurt)**. Posa-hi una contrasenya de base de dades qualsevol (no la farem servir).
3. Espera un parell de minuts que es creï.

## 2. Crear la taula i les funcions

1. Al menú de l'esquerra, **SQL Editor** → **New query**.
2. Copia tot el contingut de [`setup.sql`](setup.sql) i enganxa'l.
3. A la línia `insert into public.np_secret (id, pin) values (1, 'XXXX')`, canvia `XXXX` pel PIN que vulgueu els organitzadors (per exemple 4 xifres).
4. Prem **Run**. Ha de dir "Success. No rows returned".

Si mai voleu canviar el PIN, torneu a executar el fitxer amb el PIN nou. No s'esborra el joc.

## 3. Passar les dades a l'app

1. **Project Settings** → **API** (o **API Keys**).
2. Copia el **Project URL** (`https://xxxx.supabase.co`).
3. Copia la clau pública: **Publishable key** (`sb_publishable_...`) o, si no en surt, la **anon public** de "Legacy API keys".
4. Posa-les a [`config.js`](../config.js):

```js
window.NP_CONFIG = {
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseKey: "sb_publishable_...",
};
```

Aquestes dues dades són públiques per disseny: la seguretat la fan les regles de `setup.sql` i el PIN. No hi posis mai la clau `service_role` ni la `secret`.

## 4. Fer-lo servir

- **Mòbil de la Clàudia**: obre l'enllaç normal i ja està. Avança la ruta; a les proves li surt "Esperant el veredicte dels organitzadors".
- **Mòbils dels organitzadors**: obriu el mateix enllaç → **Menú** → **Mode organitzador** → PIN. A dalt surt "ORGANITZADOR". Veieu la parada on és la Clàudia i, a les proves, els botons del veredicte. Reiniciar el joc també demana ser organitzador.
- Les eines (marcadors, cartes, rosco...) es poden fer servir des de qualsevol mòbil i es veuen a tots.
- Si un mòbil es queda sense xarxa, a dalt surt "SENSE CONNEXIÓ". Quan torna, envia el que faltava i es posa al dia.
