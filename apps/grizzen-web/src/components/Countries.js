import { useEffect, useState } from "react";
import './Countries.css'
import 'react-bootstrap'


const Countries = () => {
    const [countries, setCountries] = useState([]);
    const [viewAll, setViewAll] = useState(false);
  
    useEffect(() => {
      fetch("https://restcountries.com/v3.1/all")
        .then((response) => response.json())
        .then((data) => setCountries(data));
    }, []);

    return (
        <div className="countries">
            <h2 className="title">- Country Flags and Names</h2>
            <button className="toggle-button" onClick={() => setViewAll(!viewAll)}>
                    {viewAll ? "View Less" : "View All"}
                </button>
                <div className="countries-grid">
                    {countries.slice(0, viewAll ? countries.length : 20).map((country, index) => (
                    <div key={index} className="country-item">
                        <img src={country.flags.png} alt={country.name.common} className="flag" />
                        <span className="country-name">{country.name.common}</span>
                    </div>
                    ))}
                </div>
        </div>
    );
}

export default Countries;