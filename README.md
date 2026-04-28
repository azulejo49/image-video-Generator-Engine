# The Bizarre Imaginarium

A powerful, visually striking web application for AI video generation powered by Google's Gemini models and Veo. It provides a highly stylized "director's cut" interface for generating surreal, eerie, and visually stunning videos from text prompts, image inputs, and video inputs.

## Features

- **Text-to-Video (`TXT2VID`)**: Generate compelling videos from textual descriptions.
- **Image-to-Video (`IMG2VID`)**: Animate and evolve uploaded images into videos.
- **Video-to-Video (`VID2VID`)**: Upload a source video and transform it using advanced prompt guidance.
- **"Freakify" Prompt Enhancement**: An integrated Gemini 3.1 Pro Preview assist that takes a basic concept and expands it into a highly descriptive, surreal, and visually striking "director's cut" prompt.
- **Video Output Duration Control**: Select from predefined durations (5s, 10s, 1m, 5m, 10m) or enter a custom duration.
- **Advanced Modifiers**: Apply specific video transformations and actions such as:
  - Extend Video
  - Face + Voice Swaps
  - Transcript Editing
  - Language Translation & Accent Shifting
  - Tone Changes & Speech Speed Control
- **Special Instructions**: Add specific directorial notes (e.g., dramatic lighting, slow motion, specific camera angles).

## Architecture

- **Frontend**: Built with React, TypeScript, and Tailwind CSS.
- **Animations**: Powered by `motion/react` for smooth, cinematic transitions.
- **Icons**: `lucide-react`.
- **Backend / API**: Node.js/Express server providing the backend wrapper for Gemini/Veo video generation (`/api/generate-video`).

## Setup and Development

This project uses React (Vite) and an Express backend.

### Prerequisites

Ensure you have your environment variables configured, specifically for the Gemini API:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Running the App

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server (runs the integrated Express + Vite server):
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

4. Start the production server:
   ```bash
   npm start
   ```

## Usage Notes

- The application uses the `window.aistudio` object for AI Studio specific API key handling. If used outside AI Studio, ensure your environment variables are correctly set.
- Generation utilizes Veo models via the Gemini API wrapper logic. Ensure your provided API Key has access to Veo video generation endpoints.
