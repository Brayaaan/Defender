function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

class Level40 {
  constructor() {

    this.bounceFrames = 0;      // ile klatek odbicia pozostało
    this.bounceStepY = 0;       // ile pikseli na klatkę
    this.topWalls = [];
    this.bottomWalls = [];
    
    // ZMIANA: Tablica pająków zamiast nietoperzy
    this.spiders = [];
    this.webs = []; // Tablica na niezależne pajęczyny i kokony
    
    // Prędkość przesuwu ścian w lewo, było this.wallSpeed = -0.00312 * width; Prędkość przesuwu w lewo
    //to powodowało zwielokrotniony obraz wroga, więc zmieniłem na stałą liczbę:
    this.wallSpeed = -3;
    this.frameCount = 0; // Licznik klatek
    this.sparkParticles = []; // Tablica na iskry
    
    // TIMER: Pierwszy pająk po 5 sekundach (300 klatek)
    this.spawnTimer = 300; 

    this.generateWalls();

  }

  generateWalls() {
    this.topWalls = [];
    this.bottomWalls = [];

    let numPoints = 2222;
    let xStep = width / 99;
    let noiseScale = 0.02;

    let minCorridor = height * 0.6;   // minimalna wysokość korytarza
    let maxCorridor = height * 0.9;    // maksymalna wysokość korytarza

    for (let i = 0; i < numPoints; i++) {
      let x = i * xStep;

      // ŚRODEK KORYTARZA
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

      // ZABEZPIECZENIE
      topY = constrain(topY, 0, height - minCorridor);
      bottomY = constrain(bottomY, minCorridor, height);

      this.topWalls.push({ x: x, y: topY, baseY: topY });
      this.bottomWalls.push({ x: x, y: bottomY, baseY: bottomY });
    }
  }

  update() {
    this.frameCount++;

    // --- 1. LOGIKA SPAWNU PAJĄKÓW ---
    // ZMIANA: Pająki pojawiają się i odliczają czas tylko do klatki 6700
    if (this.frameCount <= 6700) {
      this.spawnTimer--;
      if (this.spawnTimer <= 0) {
        this.spawnSpider();
        
        // Losujemy kolejny czas pojawienia się (z zestawu 2, 3, 5, 6 sekund)
        let intervals = [2, 3, 5, 6];
        let chosenInterval = random(intervals); 
        this.spawnTimer = chosenInterval * 60; 
      }
    }

    // --- 2. RUCH ŚCIAN ---
    // Płynne odbicie rakiety od ściany
    if (this.bounceFrames > 0) {
      player.y += this.bounceStepY;
      this.bounceFrames--;
    }

    for (let wall of this.topWalls) wall.x += this.wallSpeed;
    for (let wall of this.bottomWalls) wall.x += this.wallSpeed;

    // --- 3. ISKRY ---
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      let spark = this.sparkParticles[i];
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.life--;
      if (spark.life <= 0) this.sparkParticles.splice(i, 1);
    }

    // --- 4. GENEROWANIE NOWYCH PUNKTÓW ŚCIAN ---
    let xStep = width / 99;
    let noiseScale = 0.02;
    let lastX = this.topWalls[this.topWalls.length - 1].x;
    if (lastX < width && this.frameCount <= 7200) {
      let newX = lastX + xStep;
      let topY = noise((this.topWalls.length + 1) * noiseScale) * 0.5 * height;
      let bottomY = height - noise((this.topWalls.length + 1 + 1000) * noiseScale) * 0.5 * height;
      this.topWalls.push({ x: newX, y: topY, baseY: topY });
      this.bottomWalls.push({ x: newX, y: bottomY, baseY: bottomY });
    }

    while (this.topWalls[0].x < -width) {
      this.topWalls.shift();
      this.bottomWalls.shift();
    }

    // --- 5. LOGIKA ROZSZERZANIA (LEVEL END) ---
    let transitionStart = 100;
    let transitionDuration = 300;
    let exitStart = 6700;
    let exitDuration = 500;

    for (let wall of this.topWalls) { 
       if (this.frameCount <= transitionStart) wall.y = 0;
       else if (this.frameCount < transitionStart + transitionDuration) {
         let p = (this.frameCount - transitionStart) / transitionDuration;
         wall.y = lerp(0, wall.baseY, p);
       } else if (this.frameCount >= exitStart && this.frameCount <= 7200) {
         let p = (this.frameCount - exitStart) / exitDuration;
         wall.y = lerp(wall.baseY, 0, easeInOutQuad(p));
       } else if (this.frameCount > 7200) wall.y = 0;
       else wall.y = wall.baseY;
    }
    for (let wall of this.bottomWalls) { 
       if (this.frameCount <= transitionStart) wall.y = height;
       else if (this.frameCount < transitionStart + transitionDuration) {
         let p = (this.frameCount - transitionStart) / transitionDuration;
         wall.y = lerp(height, wall.baseY, p);
       } else if (this.frameCount >= exitStart && this.frameCount <= 7200) {
         let p = (this.frameCount - exitStart) / exitDuration;
         wall.y = lerp(wall.baseY, height, easeInOutQuad(p));
       } else if (this.frameCount > 7200) wall.y = height;
       else wall.y = wall.baseY;
    }

    // --- 6. AKTUALIZACJA PAJĄKÓW ---
    for (let i = this.spiders.length - 1; i >= 0; i--) {
      let spider = this.spiders[i];
      spider.update(this.wallSpeed);

      // Kolizje z pociskami gracza
      if (typeof fireController !== 'undefined') {
        for (let bullet of fireController.bullets) {
          if (spider.hitByBullet(bullet)) {
            bullet.active = false; 
          }
        }
      }

      // Usuwanie martwych lub tych, co uciekli za ekran
      if (spider.isDead || spider.x < -100) {
        this.spiders.splice(i, 1);
      }
    }

    // --- 6a. AKTUALIZACJA NIEZALEŻNYCH PAJĘCZYN I KOKONÓW ---
    if (!this.webs) this.webs = [];
    for (let i = this.webs.length - 1; i >= 0; i--) {
      this.webs[i].update(this.wallSpeed);
      if (this.webs[i].isOffScreen()) {
        this.webs.splice(i, 1);
      }
    }


    // --- 7. KOLIZJE ZE ŚCIANAMI ---
    // STRZAŁY vs GÓRNA ŚCIANA
    for (let b = fireController.bullets.length - 1; b >= 0; b--) {
      let bullet = fireController.bullets[b];
      for (let i = 0; i < this.topWalls.length - 1; i++) {
        if (rectRectCollision(bullet.x, bullet.y, bullet.width, bullet.height,this.topWalls[i].x,0,this.topWalls[i + 1].x - this.topWalls[i].x,this.topWalls[i].y)) {
          playSoundTrafieniewPrzeszkode();
          this.spawnSparks(bullet.x, bullet.y);
          fireController.bullets.splice(b, 1);
          break;
        }
      }
    }
    // --- 8. STRZAŁY vs DOLNA ŚCIANA
    for (let b = fireController.bullets.length - 1; b >= 0; b--) {
      let bullet = fireController.bullets[b];
      for (let i = 0; i < this.bottomWalls.length - 1; i++) {
        if (rectRectCollision(bullet.x, bullet.y, bullet.width, bullet.height,this.bottomWalls[i].x,this.bottomWalls[i].y,this.bottomWalls[i + 1].x - this.bottomWalls[i].x,height - this.bottomWalls[i].y)) {
          playSoundTrafieniewPrzeszkode();
          this.spawnSparks(bullet.x, bullet.y);
          fireController.bullets.splice(b, 1);
          break;
        }
      }
    }

    // Kolizje rakiety ze ścianami
    // 9. Kolizje rakiety ze ścianą górną
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



    // --- 11. Zakończenie poziomu
    if (this.frameCount > 7200) {
      try {
        currentLevel = new Level41_49();

      } catch (e) {
        gameState = 'win';

      }
    }
  }

  spawnSpider() {
      // --- Logika dla Spider1 (Górna ściana) ---
      let spawnX1 = width + 100;
      let wallTop = this.topWalls.find(w => w.x >= spawnX1 - 50);
      let startY1 = wallTop ? wallTop.y : 0;
      this.spiders.push(new Spider1(this, spawnX1, startY1));

      // --- LOGIKA DLA SPIDER2 (Dolna ściana) ---
      // 60 pikseli za prawą krawędzią ekranu
      let spawnX2 = width + 60; 
    
      // Znajdujemy punkt na dolnej ścianie dla tej pozycji
      let wallBottom = this.bottomWalls.find(w => w.x >= spawnX2 - 50);
      let startY2 = wallBottom ? wallBottom.y : height;

      // Tworzymy pająka Spider2
      let s2 = new Spider2(this, spawnX2, startY2);
    
      // WYTYCZNA: Zmiana kierunku marszu na przeciwny (w lewo)
      s2.dir = -1; 

      this.spiders.push(s2);
  }

  spawnWallHitSparks(x, y) {
    for (let i = 0; i < 12; i++) {
      this.sparkParticles.push({
        x: x, y: y,
        vx: random(-6, -2), vy: random(-2, 2),
        life: random(15, 25)
      });
    }
  }

  spawnSparks(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
      this.sparkParticles.push({
        x: x, y: y,
        vx: random(-2, 2), vy: random(-2, 2),
        life: random(15, 30)
      });
    }
  }

  // pg = warstwa p5.Graphics w trybie WEBGL, przekazana z game.js (patrz komentarz w bat2.js / Spider1.js)[cite: 10]
  show(pg) {
    // --- 1. TŁO ---
    background(0); // Najpierw czyścimy ekran na czarno[cite: 10]

// początek shadera jaskini
    // --- 2. INICJALIZACJA SHADERA I MASKI JASKINI (WYKONUJE SIĘ TYLKO RAZ) ---
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

    // --- 3. RYSOWANIE MASKI NA CPU (NATYWNE 2D) ---
    window.maskGfx.clear();
    window.maskGfx.fill(255);

    // Sylwetka górnej ściany
    window.maskGfx.beginShape();
    window.maskGfx.vertex(this.topWalls[0].x, 0); //[cite: 10]
    for (let wall of this.topWalls) {
      window.maskGfx.vertex(wall.x, wall.y); //[cite: 10]
    }
    window.maskGfx.vertex(this.topWalls[this.topWalls.length - 1].x, 0); //[cite: 10]
    window.maskGfx.endShape(CLOSE);

    // Sylwetka dolnej ściany
    window.maskGfx.beginShape();
    window.maskGfx.vertex(this.bottomWalls[0].x, height); //[cite: 10]
    for (let wall of this.bottomWalls) {
      window.maskGfx.vertex(wall.x, wall.y); //[cite: 10]
    }
    window.maskGfx.vertex(this.bottomWalls[this.bottomWalls.length - 1].x, height); //[cite: 10]
    window.maskGfx.endShape(CLOSE);

    // --- 4. RENDEROWANIE SHADERA Z MASKĄ W TLE (GPU) ---
    window.caveShaderGfx.clear();
    window.caveShaderGfx.shader(window.caveShaderInstance);
    window.caveShaderInstance.setUniform('uTime', millis() / 1000.0);
    window.caveShaderInstance.setUniform('uOffset', this.frameCount * abs(this.wallSpeed)); //[cite: 10]
    window.caveShaderInstance.setUniform('uResolution', [width, height]);
    window.caveShaderInstance.setUniform('uMask', window.maskGfx);
    
    window.caveShaderGfx.rect(-width / 2, -height / 2, width, height);

    // Rzutowanie GPU na główne płótno gry
    imageMode(CORNER);
    image(window.caveShaderGfx, 0, 0);

    // --- 5. RYSOWANIE KRAWĘDZI FIZYCZNYCH (Synchronizacja z logiką uderzeń) ---
    stroke(92, 46, 13); // Ciemniejszy kontur z oryginału[cite: 10]
    strokeWeight(2); //[cite: 10]
    noFill();
    
    beginShape();
    for (let wall of this.topWalls) {
      vertex(wall.x, wall.y); //[cite: 10]
    }
    endShape();

    beginShape();
    for (let wall of this.bottomWalls) {
      vertex(wall.x, wall.y); //[cite: 10]
    }
    endShape();

    // --- 6. RENDEROWANIE RESZTY ELEMENTÓW GRY (NA WIERZCHU) ---
    // Iskry z wybuchów
    fill(255, 255, 0); // Żółty kolor iskier[cite: 10]
    noStroke();
    for (let spark of this.sparkParticles) {
      rect(spark.x, spark.y, 2, 2); //[cite: 10]
    }

    // RENDEROWANIE PAJĄKÓW (shadery GPU -> rysujemy do warstwy pg, nie do canvasu 2D)
    for (let spider of this.spiders) {
      spider.show(pg);
    }

    // RENDEROWANIE PAJĘCZYN I KOKONÓW (również do warstwy pg)
    if (this.webs) {
      for (let web of this.webs) {
        web.show(pg);
      }
    }
    
    noStroke();
  }
// koniec shadera jaskini

  // === FUNKCJA DLA RAKIETY (KOLIZJE) ===
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

  // === PRZYWRÓCONA FUNKCJA (NAPRAWIA CRASH PO ZESTRZELENIU PAJĄKA) ===
  isPointInCorridor(x, y) {
    let wall = this.topWalls.find(w => w.x <= x && w.x + (width/99) > x);
    if (!wall) return true;
    let idx = this.topWalls.indexOf(wall);
    let topY = wall.y;
    
    // Zabezpieczenie na wypadek braku dolnej ściany
    if (!this.bottomWalls[idx]) return true; 
    let bottomY = this.bottomWalls[idx].y;
    
    // Sprawdzamy czy punkt jest między sufitem a podłogą (z marginesem 10px)
    return y > topY + 10 && y < bottomY - 10;
  }

  isLevelComplete() {
  // Poziom kończy się tylko, gdy nie ma wrogów i nie ma już żadnych pocisków w locie
    return this.spiders.length === 0 && enemyBullets.length === 0;
  }

}
