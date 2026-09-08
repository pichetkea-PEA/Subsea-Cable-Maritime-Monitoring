import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RotateCw, Maximize2, Layers, Compass, Eye, Sparkles } from 'lucide-react';

interface Vessel3DModelProps {
  shipType?: string;
  vesselName?: string;
  mmsi?: string;
  grossTonnage?: number;
  className?: string;
  autoRotate?: boolean;
}

export const Vessel3DModel: React.FC<Vessel3DModelProps> = ({
  shipType = 'Passenger ship',
  vesselName = 'Vessel',
  mmsi = '567001507',
  grossTonnage,
  className = '',
  autoRotate: initialAutoRotate = true,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isRotating, setIsRotating] = useState(initialAutoRotate);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  // References for Three.js instance
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const vesselGroupRef = useRef<THREE.Group | null>(null);
  const materialsRef = useRef<THREE.Material[]>([]);
  const animFrameIdRef = useRef<number | null>(null);

  // Determine category archetype
  const typeLower = (shipType || '').toLowerCase();
  let category: 'ferry' | 'cargo' | 'tanker' | 'fishing' | 'tug' | 'patrol' = 'ferry';
  if (typeLower.includes('passenger') || typeLower.includes('ferry') || typeLower.includes('cruise') || typeLower.includes('catamaran')) {
    category = 'ferry';
  } else if (typeLower.includes('tanker') || typeLower.includes('oil') || typeLower.includes('chemical') || typeLower.includes('lpg') || typeLower.includes('crude')) {
    category = 'tanker';
  } else if (typeLower.includes('fishing') || typeLower.includes('trawl') || typeLower.includes('boat')) {
    category = 'fishing';
  } else if (typeLower.includes('tug') || typeLower.includes('supply') || typeLower.includes('workboat') || typeLower.includes('salvage')) {
    category = 'tug';
  } else if (typeLower.includes('patrol') || typeLower.includes('speed') || typeLower.includes('pilot') || typeLower.includes('yacht')) {
    category = 'patrol';
  } else {
    category = 'cargo';
  }

  // Build Procedural 3D Mesh for Category
  const buildVessel3D = (scene: THREE.Scene) => {
    // Clear existing
    if (vesselGroupRef.current) {
      scene.remove(vesselGroupRef.current);
    }

    const shipGroup = new THREE.Group();
    materialsRef.current = [];

    // Helper material creator
    const createMat = (color: number, roughness = 0.4, metalness = 0.2, emissive = 0x000000) => {
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        emissive,
        wireframe: wireframeMode,
      });
      materialsRef.current.push(mat);
      return mat;
    };

    // Shared Colors
    const darkNavyMat = createMat(0x0f172a, 0.5, 0.3);
    const oceanBlueMat = createMat(0x1d4ed8, 0.3, 0.4);
    const whiteHullMat = createMat(0xf8fafc, 0.2, 0.1);
    const graySteelMat = createMat(0x64748b, 0.5, 0.5);
    const darkSteelMat = createMat(0x334155, 0.6, 0.4);
    const redStripeMat = createMat(0xef4444, 0.3, 0.2);
    const darkRedBottomMat = createMat(0x991b1b, 0.4, 0.2);
    const amberDeckMat = createMat(0xd97706, 0.6, 0.1);
    const glassMat = createMat(0x38bdf8, 0.1, 0.9, 0x0369a1);
    const greenNavMat = createMat(0x22c55e, 0.1, 0.9, 0x15803d);
    const redNavMat = createMat(0xef4444, 0.1, 0.9, 0xb91c1c);
    const orangeLifeboatMat = createMat(0xf97316, 0.3, 0.1);

    // Build Specific Ship Type
    if (category === 'ferry') {
      // 1. PASSENGER SHIP / FERRY (e.g. Seatran Ferry)
      // Lower Hull (Deep Blue with Red Boot-topping)
      const hullGeo = new THREE.BoxGeometry(2.4, 0.7, 7.5);
      const hull = new THREE.Mesh(hullGeo, oceanBlueMat);
      hull.position.y = 0.35;
      shipGroup.add(hull);

      // Bulbous Bow / Bow Taper (Front wedge)
      const bowGeo = new THREE.ConeGeometry(1.2, 2.0, 4);
      const bow = new THREE.Mesh(bowGeo, oceanBlueMat);
      bow.rotation.x = -Math.PI / 2;
      bow.rotation.y = Math.PI / 4;
      bow.position.set(0, 0.35, 4.2);
      shipGroup.add(bow);

      // Waterline Red Stripe
      const stripeGeo = new THREE.BoxGeometry(2.45, 0.15, 7.6);
      const stripe = new THREE.Mesh(stripeGeo, darkRedBottomMat);
      stripe.position.y = 0.1;
      shipGroup.add(stripe);

      // Main Deck & Passenger Deck 1 (White superstructure)
      const deck1Geo = new THREE.BoxGeometry(2.3, 0.65, 6.2);
      const deck1 = new THREE.Mesh(deck1Geo, whiteHullMat);
      deck1.position.set(0, 1.0, 0.2);
      shipGroup.add(deck1);

      // Upper Lounge Deck 2
      const deck2Geo = new THREE.BoxGeometry(2.1, 0.6, 5.0);
      const deck2 = new THREE.Mesh(deck2Geo, whiteHullMat);
      deck2.position.set(0, 1.6, 0.2);
      shipGroup.add(deck2);

      // Navigation Bridge & Wheelhouse (Forward upper)
      const bridgeGeo = new THREE.BoxGeometry(2.2, 0.55, 1.4);
      const bridge = new THREE.Mesh(bridgeGeo, whiteHullMat);
      bridge.position.set(0, 2.15, 1.8);
      shipGroup.add(bridge);

      // Bridge Panoramic Windows
      const bridgeWinGeo = new THREE.BoxGeometry(2.22, 0.25, 0.6);
      const bridgeWin = new THREE.Mesh(bridgeWinGeo, glassMat);
      bridgeWin.position.set(0, 2.25, 2.15);
      shipGroup.add(bridgeWin);

      // Passenger Window Strips (Long Blue Glass Panes)
      const winStripGeo = new THREE.BoxGeometry(2.32, 0.22, 5.4);
      const winStrip1 = new THREE.Mesh(winStripGeo, glassMat);
      winStrip1.position.set(0, 1.05, 0.2);
      shipGroup.add(winStrip1);

      const winStripGeo2 = new THREE.BoxGeometry(2.12, 0.22, 4.4);
      const winStrip2 = new THREE.Mesh(winStripGeo2, glassMat);
      winStrip2.position.set(0, 1.65, 0.2);
      shipGroup.add(winStrip2);

      // Twin Funnels / Exhaust Stacks
      [-0.45, 0.45].forEach(xOffset => {
        const funnelGeo = new THREE.CylinderGeometry(0.2, 0.26, 0.8, 8);
        const funnel = new THREE.Mesh(funnelGeo, redStripeMat);
        funnel.position.set(xOffset, 2.2, -1.0);
        funnel.rotation.x = -0.2;
        shipGroup.add(funnel);

        const funnelCapGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.15, 8);
        const funnelCap = new THREE.Mesh(funnelCapGeo, darkNavyMat);
        funnelCap.position.set(xOffset, 2.6, -1.1);
        funnelCap.rotation.x = -0.2;
        shipGroup.add(funnelCap);
      });

      // Radar Mast
      const mastGeo = new THREE.CylinderGeometry(0.04, 0.06, 1.2, 6);
      const mast = new THREE.Mesh(mastGeo, whiteHullMat);
      mast.position.set(0, 2.9, 1.6);
      shipGroup.add(mast);

      // Radar Crossbar & Scanner
      const crossbarGeo = new THREE.BoxGeometry(0.8, 0.05, 0.05);
      const crossbar = new THREE.Mesh(crossbarGeo, whiteHullMat);
      crossbar.position.set(0, 3.2, 1.6);
      shipGroup.add(crossbar);

      const scannerGeo = new THREE.BoxGeometry(0.5, 0.08, 0.12);
      const scanner = new THREE.Mesh(scannerGeo, glassMat);
      scanner.position.set(0, 3.4, 1.6);
      shipGroup.add(scanner);

      // Lifeboats (Orange capsules on sides)
      [-1.15, 1.15].forEach(x => {
        [-0.5, 0.5].forEach(z => {
          const lifeboatGeo = new THREE.CapsuleGeometry(0.18, 0.6, 4, 8);
          const lifeboat = new THREE.Mesh(lifeboatGeo, orangeLifeboatMat);
          lifeboat.rotation.x = Math.PI / 2;
          lifeboat.position.set(x, 1.6, z);
          shipGroup.add(lifeboat);
        });
      });
    } else if (category === 'cargo') {
      // 2. CONTAINER / CARGO SHIP
      // Long Deep Hull
      const hullGeo = new THREE.BoxGeometry(2.2, 0.8, 8.4);
      const hull = new THREE.Mesh(hullGeo, darkSteelMat);
      hull.position.y = 0.4;
      shipGroup.add(hull);

      // Bulbous Bow Wedge
      const bowGeo = new THREE.ConeGeometry(1.1, 2.2, 4);
      const bow = new THREE.Mesh(bowGeo, darkRedBottomMat);
      bow.rotation.x = -Math.PI / 2;
      bow.rotation.y = Math.PI / 4;
      bow.position.set(0, 0.4, 4.8);
      shipGroup.add(bow);

      // Waterline Boot-topping
      const bootGeo = new THREE.BoxGeometry(2.24, 0.18, 8.5);
      const boot = new THREE.Mesh(bootGeo, darkRedBottomMat);
      boot.position.y = 0.15;
      shipGroup.add(boot);

      // Multi-colored Container Stacks
      const containerColors = [0x2563eb, 0x16a34a, 0xd97706, 0xdc2626, 0x0891b2, 0x4f46e5];
      const bayRows = 5;
      const bayCols = 2;
      const bayTiers = 3;

      for (let r = 0; r < bayRows; r++) {
        for (let c = 0; c < bayCols; c++) {
          for (let t = 0; t < bayTiers; t++) {
            const matIdx = (r * 3 + c * 2 + t) % containerColors.length;
            const containerMat = createMat(containerColors[matIdx], 0.6, 0.2);
            const containerGeo = new THREE.BoxGeometry(0.85, 0.45, 1.0);
            const container = new THREE.Mesh(containerGeo, containerMat);
            const xPos = c === 0 ? -0.48 : 0.48;
            const zPos = 2.4 - r * 1.15;
            const yPos = 0.85 + t * 0.46;
            container.position.set(xPos, yPos, zPos);
            shipGroup.add(container);
          }
        }
      }

      // Deck Cranes
      [-0.9, 1.3].forEach(z => {
        const craneBaseGeo = new THREE.CylinderGeometry(0.12, 0.15, 1.2, 6);
        const craneBase = new THREE.Mesh(craneBaseGeo, createMat(0xf59e0b, 0.4, 0.5));
        craneBase.position.set(0, 1.4, z);
        shipGroup.add(craneBase);

        const jibGeo = new THREE.BoxGeometry(0.1, 0.1, 1.6);
        const jib = new THREE.Mesh(jibGeo, createMat(0xf59e0b, 0.4, 0.5));
        jib.rotation.x = -0.3;
        jib.position.set(0, 2.2, z + 0.6);
        shipGroup.add(jib);
      });

      // Aft Superstructure Castle (Living Quarters & Bridge)
      const castleGeo = new THREE.BoxGeometry(1.8, 1.8, 1.4);
      const castle = new THREE.Mesh(castleGeo, whiteHullMat);
      castle.position.set(0, 1.7, -3.2);
      shipGroup.add(castle);

      // Castle Bridge Windows
      const bridgeWin = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.25, 0.8), glassMat);
      bridgeWin.position.set(0, 2.3, -3.0);
      shipGroup.add(bridgeWin);

      // Tall Funnel Stack
      const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.0, 8), redStripeMat);
      funnel.position.set(0, 2.9, -3.5);
      shipGroup.add(funnel);
    } else if (category === 'tanker') {
      // 3. OIL / CHEMICAL TANKER
      // Low Freeboard Long Hull
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.7, 8.2), darkSteelMat);
      hull.position.y = 0.35;
      shipGroup.add(hull);

      const bow = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.0, 4), darkSteelMat);
      bow.rotation.x = -Math.PI / 2;
      bow.rotation.y = Math.PI / 4;
      bow.position.set(0, 0.35, 4.6);
      shipGroup.add(bow);

      // Deck Pipelines & Manifolds
      [-0.4, 0, 0.4].forEach(x => {
        const pipeGeo = new THREE.CylinderGeometry(0.06, 0.06, 5.6, 6);
        const pipe = new THREE.Mesh(pipeGeo, graySteelMat);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(x, 0.8, 0.6);
        shipGroup.add(pipe);
      });

      // Midships Cargo Manifold Station
      const manifold = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.6), redStripeMat);
      manifold.position.set(0, 0.95, 0.6);
      shipGroup.add(manifold);

      // Forecastle Forward Store House
      const fwdHouse = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.0), whiteHullMat);
      fwdHouse.position.set(0, 0.9, 3.4);
      shipGroup.add(fwdHouse);

      // Aft Living Quarters & Wheelhouse
      const aftHouse = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.5, 1.6), whiteHullMat);
      aftHouse.position.set(0, 1.45, -2.8);
      shipGroup.add(aftHouse);

      const bridgeWin = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.25, 0.8), glassMat);
      bridgeWin.position.set(0, 1.9, -2.6);
      shipGroup.add(bridgeWin);

      const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.9, 8), darkNavyMat);
      funnel.position.set(0, 2.4, -3.2);
      shipGroup.add(funnel);
    } else if (category === 'fishing') {
      // 4. FISHING TRAWLER
      // Flared Green/White Hull
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 5.8), createMat(0x047857, 0.4, 0.3));
      hull.position.y = 0.37;
      shipGroup.add(hull);

      const bow = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.8, 4), createMat(0x047857, 0.4, 0.3));
      bow.rotation.x = -Math.PI / 2;
      bow.rotation.y = Math.PI / 4;
      bow.position.set(0, 0.4, 3.2);
      shipGroup.add(bow);

      // Forward Superstructure Wheelhouse
      const house = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.6), whiteHullMat);
      house.position.set(0, 1.25, 1.2);
      shipGroup.add(house);

      const win = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.3, 0.9), glassMat);
      win.position.set(0, 1.5, 1.4);
      shipGroup.add(win);

      // Aft Trawling A-Frame Gantry Rig
      const gantryPillarMat = createMat(0xf59e0b, 0.4, 0.6);
      [-0.75, 0.75].forEach(x => {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 6), gantryPillarMat);
        pillar.position.set(x, 1.4, -2.0);
        pillar.rotation.x = 0.15;
        shipGroup.add(pillar);
      });
      const topBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), gantryPillarMat);
      topBeam.rotation.z = Math.PI / 2;
      topBeam.position.set(0, 2.2, -1.8);
      shipGroup.add(topBeam);

      // Net Drum Spool on Aft Deck
      const netDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 12), createMat(0x065f46, 0.7, 0.1));
      netDrum.rotation.z = Math.PI / 2;
      netDrum.position.set(0, 0.95, -0.8);
      shipGroup.add(netDrum);
    } else if (category === 'tug') {
      // 5. TUGBOAT
      // Heavy Compact Yellow/Black Hull
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 4.6), createMat(0xb45309, 0.4, 0.3));
      hull.position.y = 0.4;
      shipGroup.add(hull);

      // Bow Rubber Bumper Ring (Torus)
      const bumper = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.22, 8, 16, Math.PI), darkNavyMat);
      bumper.rotation.x = Math.PI / 2;
      bumper.position.set(0, 0.45, 2.1);
      shipGroup.add(bumper);

      // Elevated Panoramic Pilot House
      const pilotHouse = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 1.1, 8), createMat(0xfef08a, 0.3, 0.2));
      pilotHouse.position.set(0, 1.3, 0.3);
      shipGroup.add(pilotHouse);

      // 360 Glass Windows
      const win = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.35, 8), glassMat);
      win.position.set(0, 1.5, 0.3);
      shipGroup.add(win);

      // Twin Exhaust Stacks
      [-0.4, 0.4].forEach(x => {
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.9, 8), redStripeMat);
        stack.position.set(x, 1.9, -0.4);
        shipGroup.add(stack);
      });

      // Heavy Towing Winch on Aft Deck
      const winch = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 10), darkSteelMat);
      winch.rotation.z = Math.PI / 2;
      winch.position.set(0, 0.9, -1.2);
      shipGroup.add(winch);
    } else {
      // 6. PATROL / HIGH SPEED CRAFT
      // Sharp Deep-V Hull
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 5.4), darkNavyMat);
      hull.position.y = 0.3;
      shipGroup.add(hull);

      const bow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 4), darkNavyMat);
      bow.rotation.x = -Math.PI / 2;
      bow.rotation.y = Math.PI / 4;
      bow.position.set(0, 0.3, 3.2);
      shipGroup.add(bow);

      // Swept Aerodynamic Cabin
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 2.0), whiteHullMat);
      cabin.position.set(0, 0.9, 0.2);
      shipGroup.add(cabin);

      const win = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.3, 1.2), glassMat);
      win.position.set(0, 1.05, 0.4);
      shipGroup.add(win);

      // Radar Arch
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.08, 6, 12, Math.PI), whiteHullMat);
      arch.position.set(0, 1.25, -0.7);
      arch.rotation.y = Math.PI / 2;
      shipGroup.add(arch);
    }

    // Standard Navigation Light Positions (Port Red, Starboard Green, Mast White)
    const portLight = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), redNavMat);
    portLight.position.set(-1.15, 1.8, 1.2);
    shipGroup.add(portLight);

    const stbdLight = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), greenNavMat);
    stbdLight.position.set(1.15, 1.8, 1.2);
    shipGroup.add(stbdLight);

    // Subtle Ocean Water Surface Disc with Grid Shader
    const oceanGeo = new THREE.CylinderGeometry(5.8, 5.8, 0.08, 32);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      metalness: 0.8,
    });
    materialsRef.current.push(oceanMat);
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.position.y = 0.04;
    shipGroup.add(ocean);

    // Grid wire helper on water plane
    const grid = new THREE.PolarGridHelper(5.6, 8, 4, 32, 0x38bdf8, 0x0369a1);
    grid.position.y = 0.08;
    shipGroup.add(grid);

    vesselGroupRef.current = shipGroup;
    scene.add(shipGroup);
  };

  // Initialize Three.js WebGL Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const width = container.clientWidth || 320;
    const height = container.clientHeight || 180;
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(6.5, 4.2, 7.5);
    camera.lookAt(0, 0.8, 0);
    cameraRef.current = camera;

    // 3. Renderer with antialias and alpha
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 1.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
    sunLight.position.set(8, 12, 6);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    rimLight.position.set(-8, 6, -6);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0x0284c7, 1.0, 15);
    fillLight.position.set(0, -2, 0);
    scene.add(fillLight);

    // 5. Build 3D Vessel
    buildVessel3D(scene);

    // 6. Animation / Render Loop
    let previousTime = performance.now();
    const animate = (time: number) => {
      const delta = (time - previousTime) / 1000;
      previousTime = time;

      if (vesselGroupRef.current) {
        // Gentle wave bobbing motion
        const bob = Math.sin(time * 0.002) * 0.06;
        const roll = Math.sin(time * 0.0015) * 0.025;
        vesselGroupRef.current.position.y = bob;
        vesselGroupRef.current.rotation.z = roll;

        // Auto-rotation turntable
        if (isRotating && !isInteracting) {
          vesselGroupRef.current.rotation.y += delta * 0.45;
        }
      }

      renderer.render(scene, camera);
      animFrameIdRef.current = requestAnimationFrame(animate);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // 7. Responsive Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });

    resizeObserver.observe(container);

    // Cleanup on unmount
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [shipType, wireframeMode]);

  // Update wireframe mode on materials
  useEffect(() => {
    materialsRef.current.forEach((mat) => {
      if ('wireframe' in mat) {
        (mat as THREE.MeshStandardMaterial).wireframe = wireframeMode;
      }
    });
  }, [wireframeMode]);

  // Interactive mouse / touch drag rotation controls
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsInteracting(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const initialRotY = vesselGroupRef.current?.rotation.y || 0;

    const handlePointerMove = (moveEvt: PointerEvent) => {
      if (!vesselGroupRef.current) return;
      const dx = moveEvt.clientX - startX;
      vesselGroupRef.current.rotation.y = initialRotY + dx * 0.01;
    };

    const handlePointerUp = () => {
      setIsInteracting(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Reset Camera & Rotation
  const handleResetView = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (vesselGroupRef.current) {
      vesselGroupRef.current.rotation.y = 0.5;
    }
  };

  return (
    <div
      className={`relative w-full h-full bg-gradient-to-b from-slate-950 via-slate-900 to-cyan-950/80 overflow-hidden flex flex-col justify-between p-2 select-none group ${className}`}
      onPointerDown={handlePointerDown}
      style={{ cursor: isInteracting ? 'grabbing' : 'grab' }}
    >
      {/* 3D Blueprint Canvas Viewport */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Top HUD Ribbon */}
      <div className="relative z-10 flex items-center justify-between pointer-events-none text-[9px] font-mono">
        <div className="flex items-center gap-1.5 text-cyan-300 bg-slate-950/85 border border-cyan-500/40 px-2 py-0.5 rounded-md backdrop-blur-md shadow-md">
          <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span className="font-bold tracking-wide uppercase">3D REAL-TIME MODEL</span>
        </div>

        {/* Interactive 3D HUD Tool Buttons */}
        <div className="flex items-center gap-1 pointer-events-auto">
          <button
            id={`btn-toggle-rotate-${mmsi}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsRotating(!isRotating);
            }}
            className={`p-1 rounded border transition cursor-pointer backdrop-blur-md ${
              isRotating
                ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500/60'
                : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title={isRotating ? 'Pause 3D Auto-Rotation' : 'Resume 3D Auto-Rotation'}
          >
            <RotateCw className={`w-3 h-3 ${isRotating ? 'animate-spin' : ''}`} />
          </button>

          <button
            id={`btn-toggle-wireframe-${mmsi}`}
            onClick={(e) => {
              e.stopPropagation();
              setWireframeMode(!wireframeMode);
            }}
            className={`p-1 rounded border transition cursor-pointer backdrop-blur-md ${
              wireframeMode
                ? 'bg-amber-950/90 text-amber-300 border-amber-500/60'
                : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title={wireframeMode ? 'Shaded 3D Mesh' : 'Wireframe 3D Mesh'}
          >
            <Layers className="w-3 h-3" />
          </button>

          <button
            id={`btn-reset-3d-${mmsi}`}
            onClick={handleResetView}
            className="p-1 rounded border bg-slate-900/80 text-slate-400 hover:text-white border-slate-700 hover:bg-slate-800 transition cursor-pointer backdrop-blur-md"
            title="Reset 3D Angle"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Bottom Technical Specifications HUD */}
      <div className="relative z-10 flex items-center justify-between text-[9px] font-mono text-slate-300 pt-1 border-t border-slate-800/80 bg-slate-950/75 px-2 py-0.5 rounded backdrop-blur-md pointer-events-none">
        <div className="flex items-center gap-1.5 truncate max-w-[130px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-semibold text-cyan-200 truncate">{vesselName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">MMSI: <strong className="text-cyan-300">{mmsi}</strong></span>
          {grossTonnage && <span className="text-slate-300 font-semibold">{grossTonnage.toLocaleString()} GRT</span>}
        </div>
      </div>
    </div>
  );
};
