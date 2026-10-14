/**
 * Minecraft JS - Engine em Three.js
 * Injeta o jogo dentro da div `#game-container` ou `document.body`
 */

(function () {
  // 1. Configuração de Container e Tela
  const container = document.getElementById('game-container') || document.body;
  
  // Criar interface de UI / HUD por cima do Canvas
  const hud = document.createElement('div');
  hud.style.cssText = `
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    pointer-events: none; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    user-select: none; box-sizing: border-box;
  `;

  // Mira no centro da tela
  const crosshair = document.createElement('div');
  crosshair.style.cssText = `
    position: absolute; top: 50%; left: 50%; width: 12px; height: 12px;
    transform: translate(-50%, -50%); color: rgba(255, 255, 255, 0.8);
    font-size: 20px; font-weight: bold; line-height: 12px; text-align: center;
  `;
  crosshair.innerText = '+';
  hud.appendChild(crosshair);

  // Overlay de Início
  const blocker = document.createElement('div');
  blocker.style.cssText = `
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.6); display: flex; flex-direction: column;
    justify-content: center; align-items: center; color: white;
    cursor: pointer; pointer-events: auto; z-index: 10;
  `;
  blocker.innerHTML = `
    <h1 style="margin:0 0 10px 0; font-size: 28px; text-shadow: 2px 2px #000;">MINECRAFT JS</h1>
    <p style="margin: 5px 0;">Clique aqui para jogar</p>
    <p style="font-size: 12px; opacity: 0.8;">WASD: Mover | Espaço: Pular | Scroll / 1-5: Selecionar Bloco<br>Clique Esquerdo: Destruir | Clique Direito: Construir</p>
    <button id="btn-fullscreen" style="margin-top: 15px; padding: 8px 16px; background: #555; color: white; border: 1px solid #fff; cursor: pointer; border-radius: 4px;">Tela Cheia (Fullscreen)</button>
  `;
  hud.appendChild(blocker);

  // Hotbar (Seleção de Blocos)
  const hotbar = document.createElement('div');
  hotbar.style.cssText = `
    position: absolute; bottom: 15px; left: 50%; transform: translateX(-50%);
    display: flex; gap: 6px; background: rgba(0, 0, 0, 0.5); padding: 6px;
    border-radius: 6px; border: 2px solid #555;
  `;
  
  const blockTypes = [
    { id: 1, name: 'Grama', color: 0x557a2b },
    { id: 2, name: 'Terra', color: 0x6e4a27 },
    { id: 3, name: 'Pedra', color: 0x7d7d7d },
    { id: 4, name: 'Madeira', color: 0x4a3219 },
    { id: 5, name: 'Folhas', color: 0x2e5c1e }
  ];

  let selectedBlockIndex = 0;

  blockTypes.forEach((block, index) => {
    const slot = document.createElement('div');
    slot.id = `slot-${index}`;
    slot.style.cssText = `
      width: 40px; height: 40px; background-color: #${block.color.toString(16).padStart(6, '0')};
      border: ${index === 0 ? '3px solid #fff' : '2px solid #333'};
      box-sizing: border-box; display: flex; align-items: center; justify-content: center;
      color: white; font-size: 12px; font-weight: bold; text-shadow: 1px 1px 2px #000;
    `;
    slot.innerText = index + 1;
    hotbar.appendChild(slot);
  });
  hud.appendChild(hotbar);
  container.appendChild(hud);

  // 2. Configuração de Cena Three.js
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Cor do céu
  scene.fog = new THREE.FogExp2(0x87ceeb, 0.025);

  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // Iluminação
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
  dirLight.position.set(50, 80, 30);
  dirLight.castShadow = true;
  scene.add(dirLight);

  // 3. Estrutura do Mundo e Materiais
  const BLOCK_SIZE = 1;
  const blocksMap = new Map(); // Guarda a posição dos blocos ex: "x,y,z" => mesh

  const materials = {};
  blockTypes.forEach(b => {
    materials[b.id] = new THREE.MeshLambertMaterial({ color: b.color });
  });

  const blockGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

  function getPosKey(x, y, z) {
    return `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
  }

  function addBlock(x, y, z, typeId) {
    const key = getPosKey(x, y, z);
    if (blocksMap.has(key)) return;

    const mesh = new THREE.Mesh(blockGeometry, materials[typeId]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    blocksMap.set(key, { mesh, typeId });
  }

  function removeBlock(x, y, z) {
    const key = getPosKey(x, y, z);
    if (blocksMap.has(key)) {
      const { mesh } = blocksMap.get(key);
      scene.remove(mesh);
      mesh.geometry.dispose();
      blocksMap.delete(key);
    }
  }

  // Gerar Terreno Simples
  const WORLD_SIZE = 24;
  for (let x = -WORLD_SIZE/2; x < WORLD_SIZE/2; x++) {
    for (let z = -WORLD_SIZE/2; z < WORLD_SIZE/2; z++) {
      // Simular relevo
      const height = Math.floor(Math.sin(x * 0.2) * 2 + Math.cos(z * 0.2) * 2);
      
      // Camada de Grama
      addBlock(x, height, z, 1);
      
      // Camada de Terra
      for (let y = height - 1; y >= height - 2; y--) {
        addBlock(x, y, z, 2);
      }
      // Camada de Pedra abaixo
      for (let y = height - 3; y >= -4; y--) {
        addBlock(x, y, z, 3);
      }

      // Árvores aleatórias
      if (Math.random() < 0.02 && Math.abs(x) > 3 && Math.abs(z) > 3) {
        const treeH = 4;
        for (let th = 1; th <= treeH; th++) {
          addBlock(x, height + th, z, 4); // Tronco
        }
        // Copa das Folhas
        for (let lx = -1; lx <= 1; lx++) {
          for (let lz = -1; lz <= 1; lz++) {
            for (let ly = treeH; ly <= treeH + 2; ly++) {
              if (lx === 0 && lz === 0 && ly === treeH) continue;
              addBlock(x + lx, height + ly, z + lz, 5);
            }
          }
        }
      }
    }
  }

  // 4. Jogador e Física
  const player = {
    position: new THREE.Vector3(0, 5, 0),
    velocity: new THREE.Vector3(),
    onGround: false,
    height: 1.6,
    speed: 0.1,
    jumpForce: 0.15,
    gravity: 0.007
  };

  camera.position.copy(player.position);

  // 5. Controles de Movimento do Mouse (First Person)
  let isLocked = false;
  let yaw = 0;
  let pitch = 0;

  blocker.addEventListener('click', (e) => {
    if (e.target.id === 'btn-fullscreen') {
      toggleFullscreen();
      return;
    }
    renderer.domElement.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === renderer.domElement) {
      isLocked = true;
      blocker.style.display = 'none';
    } else {
      isLocked = false;
      blocker.style.display = 'flex';
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!isLocked) return;

    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;

    pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));

    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.x = pitch;
    euler.y = yaw;
    camera.quaternion.setFromNonZeroRotation(euler);
  });

  // Teclado
  const keys = {};
  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    // Números 1 a 5 para trocar slot
    if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(e.code)) {
      selectSlot(parseInt(e.code.replace('Digit', '')) - 1);
    }
  });
  document.addEventListener('keyup', (e) => keys[e.code] = false);

  // Scroll do Mouse para Hotbar
  window.addEventListener('wheel', (e) => {
    if (!isLocked) return;
    if (e.deltaY > 0) {
      selectSlot((selectedBlockIndex + 1) % blockTypes.length);
    } else {
      selectSlot((selectedBlockIndex - 1 + blockTypes.length) % blockTypes.length);
    }
  });

  function selectSlot(index) {
    document.getElementById(`slot-${selectedBlockIndex}`).style.border = '2px solid #333';
    selectedBlockIndex = index;
    document.getElementById(`slot-${selectedBlockIndex}`).style.border = '3px solid #fff';
  }

  // 6. Interação com Blocos (Quebrar / Colocar)
  const raycaster = new THREE.Raycaster();
  
  window.addEventListener('mousedown', (e) => {
    if (!isLocked) return;

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(scene.children);

    if (intersects.length > 0 && intersects[0].distance <= 6) {
      const hit = intersects[0];
      
      if (e.button === 0) { // Botão Esquerdo: Quebrar Bloco
        const p = hit.object.position;
        removeBlock(p.x, p.y, p.z);
      } else if (e.button === 2) { // Botão Direito: Colocar Bloco
        const p = hit.object.position.clone().add(hit.face.normal);
        // Evitar colocar bloco dentro da própria câmera
        if (p.distanceTo(player.position) > 1.2) {
          addBlock(p.x, p.y, p.z, blockTypes[selectedBlockIndex].id);
        }
      }
    }
  });

  // Prevenir menu de contexto com botão direito
  window.addEventListener('contextmenu', e => e.preventDefault());

  // 7. Tela Cheia (Fullscreen)
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (container.requestFullscreen) container.requestFullscreen();
      else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  }

  // Redimensionamento de Tela
  window.addEventListener('resize', onResize);
  document.addEventListener('fullscreenchange', onResize);

  function onResize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  // 8. Loop de Animação e Atualização de Física
  function updatePhysics() {
    if (!isLocked) return;

    // Vetores de Direção
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0; forward.normalize();

    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    side.y = 0; side.normalize();

    // Controles de Movimento
    const moveDir = new THREE.Vector3();
    if (keys['KeyW']) moveDir.add(forward);
    if (keys['KeyS']) moveDir.sub(forward);
    if (keys['KeyD']) moveDir.add(side);
    if (keys['KeyA']) moveDir.sub(side);
    moveDir.normalize();

    player.velocity.x = moveDir.x * player.speed;
    player.velocity.z = moveDir.z * player.speed;

    // Gravidade e Pulo
    player.velocity.y -= player.gravity;

    if (keys['Space'] && player.onGround) {
      player.velocity.y = player.jumpForce;
      player.onGround = false;
    }

    // Aplicação das Posições com Checagem Simples de Solo
    player.position.x += player.velocity.x;
    player.position.z += player.velocity.z;
    player.position.y += player.velocity.y;

    // Colisão simples de chão com blocos
    const blockBelowKey = getPosKey(
      player.position.x,
      player.position.y - player.height,
      player.position.z
    );

    if (blocksMap.has(blockBelowKey)) {
      const blockY = Math.round(player.position.y - player.height);
      player.position.y = blockY + 0.5 + player.height;
      player.velocity.y = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }

    // Limite de queda para resetar posição se cair no vácuo
    if (player.position.y < -20) {
      player.position.set(0, 10, 0);
      player.velocity.set(0, 0, 0);
    }

    camera.position.copy(player.position);
  }

  function animate() {
    requestAnimationFrame(animate);
    updatePhysics();
    renderer.render(scene, camera);
  }

  animate();
})();