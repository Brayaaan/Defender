class Boss_Matriarka {
  constructor() {
    this.x = width + 500; // miejsce spawnu bossa, ilość pn za prawą stroną ekranu
    this.y = height / 2;
    this.state = 'waiting'; // stan oczekiwania na wejście na ekran
    this.targetY = height / 2;
    this.radius = 65;
    this.health = 2500; 
    this.maxHealth = 2500;
    this.points = 1000; 
    
    this.timer = 0;
    this.angle = 0;
    this.exploded = false;
    this.lastCollisionFrame = -Infinity; 

    // --- NOWE ZMIENNE RUCHU ---
    this.historyY = []; // Tablica do przechowywania pozycji gracza (opóźnienie)
    this.baseX = width - 250; // Docelowa pozycja bazowa w poziomie
    this.sideMoveOffset = 0; // Przesunięcie lewo-prawo
    this.moveTimer = 0; // Timer dla ruchu poziomego
    
    this.minions = [];
    for(let i = 0; i < 6; i++) {
      this.minions.push({ 
        angle: (TWO_PI / 6) * i, 
        dist: 120,
        innerAngle: random(TWO_PI)
      });
    }

    this.particles = [];
    this.shouldSpawnEnemies = false; // Flaga dla level_1-9.js

    // --- ZMIENNE DLA PIORUNA FRAKTALNEGO ---
    this.lightningTimer = 0;
    this.lightningVisible = 0;
    this.currentLightning = [];

    this.explosionFrame = 0; // DODANE: Timer wybuchu Bossa dla głównej gry
    this.soundStarted = false; // Flaga pomocnicza dla stałego dźwięku Matrairki
  }

  update() {
    // 1. Zawsze sprawdzaj wybuch na początku
    if (this.state === 'explosion') {
      // Ten blok wykona się TYLKO RAZ, bo na końcu zmieniamy this.soundStarted na false
      if (this.soundStarted) {
        if (typeof stopSoundMartiarkaStanNormalny === 'function') {
          stopSoundMartiarkaStanNormalny();
        }
        
        // --- TUTAJ wstawiamy wybuch Bossa ---
        if (typeof playEnemyExplosion === 'function') {
          playEnemyExplosion(); // Teraz wywoła się tylko raz!
        }
        
        this.soundStarted = false; // To zamyka bramę dla tego bloku
      }
      
      this.updateExplosion();
      return; // Przerywamy, żeby nie wykonywać logiki żywego bossa
    }

    // 2.A.--- Zatrzymanie dźwięku przy GameOver ---
    if (typeof player !== 'undefined' && player.shieldPower <= 0) {
        if (typeof stopSoundMartiarkaStanNormalny === 'function') {
            stopSoundMartiarkaStanNormalny();
        }
    }

    // 2.B. Obsługa dźwięku tła (odpala się natychmiast po stworzeniu obiektu)
    if (!this.soundStarted) {
        if (typeof playSoundMartiarkaStanNormalny === 'function') {
            playSoundMartiarkaStanNormalny();
            this.soundStarted = true;
        }
    }

    // 3. Logika oczekiwania (Stan 'waiting')
    // Używamy tego samego timera, który już masz
    this.timer++;

    if (this.state === 'waiting') {
        if (this.timer > 360) { // 6 sekundy przy 60 FPS
            this.state = 'idle'; // Zmieniamy na idle, co pozwoli jej wjechać i atakować
            this.timer = 0;      // Resetujemy timer dla logiki ataków
        }
        return; // KLUCZOWE: dopóki czekamy, nie wykonuj reszty kodu (nie ruszaj się, nie strzelaj)
    }

    // 4. logika wejścia na ekran
    // Wykona się tylko, gdy state NIE JEST 'waiting' ani 'explosion'
    if (this.x > this.baseX + 10) {
        this.x -= 2;
    }

    this.angle += 0.04;

    // 5.--- LOGIKA RUCHU PIONOWEGO (Opóźnienie 1s) ---
    // Przy 60 FPS, 60 klatek to 1 sekunda.
    if (typeof player !== 'undefined') {
      this.historyY.push(player.y);
      if (this.historyY.length > 60) {
        this.targetY = this.historyY.shift(); // Pobieramy pozycję sprzed sekundy
      }
    }
    this.y = lerp(this.y, this.targetY, 0.05);

    // 6.--- LOGIKA RUCHU POZIOMEGO (Co 5 sekund) ---
    this.moveTimer++;
    if (this.moveTimer > 300) { // 300 klatek = 5 sekund
      // Zmieniamy offset: 0 -> 100 -> 0 -> -100 -> 0 itd.
      if (this.sideMoveOffset === 0) {
        this.sideMoveOffset = random() < 0.5 ? 100 : -100;
      } else {
        this.sideMoveOffset = 0;
      }
      this.moveTimer = 0;
    }
    // 7. Płynne dążenie do pozycji poziomej (bazowa + offset)
    let finalTargetX = this.baseX + this.sideMoveOffset;
    this.x = lerp(this.x, finalTargetX, 0.02);

    // 8. Cykl zachowania
    if (this.state === 'idle' && this.timer > 180) {
      this.state = 'charging';
      this.timer = 0;

      // 9. INICJACJA DŹWIĘKU WIROWANIA
      if (typeof playSoundMartiarkaWirowanie === 'function') {
        playSoundMartiarkaWirowanie();
      }
    }

    // 10. Losowanie: wróg czy laser?
    else if (this.state === 'charging' && this.timer > 120) {
      if (random() < 0.5) {
        // ZAMIANA: Najpierw wchodzimy w stan iskrzenia przed laserem
        this.state = 'laser_charging'; 
      } else {
        this.state = 'releasing';
        // INICJACJA DŹWIĘKU iskrzenia satelit
        if (typeof playSoundMatriarkaIskrzenieSat === 'function') {
          playSoundMatriarkaIskrzenieSat();
        }
      }
      this.timer = 0;
    }
 
    else if (this.state === 'firing' && this.timer > 80) {
      this.state = 'idle';
      this.timer = 0;
    }

    // Czekanie: Czekamy 90 klatek (1.5 sekundy) na zakończenie iskrzenia środka przed strzałem
    else if (this.state === 'laser_charging' && this.timer > 90) {
      this.state = 'firing';
      this.timer = 0;

      // Dźwięk lasera odpala się DOPIERO TUTAJ, gdy laser faktycznie strzela
      if (typeof playSoundMartiarkaLaser === 'function') {
        playSoundMartiarkaLaser();
      }
    }
    // konie czekania

    else if (this.state === 'releasing' && this.timer > 180) { // 180 klatek = 3 sekundy iskrzenia
      // ZMIANA: Zamiast odpalać funkcję, Boss tylko daje sygnał ("flagę"), że czas na wrogów
      this.shouldSpawnEnemies = true; 
      this.state = 'idle';
      this.timer = 0;
    }

    // --- LOGIKA PIORUNA FRAKTALNEGO ---
    if (this.lightningTimer > 0) this.lightningTimer--;

    if (typeof player !== 'undefined') {
      let d = dist(player.x, player.y, this.x, this.y);
      // Jeśli rakieta jest bliżej niż 350px i timer się wyzerował
      if (d < 350 && this.lightningTimer === 0 && this.lightningVisible <= 0) {
        // Strzelamy z (0,0) relatywnie do różnicy pozycji rakiety
        this.generateLightning(0, 0, player.x - this.x, player.y - this.y);
        
        this.lightningTimer = 120; // Przeładowanie 2 sekundy (120 klatek)
        this.lightningVisible = 30; // Widoczność ćwierć sekundy (15 klatek)
        
        // Zadajemy obrażenia - zabiera 10% tarczy (możesz zmienić wartość)
        player.takeDamage(10);
        playBomb2Sound()  // dżwięk bomby piorun
      }
    }

    else if (this.state === 'releasing' && this.timer > 180) { // 180 klatek = 3 sekundy iskrzenia
      // ZMIANA: Zamiast odpalać funkcję, Boss tylko daje sygnał ("flagę"), że czas na wrogów
      this.shouldSpawnEnemies = true; 
      this.state = 'idle';
      this.timer = 0;
    }

    // Sprawdzanie kolizji lasera (dla docelowej gry)
    if (this.state === 'firing' && typeof player !== 'undefined' && typeof this.checkLaserCollision === 'function') {
       this.checkLaserCollision(player);
    }

    // --- ŚMIERĆ ---
    if (this.health <= 0 && !this.exploded) {

    // ZATRZYMANIE DŹWIĘKU STAŁEGO MATRIORKI
    if (typeof stopSoundMartiarkaStanNormalny === 'function') {
        stopSoundMartiarkaStanNormalny();
    }

      this.state = 'explosion';
      this.explosionFrame = 170; // Ustawiamy czas trwania wybuchu
      this.createExplosion();
      this.exploded = true;
    }

  }

  // --- LOGIKA KOLIZJI (Wzór: Enemy1_zielone_kulki.js) ---

  hits(player) {
    // Używamy rectCircleCollision dla precyzyjnego wykrycia rakiety
    return rectCircleCollision(
      player.x - player.width / 2, player.y - player.height / 2, player.width, player.height,
      this.x, this.y, this.radius
    );
  }

  hitByBullet(bullet) {
    return rectCircleCollision(
      bullet.x, bullet.y, bullet.width, bullet.height,
      this.x, this.y, this.radius
    );
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0 && !this.exploded) {
      if (typeof score !== 'undefined') score += this.points;
      this.state = 'explosion';
      this.explosionFrame = 170; // DODANE: Czas trwania wybuchu Bossa
      this.createExplosion();
      this.exploded = true;
      if (typeof playEnemyExplosion === 'function') {
         playEnemyExplosion();
      }
      return true;
    }
    return false;
  }

  handleCollision(player) {
    // Kolizja rakiety z korpusem Matriarki
    if (frameCount - this.lastCollisionFrame >= 30) {
      player.takeDamage(10); // Rakieta traci 10% tarczy
      if (typeof playSoundKolizjaRakiety === 'function') playSoundKolizjaRakiety();
      
      // Odepchnięcie rakiety w lewo (Boss stoi w miejscu)
      player.x -= 80; 
      
      this.lastCollisionFrame = frameCount;

    }
  }

  checkLaserCollision(p) {
    // Laser zabiera 20% tarczy
    if (p.x < this.x && p.y > this.y - 25 && p.y < this.y + 25) {
      if (frameCount % 15 === 0) { 
        p.takeDamage(20);

      }
    }
  }

  // --- RYSOWANIE I EFEKTY ---

  show() {
    push();
    translate(this.x, this.y);
    if (this.state === 'explosion') {
      this.drawExplosion();
      pop();
      return;
    }

    // 1. Efekt "Rezonansu" (Aura geometryczna bez napisów)
    this.drawDataAura();

    // 2. Satelity i połączenia
    for (let m of this.minions) {
      let orbitSpeed = (this.state === 'charging') ? 0.15 : 0.04;
      let mx = cos(m.angle + frameCount * orbitSpeed) * m.dist;
      let my = sin(m.angle + frameCount * orbitSpeed) * m.dist;
      
      // Więź energetyczna do satelit
      stroke(0, 255, 200, 60);
      strokeWeight(2);
      drawingContext.setLineDash([5, 5]); // Przerywana linia dla technologicznego wyglądu
      line(0, 0, mx, my);
      drawingContext.setLineDash([]); // Reset dash
      
      m.innerAngle += 0.05;
      this.drawMiniForm(mx, my, m.innerAngle);

      // iskrzenie satelit po wylosowaniu spawnu wrogów zamiast lasera
      if (this.state === 'releasing') {
        this.drawSparks(mx, my);
      }

    }

    // 3. Główny korpus Matriarki
    this.drawBody();

    // Iskrzenie w środku korpusu podczas ŁADOWANIA lasera ORAZ samego strzału
    if (this.state === 'laser_charging' || this.state === 'firing') {
      this.drawSparks(0, 0); 
    }

    this.drawCorePulse(); // wywołanie pierścienia przy małym stanie zdrowia Bossa

    // 4. Ataki
    if (this.state === 'charging') this.drawCharge();
    if (this.state === 'firing') this.drawLaser();

    // --- RYSOWANIE PIORUNA FRAKTALNEGO ---
    if (this.lightningVisible > 0) {
      this.drawLightning();
      this.lightningVisible--;
    }

    pop();
    this.drawUI();
  }

  drawBody() {
    if (typeof window.bossBodyGfx === 'undefined') {
      window.bossBodyGfx = createGraphics(250, 250, WEBGL);
      window.bossBodyGfx.noStroke();
      
      const vert = `precision mediump float; attribute vec3 aPosition; attribute vec2 aTexCoord; varying vec2 vUv; void main() { vUv = aTexCoord; gl_Position = vec4(aPosition, 1.0); }`;
      
      const frag = `precision mediump float;
      varying vec2 vUv;
      
      uniform float uTime;
      uniform float uHealth;
      
      const float PI = 3.14159265359;
      
      void main() {
        vec2 uv = (vUv - 0.5) * 2.0;
        float dist = length(uv);
        float angle = atan(uv.y, uv.x);
        
        // 1. Cyfrowy rdzeń (Oko Bossa) - pulsujący środek
        float corePulse = sin(uTime * 5.0) * 0.1 + 0.9;
        float core = smoothstep(0.25, 0.0, dist) * corePulse;
        
        // 2. Środkowa warstwa pancerza i krzyżujące się łuki
        float ring = smoothstep(0.5, 0.45, dist) - smoothstep(0.45, 0.35, dist);
        float arcs = sin(angle * 2.0 + uTime * 2.0);
        ring *= smoothstep(0.0, 0.5, arcs);
        
        // 3. Zewnętrzna warstwa (rotujący wielokąt zastąpiony falą)
        float outer = smoothstep(0.75, 0.7, dist) - smoothstep(0.7, 0.65, dist);
        outer *= sin(angle * 8.0 - uTime * 1.5) * 0.5 + 0.5;
        
        // 4. NOWE: Krążące, kanciaste romby
        // Kręcą się w przeciwnym kierunku i mają 4 sztuki
        float orbitAngle = angle - uTime * 2.5;
        // Dzielimy okrąg na 4 sekcje
        float localAngle = fract((orbitAngle / (2.0 * PI)) * 4.0) - 0.5; 
        
        // Matematyka kształtu: tworzy ostry romb (diamond shape)
        float diamond = abs(localAngle) * 0.8 + abs(dist - 0.55);
        float nodes = smoothstep(0.08, 0.02, diamond); 
        
        // Pulsujące światło rombów
        nodes *= (sin(uTime * 10.0 + orbitAngle * 4.0) * 0.2 + 0.8);

        // Sumujemy bazowe kształty
        float shape = core + ring + outer;
        
        // Kolorystyka bazy
        vec3 colDarkBlue = vec3(0.0, 0.2, 0.6);
        vec3 colCyan = vec3(0.0, 1.0, 0.8);
        
        // NOWY KOLOR: Jaskrawy Fiolet / Magenta dla elementów kanciastych
        vec3 colMagenta = vec3(1.0, 0.2, 0.8);
        
        // System zniszczeń na bazie uHealth
        vec3 damageColor = mix(vec3(1.0, 0.0, 0.0), colCyan, smoothstep(0.0, 0.4, uHealth));
        vec3 finalColor = mix(colDarkBlue, damageColor, shape);
        
        // Nakładamy kanciaste romby w nowym kolorze na główny obraz
        finalColor = mix(finalColor, colMagenta, nodes);
        float finalIntensity = shape + nodes; // Zwiększamy ogólną jasność w miejscach rombów
        
        gl_FragColor = vec4(finalColor * finalIntensity * 2.0, finalIntensity);
      }`;
      
      window.bossBodyShader = window.bossBodyGfx.createShader(vert, frag);
    }
    
    window.bossBodyGfx.clear();
    window.bossBodyShader.setUniform('uTime', frameCount * 0.02);
    window.bossBodyShader.setUniform('uHealth', this.health / this.maxHealth); 
    
    window.bossBodyGfx.shader(window.bossBodyShader);
    window.bossBodyGfx.quad(-1, -1, 1, -1, 1, 1, -1, 1);
    
    push();
    imageMode(CENTER);
    blendMode(ADD);
    image(window.bossBodyGfx, 0, 0); 
    pop();
  }

  // Funkcja pomocnicza do rysowania wielokątów foremnych
  polygon(x, y, radius, npoints) {
    let angle = TWO_PI / npoints;
    beginShape();
    for (let a = 0; a < TWO_PI; a += angle) {
      let sx = x + cos(a) * radius;
      let sy = y + sin(a) * radius;
      vertex(sx, sy);
    }
    endShape(CLOSE);
  }

  drawDataAura() {
    // Holograficzne zakłócenia wokół Bossa (zastępują napisy)
    if (this.health < this.maxHealth * 0.4 || this.state === 'charging') {
      stroke(0, 255, 255, random(30, 100));
      strokeWeight(1);
      for(let i = 0; i < 5; i++) {
        let r = random(50, 180);
        let ang = random(TWO_PI);
        let angWidth = random(0.1, 1.0);
        arc(0, 0, r, r, ang, ang + angWidth);
      }
    }
  }

  drawMiniForm(x, y, angle) {
    push();
    translate(x, y);
    rotate(angle);
    
    // Zewnętrzny, obracający się pancerz satelity (cyjan)
    noFill();
    stroke(0, 255, 255, 200);
    strokeWeight(2);
    this.polygon(0, 0, 18, 4); // Kanciasty kształt (romb/kwadrat)
    
    // Wewnętrzny rdzeń satelity (magenta z nowego shadera)
    fill(255, 50, 200, 200);
    noStroke();
    this.polygon(0, 0, 8, 4);
    
    pop();
  }

  // pierścień przed wybuchem Bossa, 30%czerwony, 20%pomarańczowy, 10% żółty 3% niały
  drawCorePulse() {
    let hpPct = this.health / this.maxHealth;
    
    // Warunek startowy: poniżej 30% życia
    if (hpPct >= 0.3) return;

    let targetCol;
    
    if (hpPct > 0.2) {
      // Przejście Czerwony (0.3) -> Pomarańczowy (0.2)
      let amt = map(hpPct, 0.2, 0.3, 1, 0);
      targetCol = lerpColor(color(255, 0, 0), color(255, 100, 0), amt);
    } else if (hpPct > 0.1) {
      // Przejście Pomarańczowy (0.2) -> Żółty (0.1)
      let amt = map(hpPct, 0.1, 0.2, 1, 0);
      targetCol = lerpColor(color(255, 100, 0), color(255, 255, 0), amt);
    } else if (hpPct > 0.03) {
      // Przejście Żółty (0.1) -> Biały (0.03)
      let amt = map(hpPct, 0.03, 0.1, 1, 0);
      targetCol = lerpColor(color(255, 255, 0), color(255, 255, 255), amt);
    } else {
      // Poniżej 3% czysty biały
      targetCol = color(255, 255, 255);
    }

    push();
    noFill();
    // Efekt pulsowania rozmiaru
    let pulse = 45 + sin(frameCount * 0.2) * 15;
    
    // Główny pierścień
    stroke(targetCol);
    strokeWeight(3);
    ellipse(0, 0, pulse, pulse);
    
    // Zewnętrzna poświata (cieńsza i lekko przezroczysta)
    strokeWeight(1);
    let glowCol = color(red(targetCol), green(targetCol), blue(targetCol), 150);
    stroke(glowCol);
    ellipse(0, 0, pulse + 10, pulse + 10);
    pop();
  }

// początek shadera losowania
  drawCharge() {
    if (typeof window.bossChargeGfx === 'undefined') {
      // Płótno nieco większe niż korpus, aby pokazać zasysanie energii z zewnątrz
      window.bossChargeGfx = createGraphics(300, 300, WEBGL);
      window.bossChargeGfx.noStroke();
      
      const vert = `precision mediump float; attribute vec3 aPosition; attribute vec2 aTexCoord; varying vec2 vUv; void main() { vUv = aTexCoord; gl_Position = vec4(aPosition, 1.0); }`;
      
      const frag = `precision mediump float;
      varying vec2 vUv;
      uniform float uTime;
      
      void main() {
        vec2 uv = (vUv - 0.5) * 2.0;
        float dist = length(uv);
        float angle = atan(uv.y, uv.x);
        
        // 1. Efekt implozji (fale i spirale poruszają się do wewnątrz)
        // Kluczem jest ujemny mnożnik czasu (-uTime)
        float spiral = angle + dist * 4.0 - uTime * 5.0;
        float waves = sin(spiral * 3.0) * 0.5 + 0.5;
        
        // 2. Pierścienie energii błyskawicznie kompresujące się do rdzenia
        float rings = fract(dist * 5.0 + uTime * 4.0);
        rings = smoothstep(0.4, 0.6, rings) - smoothstep(0.6, 0.8, rings);
        
        // 3. Wygaszanie krawędzi (żeby wir nie uderzał w krawędzie płótna) i środka (rdzeń jest rysowany przez drawBody)
        float fade = smoothstep(1.0, 0.3, dist) * smoothstep(0.15, 0.3, dist);
        
        float energy = (waves * 0.4 + rings) * fade;
        
        // 4. Kolorystyka
        vec3 colYellow = vec3(1.0, 0.9, 0.0);
        vec3 colCyan = vec3(0.0, 1.0, 1.0);
        vec3 colMagenta = vec3(1.0, 0.2, 0.8);
        
        // Dynamiczne mieszanie barw w zależności od odległości i czasu
        vec3 finalColor = mix(colCyan, colYellow, sin(dist * 8.0 - uTime * 2.0) * 0.5 + 0.5);
        finalColor = mix(finalColor, colMagenta, rings * 0.6);
        
        gl_FragColor = vec4(finalColor * energy * 2.5, energy);
      }`;
      
      window.bossChargeShader = window.bossChargeGfx.createShader(vert, frag);
    }
    
    // Obsługa i renderowanie
    window.bossChargeGfx.clear();
    window.bossChargeShader.setUniform('uTime', frameCount * 0.03);
    
    window.bossChargeGfx.shader(window.bossChargeShader);
    window.bossChargeGfx.quad(-1, -1, 1, -1, 1, 1, -1, 1);
    
    push();
    imageMode(CENTER);
    blendMode(ADD);
    // Wyświetlanie za rdzeniem Bossa (-0.1 na osi Z, choć w p5 wystarczy zwykły ADD na obecnym translate)
    image(window.bossChargeGfx, 0, 0); 
    pop();
  }
// koniec shadera lasowania

  // rysuwanie lasera
  // shader lasera Martiarki- początek
  drawLaser() {
    if (typeof window.bossLaserGfx === 'undefined') {
      // Szerokie płótno, by wiązka przecięła cały ekran gracza (2000px szerokości, 120px wysokości)
      window.bossLaserGfx = createGraphics(2000, 120, WEBGL);
      window.bossLaserGfx.noStroke();
      
      const vert = `precision mediump float; attribute vec3 aPosition; attribute vec2 aTexCoord; varying vec2 vUv; void main() { vUv = aTexCoord; gl_Position = vec4(aPosition, 1.0); }`;
      
      const frag = `precision mediump float;
      varying vec2 vUv;
      uniform float uTime;
      
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
        vec2 uv = vUv;
        uv.y = (uv.y - 0.5) * 2.0; 
        
        // Czas ustawiony tak, aby plazma wylatywała z PRAWEGO zaczepu w lewą stronę (w stronę gracza)
        float scrollTime = uTime * 6.0; 
        
        // --- TWORZENIE ZAOKRĄGLEŃ (Kształt kapsułki) ---
        float aspect = 16.66;
        float radius = 1.0 / aspect; 
        
        float distX = 0.0;
        if (uv.x < radius) {
            // Zaokrąglamy lewą krawędź (koniec lasera)
            distX = (radius - uv.x) * aspect; 
        } else if (uv.x > 1.0 - radius) {
            // Zaokrąglamy prawą krawędź (zaczep w rdzeniu Bossa)
            distX = (uv.x - (1.0 - radius)) * aspect; 
        }
        
        // Szum plazmy
        float n1 = fbm(vec2(uv.x * 6.0 + scrollTime, uv.y * 2.0));
        float n2 = fbm(vec2(uv.x * 12.0 + scrollTime * 1.5, uv.y * 4.0 - uTime));
        float distortion = (n1 - 0.5) * 0.4;
        
        // Kształt wiązki uwzględniający zaokrąglenia na końcach
        float distCapsule = length(vec2(distX, uv.y + distortion));
        
        float core = smoothstep(0.15, 0.0, distCapsule);
        float plasma = smoothstep(0.6, 0.0, distCapsule) * n2;
        
        float pulse = sin(uv.x * 30.0 + scrollTime * 2.0) * 0.5 + 0.5;
        plasma += pulse * 0.3 * smoothstep(0.3, 0.0, distCapsule);
        
        // --- KULA ENERGII NA ZACZEPIE (Tym razem po PRAWEJ stronie) ---
        // Generujemy gęstą "żarówkę" tam, gdzie zaczyna się laser (uv.x dąży do 1.0)
        float anchorDist = length(vec2((uv.x - (1.0 - radius)) * aspect, uv.y));
        plasma += smoothstep(0.8, 0.0, anchorDist) * 0.6; // Dodatkowa poświata wokół rdzenia Bossa
        core += smoothstep(0.3, 0.0, anchorDist) * 1.0;   // Mocny, biały środek
        
        // Krawędzie wygaszają się na bazie okrągłego kształtu
        float edgeFade = smoothstep(1.0, 0.8, distCapsule);
        
        float intensity = (core + plasma) * edgeFade;
        
        vec3 colMagenta = vec3(1.0, 0.2, 0.8);
        vec3 colCyan = vec3(0.0, 1.0, 0.9);
        vec3 colCore = vec3(1.0, 1.0, 1.0);
        
        vec3 finalColor = mix(colMagenta, colCyan, plasma);
        finalColor = mix(finalColor, colCore, core * 0.8);
        
        gl_FragColor = vec4(finalColor * intensity * 2.5, intensity);
      }`;
      
      window.bossLaserShader = window.bossLaserGfx.createShader(vert, frag);
    }
    
    // Obliczanie bieżącej klatki
    window.bossLaserGfx.clear();
    window.bossLaserShader.setUniform('uTime', frameCount * 0.02);
    
    window.bossLaserGfx.shader(window.bossLaserShader);
    window.bossLaserGfx.quad(-1, -1, 1, -1, 1, 1, -1, 1);
    
    push();
    imageMode(CENTER);
    blendMode(ADD);
    
    // Rysujemy laser zaczynając od środka bossa (przesunięcie o pół szerokości płótna: 1000px)
    // Przesuwamy płótno o 120px w prawo, aby zaokrąglona w shaderze żarówka wpadła idealnie w (0,0)
    image(window.bossLaserGfx, -880, 0, 2000, 120);
    
    pop();
  }
// shader lasera Martiarki- koniec

  // rysowanie iskrzenia satelit po wyplosowaniu spawnu wrogów
  // shader iskrzenia - początek
  drawSparks(x, y) {
    if (typeof window.bossSparksGfx === 'undefined') {
      // Optymalne, kwadratowe płótno dla pojedynczego ogniska iskier
      window.bossSparksGfx = createGraphics(150, 150, WEBGL);
      window.bossSparksGfx.noStroke();
      
      const vert = `precision mediump float; attribute vec3 aPosition; attribute vec2 aTexCoord; varying vec2 vUv; void main() { vUv = aTexCoord; gl_Position = vec4(aPosition, 1.0); }`;
      
      const frag = `precision mediump float;
      varying vec2 vUv;
      uniform float uTime;
      uniform float uSeed;
      
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i+vec2(0.0,0.0)), hash(i+vec2(1.0,0.0)), u.x),
                   mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
      }

      void main() {
        vec2 uv = (vUv - 0.5) * 2.0;
        float dist = length(uv);
        float angle = atan(uv.y, uv.x);
        
        // Bardzo szybki czas dla rwanego, agresywnego efektu prądu + unikalny seed satelity
        float t = uTime * 35.0 + uSeed;
        
        // Generujemy rwane, ostre promienie rozchodzące się od środka statku
        float rays1 = noise(vec2(angle * 7.0, t * 0.15));
        float rays2 = noise(vec2(angle * 13.0, t * 0.25 + 20.0));
        
        // Wycinamy wąskie paski za pomocą ostrego smoothstepa (imitacja mikro-piorunów)
        float spark1 = smoothstep(0.65, 0.85, rays1) * smoothstep(0.8, 0.1, dist);
        float spark2 = smoothstep(0.70, 0.90, rays2) * smoothstep(0.6, 0.0, dist);
        
        // Efekt losowego migotania (flicker) prądu w czasie
        float flicker = sin(t * 1.5) * 0.4 + 0.6;
        float totalSparks = (spark1 + spark2 * 1.7) * flicker;
        
        // Maskowanie środka i krawędzi (zabezpieczenie przed ucinaniem kwadratu płótna)
        float edgeFade = smoothstep(0.9, 0.5, dist) * smoothstep(0.0, 0.15, dist);
        totalSparks *= edgeFade;
        
        // Kolorystyka: Cyjan łączący się z Magentą na końcach łuków elektrycznych
        vec3 colCyan = vec3(0.0, 1.0, 1.0);
        vec3 colMagenta = vec3(1.0, 0.2, 0.8);
        vec3 colWhite = vec3(1.0, 1.0, 1.0);
        
        vec3 finalColor = mix(colCyan, colMagenta, dist * 0.7);
        // Środek błyskawic rozjaśniamy do czystej bieli
        finalColor = mix(finalColor, colWhite, totalSparks * 0.4);
        
        gl_FragColor = vec4(finalColor * totalSparks * 3.5, totalSparks);
      }`;
      
      window.bossSparksShader = window.bossSparksGfx.createShader(vert, frag);
    }
    
    // Generujemy unikalną wartość (seed) na podstawie pozycji x i y.
    // Dzięki temu każda satelita generuje INNE błyskawice w tym samym czasie!
    let uniqueSeed = Math.abs(x * 12.3 + y * 45.6) % 1000.0;
    
    window.bossSparksGfx.clear();
    window.bossSparksShader.setUniform('uTime', frameCount * 0.02);
    window.bossSparksShader.setUniform('uSeed', uniqueSeed);
    
    window.bossSparksGfx.shader(window.bossSparksShader);
    window.bossSparksGfx.quad(-1, -1, 1, -1, 1, 1, -1, 1);
    
    push();
    imageMode(CENTER);
    blendMode(ADD);
    // Rysujemy bezpośrednio na zadanych współrzędnych x, y
    image(window.bossSparksGfx, x, y, 150, 150);
    pop();
  }
// shader iskrzenia - koniec

  drawUI() {
    // 1. Nowe wymiary (zmniejszone o połowę)
    let barW = 200; // Było 400
    let barH = 5;   // Było 10
    
    // 2. Pozycja: 1/5 szerokości od prawej krawędzi, 80px od góry
    // width * 0.85 ustawia środek paska w 4/5 szerokości ekranu (czyli 1/5 od prawej)
    let centerX = width * 0.85;
    let x = centerX - barW / 2;
    let y = 80;

    let healthPct = this.health / this.maxHealth;

    // 3. Logika kolorów paska
    push(); // Izolujemy ustawienia rysowania
    
    if (healthPct < 0.03) {
      fill(255); // 3% - Biały
    } else if (healthPct < 0.10) {
      fill(255, 255, 0); // 10% - Żółty
    } else if (healthPct < 0.20) {
      fill(255, 165, 0); // 20% - Pomarańczowy
    } else if (healthPct < 0.30) {
      fill(255, 0, 0); // 30% - Czerwony
    } else {
      fill(0, 255, 255); // Powyżej 30% - Standardowy Cyjan
    }

    // Rysowanie życia (proporcjonalne do aktualnego zdrowia)
    let currentW = map(this.health, 0, this.maxHealth, 0, barW);
    noStroke();
    rect(x, y, currentW, barH);

    // 4. Obramowanie i tło paska (delikatne, by nie przytłaczało)
    stroke(255, 50); // Półprzezroczysta ramka
    strokeWeight(1);
    noFill();
    rect(x - 1, y - 1, barW + 2, barH + 2);

    // 5. Napis "MATRIARKA"
    fill(255);
    noStroke();
    textSize(14);
    textAlign(CENTER, BOTTOM);
    // Napis umieszczony 10 pikseli nad paskiem
    text("MATRIARKA", centerX, y - 10);
    
    pop();
  }

  createExplosion() {
    this.particles = []; // CPU już nie musi niczego generować
  }

  updateExplosion() {
    this.explosionFrame--; // Zostawiamy wyłącznie odliczanie do usunięcia z planszy
  }

// Shader eksplozji bossa
  drawExplosion() {
    if (typeof window.bossExplosionGfx === 'undefined') {
      // Duże płótno dla potężnego Bossa, było 400 na 400
      window.bossExplosionGfx = createGraphics(600, 600, WEBGL);
      window.bossExplosionGfx.noStroke();
      
      const vert = `precision mediump float; attribute vec3 aPosition; attribute vec2 aTexCoord; varying vec2 vUv; void main() { vUv = aTexCoord; gl_Position = vec4(aPosition, 1.0); }`;
      
      const frag = `precision mediump float;
      varying vec2 vUv;
      
      uniform float uProgress;
      
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
        vec2 uv = (vUv - 0.5) * 2.0;
        float dist = length(uv);
        float angle = atan(uv.y, uv.x);
        
        // Zwiększony promień rażenia dla Bossa
        float currentRadius = uProgress * 1.5; 
        
        float burstNoise = fbm(uv * 10.0 - uProgress * 2.0);
        float sparksNoise = fbm(vec2(angle * 20.0, dist * 10.0 - uProgress * 15.0));
        
        float core = smoothstep(0.6, 0.0, dist) * (1.0 - smoothstep(0.0, 0.3, uProgress));
        
        float ringThickness = 0.4 * (1.0 - uProgress);
        float shockwave = smoothstep(currentRadius + ringThickness, currentRadius, dist) 
                        * smoothstep(currentRadius - ringThickness - 0.4, currentRadius, dist);
                        
        shockwave *= smoothstep(0.2, 0.8, burstNoise);
        
        float sparks = smoothstep(0.6, 0.9, sparksNoise) 
                     * smoothstep(currentRadius + 0.4, currentRadius - 0.4, dist);
        
        float shape = core + shockwave + sparks;
        
        // 1. Zanikanie w czasie (Twoje oryginalne)
        float fadeOut = 1.0 - smoothstep(0.7, 1.0, uProgress);
        float intensity = shape * fadeOut;
        
        // 2. NOWE: Zanikanie w przestrzeni (zapobiega ucinaniu fali na brzegach płótna)
        float edgeFade = smoothstep(0.95, 0.6, dist); 
        intensity *= edgeFade;
        
        // Kolorystyka dopasowana do Matriarki (Cyjan, Ciemny Błękit, Biel)
        vec3 colDarkBlue = vec3(0.0, 0.2, 0.8);
        vec3 colCyan = vec3(0.0, 1.0, 0.8);
        vec3 colWhite = vec3(1.0, 1.0, 1.0);
        
        vec3 fireColor = mix(colDarkBlue, colCyan, smoothstep(0.1, 0.4, intensity));
        fireColor = mix(fireColor, colWhite, smoothstep(0.6, 0.9, intensity));
        
        gl_FragColor = vec4(fireColor * intensity * 2.5, intensity);
      }`;
      
      window.bossExplosionShader = window.bossExplosionGfx.createShader(vert, frag);
    }
    
    // Obliczanie postępu specjalnie dla 170 klatek wybuchu Matriarki
    let progress = 1.0 - (this.explosionFrame / 170.0);
    
    window.bossExplosionGfx.clear();
    window.bossExplosionShader.setUniform('uProgress', progress);
    
    window.bossExplosionGfx.shader(window.bossExplosionShader);
    window.bossExplosionGfx.quad(-1, -1, 1, -1, 1, 1, -1, 1);
    
    push();
    imageMode(CENTER);
    blendMode(ADD);
    
    // Rysujemy w 0,0 - funkcja show() załatwiła już ułożenie za pomocą translate(this.x, this.y)
    image(window.bossExplosionGfx, 0, 0); 
    pop();
  }
// Shader eksplozji bossa- koniec


// --- FUNKCJE PIORUNA FRAKTALNEGO ---
  generateLightning(x1, y1, x2, y2, isBranch = false) {
    if (!isBranch) this.currentLightning = []; 
    
    let steps = isBranch ? 5 : 12; 
    let prevX = x1;
    let prevY = y1;

    for (let i = 1; i <= steps; i++) {
      let t = i / steps;
      let targetX = lerp(x1, x2, t);
      let targetY = lerp(y1, y2, t);

      let spread = isBranch ? 45 : 25;
      if (i < steps) {
        targetX += random(-spread, spread);
        targetY += random(-spread, spread);
      }

      this.currentLightning.push({
        x1: prevX, 
        y1: prevY, 
        x2: targetX, 
        y2: targetY, 
        branch: isBranch 
      });

      if (!isBranch && random() < 0.2) {
        let branchX = targetX + random(-150, 150);
        let branchY = targetY + random(-150, 150);
        this.generateLightning(targetX, targetY, branchX, branchY, true);
      }

      prevX = targetX;
      prevY = targetY;
    }
  }

  drawLightning() {
    push();
    drawingContext.shadowBlur = 15;
    drawingContext.shadowColor = 'rgba(0, 255, 255, 0.8)';

    for (let seg of this.currentLightning) {
      let weightMultiplier = seg.branch ? 0.4 : 1.0;

      // Zewnętrzna otoczka (ciemniejszy błękit)
      stroke(0, 150, 255, 180);
      strokeWeight(7 * weightMultiplier);
      line(seg.x1, seg.y1, seg.x2, seg.y2);

      // Rdzeń pioruna (bardzo jasny błękit / biały)
      stroke(230, 255, 255, 255);
      strokeWeight(2 * weightMultiplier);
      line(seg.x1, seg.y1, seg.x2, seg.y2);
      
      // Okazjonalne rozbłyski na złączeniach
      if (random() > 0.8) {
        noStroke();
        fill(255, 255, 255, 200);
        circle(seg.x2, seg.y2, random(3, 6) * weightMultiplier);
      }
    }
    pop();
  }

}