// Spider1.js - Pająk Wiszący (The Hanger)
// Wersja GPU: cała LOGIKA (fizyka, maszyna stanów AI, kolizje, obrażenia,
// transformacja w Spider2) BEZ ZMIAN. Zmienia się wyłącznie sposób RYSOWANIA:
// ciało+nogi, nić/pajęczyna, iskry trafienia i wybuch są teraz rysowane
// przez 4 shadery GPU zamiast ellipse()/line()/rect() na CPU.
//
// WYMAGANY OSOBNY KONTEKST WEBGL (tak jak w Bat/bat2.js):
// Level40 (i każdy inny poziom korzystający ze Spider1) musi przekazywać
// warstwę p5.Graphics w trybie WEBGL do metody show(pg), np.:
//     spider.show(pg); // pg = gpuLayer z game.js
//
// Instancje Spider1 mają flagę `usesGPUShaders = true`, po której Level40
// rozpoznaje, że ma wywołać show(pg) zamiast starego showAtOrigin(scaleFactor).

// ---------------------------------------------------------------------------
// Wspólny vertex shader (identyczny wzorzec jak w bat2.js)
// ---------------------------------------------------------------------------
const SPIDER_VERT_SRC = `
precision highp float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec2 vTexCoord;
void main() {
  vTexCoord = aTexCoord;
  vec4 positionVec4 = vec4(aPosition, 1.0);
  gl_Position = uProjectionMatrix * uModelViewMatrix * positionVec4;
}
`;

// ---------------------------------------------------------------------------
// 1) SHADER PAJĄKA — ciało (odwłok, głowotułów, oczy, szczękoczułki) oraz
//    8 animowanych nóg (SDF), sterowane parametrami stanu AI.
//    Kody stanu (uState): 0 DESCENDING, 1 WAITING, 2 ASCENDING,
//                          3 TOWING, 4 LATCHED, 5 FALLING
// ---------------------------------------------------------------------------
const SPIDER_BODY_FRAG_SRC = `
precision highp float;
varying vec2 vTexCoord;

uniform vec2 uSize;
uniform float uScale;       // skala renderowania (odpowiednik dawnego scaleFactor)
uniform float uState;
uniform float uWalkCycle;
uniform float uFrameCount;

#define PI 3.14159265359

float sdEllipse(vec2 p, vec2 r) {
  return (length(p / r) - 1.0) * min(r.x, r.y);
}
float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
vec4 layer(vec4 base, vec3 col, float d, float aa) {
  float a = 1.0 - smoothstep(-aa, aa, d);
  return mix(base, vec4(col, 1.0), a);
}

bool isMovingState(float s) {
  return (s < 0.5) || (abs(s - 2.0) < 0.5) || (abs(s - 3.0) < 0.5) || (abs(s - 5.0) < 0.5);
}

// Odpowiednik JS drawLeg(side, index) - zwraca 4 punkty stawów nogi
void legPoints(float side, float index, out vec2 hip, out vec2 knee, out vec2 mid, out vec2 foot) {
  bool moving = isMovingState(uState);
  float currentCycle = (index < 1.5 || moving) ? (uFrameCount * 0.05 + uWalkCycle) : 0.0;
  if (abs(uState - 1.0) < 0.5 && index >= 1.5) currentCycle = PI;      // WAITING (tylne sztywne)
  if (abs(uState - 4.0) < 0.5) currentCycle = PI * 0.5;                // LATCHED (skurczone)

  float phase = index * PI * 0.5 + (side > 0.0 ? PI : 0.0);
  float cyc = currentCycle + phase;

  float ax = 10.0 * side;
  float ay = 15.0 - (index * 10.0);
  hip = vec2(ax, ay);

  if (index < 1.5) {
    // PRZEDNIE
    float reachDown = 70.0 + index * 25.0;
    if (abs(uState - 4.0) < 0.5) reachDown = 40.0; // skurczone przy ataku
    float spread = (20.0 + index * 15.0) * side;
    float probe = sin(cyc) * 8.0;
    knee = vec2((30.0 + probe) * side, ay + 20.0);
    mid  = vec2(knee.x + 15.0 * side, knee.y + 30.0);
    foot = vec2(spread + probe, ay + reachDown + probe);
  } else {
    // TYLNE
    float footYOffset = sin(cyc) * 35.0;
    if (!moving) footYOffset = 0.0;
    foot = vec2(0.0, ay - 50.0 + footYOffset);
    knee = vec2((45.0 + index * 5.0 + cos(cyc) * 8.0) * side, ay - 25.0 + sin(cyc) * 5.0);
    mid  = vec2(knee.x + 10.0 * side, knee.y - 15.0);
  }
}

void drawLegSDF(inout vec4 col, float side, float index, vec2 p, float aa) {
  vec2 hip, knee, mid, foot;
  legPoints(side, index, hip, knee, mid, foot);

  float legD = min(sdSegment(p, hip, knee), min(sdSegment(p, knee, mid), sdSegment(p, mid, foot))) - 1.5;
  col = layer(col, vec3(120.0, 255.0, 180.0) / 255.0, legD, aa);

  // Stawy (żółte kropki), ostatni (stopa) grubszy - jak w oryginale
  col = layer(col, vec3(200.0, 180.0, 0.0) / 255.0, length(p - hip)  - 2.5, aa);
  col = layer(col, vec3(200.0, 180.0, 0.0) / 255.0, length(p - knee) - 2.5, aa);
  col = layer(col, vec3(200.0, 180.0, 0.0) / 255.0, length(p - mid)  - 2.5, aa);
  col = layer(col, vec3(200.0, 180.0, 0.0) / 255.0, length(p - foot) - 3.0, aa);
}

void main() {
  vec2 pScreen = (vTexCoord - 0.5) * uSize;
  vec2 p = pScreen / uScale; // wspolrzedne w jednostkach projektowych (1:1 z oryginalnym JS)
  float aa = 1.4;

  vec4 col = vec4(0.0);

  // 1. TYLNE NOGI (indeksy 2 i 3) - rysowane najpierw, w tle
  drawLegSDF(col, -1.0, 2.0, p, aa);
  drawLegSDF(col,  1.0, 2.0, p, aa);
  drawLegSDF(col, -1.0, 3.0, p, aa);
  drawLegSDF(col,  1.0, 3.0, p, aa);

  // 2. PRZEDNIE NOGI (indeksy 0 i 1)
  drawLegSDF(col, -1.0, 0.0, p, aa);
  drawLegSDF(col,  1.0, 0.0, p, aa);
  drawLegSDF(col, -1.0, 1.0, p, aa);
  drawLegSDF(col,  1.0, 1.0, p, aa);

  // 3. ODWLOK
  float abdY = -35.0;
  float abdomen = sdEllipse(p - vec2(0.0, abdY), vec2(30.0, 40.0));
  col = layer(col, vec3(20.0, 140.0, 80.0) / 255.0, abdomen, aa);

  // Plamki (4 sztuki, dokladne pozycje/rozmiary z oryginalu)
  float spot0 = sdEllipse(p - vec2(0.0, abdY) - vec2(-10.0, -15.0), vec2(6.0, 7.2));
  float spot1 = sdEllipse(p - vec2(0.0, abdY) - vec2(12.0, -5.0),   vec2(5.0, 6.0));
  float spot2 = sdEllipse(p - vec2(0.0, abdY) - vec2(0.0, 15.0),    vec2(7.5, 9.0));
  float spot3 = sdEllipse(p - vec2(0.0, abdY) - vec2(-12.0, 25.0),  vec2(4.0, 4.8));
  col = layer(col, vec3(100.0, 200.0, 120.0) / 255.0, spot0, aa);
  col = layer(col, vec3(100.0, 200.0, 120.0) / 255.0, spot1, aa);
  col = layer(col, vec3(100.0, 200.0, 120.0) / 255.0, spot2, aa);
  col = layer(col, vec3(100.0, 200.0, 120.0) / 255.0, spot3, aa);

  // 4. GLOWOTULOW
  float head = sdEllipse(p - vec2(0.0, 5.0), vec2(17.5, 20.0));
  col = layer(col, vec3(60.0, 220.0, 140.0) / 255.0, head, aa);

  // 5. OCZY
  col = layer(col, vec3(1.0, 0.0, 0.0), length(p - vec2(-6.0, 12.0)) - 2.0, aa);
  col = layer(col, vec3(1.0, 0.0, 0.0), length(p - vec2(6.0, 12.0))  - 2.0, aa);
  col = layer(col, vec3(1.0, 0.0, 0.0), length(p - vec2(-12.0, 8.0)) - 1.5, aa);
  col = layer(col, vec3(1.0, 0.0, 0.0), length(p - vec2(12.0, 8.0))  - 1.5, aa);

  // SZCZEKOCZULKI
  float mandL = sdSegment(p, vec2(-5.0, 18.0), vec2(-8.0, 30.0)) - 1.5;
  float mandR = sdSegment(p, vec2(5.0, 18.0), vec2(8.0, 30.0)) - 1.5;
  col = layer(col, vec3(10.0, 80.0, 40.0) / 255.0, mandL, aa);
  col = layer(col, vec3(10.0, 80.0, 40.0) / 255.0, mandR, aa);

  if (col.a < 0.01) discard;
  gl_FragColor = col;
}
`;

// ---------------------------------------------------------------------------
// 2) SHADER PAJĘCZYNY / NICI — prosty, gładki odcinek (bez drgań, w
//    przeciwieństwie do żółtej nici porwania u Bat) - jedna nić zwisania
//    LUB nić holowania w kierunku gracza.
// ---------------------------------------------------------------------------
const SPIDER_WEB_FRAG_SRC = `
precision highp float;
varying vec2 vTexCoord;

uniform vec2 uSize;
uniform vec2 uStart;
uniform vec2 uEnd;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uThickness;

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 p = (vTexCoord - 0.5) * uSize;
  float d = sdSegment(p, uStart, uEnd) - uThickness;
  float a = (1.0 - smoothstep(-1.0, 1.0, d)) * uAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

// ---------------------------------------------------------------------------
// 3) SHADER ISKIER TRAFIENIA — wersja ostra, drobna i subtelna
// ---------------------------------------------------------------------------
const SPIDER_HITSPARK_FRAG_SRC = `
precision highp float;
varying vec2 vTexCoord;

uniform vec2 uSize;
uniform vec3 uColor;
uniform float uAlpha;

float dLine(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  // Płótno pozostaje to samo, ale możemy wirtualnie zmniejszyć cząstkę, 
  // dzieląc uSize przez dodatkowy współczynnik (tutaj mnożymy p przez 1.5, co pomniejszy iskrę wizualnie)
  vec2 p = (vTexCoord - 0.5) * (uSize * 1.5);
  
  // Skracamy fizyczny rdzeń iskry
  vec2 a = vec2(-uSize.x * 0.2, 0.0);
  vec2 b = vec2(uSize.x * 0.2, 0.0);
  
  float dist = dLine(p, a, b);

  // DRASTYCZNA ZMIANA: Zmniejszamy grubość promienia. 
  // Zamiast uSize.y * 0.8, dajemy uSize.y * 0.15 (iskra będzie cieniutka)
  float glow = smoothstep(uSize.y * 0.15, 0.0, dist);
  
  // Zwiększamy potęgę z 1.5 na 3.0. 
  // Sprawi to, że poświata zniknie niemal natychmiast, zostawiając ostry środek
  glow = pow(glow, 3.0); 

  float finalAlpha = glow * uAlpha;
  
  if (finalAlpha < 0.01) discard;
  
  gl_FragColor = vec4(uColor * glow, finalAlpha);
}
`;

// ---------------------------------------------------------------------------
// 4) SHADER WYBUCHU PAJĄKA NAZIEMNEGO — Nowa fala uderzeniowa FBM
// ---------------------------------------------------------------------------
const SPIDER_EXPLOSION_FRAG_SRC = `
precision highp float;
varying vec2 vTexCoord;

uniform float uProgress; // Postęp od 0.0 (start) do 1.0 (koniec)

float hash(vec2 p) { 
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); 
}

float noise(vec2 p) {
  vec2 i = floor(p); 
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// FBM generujący poszarpaną materię plazmy
float fbm(vec2 p) {
  float f = 0.0; float a = 0.5;
  for(int i = 0; i < 4; i++) { 
    f += a * noise(p); 
    p *= 2.0; 
    a *= 0.5; 
  }
  return f;
}

void main() {
  // Centrowanie współrzędnych i korekta proporcji pod warstwę WEBGL pająka
  vec2 uv = (vTexCoord - 0.5) * 2.0;
  float dist = length(uv);
  float angle = atan(uv.y, uv.x);
  
  // Zmienna promienia uderzenia - rośnie w czasie
  float currentRadius = uProgress * 1.2;
  
  // Generowanie szumu, który rozrywa falę w czasie
  float burstNoise = fbm(uv * 8.0 - uProgress * 3.0);
  float sparksNoise = fbm(vec2(angle * 12.0, dist * 15.0 - uProgress * 10.0));
  
  // 1. Rdzeń wybuchu (gęsta chmura w środku, szybko zanikająca)
  // Poprawiony błąd "0.0 - smoothstep" na "1.0 - smoothstep"
  float core = smoothstep(0.1, 0.0, dist) * (1.0 - smoothstep(0.0, 0.3, uProgress));
  
  // 2. Poszarpana fala uderzeniowa (rozszerzający się pierścień)
  float ringThickness = 0.2 * (1.0 - uProgress);
  float shockwave = smoothstep(currentRadius + ringThickness, currentRadius, dist) 
                  * smoothstep(currentRadius - ringThickness - 0.2, currentRadius, dist);
                  
  // Rozbicie fali uderzeniowej szumem
  shockwave *= smoothstep(0.3, 0.7, burstNoise);
  
  // 3. Rozpryskujące się odłamki na zewnętrznej krawędzi fali
  float sparks = smoothstep(0.65, 0.8, sparksNoise) 
               * smoothstep(currentRadius + 0.3, currentRadius - 0.3, dist);
  
  // Suma elementów kształtu wybuchu
  float shape = core + shockwave + sparks;
  
  // Płynne zanikanie całości w ostatnich 40% trwania animacji
  float fadeOut = 1.0 - smoothstep(0.6, 1.0, uProgress);
  float intensity = shape * fadeOut;
  
  // Obliczamy odległość od środka, która wymusza zanikanie przy krawędziach płótna
  float edgeFade = smoothstep(0.95, 0.6, dist); 
  intensity *= edgeFade;
  
  // --- ZMIENIONE KOLORY (Toksyczna Pajęcza Eksplozja) ---
  vec3 colDarkGreen = vec3(0.05, 0.35, 0.13); // Ciemna zieleń (pancerz)
  vec3 colToxic     = vec3(0.23, 0.90, 0.11); // Toksyczna zieleń
  vec3 colYellow    = vec3(1.00, 0.92, 0.00); // Żółte smugi (największa temperatura)
  
  // Mieszanie kolorów w oparciu o siłę wybuchu na danym pikselu
  vec3 fireColor = mix(colDarkGreen, colToxic, smoothstep(0.1, 0.4, intensity));
  fireColor = mix(fireColor, colYellow, smoothstep(0.4, 0.8, intensity));
  
  // Dodatkowe rozjaśnienie najgorętszych miejsc (biały rdzeń)
  fireColor = mix(fireColor, vec3(1.0), smoothstep(0.8, 1.0, intensity));
  
  // Odrzucenie pikseli w celu odciążenia karty graficznej
  if (intensity < 0.01) discard;
  
  gl_FragColor = vec4(fireColor * intensity * 2.0, intensity);
}
`;

class Spider1 {
  constructor(levelRef, x, startY) {
    // === KONFIGURACJA BALANSOWA ===
    this.health = 40;
    this.points = 100;
    this.damageAmount = 5; // 5% tarczy

    // === ODNIESIENIA I POZYCJA ===
    this.level = levelRef;
    this.x = x;
    this.y = startY;
    this.anchorY = startY;

    // === STAN I FIZYKA ===
    this.state = "DESCENDING";
    this.speed = 1.5;
    this.maxDrop = random(150, 350);
    this.targetY = this.anchorY + this.maxDrop;

    this.timer = 0;
    this.towTimer = 0;          // Licznik dla holowania
    this.walkCycle = 0;
    this.hitFlash = 0;
    this.isDead = false;

    // === WYBUCH (jawna inicjalizacja - w oryginale było niejawne undefined) ===
    this.explosionFrame = 0;
    this.explosionParticles = [];

    // === WŁASNY SYSTEM ISKIER TRAFIENIA (zamiast level.spawnSparks) ===
    this.hitSparks = [];

    // === PARAMETRY KOLIZJI ===
    this.radius = 35;
    this.latchRange = 100;

    // === FLAGA ROZPOZNAWANA PRZEZ Level40.show() ===
    // Mówi wywołującemu poziomowi: "rysuj mnie przez show(pg), nie showAtOrigin()"
    this.usesGPUShaders = true;
  }

  // -----------------------------------------------------------------------
  // Jednorazowa (statyczna) inicjalizacja 4 shaderów na przekazanej warstwie
  // WEBGL (`pg`), współdzielona przez wszystkie instancje Spider1.
  // -----------------------------------------------------------------------
  static initShaders(pg) {
    if (Spider1.shadersLoaded) return;
    Spider1.bodyShader = pg.createShader(SPIDER_VERT_SRC, SPIDER_BODY_FRAG_SRC);
    Spider1.webShader = pg.createShader(SPIDER_VERT_SRC, SPIDER_WEB_FRAG_SRC);
    Spider1.hitSparkShader = pg.createShader(SPIDER_VERT_SRC, SPIDER_HITSPARK_FRAG_SRC);
    Spider1.explosionShader = pg.createShader(SPIDER_VERT_SRC, SPIDER_EXPLOSION_FRAG_SRC);
    Spider1.shadersLoaded = true;
  }

  update(wallSpeed) {

    for (let exp of this.hitSparks) {
        for (let p of exp.particles) {
            p.x += p.vx;
            p.y += p.vy;
        }
        exp.currentFrame--;
    }

    // Logika odliczania do usunięcia z nową fizyką potrójnego wybuchu
    if (this.explosionFrame > 0) {

      // PRZESUNIĘCIE PODCZAS WYBUCHU
      this.x += (wallSpeed || 0);
      
      this.explosionFrame--;

      if (this.explosionFrame <= 0) {
        this.isDead = true;
      }
      return; // Wczesny powrót - podczas wybuchu pająk nie wykonuje akcji AI
    }

    if (this.isDead) return;

    // 2. Blokujemy TYLKO interakcje, jeśli pająk już wybucha
    if (!(this.explosionFrame > 0)) {

      // Sprawdzanie kolizji
      this.checkCatchPlayer();
      this.checkThreadCollision();
    }

    // 3. RUCH WRAZ Z JASKINIĄ (tylko gdy nie jest przyczepiony)
    if (this.state !== "LATCHED" && this.state !== "TOWING" && this.state !== "FALLING") {
        this.x += wallSpeed;
    }

    // 4. MASZYNA STANÓW
    switch (this.state) {
      case "DESCENDING":
        this.y += this.speed;
        this.walkCycle += 0.15;
        if (this.y >= this.targetY) {
          this.state = "WAITING";
          this.timer = 120;
        }
        break;

      case "WAITING":
        this.timer--;
        if (this.timer <= 0) this.state = "ASCENDING";
        break;

      case "ASCENDING":
        this.y -= this.speed;
        this.walkCycle += 0.15;
        if (this.y <= this.anchorY + 10) { 
          this.state = "DESCENDING"; 
          this.targetY = this.anchorY + random(100, 300); 
        }
        break;

      case "TOWING":

        // DYNAMICZNA WSPINACZKA (Postęp od 0 do 1)
        let progress = 1 - (this.towTimer / 180); // Zakładamy 180 klatek wspinaczki
        if (progress > 1) progress = 1;

        // Cel dąży od -60px (z tyłu) do 0px (na rakiecie)
        let currentOffsetX = lerp(-60, 0, progress);
        let currentOffsetY = lerp(20, 0, progress);

        this.x = lerp(this.x, player.x + currentOffsetX, 0.1);
        this.y = lerp(this.y, player.y + currentOffsetY, 0.1);
        
        this.towTimer--;
        this.walkCycle += 0.4;

        if (this.towTimer <= 0) {
           this.state = "LATCHED";
           this.timer = 30; // Krótka chwila "uścisku" przed atakiem
        }
        break;

      case "LATCHED":
        // Atak na kadłubie
        this.x = player.x;
        this.y = player.y;
        this.walkCycle += 0.3; 
        
        // Zadanie obrażeń raz, na początku stanu
        if (this.timer === 30 && !(this.explosionFrame > 0)) { // Nie rani, jeśli już wybucha
            this.applyDamageToPlayer();
        }
        
        this.timer--;
        if (this.timer <= 0) {
          this.detachAndFall();
        }
        break;

      case "FALLING":
        this.y += 6; 
        this.walkCycle += 0.2;
        
        let floorY = height;
        if (this.level && this.level.bottomWalls) {
           let wall = this.level.bottomWalls.find(w => Math.abs(w.x - this.x) < 30);
           if (wall) floorY = wall.y;
        }

        if (this.y >= floorY - 20) {
          this.transformToSpider2();
        }
        break;
    }
  }

  takeDamage(damage) {
    if (this.isDead || this.explosionFrame > 0) return false;
    
    this.health -= damage;
    
    if (this.health <= 0) {
    //      score += this.points; punkty zakomentowałem bo dodają się już w explode()
      this.explode(); 
      return true;
    }
    return false;
  }

  checkCatchPlayer() {
    if (player.isImmortal || player.isDead || this.isDead || this.state === "FALLING" || this.state === "TOWING" || this.state === "LATCHED") return;
    
    let d = dist(this.x, this.y, player.x, player.y);
    if (d < this.latchRange) {

      this.state = "TOWING";
      this.towTimer = 180; 
    }
  }

  checkThreadCollision() {
    if (this.isDead || this.state === "FALLING" || this.state === "LATCHED" || this.state === "TOWING") return;

    let margin = 15; 
    if (player.x + player.width/2 > this.x - margin && player.x - player.width/2 < this.x + margin) {
      if (player.y > this.anchorY && player.y < this.y) {

        this.decideThreadCutScenario();
      }
    }
  }

  hitByBullet(bullet) {
    // NOWE ZABEZPIECZENIE: Jeśli pająk nie żyje lub JEST W TRAKCIE WYBUCHU,
    // pociski gracza po prostu przez niego przelatują i nie wywołują ponownych eksplozji
    if (this.isDead || this.explosionFrame > 0) return false;

    let d = dist(bullet.x, bullet.y, this.x, this.y - 15); 
    if (d < this.radius) {
      let damageValue = bullet.damage || 10; 
      this.health -= damageValue;

      // WŁASNE ISKRY TRAFIENIA (shader), zamiast generycznych iskier poziomu
      this._spawnHitSparks(bullet.x, bullet.y);

      if (this.health <= 0) this.explode();
      return true; 
    }
    return false;
  }

  _spawnHitSparks(x, y) {
    let particlesArray = [];
    for (let i = 0; i < 10; i++) {
      particlesArray.push({
        x: x,
        y: y,
        vx: random(-3, 3),
        vy: random(-3, 3),
        size: random(1, 3)
      });
    }
    this.hitSparks.push({
      particles: particlesArray,
      currentFrame: 40
    });
  }

  decideThreadCutScenario() {
    if (random(100) < 50) {
      this.state = "FALLING";
    } else {
      this.state = "TOWING"; 
      this.towTimer = 180;
    }
  }

  explode() {
    // Zabezpieczenie: jeśli już wybuchamy, nie zaczynaj od nowa
    if (this.explosionFrame > 0) return; 

    // Ustawiamy czas trwania eksplozji
    this.explosionFrame = 60; 
    
    this.hitSparks = [];

    // Przyznanie punktów za zniszczenie pająka
    if (typeof score !== 'undefined') score += this.points;
  }

  applyDamageToPlayer() {
    if (!player.isImmortal) {
      player.takeDamage(this.damageAmount);
      if (typeof playSoundKolizjaRakiety === 'function') playSoundKolizjaRakiety();
      if (player.shieldPower <= 0 && typeof player.startExplosion === 'function') {
        player.startExplosion();
      }
    }
  }

  detachAndFall() {
    this.state = "FALLING";
    this.x += random(-15, 15);
  }

  transformToSpider2() {
    this.isDead = true;
    if (typeof Spider2 !== 'undefined' && this.level && this.level.spiders) {
      this.level.spiders.push(new Spider2(this.level, this.x, this.y));
    }
  }

  // -----------------------------------------------------------------------
  // RYSOWANIE (GPU) — punkt wejścia wywoływany z Level40.show(pg).
  // scale domyślnie 0.75, dokładnie jak dawny scaleFactor w Level40.
  // -----------------------------------------------------------------------
  show(pg, scale = 0.75) {
    Spider1.initShaders(pg);

    // Iskry trafienia (własny system, shader)
    if (this.hitSparks.length > 0) {
      this._drawHitSparks(pg);
    }

    // Wybuch (shader, 3 warstwy)
    if (this.explosionFrame > 0) {
      this._drawExplosion(pg);
      return;
    }

    if (this.isDead) return;

    // Nić / pajęczyna (shader) - rysowana PRZED ciałem, tak jak w oryginale
    this._drawThread(pg);

    // Ciało pająka z nogami (shader)
    this._drawBody(pg, scale);
  }

  _drawBody(pg, scale) {
    const stateMap = {
      DESCENDING: 0, WAITING: 1, ASCENDING: 2,
      TOWING: 3, LATCHED: 4, FALLING: 5
    };
    let designW = 240, designH = 320;
    let w = designW * scale;
    let h = designH * scale;

    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.noStroke();
    pg.shader(Spider1.bodyShader);
    Spider1.bodyShader.setUniform('uSize', [w, h]);
    Spider1.bodyShader.setUniform('uScale', scale);
    Spider1.bodyShader.setUniform('uState', stateMap[this.state] ?? 0);
    Spider1.bodyShader.setUniform('uWalkCycle', this.walkCycle);
    Spider1.bodyShader.setUniform('uFrameCount', frameCount);
    pg.plane(w, h);
    pg.resetShader();
    pg.pop();
  }

  _drawThread(pg) {
    // Odpowiednik oryginalnego warunku w showAtOrigin():
    // LATCHED / FALLING -> brak nici; TOWING -> nić do gracza; reszta -> nić zwisania
    if (this.state === "TOWING") {
      this._drawThreadSegment(pg, this.x, this.y, player.x, player.y, [1.0, 1.0, 1.0], 0.7);
    } else if (this.state !== "LATCHED" && this.state !== "FALLING") {
      this._drawThreadSegment(pg, this.x, this.anchorY, this.x, this.y, [150 / 255, 150 / 255, 150 / 255], 1.0);
    }
  }

  _drawThreadSegment(pg, sx, sy, ex, ey, color, alpha) {
    let minX = min(sx, ex) - 10, maxX = max(sx, ex) + 10;
    let minY = min(sy, ey) - 10, maxY = max(sy, ey) + 10;
    let w = max(maxX - minX, 10), h = max(maxY - minY, 10);
    let cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

    pg.push();
    pg.translate(cx, cy, 0);
    pg.noStroke();
    pg.shader(Spider1.webShader);
    Spider1.webShader.setUniform('uSize', [w, h]);
    Spider1.webShader.setUniform('uStart', [sx - cx, sy - cy]);
    Spider1.webShader.setUniform('uEnd', [ex - cx, ey - cy]);
    Spider1.webShader.setUniform('uColor', color);
    Spider1.webShader.setUniform('uAlpha', alpha);
    Spider1.webShader.setUniform('uThickness', 1.0);
    pg.plane(w, h);
    pg.resetShader();
    pg.pop();
  }

  _drawHitSparks(pg) {
    pg.push();
    pg.blendMode(ADD);
    pg.noStroke();
    
    // Ustawiamy shader RAZ dla całej grupy cząsteczek
    pg.shader(Spider2.hitSparkShader);
    
    for (let exp of this.hitSparks) {
      let alpha = map(exp.currentFrame, 0, 40, 0, 255) / 255;
      for (let p of exp.particles) {
        pg.push();
        pg.translate(p.x, p.y, 0);
        pg.rotate(atan2(p.vy, p.vx));
        
        // Aktualizujemy tylko uniformy, shader już jest aktywny
        Spider2.hitSparkShader.setUniform('uSize', [max(p.size * 12, 2), max(p.size * 3, 2)]);
        Spider2.hitSparkShader.setUniform('uColor', [1.0, 220 / 255, 60 / 255]);
        Spider2.hitSparkShader.setUniform('uAlpha', alpha);
        
        pg.plane(p.size * 12, p.size * 3);
        pg.pop();
      }
    }
    
    pg.resetShader();
    pg.blendMode(BLEND);
    pg.pop();
  }

  _drawExplosion(pg) {
    pg.push();
    
    // Ustawienie blendowania (możesz zmienić na BLEND, w zależności od tego jak wygląda Twój shader)
    pg.blendMode(ADD); 
    pg.noStroke();
    
    // Przesunięcie płótna na pozycję pająka (uwzględniamy -15px w osi Y z oryginału)
    pg.translate(this.x, this.y - 15, 0);
    
    pg.shader(Spider2.explosionShader);
    
    // Obliczamy postęp eksplozji od 0.0 (początek) do 1.0 (koniec)
    let progress = 1.0 - (this.explosionFrame / 60.0);
    Spider2.explosionShader.setUniform('uProgress', progress);
    
    // Rysujemy jedną matrycę, która przykryje cały obszar wybuchu (np. 256x256)
    pg.plane(256, 256); 
    
    pg.resetShader();
    pg.blendMode(BLEND);
    pg.pop();
  }
}
