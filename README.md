# Froggy Frequency: Sound-Powered Jetpack Edition (V8.3)

Welcome to the latest version of Froggy Frequency! This update introduces the **Jetpack Challenge**, a new gameplay mode focused on sustained speech practice.

## New Features
- **Jetpack Mode:** Toggle "Jetpack Challenge" from the category menu to switch to vertical ascent gameplay.
- **Continuous Lift Physics:** The frog now stays in the air as long as sound is detected. Longer sounds provide higher lift.
- **Rainbow Bubble Particles:** Visual feedback that changes color based on the duration of the sustained sound.
- **Star-Fly Objective:** A high-altitude goal that encourages children to maintain their voice for longer periods.

## File Changes
- `index.html`: Added Jetpack mode to the selection UI.
- `game.js`: Implemented the Jetpack engine, particle systems, and goal collision.
- `arduino_code/froggy_frequency.ino`: Updated with "Jetpack Pulse" LED feedback for hardware synchronization.
- `backups/`: Contains pre-jetpack versions of the code for stability.

## How to use Jetpack Mode
1. Start the game.
2. Select **Jetpack Challenge** from the dropdown.
3. Use a sustained "Ahhh" or "Moo" sound to lift the frog.
4. Reach the Star-Fly at the top to win!
