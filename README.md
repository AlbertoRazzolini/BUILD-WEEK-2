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
- [Architettura del codice](#architettura-del-codice)
  - [Classi modello](#classi-modello)
  - [Classe Player](#classe-player)
  - [Funzioni helper](#funzioni-helper)
  - [LocalStorage helpers](#localstorage-helpers)
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

> Tutte le funzioni, classi e variabili principali dei file in `assets/js/` sono documentate con commenti **JSDoc** (`@param`, `@returns`, `@type`).

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
Ogni brano ha un pulsante cuore che alterna tra pieno e vuoto in tempo reale. I preferiti sono salvati in `localStorage` e sincronizzati automaticamente nella sidebar senza ricaricare la pagina. Nella pagina album il cuore agisce sull'intero album: salva o rimuove tutte le tracce in un colpo solo.

### Playlist multiple
Dal pulsante `+` su qualsiasi brano (card, riga tracklist, sidebar) si apre un menu contestuale che permette di:
- Aggiungere il brano a una playlist esistente
- Creare una nuova playlist al momento digitando il nome
- Rimuovere il brano da una playlist con il pulsante `✕`

Le playlist sono accessibili dalla sidebar e navigabili tramite la pagina dedicata `playlist.html`.

### Cronologia
Gli ultimi 12 brani riprodotti vengono salvati automaticamente in `localStorage` e mostrati nella riga "Riprodotti di recente" nella home. La cronologia si aggiorna ad ogni play senza duplicati.

### Filtri sidebar
Tre badge nella sidebar filtrano i preferiti per:
- **Artisti** — mostra gli artisti dei brani preferiti, click riproduce tutte le tracce dell'artista
- **Album** — mostra gli album dei brani preferiti, click naviga alla pagina album
- **Generi** — mostra i generi presenti nei preferiti e filtra in tempo reale le card della home, nascondendo le sezioni senza corrispondenze

Ricliccando lo stesso badge si torna alla visualizzazione normale.

### Ricerca con debounce
La barra di ricerca aspetta 400ms dopo l'ultima lettera digitata prima di inviare la richiesta, evitando chiamate API inutili. I risultati vengono cercati in parallelo su brani, album e artisti.

### Drag to scroll
Le righe di card nella home e la sidebar supportano il trascinamento con il mouse per scorrere orizzontalmente (righe) e verticalmente (sidebar), senza mostrare scrollbar.

### Design responsive
L'applicazione è ottimizzata per ogni dispositivo:
- **Mobile** — topbar semplificata con hamburger menu, sidebar in offcanvas, altezza dinamica con `100dvh`
- **Tablet** — layout a colonna unica con spaziature adattive
- **Desktop** — layout a 3 zone (sidebar fissa + contenuto + footer player)

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

## Architettura del codice

### Classi modello

Le tre classi mappano i dati grezzi dell'API iTunes in oggetti strutturati usati in tutta l'app:

```js
class Track {
  constructor(raw) {
    this.id        = raw.trackId;
    this.title     = raw.trackName;
    this.artist    = raw.artistName;
    this.album     = raw.collectionName;
    this.albumId   = raw.collectionId;
    this.artistId  = raw.artistId;
    this.cover     = raw.artworkUrl100;
    this.previewUrl = raw.previewUrl;
    this.durationMs = raw.trackTimeMillis;
    this.genre     = raw.primaryGenreName;
  }
}

class Album {
  constructor(raw) {
    this.id         = raw.collectionId;
    this.title      = raw.collectionName;
    this.artist     = raw.artistName;
    this.artistId   = raw.artistId;
    this.cover      = raw.artworkUrl100;
    this.trackCount = raw.trackCount;
    this.releaseDate = raw.releaseDate;
  }
}

class Artist {
  constructor(raw) {
    this.id    = raw.artistId;
    this.name  = raw.artistName;
    this.genre = raw.primaryGenreName;
  }
}
```

---

### Classe Player

Gestisce l'elemento `<audio>` e tutta la UI del footer. Viene istanziata una volta per pagina tramite `initPage()` e salvata in `window.player`.

```js
// Avvia la riproduzione di un brano, con tracklist opzionale per next/prev
player.play(track, tracklist = [])

// Play/pausa toggle
player.togglePlay()

// Navigazione
player.next()
player.prev()

// Modalità
player.toggleShuffle()   // ordine casuale
player.toggleRepeat()    // loop singolo brano

// Volume e seek
player.setVolume(0.8)    // valore tra 0 e 1
player.seek(0.5)         // salta al 50% del brano
```

La tracklist passata a `play()` viene usata da `next()` e `prev()` per navigare nell'elenco corretto (album, risultati di ricerca, preferiti, ecc.).

---

### Funzioni helper

Disponibili globalmente da `common.js`:

```js
// Fetch con gestione errori — restituisce { results: [] } in caso di fallimento
const data = await fetchJSON("https://itunes.apple.com/search?term=pop&entity=song");

// Converte millisecondi in stringa "m:ss"
formatTime(215000) // → "3:35"

// Sostituisce la thumbnail 100x100 con la versione 600x600
bigArt("https://...artwork/100x100bb.jpg") // → "https://...artwork/600x600bb.jpg"

// Restituisce una funzione che esegue fn solo dopo ms millisecondi di pausa
const debouncedSearch = debounce(doSearch, 400);
```

---

### LocalStorage helpers

Tutte le funzioni leggono e scrivono su `localStorage` in formato JSON:

```js
// Cronologia (max 12 brani)
getHistory()           // → Track[]
addToHistory(track)    // aggiunge in testa, rimuove duplicati

// Preferiti
getFavourites()        // → Track[]
isFavourite(trackId)   // → boolean
toggleFavourite(track) // aggiunge o rimuove

// Playlist multiple
getPlaylists()                        // → [{id, name, tracks}]
getPlaylistById(id)                   // → playlist | null
createPlaylist(name)                  // → nuova playlist vuota
deletePlaylist(id)                    // rimuove la playlist
toggleTrackInPlaylist(playlistId, track) // aggiunge o rimuove un brano
```

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
