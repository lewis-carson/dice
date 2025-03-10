# 3D Dice Roller

A physics-based 3D dice rolling application built with React, Three.js, and React Three Fiber. Roll virtual dice with realistic physics and animations.

## Features

- 🎲 Realistic 3D dice with physics-based rolling
- 🔢 Adjustable dice count (1-9 dice)
- 📱 Responsive design works on desktop and mobile
- 🎯 Accurate dice face detection
- 🎬 Smooth animations and transitions
- 📊 Real-time result tracking with sum calculation

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

## Usage

- Use the slider to select the number of dice you want to roll (1-9)
- Click the "Roll All Dice" button to roll the dice
- The current values and sum of all dice will be displayed below
- Green numbers indicate settled dice, while gray numbers are still in motion

## How It Works

The application uses a combination of Three.js for rendering and Rapier physics engine to simulate realistic dice rolls. Each die is a 3D cube with rounded corners that responds to gravity and collisions. The application detects which face is up when the dice settle to determine the roll result.

## Performance Considerations

The app is optimized for performance with:
- Efficient physics calculations
- On-demand rendering
- Proper memory management
- Adaptive quality based on device capabilities

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- React Three Fiber team for making Three.js accessible in React
- Three.js community for the incredible 3D graphics library
