// Spider2.js - Pająk Naziemny (The Walker) + WebProjectile (pajęczyna-pocisk)
// Wersja GPU: cała LOGIKA (ruch, maszyna stanów, kolizje, obrażenia, strzelanie
// pajęczynami) BEZ ZMIAN. Zmienia się wyłącznie sposób RYSOWANIA:
// ciało+nogi, wybuch i iskry trafienia pająka - shadery (jak w Spider1),
// PLUS nowy shader sieci pajęczej (WebProjectile) w dwóch trybach:
//   uMode 0 = fruwająca/rozwijająca się sieć (pocisk lecący w stronę gracza)
//   uMode 1 = kokon oplotu (gdy pajęczyna owinie się na kadłubie rakiety)
//
// WYMAGANY OSOBNY KONTEKST WEBGL (tak jak w Bat/Spider1):
// Level40 przekazuje warstwę p5.Graphics w trybie WEBGL do show(pg).

// ---------------------------------------------------------------------------
// Wspólny vertex shader
// ---------------------------------------------------------------------------
const SPIDER2_VERT_SRC = `
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
// 1) SHADER CIAŁA PAJĄKA NAZIEMNEGO — odwłok, plamki, głowotułów, oczy,
//    nogogłaszczki i 4 animowane nogi (SDF), zależne od kierunku marszu (uDir).
// ---------------------------------------------------------------------------
const SPIDER2_BODY_FRAG_SRC = `
precision highp float;
varying vec2 vTexCoord;

uniform vec2 uSize;
uniform float uDir;       // -1 lub 1, kierunek marszu (odbicie poziome)
uniform float uWalkCycle;

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
vec4 layer(vec4 base, vec3 col, float alphaMul, float d, float aa) {
  float a = (1.0 - smoothstep(-aa, aa, d)) * alphaMul;
  return mix(base, vec4(col, 1.0), a);
}

// Odpowiednik JS drawAnimatedLeg(ax, ay, index)
void legPoints(float index, float frontOffset, out vec2 anchor, out vec2 s, out vec2 j2, out vec2 j3, out vec2 foot) {
  float legOx, phaseOff, reachCenter, amplitude;

  if (index < 0.5)      { legOx = -6.0; phaseOff = PI * 1.5; reachCenter = -50.0; amplitude = 35.0; }
  else if (index < 1.5) { legOx = -2.0; phaseOff = PI * 1.0; reachCenter = -20.0; amplitude = 20.0; }
  else if (index < 2.5) { legOx =  2.0; phaseOff = PI * 0.5; reachCenter =  25.0; amplitude = 20.0; }
  else                  { legOx =  6.0; phaseOff = 0.0;      reachCenter =  65.0; amplitude = 45.0; }

  float currentPhase = uWalkCycle + phaseOff + (frontOffset * 3.14159);

  float footXOffset = (reachCenter - cos(currentPhase) * amplitude) * uDir;
  float lift = sin(currentPhase);
  float currentLift = lift > 0.0 ? pow(lift, 1.5) * 20.0 : 0.0;
  float footYOffset = 35.0 - currentLift;

  anchor = vec2(legOx * uDir, frontOffset * 3.0);
  foot = anchor + vec2(footXOffset, footYOffset);

  s = anchor + vec2(-cos(currentPhase) * 5.0 * uDir, -18.0 + sin(currentPhase) * 3.0);
  j2 = anchor + vec2(footXOffset * 0.4 - cos(currentPhase + 0.4) * 6.0 * uDir, -42.0 + sin(currentPhase) * 5.0);

  float smoothAmort = lift > 0.0 ? lift * 5.0 : 0.0;
  j3 = mix(j2, foot, 0.5) - vec2(0.0, smoothAmort);
}

void main() {
  vec2 p = (vTexCoord - 0.5) * uSize;
  float aa = 1.4;
  vec4 col = vec4(0.0);

  // --- NOGI (4 sztuki, w tle) ---
  for (int i = 0; i < 4; i++) {
    vec2 anchor, s, j2, j3, foot;
    legPoints(float(i), 0.0, anchor, s, j2, j3, foot);

    float legD = min(min(sdSegment(p, anchor, s), sdSegment(p, s, j2)),
                      min(sdSegment(p, j2, j3), sdSegment(p, j3, foot))) - 1.75;
    col = layer(col, vec3(120.0, 255.0, 180.0) / 255.0, 1.0, legD, aa);

    col = layer(col, vec3(200.0, 180.0, 0.0) / 255.0, 1.0, length(p - s)    - 3.0, aa);
    col = layer(col, vec3(200.0, 180.0, 0.0) / 255.0, 1.0, length(p - j2)   - 3.0, aa);
    col = layer(col, vec3(200.0, 180.0, 0.0) / 255.0, 1.0, length(p - j3)   - 3.0, aa);
    col = layer(col, vec3(200.0, 180.0, 0.0) / 255.0, 1.0, length(p - foot) - 3.5, aa);
  }

  // --- ODWLOK ---
  float abdX = -30.0 * uDir;
  float abdY = -8.0;
  float abdomen = sdEllipse(p - vec2(abdX, abdY), vec2(32.5, 22.5));
  col = layer(col, vec3(20.0, 140.0, 80.0) / 255.0, 1.0, abdomen, aa);

  // Plamki (5 sztuk, dokladne pozycje/rozmiary z oryginalu)
  col = layer(col, vec3(100.0, 200.0, 120.0) / 255.0, 0.706,
    sdEllipse(p - vec2(abdX + (-10.0) * uDir, abdY - 5.0), vec2(4.0, 3.2)), aa);
  col = layer(col, vec3(100.0, 200.0, 120.0) / 255.0, 0.706,
    sdEllipse(p - vec2(abdX + (5.0) * uDir, abdY - 10.0), vec2(3.0, 2.4)), aa);
  col = layer(col, vec3(100.0, 200.0, 120.0) / 255.0, 0.706,
    sdEllipse(p - vec2(abdX + (15.0) * uDir, abdY + 2.0), vec2(5.0, 4.0)), aa);
  col = layer(col, vec3(100.0, 200.0, 120.0) / 255.0, 0.706,
    sdEllipse(p - vec2(abdX + (-18.0) * uDir, abdY + 8.0), vec2(3.5, 2.8)), aa);
  col = layer(col, vec3(100.0, 200.0, 120.0) / 255.0, 0.706,
    sdEllipse(p - vec2(abdX, abdY + 12.0), vec2(2.5, 2.0)), aa);

  // --- GLOWOTULOW ---
  float head = sdEllipse(p - vec2(8.0 * uDir, -5.0), vec2(13.0, 9.0));
  col = layer(col, vec3(60.0, 220.0, 140.0) / 255.0, 1.0, head, aa);

  // --- OCZY ---
  float eyeX = 12.0 * uDir;
  float eyeY = -5.0;
  col = layer(col, vec3(1.0, 0.0, 0.0), 1.0, length(p - vec2(eyeX + 2.0 * uDir, eyeY - 4.0)) - 1.5, aa);
  col = layer(col, vec3(1.0, 0.0, 0.0), 1.0, length(p - vec2(eyeX + 5.0 * uDir, eyeY - 3.0)) - 1.5, aa);
  col = layer(col, vec3(1.0, 0.0, 0.0), 1.0, length(p - vec2(eyeX - 1.0 * uDir, eyeY - 3.0)) - 1.25, aa);

  // --- NOGOGLASZCZKI (2 sztuki: gruba ciemna linia + cienka zolta w srodku) ---
  float pXc = 16.0 * uDir;
  float pStartY = -1.0;
  float pLen = 12.0;
  float pGap = 2.0;
  for (int side = 0; side < 2; side++) {
    float sgn = (side == 0) ? -1.0 : 1.0;
    float cx = pXc + sgn * pGap;
    float thick = sdSegment(p, vec2(cx, pStartY), vec2(cx, pStartY + pLen)) - 1.5;
    col = layer(col, vec3(10.0, 80.0, 40.0) / 255.0, 1.0, thick, aa);
    float thin = sdSegment(p, vec2(cx, pStartY + 2.0), vec2(cx, pStartY + pLen - 2.0)) - 0.5;
    col = layer(col, vec3(200.0, 180.0, 0.0) / 255.0, 1.0, thin, aa);
  }

// nogi z przodu (na wierzchu) pająka
// --- NOGI Z PRZODU (4 sztuki, na wierzchu) ---
  for (int i = 0; i < 4; i++) {
    vec2 anchor, s, j2, j3, foot;
    
    // Wartość 1.0 odwraca fazę kroku i obniża przeguby
    legPoints(float(i), 1.0, anchor, s, j2, j3, foot);

    float legD = min(min(sdSegment(p, anchor, s), sdSegment(p, s, j2)),
                      min(sdSegment(p, j2, j3), sdSegment(p, j3, foot))) - 1.75;
                      
    // Użyto minimalnie jaśniejszych kolorów dla przednich nóg dla lepszej głębi
    col = layer(col, vec3(140.0, 255.0, 190.0) / 255.0, 1.0, legD, aa);

    col = layer(col, vec3(220.0, 200.0, 0.0) / 255.0, 1.0, length(p - s)    - 3.0, aa);
    col = layer(col, vec3(220.0, 200.0, 0.0) / 255.0, 1.0, length(p - j2)   - 3.0, aa);
    col = layer(col, vec3(220.0, 200.0, 0.0) / 255.0, 1.0, length(p - j3)   - 3.0, aa);
    col = layer(col, vec3(220.0, 200.0, 0.0) / 255.0, 1.0, length(p - foot) - 3.5, aa);
  }
//koniec nóg na wierzchu pajaka

  if (col.a < 0.01) discard;
  gl_FragColor = col;
}
`;

// ---------------------------------------------------------------------------
// 2) SHADER WYBUCHU PAJĄKA NAZIEMNEGO — Nowa fala uderzeniowa FBM
// ---------------------------------------------------------------------------
const SPIDER2_EXPLOSION_FRAG_SRC = `
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

// ---------------------------------------------------------------------------
// 3) SHADER ISKIER TRAFIENIA — wersja ostra, drobna i subtelna
// ---------------------------------------------------------------------------
const SPIDER2_HITSPARK_FRAG_SRC = `
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
// 4) SHADER SIECI PAJĘCZEJ (WebProjectile) — NOWY, dwa tryby:
//    uMode 0 = fruwająca/rozwijająca się sieć (promienisty wachlarz + mały
//              "zawiązek" zanim się rozwinie)
//    uMode 1 = kokon oplotu na kadłubie rakiety (elipsa + linie wiążące)
// ---------------------------------------------------------------------------
const SPIDER2_WEB_FRAG_SRC = `
precision highp float;
varying vec2 vTexCoord;

uniform vec2 uSize;
uniform float uMode;
uniform float uDeployed;   // 0..1, tryb 0
uniform float uWrapScale;  // skala kokonu, tryb 1
uniform vec3 uColor;
uniform float uAlpha;

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

void main() {
  vec2 p = (vTexCoord - 0.5) * uSize;
  float d = 1.0e6;

  if (uMode < 0.5) {
    // --- SIEC FRUWAJACA / ROZWIJAJACA SIE ---
    if (uDeployed < 0.1) {
      // Maly, nierozwiniety "zawiazek" sieci (przyblizenie ksztaltu z bezierow)
      d = sdEllipse(p, vec2(6.0, 4.0));
    } else {
      float size = uDeployed * 50.0;
      float spread = PI * 0.25; // QUARTER_PI

      const int numRays = 6;
      vec2 rayPts[numRays];
      for (int i = 0; i < numRays; i++) {
        float a = mix(-spread, spread, float(i) / float(numRays - 1));
        rayPts[i] = vec2(cos(a), sin(a)) * size;
        d = min(d, sdSegment(p, vec2(0.0), rayPts[i]));
      }
      // Poprzeczne wiazania miedzy sasiednimi promieniami (progi 0.4 / 0.7 / 1.0)
      for (int i = 0; i < numRays - 1; i++) {
        d = min(d, sdSegment(p, rayPts[i] * 0.4, rayPts[i + 1] * 0.4));
        d = min(d, sdSegment(p, rayPts[i] * 0.7, rayPts[i + 1] * 0.7));
        d = min(d, sdSegment(p, rayPts[i] * 1.0, rayPts[i + 1] * 1.0));
      }
    }
    d -= 0.8;
  } else {
    // --- KOKON OPLOTU (na kadlubie rakiety) ---
    float w = 60.0 * uWrapScale;    // rozmiar
    float h = 40.0 * uWrapScale;    // rozmiar

    d = abs(sdEllipse(p, vec2(w * 0.75, h * 0.9))) - 0.75;

    const int n = 6;
    for (int i = 0; i < n; i++) {
      float ang = (float(i) / float(n)) * 2.0 * PI;
      vec2 a1 = vec2(cos(ang) * w * 0.2, sin(ang) * h * 0.2);
      vec2 b1 = vec2(cos(ang) * w * 0.8, sin(ang) * h * 0.8);
      d = min(d, sdSegment(p, a1, b1) - 0.75);

      float nextAng = (float(i + 1) / float(n)) * 2.0 * PI;
      vec2 a2 = vec2(cos(ang) * w * 0.6, sin(ang) * h * 0.6);
      vec2 b2 = vec2(cos(nextAng) * w * 0.6, sin(nextAng) * h * 0.6);
      d = min(d, sdSegment(p, a2, b2) - 0.75);
    }
  }

  float a = (1.0 - smoothstep(-1.0, 1.0, d)) * uAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

class Spider2 {
  constructor(levelRef, x, y) {

    // === KONFIGURACJA BALANSOWA ===
    this.health = 40;
    this.points = 100;
    this.damageAmount = 5; // zabiera 5% tarczy rakiety
    this.webDamage = 5; // Siła pajęczyny (5% tarczy)

    // === ODNIESIENIA I POZYCJA ===
    this.level = levelRef;
    this.x = x;
    this.y = y;
    
    this.state = "WALKING"; 
    this.timer = 0;
    this.towTimer = 0;
    this.radius = 35; // Promień dla kolizji ze strzałami
    this.latchRange = 80; // Zasięg skoku na rakietę

    this.dir = 1;
    this.speed = 0.8;
    this.legAnchorsOffsets = [-6, -2, 2, 6]; 
    this.walkCycle = 0;
    this.isDead = false;

    // Tablica pocisków

    this.explosionFrame = 0;
    this.explosionParticles = [];

    // === WŁASNY SYSTEM ISKIER TRAFIENIA (zamiast level.spawnSparks) ===
    this.hitSparks = [];

    // === FLAGA ROZPOZNAWANA PRZEZ Level40.show() ===
    this.usesGPUShaders = true;
  }

  // -----------------------------------------------------------------------
  // Jednorazowa (statyczna) inicjalizacja shaderów pająka na przekazanej
  // warstwie WEBGL (`pg`), współdzielona przez wszystkie instancje Spider2.
  // -----------------------------------------------------------------------
  static initShaders(pg) {
    if (Spider2.shadersLoaded) return;
    Spider2.bodyShader = pg.createShader(SPIDER2_VERT_SRC, SPIDER2_BODY_FRAG_SRC);
    Spider2.explosionShader = pg.createShader(SPIDER2_VERT_SRC, SPIDER2_EXPLOSION_FRAG_SRC);
    Spider2.hitSparkShader = pg.createShader(SPIDER2_VERT_SRC, SPIDER2_HITSPARK_FRAG_SRC);
    Spider2.shadersLoaded = true;
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

    // Logika ruchu
    this.x += this.dir * this.speed;
    
    this.walkCycle += this.speed * 0.05;

    // 1. Sprawdzanie kolizji ze strzałami (zawsze aktywne)
    this.checkBulletCollision();

    // 1a. DOPASOWANIE chodu pająków DO DNA JASKINI
    if (this.level && this.level.bottomWalls) {
      // Szukamy punktu w ścianach, który odpowiada pozycji X pająka
      let walls = this.level.bottomWalls;
      for (let i = 0; i < walls.length - 1; i++) {
        if (this.x >= walls[i].x && this.x <= walls[i + 1].x) {
          // Obliczamy wysokość (Y) na linii między dwoma punktami ściany (interpolacja)
          let t = (this.x - walls[i].x) / (walls[i + 1].x - walls[i].x);
          let groundY = lerp(walls[i].y, walls[i + 1].y, t);
        
          // Ustawiamy Y pająka na wysokości gruntu (minus mały offset, by nie wpadał w ścianę)
          this.y = groundY - 15; 
          break;
        }
      }
    }

    // 2. Maszyna stanów
    switch (this.state) {
      case "WALKING":
        this.x += wallSpeed; // Ruch jaskini
        this.x += this.dir * this.speed; // Marsz
        this.walkCycle += this.speed * 0.05;

        // Strzelanie tylko gdy idzie
        if (frameCount % 180 === 0) this.shoot();

        // Sprawdź czy rakieta jest blisko (Skok)
        this.checkCatchPlayer();
        break;

      case "TOWING":
        // Przyciąganie do rakiety (kod z Spider1)
        let prog = 1 - (this.towTimer / 180);
        let offX = lerp(-60, 0, prog);
        let offY = lerp(20, 0, prog);
        this.x = lerp(this.x, player.x + offX, 0.1);
        this.y = lerp(this.y, player.y + offY, 0.1);
        this.towTimer--;
        this.walkCycle += 0.4;
        if (this.towTimer <= 0) {
          this.state = "LATCHED";
          this.timer = 60; // Czas przebywania na rakiecie
        }
        break;

      case "LATCHED":
        this.x = player.x;
        this.y = player.y;
        this.walkCycle += 0.3;
        // Zadanie obrażeń (raz)
        if (this.timer === 60) {
          this.applyDamageToPlayer();
        }
        this.timer--;
        if (this.timer <= 0) this.state = "FALLING";
        break;

      case "FALLING":
        this.y += 8;
        this.x += wallSpeed;
        if (this.y > height + 100) this.isDead = true;
        break;
    }

    // 3. Strzelanie (co 3 sekundy / 180 klatek)
    if (frameCount % 180 === 0) {
      this.shoot();
    }

    // 4. Usuwanie pająka2 poza ekranem:
    if (this.x < -100) {
      this.isDead = true; 
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
    if (player.isImmortal || player.isDead) return;
    let d = dist(this.x, this.y - 20, player.x, player.y);
    if (d < this.latchRange) {
      this.state = "TOWING";
      this.towTimer = 60; // Krótszy czas dolotu dla pająka naziemnego
    }
  }

  checkBulletCollision() {
    if (!this.level.playerBullets) return;
    for (let bullet of this.level.playerBullets) {
      if (!bullet.active) continue;
      // Sprawdzanie dystansu do środka korpusu (y-20)
      let d = dist(bullet.x, bullet.y, this.x, this.y - 20);
      if (d < this.radius) {
        this.hitByBullet(bullet);
      }
    }
  }

  applyDamageToPlayer() {
    if (!player.isImmortal) {
      player.takeDamage(this.damageAmount);
      if (typeof playSoundKolizjaRakiety === 'function') playSoundKolizjaRakiety();
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

  hitByBullet(bullet) {

    // PROAKTYWNA POPRAWKA: Jeśli pająk już wybuha, pociski przez niego przelatują
    if (this.isDead || this.explosionFrame > 0) return false;

    if (this.isDead) return false;
    let d = dist(bullet.x, bullet.y, this.x, this.y - 15); 
    if (d < this.radius) {
      let damageValue = bullet.damage || 10; 
      this.health -= damageValue;
      this.hitFlash = 3;

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

  shoot() {
    let shootX = this.x + 16 * this.dir;
    let shootY = this.y - 5;
    
    if (typeof player !== 'undefined' && this.level) {
       // Tworzymy tablicę w poziomie, jeśli jeszcze nie istnieje
       if (!this.level.webs) {
         this.level.webs = [];
       }
       // Wrzucamy pocisk do tablicy POZIOMU, a nie pająka
       this.level.webs.push(new WebProjectile(shootX, shootY, this.dir, this.webDamage, player));
    }
  }

  // -----------------------------------------------------------------------
  // RYSOWANIE (GPU) — wywoływane z Level40.show(pg).
  // -----------------------------------------------------------------------
  show(pg) {
    Spider2.initShaders(pg);
    if (this.isDead) return;

    // Własne iskry trafienia (shader)
    if (this.hitSparks.length > 0) {
      this._drawHitSparks(pg);
    }

    // Rozprysk PAJĄKA NAZIEMNEGO (shader wybuchu)
    if (this.explosionFrame > 0) {

      this._drawExplosion(pg);
      return;
    }

    // Ciało pająka z nogami (shader)
    this._drawBody(pg);
  }

  _drawBody(pg) {
    let designW = 280, designH = 160;
    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.noStroke();
    pg.shader(Spider2.bodyShader);
    Spider2.bodyShader.setUniform('uSize', [designW, designH]);
    Spider2.bodyShader.setUniform('uDir', this.dir);
    Spider2.bodyShader.setUniform('uWalkCycle', this.walkCycle);
    pg.plane(designW, designH);
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

class WebProjectile {
  constructor(x, y, dir, damage, target) {
    this.x = x;
    this.y = y;
    this.startX = x;
    this.startY = y;
    this.dir = dir;
    this.speed = 6;
    this.angle = radians(-50);
    this.deployed = 0; // Animacja rozwijania pajęczyny1

    this.damage = damage;
    this.target = target;
    this.state = "FLYING"; 
    this.timer = 0;
    this.hitRadius = 80; // promień kolizji lecącej pajęczyny z celem (z rakietą gracza)

    // Nowe parametry dla pajęczyny2 (oplotu)
    this.wrapScale = 0;   // Skala oplotu (rośnie od 0 do 1)
    this.wrapAlpha = 255; // Przezroczystość pajęczyny1 podczas znikania
  }

  // -----------------------------------------------------------------------
  // Jednorazowa inicjalizacja shadera sieci - wspólna dla wszystkich pocisków.
  // -----------------------------------------------------------------------
  static initShaders(pg) {
    if (WebProjectile.shadersLoaded) return;
    WebProjectile.webShader = pg.createShader(SPIDER2_VERT_SRC, SPIDER2_WEB_FRAG_SRC);
    WebProjectile.shadersLoaded = true;
  }

  update(wallSpeed) {
    if (this.state === "FALLING" || this.state === "GROUND") {
      this.x += (wallSpeed || 0);
    }

    switch (this.state) {
      case "FLYING":
        this.x += cos(this.angle) * this.speed * this.dir;
        this.y += sin(this.angle) * this.speed;
        let d = dist(this.startX, this.startY, this.x, this.y);
        if (d > 50) this.deployed = lerp(this.deployed, 1, 0.1);

        if (this.target && !this.target.isDead && !this.target.isImmortal) {
          if (dist(this.x, this.y, this.target.x, this.target.y) < this.hitRadius) {
            this.onHit();
          }
        }
        break;

      case "LATCHED":
        if (this.target) {
          this.x = this.target.x;
          this.y = this.target.y;
        }
        // Animacja: pajęczyna1 znika, oplot (pajęczyna2) rośnie
        this.wrapAlpha = lerp(this.wrapAlpha, 0, 0.15);
        this.wrapScale = lerp(this.wrapScale, 1.2, 0.1);
        
        this.timer--;
        if (this.timer <= 0) this.state = "FALLING";
        break;

      case "FALLING":
        this.y += 5;
        this.wrapScale = lerp(this.wrapScale, 0.8, 0.05); // Lekkie skurczenie przy spadaniu
        if (this.y > height - 40) {
          this.y = height - 40;
          this.state = "GROUND";
        }
        break;
    }
  }

  onHit() {
    this.state = "LATCHED";
    this.timer = 180; 
    if (this.target && this.target.takeDamage) {
      this.target.takeDamage(this.damage); // Zadaje obrażenia raz
    }
  }

  // pg = warstwa p5.Graphics w trybie WEBGL
  show(pg) {
    WebProjectile.initShaders(pg);

    pg.push();
    pg.translate(Math.round(this.x), Math.round(this.y), 0);
    pg.noStroke();

    if (this.state === "FLYING") {
      // --- SIEC (pajeczyna1) FRUWAJACA W STRONE CELU ---
      pg.push();
      if (this.dir === 1) pg.rotate(this.angle); else pg.rotate(PI - this.angle);
      this._drawFan(pg, this.deployed, 1.0);
      pg.pop();
    }
    else if (this.state === "LATCHED") {
      // --- PRZEJSCIE: zanikajaca siec1 + rosnacy oplot (pajeczyna2) ---
      if (this.wrapAlpha > 5) {
        pg.push();
        if (this.dir === 1) pg.rotate(this.angle); else pg.rotate(PI - this.angle);
        let shrink = map(this.wrapAlpha, 255, 0, 1, 0);
        this._drawFan(pg, this.deployed * shrink, this.wrapAlpha / 255);
        pg.pop();
      }
      this._drawCocoon(pg);
    }
    else if (this.state === "FALLING" || this.state === "GROUND") {
      // --- ZUZYTY OPLOT SPADAJACY NA DNO ---
      this._drawCocoon(pg);
    }

    pg.pop();
  }

  _drawFan(pg, deployed, alpha) {
    let size = 150;
    pg.shader(WebProjectile.webShader);
    WebProjectile.webShader.setUniform('uSize', [size, size]);
    WebProjectile.webShader.setUniform('uMode', 0.0);
    WebProjectile.webShader.setUniform('uDeployed', deployed);
    WebProjectile.webShader.setUniform('uWrapScale', 0.0);
    WebProjectile.webShader.setUniform('uColor', [1.0, 1.0, 1.0]);
    WebProjectile.webShader.setUniform('uAlpha', alpha);
    pg.plane(size, size);
    pg.resetShader();
  }

  _drawCocoon(pg) {
    let size = 350; // rozmiar pajęczyny kokonu
    pg.shader(WebProjectile.webShader);
    WebProjectile.webShader.setUniform('uSize', [size, size]);
    WebProjectile.webShader.setUniform('uMode', 1.0);
    WebProjectile.webShader.setUniform('uDeployed', 0.0);
    WebProjectile.webShader.setUniform('uWrapScale', this.wrapScale);
    WebProjectile.webShader.setUniform('uColor', [1.0, 1.0, 1.0]);
    WebProjectile.webShader.setUniform('uAlpha', 220 / 255);
    pg.plane(size, size);
    pg.resetShader();
  }

  isOffScreen() {
    return (this.x < -200 || this.y > height + 200);
  }
}