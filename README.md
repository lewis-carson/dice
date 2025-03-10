# 3D Dice Roller

A physics-based 3D dice rolling application built with React, Three.js, and React Three Fiber. Roll virtual dice with realistic physics and animations.

Demo: https://dice.lewiscarson.co.uk

## Technologies Used

- [Next.js](https://nextjs.org/) - React framework
- [Three.js](https://threejs.org/) - 3D graphics library
- [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) - React renderer for Three.js
- [@react-three/rapier](https://github.com/pmndrs/react-three-rapier) - Physics engine
- [Tailwind CSS](https://tailwindcss.com/) - Styling

## Getting Started

### Prerequisites

- Node.js 14.x or higher
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/lewiscarson/dice.git
cd dice
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## How It Works

The application uses a combination of Three.js for rendering and Rapier physics engine to simulate realistic dice rolls. Each die is a 3D cube with rounded corners that responds to gravity and collisions. The application detects which face is up when the dice settle to determine the roll result.
