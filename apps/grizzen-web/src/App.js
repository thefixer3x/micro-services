import React, { useState, useEffect } from 'react';
import './App.css';
import TopBar from './components/TopBar.js';
import Home from './pages/Home.js'
import Footer from './components/Footer.js'

// Preloader Component
function Preloader() {
  return (
    <div className="preloader">
      <div className="spinner-border" role="status">
        <span className="">grizzen...</span>
      </div>
    </div>
  );
}

// Main App Component
function App() {
  const [loading, setLoading] = useState(true);
  // const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Simulate a loading delay (e.g., fetching data or assets)
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <Preloader />;
  }

 

  return (
    <div>
      
      <div className="bd light-class">
        <TopBar/>
        <Home/>
        <Footer/>
      </div>
    </div>
  );
}

export default App;

