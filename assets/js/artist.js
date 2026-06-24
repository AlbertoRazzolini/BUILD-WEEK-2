/* ============================================================
   artist.js — pagina dettaglio artista
   ============================================================

   COSA DEVI FARE
   1) initPage("home")
   2) Leggi l'id dell'artista dalla query string (URLSearchParams).
   3) Se manca l'id -> messaggio "Artista non trovato" e stop.
   4) fetch /lookup?id=ID&entity=song&limit=15
      - results[0] è l'artist
      - results[1..] sono le top track
   5) Costruisci #artist-hero:
      - kicker "ARTISTA"
      - nome artista grande
      - genere (primaryGenreName) + numero ascoltatori (random, es. Math.random() * 5_000_000)
      - button "Play" -> player.play(prima track)
   6) Costruisci #top-tracks come tracklist (uguale a album).
*/

const player = initPage("home");

const artistHero = document.querySelector("#artist-hero");
const topTracks  = document.querySelector("#top-tracks");
const searchInput = document.getElementById("search-input");

// quando vai su invio salva il termine e vai alla pagina di ricerca dedicata
if (searchInput) {
  searchInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      const valoreCercato = event.target.value.trim();
      if (valoreCercato !== "") {
        localStorage.setItem(STORAGE_KEY_LAST_SEARCH, valoreCercato);
        window.location.href = "search.html";
      }
    }
  });
}

const showNotFound = () => {
  const msg = document.createElement("p");
  msg.textContent = "Artista non trovato";
  artistHero.replaceChildren(msg);
  topTracks.replaceChildren();
};

const renderHero = (artist, firstTrack) => {
  const listeners = Math.floor(Math.random() * 5_000_000);

  const kicker = document.createElement("p");
  kicker.className = "hero-kicker";
  kicker.textContent = "ARTISTA";

  const title = document.createElement("h1");
  title.className = "hero-title";
  title.textContent = artist.name;

  const sub = document.createElement("p");
  sub.className = "hero-sub";
  sub.textContent = `${artist.genre || "Artista"} · ${listeners.toLocaleString("it-IT")} ascoltatori mensili`;

  const btnPlay = document.createElement("button");
  btnPlay.className = "btn-play-big";
  btnPlay.setAttribute("aria-label", "Play");
  btnPlay.textContent = "▶";
  btnPlay.addEventListener("click", () => player.play(firstTrack));

  const actions = document.createElement("div");
  actions.className = "hero-actions";
  actions.append(btnPlay);

  artistHero.replaceChildren(kicker, title, sub, actions);
};

const renderTopTracks = (tracks) => {
  const rows = tracks.map((track, index) => {
    const num = document.createElement("span");
    num.className = "track-num";
    num.textContent = String(index + 1);

    const trackTitle = document.createElement("span");
    trackTitle.className = "track-title";
    trackTitle.textContent = track.title;

    const time = document.createElement("span");
    time.className = "track-time";
    time.textContent = formatTime(track.durationMs);

    const btnFav = document.createElement("button");
    btnFav.className = "track-fav";
    btnFav.classList.toggle("is-fav", isFavourite(track.id));
    btnFav.setAttribute("aria-label", "Preferito");
    btnFav.textContent = "♥";
    btnFav.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavourite(track);
      btnFav.classList.toggle("is-fav", isFavourite(track.id));
    });

    const row = document.createElement("div");
    row.className = "track-row";
    row.dataset.id = track.id;
    row.append(num, trackTitle, time, btnFav);
    row.addEventListener("click", () => player.play(track));

    return row;
  });

  topTracks.replaceChildren(...rows);
};

const loadArtist = async () => {
  const id = new URLSearchParams(window.location.search).get("id");

  if (!id) {
    showNotFound();
    return;
  }

  const data = await fetchJSON(`${API_BASE}/lookup?id=${id}&entity=song&limit=15`);

  if (!data.results.length) {
    showNotFound();
    return;
  }

  const artist = new Artist(data.results[0]);
  const tracks = data.results.slice(1).map((raw) => new Track(raw));

  if (!tracks.length) {
    showNotFound();
    return;
  }

  renderHero(artist, tracks[0]);
  renderTopTracks(tracks);
};

loadArtist();
