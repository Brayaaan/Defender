// Wspólny vertex shader dla WSZYSTKICH shaderów rakiety w tym pliku -
// rysowanych na współdzielonej warstwie gpuLayer (patrz game.js) zamiast
// osobnych createGraphics(). Używa standardowej macierzy kamery p5
// (uModelViewMatrix/uProjectionMatrix), dzięki czemu wystarczy zwykłe
// pg.translate()/pg.rotate() + pg.plane() - a fragment shadery poniżej
// działają BEZ ŻADNYCH ZMIAN (nadal czytają varying "vUv").
const ROCKET_SHARED_VERT_SRC = `precision mediump float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec2 vUv;
void main() {
  vUv = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}`;

class Player {
  constructor() {
    // Pozycja startowa
    this.x = 200; // 0.104 * 1920 ≈ 200px
    this.y = 540; // 0.5 * 1080 = 540px
    
    this.vx = 0;
    this.vy = 0;
    this.bullets = [];
    this.shieldPower = 100;

    // Rozmiar rakiety (stałe piksele)
    this.width = 55;   // ważny przy 
    this.height = 30;  // interakcji z otoczeniem

    // Prędkość (moveSpeed)
    // 0.0024 * 1920 ≈ 4.6px na klatkę
    this.moveSpeed = 4.8; 

    // Pozostałe zmienne stanu
    this.lastCollisionTimes = [];
    this.bombAnimationProgress = 0;
    this.lightningBombAnimationProgress = 0;
    this.atomicBombAnimationProgress = 0;
    this.explosionFrame = 0;
    this.explosionParticles = [];

    // --- NOWE ZMIENNE DLA AUREOLI nieśmiertelności ---
    this.isImmortal = false;
    this.immortalityTimer = 0;


    this.jetIntensity = 1;
    this.jetParticles = [];
    this.weaponLevel = 1;
    this.maxWeaponLevel = 1;
    this.postExplosionFrames = 0;
    
    this.isMovingRight = false;
    this.isMovingUpDown = false;
    this.isMovingLeft = false;

    // Silniki cofania
    this.reversingEnginesActive = false;
    this.reverseThrustOffset = 0;
    this.reverseThrustAngle = 15; 

    // Tablica na cząsteczki bomby zwykłej
    this.bombParticles = [];
  }

  canCollideWith(enemyIndex) {
    let currentFrame = frameCount;
    return !this.lastCollisionTimes[enemyIndex] || (currentFrame - this.lastCollisionTimes[enemyIndex] >= 30);
  }

  registerCollision(enemyIndex) {
    this.lastCollisionTimes[enemyIndex] = frameCount;
  }

  activateImmortality() {
    this.isImmortal = true;
    this.immortalityTimer = 1200;
    // nieśmiertelność, czas: 20s x 60 klatek = 1200");
  }

  useBomb() {
    if (this.bombAnimationProgress > 0 || this.lightningBombAnimationProgress > 0 || this.atomicBombAnimationProgress > 0) {

      return;
    }
    bombMechanics.useBomb();
  }

  startExplosion() {

    // Blokada wielokrotnego wybuchu
    // Jeśli już trwa wybuch (explosionFrame > 0) lub jesteśmy w stanie po wybuchu, przerwij go
    if (this.explosionFrame > 0 || this.postExplosionFrames > 0) return;

    this.explosionFrame = 120;      // czas eksplozji rakiety 


    // ⭐ POPRAWIONA SEKCJA: Wyciszenie dźwięku uniwersalnego po kraksie ⭐
    // Dodatkowo, wyłącza również dźwięki ruchu, jeśli były aktywne w momencie wybuchu
    if (typeof playSoundRuchStatkuUniwersalny === 'function') {
        playSoundRuchStatkuUniwersalny(false);
        // Zresetuj flagę uniwersalną do stanu początkowego
        if (typeof universalSoundIsPlaying !== 'undefined') { 
          universalSoundIsPlaying = false; 
        }
    }
    if (typeof playSoundRuchStatkuUpDown === 'function') {
        playSoundRuchStatkuUpDown(false);
    }
    if (typeof playSoundRuchStatkuWlewo === 'function') {
        playSoundRuchStatkuWlewo(false);
    }
    if (typeof playSoundRuchStatkuWprawo === 'function') {
        playSoundRuchStatkuWprawo(false);
    }
    // Ustawienie flag na false (zapobiega to próbom ich wyłączenia w metodzie update)
    this.isMovingUpDown = false;
    this.isMovingLeft = false;
    this.isMovingRight = false;


    try {
      const sound = playRocketExplosion();
      if (sound instanceof Promise) {
        sound.catch(error => console.error("Błąd odtwarzania dźwięku wybuchu:", error));
      } else {
        sound.play().catch(error => console.error("Błąd odtwarzania dźwięku wybuchu:", error));
      }
    } catch (error) {
      console.error("Błąd przy próbie odtworzenia dźwięku:", error);
    }

  }

  update() {
    if (this.explosionFrame > 0) {
      this.explosionFrame--;
      return;
    }

    if (this.postExplosionFrames > 0) {
      this.postExplosionFrames--;
      return; // Kontynuuj rysowanie bez dalszej aktualizacji
    }

// zmiana w iskrzeniu po wybuchu aureoli nieśmiertelnośi- początek logiki kodu
    // --- LOGIKA CZASU I WYBUCHU AUREOLI ---
    if (this.isImmortal) {
      this.immortalityTimer--;
      if (this.immortalityTimer <= 0) {
        this.isImmortal = false;
        
        // --- NOWY WYZWALACZ SHADERA ISKIER AUREOLI ---
        this.immortalityExplosionFrames = 50; // czas trwania animacji iskier (50 klatek)
        // Zapisujemy pozycję, by iskry po pęknięciu tarczy nie podążały już za rakietą w locie
        this.auraExplosionX = this.x; 
        this.auraExplosionY = this.y;
      }
    }

    // Aktualizacja licznika czasu trwania wybuchu iskier aureoli (zastępuje starą pętlę particles)
    if (this.immortalityExplosionFrames > 0) {
        this.immortalityExplosionFrames--;
    }
// zmiana w iskrzeniu po wybuchu aureoli nieśmiertelnośi- koniec logiki kodu

    if (this.postExplosionFrames > 0) {
      this.postExplosionFrames--;
      return;
    }


    // ⭐ SEKCJA: Sterowanie ruchem i dźwiękami

    // Ruch GÓRA / DÓŁ
    let upDownPressed = keyIsDown(UP_ARROW) || keyIsDown(DOWN_ARROW);
    if (upDownPressed) {
      if (keyIsDown(UP_ARROW)) this.vy = -this.moveSpeed;
      if (keyIsDown(DOWN_ARROW)) this.vy =  this.moveSpeed;

      
      if (!this.isMovingUpDown && typeof playSoundRuchStatkuUpDown === 'function') {
        playSoundRuchStatkuUpDown(true); // Włącz
        this.isMovingUpDown = true;
      }
    } else {
      if (this.isMovingUpDown && typeof playSoundRuchStatkuUpDown === 'function') {
        playSoundRuchStatkuUpDown(false); // Wyłącz
        this.isMovingUpDown = false;
      }
    }

    // Ruch LEWO
    let leftPressed = keyIsDown(LEFT_ARROW);
    if (leftPressed) {
      this.vx = -this.moveSpeed;

      // ⭐ WŁĄCZENIE ANIMACJI COFANIA ⭐
      this.reversingEnginesActive = true; 
      
      if (!this.isMovingLeft && typeof playSoundRuchStatkuWlewo === 'function') {
        playSoundRuchStatkuWlewo(true); // Włącz
        this.isMovingLeft = true;
      }
    } else {
      // ⭐ WYŁĄCZ ANIMACJĘ COFANIA ⭐
      this.reversingEnginesActive = false; 
      if (this.isMovingLeft && typeof playSoundRuchStatkuWlewo === 'function') {
        playSoundRuchStatkuWlewo(false); // Wyłącz
        this.isMovingLeft = false;
      }
    }

    // Ruch PRAWO (z przyspieszeniem)
    let rightPressed = keyIsDown(RIGHT_ARROW);
    if (rightPressed) {
      this.vx = this.moveSpeed * this.jetIntensity;

      
      if (!this.isMovingRight && typeof playSoundRuchStatkuWprawo === 'function') {
        playSoundRuchStatkuWprawo(true); // Włącz
        this.isMovingRight = true;
      }
    } else {
      // Zwalnianie (zachowanie oryginalnej logiki przyspieszenia/zwalniania w prawo)
      this.vx = this.vx * (this.jetIntensity === 2 ? 0.5 : 1);
      this.jetIntensity = 1; // Powrót do standardowej intensywności
      
      if (this.isMovingRight && typeof playSoundRuchStatkuWprawo === 'function') {
        playSoundRuchStatkuWprawo(false); // Wyłącz
        this.isMovingRight = false;
      }
    }
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.8;
    this.vy *= 0.8;
    if (this.x - 24 < 0) this.x = 24;
    if (this.x + 24 > width) this.x = width - 24;
    if (this.y - 12 < 0) this.y = 12;
    if (this.y + 12 > height) this.y = height - 12;
    if (cave && !this.isImmortal) {
      let walls = cave.getWalls();
      for (let wall of walls) {
        if (rectRectCollision(
          this.x - 24, this.y - 12, 48, 24,
          wall.x, wall.y, wall.width, wall.height
        )) {
          // Wywołujemy uniwersalną metodę zamiast odejmować bezpośrednio
          this.takeDamage(20); 
        }
      }
    }

    if (frameCount % 5 === 0) {
      let baseX = this.x - 19.2 - 3.8; // czyli: this.x - 23
      let nozzleYTop = this.y - 12 + 3.8; // czyli: this.y - 8.2
      let nozzleYBottom = this.y + 12 - 3.8; // czyli: this.y + 8.2
      if (level === 20) {
        for (let i = 0; i < 6; i++) {
          this.jetParticles.push({
            x: baseX - 3.8,
            y: nozzleYTop,
            vx: random(-12, -3),
            vy: random(-1.5, 1.5),
            life: 20
          });
        }
        for (let i = 0; i < 6; i++) {
          this.jetParticles.push({
            x: baseX - 3.8,
            y: nozzleYBottom,
            vx: random(-12, -3),
            vy: random(-1.5, 1.5),
            life: 20
          });
        }
      } else {
        this.jetParticles.push({
          x: baseX - 3.8,
          y: nozzleYTop,
          vx: random(-2, -0.5),
          vy: random(-0.5, 0.5),
          life: 20
        });
        this.jetParticles.push({
          x: baseX - 3.8,
          y: nozzleYBottom,
          vx: random(-2, -0.5),
          vy: random(-0.5, 0.5),
          life: 20
        });
      }
    }

    for (let i = this.jetParticles.length - 1; i >= 0; i--) {
      let particle = this.jetParticles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life--;
      if (particle.life <= 0) this.jetParticles.splice(i, 1);
    }

    // animację standardowej bomby, aby generował i aktualizował cząsteczki
    if (this.bombAnimationProgress > 0) {
      this.bombAnimationProgress++;
  
      let progress = this.bombAnimationProgress / 60;
      let currentRadius = 720 * progress;

      // Generowanie cząsteczek (tylko do klatki 52)
      if (this.bombAnimationProgress < 52) {
        // Dym
        for (let i = 0; i < 4; i++) {
          let angle = random(TWO_PI);
          this.bombParticles.push({
            x: this.x + cos(angle) * currentRadius,
            y: this.y + sin(angle) * currentRadius,
            vx: cos(angle) * random(0.2, 1.2),
            vy: sin(angle) * random(0.2, 1.2),
            size: random(15, 30),
            alpha: 90,
            color: color(255, random(50, 120), 0),
            type: 'smoke'
          });
        }
        // Iskry
        for (let i = 0; i < 6; i++) {
          let angle = random(TWO_PI);
          let speed = random(1.5, 5.5);
          this.bombParticles.push({
            x: this.x + cos(angle) * currentRadius,
            y: this.y + sin(angle) * currentRadius,
            vx: cos(angle) * speed + random(-0.5, 0.5),
            vy: sin(angle) * speed + random(-0.5, 0.5),
            size: random(2, 5),
            alpha: 255,
            color: color(255, random(180, 255), 50),
            type: 'spark'
          });
        }
      }

      // Aktualizacja fizyki cząsteczek
      for (let i = this.bombParticles.length - 1; i >= 0; i--) {
        let p = this.bombParticles[i];
        p.x += p.vx;
        p.y += p.vy;
    
        if (p.type === 'smoke') {
          p.alpha -= 2.5;
          p.size += 0.3;
        } else {
          p.alpha -= 4.5;
        }
    
        if (p.alpha <= 0) this.bombParticles.splice(i, 1);
      }

      if (this.bombAnimationProgress >= 60) {
        this.bombAnimationProgress = 0;
        this.bombParticles = []; // Czyścimy po zakończeniu

      }
    }

    if (this.lightningBombAnimationProgress > 0) {
      this.lightningBombAnimationProgress++;
      if (this.lightningBombAnimationProgress >= 30) {
        this.lightningBombAnimationProgress = 0;

      }
    }

    if (this.atomicBombAnimationProgress > 0) {
      this.atomicBombAnimationProgress++;
      if (this.atomicBombAnimationProgress >= 30) {
        this.atomicBombAnimationProgress = 0;

      }
    }
  }

  // -----------------------------------------------------------------------
  // Jednorazowa (statyczna) inicjalizacja WSZYSTKICH shaderów rakiety na
  // WSPÓŁDZIELONEJ warstwie WEBGL (gpuLayer z game.js). Zamiast 6 osobnych
  // createGraphics(...,WEBGL) (czyli 6 osobnych kontekstów WebGL) korzystamy
  // teraz z JEDNEJ warstwy używanej przez całą grę - to właśnie rozwiązuje
  // problem "Too many active WebGL contexts" (limit przeglądarki to ~16).
  // -----------------------------------------------------------------------
  static initShaders(pg) {
    if (Player.shadersLoaded) return;

    // 1. EKSPLOZJA RAKIETY
    const fragEksplozja = `precision mediump float;
        varying vec2 vUv;
        
        uniform float uProgress; // Postęp od 0.0 (start) do 1.0 (koniec)
        
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
          
          float currentRadius = uProgress * 1.2;
          
          float burstNoise = fbm(uv * 8.0 - uProgress * 3.0);
          float sparksNoise = fbm(vec2(angle * 12.0, dist * 15.0 - uProgress * 10.0));
          
          float core = smoothstep(0.4, 0.0, dist) * (1.0 - smoothstep(0.0, 0.3, uProgress));
          
          float ringThickness = 0.2 * (1.0 - uProgress);
          float shockwave = smoothstep(currentRadius + ringThickness, currentRadius, dist) 
                          * smoothstep(currentRadius - ringThickness - 0.2, currentRadius, dist);
                          
          shockwave *= smoothstep(0.3, 0.7, burstNoise);
          
          float sparks = smoothstep(0.65, 0.8, sparksNoise) 
                       * smoothstep(currentRadius + 0.3, currentRadius - 0.3, dist);
          
          float shape = core + shockwave + sparks;
          
          float fadeOut = 1.0 - smoothstep(0.6, 1.0, uProgress);
          float intensity = shape * fadeOut;
          float edgeFade = smoothstep(0.95, 0.6, dist); 
          intensity *= edgeFade;
          
          vec3 colOrange = vec3(1.0, 0.4, 0.0);
          vec3 colYellow = vec3(1.0, 1.0, 0.0);
          vec3 colCyan   = vec3(0.0, 1.0, 0.8);
          
          vec3 fireColor = mix(colCyan, colOrange, smoothstep(0.1, 0.4, intensity));
          fireColor = mix(fireColor, colYellow, smoothstep(0.4, 0.8, intensity));
          
          fireColor = mix(fireColor, vec3(1.0), smoothstep(0.8, 1.0, intensity));
          
          gl_FragColor = vec4(fireColor * intensity * 2.0, intensity);
        }`;
    Player.explosionShader = pg.createShader(ROCKET_SHARED_VERT_SRC, fragEksplozja);

    // 2. ISKRY ROZBITEJ AUREOLI
    const fragIskry = `precision mediump float;
        varying vec2 vUv;
        
        uniform float uProgress; 
        uniform float uTime;
        
        float hash(vec2 p) { 
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); 
        }

        void main() {
          vec2 uv = (vUv - 0.5) * 2.0;
          float dist = length(uv);
          float angle = atan(uv.y, uv.x);
          
          float startRadius = 0.55;
          float currentRadius = startRadius + (uProgress * 0.4);
          
          float thickness = 0.12 * (1.0 - uProgress);
          
          float ring = smoothstep(currentRadius + thickness, currentRadius, dist) 
                     * smoothstep(currentRadius - thickness, currentRadius, dist);
                     
          vec2 sparkGrid = vec2(floor(angle * 60.0), floor(dist * 40.0));
          float sparkNoise = hash(sparkGrid);
          
          float sparks = step(0.75, sparkNoise) * ring;
          
          float dustNoise = hash(sparkGrid * 1.5 - vec2(uTime * 10.0));
          float dust = step(0.85, dustNoise) * ring * 0.5;
          
          float intensity = sparks + dust;
          
          intensity *= smoothstep(1.0, 0.7, uProgress);
          
          vec3 colStart = vec3(1.0, 1.0, 0.8);
          vec3 colMid = vec3(1.0, 0.6, 0.0);
          vec3 colEnd = vec3(0.8, 0.1, 0.0);
          
          vec3 finalColor = mix(colMid, colEnd, uProgress);
          finalColor = mix(colStart, finalColor, smoothstep(0.0, 0.3, uProgress));
          
          gl_FragColor = vec4(finalColor * intensity * 2.0, intensity);
        }`;
    Player.auraSparkShader = pg.createShader(ROCKET_SHARED_VERT_SRC, fragIskry);

    // 3. KADŁUB RAKIETY (v5 - walec + stożek)
    const fragKadlub = `precision mediump float;
      varying vec2 vUv;

      uniform float uTime;
      uniform float uShield;
      uniform float uImmortal;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i+vec2(0.0,0.0)), hash(i+vec2(1.0,0.0)), u.x),
                   mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
      }

      float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
      float sdTriangle(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
        vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
        vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
        vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
        vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
        vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
        float s = sign(e0.x * e2.y - e0.y * e2.x);
        vec2 d0 = vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x));
        vec2 d1 = vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x));
        vec2 d2 = vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x));
        vec2 d = min(min(d0, d1), d2);
        return -sqrt(d.x) * sign(d.y);
      }

      const float TAIL_X = -33.0;
      const float BODY_R = 11.0;
      const float NOSE_TIP = 42.0;
      const float BODY_FRONT = 10.0;

      float radiusAtSafe(float x) {
        if (x <= BODY_FRONT) return BODY_R;
        float t = clamp((NOSE_TIP - x) / (NOSE_TIP - BODY_FRONT), 0.0, 1.0);
        return BODY_R * t;
      }

      float sdTubeCone(vec2 p) {
        float r = radiusAtSafe(p.x);
        float distY = abs(p.y) - r;
        float distFront = p.x - NOSE_TIP;
        float distBack = -26.0 - p.x;
        return max(max(distY, distFront), distBack);
      }
      float sdFinTop(vec2 p) { return sdTriangle(p, vec2(-6.0,-10.0), vec2(-36.0,-10.0), vec2(-42.0,-27.0)); }
      float sdFinBot(vec2 p) { return sdTriangle(p, vec2(-6.0, 10.0), vec2(-36.0, 10.0), vec2(-42.0, 27.0)); }

      float sdHull(vec2 p) {
        float tube = sdTubeCone(p);
        float flatParts = min(sdFinTop(p), sdFinBot(p));
        float nozzleBox = sdBox(p - vec2(-29.0, 0.0), vec2(4.0, 7.0));
        flatParts = min(flatParts, nozzleBox);
        float hull = min(tube, flatParts);
        hull = max(hull, TAIL_X - p.x);
        return hull;
      }

      void main() {
        const float uZoom = 100.0;
        vec2 p = (vUv - 0.5) * uZoom;
        float aa = 0.6;

        float dTube = sdTubeCone(p);
        float dFlat = min(min(sdFinTop(p), sdFinBot(p)), sdBox(p - vec2(-29.0, 0.0), vec2(4.0, 7.0)));
        float d = sdHull(p);

        vec3 col = vec3(0.0);
        float alpha = 0.0;


        if (d < aa) {
          float nz_ = noise(p * 0.2);
          vec3 baseColor = vec3(0.20, 0.30, 0.46);
          if (nz_ > 0.55) baseColor = vec3(0.27, 0.37, 0.53);
          if (p.x < -20.0) baseColor = vec3(0.12, 0.12, 0.15);

          vec3 finalColor;
          float wTube = step(dTube, dFlat);

          float r = radiusAtSafe(p.x);
          float ny = clamp(p.y / max(r, 0.001), -1.0, 1.0);
          float nzC = sqrt(max(0.0, 1.0 - ny * ny));
          vec3 Ncyl = vec3(0.0, ny, nzC);
          vec3 LcylTop = normalize(vec3(-0.2, -1.0, 0.15));
          vec3 LcylBot = normalize(vec3(-0.2,  1.0, 0.8));
          float diffCyl = max(
            clamp(dot(Ncyl, LcylTop), 0.0, 1.0),
            clamp(dot(Ncyl, LcylBot), 0.0, 1.0)
          );
          vec3 cylColor = mix(baseColor * 0.5, baseColor * 1.5, diffCyl);
          cylColor += pow(diffCyl, 10.0) * 0.6;

          vec2 e = vec2(0.8, 0.0);
          vec2 grad = vec2(sdHull(p + e.xy) - sdHull(p - e.xy), sdHull(p + e.yx) - sdHull(p - e.yx));
          vec2 nFlat = normalize(grad + 1e-5);
          vec2 lightDirFlat = normalize(vec2(-0.5, p.y < 0.0 ? -1.0 : 1.0));
          float diffFlat = clamp(dot(nFlat, lightDirFlat) * 0.5 + 0.5, 0.0, 1.0);
          vec3 flatColor = mix(baseColor * 0.55, baseColor * 1.4, diffFlat);
          flatColor += pow(diffFlat, 8.0) * vec3(0.5);

          finalColor = mix(flatColor, cylColor, wTube);

          float rim = smoothstep(2.5, 0.0, abs(d));
          finalColor += rim * 0.15;

          float lines = smoothstep(0.97, 1.0, fract(p.x * 0.55)) + smoothstep(0.97, 1.0, fract(p.y * 0.6));
          finalColor -= vec3(lines * 0.15) * wTube;

          vec2 noz1 = vec2(TAIL_X, -3.8);
          vec2 noz2 = vec2(TAIL_X,  3.8);
          float distN1 = length(p - noz1);
          float distN2 = length(p - noz2);
          float maskRing = max(smoothstep(aa, -aa, abs(distN1 - 2.8) - 0.9), smoothstep(aa, -aa, abs(distN2 - 2.8) - 0.9));
          float maskHole = max(smoothstep(aa, -aa, distN1 - 1.8), smoothstep(aa, -aa, distN2 - 1.8));
          finalColor = mix(finalColor, vec3(0.06, 0.06, 0.07), maskRing);
          finalColor = mix(finalColor, vec3(0.02, 0.02, 0.02), maskHole);

          float shieldNorm = clamp(uShield / 100.0, 0.0, 1.0);
          float currentBarTopX = -18.0 + (52.0 * shieldNorm);
          
          float isBarVisible = step(p.x, currentBarTopX) * step(0.01, uShield);

          float coreBand = smoothstep(1.4, 0.0, abs(p.y)) * smoothstep(38.0, 30.0, p.x) * smoothstep(-22.0, -14.0, p.x);
          vec3 neonGlow = vec3(0.0, 0.85, 1.0);
          
          finalColor = mix(finalColor, neonGlow, coreBand * isBarVisible);
          finalColor += neonGlow * smoothstep(4.0, 0.0, abs(p.y)) * smoothstep(38.0,30.0,p.x) * smoothstep(-22.0,-14.0,p.x) * 0.25 * isBarVisible;

          if (uShield < 50.0 && uShield > 0.0) {
              float dangerLevel = (50.0 - uShield) / 50.0;
              
              vec2 fireCenter = vec2(currentBarTopX, 0.0); 
              
              float dist = distance(p, fireCenter);
              float angle = atan(p.y - fireCenter.y, p.x - fireCenter.x);
              
              float fireNoise = sin(angle * 12.0 + uTime * 15.0) * 1.5 + sin(angle * 7.0 - uTime * 10.0) * 1.5;
              
              float maxFireRadius = 3.0 + (15.0 * dangerLevel);
              
              if (dist < maxFireRadius + fireNoise) {
                  float fireIntensity = 1.0 - (dist / maxFireRadius);
                  vec3 fireColor = mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 0.8, 0.0), fireIntensity);
                  finalColor += fireColor * fireIntensity * 1.5;
              }
          }

          float dWinTop = sdTriangle(p, vec2(15.0,-2.0), vec2(15.0,-8.0), vec2(32.0,-2.0));
          float dWinBot = sdTriangle(p, vec2(15.0, 2.0), vec2(15.0, 8.0), vec2(32.0, 2.0));
          float maskWinFill = max(smoothstep(aa, -aa, dWinTop), smoothstep(aa, -aa, dWinBot));
          finalColor = mix(finalColor, vec3(0.02, 0.02, 0.03), maskWinFill);
          float maskWinFrame = smoothstep(aa, -aa, min(abs(dWinTop), abs(dWinBot)) - 0.7) * (1.0 - maskWinFill);
          finalColor = mix(finalColor, vec3(0.8), maskWinFrame);

          float tipTop = smoothstep(4.0, 0.0, length(p - vec2(-42.0, -27.0)));
          float tipBot = smoothstep(4.0, 0.0, length(p - vec2(-42.0, 27.0)));
          finalColor = mix(finalColor, vec3(1.0, 0.15, 0.45), max(tipTop, tipBot));

          if (uShield < 30.0) {
            float warn = 0.5 + 0.5 * sin(uTime * 18.0);
            finalColor += vec3(0.9, 0.0, 0.0) * warn * 0.3;
          }
          if (uImmortal > 0.5) {
            float goldPulse = 0.4 + 0.4 * sin(uTime * 6.0 + p.x * 0.3);
            finalColor += vec3(1.0, 0.75, 0.0) * goldPulse;
          }

          float maskHull = smoothstep(aa, -aa, d);
          col = mix(col, finalColor, maskHull);
          alpha = max(alpha, maskHull);
        }

        gl_FragColor = vec4(col, alpha);
      }`;
    Player.hullShader = pg.createShader(ROCKET_SHARED_VERT_SRC, fragKadlub);

    // 4. AUREOLA NIEŚMIERTELNOŚCI
    const fragAureola = `precision mediump float;
        varying vec2 vUv;
        
        uniform float uTime;
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
          for(int i = 0; i < 3; i++) { f += a * noise(p); p *= 2.0; a *= 0.5; }
          return f;
        }

        void main() {
          vec2 uv = (vUv - 0.5) * 2.0;
          float dist = length(uv);
          float angle = atan(uv.y, uv.x);
          
          float pulse = 1.0 + 0.1 * sin(uTime * 1.8);
          
          float baseRadius = 0.6 * pulse; 
          
          float plasma = fbm(vec2(angle * 6.0, dist * 15.0 - uTime * 4.0));
          
          float ringDist = abs(dist - baseRadius);
          
          float core = smoothstep(0.03, 0.0, ringDist);
          float glow = smoothstep(0.2, 0.0, ringDist) * 0.4;
          float spikes = smoothstep(0.15, 0.0, ringDist) * plasma * 1.5;
          
          float intensity = core + glow + spikes;
          
          vec3 colRed = vec3(1.0, 0.1, 0.0);
          vec3 colYellow = vec3(1.0, 0.9, 0.0);
          vec3 finalColor = mix(colRed, colYellow, uProgress);
          
          finalColor = mix(finalColor, vec3(1.0), core * 0.6);
          
          gl_FragColor = vec4(finalColor * intensity, intensity);
        }`;
    Player.aureolaShader = pg.createShader(ROCKET_SHARED_VERT_SRC, fragAureola);

    // 5. GŁÓWNE GAZY WYLOTOWE
    const fragSilnikGlowny = `precision mediump float;
      varying vec2 vUv;
      
      uniform float uTime;
      uniform float uScale;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i+vec2(0.0,0.0)), hash(i+vec2(1.0,0.0)), u.x),
                   mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
      }

      float fbm(vec2 p) {
        float f = 0.0;
        float a = 0.5;
        for(int i = 0; i < 3; i++) {
            f += a * noise(p);
            p *= 2.0;
            a *= 0.5;
        }
        return f;
      }

      void main() {
        vec2 uv = (vUv - 0.5) * 2.0;
        
        float startX = -0.38;
        float nozzleY1 = -0.136;
        float nozzleY2 = 0.136;
        
        vec3 finalColor = vec3(0.0);
        float finalAlpha = 0.0;
        
        float distLeft = startX - uv.x;
        
        if (distLeft > 0.0) {
            float maxFlameLen = 0.30 * uScale; 
            float nx = distLeft / maxFlameLen;
            
            if (nx < 1.0) {
                float width = mix(0.2, 0.1, nx);
                
                float p1 = 1.0 - smoothstep(0.0, width, abs(uv.y - nozzleY1));
                float p2 = 1.0 - smoothstep(0.0, width, abs(uv.y - nozzleY2));
                float profile = max(p1, p2);
                
                if (profile > 0.0) {
                    vec2 noiseUv = vec2(distLeft * 15.0 - uTime * 30.0, uv.y * 25.0);
                    float turb = fbm(noiseUv);
                    
                    float intensity = profile * pow(1.0 - nx, 1.5) * (0.4 + 0.6 * turb);
                    
                    vec3 coreColor = vec3(1.0, 0.9, 0.6);
                    vec3 midColor = vec3(1.0, 0.5, 0.0);
                    vec3 tipColor = vec3(0.8, 0.1, 0.0);
                    
                    vec3 fireColor = mix(tipColor, midColor, smoothstep(0.1, 0.5, intensity));
                    fireColor = mix(fireColor, coreColor, smoothstep(0.5, 1.0, intensity));
                    
                    finalColor = fireColor * intensity * 2.5;
                    finalAlpha = intensity;
                }
            }
        }
        
        gl_FragColor = vec4(finalColor, finalAlpha);
      }`;
    Player.mainEngineShader = pg.createShader(ROCKET_SHARED_VERT_SRC, fragSilnikGlowny);

    // 6. SILNIK COFANIA
    const fragSilnikCofania = `precision mediump float;
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
        for(int i = 0; i < 3; i++) { f += a * noise(p); p *= 2.0; a *= 0.5; }
        return f;
      }

      void main() {
        vec2 uv = (vUv - 0.5) * 2.0;
        
        float startX = -0.7; 
        float distRight = uv.x - startX;

        vec3 finalColor = vec3(0.0);
        float finalAlpha = 0.0;

        if (distRight > 0.0) {
            float maxFlameLen = 1.3;
            float nx = distRight / maxFlameLen;

            if (nx < 1.0) {

                // DOSTOSOWANIE GRUBOŚCI: mix(grubość początkowa, grubość końcowa)
                float width = mix(0.06, 0.24, nx);
                float profile = 1.0 - smoothstep(0.0, width, abs(uv.y));

                if (profile > 0.0) {
                    vec2 noiseUv = vec2(distRight * 12.0 - uTime * 25.0, uv.y * 20.0);
                    float turb = fbm(noiseUv);

                    float intensity = profile * pow(1.0 - nx, 1.2) * (0.4 + 0.6 * turb);

                    vec3 coreColor = vec3(1.0, 1.0, 0.7);
                    vec3 midColor  = vec3(1.0, 0.6, 0.0);
                    vec3 tipColor  = vec3(1.0, 0.1, 0.0);

                    vec3 fireColor = mix(tipColor, midColor, smoothstep(0.2, 0.6, intensity));
                    fireColor = mix(fireColor, coreColor, smoothstep(0.6, 1.0, intensity));

                    finalColor = fireColor * intensity * 2.5; 
                    finalAlpha = intensity;
                }
            }
        }
        gl_FragColor = vec4(finalColor, finalAlpha);
      }`;
    Player.reverseEngineShader = pg.createShader(ROCKET_SHARED_VERT_SRC, fragSilnikCofania);

    Player.shadersLoaded = true;
  }

  // pg = warstwa p5.Graphics w trybie WEBGL (gpuLayer z game.js)
  show(pg) {
    Player.initShaders(pg);

// początekshadera eksplozji rakiety
    if (this.explosionFrame > 0) {
      let progress = 1.0 - (this.explosionFrame / 120.0);

      pg.push();
      pg.translate(this.x, this.y, 0);
      pg.noStroke();
      pg.blendMode(ADD);
      pg.shader(Player.explosionShader);
      Player.explosionShader.setUniform('uProgress', progress);
      pg.plane(356, 356);
      pg.resetShader();
      pg.blendMode(BLEND);
      pg.pop();

      return; // Przerywamy renderowanie samej rakiety (bo wybuchła)
    }
// koniec shadera eksplozji rakiety

    if (this.postExplosionFrames > 0) {
      return; // Nie rysuj rakiety podczas dodatkowych 120 klatek
    }

    // --- NOWE RENDEROWANIE ISKIER ROZBITEJ AUREOLI (SHADER GPU) ---
    if (this.immortalityExplosionFrames > 0) {
      let progress = 1.0 - (this.immortalityExplosionFrames / 50.0);

      pg.push();
      pg.translate(this.auraExplosionX, this.auraExplosionY, 0);
      pg.noStroke();
      pg.blendMode(ADD);
      pg.shader(Player.auraSparkShader);
      Player.auraSparkShader.setUniform('uProgress', progress);
      Player.auraSparkShader.setUniform('uTime', millis() / 1000.0);
      pg.plane(260, 260);
      pg.resetShader();
      pg.blendMode(BLEND);
      pg.pop();
    }
    // --- KONIEC SHADERA ISKIER ROZBITEJ AUREOLI ---


    // ⭐ Wywołanie animacji silników cofania
    if (this.reversingEnginesActive) {
        this.drawReverseEngineThrust(pg);
    }
    // --- KADŁUB RAKIETY (v5 - walec + stożek) ---
    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.noStroke();
    pg.shader(Player.hullShader);
    Player.hullShader.setUniform('uTime', millis() / 1000.0);
    Player.hullShader.setUniform('uShield', parseFloat(this.shieldPower));
    Player.hullShader.setUniform('uImmortal', this.isImmortal ? 1.0 : 0.0);
    pg.plane(140, 140);
    pg.resetShader();
    pg.pop();
    // --- KONIEC KADŁUBA RAKIETY ---

    // --- NOWY EFEKT AUREOLI NIEŚMIERTELNOŚCI (SHADER GPU) ---
    if (this.isImmortal) {
      let colorProgress = 0.0;
      if (this.immortalityTimer <= 300) {
          colorProgress = 1.0 - (this.immortalityTimer / 300.0);
      }

      pg.push();
      pg.translate(this.x, this.y, 0);
      pg.noStroke();
      pg.blendMode(ADD);
      pg.shader(Player.aureolaShader);
      Player.aureolaShader.setUniform('uTime', millis() / 1000.0);
      Player.aureolaShader.setUniform('uProgress', colorProgress);
      pg.plane(240, 240);
      pg.resetShader();
      pg.blendMode(BLEND);
      pg.pop();
    }
    // --- KONIEC AUREOLI NIEŚMIERTELNOŚCI (SHADER GPU) ---



    if (this.bombAnimationProgress > 0) {
      push();
      let progress = this.bombAnimationProgress / 60;
      let currentRadius = 720 * progress;
      let fade = map(this.bombAnimationProgress, 0, 60, 255, 0);

      // 1. Rysowanie dymu
      noStroke();
      for (let p of this.bombParticles) {
        if (p.type === 'smoke') {
          fill(red(p.color), green(p.color), blue(p.color), p.alpha);
          ellipse(p.x, p.y, p.size);
        }
      }

      // 2. Rysowanie szerokiego czerwonego okręgu
      noFill();
      for(let w = 0; w < 10; w++) {
        let edgeAlpha = map(w, 0, 9, 10, fade * 0.4);
        if (w === 5) edgeAlpha = fade;
    
        stroke(120, 30, 30, edgeAlpha); 
        strokeWeight(1 + w * 1.1);
        ellipse(this.x, this.y, currentRadius * 2, currentRadius * 2);
      }

      // 3. Rysowanie iskier
      noStroke();
      for (let p of this.bombParticles) {
        if (p.type === 'spark') {
          fill(red(p.color), green(p.color), blue(p.color), p.alpha);
          ellipse(p.x, p.y, p.size);
        }
      }
      pop();
    }

    //  TUTAJ jest UNIWERSALNE ZBIERANIE CELÓW dla pioruna i atomówki
    let bombTargets = [];

    // A. Dodaj zwykłych przeciwników (z poziomów 1-9, 11-19 itd.)
    if (currentLevel && currentLevel.enemies) {
      bombTargets = bombTargets.concat(currentLevel.enemies);
    }

    // B. Dodaj przeciwników z jaskini (z poziomów 10, 20, 40 itd.)
    if (cave) {
      // Lista nazw tablic, które na pewno zawierają wrogów
      const enemyArrays = ['bats', 'spiders']; 
      
      for (let key of enemyArrays) {
        if (cave[key] && Array.isArray(cave[key])) {
           bombTargets = bombTargets.concat(cave[key]);
        }
      }
    }

    if (this.lightningBombAnimationProgress > 0) {
        push();
        let progress = this.lightningBombAnimationProgress / 30;
        stroke(0, 191, 255);
        strokeWeight(2);
        noFill();

        // Używamy uniwersalnej tablicy
        for (let target of bombTargets) {
            if (target && typeof target.x === 'number') {
                // Czy cel ma wiele części (np. Boss 2)?
                if (typeof target.getTargetableParts === 'function') {
                    let parts = target.getTargetableParts();
                    for (let part of parts) {
                        drawFractalLightning(this.x, this.y, part.x, part.y, progress);
                        if (progress > 0.8) {
                            fill(255, 255, 0, 200 * (1 - (progress - 0.8) / 0.2));
                            noStroke();
                            ellipse(part.x, part.y, 10, 10);
                        }
                    }
                } else {
                    // Standardowy pojedynczy wróg
                    drawFractalLightning(this.x, this.y, target.x, target.y, progress);
                    if (progress > 0.8) {
                        fill(255, 255, 0, 200 * (1 - (progress - 0.8) / 0.2));
                        noStroke();
                        ellipse(target.x, target.y, 10, 10);
                    }
                }
            }
        }
        pop();
    }


    // --- BOMBA ATOMOWA (Metoda 8: Podwójny Electric Storm) ---
    if (this.atomicBombAnimationProgress > 0) {
      push();
      let timer = this.atomicBombAnimationProgress; // od 1 do 29
      let waveDuration = 19; // Wyliczone idealnie pod limit 30 klatek
      let maxRadius = 300;

      for (let target of bombTargets) {
        if (target && typeof target.x === 'number') {
          let tx = (typeof target.getTargetableParts === 'function') ? target.getTargetableParts()[0].x : target.x;
          let ty = (typeof target.getTargetableParts === 'function') ? target.getTargetableParts()[0].y : target.y;

          // --- FALA 1 (klatki 1 - 19) ---
          if (timer >= 1 && timer <= waveDuration) {
            let p1 = timer / waveDuration; 
            drawElectricStormWave(tx, ty, maxRadius * p1, 255 * (1 - p1));
          }

          // --- FALA 2 (klatki 11 - 29) -> startuje po 10 klatkach ---
          let timer2 = timer - 10;
          if (timer2 >= 1 && timer2 <= waveDuration) {
            let p2 = timer2 / waveDuration;
            drawElectricStormWave(tx, ty, maxRadius * p2, 255 * (1 - p2));
          }
        }
      }
      pop();
    }

    // --- GŁÓWNE GAZY WYLOTOWE (SHADER GPU) ---
    let currentScale = 2.0; // Wzmacnia i wydłuża ogień ponad w wolnym locie

    // Sprawdzamy czy to etap 20 (jaskinia) albo czy dociśnięto prawą strzałkę
    if (typeof level !== 'undefined' && level === 20 || keyIsDown(RIGHT_ARROW)) {
        currentScale = 3.5; // Wzmacnia i wydłuża ogień ponad w szybkim locie
    }

    // TĄ ZMIENNĄ KONTROLUJESZ PRZESUNIĘCIE silników rakiety w prawo lub w lewo:
    let przesuniecieX = 15;

    pg.push();
    pg.translate(this.x - przesuniecieX, this.y, 0);
    pg.noStroke();
    pg.blendMode(ADD);
    pg.shader(Player.mainEngineShader);
    Player.mainEngineShader.setUniform('uTime', millis() / 1000.0);
    Player.mainEngineShader.setUniform('uScale', currentScale);
    pg.plane(140, 140);
    pg.resetShader();
    pg.blendMode(BLEND);
    pg.pop();
    // --- KONIEC GŁÓWNYCH GAZÓW WYLOTOWYCH ---

  }

  // ⭐ METODA: Rysowanie strug silników cofania (Wersja Shader GPU) ⭐
  // pg = warstwa p5.Graphics w trybie WEBGL (gpuLayer z game.js)
  drawReverseEngineThrust(pg) {
    let startX = 19.2; // Przesunięcie X od środka rakiety (przód)
    let offsetY = 14.4; // Przesunięcie Y (dla górnej i dolnej dyszy)

    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.noStroke();
    pg.blendMode(ADD);

    // Górny strumień silnika
    pg.push();
    pg.translate(startX, -offsetY, 0);
    pg.rotate(radians(-this.reverseThrustAngle));
    pg.translate(25, 0, 0); // przesuniecie shadera w prawo, plomien wystaje przed rakiete
    pg.shader(Player.reverseEngineShader);
    Player.reverseEngineShader.setUniform('uTime', millis() / 1000.0);
    pg.plane(80, 80);
    pg.resetShader();
    pg.pop();

    // Dolny strumień silnika
    pg.push();
    pg.translate(startX, offsetY, 0);
    pg.rotate(radians(this.reverseThrustAngle));
    pg.translate(25, 0, 0);
    pg.shader(Player.reverseEngineShader);
    Player.reverseEngineShader.setUniform('uTime', millis() / 1000.0);
    pg.plane(80, 80);
    pg.resetShader();
    pg.pop();

    pg.blendMode(BLEND);
    pg.pop();
  }
  // koniec shadera silnika cofania


  upgradeWeapon() {
    // Zakładamy, że 14 to Twój limit poziomów broni
    if (this.weaponLevel < 14) { 
      this.weaponLevel++;

      // ⭐ KLUCZOWA POPRAWKA LOGIKI ⭐
      // Zmieniamy maxWeaponLevel TYLKO jeśli obecny poziom jest wyższy niż rekord
      if (this.weaponLevel > this.maxWeaponLevel) {
        this.maxWeaponLevel = this.weaponLevel;

      }
      

      
      // Powiadomienie fireControllera, żeby rakieta od razu strzelała nową bronią
      if (typeof fireController !== 'undefined' && fireController.updateWeaponLevel) {
          fireController.updateWeaponLevel(this.weaponLevel);
      }
    }
  }
  // ZMODYFIKOWANA FUNKCJA TAKE DAMAGE W rakieta.js
  takeDamage(damage) {
    if (this.isImmortal) return;

    // --- NOWA MECHANIKA: SYSTEM AWARYJNY ---
    if (this.shieldPower <= 15 && this.weaponLevel > 1) {
      this.weaponLevel -= 1;

      // Obniżamy też limit wyboru broni gdy broń zostanie odebrana przez tarczę rakiety
      this.maxWeaponLevel = this.weaponLevel;
      
      // Powiadomienie kontrolera ognia o spadku poziomu broni
      if (typeof fireController !== 'undefined' && fireController.updateWeaponLevel) {
          fireController.updateWeaponLevel(this.weaponLevel);
      }
      
    } else {
      // Jeśli tarcza > 15% lub broń ma poziom 1, zabieraj tarczę
      this.shieldPower -= damage;
      
      if (this.shieldPower <= 0) {
        this.shieldPower = 0;
        this.startExplosion();
        this.postExplosionFrames = 120; // Licznik po wybuchu

      }
    }

    // Dźwięk kolizji odtwarzany zawsze przy trafieniu
    if (typeof playSoundKolizjaRakiety === 'function') {
      playSoundKolizjaRakiety();
    }
  }

  // --- EKSPLOZJA TARCZY NIEŚMIERTELNOŚCI ---
  explodeImmortalityShield() {
    // Tworzymy 30 iskier rozchodzących się promieniście
    let numSparks = 30;
    for (let i = 0; i < numSparks; i++) {
      let angle = (TWO_PI / numSparks) * i; // Kąt rozchodzenia się
      let speed = random(4, 8);               // Prędkość iskry
      
      let sparkCol;
      // Losujemy kolor: czerwień, złoto lub biel
      let r = random(1);
      if (r > 0.6) sparkCol = color(255, 255, 255);       // Biały
      else if (r > 0.3) sparkCol = color(255, 200, 50); // Złoty
      else sparkCol = color(255, 50, 50);              // Czerwony
      
      // Wykorzystujemy Twój istniejący system particle w rakieta.js
      this.jetParticles.push({
        x: this.x + cos(angle) * 30, // Start nieco odsunęty od centrum
        y: this.y + sin(angle) * 30,
        // Nadajemy prędkość kierunkową
        vx: cos(angle) * speed + this.vx, 
        vy: sin(angle) * speed,
        size: random(4, 7),
        life: random(20, 40), // Czas życia iskry
        color: sparkCol
      });
    }
  }

  // NOWA METODA: Sprawdza, czy rakieta może działać
  // Potrzebne aby rakieta nie strzelała po jej wybuchu
  // ta funkcja jest wykorzystana w pliku fire.js
  // Rakieta jest aktywna tylko gdy ma tarczę i nie jest w trakcie wybuchu
  isActive() {
       return this.shieldPower > 0 && this.explosionFrame === 0 && this.postExplosionFrames === 0;
  }

}

function drawFractalLightning(startX, startY, endX, endY, progress) {
  if (progress <= 0) return;
  let t = constrain(progress, 0, 1);
  let x = lerp(startX, endX, t);
  let y = lerp(startY, endY, t);
  let dx = endX - startX;
  let dy = endY - startY;
  let distance = sqrt(dx * dx + dy * dy);
  let steps = floor(distance / 10);
  let points = [{ x: startX, y: startY }];
  for (let i = 1; i < steps; i++) {
    let px = lerp(startX, endX, i / steps) + random(-5, 5);
    let py = lerp(startY, endY, i / steps) + random(-5, 5);
    points.push({ x: px, y: py });
    if (random() < 0.3) {
      let branchX = px + random(-10, 10);
      let branchY = py + random(-10, 10);
      points.push({ x: branchX, y: branchY });
      if (random() < 0.2) {
        let subBranchX = branchX + random(-5, 5);
        let subBranchY = branchY + random(-5, 5);
        points.push({ x: subBranchX, y: subBranchY });
      }
    }
  }
  points.push({ x: endX, y: endY });
  for (let i = 0; i < points.length - 1; i++) {
    line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }
}


// Pomocnicza funkcja dla podwójnej fali atomówki (Wklej na dole pliku)
function drawElectricStormWave(tx, ty, currentRadius, alpha) {
  push();
  stroke(50, 200, 255, alpha); // Elektryczny błękit
  strokeWeight(2);
  noFill();

  let numBolts = 7; // 7 wiązek plazmy rozchodzących się z wroga
  for (let i = 0; i < numBolts; i++) {
    // tx * 0.01 sprawia, że każdy wróg na ekranie ma unikalny kąt wylotu wiązek!
    let angle = (TWO_PI / numBolts) * i + (tx * 0.01); 
    let endX = tx + cos(angle) * currentRadius;
    let endY = ty + sin(angle) * currentRadius;

    // Wykorzystujemy Twoją gotową funkcję fraktalną
    drawFractalLightning(tx, ty, endX, endY, 1);
  }

  // Błysk plazmy w samym centrum uderzenia
  noStroke();
  fill(180, 240, 255, alpha * 0.5);
  ellipse(tx, ty, currentRadius * 0.25, currentRadius * 0.25);
  pop();
}