// Obraz wczytywany natywnie
window.kraksaImage = new Image();
window.kraksaLoaded = false;

window.kraksaImage.onload = () => {
  window.kraksaLoaded = true;
  console.log("Obraz kraksa.png załadowany");
};
window.kraksaImage.onerror = (e) => {
  console.error("Błąd ładowania kraksa.png", e);
};

window.kraksaImage.src = "src/foto/przegrany/kraksa.png";