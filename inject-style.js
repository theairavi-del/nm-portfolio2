const fs = require('fs');
const path = '/Users/raviclaw/.openclaw/workspace/nm-portfolio2/work/index.html';
let html = fs.readFileSync(path, 'utf8');

const newCSS = `
    <style>
        /* ORAGE-STYLE LOADER & HERO */
        .loader-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: #000;
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            transition: opacity 0.8s ease-in-out, visibility 0.8s;
        }

        .loader-content {
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 80%;
            max-width: 600px;
        }

        .loader-overlay.hidden {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
        }

        .loader-bar-container {
            width: 100%;
            height: 2px;
            background: #333;
            margin-top: 20px;
            position: relative;
            overflow: hidden;
        }

        .loader-bar {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            background: #fff;
            width: 0%;
            transition: width 0.1s linear;
        }

        .orage-hero {
            position: relative;
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 40px;
            z-index: 900;
        }

        .orage-video-bg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            object-fit: cover;
            z-index: -1;
            filter: brightness(0.6);
        }

        .orage-nav {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-size: 14px;
            position: relative;
            z-index: 901;
        }

        .orage-logo {
            font-weight: bold;
            letter-spacing: 2px;
            font-size: 18px;
            cursor: pointer;
        }

        .orage-menu {
            display: flex;
            gap: 40px;
        }

        .orage-menu a {
            color: #fff;
            text-decoration: none;
            position: relative;
            cursor: pointer;
        }

        .orage-menu a::after {
            content: '';
            position: absolute;
            bottom: -4px;
            left: 0;
            width: 0%;
            height: 1px;
            background: #fff;
            transition: width 0.3s;
        }

        .orage-menu a:hover::after {
            width: 100%;
        }

        .orage-title {
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: clamp(60px, 12vw, 160px);
            font-weight: 700;
            line-height: 0.85;
            letter-spacing: -2px;
            text-transform: uppercase;
            margin: 0;
            position: relative;
            z-index: 901;
        }

        @media (max-width: 768px) {
            .orage-hero { padding: 20px; }
            .orage-menu { display: none; }
            .orage-title { font-size: 40px; }
        }

        /* Adjust original app-shell so it flows naturally after the 100vh hero */
        .topbar {
            position: absolute !important;
            top: 100vh !important;
            transition: position 0s, top 0s;
        }
        
        .topbar.sticky {
            position: fixed !important;
            top: 0 !important;
        }
    </style>
`;

html = html.replace('<body>\\n', newCSS + '\\n<body>\\n');
fs.writeFileSync(path, html, 'utf8');
console.log('Styles injected!');
