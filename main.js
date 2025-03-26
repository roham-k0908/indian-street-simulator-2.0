// Game constants
const LANE_WIDTH = 5;
const ROAD_WIDTH = LANE_WIDTH * 3; // 3 lanes
const ROAD_LENGTH = 1000;
const PLAYER_SPEED = 0.8;
const PLAYER_LATERAL_SPEED = 0.2;
const TRAFFIC_SPAWN_RATE = 0.02; // Chance per frame
const POTHOLE_SPAWN_RATE = 0.01; // Chance per frame
const SCORE_RATE = 0.1; // Points per frame

// Physics constants
const MAX_SPEED = 0.7;          // Maximum speed (drastically reduced from 1.4)
const ACCELERATION = 0.008;     // Acceleration rate (drastically reduced from 0.015)
const BRAKE_POWER = 0.016;      // Braking power (adjusted for balance)
const FRICTION = 0.003;         // Road friction (reduced for smoother deceleration)
const STEERING_SENSITIVITY = 0.04; // How quickly the car responds to steering input
const STEERING_RETURN = 0.02;   // How quickly steering returns to center
const WEIGHT_TRANSFER = 0.02;   // Effect of weight transfer during turning
const TILT_FACTOR = 0.1;        // How much the car tilts during turns
const SUSPENSION_STIFFNESS = 0.2; // How stiff the suspension is
const GRAVITY = 0.01;           // Gravity effect for suspension

// Game variables
let score = 0;
let gameOver = false;
let isAnimating = false;
let gameInitialized = false;

// Car physics state
let currentSpeed = 0;           // Current forward speed
let targetSpeed = 0;            // Target speed (based on input)
let steeringAngle = 0;          // Current steering angle
let targetSteeringAngle = 0;    // Target steering angle (based on input)
let carTilt = 0;                // Current car body tilt (for visual effect)
let suspensionHeight = 0;       // Current suspension compression
let suspensionVelocity = 0;     // Suspension movement velocity
let accelerating = false;       // Is the player pressing accelerate?
let braking = false;            // Is the player pressing brake?

// Scene elements
let scene, camera, renderer, container;
let playerCar, road, directionalLight;
let playerLane = 0, playerPosition = 0;
let leftKeyPressed = false, rightKeyPressed = false;
let traffic = [], potholes = [];
let buildings = [], roadObjects = [];

// Sound effects
let hornSound, crashSound, backgroundSound, engineSound;

// Function to get lane position
function getLanePosition(lane) {
    return lane * LANE_WIDTH;
}

// Initialize the game
function initializeGame() {
    if (gameInitialized) return; // Prevent multiple initializations
    
    console.log('Initializing game...');
    gameInitialized = true;
    
    // Initialize scene with daytime sky color
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Light blue sky
    
    // Light fog for daytime
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.002); // Reduced fog density for daytime
    
    // Initialize camera with a chase view position
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, -10); // Position camera behind where car will be
    camera.lookAt(0, 0, 10); // Look forward down the road
    
    // Create container for the canvas
    container = document.createElement('div');
    container.id = 'game-container';
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '1';
    document.body.appendChild(container);
    
    // Initialize renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    
    // Add bright ambient light for daytime
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Bright white ambient light
    scene.add(ambientLight);
    
    // Add sunlight (directional light)
    directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Bright sunlight
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    
    // Set up shadow properties
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);
    
    // Create road
    createRoad();
    
    // Create player car
    createPlayerCar();
    
    // Add event listeners
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onWindowResize);
    
    // Load sound effects
    loadSounds();
    
    // Add buildings and roadside elements
    createEnvironment();
    
    // Set initial car position
    playerCar.position.z = 0;
    
    console.log('Game initialized successfully');
}

// Create the road - update for daytime lighting
function createRoad() {
    // Road base - much longer road since the car is actually moving on it
    const roadGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH * 5);
    const roadMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x444444, // Medium-dark gray for daytime
        roughness: 0.9,
        metalness: 0.1
    });
    
    road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.z = ROAD_LENGTH * 2.5; // Position it further ahead
    road.receiveShadow = true;
    scene.add(road);
    
    // Add center line - normal visibility for daytime
    const centerLineMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffeb3b, // Yellow
        emissive: 0, // No emissive needed for daytime
        emissiveIntensity: 0
    });
    const centerLineGeometry = new THREE.PlaneGeometry(0.25, ROAD_LENGTH * 5);
    const centerLine = new THREE.Mesh(centerLineGeometry, centerLineMaterial);
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.set(0, 0.02, ROAD_LENGTH * 2.5);
    scene.add(centerLine);
    
    // Add dashed white side lines - normal for daytime
    const dashLength = 3;
    const dashGap = 2;
    const dashesCount = Math.floor((ROAD_LENGTH * 5) / (dashLength + dashGap));
    const lineMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        emissive: 0, // No emissive needed for daytime
        emissiveIntensity: 0
    });
    
    for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < dashesCount; i++) {
            const dashZ = i * (dashLength + dashGap);
            const lineGeometry = new THREE.PlaneGeometry(0.15, dashLength);
            const line = new THREE.Mesh(lineGeometry, lineMaterial);
            line.rotation.x = -Math.PI / 2;
            line.position.set(side * LANE_WIDTH, 0.02, dashZ);
            scene.add(line);
        }
    }
    
    // Add sidewalks - lighter for daytime
    const sidewalkWidth = 2;
    const sidewalkGeometry = new THREE.BoxGeometry(sidewalkWidth, 0.3, ROAD_LENGTH * 5);
    const sidewalkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x999999, // Light gray for daytime
        roughness: 0.9
    });
    
    for (let side = -1; side <= 1; side += 2) {
        if (side === 0) continue; // Skip middle
        
        const sidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
        sidewalk.position.set(
            side * (ROAD_WIDTH / 2 + sidewalkWidth / 2),
            0.15,
            ROAD_LENGTH * 2.5
        );
        sidewalk.receiveShadow = true;
        sidewalk.castShadow = true;
        scene.add(sidewalk);
    }
}

// Create player car
function createPlayerCar() {
    playerCar = createCar(0xff0000, true);
    playerCar.position.y = 0;
    playerCar.position.z = -5;
    scene.add(playerCar);
}

// Create a car - update for daytime without night headlights
function createCar(color = 0xff0000, isPlayer = false, variant = 0) {
    const car = new THREE.Group();
    
    // Car body
    const bodyGeometry = new THREE.BoxGeometry(2, 1, 4);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: color,
        metalness: 0.3, // Less metallic for daytime
        roughness: 0.5
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    car.add(body);
    
    // Car top
    const topGeometry = new THREE.BoxGeometry(1.8, 0.8, 2);
    const topMaterial = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(color).multiplyScalar(0.8), // Slightly darker top
        metalness: 0.2,
        roughness: 0.8
    });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.set(0, 1.4, -0.2);
    top.castShadow = true;
    top.receiveShadow = true;
    car.add(top);
    
    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const wheelPositions = [
        [-0.9, 0, -1.2],
        [0.9, 0, -1.2],
        [-0.9, 0, 1.2],
        [0.9, 0, 1.2]
    ];
    
    wheelPositions.forEach(position => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(...position);
        wheel.castShadow = true;
        car.add(wheel);
    });
    
    // Simplified headlights and taillights for daytime
    if (isPlayer) {
        // Headlights - non-emissive for daytime
        for (let side = -1; side <= 1; side += 2) {
            const headlightGeometry = new THREE.CircleGeometry(0.2, 16);
            const headlightMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xffffee,
                emissive: 0, // No emission for daytime
                emissiveIntensity: 0
            });
            
            const headlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
            headlight.position.set(
                side * 0.7,
                0.5,
                2
            );
            headlight.rotation.y = Math.PI;
            car.add(headlight);
            
            // No spotlights needed for daytime
        }
        
        // Taillights - non-emissive for daytime
        for (let side = -1; side <= 1; side += 2) {
            const tailLightGeometry = new THREE.CircleGeometry(0.15, 16);
            const tailLightMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xff0000,
                emissive: 0, // No emission for daytime
                emissiveIntensity: 0
            });
            
            const tailLight = new THREE.Mesh(tailLightGeometry, tailLightMaterial);
            tailLight.position.set(
                side * 0.7,
                0.5,
                -2
            );
            car.add(tailLight);
            
            // No taillight glow needed for daytime
        }
    } else {
        // Simple headlights and taillights for AI traffic
        for (let side = -1; side <= 1; side += 2) {
            const headlightGeometry = new THREE.CircleGeometry(0.2, 16);
            const headlightMaterial = new THREE.MeshStandardMaterial({ color: 0xffffee });
            
            const headlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
            headlight.position.set(
                side * 0.7,
                0.5,
                2
            );
            headlight.rotation.y = Math.PI;
            car.add(headlight);
        }
        
        // Taillights
        for (let side = -1; side <= 1; side += 2) {
            const tailLightGeometry = new THREE.CircleGeometry(0.15, 16);
            const tailLightMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
            
            const tailLight = new THREE.Mesh(tailLightGeometry, tailLightMaterial);
            tailLight.position.set(
                side * 0.7,
                0.5,
                -2
            );
            car.add(tailLight);
        }
    }
    
    return car;
}

// Create environment (buildings, trees, etc.)
function createEnvironment() {
    // Buildings on both sides - distribute along the entire road
    const buildingCount = 100; // More buildings for a longer road
    const buildingMaterials = [
        new THREE.MeshStandardMaterial({ color: 0xd3b488 }), // Tan
        new THREE.MeshStandardMaterial({ color: 0xb35c44 }), // Terracotta
        new THREE.MeshStandardMaterial({ color: 0x53868b }), // Teal
        new THREE.MeshStandardMaterial({ color: 0x7c8a5e }), // Olive
        new THREE.MeshStandardMaterial({ color: 0x8e8e8e }), // Gray
        new THREE.MeshStandardMaterial({ color: 0xe3c0a8 })  // Beige
    ];
    
    // Calculate building spacing along the road
    const roadHalfLength = ROAD_LENGTH * 2.5;
    const buildingSpacing = (roadHalfLength * 2) / buildingCount;
    
    for (let i = 0; i < buildingCount; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const height = 5 + Math.random() * 15;
        const width = 5 + Math.random() * 10;
        const depth = 5 + Math.random() * 10;
        
        // Building body
        const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
        const buildingMaterial = buildingMaterials[Math.floor(Math.random() * buildingMaterials.length)];
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        
        // Position along the road
        const zPosition = -roadHalfLength + (i * buildingSpacing) + Math.random() * 20;
        
        building.position.set(
            side * (ROAD_WIDTH / 2 + 3 + Math.random() * 8),
            height / 2,
            zPosition
        );
        
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        buildings.push(building);
        
        // Add windows - daytime version (no lights)
        const windowRows = Math.floor(height / 2.5);
        const windowCols = Math.floor(width / 2);
        
        for (let row = 0; row < windowRows; row++) {
            for (let col = 0; col < windowCols; col++) {
                // Skip some windows for variation
                if (Math.random() < 0.3) continue;
                
                const windowGeometry = new THREE.PlaneGeometry(1, 1.5);
                const windowMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0x88ccff, // Blue windows for daytime
                    metalness: 0.8,
                    roughness: 0.2
                });
                const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial);
                
                // Position on building face
                windowMesh.position.set(
                    (col - windowCols / 2 + 0.5) * 2,
                    (row - windowRows / 2 + 0.5) * 2.5 + 1,
                    depth / 2 + 0.1
                );
                
                building.add(windowMesh);
                
                // No window lights needed for daytime
            }
        }
    }
    
    // Add street vendors - daytime version
    const vendorCount = 60; // More vendors for a longer road
    const vendorSpacing = (roadHalfLength * 2) / vendorCount;
    
    for (let i = 0; i < vendorCount; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        
        // Create vendor stall
        const stallGeometry = new THREE.BoxGeometry(3, 2, 2);
        const stallMaterial = new THREE.MeshStandardMaterial({ 
            color: [0x8B4513, 0x556B2F, 0x5F9EA0][Math.floor(Math.random() * 3)] // Brown, green, blue
        });
        const stall = new THREE.Mesh(stallGeometry, stallMaterial);
        
        // Position along the road
        const zPosition = -roadHalfLength + (i * vendorSpacing) + Math.random() * 10;
        
        stall.position.set(
            side * (ROAD_WIDTH / 2 + 2.5),
            1,
            zPosition
        );
        
        stall.castShadow = true;
        stall.receiveShadow = true;
        scene.add(stall);
        roadObjects.push(stall);
        
        // Add umbrellas or awnings
        if (Math.random() < 0.7) {
            const awningGeometry = new THREE.ConeGeometry(2, 1, 8);
            const awningMaterial = new THREE.MeshStandardMaterial({ 
                color: [0xE25822, 0x4682B4, 0x228B22][Math.floor(Math.random() * 3)]
            });
            const awning = new THREE.Mesh(awningGeometry, awningMaterial);
            awning.position.y = 2.5;
            stall.add(awning);
        }
    }
    
    // Add street lamps along the road (no lights for daytime)
    const lampCount = 80;
    const lampSpacing = (roadHalfLength * 2) / lampCount;
    
    for (let i = 0; i < lampCount; i++) {
        // Alternate sides
        const side = i % 2 === 0 ? 1 : -1;
        
        // Create lamp post
        const postGeometry = new THREE.CylinderGeometry(0.1, 0.15, 5, 8);
        const postMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const post = new THREE.Mesh(postGeometry, postMaterial);
        
        // Position along the road
        const zPosition = -roadHalfLength + (i * lampSpacing);
        post.position.set(
            side * (ROAD_WIDTH / 2 + 1),
            2.5,
            zPosition
        );
        post.castShadow = true;
        post.receiveShadow = true;
        scene.add(post);
        roadObjects.push(post);
        
        // Add lamp head
        const lampHeadGeometry = new THREE.BoxGeometry(0.6, 0.3, 0.6);
        const lampHeadMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const lampHead = new THREE.Mesh(lampHeadGeometry, lampHeadMaterial);
        lampHead.position.y = 2.5;
        post.add(lampHead);
        
        // Add light bulb - non-emissive for daytime
        const bulbGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const bulbMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffee,
            emissive: 0,
            emissiveIntensity: 0
        });
        const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
        bulb.position.y = -0.1;
        lampHead.add(bulb);
        
        // No street lights needed for daytime
    }
    
    // Add some trees, bushes and decorations for daytime scene
    const decorationCount = 100;
    const decorationSpacing = (roadHalfLength * 2) / decorationCount;
    
    for (let i = 0; i < decorationCount; i++) {
        // Alternate sides
        const side = i % 2 === 0 ? 1 : -1;
        
        if (Math.random() < 0.4) {
            // Create a tree
            const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
            const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            
            // Position along the road
            const zPosition = -roadHalfLength + (i * decorationSpacing) + Math.random() * 15;
            trunk.position.set(
                side * (ROAD_WIDTH / 2 + 5 + Math.random() * 3),
                1, // Half height
                zPosition
            );
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            scene.add(trunk);
            roadObjects.push(trunk);
            
            // Add foliage
            const foliageGeometry = new THREE.SphereGeometry(1.5, 8, 8);
            const foliageMaterial = new THREE.MeshStandardMaterial({ 
                color: [0x228B22, 0x006400, 0x32CD32][Math.floor(Math.random() * 3)] // Different greens
            });
            const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
            foliage.position.y = 2;
            foliage.castShadow = true;
            trunk.add(foliage);
        } else {
            // Create a bush
            const bushGeometry = new THREE.SphereGeometry(0.7 + Math.random() * 0.5, 8, 8);
            const bushMaterial = new THREE.MeshStandardMaterial({ 
                color: [0x228B22, 0x006400, 0x32CD32][Math.floor(Math.random() * 3)] // Different greens
            });
            const bush = new THREE.Mesh(bushGeometry, bushMaterial);
            
            // Position along the road
            const zPosition = -roadHalfLength + (i * decorationSpacing) + Math.random() * 15;
            bush.position.set(
                side * (ROAD_WIDTH / 2 + 4 + Math.random() * 4),
                0.7, // Half height
                zPosition
            );
            bush.castShadow = true;
            bush.receiveShadow = true;
            scene.add(bush);
            roadObjects.push(bush);
        }
    }
}

// Create a pothole
function createPothole() {
    const group = new THREE.Group();
    
    // Main pothole crater
    const geometry = new THREE.CircleGeometry(0.8, 16);
    const material = new THREE.MeshStandardMaterial({ 
        color: 0x222222,
        roughness: 1,
        metalness: 0
    });
    const pothole = new THREE.Mesh(geometry, material);
    pothole.rotation.x = -Math.PI / 2;
    pothole.position.y = 0.01; // Slightly above the road
    group.add(pothole);
    
    // Choose random lane
    const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
    group.position.x = getLanePosition(lane);
    
    // Position far ahead of player's current position
    group.position.z = playerCar.position.z + 100 + Math.random() * 100;
    
    scene.add(group);
    
    return {
        mesh: group,
        lane: lane
    };
}

// Generate traffic
function generateTraffic() {
    const vehicleColors = [0x1e88e5, 0xffeb3b, 0x43a047, 0xe53935, 0xffd54f];
    const vehicle = createCar(vehicleColors[Math.floor(Math.random() * vehicleColors.length)], false);
    
    // Choose random lane
    const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
    vehicle.position.x = getLanePosition(lane);
    
    // Position far ahead of player's current position
    vehicle.position.z = playerCar.position.z + 100 + Math.random() * 100;
    
    // Random speed (slower than player)
    const speed = 0.15 + Math.random() * 0.2; // Reduced from 0.3 + random * 0.3
    
    scene.add(vehicle);
    
    traffic.push({
        mesh: vehicle,
        lane: lane,
        speed: speed
    });
}

// Move traffic
function moveTraffic() {
    for (let i = traffic.length - 1; i >= 0; i--) {
        const vehicle = traffic[i];
        
        // Add simple AI for traffic vehicles
        let aiSteeringChange = 0;
        
        // Check for collisions with other traffic
        for (let j = 0; j < traffic.length; j++) {
            if (i !== j) {
                const otherVehicle = traffic[j];
                const distanceZ = otherVehicle.mesh.position.z - vehicle.mesh.position.z;
                
                // If another vehicle is close ahead in the same lane
                if (distanceZ > 0 && distanceZ < 10 && 
                    Math.abs(otherVehicle.mesh.position.x - vehicle.mesh.position.x) < 2) {
                    
                    // Try to change lanes
                    if (vehicle.lane > -1) {
                        aiSteeringChange = -0.05; // Try to move left
                    } else {
                        aiSteeringChange = 0.05; // Try to move right
                    }
                    
                    // Slow down
                    vehicle.speed *= 0.98;
                }
            }
        }
        
        // Apply AI steering
        vehicle.lane += aiSteeringChange;
        
        // Clamp to valid lane
        vehicle.lane = Math.max(Math.min(vehicle.lane, 1), -1);
        
        // Update vehicle position
        const targetX = getLanePosition(vehicle.lane);
        vehicle.mesh.position.x += (targetX - vehicle.mesh.position.x) * 0.05;
        
        // Apply relative speed
        vehicle.mesh.position.z += (vehicle.speed - currentSpeed);
        
        // Rotate vehicle based on steering
        if (aiSteeringChange !== 0) {
            vehicle.mesh.rotation.y = aiSteeringChange * 5;
        } else {
            vehicle.mesh.rotation.y *= 0.9; // Return to straight
        }
        
        // Remove if too far behind player
        if (vehicle.mesh.position.z < playerCar.position.z - 50) {
            scene.remove(vehicle.mesh);
            traffic.splice(i, 1);
        }
    }
}

// Generate a pothole
function generatePothole() {
    potholes.push(createPothole());
}

// Move potholes (potholes don't move, but we check if they're behind the player)
function movePotholes() {
    for (let i = potholes.length - 1; i >= 0; i--) {
        const pothole = potholes[i];
        
        // Remove if too far behind player
        if (pothole.mesh.position.z < playerCar.position.z - 50) {
            scene.remove(pothole.mesh);
            potholes.splice(i, 1);
        }
    }
}

// Move the road elements to create illusion of movement
function moveRoad() {
    // No longer move the environment - we'll move the car instead
}

// Check for collisions
function checkCollisions() {
    // Check traffic collisions
    for (let i = 0; i < traffic.length; i++) {
        const vehicle = traffic[i];
        if (Math.abs(vehicle.mesh.position.z - playerCar.position.z) < 3 && 
            Math.abs(vehicle.mesh.position.x - playerCar.position.x) < 2) {
            gameOver = true;
            handleGameOver();
            break;
        }
    }
    
    // Check pothole collisions
    for (let i = 0; i < potholes.length; i++) {
        const pothole = potholes[i];
        if (Math.abs(pothole.mesh.position.z - playerCar.position.z) < 2 && 
            Math.abs(pothole.mesh.position.x - playerCar.position.x) < 1.5) {
            gameOver = true;
            handleGameOver();
            break;
        }
    }
}

// Handle game over
function handleGameOver() {
    // Play crash sound
    if (crashSound && crashSound.buffer) {
        try {
            crashSound.play();
        } catch (e) {
            console.error('Error playing crash sound:', e);
        }
    }
    
    // Stop sounds
    if (backgroundSound && backgroundSound.isPlaying) {
        try {
            backgroundSound.pause();
        } catch (e) {
            console.error('Error stopping background sound:', e);
        }
    }
    
    if (engineSound && engineSound.isPlaying) {
        try {
            engineSound.pause();
        } catch (e) {
            console.error('Error stopping engine sound:', e);
        }
    }
    
    // Show game over screen
    document.getElementById('game-over').style.display = 'block';
    document.getElementById('final-score').textContent = score;
}

// Load sound effects
function loadSounds() {
    try {
        const audioListener = new THREE.AudioListener();
        camera.add(audioListener);
        
        // Background traffic ambient sound
        backgroundSound = new THREE.Audio(audioListener);
        const backgroundLoader = new THREE.AudioLoader();
        
        // Use a try/catch to handle any errors loading the sound
        try {
            backgroundLoader.load('https://assets.codepen.io/21542/howler-demo-bg-music.mp3', function(buffer) {
                backgroundSound.setBuffer(buffer);
                backgroundSound.setLoop(true);
                backgroundSound.setVolume(0.2); // Lower volume to make room for engine sound
                console.log('Background sound loaded successfully');
            }, 
            // onProgress callback
            function(xhr) {
                console.log('Background sound: ' + (xhr.loaded / xhr.total * 100) + '% loaded');
            },
            // onError callback
            function(err) {
                console.error('Error loading background sound:', err);
            });
        } catch (e) {
            console.error('Exception loading background sound:', e);
        }
        
        // Engine sound
        engineSound = new THREE.Audio(audioListener);
        const engineLoader = new THREE.AudioLoader();
        
        try {
            engineLoader.load('https://assets.codepen.io/21542/howler-demo-bg-music.mp3', function(buffer) {
                engineSound.setBuffer(buffer);
                engineSound.setLoop(true);
                engineSound.setVolume(0.3);
                console.log('Engine sound loaded successfully');
            },
            // onProgress callback
            function(xhr) {
                console.log('Engine sound: ' + (xhr.loaded / xhr.total * 100) + '% loaded');
            },
            // onError callback
            function(err) {
                console.error('Error loading engine sound:', err);
            });
        } catch (e) {
            console.error('Exception loading engine sound:', e);
        }
        
        // Horn sound
        hornSound = new THREE.Audio(audioListener);
        const hornLoader = new THREE.AudioLoader();
        
        try {
            hornLoader.load('https://assets.codepen.io/21542/howler-demo-bg-music.mp3', function(buffer) {
                hornSound.setBuffer(buffer);
                hornSound.setVolume(0.5);
                console.log('Horn sound loaded successfully');
            },
            // onProgress callback
            function(xhr) {
                console.log('Horn sound: ' + (xhr.loaded / xhr.total * 100) + '% loaded');
            },
            // onError callback
            function(err) {
                console.error('Error loading horn sound:', err);
            });
        } catch (e) {
            console.error('Exception loading horn sound:', e);
        }
        
        // Crash sound
        crashSound = new THREE.Audio(audioListener);
        const crashLoader = new THREE.AudioLoader();
        
        try {
            crashLoader.load('https://assets.codepen.io/21542/howler-demo-bg-music.mp3', function(buffer) {
                crashSound.setBuffer(buffer);
                crashSound.setVolume(0.7);
                console.log('Crash sound loaded successfully');
            },
            // onProgress callback
            function(xhr) {
                console.log('Crash sound: ' + (xhr.loaded / xhr.total * 100) + '% loaded');
            },
            // onError callback
            function(err) {
                console.error('Error loading crash sound:', err);
            });
        } catch (e) {
            console.error('Exception loading crash sound:', e);
        }
    } catch (e) {
        console.error('Error initializing audio:', e);
    }
}

// Animation loop
function animate() {
    if (!isAnimating) {
        console.log('Animation stopped');
        return;
    }

    if (!renderer) {
        console.error('Renderer not initialized during animation loop');
        return;
    }
    
    requestAnimationFrame(animate);
    
    if (!gameOver) {
        // Update car physics
        updateCarPhysics();
        
        // Update car position based on physics
        updateCarPosition();
        
        // Update the camera to follow the car from behind
        updateCamera();
        
        // Update score
        score++;
        document.getElementById('score').innerText = score;
        
        // Generate traffic and potholes at fixed positions ahead of the car
        if (Math.random() < TRAFFIC_SPAWN_RATE) generateTraffic();
        if (Math.random() < POTHOLE_SPAWN_RATE) generatePothole();
        
        // Move traffic (they should move relative to player's direction)
        moveTraffic();
        
        // Move potholes (they are stationary on the road)
        movePotholes();
        
        // Check collisions
        checkCollisions();
        
        // Play random traffic sounds
        if (Math.random() < 0.002 && hornSound && hornSound.buffer) {
            try {
                hornSound.play();
            } catch (e) {
                console.error('Error playing horn sound:', e);
            }
        }
        
        // Update engine sound based on speed
        updateEngineSound();
    }
    
    renderer.render(scene, camera);
}

// Update car physics
function updateCarPhysics() {
    // Update speed based on acceleration or braking
    if (accelerating) {
        targetSpeed = Math.min(targetSpeed + ACCELERATION, MAX_SPEED);
    } else if (braking) {
        targetSpeed = Math.max(targetSpeed - BRAKE_POWER, 0);
    } else {
        // Gradually slow down due to friction when no input
        targetSpeed = Math.max(targetSpeed - FRICTION, 0);
    }
    
    // Gradually adjust current speed to target speed
    currentSpeed += (targetSpeed - currentSpeed) * 0.1;
    
    // Update steering based on input
    if (leftKeyPressed) {
        targetSteeringAngle = Math.max(targetSteeringAngle - STEERING_SENSITIVITY, -1.0);
    } else if (rightKeyPressed) {
        targetSteeringAngle = Math.min(targetSteeringAngle + STEERING_SENSITIVITY, 1.0);
    } else {
        // Return steering to center when no input
        targetSteeringAngle *= (1 - STEERING_RETURN);
    }
    
    // Gradually adjust current steering to target steering
    steeringAngle += (targetSteeringAngle - steeringAngle) * 0.1;
    
    // Calculate car tilt based on steering (visual effect)
    carTilt += ((steeringAngle * TILT_FACTOR) - carTilt) * 0.1;
    
    // Simulate suspension
    // Add a bit of random suspension movement for road bumps
    const roadBump = Math.random() * 0.01 - 0.005;
    
    // Apply weight transfer during steering
    const weightTransfer = Math.abs(steeringAngle) * WEIGHT_TRANSFER;
    
    // Update suspension physics
    suspensionVelocity += (0 - suspensionHeight) * SUSPENSION_STIFFNESS; // Spring force
    suspensionVelocity += roadBump; // Road bumps
    suspensionVelocity += weightTransfer; // Weight transfer
    suspensionVelocity *= 0.8; // Damping
    
    suspensionHeight += suspensionVelocity;
    suspensionHeight *= 0.9; // Additional damping
}

// Update car position based on physics
function updateCarPosition() {
    // Update car position based on physics
    playerCar.position.z += currentSpeed;
    
    // Adjust lane based on steering
    playerLane -= steeringAngle * 0.05;
    
    // Clamp lane to valid range
    playerLane = Math.max(Math.min(playerLane, 1), -1);
    
    const targetX = getLanePosition(playerLane);
    playerCar.position.x += (targetX - playerCar.position.x) * 0.1;
    
    // Apply visual effects to car body
    if (playerCar.children[0]) {
        // Apply tilt (roll) based on steering
        playerCar.children[0].rotation.z = -carTilt;
        
        // Apply suspension effect to car body height
        playerCar.children[0].position.y = 0.5 + suspensionHeight;
        
        // Apply pitch based on acceleration/braking
        const accelerationPitch = accelerating ? -0.05 : (braking ? 0.1 : 0);
        playerCar.children[0].rotation.x = accelerationPitch;
    }
    
    // Rotate car based on steering direction
    playerCar.rotation.y = steeringAngle * 0.2;
}

// Update camera position to follow the car smoothly
function updateCamera() {
    // Calculate ideal camera position with improved smoothing
    const cameraHeight = 6 + Math.abs(currentSpeed) * 0.6; // Camera raises higher at speed
    const cameraDistance = 12 + currentSpeed * 3; // Camera pulls back more at higher speeds
    
    // Add a bit of offset based on steering to see better around corners
    const steeringOffset = steeringAngle * 3;
    
    // Calculate ideal camera position
    const idealCameraX = playerCar.position.x + steeringOffset * 0.7;
    const idealCameraY = cameraHeight;
    const idealCameraZ = playerCar.position.z - cameraDistance;
    
    // Use variable smoothing factors based on speed
    // Faster speed = faster camera response
    const smoothFactor = 0.05 + (currentSpeed / MAX_SPEED) * 0.05;
    
    // Smoothly move camera towards ideal position
    camera.position.set(
        camera.position.x + (idealCameraX - camera.position.x) * smoothFactor,
        camera.position.y + (idealCameraY - camera.position.y) * smoothFactor,
        camera.position.z + (idealCameraZ - camera.position.z) * smoothFactor
    );
    
    // Calculate look target with better lead based on steering and speed
    const lookAheadDistance = 15 + currentSpeed * 8; // Look further ahead at higher speeds
    const lookX = playerCar.position.x + steeringAngle * 8; // Look into turns
    const lookY = 1 + currentSpeed * 0.2; // Look slightly higher at speed
    const lookZ = playerCar.position.z + lookAheadDistance;
    
    // Create a temporary target vector to smooth the look-at transition
    const targetLookAt = new THREE.Vector3(lookX, lookY, lookZ);
    
    // Use variable smoothing for look-at target too
    const lookSmoothFactor = 0.08 + (currentSpeed / MAX_SPEED) * 0.06;
    
    // Apply smooth look-at
    const currentLookAt = new THREE.Vector3();
    camera.getWorldDirection(currentLookAt);
    currentLookAt.multiplyScalar(lookAheadDistance).add(camera.position);
    
    const smoothedLookAt = new THREE.Vector3(
        currentLookAt.x + (targetLookAt.x - currentLookAt.x) * lookSmoothFactor,
        currentLookAt.y + (targetLookAt.y - currentLookAt.y) * lookSmoothFactor,
        currentLookAt.z + (targetLookAt.z - currentLookAt.z) * lookSmoothFactor
    );
    
    camera.lookAt(smoothedLookAt);
}

// Update engine sound based on car speed
function updateEngineSound() {
    if (engineSound && engineSound.buffer && engineSound.isPlaying) {
        // Adjust engine pitch based on speed
        const minPitch = 0.5;
        const maxPitch = 1.5;
        const pitch = minPitch + (currentSpeed / MAX_SPEED) * (maxPitch - minPitch);
        
        engineSound.setPlaybackRate(pitch);
        
        // Adjust volume
        const volume = 0.2 + (currentSpeed / MAX_SPEED) * 0.3;
        engineSound.setVolume(volume);
    }
}

// Window resize handler
function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Key down handler
function onKeyDown(event) {
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        leftKeyPressed = true;
    } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        rightKeyPressed = true;
    } else if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
        accelerating = true;
    } else if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        braking = true;
    } else if (event.key === 'h' || event.key === 'H') {
        // Play horn sound
        if (hornSound && hornSound.buffer) {
            try {
                hornSound.play();
            } catch (e) {
                console.error('Error playing horn sound:', e);
            }
        }
    }
}

// Key up handler
function onKeyUp(event) {
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        leftKeyPressed = false;
    } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        rightKeyPressed = false;
    } else if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
        accelerating = false;
    } else if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        braking = false;
    }
}

// Start game
function startGame() {
    console.log('Starting game...');
    
    // Initialize the game if not already done
    initializeGame();
    
    // Hide title screen
    document.getElementById('title-screen').style.display = 'none';
    
    // Reset game state
    gameOver = false;
    score = 0;
    playerLane = 0;
    playerPosition = 0;
    
    // Reset physics state
    currentSpeed = 0;
    targetSpeed = 0;
    steeringAngle = 0;
    targetSteeringAngle = 0;
    carTilt = 0;
    suspensionHeight = 0;
    suspensionVelocity = 0;
    accelerating = false;
    braking = false;
    
    document.getElementById('score').innerText = '0';
    
    // Reset car position
    if (playerCar) {
        playerCar.position.x = getLanePosition(playerLane);
        playerCar.position.z = 0; // Start at beginning of road
        playerCar.rotation.y = 0; // Reset rotation
        
        // Reset car body position and rotation
        if (playerCar.children[0]) {
            playerCar.children[0].position.y = 0.5;
            playerCar.children[0].rotation.x = 0;
            playerCar.children[0].rotation.z = 0;
        }
    }
    
    // Reset camera position
    camera.position.set(0, 5, -10);
    camera.lookAt(0, 0, 10);
    
    // Start animation if not already running
    if (!isAnimating) {
        isAnimating = true;
        animate();
        console.log('Animation started');
    }
    
    // Start sounds
    if (backgroundSound && backgroundSound.buffer) {
        try {
            backgroundSound.play();
            console.log('Background sound started');
        } catch (e) {
            console.error('Error playing background sound:', e);
        }
    } else {
        console.log('Background sound not loaded yet');
    }
    
    if (engineSound && engineSound.buffer) {
        try {
            engineSound.play();
            console.log('Engine sound started');
        } catch (e) {
            console.error('Error playing engine sound:', e);
        }
    }
}

// Restart game
function restartGame() {
    console.log('Restarting game...');
    
    // Reset game state
    score = 0;
    gameOver = false;
    playerLane = 0;
    playerPosition = 0;
    
    // Reset physics state
    currentSpeed = 0;
    targetSpeed = 0;
    steeringAngle = 0;
    targetSteeringAngle = 0;
    carTilt = 0;
    suspensionHeight = 0;
    suspensionVelocity = 0;
    accelerating = false;
    braking = false;
    
    // Clear traffic and potholes
    traffic.forEach(car => scene.remove(car.mesh));
    traffic = [];
    potholes.forEach(pothole => scene.remove(pothole.mesh));
    potholes = [];
    
    // Reset car position
    if (playerCar) {
        playerCar.position.x = getLanePosition(playerLane);
        playerCar.position.z = 0; // Reset to start of road
        playerCar.rotation.y = 0; // Reset rotation
        
        // Reset car body position and rotation
        if (playerCar.children[0]) {
            playerCar.children[0].position.y = 0.5;
            playerCar.children[0].rotation.x = 0;
            playerCar.children[0].rotation.z = 0;
        }
    }
    
    // Reset camera position
    camera.position.set(0, 5, -10);
    camera.lookAt(0, 0, 10);
    
    // Hide game over screen
    document.getElementById('game-over').style.display = 'none';
    
    // Reset score display
    document.getElementById('score').innerText = '0';
    
    // Restart sounds
    if (backgroundSound && !backgroundSound.isPlaying && backgroundSound.buffer) {
        try {
            backgroundSound.play();
        } catch (e) {
            console.error('Error playing background sound:', e);
        }
    }
    
    if (engineSound && !engineSound.isPlaying && engineSound.buffer) {
        try {
            engineSound.play();
        } catch (e) {
            console.error('Error playing engine sound:', e);
        }
    }
    
    // Make sure animation is running
    if (!isAnimating) {
        isAnimating = true;
        animate();
        console.log('Animation restarted');
    }
}

// Initialize when window loads
window.onload = function() {
    console.log('Window loaded');
    
    // Bind start button
    const startButton = document.getElementById('start-button');
    if (startButton) {
        console.log('Start button found, binding click event');
        startButton.onclick = function() {
            console.log('Start button clicked');
            startGame();
        };
    } else {
        console.error('Start button not found');
    }
    
    // Bind restart button
    const restartButton = document.getElementById('restart-button');
    if (restartButton) {
        console.log('Restart button found, binding click event');
        restartButton.onclick = function() {
            console.log('Restart button clicked');
            restartGame();
        };
    } else {
        console.error('Restart button not found');
    }
}; 