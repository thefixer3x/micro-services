import "./CoreMessage.css";

import worldimg from "../assets/world1.jpg";
import worldconnect from "../assets/worldconnect.png";

const coreMessage = () => {
  return (
    <div>
      <section className="core">
        <div className="core-content">
          <div className="core-left trust">
            <div
              style={{
                background: "linear-gradient(135deg, #1B365D 0%, #00D4AA 100%)",
                height: "300px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "48px",
                fontWeight: "bold",
              }}
            >
              🔒
            </div>
          </div>

          <div className="core-right">
            <h2>Enterprise-Grade Security</h2>
            <p>
              Built for teams that demand reliability. grizzen uses
              industry-leading encryption, multi-factor authentication, and
              real-time fraud detection to keep your payments secure. You can
              trust us with your team's livelihood.
            </p>
          </div>
        </div>

        <div className="market-content">
          <div className="core-left market">
            <h2>Scale Globally, Manage Locally</h2>
            <p>
              Whether you're hiring contractors in Southeast Asia, vendors in
              Europe, or building a remote team across continents, grizzen makes
              it simple. Pay everyone in their local currency, on their local
              schedule, with one unified dashboard.
            </p>
          </div>

          <div className="core-right">
            <img src={worldconnect} alt="" />
          </div>
        </div>

        <div className="core-content">
          <div className="core-left innovation">
            <img src={worldimg} alt="" />
          </div>

          <div className="core-right">
            <h2>Built for Modern Operations</h2>
            <p>
              API-first architecture means grizzen integrates seamlessly with
              your stack. Automate payroll runs, sync with your accounting
              system, and eliminate manual payment workflows. More automation,
              fewer headaches.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default coreMessage;
