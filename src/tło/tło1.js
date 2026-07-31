class Background {
  constructor() {
    this.stars = [];
    this.initStars(); // Przenosimy tworzenie gwiazd do osobnej metody
  }

  // NOWA METODA: Inicjalizacja gwiazd
  initStars() {
    this.stars = [];
    // Tworzymy więcej gwiazd (np. 200), żeby na dużym ekranie nie było pusto
    for (let i = 0; i < 200; i++) {
      this.stars.push({
        x: random(windowWidth), // Używamy windowWidth zamiast width
        y: random(windowHeight),
        speed: random(0.1, 0.5)
      });
    }
  }

  show() {
    background(0);
    fill(255);
    noStroke();
    for (let star of this.stars) {
      // Jeśli gwiazda z jakiegoś powodu wypadła poza pionowy zakres (np. po zmianie okna)
      // to rysujemy ją tylko w widocznym obszarze
      ellipse(star.x, star.y, 2, 2);
    }
  }

  update() {
    for (let star of this.stars) {
      star.x -= star.speed;
      
      // POPRAWKA: Jeśli gwiazda wyjdzie za lewą krawędź, wraca na prawą krawędź AKTUALNEJ szerokości
      if (star.x < 0) {
        star.x = width;
        star.y = random(height); // Przy okazji losujemy nową wysokość, żeby tło było dynamiczne
      }
    }
  }
}