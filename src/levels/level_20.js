function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

class Level20 {
  constructor() {
    this.bounceFrames = 0;      // ile klatek odbicia pozostało
    this.bounceStepY = 0;       // ile pikseli na klatkę
    this.topWalls = [];
    this.bottomWalls = [];
    this.bats = []; // <-- USUNIĘCIE TEJ LINII SPOWODUJE, ŻE BOMBY PIIORUN I ATOMÓWKA, UŻYTE NA LVL BEZ WROGÓW, BĘDĄ POWODOWAŁY ROZBICIE RAKIETY
    this.wallSpeed = -10; // Prędkość przesuwu w lewo, dwukrotnie większa niż u nietoperzy
    this.frameCount = 0; // Licznik klatek
    this.sparkParticles = []; // Tablica na iskry

    // --- NOWE ZMIENNE DLA CZARNYCH DZIUR ---
    this.smallBlackHoles = [];
    this.blackHoleSpawnTimer = 0; // Licznik do następnego spawnu

    this.generateWalls();

    // --- STARTOWA BIAŁA DZIURA ---
    // Ustawiamy ją na środku ekranu
    this.introWhiteHole = new BigWhiteHole(width, height / 2);
    this.introScale = 0; // Zaczyna od zera (punktu)
  }

  generateWalls() {
    this.topWalls = [];
    this.bottomWalls = [];
    let numPoints = 4444; 
    let xStep = 19; // 1920 / 99 = 19.39 czyli w przybliżeniu 19
    
    // DODAJĘ margines startowy korytarzy (np. 500 pikseli)
    let startOffset = 500;

    // ZMIANA: Dodajemy skalę meandrowania (krętość) i mniejszą skalę krawędzi
    let meanderScale = 0.02; // Skala głównych zakrętów korytarza
    let edgeNoiseScale = 0.02; // Drobne falowanie samych krawędzi ścian

    for (let i = 0; i < numPoints; i++) {
      let x = startOffset + (i * xStep); 
      
      // Obliczamy "środek" korytarza, który wygina się w górę i dół
      // noise da wartość 0..1, chcemy od 200px do 880px
      let centerPath = map(noise(i * meanderScale), 0, 1, 200, 880); 
      
      // Obliczamy szerokość korytarza w tym punkcie (np. stałe 450px)
      let corridorWidth = 450; 
      
      // Dodajemy lekkie nieregularności na brzegach skał
      let topNoise = noise(i * edgeNoiseScale) * 50; 
      let bottomNoise = noise((i + 1000) * edgeNoiseScale) * 50;

      // Generujemy ściany względem wyginającego się środka
      let topY = centerPath - (corridorWidth / 2) + topNoise;
      let bottomY = centerPath + (corridorWidth / 2) - bottomNoise;

      this.topWalls.push({ x: x, y: topY, baseY: topY });
      this.bottomWalls.push({ x: x, y: bottomY, baseY: bottomY });
    }
  }

  spawnWallHitSparks(x, y) {
    for (let i = 0; i < 12; i++) {
      this.sparkParticles.push({
        x: x,
        y: y,
        vx: random(-6, -2),   // ZAWSZE w lewo
        vy: random(-2, 2),    // lekki rozrzut pionowy
        life: random(15, 25)
      });
    }
  }


  update() {
    this.frameCount++;

    // --- LOGIKA POJAWIANIA SIĘ MAŁYCH CZARNYCH DZIUR ---
    if (this.frameCount >= 500) {
      if (this.frameCount === 500 || this.blackHoleSpawnTimer <= 0) {
        // Obliczamy pozycję Y na środku korytarza dla aktualnego X (na prawym brzegu ekranu)
        let worldX = this.frameCount * abs(this.wallSpeed) + width;
        let index = worldX / 19.39; 
        let spawnY = map(noise(index * 0.02), 0, 1, 200, 880);

        // Dodajemy nową dziurę (klasa z pliku dziura.js)
        this.smallBlackHoles.push(new SmallBlackHole(width + 100, spawnY));

        // Losujemy czas do następnego pojawienia się (400 - 600 klatek)
        this.blackHoleSpawnTimer = floor(random(400, 600));
      }
      this.blackHoleSpawnTimer--;
    }

// Aktualizacja i kolizje dla każdej małej czarnej dziury
    for (let i = this.smallBlackHoles.length - 1; i >= 0; i--) {
      let hole = this.smallBlackHoles[i];
      
      // ZABEZPIECZENIE: Jeśli ściany już zniknęły, nie sprawdzaj z nimi kolizji
      if (this.topWalls.length === 0) {
        hole.update(null); 
      } else {
        hole.update(this); 
      }

      // Sprawdzenie kolizji
      if (hole.collected(player)) {

          // --- NOWA LOGIKA KARY ---
          // Odejmujemy 100 punktów, ale używamy max(0, ...), 
          // żeby wynik nigdy nie spadł poniżej zera (chyba że chcesz mieć długi!)
          score = max(0, score - 100);

          cave = new Level20();
          return;
      }

      if (hole.x < -100) {
        this.smallBlackHoles.splice(i, 1);
      }
    }

    // Płynne odbicie rakiety od ściany (klatki odbicia)
    if (this.bounceFrames > 0) {
      player.y += this.bounceStepY;
      this.bounceFrames--;
    }

    // Przesuwanie ścian z przyspieszoną prędkością
    for (let wall of this.topWalls) {
      wall.x += this.wallSpeed;
    }
    for (let wall of this.bottomWalls) {
      wall.x += this.wallSpeed;
    }

    // Aktualizacja iskier
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      let spark = this.sparkParticles[i];
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.life--;
      if (spark.life <= 0) this.sparkParticles.splice(i, 1);
    }
    // generowanie w locie
    let xStep = 19.39; // stała wartość
    let meanderScale = 0.02;
    let edgeNoiseScale = 0.02;
    let lastX = this.topWalls[this.topWalls.length - 1].x;
    
    if (lastX < 1920) { // Usunięto limit czasu dla generatora {
      let newX = lastX + xStep;
      let index = this.topWalls.length + 1; // "i" dla funkcji szumu
      
      // Wyliczanie nowego środka i grubości
      let centerPath = map(noise(index * meanderScale), 0, 1, 200, 880);
      let corridorWidth = 450;
      let topNoise = noise(index * edgeNoiseScale) * 50;
      let bottomNoise = noise((index + 1000) * edgeNoiseScale) * 50;

      let topY = centerPath - (corridorWidth / 2) + topNoise;
      let bottomY = centerPath + (corridorWidth / 2) - bottomNoise;

      this.topWalls.push({ x: newX, y: topY, baseY: topY });
      this.bottomWalls.push({ x: newX, y: bottomY, baseY: bottomY });
    }
    // Usuwanie ścian i przeszkód poza lewą krawędzią
    while (this.topWalls[0].x < -width) {
      this.topWalls.shift();
      this.bottomWalls.shift();
    }

    // Płynne dostosowanie krawędzi w czasie rzeczywistym
    let transitionStart = 100; // 100 klatek (ok. 1,7 sekundy przy 60 FPS)
    let transitionDuration = 300; // 5 sekund na zwężanie
    let exitStart = 6700; // Początek rozszerzania
    let exitDuration = 500; // 500 klatek (od 6700 do 7200)
    let isFullyExpanded = false;
    for (let wall of this.topWalls) {
      if (this.frameCount <= transitionStart) {
        wall.y = 0; // Pełna szerokość przez 100 klatek
      } else if (this.frameCount < transitionStart + transitionDuration) {
        let progress = (this.frameCount - transitionStart) / transitionDuration;
        wall.y = lerp(0, wall.baseY, progress); // Płynne przejście do bazowego y
      } else if (this.frameCount >= exitStart && this.frameCount <= 7200) {
        let progress = (this.frameCount - exitStart) / exitDuration;
        wall.y = lerp(wall.baseY, 0, easeInOutQuad(progress)); // Płynne rozszerzanie do pełnej szerokości
      } else if (this.frameCount > 7200) {
        wall.y = 0; // Po 7200 klatkach utrzymaj pełną szerokość
      } else {
        wall.y = wall.baseY; // Standardowa pozycja w trakcie
      }
    }
    for (let wall of this.bottomWalls) {
      if (this.frameCount <= transitionStart) {
        wall.y = height; // Pełna szerokość przez 100 klatek
      } else if (this.frameCount < transitionStart + transitionDuration) {
        let progress = (this.frameCount - transitionStart) / transitionDuration;
        wall.y = lerp(height, wall.baseY, progress); // Płynne przejście do bazowego y
      } else if (this.frameCount >= exitStart && this.frameCount <= 7200) {
        let progress = (this.frameCount - exitStart) / exitDuration;
        wall.y = lerp(wall.baseY, height, easeInOutQuad(progress)); // Płynne rozszerzanie do pełnej szerokości
      } else if (this.frameCount > 7200) {
        wall.y = height; // Po 7200 klatkach utrzymaj pełną szerokość
      } else {
        wall.y = wall.baseY; // Standardowa pozycja w trakcie
      }
    }

    // === STRZAŁY vs GÓRNA ŚCIANA ===
    for (let b = fireController.bullets.length - 1; b >= 0; b--) {
      let bullet = fireController.bullets[b];

      for (let i = 0; i < this.topWalls.length - 1; i++) {
        if (rectRectCollision(
          bullet.x, bullet.y, bullet.width, bullet.height,
          this.topWalls[i].x,
          0,
          this.topWalls[i + 1].x - this.topWalls[i].x,
          this.topWalls[i].y
        )) {
          playSoundTrafieniewPrzeszkode(); //dodaje dźwięk przy strzeleniu w ścianę górną
          this.spawnSparks(bullet.x, bullet.y);
          fireController.bullets.splice(b, 1); // usuwamy strzał
          break;
        }
      }
    }

    // === STRZAŁY vs DOLNA ŚCIANA ===
    for (let b = fireController.bullets.length - 1; b >= 0; b--) {
      let bullet = fireController.bullets[b];

      for (let i = 0; i < this.bottomWalls.length - 1; i++) {
        if (rectRectCollision(
          bullet.x, bullet.y, bullet.width, bullet.height,
          this.bottomWalls[i].x,
          this.bottomWalls[i].y,
          this.bottomWalls[i + 1].x - this.bottomWalls[i].x,
          height - this.bottomWalls[i].y
        )) {
          playSoundTrafieniewPrzeszkode(); //dodaje dźwięk przy strzeleniu w ścianę dolną
          this.spawnSparks(bullet.x, bullet.y);
          fireController.bullets.splice(b, 1);
          break;
        }
      }
    }

    // Kolizje rakiety ze ścianami
    // Kolizje rakiety ze ścianą górną
    for (let i = 0; i < this.topWalls.length - 1; i++) {
      if (rectRectCollision(
        player.x - player.width / 2, player.y - player.height / 2, player.width, player.height,
        this.topWalls[i].x, 0, this.topWalls[i + 1].x - this.topWalls[i].x, this.topWalls[i].y
      )) {

        // --- KLUCZOWA POPRAWKA: UNIEMOŻLIWIENIE WLOTU W ŚCIANĘ górną---
        // Ustawiamy rakietę dokładnie pod ścianą (jej góra = dół ściany + 1px marginesu)
        player.y = this.topWalls[i].y + player.height / 2 + 1;

        // ODBICIE ZAWSZE
        this.bounceFrames = 6; // czas odbicia
        this.bounceStepY = 15; //odległość odbicia

        // wywołuje funkcję iskrzenia w lewo gdy rakieta dotknie ściany
        this.spawnWallHitSparks(player.x - player.width / 2, player.y);

        // TARCZA TYLKO GDY BRAK NIEŚMIERTELNOŚCI
        if (!player.isImmortal) {
          player.shieldPower = max(0, player.shieldPower - 1);
          playSoundKolizjaRakiety();

          if (player.shieldPower <= 0) {
            player.startExplosion();
          }
        }

        break;
      }
    }

    // Kolizje rakiety ze ścianą dolną
    for (let i = 0; i < this.bottomWalls.length - 1; i++) {
      if (rectRectCollision(
        player.x - player.width / 2, player.y - player.height / 2, player.width, player.height,
        this.bottomWalls[i].x, this.bottomWalls[i].y, this.bottomWalls[i + 1].x - this.bottomWalls[i].x, height - this.bottomWalls[i].y
      )) {

        // --- KLUCZOWA POPRAWKA: UNIEMOŻLIWIENIE WLOTU W ŚCIANĘ DOLNĄ ---
        // Ustawiamy rakietę dokładnie nad ścianą (jej dół = góra ściany - 1px marginesu)
        player.y = this.bottomWalls[i].y - player.height / 2 - 1;

        // ODBICIE ZAWSZE
        this.bounceFrames = 6; // czas odbicia
        this.bounceStepY = -15; // odległość odbicia (ujemna, aby odbić rakietę w górę)

        // wywołuje funkcję iskrzenia w lewo gdy rakieta dotknie ściany
        this.spawnWallHitSparks(player.x - player.width / 2, player.y);

        // TARCZA TYLKO GDY BRAK NIEŚMIERTELNOŚCI
        if (!player.isImmortal) {
          player.shieldPower = max(0, player.shieldPower - 1); // zabiera energię tarczy rakiety
          playSoundKolizjaRakiety();

          if (player.shieldPower <= 0) {
            player.startExplosion();
          }
        }

        break;
      }
    }


    // --- NOWY WARUNEK ZAKOŃCZENIA POZIOMU ---
    // Poziom kończy się, gdy minął czas korytarza i ściany w pełni się otworzyły (7200 klatek)
    // Dodajemy mały bufor 120 klatek (2 sekundy), żeby gracz zobaczył otwartą przestrzeń
    if (this.frameCount > 7320) {
      caveTimer = 0; // Ustawienie na 0 w game.js odpala następny poziom
    }

    // Logika startowej białej dziury
    if (this.introWhiteHole) {
      this.introWhiteHole.update();
      
      // Płynne powiększanie (0.02 to ok. 1 sekunda do pełnego rozmiaru przy 60 fps)
      if (this.introScale < 1) {
        this.introScale += 0.02; 
      }
      
      // Dziura przesuwa się razem ze ścianami jaskini
      this.introWhiteHole.x += this.wallSpeed; 
      
      // Gdy zniknie daleko za lewą krawędzią, usuwamy ją, by nie obciążać procesora
      if (this.introWhiteHole.x < -500) {
        this.introWhiteHole = null;
      }
    }
  }

  // Metoda obliczająca bezpieczną pozycję Y w zależności od strefy
  getSafeYPosition(midY, zone) {
    let buffer = 20; // Bufor od ścian
    let y;
    if (zone === 0) y = midY; // Środek
    else if (zone === 1) y = midY - 20; // Trochę powyżej środka
    else if (zone === 2) y = midY + 20; // Trochę poniżej środka
    else if (zone === 3) y = this.topWalls[this.topWalls.length - 1].y + buffer; // Przy górnej krawędzi
    else y = this.bottomWalls[this.bottomWalls.length - 1].y - buffer; // Przy dolnej krawędzi
    return y;
  }

  // Sprawdza, czy korytarz jest szeroki (grota)
  isWideCorridor(midY) {
    let topY = this.topWalls[this.topWalls.length - 1].y;
    let bottomY = this.bottomWalls[this.bottomWalls.length - 1].y;
    let corridorHeight = bottomY - topY;
    return corridorHeight > height * 0.6; // Szeroki, jeśli wysokość > 60% ekranu
  }

  // Metoda sprawdzająca, czy punkt znajduje się w korytarzu
  isPointInCorridor(x, y) {
    let topY = this.topWalls.find(w => w.x <= x)?.y || 0;
    let bottomY = this.bottomWalls.find(w => w.x <= x)?.y || height;
    let buffer = 10; // Bufor, aby uniknąć spawnu zbyt blisko krawędzi
    return y >= topY + buffer && y <= bottomY - buffer && this.isWithinWallSegment(x);
  }

  // Sprawdza, czy x jest w aktualnym segmencie ścian
  isWithinWallSegment(x) {
    let minX = this.topWalls[0].x;
    let maxX = this.topWalls[this.topWalls.length - 1].x;
    return x >= minX && x <= maxX;
  }

  spawnSparks(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
      this.sparkParticles.push({
        x: x,
        y: y,
        vx: random(-2, 2),
        vy: random(-2, 2),
        life: random(15, 30)
      });
    }
  }


// zamiana na shader jaskini- początek
  // pg = warstwa p5.Graphics w trybie WEBGL, przekazana z game.js
  show() {
    // --- 1. TŁO ---
    background(0); // Najpierw czyścimy ekran na czarno[cite: 11]

    // --- 2. RYSOWANIE BIAŁEJ DZIURY (POD ŚCIANAMI) ---
    if (this.introWhiteHole) {
      push();
      translate(this.introWhiteHole.x, this.introWhiteHole.y); //[cite: 11]
      scale(this.introScale); // Płynne skalowanie od zera[cite: 11]
      translate(-this.introWhiteHole.x, -this.introWhiteHole.y); //[cite: 11]
      
      this.introWhiteHole.show(); //[cite: 11]
      pop();
    }

    // --- 3. INICJALIZACJA SHADERA I MASKI JASKINI (WYKONUJE SIĘ TYLKO RAZ) ---
    if (typeof window.caveShaderGfx === 'undefined') {
      window.caveShaderGfx = createGraphics(width, height, WEBGL);
      window.caveShaderGfx.pixelDensity(1);
      window.caveShaderGfx.noStroke();

      window.maskGfx = createGraphics(width, height);
      window.maskGfx.pixelDensity(1);
      window.maskGfx.noStroke();

      const safeVert = `precision mediump float;
      attribute vec3 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vTexCoord;
      uniform mat4 uModelViewMatrix;
      uniform mat4 uProjectionMatrix;
      void main() {
        vTexCoord = aTexCoord;
        gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
      }`;

      const frag = `precision highp float;
      varying vec2 vTexCoord;
      uniform sampler2D uMask;
      uniform float uTime;
      uniform float uOffset;
      uniform vec2 uResolution;
      
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i+vec2(0.0,0.0)), hash(i+vec2(1.0,0.0)), u.x),
                   mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float f = 0.0; float a = 0.5;
        for(int i = 0; i < 4; i++) { f += a * noise(p); p *= 2.0; a *= 0.5; }
        return f;
      }

      void main() {
        vec4 maskColor = texture2D(uMask, vTexCoord);
        
        if (maskColor.r < 0.5) {
          gl_FragColor = vec4(0.0);
          return;
        }

        vec2 pos = vTexCoord * uResolution;
        pos.x += uOffset; 
        
        float n1 = fbm(pos * 0.005);
        float n2 = fbm(pos * 0.015 + vec2(uTime * 2.0, 0.0));
        
        vec3 colorDeep = vec3(0.25, 0.12, 0.05);
        vec3 colorMid = vec3(0.54, 0.27, 0.07);
        vec3 colorLight = vec3(0.65, 0.35, 0.15);
        
        vec3 finalColor = mix(colorDeep, colorMid, n1);
        finalColor = mix(finalColor, colorLight, smoothstep(0.6, 1.0, n2) * 0.5);
        
        float strata = sin(pos.y * 0.05 + n1 * 5.0) * 0.5 + 0.5;
        finalColor *= mix(0.85, 1.1, strata);
        
        gl_FragColor = vec4(finalColor, 1.0);
      }`;

      window.caveShaderInstance = window.caveShaderGfx.createShader(safeVert, frag);
    }

    // --- 4. RYSOWANIE MASKI NA CPU (NATYWNE 2D) ---
    window.maskGfx.clear();
    window.maskGfx.fill(255);

    // Sylwetka górnej ściany
    window.maskGfx.beginShape();
    window.maskGfx.vertex(this.topWalls[0].x, 0); //[cite: 11]
    for (let wall of this.topWalls) {
      window.maskGfx.vertex(wall.x, wall.y); //[cite: 11]
    }
    window.maskGfx.vertex(this.topWalls[this.topWalls.length - 1].x, 0); //[cite: 11]
    window.maskGfx.endShape(CLOSE);

    // Sylwetka dolnej ściany
    window.maskGfx.beginShape();
    window.maskGfx.vertex(this.bottomWalls[0].x, height); //[cite: 11]
    for (let wall of this.bottomWalls) {
      window.maskGfx.vertex(wall.x, wall.y); //[cite: 11]
    }
    window.maskGfx.vertex(this.bottomWalls[this.bottomWalls.length - 1].x, height); //[cite: 11]
    window.maskGfx.endShape(CLOSE);

    // --- 5. RENDEROWANIE SHADERA Z MASKĄ W TLE (GPU) ---
    window.caveShaderGfx.clear();
    window.caveShaderGfx.shader(window.caveShaderInstance);
    window.caveShaderInstance.setUniform('uTime', millis() / 1000.0);
    window.caveShaderInstance.setUniform('uOffset', this.frameCount * abs(this.wallSpeed)); //[cite: 11]
    window.caveShaderInstance.setUniform('uResolution', [width, height]);
    window.caveShaderInstance.setUniform('uMask', window.maskGfx);
    
    window.caveShaderGfx.rect(-width / 2, -height / 2, width, height);

    // Rzutowanie GPU na główne płótno gry
    imageMode(CORNER);
    image(window.caveShaderGfx, 0, 0);

    // --- 6. RYSOWANIE KRAWĘDZI FIZYCZNYCH (Synchronizacja) ---
    stroke(92, 46, 13); // Ciemniejszy kontur z oryginału[cite: 11]
    strokeWeight(2); //[cite: 11]
    noFill();
    
    beginShape();
    for (let wall of this.topWalls) {
      vertex(wall.x, wall.y); //[cite: 11]
    }
    endShape();

    beginShape();
    for (let wall of this.bottomWalls) {
      vertex(wall.x, wall.y); //[cite: 11]
    }
    endShape();

    // --- 7. RENDEROWANIE RESZTY ELEMENTÓW GRY (NA WIERZCHU) ---
    // Iskry
    fill(255, 255, 0); // Żółty kolor iskier[cite: 11]
    noStroke();
    for (let spark of this.sparkParticles) {
      rect(spark.x, spark.y, 2, 2); //[cite: 11]
    }

    // Czarne dziury
    for (let hole of this.smallBlackHoles) {
      hole.show(); //[cite: 11]
    }
    
    noStroke();
  }
// koniec shadera jaskini

  getWalls() {
    let walls = [];
    for (let i = 0; i < this.topWalls.length - 1; i++) {
      walls.push({ x: this.topWalls[i].x, y: 0, width: this.topWalls[i + 1].x - this.topWalls[i].x, height: this.topWalls[i].y });
    }
    for (let i = 0; i < this.bottomWalls.length - 1; i++) {
      walls.push({ x: this.bottomWalls[i].x, y: this.bottomWalls[i].y, width: this.bottomWalls[i + 1].x - this.bottomWalls[i].x, height: height - this.bottomWalls[i].y });
    }
    return walls;
  }
}

// 1. Częstotliwość zakrętów (meanderScale)
// To najważniejszy parametr, o który pytałeś. Decyduje o tym, jak często korytarz zmienia kierunek (góra/dół).

// Co zmienić: let meanderScale = 0.005;

// Jak to działa:

// Zwiększenie (np. 0.01 lub 0.02): Korytarz będzie bardzo "poszarpany", zakręty będą następować jeden po drugim (slalom gigant).

// Zmniejszenie (np. 0.002): Zakręty będą bardzo długie i łagodne (jak szeroka rzeka).

// 2. Amplituda (Głębokość zakrętów)
// To określa, jak blisko krawędzi ekranu (górnej lub dolnej) może podejść cały korytarz.

// Co zmienić: W linii: let centerPath = map(noise(i * meanderScale), 0, 1, 200, 880);

// Jak to działa:

// Większy zakres (np. 100, 980): Korytarz będzie ekstremalnie "nurkował" pod samą dolną krawędź i wspinał się pod sam sufit.

// Mniejszy zakres (np. 400, 680): Korytarz będzie trzymał się blisko środka ekranu.

// 3. Szerokość korytarza (corridorWidth)
// To bezpośrednio wpływa na poziom trudności (miejsce na błąd).

// Co zmienić: let corridorWidth = 450;

// Jak to działa:

// Zmniejszenie (np. 250 - 300): Bardzo ciasno, każdy błąd przy skręcie kończy się kolizją.

// Zwiększenie (np. 600): Bardzo bezpiecznie, dużo miejsca na manewry.

// 4. Chropowatość ścian (edgeNoiseScale)
// To kontroluje "ząbkowanie" skał, czyli drobne nierówności, o które można zahaczyć czubkiem rakiety.

// Co zmienić: let edgeNoiseScale = 0.02; oraz mnożnik * 50 w liniach topNoise / bottomNoise.

// Jak to działa:

// Zwiększenie skali sprawi, że ściany będą wyglądać na bardziej "skaliste" i ostre. Zwiększenie mnożnika (np. * 100) sprawi, że te "zęby" będą głębsze.