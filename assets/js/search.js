/* ============================================================
   search.js — ricerca con debounce
   ============================================================

   COSA DEVI FARE
   1) initPage("search")
   2) Recupera l'ultima query da localStorage (STORAGE_KEY_LAST_SEARCH).
      Se presente, popola l'input e lancia la ricerca.
   3) Aggancia l'evento "input" all'input #search-input con debounce 400ms.
   4) doSearch(term):
      - se term è vuoto -> nascondi i 3 row e svuota i grid
      - altrimenti fetch in PARALLELO (Promise.all):
          - tracks   = search?term=...&entity=song&limit=12
          - albums   = search?term=...&entity=album&limit=8
          - artists  = search?term=...&entity=musicArtist&limit=8
      - mostra ciascuna sezione solo se i risultati sono > 0
      - salva l'ultima query in localStorage
   5) Per ogni risultato crea una card:
      - track  -> click = player.play(track)
      - album  -> click = window.location.href = "album.html?id=" + albumId
      - artist -> click = window.location.href = "artist.html?id=" + artistId
*/

const player = initPage("search");

const input        = document.querySelector("#search-input");
const rowTracks    = document.querySelector("#row-tracks");
const rowAlbums    = document.querySelector("#row-albums");
const rowArtists   = document.querySelector("#row-artists");
const gridTracks   = document.querySelector("#grid-tracks");
const gridAlbums   = document.querySelector("#grid-albums");
const gridArtists  = document.querySelector("#grid-artists");

const renderTrackCard = (track) => {
  const card = document.createElement("div");
  card.className = "card";

  const imageWrap = document.createElement("div");
  imageWrap.className = "card-image-wrap";
  const img = document.createElement("img");
  img.src = track.cover;
  img.alt = track.title;
  imageWrap.appendChild(img);

  const btnPlay = document.createElement("button");
  btnPlay.className = "card-play";
  btnPlay.setAttribute("aria-label", "Play");
  btnPlay.textContent = "▶";
  btnPlay.addEventListener("click", (event) => {
    event.stopPropagation();
    player.play(track);
  });
  imageWrap.appendChild(btnPlay);

  const btnFav = document.createElement("button");
  btnFav.className = "card-fav";
  btnFav.classList.toggle("is-fav", isFavourite(track.id));
  btnFav.setAttribute("aria-label", "Preferito");
  btnFav.textContent = "♥";
  btnFav.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavourite(track);
    btnFav.classList.toggle("is-fav", isFavourite(track.id));
  });

  const title = document.createElement("p");
  title.className = "card-title";
  title.textContent = track.title;

  const sub = document.createElement("p");
  sub.className = "card-sub";
  sub.textContent = track.artist;

  card.append(imageWrap, btnFav, title, sub);
  card.addEventListener("click", () => player.play(track));

  return card;
};

const renderAlbumCard = (album) => {
  const card = document.createElement("div");
  card.className = "card";

  const imageWrap = document.createElement("div");
  imageWrap.className = "card-image-wrap";
  const img = document.createElement("img");
  img.src = album.cover;
  img.alt = album.title;
  imageWrap.appendChild(img);

  const title = document.createElement("p");
  title.className = "card-title";
  title.textContent = album.title;

  const sub = document.createElement("p");
  sub.className = "card-sub";
  sub.textContent = album.artist;

  card.append(imageWrap, title, sub);
  card.addEventListener("click", () => {
    window.location.href = `album.html?id=${album.id}`;
  });

  return card;
};

const renderArtistCard = (artist) => {
  const card = document.createElement("div");
  card.className = "card";

  const imageWrap = document.createElement("div");
  imageWrap.className = "card-image-wrap round";
  imageWrap.style.display = "grid";
  imageWrap.style.placeItems = "center";
  imageWrap.style.fontSize = "32px";
  imageWrap.textContent = "🎤";

  const title = document.createElement("p");
  title.className = "card-title";
  title.textContent = artist.name;

  const sub = document.createElement("p");
  sub.className = "card-sub";
  sub.textContent = artist.genre || "Artista";

  card.append(imageWrap, title, sub);
  card.addEventListener("click", () => {
    window.location.href = `artist.html?id=${artist.id}`;
  });

  return card;
};

const showRow = (section, grid, items, renderCard) => {
  grid.replaceChildren(...items.map(renderCard));
  section.hidden = items.length === 0;
};

const doSearch = async (term) => {
  if (!term) {
    showRow(rowTracks, gridTracks, [], renderTrackCard);
    showRow(rowAlbums, gridAlbums, [], renderAlbumCard);
    showRow(rowArtists, gridArtists, [], renderArtistCard);
    return;
  }

  localStorage.setItem(STORAGE_KEY_LAST_SEARCH, term);

  const [tracksData, albumsData, artistsData] = await Promise.all([
    fetchJSON(
      `${API_BASE}/search?term=${encodeURIComponent(term)}&entity=song&limit=12`,
    ),
    fetchJSON(
      `${API_BASE}/search?term=${encodeURIComponent(term)}&entity=album&limit=8`,
    ),
    fetchJSON(
      `${API_BASE}/search?term=${encodeURIComponent(term)}&entity=musicArtist&limit=8`,
    ),
  ]);

  showRow(rowTracks, gridTracks, tracksData.results.map((raw) => new Track(raw)), renderTrackCard);
  showRow(rowAlbums, gridAlbums, albumsData.results.map((raw) => new Album(raw)), renderAlbumCard);
  showRow(rowArtists, gridArtists, artistsData.results.map((raw) => new Artist(raw)), renderArtistCard);
};

const debouncedSearch = debounce(doSearch, 400);

input.addEventListener("input", (event) => {
  debouncedSearch(event.target.value.trim());
});

const lastQuery = localStorage.getItem(STORAGE_KEY_LAST_SEARCH);
if (lastQuery) {
  input.value = lastQuery;
  doSearch(lastQuery);
}
