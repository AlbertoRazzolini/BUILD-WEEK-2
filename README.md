# EpiTunes

Un'applicazione web per ascoltare anteprime musicali, gestire preferiti e playlist personali, ispirata all'interfaccia di Spotify. Realizzata in JavaScript vanilla durante la Build Week di Epicode.

---

## Indice

- [Panoramica](#panoramica)
- [Tecnologie](#tecnologie)
- [Struttura del progetto](#struttura-del-progetto)
- [Pagine](#pagine)
  - [Home](#home)
  - [Ricerca](#ricerca)
  - [Album](#album)
  - [Artista](#artista)
  - [Playlist](#playlist)
- [Funzionalità](#funzionalità)
- [Player](#player)
- [Come avviare](#come-avviare)
- [Team](#team)

---

## Panoramica

EpiTunes è una **Multi Page Application (MPA)** che sfrutta le API pubbliche di iTunes per recuperare brani, album e artisti. Ogni pagina è un file HTML indipendente che condivide la stessa logica tramite `common.js`.

---

## Tecnologie

| Tecnologia | Versione | Uso |
|---|---|---|
| HTML5 / CSS3 / JavaScript | ES2022 | Base applicazione |
| Bootstrap | 5.3.3 | Layout e componenti UI |
| Ionicons | 7 | Icone SVG |
| iTunes Search API | — | Dati musicali (brani, album, artisti) |
| localStorage | — | Persistenza preferiti, playlist, cronologia |

---

## Struttura del progetto

```
BUILD-WEEK-2/
├── index.html          # Home
├── search.html         # Ricerca
├── album.html          # Dettaglio album
├── artist.html         # Dettaglio artista
├── playlist.html       # Playlist e preferiti
├── assets/
│   ├── css/
│   │   └── app.css     # Stili globali
│   └── js/
│       ├── common.js   # Logica condivisa (Player, helpers, localStorage)
│       ├── home.js     # Logica pagina Home
│       ├── search.js   # Logica pagina Ricerca
│       ├── album.js    # Logica pagina Album
│       ├── artist.js   # Logica pagina Artista
│       └── playlist.js # Logica pagina Playlist
└── README.md
```

---

## Pagine

### Home

**File:** `index.html` + `assets/js/home.js`

La pagina principale mostra righe di card musicali organizzate per categoria:

- **Riprodotti di recente** — brani ascoltati nella sessione corrente
- **I tuoi preferiti** — brani salvati con il cuore
- **Suggerimenti pop** — fetch iTunes `term=pop`
- **Suggerimenti rock** — fetch iTunes con filtro generi rock/alternative/metal
- **Suggerimenti hits** — fetch iTunes `term=pop italiano`, country IT

Ogni card permette di riprodurre il brano, aggiungerlo ai preferiti e inserirlo in una playlist.

---

### Ricerca

**File:** `search.html` + `assets/js/search.js`

Barra di ricerca con debounce 400ms. Cerca in parallelo (`Promise.all`) su tre entità:

- **Brani** — max 20 risultati
- **Album** — max 8 risultati, click naviga alla pagina album
- **Artisti** — max 8 risultati, click naviga alla pagina artista

L'ultima query viene salvata in `localStorage` e ripristinata al ritorno sulla pagina.

---

### Album

**File:** `album.html` + `assets/js/album.js`

Riceve l'ID dall'URL (`?id=...`) e mostra:

- Cover grande, titolo, artista, anno, numero brani, durata totale
- Pulsante Play — avvia l'intero album come tracklist
- Pulsante cuore — salva/rimuove tutte le tracce dai preferiti
- Lista tracce con numero, titolo, durata, cuore e pulsante +

---

### Artista

**File:** `artist.html` + `assets/js/artist.js`

Riceve l'ID dall'URL (`?id=...`) e mostra:

- Cover circolare, nome artista, genere, ascoltatori mensili (simulati)
- Pulsante Play — avvia le top tracks come tracklist
- Lista delle top tracks con cuore e pulsante +

---

### Playlist

**File:** `playlist.html` + `assets/js/playlist.js`

Gestisce sia i **preferiti** (`?id=favourites`) sia le **playlist personalizzate** (`?id=pl_...`):

- Cover, nome, numero brani, durata totale
- Pulsante Play e pulsante elimina (solo sulle playlist, non sui preferiti)
- Lista brani con rimozione singola

---

## Funzionalità

### Preferiti
Ogni brano ha un pulsante cuore che alterna tra pieno e vuoto. I preferiti sono salvati in `localStorage` e sincronizzati in tempo reale nella sidebar.

### Playlist multiple
Dal pulsante `+` su qualsiasi brano si apre un menu contestuale per aggiungere il brano a una playlist esistente o crearne una nuova al momento.

### Cronologia
Gli ultimi 12 brani riprodotti vengono salvati automaticamente e mostrati nella riga "Riprodotti di recente" nella home.

### Filtri sidebar
Tre badge nella sidebar filtrano i preferiti per:
- **Artisti** — raggruppa per artista
- **Album** — raggruppa per album
- **Generi** — filtra le card della home in base al genere selezionato

---

## Player

Il footer player è persistente su tutte le pagine.

| Controllo | Funzione |
|---|---|
| ⏮ | Brano precedente (o ricomincia se sono passati più di 3 secondi) |
| ▶ / ⏸ | Play / Pausa |
| ⏭ | Brano successivo |
| ⇄ | Shuffle casuale |
| 🔁 | Repeat (loop singolo brano) |
| 🔊 | Controllo volume con barra trascinabile |

Titolo e artista nel footer sono link cliccabili verso la pagina album e la pagina artista. L'underline appare solo quando un brano è in riproduzione.

---

## Come avviare

1. Clona il repository:
   ```bash
   git clone https://github.com/AlbertoRazzolini/BUILD-WEEK-2.git
   ```
2. Apri `index.html` con un server locale (es. **Live Server** di VS Code) oppure direttamente nel browser.

> Non sono necessari npm, bundler o build step — è JavaScript vanilla puro.

---

## Team

| Membro | Branch |
|---|---|
| Alberto | `Alberto` |
| Javier | `Javier` |
| Cristian | `Cristian` |
| Luciano | `Luciano` |
| Marco | `Marco` |
| Simone | `Simone` |
