import * as THREE from 'three';

export interface ProceduralTextures {
  asphaltMap: THREE.CanvasTexture;
  asphaltBump: THREE.CanvasTexture;
  gravelMap: THREE.CanvasTexture;
  gravelBump: THREE.CanvasTexture;
  curbMap: THREE.CanvasTexture;
  bannerMap: THREE.CanvasTexture;
  cityBannerMap: THREE.CanvasTexture;
  buildingFacadeMap: THREE.CanvasTexture;
  urbanGroundMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable');
  }
  return [canvas, ctx];
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextures {
  const aniso = Math.min(8, Math.max(1, maxAnisotropy));

  // 1. Weathered Rally Asphalt (albedo + bump)
  const [asphCanvas, asphCtx] = makeCanvas(512, 512);
  const [asphBumpCanvas, asphBumpCtx] = makeCanvas(512, 512);

  asphCtx.fillStyle = '#2d3138';
  asphCtx.fillRect(0, 0, 512, 512);
  asphBumpCtx.fillStyle = '#808080';
  asphBumpCtx.fillRect(0, 0, 512, 512);

  // Subtle worn racing grooves
  const grooveGrad = asphCtx.createLinearGradient(0, 0, 512, 0);
  grooveGrad.addColorStop(0.0, 'rgba(18,20,24,0.22)');
  grooveGrad.addColorStop(0.24, 'rgba(12,14,18,0.42)');
  grooveGrad.addColorStop(0.5, 'rgba(40,44,50,0.08)');
  grooveGrad.addColorStop(0.76, 'rgba(12,14,18,0.42)');
  grooveGrad.addColorStop(1.0, 'rgba(18,20,24,0.22)');
  asphCtx.fillStyle = grooveGrad;
  asphCtx.fillRect(0, 0, 512, 512);

  // Aggregate mineral grain (deterministic pseudo-random)
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 6500; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const v = Math.floor(32 + rand() * 44);
    const sz = 1 + rand() * 2.2;
    asphCtx.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    asphCtx.fillRect(x, y, sz, sz);

    const bv = Math.floor(90 + rand() * 80);
    asphBumpCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    asphBumpCtx.fillRect(x, y, sz, sz);
  }

  // Edge white lines + dashed amber rally centerline
  asphCtx.fillStyle = 'rgba(232, 232, 224, 0.72)';
  asphCtx.fillRect(22, 0, 8, 512);
  asphCtx.fillRect(482, 0, 8, 512);

  asphCtx.fillStyle = 'rgba(240, 178, 58, 0.85)';
  for (let y = 24; y < 512; y += 128) {
    asphCtx.fillRect(252, y, 8, 68);
  }

  const asphaltMap = new THREE.CanvasTexture(asphCanvas);
  asphaltMap.colorSpace = THREE.SRGBColorSpace;
  asphaltMap.wrapS = THREE.RepeatWrapping;
  asphaltMap.wrapT = THREE.RepeatWrapping;
  asphaltMap.anisotropy = aniso;

  const asphaltBump = new THREE.CanvasTexture(asphBumpCanvas);
  asphaltBump.wrapS = THREE.RepeatWrapping;
  asphaltBump.wrapT = THREE.RepeatWrapping;
  asphaltBump.anisotropy = aniso;

  // 2. Packed Alpine Gravel & Dirt
  const [gravCanvas, gravCtx] = makeCanvas(512, 512);
  const [gravBumpCanvas, gravBumpCtx] = makeCanvas(512, 512);

  gravCtx.fillStyle = '#755c44';
  gravCtx.fillRect(0, 0, 512, 512);
  gravBumpCtx.fillStyle = '#787878';
  gravBumpCtx.fillRect(0, 0, 512, 512);

  const rutGrad = gravCtx.createLinearGradient(0, 0, 512, 0);
  rutGrad.addColorStop(0.0, 'rgba(65,48,32,0.35)');
  rutGrad.addColorStop(0.28, 'rgba(54,39,26,0.45)');
  rutGrad.addColorStop(0.5, 'rgba(130,104,76,0.18)');
  rutGrad.addColorStop(0.72, 'rgba(54,39,26,0.45)');
  rutGrad.addColorStop(1.0, 'rgba(65,48,32,0.35)');
  gravCtx.fillStyle = rutGrad;
  gravCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 8500; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = Math.floor(82 + rand() * 68);
    const g = Math.floor(r * 0.78);
    const b = Math.floor(r * 0.56);
    const sz = 1.2 + rand() * 3.2;
    gravCtx.fillStyle = `rgb(${r},${g},${b})`;
    gravCtx.fillRect(x, y, sz, sz);

    const bv = Math.floor(70 + rand() * 140);
    gravBumpCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    gravBumpCtx.fillRect(x, y, sz, sz);
  }

  const gravelMap = new THREE.CanvasTexture(gravCanvas);
  gravelMap.colorSpace = THREE.SRGBColorSpace;
  gravelMap.wrapS = THREE.RepeatWrapping;
  gravelMap.wrapT = THREE.RepeatWrapping;
  gravelMap.anisotropy = aniso;

  const gravelBump = new THREE.CanvasTexture(gravBumpCanvas);
  gravelBump.wrapS = THREE.RepeatWrapping;
  gravelBump.wrapT = THREE.RepeatWrapping;
  gravelBump.anisotropy = aniso;

  // 3. Red & White Apex Rumble Curbs
  const [curbCanvas, curbCtx] = makeCanvas(128, 256);
  for (let y = 0; y < 256; y += 64) {
    curbCtx.fillStyle = (y / 64) % 2 === 0 ? '#d93829' : '#e6e4de';
    curbCtx.fillRect(0, y, 128, 64);
  }
  const curbMap = new THREE.CanvasTexture(curbCanvas);
  curbMap.colorSpace = THREE.SRGBColorSpace;
  curbMap.wrapS = THREE.RepeatWrapping;
  curbMap.wrapT = THREE.RepeatWrapping;
  curbMap.anisotropy = aniso;

  // 4. Start / Finish Gantry Checkered Banners (Alpine & City GP)
  const buildBanner = (label: string, accentHex: string): THREE.CanvasTexture => {
    const [banCanvas, banCtx] = makeCanvas(512, 128);
    banCtx.fillStyle = '#14171f';
    banCtx.fillRect(0, 0, 512, 128);
    const sq = 24;
    for (let x = 0; x < 512; x += sq) {
      for (let y = 0; y < 48; y += sq) {
        const even = ((x / sq) + (y / sq)) % 2 === 0;
        banCtx.fillStyle = even ? '#f3f2ee' : '#181b22';
        banCtx.fillRect(x, y, sq, sq);
      }
    }
    banCtx.fillStyle = accentHex;
    banCtx.fillRect(0, 48, 512, 6);
    banCtx.fillStyle = '#f4f4f0';
    banCtx.font = '700 34px "Chakra Petch", sans-serif';
    banCtx.textAlign = 'center';
    banCtx.textBaseline = 'middle';
    banCtx.fillText(label, 256, 92);

    const tex = new THREE.CanvasTexture(banCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = aniso;
    return tex;
  };

  const bannerMap = buildBanner('APEX RIDGE // STAGE 07', '#e05a2b');
  const cityBannerMap = buildBanner('METRO APEX // STREET GP', '#38bdf8');

  // 5. Urban Skyscraper Glazed Curtain-Wall Facade
  const [facCanvas, facCtx] = makeCanvas(512, 512);
  facCtx.fillStyle = '#1a202c';
  facCtx.fillRect(0, 0, 512, 512);

  const cols = 12;
  const rows = 16;
  const cellW = 512 / cols;
  const cellH = 512 / rows;
  for (let r = 0; r < rows; r++) {
    // Horizontal concrete spandrel band every floor
    facCtx.fillStyle = '#252d3d';
    facCtx.fillRect(0, r * cellH, 512, 6);

    for (let c = 0; c < cols; c++) {
      const roll = rand();
      let winColor = '#28354a'; // daytime tinted glass
      if (roll > 0.72) {
        winColor = '#fcd998'; // warm lit interior office
      } else if (roll > 0.56) {
        winColor = '#7fb6e8'; // cool sky reflection pane
      } else if (roll > 0.42) {
        winColor = '#3a4b66'; // mid reflective pane
      }
      facCtx.fillStyle = winColor;
      facCtx.fillRect(c * cellW + 4, r * cellH + 8, cellW - 8, cellH - 11);
    }
  }

  const buildingFacadeMap = new THREE.CanvasTexture(facCanvas);
  buildingFacadeMap.colorSpace = THREE.SRGBColorSpace;
  buildingFacadeMap.wrapS = THREE.RepeatWrapping;
  buildingFacadeMap.wrapT = THREE.RepeatWrapping;
  buildingFacadeMap.repeat.set(2, 4);
  buildingFacadeMap.anisotropy = aniso;

  // 6. Urban Concrete Plaza Pavement Grid
  const [urbCanvas, urbCtx] = makeCanvas(512, 512);
  urbCtx.fillStyle = '#262b34';
  urbCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const v = Math.floor(34 + rand() * 24);
    urbCtx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    urbCtx.fillRect(x, y, 2, 2);
  }
  urbCtx.strokeStyle = 'rgba(15, 18, 24, 0.55)';
  urbCtx.lineWidth = 4;
  for (let g = 0; g <= 512; g += 128) {
    urbCtx.beginPath();
    urbCtx.moveTo(g, 0);
    urbCtx.lineTo(g, 512);
    urbCtx.stroke();
    urbCtx.beginPath();
    urbCtx.moveTo(0, g);
    urbCtx.lineTo(512, g);
    urbCtx.stroke();
  }
  const urbanGroundMap = new THREE.CanvasTexture(urbCanvas);
  urbanGroundMap.colorSpace = THREE.SRGBColorSpace;
  urbanGroundMap.wrapS = THREE.RepeatWrapping;
  urbanGroundMap.wrapT = THREE.RepeatWrapping;
  urbanGroundMap.repeat.set(36, 36);
  urbanGroundMap.anisotropy = aniso;

  // 7. Soft Radial Contact Shadow
  const [shadCanvas, shadCtx] = makeCanvas(256, 256);
  const grad = shadCtx.createRadialGradient(128, 128, 18, 128, 128, 124);
  grad.addColorStop(0.0, 'rgba(6, 8, 12, 0.72)');
  grad.addColorStop(0.55, 'rgba(6, 8, 12, 0.36)');
  grad.addColorStop(1.0, 'rgba(6, 8, 12, 0.0)');
  shadCtx.fillStyle = grad;
  shadCtx.fillRect(0, 0, 256, 256);

  const contactShadowMap = new THREE.CanvasTexture(shadCanvas);

  return {
    asphaltMap,
    asphaltBump,
    gravelMap,
    gravelBump,
    curbMap,
    bannerMap,
    cityBannerMap,
    buildingFacadeMap,
    urbanGroundMap,
    contactShadowMap,
    dispose: () => {
      asphaltMap.dispose();
      asphaltBump.dispose();
      gravelMap.dispose();
      gravelBump.dispose();
      curbMap.dispose();
      bannerMap.dispose();
      cityBannerMap.dispose();
      buildingFacadeMap.dispose();
      urbanGroundMap.dispose();
      contactShadowMap.dispose();
    },
  };
}
