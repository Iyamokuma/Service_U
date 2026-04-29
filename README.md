# Service Unit Registration — React 19 App

Drop-in React 19 + Vite project.

## Setup

```bash
cd react-app
npm install
npm run dev
```

Opens at http://localhost:5173.

## Build for production

```bash
npm run build
```

Outputs to `react-app/dist/`.

## Structure

```
react-app/
├── index.html              # Vite entry (loads src/main.jsx)
├── package.json            # React 19 + Vite 6
├── vite.config.js
└── src/
    ├── main.jsx            # ReactDOM.createRoot
    ├── App.jsx             # Main form, state, validation
    ├── styles.css          # All design tokens + component styles
    ├── data.js             # Constants, validators, SERVICE_UNITS, NATIONALITIES, etc.
    ├── components/         # Reusable primitives
    │   ├── Field.jsx
    │   ├── Inputs.jsx      # TextInput, TextArea, Select
    │   ├── RadioGroup.jsx
    │   ├── Collapse.jsx
    │   ├── DateSplit.jsx
    │   └── Dropzone.jsx
    └── sections/           # Form sections
        ├── SectionHead.jsx
        ├── PersonalSection.jsx
        ├── ContactSection.jsx
        ├── WorkSection.jsx
        ├── PhotoSection.jsx
        ├── FaithSection.jsx
        └── ServiceUnitSection.jsx
```

## Notes

- Every file uses standard ES-module `import`/`export`. No globals, no Babel-in-browser.
- React 19 + hooks only. No class components.
- The single source of truth for layout and colors is `src/styles.css`.
- To hook up the submit action, edit `onSubmit` in `src/App.jsx` (currently just shows a success screen).
- Fonts come from Google Fonts via `<link>` in `index.html` — no font files to ship.

## Embedding into an existing project

If you already have a React app, copy `src/components/`, `src/sections/`, `src/data.js`, `src/App.jsx`, and `src/styles.css` into your project. Make sure your project supports JSX and has `react` + `react-dom` ≥ 19 installed.
