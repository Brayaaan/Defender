// =====================================================================================
//  BAT — wersja GPU (shadery)
//  LOGIKA (ruch, HP, punkty, kolizje z rakietą/pociskami, porwanie astronauty
//  1/6 -> 6/6) BEZ ZMIAN. Zmienia się wyłącznie sposób RYSOWANIA.
//
//  WAŻNE — WYMAGANY OSOBNY KONTEKST WEBGL:
//  Główny canvas gry pozostaje w trybie 2D (P2D), tak jak reszta, jeszcze
//  nieprzekonwertowanych, klas. shader()/plane() działają WYŁĄCZNIE w WEBGL,
//  dlatego Bat NIE tworzy własnego createCanvas — zamiast tego rysuje do
//  przekazanej z zewnątrz warstwy `p5.Graphics` utworzonej w trybie WEBGL:
//
//      let gpuLayer;
//      function setup() {
//        createCanvas(W, H);                 // canvas gry - bez zmian, tryb 2D
//        gpuLayer = createGraphics(W, H, WEBGL); // osobna warstwa na shadery
//      }
//      function draw() {
//        background(0);
//        // ... rysowanie jaskini/tla w 2D ...
//
//        gpuLayer.clear();                   // przezroczyste tlo warstwy
//        gpuLayer.push();
//        gpuLayer.translate(-gpuLayer.width / 2, -gpuLayer.height / 2, 0);
//        for (let bat of bats) bat.show(gpuLayer);
//        gpuLayer.pop();
//        image(gpuLayer, 0, 0);              // doklejenie warstwy GPU na canvas 2D
//
//        // ... rysowanie rakiety/pociskow/HUD w 2D nad warstwa GPU ...
//      }
//
//  Każda instancja Bat.show(pg) rysuje TYLKO do przekazanego `pg`
//  (nigdy do globalnego kontekstu) — dzięki temu reszta gry może zostać w 2D.
//
//  UWAGA NA KOLEJNOŚĆ (z-order): dopóki nietoperze są na osobnej warstwie,
//  wszystko na niej wyląduje na jednej "kartce" wklejanej w jednym miejscu
//  Twojego draw(). Jeśli coś z 2D (np. astronauta, pocisk) ma się znaleźć
//  WIZUALNIE pomiędzy nietoperzami, docelowo trzeba będzie przenieść to też
//  na gpuLayer (albo zaakceptować uproszczoną kolejność na czas migracji).
// =====================================================================================

// ---------------------------------------------------------------------------
// Wspólny vertex shader (zwykły "przelotowy" — geometria to zawsze plane())
// ---------------------------------------------------------------------------
const BAT_VERT_SRC = `
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
// 1) SHADER NIETOPERZA — całe ciało (tułów, głowa, uszy, oczy, kły, pyszczek,
//    animowane skrzydła) rysowane proceduralnie (SDF) w jednym fragment shaderze.
// ---------------------------------------------------------------------------
const BAT_BODY_FRAG_SRC = `
precision highp float;
varying vec2 vTexCoord;

uniform vec2 uSize;       
uniform float uWingAngle; 
uniform float uHitFlash;  

// --- PODSTAWOWE KSZTAŁTY ---
float sdEllipse(vec2 p, vec2 r) {
  return (length(p / r) - 1.0) * min(r.x, r.y);
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Funkcja rysująca kości
float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// --- FUNKCJE WYGŁADZAJĄCE ---
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float smax(float a, float b, float k) {
  float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) + k * h * (1.0 - h);
}

mat2 rot(float a) {
  float c = cos(a); float s = sin(a);
  return mat2(c, -s, s, c);
}

vec4 layer(vec4 base, vec3 col, float d, float aa) {
  float a = 1.0 - smoothstep(-aa, aa, d);
  return mix(base, vec4(col, 1.0), a);
}

// --- ANATOMIA: SZKIELET SKRZYDŁA ---
float getBones(vec2 p) {
  // Punkty węzłowe (względem barku jako 0,0)
  vec2 wrist = vec2(38.0, -18.0); // Nadgarstek (główny przegub)
  vec2 tip   = vec2(80.0, -10.0); // Najdłuższy palec
  vec2 f1    = vec2(68.0, 22.0);  // Środkowy palec
  vec2 f2    = vec2(35.0, 35.0);  // Dolny palec
  vec2 f3    = vec2(5.0, 28.0);   // Palec łączący się z nogą
  vec2 thumb = wrist + vec2(-4.0, -8.0); // Wystający kciuk

  // Kość ramienna (od barku do nadgarstka)
  float arm = sdCapsule(p, vec2(0.0, 0.0), wrist, 1.2);
  
  // Promieniste palce wychodzące z nadgarstka
  float b0  = sdCapsule(p, wrist, tip, 0.8);
  float b1  = sdCapsule(p, wrist, f1, 0.8);
  float b2  = sdCapsule(p, wrist, f2, 0.8);
  float b3  = sdCapsule(p, wrist, f3, 0.8);
  float th  = sdCapsule(p, wrist, thumb, 0.6);

  return min(arm, min(b0, min(b1, min(b2, min(b3, th)))));
}

// --- ANATOMIA: BŁONA SKRZYDŁA ---
float getMembrane(vec2 p) {
  // Duża baza rozpinająca się na całym obszarze
  float base = sdEllipse(p - vec2(38.0, 6.0), vec2(48.0, 32.0));

  // Duże, okrągłe wycięcia matematycznie dociśnięte między końcówki palców
  float cut0 = length(p - vec2(88.0, 10.0)) - 18.0;   // Między tip a f1
  float cut1 = length(p - vec2(58.0, 42.0)) - 18.0;   // Między f1 a f2
  float cut2 = length(p - vec2(20.0, 46.0)) - 18.0;   // Między f2 a f3
  float cut3 = length(p - vec2(-12.0, 30.0)) - 15.0;  // Między f3 a udem/ciałem
  float cutTop = length(p - vec2(50.0, -40.0)) - 25.0; // Wklęsłość na górnej krawędzi

  // Wyciananie kształtów
  float m = smax(base, -cut0, 3.0);
  m = smax(m, -cut1, 3.0);
  m = smax(m, -cut2, 3.0);
  m = smax(m, -cut3, 3.0);
  m = smax(m, -cutTop, 3.0);

  // Zespolenie błony z kośćmi (smin powleka kości błoną)
  float bones = getBones(p);
  m = smin(m, bones, 1.5);
  return m;
}

void main() {
  vec2 p = (vTexCoord - 0.5) * uSize; 
  float aa = 1.0; 
  vec4 col = vec4(0.0);

  vec2 pivot = vec2(14.0, -4.0); // Barki nietoperza
  
  // --- PRAWE SKRZYDŁO ---
  vec2 pr = rot(uWingAngle) * (p - pivot); 
  float wingR = getMembrane(pr);
  col = layer(col, vec3(0.28, 0.22, 0.35), wingR, aa); 
  float bonesR = getBones(pr);
  col = layer(col, vec3(0.45, 0.35, 0.55), bonesR, aa); // Kości rysowane na wierzchu

  // --- LEWE SKRZYDŁO ---
  vec2 pl = rot(uWingAngle) * (vec2(-p.x, p.y) - pivot);
  float wingL = getMembrane(pl);
  col = layer(col, vec3(0.28, 0.22, 0.35), wingL, aa);
  float bonesL = getBones(pl);
  col = layer(col, vec3(0.45, 0.35, 0.55), bonesL, aa);

  // --- NOGI (nowość) ---
  float legL = sdCapsule(p, vec2(-4.0, 18.0), vec2(-7.0, 32.0), 1.2);
  float legR = sdCapsule(p, vec2(4.0, 18.0), vec2(7.0, 32.0), 1.2);
  float legs = min(legL, legR);
  col = layer(col, vec3(0.12, 0.08, 0.16), legs, aa);

  // --- RYSOWANIE TUŁOWIA ---
  float chest = sdEllipse(p - vec2(0.0, 2.0), vec2(14.0, 18.0));
  float abdomen = sdEllipse(p - vec2(0.0, 14.0), vec2(7.0, 10.0));
  float body = smin(chest, abdomen, 6.0); 
  col = layer(col, vec3(0.22, 0.18, 0.28), body, aa); 

  // Futerko na karku
  float fur = sdEllipse(p - vec2(0.0, -8.0), vec2(16.0, 8.0));
  col = layer(col, vec3(0.16, 0.11, 0.21), fur, aa);

  // --- RYSOWANIE GŁOWY ---
  float cranium = sdEllipse(p - vec2(0.0, -18.0), vec2(11.0, 10.0));
  float snout = sdEllipse(p - vec2(0.0, -12.0), vec2(7.5, 6.0));
  float head = smin(cranium, snout, 4.0);
  col = layer(col, vec3(0.22, 0.18, 0.28), head, aa);

  // --- USZY ---
  vec2 epL = rot(-0.35) * (p - vec2(-8.0, -25.0));
  float earL = sdEllipse(epL, vec2(4.5, 12.0));
  earL = smax(earL, -sdEllipse(epL - vec2(5.0, -4.0), vec2(5.0, 14.0)), 1.5); // Ścięcie krawędzi zewnętrznej
  col = layer(col, vec3(0.12, 0.08, 0.16), earL, aa); 
  float earInnerL = earL + 1.5; // Mniejszy kształt wewnątrz
  col = layer(col, vec3(0.28, 0.22, 0.35), earInnerL, aa); // Krwiste wnętrze ucha

  vec2 epR = rot(0.35) * (p - vec2(8.0, -25.0));
  float earR = sdEllipse(epR, vec2(4.5, 12.0));
  earR = smax(earR, -sdEllipse(epR - vec2(-5.0, -4.0), vec2(5.0, 14.0)), 1.5);
  col = layer(col, vec3(0.12, 0.08, 0.16), earR, aa);
  float earInnerR = earR + 1.5;
  col = layer(col, vec3(0.3, 0.1, 0.15), earInnerR, aa);

  // --- DETALE TWARZY ---
  // Nos
  float nose = sdEllipse(p - vec2(0.0, -11.0), vec2(3.0, 1.5));
  col = layer(col, vec3(0.08, 0.05, 0.1), nose, aa);

  // Oczy (ukośne, drapieżne)
  vec2 pEyeL = rot(0.2) * (p - vec2(-5.5, -16.5));
  float eyeL = sdEllipse(pEyeL, vec2(2.5, 0.8));
  col = layer(col, vec3(1.0, 0.1, 0.1), eyeL, aa); // Czerwone światło

  vec2 pEyeR = rot(-0.2) * (p - vec2(5.5, -16.5));
  float eyeR = sdEllipse(pEyeR, vec2(2.5, 0.8));
  col = layer(col, vec3(1.0, 0.1, 0.1), eyeR, aa);

  // Kły
  float toothL = sdBox(rot(0.1) * (p - vec2(-2.5, -7.0)), vec2(0.8, 3.5));
  toothL = smax(toothL, -sdEllipse(p - vec2(-4.0, -6.0), vec2(2.0, 4.0)), 0.5); // Zaostrzenie
  col = layer(col, vec3(0.9, 0.9, 0.8), toothL, aa);

  float toothR = sdBox(rot(-0.1) * (p - vec2(2.5, -7.0)), vec2(0.8, 3.5));
  toothR = smax(toothR, -sdEllipse(p - vec2(4.0, -6.0), vec2(2.0, 4.0)), 0.5);
  col = layer(col, vec3(0.9, 0.9, 0.8), toothR, aa);

  // --- ROZBŁYSK TRAFIENIA ---
  col.rgb = mix(col.rgb, vec3(1.0), uHitFlash * col.a * 0.7);

  if (col.a < 0.01) discard;
  gl_FragColor = col;
}
`;

// ---------------------------------------------------------------------------
// 2) SHADER WYBUCHU NIETOPERZA — pojedyncza cząsteczka wybuchu.
//    uMode: 0 = smużysty odłamek energii (ADD, neonowy fiolet)
//           1 = iskra ektoplazmy (miękki kwadrat, ametystowy fiolet)
//           2 = ciężki fragment skrzydła (twardy kwadrat, ciemny fiolet)
// ---------------------------------------------------------------------------
const BAT_EXPLOSION_FRAG_SRC = `
precision highp float;
varying vec2 vTexCoord;

uniform float uProgress; // Postęp od 0.0 (start) do 1.0 (koniec)

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i+vec2(0.0,0.0)), hash(i+vec2(1.0,0.0)), u.x),
             mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
}

// FBM generujący poszarpaną materię plazmy
float fbm(vec2 p) {
  float f = 0.0; float a = 0.5;
  for(int i = 0; i < 4; i++) { f += a * noise(p); p *= 2.0; a *= 0.5; }
  return f;
}

void main() {
  // Centrowanie współrzędnych
  vec2 uv = (vTexCoord - 0.5) * 2.0;
  float dist = length(uv);
  float angle = atan(uv.y, uv.x);
  
  // Zmienna promienia uderzenia - rośnie w czasie
  float currentRadius = uProgress * 1.2;
  
  // Generowanie szumu
  float burstNoise = fbm(uv * 8.0 - uProgress * 3.0);
  float sparksNoise = fbm(vec2(angle * 12.0, dist * 15.0 - uProgress * 10.0));
  
  // 1. Rdzeń wybuchu
  float core = smoothstep(0.4, 0.0, dist) * (1.0 - smoothstep(0.0, 0.3, uProgress));
  
  // 2. Poszarpana fala uderzeniowa
  float ringThickness = 0.2 * (1.0 - uProgress);
  float shockwave = smoothstep(currentRadius + ringThickness, currentRadius, dist) 
                  * smoothstep(currentRadius - ringThickness - 0.2, currentRadius, dist);
  shockwave *= smoothstep(0.3, 0.7, burstNoise);
  
  // 3. Rozpryskujące się odłamki na zewnętrznej krawędzi
  float sparks = smoothstep(0.65, 0.8, sparksNoise) 
               * smoothstep(currentRadius + 0.3, currentRadius - 0.3, dist);
  
  float shape = core + shockwave + sparks;
  
  // Płynne zanikanie
  float fadeOut = 1.0 - smoothstep(0.6, 1.0, uProgress);
  float intensity = shape * fadeOut;
  
  // Bezpieczny margines krawędzi
  float edgeFade = smoothstep(0.95, 0.6, dist); 
  intensity *= edgeFade;
  
  // --- ZMIENIONA PALETA FIOLETÓW ---
  vec3 colDarkPurple = vec3(0.3, 0.0, 0.7);   // Ciemny fioletowy rdzeń bazy
  vec3 colNeonPurple = vec3(0.7, 0.1, 1.0);   // Neonowy fiolet plazmy
  vec3 colPink       = vec3(1.0, 0.5, 1.0);   // Jasny róż wykończenia
  
  vec3 fireColor = mix(colDarkPurple, colNeonPurple, smoothstep(0.1, 0.4, intensity));
  fireColor = mix(fireColor, colPink, smoothstep(0.4, 0.8, intensity));
  fireColor = mix(fireColor, vec3(1.0), smoothstep(0.8, 1.0, intensity));
  
  if (intensity < 0.01) discard;
  gl_FragColor = vec4(fireColor * intensity * 2.0, intensity);
}
`;

// ---------------------------------------------------------------------------
// 3) SHADER ISKIER TRAFIENIA — male, fioletowe smugi w miejscu trafienia
//    pociskiem (odpowiednik dawnych hitExplosions rysowanych jako line()).
// ---------------------------------------------------------------------------
const BAT_HITSPARK_FRAG_SRC = `
precision highp float;
varying vec2 vTexCoord;

uniform vec2 uSize;
uniform vec3 uColor;
uniform float uAlpha;

void main() {
  // Przesunięcie współrzędnych na środek płaszczyzny (od -1 do 1)
  vec2 p = vTexCoord * 2.0 - 1.0;

  // Odległość od środka. Skalowanie x*0.5 nadaje iskrze pęd w locie
  float d = length(vec2(p.x * 0.5, p.y));

  // Czysty, mały biały rdzeń i szeroka poświata
  float core = 0.015 / (d + 0.005);
  float glow = 0.03 / (d + 0.01);

  // Gładkie wygaszenie do zera przed krawędzią (brak uciętych kwadratów)
  float edgeFade = smoothstep(1.0, 0.6, length(p));

  // Własna, twarda kolorystyka: głęboki fiolet na zewnątrz, czysta biel w środku
  vec3 colPurple = vec3(0.6, 0.1, 1.0);
  vec3 colWhite = vec3(1.0, 1.0, 1.0);

  vec3 finalCol = colPurple * glow + colWhite * core;

  // Całkowita przezroczystość z uwzględnieniem cyklu życia iskry (uAlpha)
  float a = clamp(core + glow, 0.0, 1.0) * uAlpha * edgeFade;

  if (a < 0.01) discard; // Odrzucenie niewidocznych pikseli dla optymalizacji
  // MNOŻNIK x2.5 - Symulacja "Blend ADD x2"
  // Zwiększenie mnożnika z 1.0 na 2.5 powoduje fizyczne wypchnięcie 
  // jasności w trybie ADD, tworząc dużo jaśniejsze "przepalenie" na ekranie.
  gl_FragColor = vec4(finalCol * a * 2.5, a);
}
`;

// ---------------------------------------------------------------------------
// 4) SHADER ŻÓŁTEJ NICI ENERGETYCZNEJ — rysowany podczas porwania astronauty
//    (Porwanie, zmiana 4/6). Proceduralny, "drgający" piorun pomiędzy
//    nietoperzem a ofiarą, z pomaranczowa poswiata i zoltym rdzeniem.
// ---------------------------------------------------------------------------
const BAT_LIGHTNING_FRAG_SRC = `
precision highp float;
varying vec2 vTexCoord;

uniform vec2 uSize;
uniform vec2 uStart;
uniform vec2 uEnd;
uniform float uTime;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

// Odleglosc punktu p od "drgajacego" (zygzakowatego) odcinka a-b
float distToJitterSegment(vec2 p, vec2 a, vec2 b, float t) {
  vec2 dir = b - a;
  float len = max(length(dir), 0.0001);
  vec2 ndir = dir / len;
  vec2 perp = vec2(-ndir.y, ndir.x);

  float proj = clamp(dot(p - a, ndir), 0.0, len);
  float segT = proj / len;

  float jitter = (hash(floor(segT * 6.0) + floor(t * 12.0) * 13.1) - 0.5) * 8.0;
  // Bez drgan tuz przy koncach (nic trzyma sie punktu startu/celu)
  jitter *= smoothstep(0.0, 0.08, segT) * smoothstep(1.0, 0.92, segT);

  vec2 basePoint = a + ndir * proj + perp * jitter;
  return length(p - basePoint);
}

void main() {
  vec2 p = (vTexCoord - 0.5) * uSize;
  float d = distToJitterSegment(p, uStart, uEnd, uTime);

  // Poswiata pomaranczowa (puls)
  float glow = exp(-d * 0.16) * (0.65 + 0.35 * sin(uTime * 12.0));
  vec3 col = vec3(1.0, 0.39, 0.0) * glow;

  // Rdzen zolty
  float core = 1.0 - smoothstep(0.0, 1.6, d);
  col = mix(col, vec3(1.0, 1.0, 0.0), core);

  float a = clamp(glow * 0.55 + core, 0.0, 1.0);
  if (a < 0.02) discard;
  gl_FragColor = vec4(col, a);
}
`;

class Bat {
  constructor(level, x, y) {
    this.level = level;
    this.x = x;
    this.y = y;
    this.vx = -1;
    this.vy = 0;
    this.width = 60;
    this.height = 30;
    this.radius = 30;
    this.shootTimer = 0;
    this.explosionFrame = 0;
    this.explosionParticles = [];
    this.wingAngle = 0;
    this.isHit = false;
    this.health = 25;
    this.isDead = false;
    this.points = 100;

    // Porwanie, zmiana 1/6 Referencja do porwanego astronauty
    this.victim = null;

    // Tablica na małe fioletowe wybuchy od strzałów
    this.hitExplosions = [];

    // Nowa zmienna: Losowe przesunięcie animacji skrzydeł
    this.wingOffset = Math.random() * Math.PI * 2;

    // WAŻNE: shadery inicjalizujemy leniwie w show(pg), bo dopiero tam
    // dostajemy referencję do warstwy WEBGL (`pg`), do której są przypisane.
  }

  // ---------------------------------------------------------------------
  // Jednorazowa (statyczna) inicjalizacja 4 shaderów na PRZEKAZANEJ warstwie
  // WEBGL (`pg` = p5.Graphics w trybie WEBGL). Współdzielona przez wszystkie
  // instancje Bat, dopóki wszystkie rysują do tej samej warstwy `pg`.
  // ---------------------------------------------------------------------
  static initShaders(pg) {
    if (Bat.shadersLoaded) return;
    Bat.batShader = pg.createShader(BAT_VERT_SRC, BAT_BODY_FRAG_SRC);
    Bat.explosionShader = pg.createShader(BAT_VERT_SRC, BAT_EXPLOSION_FRAG_SRC);
    Bat.hitSparkShader = pg.createShader(BAT_VERT_SRC, BAT_HITSPARK_FRAG_SRC);
    Bat.lightningShader = pg.createShader(BAT_VERT_SRC, BAT_LIGHTNING_FRAG_SRC);
    Bat.shadersLoaded = true;
  }

  update(wallSpeed) {

    // Aktualizacja małych fioletowych wybuchów od strzałów
    for (let i = this.hitExplosions.length - 1; i >= 0; i--) {
      let exp = this.hitExplosions[i];
      for (let p of exp.particles) {
        p.x += p.vx + wallSpeed; // Cząsteczki poruszają się i płyną razem z jaskinią
        p.y += p.vy;
      }
      exp.currentFrame--;
      if (exp.currentFrame <= 0) {
        this.hitExplosions.splice(i, 1); // Usuwanie wygasłego wybuchu
      }
    }

    if (this.explosionFrame > 0) {
      for (let particle of this.explosionParticles) {
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Grawitacja działająca wyłącznie na ciężkie fragmenty błoniastych skrzydeł (typ 3)
        if (particle.type === 3) {
          particle.vy += 0.05;
        }
      }
      this.explosionFrame--;
      if (this.explosionFrame <= 0) {
        this.isDead = true;
      }
      return;
    }

    if (this.isDead) return;
    this.x += this.vx + wallSpeed;
    this.y += this.vy;

    // Usuwanie nietoperza, gdy ucieknie za daleko w lewo
    if (this.x < -200) {
      this.isDead = true;
    }

    //  Porwanie, zmiana 3/6  --- WARUNEK KOŃCA PORWANIA (20px przed krawędzią) ---
    if (this.x < 20) {
      this.victim = null; 
    }

    if (this.y <= 22 || this.y >= height - 22) {
      this.vy = -this.vy;
    }
    this.shootTimer++;
    if (this.shootTimer >= 300 && random() < 0.02) {
      this.shootTimer = 0;
    }
    // Nowy kod (każdy nietoperz ma własne przesunięcie w fazie)
    this.wingAngle = Math.sin(frameCount * 0.1 + this.wingOffset) * 0.5;
  }

  // pg = warstwa p5.Graphics w trybie WEBGL (patrz komentarz na górze pliku)
  show(pg) {
    Bat.initShaders(pg);

    // Rysowanie małych fioletowych wybuchów liniowych (shader iskier trafienia)
    if (this.hitExplosions.length > 0) {
      this._drawHitSparks(pg);
    }

    // Rozprysk NIETOPERZA (shader wybuchu, 3 warstwy fioletu)
    if (this.explosionFrame > 0) {
      this._drawExplosion(pg);
      return;
    }

    //  Porwanie, zmiana 4/6 --- RYSOWANIE ŻÓŁTEJ NICI (shader) ---
    if (this.victim && !this.exploded) {
      this._drawLightning(pg);
    }

    if (this.isDead) return;

    // Ciało nietoperza (shader nietoperza)
    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.noStroke();
    pg.shader(Bat.batShader);
    
    // Zwiększamy obszar renderowania z [220, 110] na [280, 160], 
    // aby dać skrzydłom miejsce na pełen wymach w górę
    Bat.batShader.setUniform('uSize', [280, 160]);
    Bat.batShader.setUniform('uWingAngle', this.wingAngle);
    Bat.batShader.setUniform('uHitFlash', this.isHit ? 1.0 : 0.0);
    pg.plane(280, 160);
    
    pg.resetShader();
    pg.pop();
  }

  // ---------------------------------------------------------------------
  // Pomocnicze metody rysujące (GPU) — wywoływane wyłącznie z show(pg)
  // ---------------------------------------------------------------------

  _drawHitSparks(pg) {
    pg.push();
    pg.blendMode(ADD);
    pg.noStroke();
    for (let exp of this.hitExplosions) {
      let alpha = map(exp.currentFrame, 0, 60, 0, 255) / 255;
      for (let p of exp.particles) {
        pg.push();
        pg.translate(p.x, p.y, 0);
        pg.rotate(atan2(p.vy, p.vx));
        pg.shader(Bat.hitSparkShader);
        Bat.hitSparkShader.setUniform('uSize', [max(p.size * 14, 2), max(p.size * 3, 2)]);
        Bat.hitSparkShader.setUniform('uColor', [200 / 255, 50 / 255, 1.0]);
        Bat.hitSparkShader.setUniform('uAlpha', alpha);
        pg.plane(p.size * 14, p.size * 3);
        pg.pop();
      }
    }
    pg.resetShader();
    pg.blendMode(BLEND);
    pg.pop();
  }

  _drawExplosion(pg) {
    // Obliczenie postępu dla shadera opierające się na puli 60 klatek nietoperza
    let progress = 1.0 - (this.explosionFrame / 60.0);

    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.blendMode(ADD);
    pg.noStroke();

    pg.shader(Bat.explosionShader);
    Bat.explosionShader.setUniform('uProgress', progress);

    // Rysujemy potężną eksplozję w docelowym rozmiarze 356x356
    pg.plane(356, 356);

    pg.resetShader();
    pg.blendMode(BLEND);
    pg.pop();
  }

  _drawLightning(pg) {
    // Prostokąt obejmujący nietoperza i ofiarę (z marginesem na drgania)
    let minX = min(this.x, this.victim.x) - 40;
    let maxX = max(this.x, this.victim.x) + 40;
    let minY = min(this.y, this.victim.y) - 40;
    let maxY = max(this.y, this.victim.y) + 40;
    let w = max(maxX - minX, 10);
    let h = max(maxY - minY, 10);
    let cx = (minX + maxX) / 2;
    let cy = (minY + maxY) / 2;

    pg.push();
    pg.translate(cx, cy, 0);
    pg.noStroke();
    pg.blendMode(ADD);
    pg.shader(Bat.lightningShader);
    Bat.lightningShader.setUniform('uSize', [w, h]);
    Bat.lightningShader.setUniform('uStart', [this.x - cx, this.y - cy]);
    Bat.lightningShader.setUniform('uEnd', [this.victim.x - cx, this.victim.y - cy]);
    Bat.lightningShader.setUniform('uTime', frameCount * 0.033);
    pg.plane(w, h);
    pg.resetShader();
    pg.blendMode(BLEND);
    pg.pop();
  }

  //  Porwanie, zmiana 5/6
  abducts(humanoid) {
    // Jeśli wróg jest zbyt blisko lewej krawędzi, nie może porywać/trzymać
    if (this.x < 20) {
      this.victim = null;
      return false;
    }

    if (rectCircleCollision(
      humanoid.x, humanoid.y, humanoid.radius * 2, humanoid.radius * 2,
      this.x, this.y, this.radius
    )) {
      this.victim = humanoid; // Zapamiętujemy ofiarę do rysowania nici
      humanoid.isAbducted = true; 
      humanoid.vx = this.vx;
      humanoid.vy = this.vy;
      return false; 
    }
    return false;
  }   // koniec 5/6 abducts(humanoid)

  explode() {
    this.victim = null; // Natychmiastowe zerwanie nici
    if (this.explosionFrame === 0) {
      this.explosionFrame = 60; // 60 klatek to nasz nowy czas cyklu życia fali uderzeniowej
      this.explosionParticles = []; // Tablica pozostaje pusta, bo fala generowana jest sprzętowo
      
      // Dźwięk przeniesiony tutaj – odtworzy się zawsze przy wybuchu
      if (typeof playEnemyExplosion === 'function') {
        playEnemyExplosion();
      }
    }
  }

  takeDamage(damage) {
    if (this.explosionFrame > 0 || this.isDead) return false; // Usunięto: this.isHit
    this.health -= damage;

    if (this.health <= 0) {
      score += this.points;
      this.explode(); // Wywołanie explode() teraz automatycznie obsłuży dźwięk
      this.isHit = true; // Flaga ustawiana dopiero w momencie realnej śmierci wroga
      return true;
    }
    return false;
  }

  hitByBullet(bullet) {
    if (this.explosionFrame > 0 || this.isDead) return false;

    // Zamiana dist na rectRectCollision – pociski są prostokątami, więc klasyczny dystans kołowy je omijał
    if (rectRectCollision(
      bullet.x, bullet.y, bullet.width, bullet.height,
      this.x - this.width / 2, this.y - this.height / 2, this.width, this.height
    )) {

      playSoundTrafieniewroga();
      
      // GENEROWANIE MAŁEGO FIOLETOWEGO WYBUCHU W PUNKCIE TRAFIENIA
      let particlesArray = [];
      for (let i = 0; i < 12; i++) {
        particlesArray.push({
          x: bullet.x,
          y: bullet.y,
          vx: random(-4, 4),
          vy: random(-4, 4),
          size: random(1, 3)
        });
      }
      this.hitExplosions.push({
        particles: particlesArray,
        currentFrame: 60
      });

      // Wywołanie obrażeń
      this.takeDamage(bullet.damage);
      return true;
    }
    return false;
  }
}