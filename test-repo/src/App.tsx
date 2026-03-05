import React from 'react';
import './styles.css';

export default function App() {
  return (
    <div>
      <header className="header">
        <h1>My App</h1>
      </header>
      
      <main>
        <button className="button button-primary">
          Click Me
        </button>
        
        <button className="button button-secondary">
          Cancel
        </button>
      </main>
      
      <footer className="footer">
        <p>&copy; 2024</p>
      </footer>
    </div>
  );
}

