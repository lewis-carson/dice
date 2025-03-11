"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { Physics, RigidBody } from '@react-three/rapier';
import { Euler, Quaternion, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import * as THREE from 'three';
import React from 'react';
extend({ RoundedBoxGeometry });

// Camera constants
const CAMERA_CONSTANTS = {
  DEFAULT_ZOOM: 6,
  FOCUSED_ZOOM: 6,
  SMOOTHNESS: 0.3,
  POSITION_Y: 10,
};

// Dice throw physics constants
const DICE_PHYSICS = {
  INITIAL_HEIGHT: 1,
  POSITION_SPREAD: 0,  // Multiplied by (Math.random() - 0.5)
  LINEAR_VELOCITY: 10, // Multiplied by (Math.random() - 0.5) for x and z
  ANGULAR_VELOCITY: 40, // Multiplied by (Math.random() - 0.5)
  GRAVITY_SCALE: 3,
  RESTITUTION: 0.5,
  FRICTION: 5,
};

// Dice appearance constants
const DICE_APPEARANCE = {
  SIZE: 1,
  CORNER_RADIUS: 0.1,
  CORNER_SEGMENTS: 2,
};

// Animation constants
const ANIMATION = {
  FADE_IN_DURATION: 0, // seconds for the dice to fade in
  FADE_IN_DELAY: 0,    // seconds to wait before starting the fade
  INITIAL_OPACITY: 0,    // starting opacity
  FADE_OUT_DURATION: 0, // seconds for the dice to fade out when rolling again
};

// Texture constants
const TEXTURE_CONSTANTS = {
  SIZE: 256,  // Increased from 64
  PIP_RADIUS: 20,  // Increased from 5
  BACKGROUND_COLOR: '#ffffff',
  PIP_COLOR: '#000000'
};

// Canvas dimensions - adjusted for staggered layout
const CANVAS_DIMENSIONS = {
  WIDTH: 200, // Smaller width for tiled layout
  HEIGHT: 150, // Smaller height for tiled layout
  MAX_DICE: 5, // Maximum number of dice
  DEFAULT_DICE: 2, // Default number of dice
  OVERLAP: 30, // Amount of overlap between dice in pixels
  ROW_PATTERN: [3, 2, 3, 1], // Pattern for dice per row (3,2,3,1)
};

// Performance constants - adding FPS-related settings
const PERFORMANCE = {
  PHYSICS_TIME_STEP: 1 / 80, // Increase physics simulation rate from 1/60 to 1/120
  PHYSICS_ITERATIONS: 2,      // Increase solver iterations for better precision
};

// Adding button animation constants
const BUTTON_ANIMATION = {
  SCALE_DOWN: 0.95,  // Button scales to 95% when clicked
  TRANSITION: '0.1s', // Animation duration
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

// Update histogram constants to use more muted colors
const HISTOGRAM = {
  HEIGHT: 120,         // Reduced height
  HIGHLIGHT_COLOR: '#A78BFA', // More muted highlight color
  IDEAL_COLOR: '#E5E7EB', // Very muted base color for bars
  BAR_SPACING: 3,      // Slightly reduced spacing
  PROVISIONAL_COLOR: '#D8B4FE', // Lighter purple for provisional values
  REROLL_COLOR: '#9333EA', // Color for reroll distribution
};

// DiceGrid component to manage multiple dice instances
function DiceGrid() {
  const [diceCount, setDiceCount] = useState(CANVAS_DIMENSIONS.DEFAULT_DICE);
  const [isRolling, setIsRolling] = useState(false);
  const [diceResults, setDiceResults] = useState([]);
  const [diceSettled, setDiceSettled] = useState([]);
  const [rerollIndices, setRerollIndices] = useState([]); // New state for tracking specific dice to re-roll
  // Add button animation states
  const [rollButtonPressed, setRollButtonPressed] = useState(false);
  const [rerollButtonPressed, setRerollButtonPressed] = useState(false);
  // Replace sumHistory with just the last roll
  const [lastRollSum, setLastRollSum] = useState(null);
  // Add state for provisional sum while dice are settling
  const [provisionalSum, setProvisionalSum] = useState(null);
  // Add state to track if we're in reroll mode
  const [isRerolling, setIsRerolling] = useState(false);
  // Track which die value is being rerolled
  const [rerolledValue, setRerolledValue] = useState(null);
  
  const rollAllDice = () => {
    setIsRolling(true);
    setDiceResults([]); // Reset results when rolling
    setDiceSettled(Array(diceCount).fill(false)); // Reset settled state
    setRerollIndices([]); // Clear any previous re-roll indices
    setIsRerolling(false); // Exit reroll mode
    setRerolledValue(null); // Clear rerolled value
    // Reset rolling state after a brief delay to enable subsequent rolls
    setTimeout(() => {
      setIsRolling(false);
    }, 100);
  };

  // Modified function to re-roll only one die with the lowest value
  const rerollLowestDice = () => {
    // Only proceed if at least one die has settled
    if (diceResults.filter(r => r !== undefined && r !== null).length === 0) {
      return; // No dice have values yet
    }

    // Find the minimum value among settled dice
    const validResults = diceResults.map((value, index) => ({
      value: value || Infinity, // Use Infinity for unsettled dice
      index
    })).filter(item => item.value !== Infinity);

    if (validResults.length === 0) return; // No settled dice

    const minValue = Math.min(...validResults.map(item => item.value));
    
    // Find the first die with the minimum value (only re-roll one)
    const dieToReroll = validResults.find(item => item.value === minValue);
    
    if (!dieToReroll) return; // Shouldn't happen but just in case
    
    // Set reroll mode and store the value being rerolled
    setIsRerolling(true);
    setRerolledValue(minValue);
    
    // Only re-roll this single die
    setRerollIndices([dieToReroll.index]);
    
    // Reset settled state for this die
    setDiceSettled(prev => {
      const newSettled = [...prev];
      newSettled[dieToReroll.index] = false;
      return newSettled;
    });
    
    // Clear result for this die
    setDiceResults(prev => {
      const newResults = [...prev];
      newResults[dieToReroll.index] = null;
      return newResults;
    });
    
    // Reset re-roll indices after a brief delay to enable triggering the dice
    setTimeout(() => {
      setRerollIndices([]);
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
    
    // Calculate provisional sum from latest results
    // This runs whenever any die updates its value
    setTimeout(() => {
      const currentTotal = diceResults.reduce((sum, value) => sum + (value || 0), 0);
      setProvisionalSum(currentTotal > 0 ? currentTotal : null);
    }, 0);
  };
  
  // Calculate total of all dice
  const totalValue = diceResults.reduce((sum, value) => sum + (value || 0), 0);
  
  // Count how many dice are settled
  const settledCount = diceSettled.filter(Boolean).length;
  
  // Track when all dice are settled and update last roll
  useEffect(() => {
    // Only update the last roll when all dice are settled and we have a valid total
    if (
      settledCount === diceCount && 
      diceCount > 0 && 
      totalValue > 0 && 
      !isRolling
    ) {
      setLastRollSum(totalValue);
      setProvisionalSum(null); // Clear provisional sum when all dice are settled
      
      // Exit reroll mode when all dice are settled
      if (isRerolling && settledCount === diceCount) {
        setIsRerolling(false);
        setRerolledValue(null);
      }
    }
  }, [settledCount, diceCount, totalValue, isRolling]);
  
  // Helper function to calculate dice position based on index
  const getDicePosition = (index) => {
    // Calculate which row and column this die belongs to
    let row = 0;
    let diceInPreviousRows = 0;
    
    // Find which row this die belongs to
    while (true) {
      const diceInRow = CANVAS_DIMENSIONS.ROW_PATTERN[row % CANVAS_DIMENSIONS.ROW_PATTERN.length];
      if (index < diceInPreviousRows + diceInRow) {
        break;
      }
      diceInPreviousRows += diceInRow;
      row++;
    }
    
    // Calculate position within that row
    const col = index - diceInPreviousRows;
    
    // Get dice count for this row
    const diceInRow = CANVAS_DIMENSIONS.ROW_PATTERN[row % CANVAS_DIMENSIONS.ROW_PATTERN.length];
    
    // Calculate actual dimensions of dice elements
    const dieWidth = CANVAS_DIMENSIONS.WIDTH;
    const dieHeight = CANVAS_DIMENSIONS.HEIGHT;
    const containerWidth = 650; // Container width in px
    
    // Calculate effective width accounting for overlapping dice
    const effectiveWidth = dieWidth - CANVAS_DIMENSIONS.OVERLAP;
    
    // Calculate total width needed for this row
    const rowWidth = diceInRow * effectiveWidth + CANVAS_DIMENSIONS.OVERLAP; // Add back one overlap for the last die
    
    // Center the row within the container
    const rowStartX = (containerWidth - rowWidth) / 2;
    
    // Calculate vertical spacing with adjusted offset to center dice
    const totalRows = calculateRowsNeeded(diceCount);
    const totalRowHeight = totalRows * (dieHeight - CANVAS_DIMENSIONS.OVERLAP / 2);
    const containerHeight = totalRows * (dieHeight - CANVAS_DIMENSIONS.OVERLAP / 2) + 50;
    
    // Use a smaller or negative value to move dice down (was 20)
    const verticalAdjustment = 7; // Set to 0 for perfect centering or negative to move down
    const verticalOffset = (containerHeight - totalRowHeight) / 2 - verticalAdjustment;
    
    // Calculate exact position for this die
    return {
      left: rowStartX + col * effectiveWidth,
      top: verticalOffset + row * (dieHeight - CANVAS_DIMENSIONS.OVERLAP / 2)
    };
  };
  
  // Helper function to calculate actual number of rows needed based on dice count
  const calculateRowsNeeded = (count) => {
    let remainingDice = count;
    let rowIndex = 0;
    
    while (remainingDice > 0) {
      const diceInRow = CANVAS_DIMENSIONS.ROW_PATTERN[rowIndex % CANVAS_DIMENSIONS.ROW_PATTERN.length];
      remainingDice -= diceInRow;
      rowIndex++;
    }
    
    return rowIndex;
  };
  
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
          className="w-full cursor-pointer"
        />
      </div>
      
      <div className="flex space-x-4 mb-4">
        <button 
          className="px-4 py-2 bg-blue-500 text-white rounded transition-transform hover:bg-blue-600 active:bg-blue-700" 
          onClick={rollAllDice}
          disabled={isRolling}
          style={{
            transform: rollButtonPressed ? `scale(${BUTTON_ANIMATION.SCALE_DOWN})` : 'scale(1)',
            transition: BUTTON_ANIMATION.TRANSITION,
            cursor: isRolling ? 'not-allowed' : 'pointer'
          }}
          onMouseDown={() => setRollButtonPressed(true)}
          onMouseUp={() => setRollButtonPressed(false)}
          onMouseLeave={() => setRollButtonPressed(false)}
        >
          Roll All Dice
        </button>
        
        <button 
          className="px-4 py-2 bg-green-500 text-white rounded transition-transform hover:bg-green-600 active:bg-green-700" 
          onClick={rerollLowestDice}
          disabled={isRolling || diceSettled.filter(Boolean).length < 1}
          style={{
            transform: rerollButtonPressed ? `scale(${BUTTON_ANIMATION.SCALE_DOWN})` : 'scale(1)',
            transition: BUTTON_ANIMATION.TRANSITION,
            cursor: (isRolling || diceSettled.filter(Boolean).length < 1) ? 'not-allowed' : 'pointer'
          }}
          onMouseDown={() => setRerollButtonPressed(true)}
          onMouseUp={() => setRerollButtonPressed(false)}
          onMouseLeave={() => setRerollButtonPressed(false)}
        >
          Re-roll Lowest Die
        </button>
      </div>
      
      <div className="border border-solid border-gray-300 rounded-lg mb-4 relative" 
           style={{ 
             width: '650px',
             height: `${calculateRowsNeeded(diceCount) * 
                      (CANVAS_DIMENSIONS.HEIGHT - CANVAS_DIMENSIONS.OVERLAP / 2) + 50}px`
           }}>
        {Array.from({ length: diceCount }, (_, index) => {
          const position = getDicePosition(index);
          
          return (
            <div 
              key={index}
              style={{
                position: 'absolute',
                left: `${position.left}px`,
                top: `${position.top}px`,
                zIndex: isRolling ? index : (diceSettled[index] ? index * 2 : index)
              }}
            >
              <SingleDie 
                rollTrigger={isRolling} 
                rerollTrigger={rerollIndices.includes(index)} // Pass re-roll trigger
                dieIndex={index}
                onDiceUpdate={(result, isSettled) => handleDiceUpdate(index, result, isSettled)}
              />
            </div>
          );
        })}
      </div>
      
      {/* Results display - moved to the bottom */}
      <div className="text-center mb-6">
        <p className="font-bold">
          {diceResults.map((r, i) => (
            <React.Fragment key={i}>
              <span className={diceSettled[i] ? "text-green-600" : "text-gray-600"}>
                {r || '?'}
              </span>
              <span>
                {i < diceResults.length - 1 ? ' + ' : ''}
              </span>
            </React.Fragment>
          ))} = {totalValue}
        </p>
        <p className="text-sm mt-1">{settledCount}/{diceCount} dice settled</p>
      </div>
      
      {/* New simplified histogram component */}
      <div className="w-full max-w-2xl mt-6">
        <IdealDistributionHistogram 
          diceCount={diceCount} 
          lastRoll={lastRollSum} 
          provisionalRoll={provisionalSum}
          isRerolling={isRerolling}
          rerolledValue={rerolledValue}
          currentDiceValues={diceResults.filter(v => v !== null && v !== undefined)}
        />
      </div>
    </div>
  );
}

// New simplified component that only shows ideal distribution and highlights last roll
function IdealDistributionHistogram({ 
  diceCount, 
  lastRoll, 
  provisionalRoll,
  isRerolling,
  rerolledValue,
  currentDiceValues
}) {
  // Calculate min and max possible values based on dice count
  const minValue = diceCount;
  const maxValue = diceCount * 6;
  
  // Initialize counts for each possible sum
  const possibleSums = maxValue - minValue + 1;
  
  // Calculate the theoretical probability distribution for the given number of dice
  const theoreticalDistribution = useMemo(() => {
    // If we're in normal mode, calculate standard distribution
    if (!isRerolling) {
      // Create array to store probabilities
      const distribution = Array(possibleSums).fill(0);
      
      if (diceCount === 1) {
        // For 1 die, all outcomes are equally likely (1/6)
        distribution.fill(1/6);
      } else {
        // For multiple dice, calculate using combinatorial probability
        // This uses dynamic programming to compute probabilities efficiently
        
        // First, create a table to hold intermediate results
        // ways[d][s] = # of ways to get sum s with d dice
        const ways = Array(diceCount + 1).fill().map(() => Array(maxValue + 1).fill(0));
        
        // With 1 die, there's 1 way to get each face value
        for (let face = 1; face <= 6; face++) {
          ways[1][face] = 1;
        }
        
        // Fill in the table for 2+ dice
        for (let d = 2; d <= diceCount; d++) {
          for (let s = d; s <= d * 6; s++) {
            // For each possible value of the current die (1-6)
            for (let face = 1; face <= 6; face++) {
              if (s - face >= d - 1) { // Ensure we don't go below minimum possible sum
                ways[d][s] += ways[d-1][s-face];
              }
            }
          }
        }
        
        // Convert raw counts to probabilities
        const totalOutcomes = Math.pow(6, diceCount);
        for (let s = minValue; s <= maxValue; s++) {
          distribution[s - minValue] = ways[diceCount][s] / totalOutcomes;
        }
      }
      
      return distribution;
    } else {
      // We're rerolling one die, so calculate a skewed distribution
      return calculateRerollDistribution(
        diceCount, 
        currentDiceValues, 
        rerolledValue, 
        minValue, 
        maxValue
      );
    }
  }, [diceCount, minValue, maxValue, possibleSums, isRerolling, currentDiceValues, rerolledValue]);
  
  // Find the maximum probability for normalization
  const maxProbability = Math.max(...theoreticalDistribution);
  
  // Calculate bar width based on number of possible outcomes
  const barWidth = `calc((100% - ${(possibleSums - 1) * HISTOGRAM.BAR_SPACING}px) / ${possibleSums})`;
  
  return (
    <div className="border-t border-gray-200 pt-2 mt-2">
      {/* Minimal header - shows last roll or provisional roll if available */}
      <div className="flex justify-between items-center mb-1">
        <div className="text-xs text-gray-500">
          {isRerolling && <span>Reroll distribution <span className="text-purple-700">(lowest: {rerolledValue})</span></span>}
          {!isRerolling && <span>Probability distribution</span>}
        </div>
        {(lastRoll || provisionalRoll) && (
          <div className="text-xs text-gray-500">
            {lastRoll ? (
              <span>Last: <span className="text-violet-600 font-medium">{lastRoll}</span></span>
            ) : provisionalRoll ? (
              <span>Current: <span className="text-violet-400 font-medium">{provisionalRoll}</span></span>
            ) : null}
          </div>
        )}
      </div>
      
      {/* Histogram bars */}
      <div className="flex items-end h-[100px]">
        {theoreticalDistribution.map((probability, index) => {
          const value = index + minValue;
          // Scale to use full height
          const heightPixels = Math.max(Math.round(probability / maxProbability * 90), 1);
          const isLastRoll = value === lastRoll;
          const isProvisionalRoll = value === provisionalRoll && !isLastRoll;
          
          return (
            <div 
              key={index}
              className="flex flex-col items-center"
              style={{ 
                width: barWidth,
                marginRight: index < possibleSums - 1 ? `${HISTOGRAM.BAR_SPACING}px` : 0
              }}
            >
              {/* The theoretical probability bar */}
              <div 
                className={`w-full rounded-t-sm transition-colors duration-200`}
                style={{ 
                  height: `${heightPixels}px`,
                  backgroundColor: isLastRoll 
                    ? HISTOGRAM.HIGHLIGHT_COLOR 
                    : isProvisionalRoll 
                      ? HISTOGRAM.PROVISIONAL_COLOR 
                      : isRerolling
                        ? HISTOGRAM.REROLL_COLOR
                        : HISTOGRAM.IDEAL_COLOR,
                }}
              />
              
              {/* Minimal label - only the number */}
              <div className={`text-xs mt-1 ${
                isLastRoll 
                  ? 'text-violet-600 font-medium' 
                  : isProvisionalRoll 
                    ? 'text-violet-400 font-medium' 
                    : isRerolling
                      ? 'text-purple-700'
                      : 'text-gray-400'
              }`}>
                {value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper function to calculate distribution when rerolling one die
function calculateRerollDistribution(
  diceCount, 
  currentValues, 
  rerolledValue, 
  minValue, 
  maxValue
) {
  // Initialize distribution array
  const possibleSums = maxValue - minValue + 1;
  const distribution = Array(possibleSums).fill(0);
  
  // If we don't have enough information, return flat distribution
  if (currentValues.length === 0 || rerolledValue === null) {
    return distribution.fill(1/possibleSums);
  }
  
  // Calculate the sum of dice that we're keeping (all except the one being rerolled)
  const keptSum = currentValues.reduce((sum, val) => sum + val, 0) - (rerolledValue || 0);
  
  // For each possible outcome of the rerolled die (1-6)
  for (let newValue = 1; newValue <= 6; newValue++) {
    // Calculate the new total
    const newSum = keptSum + newValue;
    
    // Ensure the sum is within our range
    if (newSum >= minValue && newSum <= maxValue) {
      // Add 1/6 probability for this outcome
      distribution[newSum - minValue] += 1/6;
    }
  }
  
  return distribution;
}

// Single die component - converted from original Dice component
function SingleDie({ rollTrigger, rerollTrigger, dieIndex, onDiceUpdate }) {
  const [showDice, setShowDice] = useState(false);
  const [dicePosition, setDicePosition] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [shouldFadeOut, setShouldFadeOut] = useState(false);
  const [dpr, setDpr] = useState(1);
  const lastRollTrigger = useRef(rollTrigger);
  const lastRerollTrigger = useRef(rerollTrigger);
  const [diceResult, setDiceResult] = useState(null);
  const [isSettled, setIsSettled] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDpr(window.devicePixelRatio);
    }
  }, []);
  
  // Detect roll trigger changes (for rolling all dice)
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
  
  // Detect re-roll trigger changes (for specific dice)
  useEffect(() => {
    if (rerollTrigger !== lastRerollTrigger.current) {
      lastRerollTrigger.current = rerollTrigger;
      if (rerollTrigger) {
        rollDice();
        setDiceResult(null); // Reset result when rolling again
        setIsSettled(false); // Reset settled state
      }
    }
  }, [rerollTrigger]);
  
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
          height: CANVAS_DIMENSIONS.HEIGHT,
          cursor: 'default' // Always use default cursor regardless of dice state
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
