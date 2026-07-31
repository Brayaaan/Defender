//zliczanie spacji, zrobię aby przy pierwszej odpalała się automatycznie muzyka,
//bo ona czeka na jaki kolwiek klawisz ze strony użytkownika.
//Zmianie ulegnie również handleStartKeyPress()

let spacePressCount = 0;

// Klasa dla pojedynczej iskierki
class Spark {
  constructor(x, y) {
    this.pos = createVector(x, y);
    // Zmieniamy losowy kierunek na kierunek "na zewnątrz" ramki
    // Przesuwamy punkt startowy nieco na zewnątrz, aby iskierki wylatywały z krawędzi
    this.vel = p5.Vector.random2D().mult(random(1, 3)); // Mniejsza prędkość
    this.lifespan = 150; // Krótszy czas życia dla bardziej subtelnego iskrzenia
    this.size = random(2, 4); // Rozmiar iskierki
  }

  update() {
    this.pos.add(this.vel);
    this.lifespan -= 3; // Szybsze zanikanie
    this.vel.mult(0.95); // Lekkie spowolnienie iskierek
  }

  show() {
    noStroke();
    let alpha = this.lifespan;
    // Kolory żółto-pomarańczowe dla iskierek
    let colorStart = color(255, 200, 0, alpha); // Pomarańczowy
    let colorEnd = color(255, 255, 150, alpha); // Jasnożółty
    let currentColor = lerpColor(colorStart, colorEnd, map(this.lifespan, 0, 150, 1, 0));
    fill(currentColor);
    ellipse(this.pos.x, this.pos.y, this.size);
  }

  isDead() {
    return this.lifespan < 0;
  }
}

// Globalna tablica na iskierki
let sparks = [];

function showStartScreen() {
  // Kontener u góry z nowym tekstem powitalnym
  let topContainerX = width * 0.1;
  let topContainerY = height * 0.05;
  let topContainerWidth = width * 0.8;
  let topContainerHeight = height * 0.1;

  noFill();
  stroke(0, 0, 255);
  strokeWeight(4);
  rect(topContainerX, topContainerY, topContainerWidth, topContainerHeight, 20);

  fill(255);
  noStroke();
  textSize(0.0156 * width);
  textAlign(CENTER, CENTER);
  text("Witaj Obrońco Galaktyki ! - przed Tobą długa droga ku światłu...", topContainerX + topContainerWidth / 2, topContainerY + topContainerHeight / 2);

  // Kontener po lewej stronie ze sterowaniem
  // Definicja powiększenia: potrzebujemy miejsca na 2 nowe linie + 1 linia na odstęp (razem 3 nowe wiersze)
  let INCREASE_UNITS = 3; 
  let INCREASE_HEIGHT = height * 0.05 * INCREASE_UNITS; // Łączne zwiększenie wysokości (3 * 0.05 * height)
  
  // Kontener po lewej stronie ze sterowaniem
  let controlsContainerX = width * 0.1;

  // Zmieniona pozycja Y: Przesunięcie w górę o połowę zwiększonej wysokości (1.5 * 0.05 * height)
  let controlsContainerY = height * 0.25 - (INCREASE_HEIGHT / 2); 

  let controlsContainerWidth = width * 0.35;

  // Zmieniona wysokość: Zwiększenie oryginalnej wysokości (0.55 * height) o obliczoną wartość
  let controlsContainerHeight = height * 0.55 + INCREASE_HEIGHT; 

  noFill();
  stroke(0, 0, 255);
  strokeWeight(4);
  rect(controlsContainerX, controlsContainerY, controlsContainerWidth, controlsContainerHeight, 20);

  fill(255);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(0.0156 * width);
  let textMargin = width * 0.02;

  let yPos = controlsContainerY + textMargin;
  
  // --------------------------------------------------
  // TREŚĆ TEKSTOWA Z NOWYMI LINIAMI I ODSTĘPEM
  // --------------------------------------------------
  text("F 11 - Tryb pełnoekranowy", controlsContainerX + textMargin, yPos);
  yPos += height * 0.05;
  text("Sterowanie:", controlsContainerX + textMargin, yPos);
  yPos += height * 0.05;
  text("Strzałki góra/dół/lewo/prawo - Ruch statku", controlsContainerX + textMargin, yPos);
  yPos += height * 0.05;
  text("Spacja - Strzał laserem", controlsContainerX + textMargin, yPos);
  yPos += height * 0.05;
  text("v - Ogień automatyczny", controlsContainerX + textMargin, yPos);
  yPos += height * 0.05;
  text("B - Bomba", controlsContainerX + textMargin, yPos);
  yPos += height * 0.05;
  // Nowa linia z klawiszami N/M
  text("N, M - Zmiana broni", controlsContainerX + textMargin, yPos); 
  
  // DODATKOWY ODSTĘP: Zwiększamy yPos o jedną jednostkę wysokości
  yPos += height * 0.05 * 2; // Oryginalny odstęp to height * 0.05, dodajemy drugi taki, aby było podwójnie.

  text("Szybkie testowanie poziomów:", controlsContainerX + textMargin, yPos);
  yPos += height * 0.05;
  text("1: Poziom 10, 2: Poziom 11, 3: Poziom 20", controlsContainerX + textMargin, yPos);
  yPos += height * 0.05;
  // Nowa linia z dodatkowymi poziomami testowymi
  text("4: Poziom 21, 5: Poziom 30, 6: Poziom 31", controlsContainerX + textMargin, yPos);
  yPos += height * 0.05;
  text("7: Poziom 40, 8: Poziom 41, 9: Poziom 50", controlsContainerX + textMargin, yPos);

  // Kontener na obraz Echo, z natywnym rysowaniem
  let echoImageContainerWidth = 277;
  let echoImageContainerHeight = 400;
  let echoImageContainerX = width * 0.55;
  let echoImageContainerY = height * 0.25;

  // ----------------------------------------------------------------------
  // NAPIS "PRZEKAZ OD ECHO:" Z EFEKTEM JARZENIA (Pulsowanie)
  // ----------------------------------------------------------------------
  let echoTxt = "Przekaz od Echo:";
  let echoTxtX = echoImageContainerX + echoImageContainerWidth / 2; // Wyśrodkowany nad kontenerem
  let echoTxtY = echoImageContainerY - 30; // 30 pikseli nad górną krawędzią kontenera Echo

  // Używamy unikalnych nazw, aby uniknąć błędu 'alpha has already been declared'
  let echoAlpha = map(sin(frameCount * 0.05), -1, 1, 50, 255); 
  let echoPulseWeight = map(sin(frameCount * 0.05), -1, 1, 1, 4);

  textSize(width * 0.0156); // Trochę większy rozmiar
  textAlign(CENTER, CENTER);

  // Jarzenie (poprzez pulsujący obrys)
  stroke(0, 0, 255, echoAlpha); // Niebieski, pulsujący kolor obrysu
  strokeWeight(echoPulseWeight);
  fill(255); // Biały kolor wypełnienia
  
  text(echoTxt, echoTxtX, echoTxtY);
  
  // WAŻNE: Po narysowaniu napisu, należy wyłączyć obrys
  noStroke(); 

  // Rysowanie obrazu pod ramką
  if (typeof window.EchoImage !== 'undefined' && window.EchoLoaded) {
      let ctx = drawingContext;
      ctx.drawImage(window.EchoImage,
                    echoImageContainerX + 5,
                    echoImageContainerY + 5,
                    echoImageContainerWidth - 10,
                    echoImageContainerHeight - 10);
  } else {
      fill(255);
      noStroke();
      textSize(width * 0.012);
      textAlign(CENTER, CENTER);
      text("Nieudane ładowanie obrazu Echo...",
           echoImageContainerX + echoImageContainerWidth / 2,
           echoImageContainerY + echoImageContainerHeight / 2);
  }

  // Sprawdzanie, czy myszka jest wewnątrz kontenera
  let isMouseOverEchoContainer = mouseX > echoImageContainerX &&
                                 mouseX < echoImageContainerX + echoImageContainerWidth &&
                                 mouseY > echoImageContainerY &&
                                 mouseY < echoImageContainerY + echoImageContainerHeight;

  // Rysowanie standardowej niebieskiej ramki (zawsze)
  noFill();
  stroke(0, 0, 255); // Standardowy niebieski kolor ramki
  strokeWeight(4);   // Standardowa grubość ramki
  rect(echoImageContainerX, echoImageContainerY, echoImageContainerWidth, echoImageContainerHeight, 20);

  // Generowanie iskierek tylko po najechaniu myszką
  if (isMouseOverEchoContainer) {
    // Generowanie nowych iskierek wzdłuż krawędzi ramki
    for (let i = 0; i < 2; i++) { // Generujemy mniej iskierek na klatkę dla subtelniejszego efektu
        let x, y;
        // Losowy punkt na obwodzie ramki
        let side = floor(random(4));
        if (side === 0) { // Top edge
            x = random(echoImageContainerX, echoImageContainerX + echoImageContainerWidth);
            y = echoImageContainerY;
        } else if (side === 1) { // Right edge
            x = echoImageContainerX + echoImageContainerWidth;
            y = random(echoImageContainerY, echoImageContainerY + echoImageContainerHeight);
        } else if (side === 2) { // Bottom edge
            x = random(echoImageContainerX, echoImageContainerX + echoImageContainerWidth);
            y = echoImageContainerY + echoImageContainerHeight;
        } else { // Left edge
            x = echoImageContainerX;
            y = random(echoImageContainerY, echoImageContainerY + echoImageContainerHeight);
        }
        sparks.push(new Spark(x, y));
    }
  }
  
  // Aktualizacja i rysowanie iskierek
  for (let i = sparks.length - 1; i >= 0; i--) {
      sparks[i].update();
      sparks[i].show();
      if (sparks[i].isDead()) {
          sparks.splice(i, 1);
      }
  }
  
  // Napis "Naciśnij SPACJĘ aby rozpocząć" z wolniejszym, pulsującym tekstem
  let txt = "Naciśnij SPACJĘ aby rozpocząć";
  let txtX = width / 2;
  let txtY = height * 0.9 + 15;

  textSize(0.02 * width);
  let alpha = map(sin(frameCount * 0.05), -1, 1, 50, 255);
  let pulseWeight = map(sin(frameCount * 0.05), -1, 1, 1, 4);

  for (let i = 0; i < txt.length; i++) {
    let char = txt.charAt(i);
    let charWidth = textWidth(char);
    let charX = txtX - textWidth(txt) / 2 + textWidth(txt.substring(0, i)) + charWidth / 2;
    stroke(0, 0, 255, alpha);
    strokeWeight(pulseWeight);
    fill(255);
    text(char, charX, txtY);
  }
  noStroke();
}

function showNameInputScreen() {
  textSize(0.0156 * width);
  fill(255);
  textAlign(CENTER);
  text("Jak się nazywasz, pilocie?", width / 2, 0.4 * height);
  text(inputText + "|", width / 2, 0.5 * height);
  text("Naciśnij Enter, aby rozpocząć grę", width / 2, 0.6 * height);
}

function handleStartKeyPress() {
  if (gameState === 'start' && keyIsPressed) {
    // Obsługa spacji (muzyka + start gry)
    if (keyCode === 32) {
      spacePressCount++;

      if (spacePressCount === 1) {
        playEchoMusic();

      } else if (spacePressCount === 2) {
        gameState = 'nameInput';
        inputText = '';
        spacePressCount = 0; // Zresetuj licznik

      }
    } 
    // Obsługa klawiszy do testowania poziomów
    else if (keyCode === 49) { // Klawisz '1'
      startTestLevel(10);
    } else if (keyCode === 50) { // Klawisz '2'
      startTestLevel(11);
    } else if (keyCode === 51) { // Klawisz '3'
      startTestLevel(20);
    } else if (keyCode === 52) { // Klawisz '4' - DODANY
      startTestLevel(21);
    } else if (keyCode === 53) { // Klawisz '5' - DODANY
      startTestLevel(30);
    } else if (keyCode === 54) { // Klawisz '6' - DODANY
      startTestLevel(31);
    } else if (keyCode === 55) { // Klawisz '7' - DODANY
      startTestLevel(40);

  //tymczasowy test poziomu 39 po naciśnięciu l
    } else if (keyCode === 76) { // Klawisz 'l' - DODANY
      startTestLevel(39);


    } 
    // Obsługa trybu pełnoekranowego
    else if ((key === 'F' || key === 'f')) {
      let fs = fullscreen();
      fullscreen(!fs);
    }
  }
}
function handleNameInputKeyPress() {
  if (keyCode === ENTER) {
    playerName = inputText || 'Pilot';
    gameState = 'playing';
    resetGame();
    loop();

  }
  if (keyCode === BACKSPACE && inputText.length > 0) {
    inputText = inputText.slice(0, -1);
  }
}

function handleNameInputKeyTyped() {
  if (inputText.length < 20) {
    // Sprawdzamy, czy klawisz składa się z jednego znaku (litery, cyfry, symbole, spacja)
    // Dzięki temu ignorujemy klawisze sterujące jak Shift, Alt, Ctrl
    if (key.length === 1) {
      inputText += key;
    }
  }
}

// Funkcja obsługi kliknięcia myszy
function mouseClicked() {
  // Sprawdzanie, czy kliknięcie nastąpiło na ekranie startowym
  if (gameState === 'start') {
    let echoImageContainerX = width * 0.55;
    let echoImageContainerY = height * 0.25;
    let echoImageContainerWidth = 247;
    let echoImageContainerHeight = 400;

    let isMouseOver = mouseX > echoImageContainerX &&
                     mouseX < echoImageContainerX + echoImageContainerWidth &&
                     mouseY > echoImageContainerY &&
                     mouseY < echoImageContainerY + echoImageContainerHeight;
    
    // Jeśli kliknięto w kontener, otwórz nowy plik HTML
    if (isMouseOver) {
      window.open('src/animacja/Animacja_Echo.html', '_self');
    }
  }
}