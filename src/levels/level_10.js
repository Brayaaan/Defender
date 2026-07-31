function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

class Level10 {
  constructor() {
    this.bounceFrames = 0;  // ile klatek odbicia pozostało - płynne odbicie od ścian jaskini
    this.bounceStepY = 0;   // ile pikseli na klatkę - płynne odbicie od ścian jaskini
    this.topWalls = [];
    this.bottomWalls = [];
    this.obstacles = [];
    this.bats = []; // Tablica na nietoperze
    this.wallSpeed = -4; // Prędkość przesuwu w lewo, dwukrotnie przyspieszona
                                       // przy zmianie przydałoby się zmienić odpowiednio liczbę klatek
                                       // w linii let numPoints = 2222;
    this.frameCount = 0; // Licznik klatek
    this.sparkParticles = []; // Tablica na iskry
    this.generateWalls();
    this.generateObstacles();

  }

  generateWalls() {
    this.topWalls = [];
    this.bottomWalls = [];

    let numPoints = 2222;   // Zwiększono do ok. 2 minut przy aktualnej prędkości
    let xStep = width / 99; // Początkowa gęstość
    let noiseScale = 0.02;  // Przywrócono oryginalną skalę szumu

    let minCorridor = height * 0.6;   // minimalna wysokość korytarza
    let maxCorridor = height * 0.9;    // maksymalna wysokość korytarza

    for (let i = 0; i < numPoints; i++) {
      let x = i * xStep;

      // ŚRODEK KORYTARZA — może przekraczać środek ekranu
      let centerY = noise(i * noiseScale) * height;

      // WYSOKOŚĆ KORYTARZA
      let corridorHeight = map(
        noise((i + 5000) * noiseScale),
        0, 1,
        minCorridor,
        maxCorridor
      );

      let topY = centerY - corridorHeight / 2;
      let bottomY = centerY + corridorHeight / 2;

      // ZABEZPIECZENIE przed wyjściem poza ekran
      topY = constrain(topY, 0, height - minCorridor);
      bottomY = constrain(bottomY, minCorridor, height);

      this.topWalls.push({ x: x, y: topY, baseY: topY });
      this.bottomWalls.push({ x: x, y: bottomY, baseY: bottomY });
    }
  }

  // iskry ze ścian przy zderzeniu z rakietą- zawsze iskry w lewo
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

  generateObstacles() {
    let interval = 50; // Skrócony interwał dla większej liczby przeszkód
    let obstacleWidth = 30; // Szerokość skały
    let minLength = 50; // Minimalna długość skały
    let maxLength = 150; // Maksymalna długość skały
    let buffer = 40; // Bufor od ścian
    for (let i = 300; i < 2222; i += interval) {
      let x = i * (width / 99);
      let length = random(minLength, maxLength);
      let midY = (this.topWalls[i].y + this.bottomWalls[i].y) / 2; // Środek korytarza
      let zone = floor(random(5)); // Losowa strefa (0-4)
      let y = this.getSafeYPosition(midY, zone);
      if (this.isPointInCorridor(x, y - length / 2) && this.isPointInCorridor(x, y + length / 2)) {
        this.obstacles.push(new Obstacle(x, y, obstacleWidth, length));
      }
    }
  }

  update() {
    this.frameCount++;

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
    // Przesuwanie przeszkód
    for (let obstacle of this.obstacles) {
      obstacle.x += this.wallSpeed;
    }

    // Przesuwanie nietoperzy i zabezpieczenie przed wlatywaniem w ściany
    for (let bat of this.bats) {
      bat.update(this.wallSpeed);
      
      // Znajdowanie właściwego segmentu ściany dla aktualnej pozycji X nietoperza
      let topWall = this.topWalls.find(w => w.x >= bat.x) || this.topWalls[this.topWalls.length - 1];
      let botWall = this.bottomWalls.find(w => w.x >= bat.x) || this.bottomWalls[this.bottomWalls.length - 1];
      
      // Margines bezpieczeństwa (w pikselach), aby skrzydła nietoperza nie wchodziły w teksturę ściany
      let buffer = 25; 
      
      // Ograniczenie pozycji Y nietoperza do bezpiecznego korytarza
      bat.y = constrain(bat.y, topWall.y + buffer, botWall.y - buffer);
    }

    // Aktualizacja iskier
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      let spark = this.sparkParticles[i];
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.life--;
      if (spark.life <= 0) this.sparkParticles.splice(i, 1);
    }
    // Ciągłe generowanie nowych punktów po prawej stronie
    let xStep = width / 99;
    let noiseScale = 0.02;
    let lastX = this.topWalls[this.topWalls.length - 1].x;
    if (lastX < width) {
      let newX = lastX + xStep;
      let topY = noise((this.topWalls.length + 1) * noiseScale) * 0.5 * height;
      let bottomY = height - noise((this.topWalls.length + 1 + 1000) * noiseScale) * 0.5 * height;
      this.topWalls.push({ x: newX, y: topY, baseY: topY });
      this.bottomWalls.push({ x: newX, y: bottomY, baseY: bottomY });
    }
    // Generowanie nowych przeszkód co 50 klatek po 400 klatkach
    if (this.frameCount >= 400 && this.frameCount < 6700 && this.frameCount % 50 === 0) {
      let x = this.topWalls[this.topWalls.length - 1].x + xStep;
      let midY = (this.topWalls[this.topWalls.length - 1].y + this.bottomWalls[this.bottomWalls.length - 1].y) / 2;
      let isWideCorridor = this.isWideCorridor(midY);
      let numObstacles = isWideCorridor ? 2 : 1; // Dwie przeszkody w szerokich korytarzach
      let maxLength = isWideCorridor ? 200 : 150; // Większa długość w grotach
      for (let i = 0; i < numObstacles; i++) {
        let length = random(50, maxLength);
        let zone = floor(random(5)); // Losowa strefa (0-4)
        let y = this.getSafeYPosition(midY, zone);
        if (this.isPointInCorridor(x, y - length / 2) && this.isPointInCorridor(x, y + length / 2)) {
          this.obstacles.push(new Obstacle(x, y, 30, length));
        }
      }
    }
    // Usuwanie ścian i przeszkód poza lewą krawędzią
    while (this.topWalls[0].x < -width) {
      this.topWalls.shift();
      this.bottomWalls.shift();
    }
    while (this.obstacles.length > 0 && this.obstacles[0].x + this.obstacles[0].length < -width) {
      this.obstacles.shift();
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
          player.shieldPower = max(0, player.shieldPower - 1); // zabiera energię tarczy rakiety
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


    // Kolizje rakiety z przeszkodami
    for (let obstacle of this.obstacles) {
      if (rectRectCollision(
        player.x - player.width / 2, player.y - player.height / 2, player.width, player.height,
        obstacle.x, obstacle.y - obstacle.length / 2, obstacle.width, obstacle.length
      ) && !player.isImmortal) {
        player.takeDamage(20); // Zabiera 20% tarczy
        playSoundKolizjaRakiety();
        if (player.shieldPower <= 0) {
          player.startExplosion();
        }
        break;
      }
    }


    // Generowanie nowych nietoperzy losowo co 25, 50, 75 lub 100 klatek po 400
    if (this.frameCount > 400 && this.frameCount < 6700 && this.topWalls.length > 0) {
      let randomInterval = random([25, 50, 75, 100]);
      if (this.frameCount % randomInterval === 0) {
        let x = width + 50;
        
        // ZNAJDYWANIE WŁAŚCIWEGO SEGMENTU ŚCIANY DLA KOLEJNYCH NIETOPERZY
        let topWall = this.topWalls.find(w => w.x >= x) || this.topWalls[this.topWalls.length - 1];
        let botWall = this.bottomWalls.find(w => w.x >= x) || this.bottomWalls[this.bottomWalls.length - 1];
        
        let topY = topWall.y;
        let bottomY = botWall.y;
        let midY = (topY + bottomY) / 2;
        
        let maxOffset = max(0, (bottomY - topY) / 2 - 30); 
        let y = midY + random(-maxOffset, maxOffset); 
        
        this.bats.push(new Bat(this, x, y));

      }
    }

    // === STRZAŁY vs NIETOPERZE ===
    // Używamy fireController.bullets, bo to tam żyją Twoje strzały
    for (let b = fireController.bullets.length - 1; b >= 0; b--) {
      let bullet = fireController.bullets[b];

      for (let j = 0; j < this.bats.length; j++) {
       let bat = this.bats[j];

        // Sprawdzamy czy pocisk trafił nietoperza i czy nietoperz nie jest już w trakcie wybuchu
        if (bat.explosionFrame === 0 && bat.hitByBullet(bullet)) {
      
          // 1. EFEKTY (to co chciałeś dodać)


 

          // 2. LOGIKA NIETOPERZA
          //bat.explode(); 

          // 3. USUNIĘCIE POCISKU (tak samo jak przy ścianie)
          fireController.bullets.splice(b, 1);
      
          break; // Przerywamy sprawdzanie innych nietoperzy dla tego konkretnego pocisku
        }
      }
    }

    // Kolizja rakiety z nietoperzami
    for (let bat of this.bats) {
      if (rectRectCollision(
        player.x - player.width / 2, player.y - player.height / 2, player.width, player.height,
        bat.x - bat.width / 2, bat.y - bat.height / 2, bat.width, bat.height
      ) && !player.isImmortal) {
        player.takeDamage(20); // Zabiera 20% tarczy
        playSoundKolizjaRakiety();

        // wywołuje funkcję iskrzenia w lewo gdy rakieta dotknie ściany
        this.spawnSparks(player.x + 40, player.y);

        // Odbicie o wektor o długości 80 z losowym pionowym przesunięciem ±40
        let verticalOffset = random(-40, 40); // Losowy ruch pionowy w zakresie ±40
        bat.x += 80; // Pozioma część wektora (80 pikseli w prawo)
        bat.y += verticalOffset; // Pionowa część wektora

        if (player.shieldPower <= 0) {   //jeżeli tarcza spadnie do zera przy kolizji ześcianą to ma się załączyć animacja wybuchu rakiety
          player.startExplosion();
        }

        break;
      }
    }

    // Kolizja rakiety z pociskami nietoperzy
    for (let bullet of enemyBullets) {
      if (bullet.hits(player) && !player.isImmortal) {
        player.takeDamage(5); // Zabiera 5% tarczy
        playSoundKolizjaRakiety();
        let index = enemyBullets.indexOf(bullet);
        if (index !== -1) enemyBullets.splice(index, 1);

        if (player.shieldPower <= 0) {   //jeżeli tarcza spadnie do zera przy kolizji ześcianą to ma się załączyć animacja wybuchu rakiety
          player.startExplosion();
        }

        break;
      }
    }
    // Usuwamy tylko te, które wyleciały za ekran LUB są martwe po zakończeniu wybuchu
    this.bats = this.bats.filter(bat => bat.x + bat.width / 2 > 0 && !bat.isDead);
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

  // pojawianie się iskier w prawo
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
  show(pg) {
    background(0);

    // --- 1. INICJALIZACJA SHADERA I MASKI (WYKONUJE SIĘ TYLKO RAZ) ---
    if (typeof window.caveShaderGfx === 'undefined') {
      window.caveShaderGfx = createGraphics(width, height, WEBGL);
      window.caveShaderGfx.pixelDensity(1); // KLUCZOWE DLA SYNCHRONIZACJI CO DO PIKSELA
      window.caveShaderGfx.noStroke();

      window.maskGfx = createGraphics(width, height);
      window.maskGfx.pixelDensity(1); // KLUCZOWE DLA SYNCHRONIZACJI CO DO PIKSELA
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
        // Poprawka: Usunięto 1.0 - vTexCoord.y. 
        // p5.js sam odwraca płótno. Teraz współrzędne GPU idealnie pokryją się z CPU.
        vec4 maskColor = texture2D(uMask, vTexCoord);
        
        // Odrzucamy puste miejsce
        if (maskColor.r < 0.5) {
          gl_FragColor = vec4(0.0);
          return;
        }

        // Renderowanie geologii tylko w obszarach białej maski
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

    // --- 2. RYSOWANIE MASKI NA CPU (NATYWNE 2D) ---
    window.maskGfx.clear();
    window.maskGfx.fill(255);

    // Sylwetka górnej ściany
    window.maskGfx.beginShape();
    window.maskGfx.vertex(this.topWalls[0].x, 0);
    for (let wall of this.topWalls) {
      window.maskGfx.vertex(wall.x, wall.y);
    }
    window.maskGfx.vertex(this.topWalls[this.topWalls.length - 1].x, 0);
    window.maskGfx.endShape(CLOSE);

    // Sylwetka dolnej ściany
    window.maskGfx.beginShape();
    window.maskGfx.vertex(this.bottomWalls[0].x, height);
    for (let wall of this.bottomWalls) {
      window.maskGfx.vertex(wall.x, wall.y);
    }
    window.maskGfx.vertex(this.bottomWalls[this.bottomWalls.length - 1].x, height);
    window.maskGfx.endShape(CLOSE);

    // --- 3. RENDEROWANIE SHADERA Z MASKĄ W TLE (GPU) ---
    window.caveShaderGfx.clear();
    window.caveShaderGfx.shader(window.caveShaderInstance);
    window.caveShaderInstance.setUniform('uTime', millis() / 1000.0);
    window.caveShaderInstance.setUniform('uOffset', this.frameCount * abs(this.wallSpeed));
    window.caveShaderInstance.setUniform('uResolution', [width, height]);
    window.caveShaderInstance.setUniform('uMask', window.maskGfx);
    
    window.caveShaderGfx.rect(-width / 2, -height / 2, width, height);

    // Rzutowanie GPU na główne płótno gry
    imageMode(CORNER);
    image(window.caveShaderGfx, 0, 0);

    // --- 4. RYSOWANIE KRAWĘDZI FIZYCZNYCH (Dla potwierdzenia synchronizacji) ---
    stroke(92, 46, 13);
    strokeWeight(2);
    noFill();
    
    beginShape();
    for (let wall of this.topWalls) {
      vertex(wall.x, wall.y);
    }
    endShape();

    beginShape();
    for (let wall of this.bottomWalls) {
      vertex(wall.x, wall.y);
    }
    endShape();

    // --- 5. RENDEROWANIE RESZTY ELEMENTÓW GRY ---
    for (let obstacle of this.obstacles) {
      obstacle.show();
    }
    
    fill(255, 255, 0); 
    noStroke();
    for (let spark of this.sparkParticles) {
      rect(spark.x, spark.y, 2, 2);
    }

    for (let bat of this.bats) {
      bat.show(pg);
    }
    
    for (let bullet of enemyBullets) {
      bullet.show();
    }
    
    noStroke();
  }
// zamiana na shader jaskini- koniec


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

  isLevelComplete() {
  // Poziom kończy się tylko, gdy nie ma wrogów i nie ma już żadnych pocisków w locie
    return this.bats.length === 0 && enemyBullets.length === 0;
  }

}