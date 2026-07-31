// asteroid.js - Asteroidy (poziom 30)
// Wersja GPU: cała LOGIKA (ruch, podział, kolizje, obrażenia, wybuch) BEZ ZMIAN.
// NAPRAWA CRASHA: show() wołał globalny createShader()/shader() bezpośrednio
// na głównym, 2D-owym canvasie gry (Level30 nigdy nie był w trybie WEBGL) -
// stąd "Uncaught Error: shader() is only supported in WEBGL mode" i zamrożenie
// całej pętli draw() p5.js przy pierwszej narysowanej asteroidzie.
// Teraz rysowanie idzie przez współdzieloną warstwę gpuLayer (patrz game.js),
// dokładnie tym samym wzorcem co Bat/Spider/pociski/rakieta.
//
// PRZY OKAZJI: usunięta pomarańczowa "otoczka" i zastąpiona prawdziwym
// pseudo-3D cieniowaniem (numerycznie liczona pseudo-normalna z pola
// wysokości FBM + oświetlenie kierunkowe) zamiast płaskiego przekroju.

// ---------------------------------------------------------------------------
// Wspólny vertex shader (standardowa macierz kamery p5, jak w innych plikach)
// ---------------------------------------------------------------------------
const ASTEROID_VERT_SRC = `precision mediump float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec2 vTexCoord;
void main() {
  vTexCoord = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}`;

// ---------------------------------------------------------------------------
// Shader bryły asteroidy - prawdziwe pseudo-3D (pseudo-normalna z gradientu
// pola wysokości), skały/spękania przez FBM, BEZ pomarańczowej otoczki.
// ---------------------------------------------------------------------------
const ASTEROID_FRAG_SRC = `precision highp float;
varying vec2 vTexCoord;
uniform float uTime;
uniform float uSeed;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float f = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { f += a * noise(p); p *= 2.0; a *= 0.5; }
  return f;
}

// Pole "wysokości" bryły w punkcie uv (kopuła + nierówności FBM) - to samo
// pole liczymy tu i w gradiencie, więc normalna jest spójna z widoczną bryłą.
float heightField(vec2 uv) {
  float r2 = dot(uv, uv);
  float dome = sqrt(max(0.0, 1.0 - r2));
  float bump = fbm(uv * 4.5 + uSeed * 10.0) * 0.45;
  return dome + bump;
}

// Nieregularny promień bryły w zależności od kąta - suma kilku fal
// sinusoidalnych o różnych częstotliwościach/fazach (zależnych od uSeed),
// dzięki czemu każda asteroida ma inny, "skalisty" (nie okrągły) kontur.
// Amplitudy dobrane tak, by suma nie przekraczała ok. 1.25 - płaszczyzna
// (plane) w JS jest odpowiednio powiększona z marginesem, żeby nic się nie ucinało.
float asteroidEdge(float angle, float seed) {
  float r = 1.0;
  r += 0.12 * sin(angle * 3.0 + seed * 3.1);
  r += 0.08 * sin(angle * 5.0 + seed * 7.7);
  r += 0.05 * sin(angle * 8.0 + seed * 2.3);
  return r;
}

void main() {
  // MARGIN musi być zgodny z powiększeniem płaszczyzny w JS (pg.plane(...)),
  // żeby jednostka "1.0" nadal odpowiadała promieniowi asteroidy.
  const float MARGIN = 1.3;
  vec2 uv = (vTexCoord - 0.5) * 2.0 * MARGIN;
  float d = length(uv);
  float angle = atan(uv.y, uv.x);
  float edge = asteroidEdge(angle, uSeed) * 0.94;
  if (d > edge) discard; // nieregularne, skaliste wycięcie zamiast idealnego koła

  // Numerycznie liczona pseudo-normalna z gradientu pola wysokości
  float eps = 0.015;
  float hC = heightField(uv);
  float hX = heightField(uv + vec2(eps, 0.0));
  float hY = heightField(uv + vec2(0.0, eps));
  vec3 normal = normalize(vec3(-(hX - hC) / eps, -(hY - hC) / eps, 1.2));

  vec3 lightDir = normalize(vec3(-0.55, -0.65, 0.6));
  float diff = max(dot(normal, lightDir), 0.0);
  float ambient = 0.22;

  // Kolor skały + ciemne żyłki/spękania (osobna, gęstsza warstwa FBM)
  vec3 rock = vec3(0.42, 0.37, 0.32);
  vec3 crackDark = vec3(0.10, 0.09, 0.08);
  float cracks = fbm(uv * 11.0 - uSeed * 6.0);
  vec3 baseColor = mix(crackDark, rock, smoothstep(0.32, 0.62, cracks));

  vec3 col = baseColor * (ambient + diff * 0.95);

  // Delikatne przyciemnienie sylwetki przy krawędzi (bez koloru - tylko cień),
  // teraz podążające za nieregularną krawędzią (edge), a nie sztywnym promieniem.
  float rimShade = smoothstep(edge, edge * 0.78, d);
  col *= mix(0.5, 1.0, rimShade);

  gl_FragColor = vec4(col, 1.0);
}`;

class Asteroid {
  constructor(x, y, size, vx, vy) {
    this.size = size; //[cite: 12]
    
    // Ustalanie właściwości na podstawie rozmiaru
    if (size === 3) {
      this.radius = 0.078 * width; //[cite: 12]
      this.health = 40; //[cite: 12]
      this.points = 50; //[cite: 12]
    } else if (size === 2) {
      this.radius = 0.052 * width; //[cite: 12]
      this.health = 20; //[cite: 12]
      this.points = 30; //[cite: 12]
    } else {
      this.radius = 0.026 * width; //[cite: 12]
      this.health = 10; //[cite: 12]
      this.points = 10; //[cite: 12]
    }

    this.x = x; //[cite: 12]
    this.y = y; //[cite: 12]
    this.vx = vx || random(-0.001 * width, -0.002 * width); //[cite: 12]
    this.vy = vy || random(-0.0005 * height, 0.0005 * height); //[cite: 12]
    this.exploded = false; //[cite: 12]
    this.explosionFrame = 0; //[cite: 12]

    // Zróżnicowanie wielkości: obecny (bazowy) promień to teraz minimum,
    // maksimum to 2x tyle - losowane niezależnie dla każdej asteroidy.
    this.radius *= random(1.0, 2.0);

    this.shapeVertices = this.generateShapeVertices(); //[cite: 12]

    // Dodajemy losowy obrót startowy, żeby każda wycięta tekstura wyglądała unikalnie
    this.rotAngle = random(TWO_PI);

    // Ziarno losowości dla shadera - każda asteroida ma inny wzór skały/spękań
    this.seed = random(100);

    // Zróżnicowana prędkość obrotu: kierunek (w prawo/w lewo) i tempo losowane
    // niezależnie od ruchu postępowego. Dawna wartość (this.vx * 0.005, zawsze
    // w jedną stronę, bo vx zawsze ujemne) to teraz MAKSYMALNA prędkość obrotu.
    let maxRotSpeed = 0.00001 * width;
    this.rotSpeed = random(-maxRotSpeed, maxRotSpeed);
  }
  
  generateShapeVertices() {
    let vertices = [];
    let numPoints = 12 + this.size * 3; //[cite: 12]
    for (let i = 0; i < numPoints; i++) {
      let angle = map(i, 0, numPoints, 0, TWO_PI); //[cite: 12]
      let r = this.radius * random(0.7, 1.0); //[cite: 12]
      vertices.push({ 
        x: r * cos(angle), 
        y: r * sin(angle) 
      }); //[cite: 12]
    }
    return vertices; //[cite: 12]
  }

  update() {
    if (this.explosionFrame > 0) {
      this.explosionFrame--; //[cite: 12]
      return;
    }
    
    this.x += this.vx; //[cite: 12]
    this.y += this.vy; //[cite: 12]

    // Obrót skały w przestrzeni - niezależna, losowa prędkość i kierunek
    this.rotAngle += this.rotSpeed;

    // Odbijanie od górnej i dolnej krawędzi
    if (this.y < this.radius || this.y > height - this.radius) {
      this.vy *= -1; //[cite: 12]
    }
  }

  // -----------------------------------------------------------------------
  // Jednorazowa (statyczna) inicjalizacja shadera na przekazanej warstwie
  // WEBGL (`pg`), współdzielona przez wszystkie instancje Asteroid.
  // -----------------------------------------------------------------------
  static initShaders(pg) {
    if (Asteroid.shadersLoaded) return;
    Asteroid.shader = pg.createShader(ASTEROID_VERT_SRC, ASTEROID_FRAG_SRC);
    Asteroid.shadersLoaded = true;
  }

  // pg = warstwa p5.Graphics w trybie WEBGL (gpuLayer z game.js)
  show(pg) {
    if (this.explosionFrame > 0) {
      // Wybuch zostaje jako prosty, 2D-owy rozbłysk (nie wymaga shadera)
      let ratio = this.explosionFrame / 30;
      noStroke();
      fill(255, 100 + ratio * 155, 0, ratio * 255);
      ellipse(this.x, this.y, this.radius * 2 * ratio, this.radius * 2 * ratio);
      return;
    }

    Asteroid.initShaders(pg);

    // --- BRYŁA ASTEROIDY (shader, na współdzielonej warstwie GPU) ---
    pg.push();
    pg.translate(this.x, this.y, 0);
    pg.rotate(this.rotAngle);
    pg.noStroke();
    pg.shader(Asteroid.shader);
    Asteroid.shader.setUniform('uTime', millis() / 1000.0);
    Asteroid.shader.setUniform('uSeed', this.seed);
    // MARGIN = 1.3 - musi być zgodny ze stałą MARGIN w shaderze (ASTEROID_FRAG_SRC),
    // żeby wypukłości nieregularnej sylwetki nie ucinały się na krawędzi płaszczyzny.
    let drawSize = this.radius * 2 * 1.3;
    pg.plane(drawSize, drawSize);
    pg.resetShader();
    pg.pop();
  }

  // Kolizja z pociskiem (używamy okrągłego pola kolizji)
  hitByBullet(bullet) {
    return rectCircleCollision(
      bullet.x, bullet.y, bullet.width, bullet.height,
      this.x, this.y, this.radius
    ); //[cite: 12]
  }
  
  // Kolizja z graczem (używamy okrągłego pola kolizji)
  hits(player) {
    return rectCircleCollision(
      player.x - player.width / 2, player.y - player.height / 2, player.width, player.height,
      this.x, this.y, this.radius
    ); //[cite: 12]
  }

  takeDamage(amount) {
    this.health -= amount; //[cite: 12]
    if (this.health <= 0 && !this.exploded) {
      this.startExplosion(); //[cite: 12]
      this.exploded = true; //[cite: 12]
      score += this.points; //[cite: 12]
      return true; //[cite: 12]
    }
    return false; //[cite: 12]
  }
  
  startExplosion() {
    this.explosionFrame = 30; //[cite: 12]
  }
  
  // Generuje dwie mniejsze asteroidy
  split() {
    if (this.size <= 1) return []; //[cite: 12]
    
    const newSize = this.size - 1; //[cite: 12]
    const speedMultiplier = 1.2; //[cite: 12]
    const angleOffset = PI / 6; //[cite: 12]
    
    const originalAngle = atan2(this.vy, this.vx); //[cite: 12]
    
    const angle1 = originalAngle - angleOffset; //[cite: 12]
    const vx1 = cos(angle1) * sqrt(this.vx * this.vx + this.vy * this.vy) * speedMultiplier; //[cite: 12]
    const vy1 = sin(angle1) * sqrt(this.vx * this.vx + this.vy * this.vy) * speedMultiplier; //[cite: 12]

    const angle2 = originalAngle + angleOffset; //[cite: 12]
    const vx2 = cos(angle2) * sqrt(this.vx * this.vx + this.vy * this.vy) * speedMultiplier; //[cite: 12]
    const vy2 = sin(angle2) * sqrt(this.vx * this.vx + this.vy * this.vy) * speedMultiplier; //[cite: 12]
    
    return [
      new Asteroid(this.x, this.y, newSize, vx1, vy1), //[cite: 12]
      new Asteroid(this.x, this.y, newSize, vx2, vy2) //[cite: 12]
    ];
  }
}