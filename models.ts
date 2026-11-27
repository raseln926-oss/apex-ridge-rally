import * as THREE from 'three';
import type { RallyTrack } from './track';
import type { ProceduralTextures } from './textures';
import type { ObstacleKind, TrafficKind } from './traffic';

export interface RallyCarRig {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  frontLeftSteer: THREE.Group;
  frontRightSteer: THREE.Group;
  wheelMeshes: THREE.Group[];
  brakeLightMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function buildRallyCarMesh(
  bodyColorHex: number,
  accentColorHex: number,
  contactShadowMap: THREE.Texture,
  castShadow: boolean,
  isGhost = false
): RallyCarRig {
  const root = new THREE.Group();
  const chassisGroup = new THREE.Group();
  root.add(chassisGroup);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Materials (varied roughness/metalness >= 0.25 between adjacent parts)
  const paintMat = trackMat(
    isGhost
      ? new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.72,
          metalness: 0.25,
          roughness: 0.28,
          transparent: true,
          opacity: 0.36,
          depthWrite: false,
        })
      : new THREE.MeshPhysicalMaterial({
          color: bodyColorHex,
          metalness: 0.55,
          roughness: 0.22,
          clearcoat: 0.9,
          clearcoatRoughness: 0.12,
        })
  );
  const accentMat = trackMat(
    isGhost
      ? new THREE.MeshStandardMaterial({
          color: 0xe0f2fe,
          emissive: 0x7dd3fc,
          emissiveIntensity: 0.9,
          metalness: 0.2,
          roughness: 0.3,
          transparent: true,
          opacity: 0.52,
          depthWrite: false,
        })
      : new THREE.MeshStandardMaterial({
          color: accentColorHex,
          metalness: 0.35,
          roughness: 0.38,
        })
  );
  const carbonMat = trackMat(
    isGhost
      ? new THREE.MeshStandardMaterial({
          color: 0x0ea5e9,
          emissive: 0x0369a1,
          emissiveIntensity: 0.4,
          metalness: 0.2,
          roughness: 0.5,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        })
      : new THREE.MeshStandardMaterial({
          color: 0x1c1f24,
          metalness: 0.25,
          roughness: 0.65,
        })
  );
  const glassMat = trackMat(
    isGhost
      ? new THREE.MeshStandardMaterial({
          color: 0xbae6fd,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.45,
          roughness: 0.18,
          transparent: true,
          opacity: 0.26,
          depthWrite: false,
        })
      : new THREE.MeshPhysicalMaterial({
          color: 0x131a24,
          metalness: 0.15,
          roughness: 0.08,
          clearcoat: 1.0,
          clearcoatRoughness: 0.05,
        })
  );
  const alloyMat = trackMat(
    isGhost
      ? new THREE.MeshStandardMaterial({
          color: 0x7dd3fc,
          emissive: 0x0ea5e9,
          emissiveIntensity: 0.45,
          metalness: 0.4,
          roughness: 0.3,
          transparent: true,
          opacity: 0.34,
          depthWrite: false,
        })
      : new THREE.MeshStandardMaterial({
          color: 0xd0d4dc,
          metalness: 0.9,
          roughness: 0.2,
        })
  );
  const tireMat = trackMat(
    isGhost
      ? new THREE.MeshStandardMaterial({
          color: 0x0c4a6e,
          emissive: 0x0284c7,
          emissiveIntensity: 0.3,
          roughness: 0.7,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
        })
      : new THREE.MeshStandardMaterial({
          color: 0x18191c,
          metalness: 0.05,
          roughness: 0.88,
        })
  );
  const caliperMat = trackMat(
    isGhost
      ? new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
        })
      : new THREE.MeshStandardMaterial({
          color: 0xd93829,
          metalness: 0.4,
          roughness: 0.35,
        })
  );
  const headlightMat = trackMat(
    isGhost
      ? new THREE.MeshStandardMaterial({
          color: 0xe0f2fe,
          emissive: 0x7dd3fc,
          emissiveIntensity: 1.1,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        })
      : new THREE.MeshStandardMaterial({
          color: 0xfff8e6,
          emissive: 0xfff0c4,
          emissiveIntensity: 1.8,
          roughness: 0.15,
        })
  );
  const brakeLightMat = trackMat(
    isGhost
      ? new THREE.MeshStandardMaterial({
          color: 0x7dd3fc,
          emissive: 0x38bdf8,
          emissiveIntensity: 1.1,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        })
      : new THREE.MeshStandardMaterial({
          color: 0x991111,
          emissive: 0xff1e1e,
          emissiveIntensity: 0.65,
          roughness: 0.2,
        })
  );

  // 1. Sculpted beveled lower body silhouette (facing +Z)
  const sideProfile = new THREE.Shape();
  sideProfile.moveTo(-2.15, 0.32);
  sideProfile.lineTo(2.15, 0.28);
  sideProfile.lineTo(2.22, 0.54);
  sideProfile.lineTo(1.98, 0.78);
  sideProfile.lineTo(0.88, 0.92);
  sideProfile.lineTo(0.32, 1.36);
  sideProfile.lineTo(-0.92, 1.34);
  sideProfile.lineTo(-1.72, 0.96);
  sideProfile.lineTo(-2.18, 0.88);
  sideProfile.closePath();

  const bodyGeo = trackGeo(
    new THREE.ExtrudeGeometry(sideProfile, {
      steps: 1,
      depth: 1.72,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 2,
    })
  );
  // Extrude is in XY with depth along +Z; rotate so profile X becomes +Z forward and depth centered on X
  bodyGeo.center();
  bodyGeo.rotateY(-Math.PI / 2);
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
  bodyMesh.position.set(0, 0.82, 0);
  bodyMesh.castShadow = castShadow;
  bodyMesh.receiveShadow = true;
  chassisGroup.add(bodyMesh);

  // 2. Front Carbon Splitter & Skid Plate
  const splitterGeo = trackGeo(new THREE.BoxGeometry(1.92, 0.1, 0.42));
  const splitter = new THREE.Mesh(splitterGeo, carbonMat);
  splitter.position.set(0, 0.28, 2.08);
  splitter.castShadow = castShadow;
  chassisGroup.add(splitter);

  // 3. Flared Rally Wheel Arches (4 fenders)
  const archGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.34, 0.92));
  const archOffsets: [number, number, number][] = [
    [0.92, 0.56, 1.32],
    [-0.92, 0.56, 1.32],
    [0.92, 0.56, -1.28],
    [-0.92, 0.56, -1.28],
  ];
  for (const [ax, ay, az] of archOffsets) {
    const arch = new THREE.Mesh(archGeo, carbonMat);
    arch.position.set(ax, ay, az);
    arch.castShadow = castShadow;
    chassisGroup.add(arch);
  }

  // 4. Tinted Glass Cabin Wrap (Windshield + Side Windows + Rear Glass)
  const cabinGeo = trackGeo(new THREE.BoxGeometry(1.54, 0.42, 1.76));
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, 1.15, -0.22);
  chassisGroup.add(cabin);

  // 5. Roof Panel + Rally Roof Air Scoop + Accent Racing Stripe
  const roofGeo = trackGeo(new THREE.BoxGeometry(1.56, 0.08, 1.38));
  const roof = new THREE.Mesh(roofGeo, paintMat);
  roof.position.set(0, 1.38, -0.26);
  roof.castShadow = castShadow;
  chassisGroup.add(roof);

  const roofScoopGeo = trackGeo(new THREE.BoxGeometry(0.38, 0.12, 0.46));
  const roofScoop = new THREE.Mesh(roofScoopGeo, accentMat);
  roofScoop.position.set(0, 1.45, 0.02);
  chassisGroup.add(roofScoop);

  const hoodScoopGeo = trackGeo(new THREE.BoxGeometry(0.68, 0.09, 0.58));
  const hoodScoop = new THREE.Mesh(hoodScoopGeo, carbonMat);
  hoodScoop.position.set(0, 0.98, 1.24);
  chassisGroup.add(hoodScoop);

  // Side accent livery stripes
  const stripeGeo = trackGeo(new THREE.BoxGeometry(1.91, 0.14, 1.65));
  const stripe = new THREE.Mesh(stripeGeo, accentMat);
  stripe.position.set(0, 0.64, -0.15);
  chassisGroup.add(stripe);

  // 6. Rear Twin-Plane Rally Wing Spoiler
  const pylonGeo = trackGeo(new THREE.BoxGeometry(0.07, 0.44, 0.34));
  const leftPylon = new THREE.Mesh(pylonGeo, carbonMat);
  leftPylon.position.set(0.56, 1.24, -1.92);
  leftPylon.castShadow = castShadow;
  const rightPylon = new THREE.Mesh(pylonGeo, carbonMat);
  rightPylon.position.set(-0.56, 1.24, -1.92);
  rightPylon.castShadow = castShadow;
  chassisGroup.add(leftPylon, rightPylon);

  const wingGeo = trackGeo(new THREE.BoxGeometry(1.88, 0.07, 0.44));
  const wing = new THREE.Mesh(wingGeo, paintMat);
  wing.position.set(0, 1.47, -1.96);
  wing.rotation.x = 0.14;
  wing.castShadow = castShadow;
  chassisGroup.add(wing);

  const endplateGeo = trackGeo(new THREE.BoxGeometry(0.05, 0.24, 0.52));
  const leftEnd = new THREE.Mesh(endplateGeo, accentMat);
  leftEnd.position.set(0.94, 1.44, -1.96);
  const rightEnd = new THREE.Mesh(endplateGeo, accentMat);
  rightEnd.position.set(-0.94, 1.44, -1.96);
  chassisGroup.add(leftEnd, rightEnd);

  // 7. Front Rally LED Light Pod + Headlights
  const podHousingGeo = trackGeo(new THREE.BoxGeometry(0.92, 0.14, 0.18));
  const podHousing = new THREE.Mesh(podHousingGeo, carbonMat);
  podHousing.position.set(0, 0.86, 1.88);
  chassisGroup.add(podHousing);

  const podLampGeo = trackGeo(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12));
  podLampGeo.rotateX(Math.PI / 2);
  for (const lx of [-0.3, -0.1, 0.1, 0.3]) {
    const lamp = new THREE.Mesh(podLampGeo, headlightMat);
    lamp.position.set(lx, 0.87, 1.97);
    chassisGroup.add(lamp);
  }

  const headGeo = trackGeo(new THREE.BoxGeometry(0.36, 0.12, 0.08));
  const headL = new THREE.Mesh(headGeo, headlightMat);
  headL.position.set(0.66, 0.68, 2.18);
  const headR = new THREE.Mesh(headGeo, headlightMat);
  headR.position.set(-0.66, 0.68, 2.18);
  chassisGroup.add(headL, headR);

  // 8. Rear Taillight Bar + Carbon Diffuser + Dual Exhaust Pipes
  const tailGeo = trackGeo(new THREE.BoxGeometry(0.48, 0.11, 0.08));
  const tailL = new THREE.Mesh(tailGeo, brakeLightMat);
  tailL.position.set(0.60, 0.84, -2.24);
  const tailR = new THREE.Mesh(tailGeo, brakeLightMat);
  tailR.position.set(-0.60, 0.84, -2.24);
  const tailCenterGeo = trackGeo(new THREE.BoxGeometry(0.76, 0.05, 0.06));
  const tailCenter = new THREE.Mesh(tailCenterGeo, brakeLightMat);
  tailCenter.position.set(0, 0.84, -2.23);

  const diffuserGeo = trackGeo(new THREE.BoxGeometry(1.56, 0.20, 0.18));
  const diffuser = new THREE.Mesh(diffuserGeo, carbonMat);
  diffuser.position.set(0, 0.36, -2.18);

  const plateGeo = trackGeo(new THREE.BoxGeometry(0.46, 0.14, 0.04));
  const plate = new THREE.Mesh(plateGeo, alloyMat);
  plate.position.set(0, 0.64, -2.23);

  chassisGroup.add(tailL, tailR, tailCenter, diffuser, plate);

  const exhaustGeo = trackGeo(new THREE.CylinderGeometry(0.065, 0.075, 0.26, 12));
  exhaustGeo.rotateX(Math.PI / 2);
  const exL = new THREE.Mesh(exhaustGeo, alloyMat);
  exL.position.set(0.48, 0.32, -2.22);
  const exR = new THREE.Mesh(exhaustGeo, alloyMat);
  exR.position.set(-0.48, 0.32, -2.22);
  chassisGroup.add(exL, exR);

  // 9. 4 Articulated Wheel Assemblies (tire + alloy rim + spoke + caliper)
  const tireGeo = trackGeo(new THREE.CylinderGeometry(0.37, 0.37, 0.28, 20));
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.24, 0.29, 14));
  rimGeo.rotateZ(Math.PI / 2);
  const spokeGeo = trackGeo(new THREE.BoxGeometry(0.30, 0.42, 0.05));
  const calGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.22, 0.16));

  const wheelMeshes: THREE.Group[] = [];
  const createWheel = (isLeft: boolean): THREE.Group => {
    const spinGroup = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = castShadow;
    spinGroup.add(tire);

    const rim = new THREE.Mesh(rimGeo, alloyMat);
    spinGroup.add(rim);

    for (let s = 0; s < 3; s++) {
      const spoke = new THREE.Mesh(spokeGeo, carbonMat);
      spoke.rotation.x = (s * Math.PI) / 3;
      spinGroup.add(spoke);
    }

    const holder = new THREE.Group();
    holder.add(spinGroup);
    const caliper = new THREE.Mesh(calGeo, caliperMat);
    caliper.position.set(isLeft ? -0.06 : 0.06, 0.08, -0.14);
    holder.add(caliper);

    wheelMeshes.push(spinGroup);
    return holder;
  };

  const frontLeftSteer = new THREE.Group();
  frontLeftSteer.position.set(0.92, 0.37, 1.32);
  frontLeftSteer.add(createWheel(true));

  const frontRightSteer = new THREE.Group();
  frontRightSteer.position.set(-0.92, 0.37, 1.32);
  frontRightSteer.add(createWheel(false));

  const rearLeft = createWheel(true);
  rearLeft.position.set(0.92, 0.37, -1.28);

  const rearRight = createWheel(false);
  rearRight.position.set(-0.92, 0.37, -1.28);

  root.add(frontLeftSteer, frontRightSteer, rearLeft, rearRight);

  // 10. Grounded Radial Contact Shadow Disc
  const shadowGeo = trackGeo(new THREE.PlaneGeometry(3.2, 5.4));
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: contactShadowMap,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  );
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.set(0, 0.03, 0);
  if (isGhost) {
    shadowMat.opacity = 0.22;
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = false;
        obj.receiveShadow = false;
        obj.renderOrder = 2;
      }
    });
  }
  root.add(shadowDisc);

  return {
    root,
    chassisGroup,
    frontLeftSteer,
    frontRightSteer,
    wheelMeshes,
    brakeLightMat,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

export function buildGhostCarMesh(contactShadowMap: THREE.Texture): RallyCarRig {
  return buildRallyCarMesh(0x38bdf8, 0xe0f2fe, contactShadowMap, false, true);
}

export function buildGhostTrajectoryOverlay(
  frames: readonly { x: number; y: number; z: number }[]
): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];

  if (frames.length < 2) {
    return {
      group,
      dispose: () => {
        disposables.forEach((d) => d.dispose());
      },
    };
  }

  // Downsample up to ~320 evenly spaced trajectory points for smooth 3D racing-line ribbon
  const maxPts = 320;
  const step = Math.max(1, Math.floor(frames.length / maxPts));
  const pts: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < frames.length; i += step) {
    pts.push(frames[i]);
  }
  const last = frames[frames.length - 1];
  if (pts[pts.length - 1] !== last) {
    pts.push(last);
  }

  const ribbonPositions: number[] = [];
  const ribbonIndices: number[] = [];
  const linePositions: number[] = [];
  const halfRibbon = 0.22;

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    let dx = next.x - prev.x;
    let dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    // Perpendicular in XZ plane
    const nx = -dz;
    const nz = dx;

    const py = p.y + 0.14;
    ribbonPositions.push(p.x - nx * halfRibbon, py, p.z - nz * halfRibbon);
    ribbonPositions.push(p.x + nx * halfRibbon, py, p.z + nz * halfRibbon);
    linePositions.push(p.x, p.y + 0.22, p.z);

    if (i < pts.length - 1) {
      const base = i * 2;
      ribbonIndices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  const ribbonGeo = new THREE.BufferGeometry();
  ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(ribbonPositions, 3));
  ribbonGeo.setIndex(ribbonIndices);
  ribbonGeo.computeVertexNormals();
  disposables.push(ribbonGeo);

  const ribbonMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  disposables.push(ribbonMat);

  const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbonMesh.renderOrder = 1;
  ribbonMesh.frustumCulled = false;
  group.add(ribbonMesh);

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  disposables.push(lineGeo);

  const lineMat = new THREE.LineBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  disposables.push(lineMat);

  const lineObj = new THREE.Line(lineGeo, lineMat);
  lineObj.renderOrder = 2;
  lineObj.frustumCulled = false;
  group.add(lineObj);

  return {
    group,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

export interface TrafficCarRig {
  root: THREE.Group;
  wheels: THREE.Mesh[];
  dispose: () => void;
}

export function buildTrafficCarMesh(
  kind: TrafficKind,
  colorHex: number,
  accentHex: number,
  contactShadowMap: THREE.Texture,
  castShadow: boolean
): TrafficCarRig {
  const root = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const paintMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: colorHex,
      metalness: 0.42,
      roughness: 0.25,
      clearcoat: 0.75,
      clearcoatRoughness: 0.16,
    })
  );
  const accentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: accentHex,
      metalness: 0.2,
      roughness: 0.42,
    })
  );
  const glassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x162030,
      metalness: 0.15,
      roughness: 0.12,
    })
  );
  const tireMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x181a1f,
      roughness: 0.88,
      metalness: 0.05,
    })
  );
  const rimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd4d8e0,
      metalness: 0.85,
      roughness: 0.25,
    })
  );
  const headMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfff8e6,
      emissive: 0xffefc2,
      emissiveIntensity: 1.4,
    })
  );
  const tailMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0xef4444,
      emissiveIntensity: 1.2,
    })
  );

  const isVan = kind === 'van';
  const length = isVan ? 4.1 : kind === 'compact' ? 3.35 : 3.75;
  const bodyHeight = isVan ? 0.82 : 0.56;
  const cabinHeight = isVan ? 0.68 : 0.46;

  // Primary lower body
  const bodyGeo = trackGeo(new THREE.BoxGeometry(1.74, bodyHeight, length));
  const body = new THREE.Mesh(bodyGeo, paintMat);
  body.position.set(0, 0.34 + bodyHeight * 0.5, 0);
  body.castShadow = castShadow;
  body.receiveShadow = true;
  root.add(body);

  // Secondary cabin greenhouse
  const cabinLen = isVan ? length * 0.78 : length * 0.52;
  const cabinZ = isVan ? -0.15 : -0.18;
  const cabinGeo = trackGeo(new THREE.BoxGeometry(1.48, cabinHeight, cabinLen));
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, 0.34 + bodyHeight + cabinHeight * 0.48, cabinZ);
  cabin.castShadow = castShadow;
  root.add(cabin);

  // Roof cap
  const roofGeo = trackGeo(new THREE.BoxGeometry(1.52, 0.08, cabinLen * 0.94));
  const roof = new THREE.Mesh(roofGeo, isVan ? accentMat : paintMat);
  const roofY = 0.34 + bodyHeight + cabinHeight;
  roof.position.set(0, roofY, cabinZ);
  root.add(roof);

  // Accent trim (Taxi sign on roof or racing stripe)
  if (kind === 'taxi') {
    const taxiSignGeo = trackGeo(new THREE.BoxGeometry(0.54, 0.16, 0.24));
    const taxiSignMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef9c3,
        emissive: 0xfacc15,
        emissiveIntensity: 1.3,
        roughness: 0.25,
      })
    );
    const sign = new THREE.Mesh(taxiSignGeo, taxiSignMat);
    sign.position.set(0, roofY + 0.11, 0.05);
    root.add(sign);
  } else {
    const stripeGeo = trackGeo(new THREE.BoxGeometry(1.78, 0.11, length * 0.86));
    const stripe = new THREE.Mesh(stripeGeo, accentMat);
    stripe.position.set(0, 0.58, 0);
    root.add(stripe);
  }

  // Headlights & Taillights
  const lampGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.12, 0.08));
  for (const sx of [-0.58, 0.58]) {
    const h = new THREE.Mesh(lampGeo, headMat);
    h.position.set(sx, 0.58, length * 0.5 + 0.01);
    const t = new THREE.Mesh(lampGeo, tailMat);
    t.position.set(sx, 0.62, -length * 0.5 - 0.01);
    root.add(h, t);
  }

  // 4 Articulated Wheels
  const wheelGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.24, 14));
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.25, 10));
  hubGeo.rotateZ(Math.PI / 2);
  const wheels: THREE.Mesh[] = [];
  const wheelOffsets: [number, number][] = [
    [0.84, length * 0.31],
    [-0.84, length * 0.31],
    [0.84, -length * 0.31],
    [-0.84, -length * 0.31],
  ];
  for (const [wx, wz] of wheelOffsets) {
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.position.set(wx, 0.32, wz);
    const hub = new THREE.Mesh(hubGeo, rimMat);
    wheel.add(hub);
    wheels.push(wheel);
    root.add(wheel);
  }

  // Contact shadow disc
  const shadowGeo = trackGeo(new THREE.PlaneGeometry(2.8, length + 0.9));
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: contactShadowMap,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    })
  );
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.set(0, 0.025, 0);
  root.add(shadow);

  return {
    root,
    wheels,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

export function buildRoadObstacleMesh(
  kind: ObstacleKind,
  castShadow: boolean
): { root: THREE.Group; dispose: () => void } {
  const root = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  if (kind === 'cone') {
    const baseMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 }));
    const orangeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xea580c,
        emissiveIntensity: 0.25,
        roughness: 0.45,
      })
    );
    const collarMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        emissive: 0xe2e8f0,
        emissiveIntensity: 0.3,
        roughness: 0.3,
      })
    );

    const baseGeo = trackGeo(new THREE.BoxGeometry(0.68, 0.09, 0.68));
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.045;
    base.castShadow = castShadow;

    const coneGeo = trackGeo(new THREE.ConeGeometry(0.24, 0.85, 12));
    const cone = new THREE.Mesh(coneGeo, orangeMat);
    cone.position.y = 0.5;
    cone.castShadow = castShadow;

    const bandGeo = trackGeo(new THREE.CylinderGeometry(0.145, 0.195, 0.2, 12));
    const band = new THREE.Mesh(bandGeo, collarMat);
    band.position.y = 0.46;

    root.add(base, cone, band);
  } else {
    const legMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.4 })
    );
    const redMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.42, metalness: 0.1 })
    );
    const whiteMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 })
    );

    const legGeo = trackGeo(new THREE.BoxGeometry(0.12, 0.88, 0.56));
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.82, 0.44, 0);
    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.82, 0.44, 0);
    legL.castShadow = castShadow;
    legR.castShadow = castShadow;

    const railGeo = trackGeo(new THREE.BoxGeometry(1.9, 0.34, 0.14));
    const rail = new THREE.Mesh(railGeo, redMat);
    rail.position.set(0, 0.68, 0);
    rail.castShadow = castShadow;

    const stripeGeo = trackGeo(new THREE.BoxGeometry(0.36, 0.36, 0.16));
    for (const sx of [-0.55, 0, 0.55]) {
      const st = new THREE.Mesh(stripeGeo, whiteMat);
      st.position.set(sx, 0.68, 0);
      root.add(st);
    }

    root.add(legL, legR, rail);
  }

  return {
    root,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

export function buildCircuitEnvironment(
  scene: THREE.Scene,
  track: RallyTrack,
  textures: ProceduralTextures,
  isSoftwareGl: boolean
): { group: THREE.Group; dispose: () => void } {
  const envGroup = new THREE.Group();
  scene.add(envGroup);
  const disposables: { dispose: () => void }[] = [];
  const isCity = track.mapId === 'city';

  const cx = track.center.x;
  const cz = track.center.z;

  // 1. Continuous Ground Basin / Urban Plaza (320m x 320m centered on track centroid)
  const terrainGeo = new THREE.PlaneGeometry(320, 320, 96, 96);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  const colors = isCity ? null : new Float32Array(posAttr.count * 3);

  for (let i = 0; i < posAttr.count; i++) {
    const wx = posAttr.getX(i) + cx;
    const wz = posAttr.getZ(i) + cz;
    const wy = track.groundHeightAt(wx, wz);
    posAttr.setXYZ(i, wx, wy - 0.03, wz);

    if (colors) {
      const rockFactor = Math.min(1, Math.max(0, (wy - 3.8) / 11));
      const grain = 0.86 + 0.24 * Math.sin(wx * 0.25 + wz * 0.19) * Math.cos(wx * 0.09 - wz * 0.13);
      colors[i * 3] = (0.14 * (1 - rockFactor) + 0.31 * rockFactor) * grain;
      colors[i * 3 + 1] = (0.22 * (1 - rockFactor) + 0.28 * rockFactor) * grain;
      colors[i * 3 + 2] = (0.12 * (1 - rockFactor) + 0.26 * rockFactor) * grain;
    }
  }
  if (colors) {
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  terrainGeo.computeVertexNormals();
  disposables.push(terrainGeo);

  const terrainMat = isCity
    ? new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.urbanGroundMap,
        roughness: 0.88,
        metalness: 0.08,
      })
    : new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.94,
        metalness: 0.02,
      });
  disposables.push(terrainMat);

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  envGroup.add(terrainMesh);

  // 2. Ribbon Track Surface (split by asphalt & gravel materials)
  const buildRoadSection = (
    indices: number[],
    map: THREE.Texture,
    bumpMap: THREE.Texture,
    roughness: number,
    yOffset: number
  ) => {
    const positions: number[] = [];
    const uvs: number[] = [];
    const tris: number[] = [];

    for (let k = 0; k < indices.length; k++) {
      const s = track.samples[indices[k] % track.samples.length];
      const hw = s.halfWidth;
      const lx = s.x - s.nx * hw;
      const lz = s.z - s.nz * hw;
      const rx = s.x + s.nx * hw;
      const rz = s.z + s.nz * hw;

      positions.push(lx, s.y + yOffset, lz);
      positions.push(rx, s.y + yOffset, rz);

      const vCoord = k * 0.24;
      uvs.push(0, vCoord);
      uvs.push(1, vCoord);

      if (k < indices.length - 1) {
        const base = k * 2;
        // Counter-clockwise when viewed from +Y above (normal points +Y)
        tris.push(base, base + 1, base + 2);
        tris.push(base + 1, base + 3, base + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(tris);
    geo.computeVertexNormals();
    disposables.push(geo);

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      bumpMap,
      bumpScale: 0.04,
      roughness,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    disposables.push(mat);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    envGroup.add(mesh);
  };

  if (isCity) {
    const fullLoop: number[] = [];
    for (let i = 0; i <= track.samples.length; i++) {
      fullLoop.push(i % track.samples.length);
    }
    buildRoadSection(fullLoop, textures.asphaltMap, textures.asphaltBump, 0.72, 0.045);
  } else {
    // Asphalt segments: [0..165] and [353..480] (wrapping seamlessly)
    const asphaltIndices1: number[] = [];
    for (let i = 353; i <= 480 + 165; i++) {
      asphaltIndices1.push(i % track.samples.length);
    }
    buildRoadSection(asphaltIndices1, textures.asphaltMap, textures.asphaltBump, 0.78, 0.045);

    const gravelIndices: number[] = [];
    for (let i = 163; i <= 355; i++) {
      gravelIndices.push(i % track.samples.length);
    }
    buildRoadSection(gravelIndices, textures.gravelMap, textures.gravelBump, 0.92, 0.042);
  }

  // 3. Apex Rumble Curbs on corners
  const curbGeoList: number[] = [];
  const curbUvs: number[] = [];
  const curbTris: number[] = [];
  let curbVertOffset = 0;
  const curbCurvatureMin = isCity ? 0.012 : 0.016;

  for (let i = 0; i < track.samples.length; i++) {
    const s = track.samples[i];
    const next = track.samples[(i + 1) % track.samples.length];
    if (s.surface === 'asphalt' && Math.abs(s.curvature) > curbCurvatureMin) {
      const side = s.curvature > 0 ? 1 : -1;
      const inner = s.halfWidth - 0.15;
      const outer = s.halfWidth + 0.9;

      const x0 = s.x + s.nx * side * inner;
      const z0 = s.z + s.nz * side * inner;
      const x1 = s.x + s.nx * side * outer;
      const z1 = s.z + s.nz * side * outer;

      const nx0 = next.x + next.nx * side * inner;
      const nz0 = next.z + next.nz * side * inner;
      const nx1 = next.x + next.nx * side * outer;
      const nz1 = next.z + next.nz * side * outer;

      curbGeoList.push(x0, s.y + 0.07, z0, x1, s.y + 0.07, z1, nx0, next.y + 0.07, nz0, nx1, next.y + 0.07, nz1);
      curbUvs.push(0, i * 0.5, 1, i * 0.5, 0, (i + 1) * 0.5, 1, (i + 1) * 0.5);
      if (side > 0) {
        curbTris.push(curbVertOffset, curbVertOffset + 1, curbVertOffset + 2, curbVertOffset + 1, curbVertOffset + 3, curbVertOffset + 2);
      } else {
        curbTris.push(curbVertOffset, curbVertOffset + 2, curbVertOffset + 1, curbVertOffset + 1, curbVertOffset + 2, curbVertOffset + 3);
      }
      curbVertOffset += 4;
    }
  }
  if (curbVertOffset > 0) {
    const curbGeo = new THREE.BufferGeometry();
    curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbGeoList, 3));
    curbGeo.setAttribute('uv', new THREE.Float32BufferAttribute(curbUvs, 2));
    curbGeo.setIndex(curbTris);
    curbGeo.computeVertexNormals();
    disposables.push(curbGeo);

    const curbMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.curbMap,
      roughness: 0.72,
    });
    disposables.push(curbMat);
    const curbMesh = new THREE.Mesh(curbGeo, curbMat);
    curbMesh.receiveShadow = true;
    envGroup.add(curbMesh);
  }

  // 4. Outer Track Barriers (Armco guardrails on Alpine, Concrete FIA walls on City GP)
  const railPos: number[] = [];
  const railUvs: number[] = [];
  const railTris: number[] = [];
  const postLocations: { x: number; y: number; z: number; angle: number }[] = [];

  const barrierBottom = isCity ? 0.02 : 0.36;
  const barrierTop = isCity ? 0.92 : 0.74;

  for (const side of [-1, 1]) {
    const baseOffset = railPos.length / 3;
    for (let i = 0; i <= track.samples.length; i++) {
      const s = track.samples[i % track.samples.length];
      const lat = s.halfWidth + 2.05;
      const rx = s.x + s.nx * side * lat;
      const rz = s.z + s.nz * side * lat;

      railPos.push(rx, s.y + barrierBottom, rz);
      railPos.push(rx, s.y + barrierTop, rz);
      railUvs.push(0, i * 0.35, 1, i * 0.35);

      if (i < track.samples.length) {
        const b = baseOffset + i * 2;
        if (side > 0) {
          railTris.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        } else {
          railTris.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
        }
      }

      if (i < track.samples.length && i % 6 === 0) {
        postLocations.push({
          x: rx + s.nx * side * 0.16,
          y: s.y,
          z: rz + s.nz * side * 0.16,
          angle: Math.atan2(s.tx, s.tz),
        });
      }
    }
  }

  const railGeo = new THREE.BufferGeometry();
  railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPos, 3));
  railGeo.setAttribute('uv', new THREE.Float32BufferAttribute(railUvs, 2));
  railGeo.setIndex(railTris);
  railGeo.computeVertexNormals();
  disposables.push(railGeo);

  const railMat = isCity
    ? new THREE.MeshStandardMaterial({
        color: 0xc2c8d4,
        roughness: 0.78,
        metalness: 0.12,
        side: THREE.DoubleSide,
      })
    : new THREE.MeshStandardMaterial({
        color: 0xa5acb8,
        metalness: 0.78,
        roughness: 0.32,
        side: THREE.DoubleSide,
      });
  disposables.push(railMat);
  const railMesh = new THREE.Mesh(railGeo, railMat);
  railMesh.castShadow = !isSoftwareGl;
  railMesh.receiveShadow = true;
  envGroup.add(railMesh);

  const postGeo = new THREE.BoxGeometry(0.14, isCity ? 1.55 : 0.85, 0.14);
  disposables.push(postGeo);
  const postMat = new THREE.MeshStandardMaterial({
    color: isCity ? 0x252c38 : 0x3b404a,
    metalness: 0.65,
    roughness: 0.48,
  });
  disposables.push(postMat);
  const postInstanced = new THREE.InstancedMesh(postGeo, postMat, postLocations.length);
  const dummy = new THREE.Object3D();
  postLocations.forEach((p, idx) => {
    dummy.position.set(p.x, p.y + (isCity ? 0.78 : 0.42), p.z);
    dummy.rotation.set(0, p.angle, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    postInstanced.setMatrixAt(idx, dummy.matrix);
  });
  postInstanced.instanceMatrix.needsUpdate = true;
  postInstanced.computeBoundingSphere();
  envGroup.add(postInstanced);

  // 5. Start / Finish Gantry Arch at progress = 0.055 (just ahead of start grid)
  const startSample = track.sampleAtProgress(0.055);
  const gantry = new THREE.Group();
  gantry.position.set(startSample.x, startSample.y, startSample.z);
  gantry.rotation.y = Math.atan2(startSample.tx, startSample.tz);

  const spanHalf = startSample.halfWidth + 1.4;
  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x262b34,
    metalness: 0.82,
    roughness: 0.28,
  });
  disposables.push(trussMat);

  const pillarGeo = new THREE.BoxGeometry(0.55, 6.2, 0.55);
  disposables.push(pillarGeo);
  const pLeft = new THREE.Mesh(pillarGeo, trussMat);
  pLeft.position.set(spanHalf, 3.1, 0);
  pLeft.castShadow = !isSoftwareGl;
  const pRight = new THREE.Mesh(pillarGeo, trussMat);
  pRight.position.set(-spanHalf, 3.1, 0);
  pRight.castShadow = !isSoftwareGl;
  gantry.add(pLeft, pRight);

  const activeBannerMap = isCity ? textures.cityBannerMap : textures.bannerMap;
  const crossGeo = new THREE.BoxGeometry(spanHalf * 2 + 0.8, 1.45, 0.65);
  disposables.push(crossGeo);
  const crossMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: activeBannerMap,
    roughness: 0.45,
    metalness: 0.25,
  });
  disposables.push(crossMat);
  const crossBeam = new THREE.Mesh(crossGeo, crossMat);
  crossBeam.position.set(0, 5.5, 0);
  crossBeam.castShadow = !isSoftwareGl;
  gantry.add(crossBeam);

  // Checkered start line strip on tarmac (offset Y by +0.07 above road)
  const lineGeo = new THREE.PlaneGeometry(startSample.halfWidth * 1.92, 1.3);
  lineGeo.rotateX(-Math.PI / 2);
  disposables.push(lineGeo);
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: activeBannerMap,
    roughness: 0.7,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  disposables.push(lineMat);
  const startLine = new THREE.Mesh(lineGeo, lineMat);
  startLine.position.set(0, 0.07, 0);
  gantry.add(startLine);

  envGroup.add(gantry);

  // Deterministic PRNG for procedural props
  let seed = isCity ? 7331 : 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const tintColor = new THREE.Color();

  if (isCity) {
    // 6A. Instanced 3-Part Composite Skyscrapers & Mid-Rise Urban Towers
    // Podium Base + Glazed Facade Shaft + Mechanical Penthouse Crown
    const bldgCoords: {
      x: number;
      y: number;
      z: number;
      w: number;
      d: number;
      h: number;
      rotY: number;
    }[] = [];

    for (let attempt = 0; attempt < 1100 && bldgCoords.length < 96; attempt++) {
      const bx = cx + (rand() - 0.5) * 265;
      const bz = cz + (rand() - 0.5) * 265;
      const proj = track.project(bx, bz);
      if (Math.abs(proj.lateralOffset) < proj.halfWidth + 11.0) continue;

      let tooClose = false;
      for (let i = 0; i < track.samples.length; i += 6) {
        const s = track.samples[i];
        if ((bx - s.x) ** 2 + (bz - s.z) ** 2 < 275) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Avoid overlapping nearby towers
      let overlapsBuilding = false;
      for (const existing of bldgCoords) {
        if ((bx - existing.x) ** 2 + (bz - existing.z) ** 2 < 225) {
          overlapsBuilding = true;
          break;
        }
      }
      if (overlapsBuilding) continue;

      const radial = Math.hypot(bx - cx, bz - cz);
      const heightBoost = radial > 78 ? 16 : 6;
      bldgCoords.push({
        x: bx,
        y: track.groundHeightAt(bx, bz),
        z: bz,
        w: 9 + rand() * 8,
        d: 9 + rand() * 8,
        h: 15 + rand() * 28 + heightBoost * rand(),
        rotY: Math.floor(rand() * 4) * (Math.PI / 2),
      });
    }

    const podiumGeo = new THREE.BoxGeometry(1.08, 1, 1.08);
    podiumGeo.translate(0, 0.5, 0);
    const towerGeo = new THREE.BoxGeometry(1, 1, 1);
    towerGeo.translate(0, 0.5, 0);
    const crownGeo = new THREE.BoxGeometry(0.62, 1, 0.62);
    crownGeo.translate(0, 0.5, 0);
    disposables.push(podiumGeo, towerGeo, crownGeo);

    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0x2a303c,
      roughness: 0.86,
      metalness: 0.12,
    });
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.buildingFacadeMap,
      roughness: 0.28,
      metalness: 0.38,
    });
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0x3b4454,
      roughness: 0.58,
      metalness: 0.45,
    });
    disposables.push(podiumMat, towerMat, crownMat);

    const podiums = new THREE.InstancedMesh(podiumGeo, podiumMat, bldgCoords.length);
    const towers = new THREE.InstancedMesh(towerGeo, towerMat, bldgCoords.length);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, bldgCoords.length);

    const towerTints: [number, number, number][] = [
      [0.86, 0.91, 0.98],
      [0.96, 0.92, 0.86],
      [0.78, 0.84, 0.94],
      [0.9, 0.93, 0.96],
    ];

    bldgCoords.forEach((b, i) => {
      const podiumH = Math.max(2.6, b.h * 0.16);
      const shaftH = b.h * 0.76;
      const crownH = Math.max(1.8, b.h * 0.12);

      dummy.position.set(b.x, b.y - 0.1, b.z);
      dummy.rotation.set(0, b.rotY, 0);
      dummy.scale.set(b.w, podiumH, b.d);
      dummy.updateMatrix();
      podiums.setMatrixAt(i, dummy.matrix);

      dummy.position.set(b.x, b.y - 0.1 + podiumH, b.z);
      dummy.scale.set(b.w, shaftH, b.d);
      dummy.updateMatrix();
      towers.setMatrixAt(i, dummy.matrix);

      dummy.position.set(b.x, b.y - 0.1 + podiumH + shaftH, b.z);
      dummy.scale.set(b.w, crownH, b.d);
      dummy.updateMatrix();
      crowns.setMatrixAt(i, dummy.matrix);

      const [tr, tg, tb] = towerTints[i % towerTints.length];
      tintColor.setRGB(tr, tg, tb);
      towers.setColorAt(i, tintColor);
    });

    podiums.instanceMatrix.needsUpdate = true;
    towers.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    if (towers.instanceColor) towers.instanceColor.needsUpdate = true;
    podiums.computeBoundingSphere();
    towers.computeBoundingSphere();
    crowns.computeBoundingSphere();
    towers.castShadow = !isSoftwareGl;
    podiums.receiveShadow = true;
    envGroup.add(podiums, towers, crowns);

    // 6B. Instanced Streetlight Poles (3-part: Pole Mast + Arm + Warm LED Luminaire)
    const lampSamples: number[] = [];
    for (let i = 0; i < track.samples.length; i += 14) {
      lampSamples.push(i);
    }

    const lampPoleGeo = new THREE.CylinderGeometry(0.08, 0.12, 5.4, 8);
    lampPoleGeo.translate(0, 2.7, 0);
    const lampArmGeo = new THREE.BoxGeometry(1.8, 0.1, 0.1);
    lampArmGeo.translate(-0.85, 5.3, 0);
    const lampHeadGeo = new THREE.BoxGeometry(0.65, 0.12, 0.28);
    lampHeadGeo.translate(-1.55, 5.2, 0);
    disposables.push(lampPoleGeo, lampArmGeo, lampHeadGeo);

    const lampPoleMat = new THREE.MeshStandardMaterial({
      color: 0x2c3340,
      metalness: 0.78,
      roughness: 0.34,
    });
    const lampHeadMat = new THREE.MeshStandardMaterial({
      color: 0xfff5d6,
      emissive: 0xffd27a,
      emissiveIntensity: 1.6,
      roughness: 0.2,
    });
    disposables.push(lampPoleMat, lampHeadMat);

    const lampPoles = new THREE.InstancedMesh(lampPoleGeo, lampPoleMat, lampSamples.length);
    const lampArms = new THREE.InstancedMesh(lampArmGeo, lampPoleMat, lampSamples.length);
    const lampHeads = new THREE.InstancedMesh(lampHeadGeo, lampHeadMat, lampSamples.length);

    lampSamples.forEach((sampleIdx, idx) => {
      const s = track.samples[sampleIdx];
      const lat = s.halfWidth + 2.65;
      const lx = s.x + s.nx * lat;
      const lz = s.z + s.nz * lat;
      // Rotate so arm (-X local) reaches inward over street toward (-nx, -nz)
      const inwardAngle = Math.atan2(-s.nz, s.nx);

      dummy.position.set(lx, s.y, lz);
      dummy.rotation.set(0, inwardAngle, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      lampPoles.setMatrixAt(idx, dummy.matrix);
      lampArms.setMatrixAt(idx, dummy.matrix);
      lampHeads.setMatrixAt(idx, dummy.matrix);
    });

    lampPoles.instanceMatrix.needsUpdate = true;
    lampArms.instanceMatrix.needsUpdate = true;
    lampHeads.instanceMatrix.needsUpdate = true;
    lampPoles.computeBoundingSphere();
    lampArms.computeBoundingSphere();
    lampHeads.computeBoundingSphere();
    envGroup.add(lampPoles, lampArms, lampHeads);
  } else {
    // 6. Instanced Alpine Pine Trees (3-part composite pine trees: Trunk + Lower Crown + Upper Crown)
    const treeCoords: { x: number; y: number; z: number; scale: number; rotY: number }[] = [];

    for (let attempt = 0; attempt < 950 && treeCoords.length < 180; attempt++) {
      const tx = cx + (rand() - 0.5) * 230;
      const tz = cz + (rand() - 0.5) * 230;
      const proj = track.project(tx, tz);
      const distFromCenter = Math.abs(proj.lateralOffset);
      if (distFromCenter < proj.halfWidth + 5.5) continue;
      let tooClose = false;
      for (let i = 0; i < track.samples.length; i += 6) {
        const s = track.samples[i];
        if ((tx - s.x) ** 2 + (tz - s.z) ** 2 < 110) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const ty = track.groundHeightAt(tx, tz);
      treeCoords.push({
        x: tx,
        y: ty,
        z: tz,
        scale: 0.85 + rand() * 0.45,
        rotY: rand() * Math.PI * 2,
      });
    }

    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, 2.4, 7);
    trunkGeo.translate(0, 1.2, 0);
    const lowerCrownGeo = new THREE.ConeGeometry(1.85, 3.8, 8);
    lowerCrownGeo.translate(0, 3.6, 0);
    const upperCrownGeo = new THREE.ConeGeometry(1.3, 3.2, 8);
    upperCrownGeo.translate(0, 5.7, 0);
    disposables.push(trunkGeo, lowerCrownGeo, upperCrownGeo);

    const barkMat = new THREE.MeshStandardMaterial({ color: 0x4b3526, roughness: 0.92 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    disposables.push(barkMat, foliageMat);

    const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, treeCoords.length);
    const lowerCrowns = new THREE.InstancedMesh(lowerCrownGeo, foliageMat, treeCoords.length);
    const upperCrowns = new THREE.InstancedMesh(upperCrownGeo, foliageMat, treeCoords.length);

    treeCoords.forEach((t, i) => {
      dummy.position.set(t.x, t.y - 0.1, t.z);
      dummy.rotation.set(0, t.rotY, 0);
      dummy.scale.setScalar(t.scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      lowerCrowns.setMatrixAt(i, dummy.matrix);
      upperCrowns.setMatrixAt(i, dummy.matrix);

      const gShift = 0.24 + (i % 7) * 0.022;
      tintColor.setRGB(0.12, gShift, 0.14);
      lowerCrowns.setColorAt(i, tintColor);
      tintColor.setRGB(0.15, gShift + 0.04, 0.16);
      upperCrowns.setColorAt(i, tintColor);
    });
    trunks.instanceMatrix.needsUpdate = true;
    lowerCrowns.instanceMatrix.needsUpdate = true;
    upperCrowns.instanceMatrix.needsUpdate = true;
    if (lowerCrowns.instanceColor) lowerCrowns.instanceColor.needsUpdate = true;
    if (upperCrowns.instanceColor) upperCrowns.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    lowerCrowns.computeBoundingSphere();
    upperCrowns.computeBoundingSphere();
    lowerCrowns.castShadow = !isSoftwareGl;
    upperCrowns.castShadow = !isSoftwareGl;
    envGroup.add(trunks, lowerCrowns, upperCrowns);

    // 7. Instanced Canyon Boulders
    const rockGeo = new THREE.DodecahedronGeometry(1.4, 0);
    const rPos = rockGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const vx = rPos.getX(i);
      const vy = rPos.getY(i);
      const vz = rPos.getZ(i);
      const n = 0.82 + 0.35 * Math.sin(vx * 2.1 + vz * 1.7);
      rPos.setXYZ(i, vx * n, vy * 0.72 * n, vz * n);
    }
    rockGeo.computeVertexNormals();
    disposables.push(rockGeo);

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.05,
    });
    disposables.push(rockMat);

    const rockCoords: { x: number; y: number; z: number; sx: number; sy: number; sz: number; ry: number }[] = [];
    for (let attempt = 0; attempt < 400 && rockCoords.length < 70; attempt++) {
      const rx = cx + (rand() - 0.5) * 235;
      const rz = cz + (rand() - 0.5) * 235;
      let tooClose = false;
      for (let i = 0; i < track.samples.length; i += 6) {
        const s = track.samples[i];
        if ((rx - s.x) ** 2 + (rz - s.z) ** 2 < 105) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      const ry = track.groundHeightAt(rx, rz);
      rockCoords.push({
        x: rx,
        y: ry + 0.25,
        z: rz,
        sx: 0.9 + rand() * 1.9,
        sy: 0.7 + rand() * 1.4,
        sz: 0.9 + rand() * 1.8,
        ry: rand() * Math.PI * 2,
      });
    }

    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCoords.length);
    rockCoords.forEach((r, i) => {
      dummy.position.set(r.x, r.y, r.z);
      dummy.rotation.set(0, r.ry, 0);
      dummy.scale.set(r.sx, r.sy, r.sz);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);

      const shade = 0.32 + (i % 5) * 0.04;
      tintColor.setRGB(shade + 0.03, shade + 0.01, shade - 0.01);
      rocks.setColorAt(i, tintColor);
    });
    rocks.instanceMatrix.needsUpdate = true;
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    rocks.computeBoundingSphere();
    rocks.castShadow = !isSoftwareGl;
    rocks.receiveShadow = true;
    envGroup.add(rocks);
  }

  return {
    group: envGroup,
    dispose: () => {
      scene.remove(envGroup);
      disposables.forEach((d) => d.dispose());
    },
  };
}
