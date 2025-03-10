"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { Physics, RigidBody } from '@react-three/rapier';
import { Euler, Quaternion, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import * as THREE from 'three';
extend({ RoundedBoxGeometry });

// Camera constants
const CAMERA_CONSTANTS = {
  DEFAULT_ZOOM: 8,
  FOCUSED_ZOOM: 8,
  SMOOTHNESS: 0.8,
  POSITION_Y: 10,
};

// Dice throw physics constants
const DICE_PHYSICS = {
  INITIAL_HEIGHT: 1,
  POSITION_SPREAD: 2,  // Multiplied by (Math.random() - 0.5)
  LINEAR_VELOCITY: 20, // Multiplied by (Math.random() - 0.5) for x and z
  ANGULAR_VELOCITY: 30, // Multiplied by (Math.random() - 0.5)
  GRAVITY_SCALE: 3,
  RESTITUTION: 0.3,
  FRICTION: 5,
};

// Dice appearance constants
const DICE_APPEARANCE = {
  SIZE: 1,
  CORNER_RADIUS: 0.1,
  CORNER_SEGMENTS: 4,
};

// Animation constants
const ANIMATION = {
  FADE_IN_DURATION: 0.2, // seconds for the dice to fade in
  FADE_IN_DELAY: 0.1,    // seconds to wait before starting the fade
  INITIAL_OPACITY: 0,    // starting opacity
  FADE_OUT_DURATION: 0.1, // seconds for the dice to fade out when rolling again
};

// Texture constants
const TEXTURE_CONSTANTS = {
  SIZE: 256,  // Increased from 64
  PIP_RADIUS: 20,  // Increased from 5
  BACKGROUND_COLOR: '#ffffff',
  PIP_COLOR: '#000000'
};

// Canvas dimensions - adjusted for tiled layout
const CANVAS_DIMENSIONS = {
  WIDTH: 200, // Smaller width for tiled layout
  HEIGHT: 150, // Smaller height for tiled layout
  MAX_DICE: 9, // Maximum number of dice
  DEFAULT_DICE: 2, // Default number of dice
};

// Performance constants - adding FPS-related settings
const PERFORMANCE = {
  PHYSICS_TIME_STEP: 1 / 120, // Increase physics simulation rate from 1/60 to 1/120
  PHYSICS_ITERATIONS: 3,      // Increase solver iterations for better precision
};

// Add a viewport adjuster component to handle DPI properly
function ViewportAdjuster() {
  const { gl } = useThree();
  
  useEffect(() => {
    // Set pixel ratio correctly based on device
    if (typeof window !== 'undefined') {
      gl.setPixelRatio(window.devicePixelRatio);
      
      // Set higher precision for better performance
      gl.shadowMap.enabled = false; // Disable shadows for performance
      gl.setAnimationLoop(gl.render); // Use more efficient animation loop
    }
  }, [gl]);
  
  return null;
}

// DiceGrid component to manage multiple dice instances
function DiceGrid() {
  const [diceCount, setDiceCount] = useState(CANVAS_DIMENSIONS.DEFAULT_DICE);
  const [isRolling, setIsRolling] = useState(false);
  const [diceResults, setDiceResults] = useState([]);
  const [diceSettled, setDiceSettled] = useState([]);
  
  const rollAllDice = () => {
    setIsRolling(true);
    setDiceResults([]); // Reset results when rolling
    setDiceSettled(Array(diceCount).fill(false)); // Reset settled state
    // Reset rolling state after a brief delay to enable subsequent rolls
    setTimeout(() => {
      setIsRolling(false);
    }, 100);
  };

  // Re-roll dice when slider changes
  useEffect(() => {
    rollAllDice();
  }, [diceCount]); // Trigger re-roll when dice count changes
  
  // Handle both the dice result and settled state
  const handleDiceUpdate = (index, result, isSettled) => {
    // Update result
    setDiceResults(prev => {
      const newResults = [...prev];
      newResults[index] = result;
      return newResults;
    });
    
    // Update settled state separately
    if (isSettled) {
      setDiceSettled(prev => {
        const newSettled = [...prev];
        newSettled[index] = true;
        return newSettled;
      });
    }
  };
  
  // Calculate total of all dice
  const totalValue = diceResults.reduce((sum, value) => sum + (value || 0), 0);
  
  // Count how many dice are settled
  const settledCount = diceSettled.filter(Boolean).length;
  
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="mb-4 w-64">
        <label htmlFor="diceCount" className="block mb-2">Number of Dice: {diceCount}</label>
        <input
          id="diceCount"
          type="range"
          min="1"
          max={CANVAS_DIMENSIONS.MAX_DICE}
          value={diceCount}
          onChange={(e) => setDiceCount(parseInt(e.target.value))}
          className="w-full"
        />
      </div>
      
      <button 
        className="px-4 py-2 bg-blue-500 text-white rounded mb-4" 
        onClick={rollAllDice}
        disabled={isRolling}
      >
        Roll All Dice
      </button>
      
      <div className="flex flex-wrap justify-center border border-solid border-gray-300 rounded-lg p-2 mb-4" style={{ maxWidth: '650px' }}>
        {Array.from({ length: diceCount }, (_, index) => (
          <SingleDie 
            key={index} 
            rollTrigger={isRolling} 
            dieIndex={index}
            onDiceUpdate={(result, isSettled) => handleDiceUpdate(index, result, isSettled)}
          />
        ))}
      </div>
      
      {/* Results display - moved to the bottom */}
        <div className="text-center">
          <p className="font-bold">
            {diceResults.map((r, i) => (
              <>
              <span key={i} className={diceSettled[i] ? "text-green-600" : "text-gray-600"}>
                {r || '?'}
              </span>
              <span>
                {i < diceResults.length - 1 ? ' + ' : ''}
              </span>
              </>
            ))} = {totalValue}
          </p>
          <p className="text-sm mt-1">{settledCount}/{diceCount} dice settled</p>
        </div>
      
    </div>
  );
}

// Single die component - converted from original Dice component
function SingleDie({ rollTrigger, dieIndex, onDiceUpdate }) {
  const [showDice, setShowDice] = useState(false);
  const [dicePosition, setDicePosition] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [shouldFadeOut, setShouldFadeOut] = useState(false);
  const [dpr, setDpr] = useState(1);
  const lastRollTrigger = useRef(rollTrigger);
  const [diceResult, setDiceResult] = useState(null);
  const [isSettled, setIsSettled] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDpr(window.devicePixelRatio);
    }
  }, []);
  
  // Detect roll trigger changes
  useEffect(() => {
    if (rollTrigger !== lastRollTrigger.current) {
      lastRollTrigger.current = rollTrigger;
      if (rollTrigger) {
        rollDice();
        setDiceResult(null); // Reset result when rolling again
        setIsSettled(false); // Reset settled state
      }
    }
  }, [rollTrigger]);
  
  const updateDicePosition = (position) => {
    setDicePosition(position);
  };

  // Handle both dice result and settled state
  const handleDiceResult = (result, settled) => {
    setDiceResult(result);
    
    // Only update settled state if it's changing from false to true
    if (settled && !isSettled) {
      setIsSettled(true);
    }
    
    // Pass both result and settled state up to parent
    onDiceUpdate(result, settled);
  };

  const handleFadeOutComplete = () => {
    setShowDice(false);
    setDicePosition(null);
    setShouldFadeOut(false);
    
    setTimeout(() => {
      setShowDice(true);
      setIsRolling(false);
    }, 50);
  };

  const rollDice = () => {
    if (showDice && !isRolling) {
      setIsRolling(true);
      setShouldFadeOut(true);
    } else if (!showDice && !isRolling) {
      setShowDice(true);
    }
  };

  return (
    <div>
      <Canvas
        key={`dice-canvas-${dieIndex}`} // Add stable key to prevent re-use issues
        dpr={dpr}
        style={{ 
          width: CANVAS_DIMENSIONS.WIDTH, 
          height: CANVAS_DIMENSIONS.HEIGHT 
        }}
        frameloop="demand" // Set to 'demand' for more efficient updates
        camera={{
          position: [0, CAMERA_CONSTANTS.POSITION_Y, 0],
          up: [0, 0, 1],
          near: 0.1,
          far: 1000,
          orthographic: true
        }}
        // Add explicit cleanup on unmount
        onCreated={({ gl, scene }) => {
          // Store original dispose function
          const originalDispose = scene.dispose;
          
          // Override with a more robust version
          scene.dispose = function() {
            // First traverse and remove everything
            scene.traverse((object) => {
              if (object.isMesh) {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                  if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                  } else {
                    object.material.dispose();
                  }
                }
              }
            });
            
            // Then call original dispose
            originalDispose.call(this);
          };
        }}
      >
        <ViewportAdjuster />
        <OrthographicCameraController dicePosition={dicePosition} />
        <ambientLight intensity={1.0} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <directionalLight position={[-5, 5, 0]} intensity={1.5} />
        <Physics 
          gravity={[0, -9.81, 0]} 
          timeStep={PERFORMANCE.PHYSICS_TIME_STEP}
          iterations={PERFORMANCE.PHYSICS_ITERATIONS}
          interpolate={true}
        >
          {showDice && (
            <Cube 
              key={`cube-${dieIndex}`} // Add key to ensure proper mounting/unmounting
              updatePosition={updateDicePosition} 
              fadeOut={shouldFadeOut}
              onFadeOutComplete={handleFadeOutComplete}
              onDiceResult={handleDiceResult}
            />
          )}
          <RigidBody type="fixed" colliders="cuboid">
            <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[40, 40]} />
              <meshStandardMaterial transparent={true} opacity={0} />
            </mesh>
          </RigidBody>
        </Physics>
      </Canvas>
    </div>
  );
}

// The rest of the components remain the same
function OrthographicCameraController({ dicePosition }) {
  const targetPosition = useRef({ x: 0, z: 0, zoom: CAMERA_CONSTANTS.DEFAULT_ZOOM });
  const currentPosition = useRef({ x: 0, z: 0, zoom: CAMERA_CONSTANTS.DEFAULT_ZOOM });
  
  useFrame((state) => {
    // Check if the camera still exists before trying to update it
    if (!state.camera) return;
    
    if (!dicePosition) {
      targetPosition.current = { x: 0, z: 0, zoom: CAMERA_CONSTANTS.DEFAULT_ZOOM };
    } else {
      targetPosition.current = { 
        x: dicePosition.x, 
        z: dicePosition.z,
        zoom: CAMERA_CONSTANTS.FOCUSED_ZOOM
      };
    }
    
    const smoothness = CAMERA_CONSTANTS.SMOOTHNESS;
    currentPosition.current.x += (targetPosition.current.x - currentPosition.current.x) * smoothness;
    currentPosition.current.z += (targetPosition.current.z - currentPosition.current.z) * smoothness;
    currentPosition.current.zoom += (targetPosition.current.zoom - currentPosition.current.zoom) * smoothness;
    
    try {
      state.camera.position.x = currentPosition.current.x;
      state.camera.position.z = currentPosition.current.z;
      state.camera.zoom = currentPosition.current.zoom;
      state.camera.lookAt(currentPosition.current.x, 0, currentPosition.current.z);
      state.camera.updateProjectionMatrix();
    } catch (error) {
      console.error("Error updating camera:", error);
    }
  });
  
  return null;
}

function createDiceFaceTexture(num) {
  const size = TEXTURE_CONSTANTS.SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = TEXTURE_CONSTANTS.BACKGROUND_COLOR;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = TEXTURE_CONSTANTS.PIP_COLOR;
  const radius = TEXTURE_CONSTANTS.PIP_RADIUS;
  
  const scale = size / 64;
  
  function drawPip(x, y) {
    ctx.beginPath();
    ctx.arc(x * scale, y * scale, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  if (num === 1) {
    drawPip(32, 32);
  } else if (num === 2) {
    drawPip(16, 48);
    drawPip(48, 16);
  } else if (num === 3) {
    drawPip(16, 48);
    drawPip(32, 32);
    drawPip(48, 16);
  } else if (num === 4) {
    drawPip(16, 16);
    drawPip(48, 16);
    drawPip(16, 48);
    drawPip(48, 48);
  } else if (num === 5) {
    drawPip(16, 16);
    drawPip(48, 16);
    drawPip(32, 32);
    drawPip(16, 48);
    drawPip(48, 48);
  } else if (num === 6) {
    drawPip(16, 16);
    drawPip(16, 32);
    drawPip(16, 48);
    drawPip(48, 16);
    drawPip(48, 32);
    drawPip(48, 48);
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function Cube({ updatePosition, fadeOut, onFadeOutComplete, onDiceResult }) {
  const cubeRef = useRef();
  const [opacity, setOpacity] = useState(ANIMATION.INITIAL_OPACITY);
  const startTimeRef = useRef(null);
  const fadeOutStartRef = useRef(null);
  const [animationPhase, setAnimationPhase] = useState('fadingIn');
  const resultRef = useRef(null);
  const isSettledRef = useRef(false);
  const currentValueRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const isMountedRef = useRef(true); // Track if component is mounted
  
  // New movement history tracking system
  const movementHistoryRef = useRef([]);
  const positionHistoryRef = useRef([]);
  const settlementPhaseRef = useRef('rolling'); // 'rolling', 'slowing', 'settling', 'settled'
  const settlementStartTimeRef = useRef(null);
  const lastReportedValueRef = useRef(null);
  const rollStartTimeRef = useRef(null);
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    rollStartTimeRef.current = Date.now();
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  useEffect(() => {
    if (fadeOut && animationPhase !== 'fadingOut' && isMountedRef.current) {
      setAnimationPhase('fadingOut');
      fadeOutStartRef.current = Date.now() / 1000;
    }
  }, [fadeOut, animationPhase]);
  
  // Reset settlement state when recreated
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    isSettledRef.current = false;
    resultRef.current = null;
    currentValueRef.current = null;
    movementHistoryRef.current = [];
    positionHistoryRef.current = [];
    settlementPhaseRef.current = 'rolling';
    settlementStartTimeRef.current = null;
    lastReportedValueRef.current = null;
    rollStartTimeRef.current = Date.now();
  }, []);
  
  // Determine which face is up based on the dice orientation
  const determineDiceValue = () => {
    if (!cubeRef.current) return null;
    
    try {
      const rotation = cubeRef.current.rotation();
      
      // Create rotation matrix from quaternion
      const matrix = new THREE.Matrix4().makeRotationFromQuaternion(
        new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
      );
      
      // Get the global up vector (0, 1, 0)
      const upVector = new THREE.Vector3(0, 1, 0);
      
      // Correct face normal vectors for standard dice
      // In a standard die, opposite faces sum to 7
      const faceNormals = [
        { normal: new THREE.Vector3(1, 0, 0), value: 6 },   // +x (right face shows 6)
        { normal: new THREE.Vector3(-1, 0, 0), value: 1 },  // -x (left face shows 1)
        { normal: new THREE.Vector3(0, 1, 0), value: 2 },   // +y (top face shows 2) 
        { normal: new THREE.Vector3(0, -1, 0), value: 5 },  // -y (bottom face shows 5)
        { normal: new THREE.Vector3(0, 0, 1), value: 3 },   // +z (front face shows 3)
        { normal: new THREE.Vector3(0, 0, -1), value: 4 },  // -z (back face shows 4)
      ];
      
      // Transform each normal to world space and check which one best aligns with up
      let maxDot = -Infinity;
      let result = 0;
      
      faceNormals.forEach(({normal, value}) => {
        // Transform normal to world space using the cube's rotation
        const worldNormal = normal.clone().applyMatrix4(matrix);
        
        // Calculate dot product with up vector
        const dot = worldNormal.dot(upVector);
        
        if (dot > maxDot) {
          maxDot = dot;
          result = value;
        }
      });
      
      // Use a higher threshold for more reliable face detection
      return maxDot > 0.8 ? result : null;
    } catch (error) {
      console.error('Error determining dice value:', error);
      return null;
    }
  };

  // Use useFrame to manage dice settlement and reporting with improved logic
  useFrame((state) => {
    if (!cubeRef.current || !isMountedRef.current) return;
    
    try {
      const position = cubeRef.current.translation();
      updatePosition(position);
      
      // Initialize start time if not set
      if (startTimeRef.current === null) {
        startTimeRef.current = state.clock.elapsedTime;
      }
      
      // Handle animation phases
      if (animationPhase === 'fadingOut') {
        const currentTime = Date.now() / 1000;
        const fadeOutTime = currentTime - fadeOutStartRef.current;
        
        if (fadeOutTime < ANIMATION.FADE_OUT_DURATION) {
          const newOpacity = 1 - (fadeOutTime / ANIMATION.FADE_OUT_DURATION);
          setOpacity(Math.max(0, newOpacity));
        } else if (isMountedRef.current) {
          setOpacity(0);
          onFadeOutComplete && onFadeOutComplete();
        }
      } else if (animationPhase === 'fadingIn') {
        const elapsed = state.clock.elapsedTime - startTimeRef.current;
        
        if (elapsed > ANIMATION.FADE_IN_DELAY) {
          const fadeProgress = elapsed - ANIMATION.FADE_IN_DELAY;
          
          if (fadeProgress < ANIMATION.FADE_IN_DURATION) {
            const newOpacity = ANIMATION.INITIAL_OPACITY + 
              (1 - ANIMATION.INITIAL_OPACITY) * (fadeProgress / ANIMATION.FADE_IN_DURATION);
            setOpacity(newOpacity);
          } else if (isMountedRef.current) {
            setOpacity(1);
            setAnimationPhase('visible');
          }
        }
        return;
      }
      
      // New settlement detection system - only run if the dice is visible
      if (animationPhase === 'visible' && !isSettledRef.current) {
        // Get current velocity and position data
        const linvel = cubeRef.current.linvel();
        const angvel = cubeRef.current.angvel();
        const currentPos = new Vector3(position.x, position.y, position.z);
        const currentRotation = cubeRef.current.rotation();
        
        // Calculate magnitude of velocities
        const linVelMagnitude = Math.sqrt(linvel.x**2 + linvel.y**2 + linvel.z**2);
        const angVelMagnitude = Math.sqrt(angvel.x**2 + angvel.y**2 + angvel.z**2);
        
        // Store velocity history (keep last 10 frames)
        movementHistoryRef.current.push({ 
          linVelMagnitude, 
          angVelMagnitude,
          time: state.clock.elapsedTime 
        });
        if (movementHistoryRef.current.length > 10) {
          movementHistoryRef.current.shift();
        }
        
        // Store position history (keep last 5 positions)
        positionHistoryRef.current.push({ 
          position: currentPos,
          rotation: currentRotation,
          time: state.clock.elapsedTime
        });
        if (positionHistoryRef.current.length > 5) {
          positionHistoryRef.current.shift();
        }
        
        // Force settlement after max time (5 seconds)
        const rollDuration = Date.now() - rollStartTimeRef.current;
        if (rollDuration > 5000 && !isSettledRef.current) {
          console.log('Force settling dice after timeout');
          finalizeSettlement();
          return;
        }
        
        // Progressive settlement phases with adaptive thresholds
        switch (settlementPhaseRef.current) {
          case 'rolling':
            // Check if dice is slowing down (velocities decreasing over time)
            if (movementHistoryRef.current.length >= 5 && linVelMagnitude < 0.2 && angVelMagnitude < 0.2) {
              settlementPhaseRef.current = 'slowing';
              console.log('Dice slowing down...');
            }
            break;
            
          case 'slowing':
            // Check for potential settlement when velocities are very low
            if (linVelMagnitude < 0.05 && angVelMagnitude < 0.05) {
              settlementPhaseRef.current = 'settling';
              settlementStartTimeRef.current = state.clock.elapsedTime;
              console.log('Dice potentially settling...');
            }
            break;
            
          case 'settling':
            // Check position/rotation stability over time
            if (positionHistoryRef.current.length >= 3 && isPositionStable() && isRotationStable()) {
              // Ensure the dice has been in settling phase for at least 0.3 seconds
              const timeInSettling = state.clock.elapsedTime - settlementStartTimeRef.current;
              if (timeInSettling >= 0.3) {
                console.log('Dice confirmed settled');
                finalizeSettlement();
              }
            } else if (linVelMagnitude > 0.08 || angVelMagnitude > 0.08) {
              // If dice starts moving again, go back to slowing phase
              settlementPhaseRef.current = 'slowing';
              console.log('Dice movement detected, back to slowing phase');
            }
            break;
        }
        
        // Always report the current face for UI feedback, even if not settled
        reportCurrentFace();
      }
      
      // Request next frame for smoother animations
      state.invalidate();
    } catch (error) {
      console.error("Error in animation frame:", error);
      // If persistent errors after 3 seconds, force settlement
      const rollDuration = Date.now() - rollStartTimeRef.current;
      if (rollDuration > 3000 && !isSettledRef.current) {
        finalizeSettlement();
      }
    }
  });
  
  // Helper function to check if position is stable
  const isPositionStable = () => {
    if (positionHistoryRef.current.length < 3) return false;
    
    const positions = positionHistoryRef.current.map(h => h.position);
    const maxDistance = 0.01; // 1cm threshold
    
    for (let i = 1; i < positions.length; i++) {
      const distance = positions[i].distanceTo(positions[i-1]);
      if (distance > maxDistance) return false;
    }
    return true;
  };
  
  // Helper function to check if rotation is stable
  const isRotationStable = () => {
    if (positionHistoryRef.current.length < 3) return false;
    
    const rotations = positionHistoryRef.current.map(h => h.rotation);
    const threshold = 0.01; // Small rotation threshold
    
    for (let i = 1; i < rotations.length; i++) {
      const prev = rotations[i-1];
      const curr = rotations[i];
      
      // Check if any component of rotation changed significantly
      if (Math.abs(prev.x - curr.x) > threshold ||
          Math.abs(prev.y - curr.y) > threshold ||
          Math.abs(prev.z - curr.z) > threshold ||
          Math.abs(prev.w - curr.w) > threshold) {
        return false;
      }
    }
    return true;
  };
  
  // Report current face value (for continuous UI updates)
  const reportCurrentFace = () => {
    if (isSettledRef.current) return; // Don't change value if already settled
    
    const faceValue = determineDiceValue();
    if (faceValue !== null) {
      currentValueRef.current = faceValue;
      
      // Only report to parent if the value changed
      if (lastReportedValueRef.current !== faceValue) {
        lastReportedValueRef.current = faceValue;
        onDiceResult(faceValue, false); // face value but not settled
      }
    }
  };
  
  // Finalize the dice settlement - determine final value and report it
  const finalizeSettlement = () => {
    if (isSettledRef.current) return; // Prevent multiple settlements
    isSettledRef.current = true;
    
    // Make multiple attempts to get a valid value
    let finalValue = determineDiceValue();
    
    // If we can't determine the value directly, use the last known value
    // or make extra attempts with slight delays
    if (finalValue === null) {
      if (currentValueRef.current !== null) {
        finalValue = currentValueRef.current;
      } else {
        // Last resort - use position to estimate which face is up
        try {
          const position = cubeRef.current.translation();
          const rotation = cubeRef.current.rotation();
          
          // Get the actual matrix to determine orientation
          const matrix = new THREE.Matrix4();
          matrix.makeRotationFromQuaternion(
            new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
          );
          
          const upVector = new THREE.Vector3(0, 1, 0);
          const transformedUp = upVector.clone().applyMatrix4(matrix);
          
          // Determine most likely face based on orientation
          const absX = Math.abs(transformedUp.x);
          const absY = Math.abs(transformedUp.y);
          const absZ = Math.abs(transformedUp.z);
          
          if (absX > absY && absX > absZ) {
            finalValue = transformedUp.x > 0 ? 6 : 1;
          } else if (absY > absX && absY > absZ) {
            finalValue = transformedUp.y > 0 ? 2 : 5;
          } else {
            finalValue = transformedUp.z > 0 ? 3 : 4;
          }
        } catch (error) {
          console.error("Error in emergency value determination:", error);
          finalValue = Math.floor(Math.random() * 6) + 1; // Absolute last resort
        }
      }
    }
    
    // Report the final settled value
    console.log('Dice settled with final value:', finalValue);
    currentValueRef.current = finalValue;
    onDiceResult(finalValue, true);
    
    // Clear histories to free memory
    movementHistoryRef.current = [];
    positionHistoryRef.current = [];
  };

  useEffect(() => {
    const initTimer = setTimeout(() => {
      if (!cubeRef.current || !isMountedRef.current) return;
      
      try {
        const randomEuler = new Euler(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        );
        
        const quaternion = new Quaternion().setFromEuler(randomEuler);
        
        cubeRef.current.setTranslation({ 
          x: (Math.random() - 0.5) * DICE_PHYSICS.POSITION_SPREAD,
          y: DICE_PHYSICS.INITIAL_HEIGHT,
          z: (Math.random() - 0.5) * DICE_PHYSICS.POSITION_SPREAD
        }, true);
        
        cubeRef.current.setRotation(quaternion, true);
        cubeRef.current.setGravityScale(DICE_PHYSICS.GRAVITY_SCALE);
        
        cubeRef.current.setLinvel({ 
          x: (Math.random() - 0.5) * DICE_PHYSICS.LINEAR_VELOCITY,
          y: 0,
          z: (Math.random() - 0.5) * DICE_PHYSICS.LINEAR_VELOCITY
        }, true);
        
        cubeRef.current.setAngvel({ 
          x: (Math.random() - 0.5) * DICE_PHYSICS.ANGULAR_VELOCITY,
          y: (Math.random() - 0.5) * DICE_PHYSICS.ANGULAR_VELOCITY,
          z: (Math.random() - 0.5) * DICE_PHYSICS.ANGULAR_VELOCITY
        }, true);
      } catch (error) {
        console.error("Error initializing dice:", error);
      }
    }, 50); // Small delay to ensure physics world is ready
    
    return () => clearTimeout(initTimer);
  }, []);

  const diceMaterials = useMemo(
    () => [
      // Materials must match the correct face value assignments from determineDiceValue
      new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(6), transparent: true, opacity: opacity, roughness: 0.5 }), // +x (right)
      new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(1), transparent: true, opacity: opacity, roughness: 0.5 }), // -x (left)
      new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(2), transparent: true, opacity: opacity, roughness: 0.5 }), // +y (top)
      new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(5), transparent: true, opacity: opacity, roughness: 0.5 }), // -y (bottom)
      new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(3), transparent: true, opacity: opacity, roughness: 0.5 }), // +z (front)
      new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(4), transparent: true, opacity: opacity, roughness: 0.5 }), // -z (back)
    ],
    [opacity]
  );

  return (
    <RigidBody 
      ref={cubeRef} 
      gravityScale={DICE_PHYSICS.GRAVITY_SCALE} 
      restitution={DICE_PHYSICS.RESTITUTION} 
      friction={DICE_PHYSICS.FRICTION}
      colliders="cuboid"
      linearDamping={0.5}
      angularDamping={0.5}
    >
      <mesh material={diceMaterials}>
        <roundedBoxGeometry 
          args={[
            DICE_APPEARANCE.SIZE, 
            DICE_APPEARANCE.SIZE, 
            DICE_APPEARANCE.SIZE, 
            DICE_APPEARANCE.CORNER_SEGMENTS, 
            DICE_APPEARANCE.CORNER_RADIUS
          ]} 
        />
      </mesh>
    </RigidBody>
  );
}

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <DiceGrid />
    </div>
  );
}
