import "./TopBar.css";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import Container from "react-bootstrap/Container";
import { Button } from "react-bootstrap";

const TopBar = () => {
  const darkMode = () => {
    document.querySelector(".bd").classList.remove("light-class");
    document.querySelector(".bd").classList.add("dark-class");
  };

  const LightMode = () => {
    document.querySelector(".bd").classList.remove("dark-class");
    document.querySelector(".bd").classList.add("light-class");
  };

  return (
    <div>
      <Navbar
        expand="lg"
        className="navbar shadow-sm"
        style={{ position: "fixed" }}
      >
        <Container>
          <Navbar.Brand href="#hero">
            <span
              style={{ fontSize: "24px", fontWeight: "bold", color: "#1B365D" }}
            >
              grizzen
            </span>
          </Navbar.Brand>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="mobile-toggle toggle-div pull-right">
              <div className="light-button" onClick={LightMode}></div>
              <div className="dark-button" onClick={darkMode}></div>
            </div>
            <Navbar.Toggle aria-controls="basic-navbar-nav" className="menu" />
          </div>
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="ms-auto text-center d-flex justify-content-center align-items-center">
              <Nav.Link href="#hero" className="navbar-link">
                Home
              </Nav.Link>
              <Nav.Link href="#features" className="navbar-link">
                Features
              </Nav.Link>
              <Nav.Link href="#testimonial" className="navbar-link">
                Testimonials
              </Nav.Link>
              <Nav.Link href="#how" className="navbar-link">
                How it works
              </Nav.Link>
              <Nav.Link
                href="#"
                className="navbar-link text-decoration-none border-0"
              >
                <div className="buttons">
                  <Button
                    size="sm"
                    className="login text-decoration-none border-0"
                  >
                    login
                  </Button>
                  <Button
                    size="sm"
                    className="register text-decoration-none border-0"
                  >
                    Sign up
                  </Button>
                </div>
              </Nav.Link>

              <div className="desktop-toggle toggle-div">
                <div className="light-button" onClick={LightMode}></div>
                <div className="dark-button" onClick={darkMode}></div>
              </div>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </div>
  );
};

export default TopBar;
