export function glicko2Update(r, rd, vol, opponentR, opponentRd, score) {
  const TAU = 0.5;
  const PI2 = Math.PI * Math.PI;
  const SCALE = 173.7178;

  const mu = (r - 1500) / SCALE;
  const phi = rd / SCALE;
  const muJ = (opponentR - 1500) / SCALE;
  const phiJ = opponentRd / SCALE;

  const gPhiJ = 1 / Math.sqrt(1 + 3 * phiJ * phiJ / PI2);
  const E = 1 / (1 + Math.exp(-gPhiJ * (mu - muJ)));
  const v = 1 / (gPhiJ * gPhiJ * E * (1 - E));
  const delta = v * gPhiJ * (score - E);

  // Iterative algorithm to find new volatility
  const a = Math.log(vol * vol);
  const f = (x) => {
    const ex = Math.exp(x);
    const d2 = delta * delta;
    const p2 = phi * phi;
    const num1 = ex * (d2 - p2 - v - ex);
    const den1 = 2 * (p2 + v + ex) * (p2 + v + ex);
    return num1 / den1 - (x - a) / (TAU * TAU);
  };

  let A = a;
  let B;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);
  const EPSILON = 0.000001;

  while (Math.abs(B - A) > EPSILON) {
    const C = A + (A - B) * fA / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }

  const newVol = Math.exp(B / 2);
  const phiStar = Math.sqrt(phi * phi + newVol * newVol);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * gPhiJ * (score - E);

  return {
    rating: Math.round(newMu * SCALE + 1500),
    rd: Math.max(Math.round(newPhi * SCALE * 100) / 100, 30),
    vol: Math.round(newVol * 1000000) / 1000000,
  };
}
