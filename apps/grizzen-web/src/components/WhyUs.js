import React from "react";
import "./WhyUs.css";

const Slider = () => {
  return (
    <section className="why-us">
      <h2 className="section-heading">-Why Teams Choose grizzen</h2>
      <p className="section-subheading">
        From day one, grizzen gives you control, transparency, and peace of
        mind. <br></br> Scale from MVP to market leader without payment
        complexity.
      </p>
      <div className="why-us-content" id="">
        <div className="slide">
          <h4>Instant Payouts</h4>
          <p>
            No delays, no surprises. Payments settle in hours, not days.
            Contractors and team members get paid when promised, building trust
            across your network.
          </p>
        </div>
        <div className="slide">
          <h4>Simple Integration</h4>
          <p>
            REST APIs, webhooks, and native integrations with Stripe,
            QuickBooks, and more. Connect grizzen to your stack in minutes.
          </p>
        </div>
        <div className="slide">
          <h4>Full Visibility</h4>
          <p>
            Real-time dashboards show you transaction status, FX rates, fees,
            and compliance details. Export reports for your accountant with one
            click.
          </p>
        </div>
        <div className="slide">
          <h4>Global Compliance Built-In</h4>
          <p>
            We handle AML/KYC, tax reporting, and local regulations for 100+
            countries. You stay compliant without the legal overhead.
          </p>
        </div>
        <div className="slide">
          <h4>Support When You Need It</h4>
          <p>
            Dedicated support team ready to help with setup, troubleshooting, or
            scaling your payment infrastructure.
          </p>
        </div>
      </div>

      <div className="mobileslider">
        <div className="slide">
          <h4>Instant Payouts</h4>
          <p>
            No delays, no surprises. Payments settle in hours, not days.
            Contractors and team members get paid when promised, building trust
            across your network.
          </p>
        </div>
        <div className="slide">
          <h4>Simple Integration</h4>
          <p>
            REST APIs, webhooks, and native integrations with Stripe,
            QuickBooks, and more. Connect grizzen to your stack in minutes.
          </p>
        </div>
        <div className="slide">
          <h4>Full Visibility</h4>
          <p>
            Real-time dashboards show you transaction status, FX rates, fees,
            and compliance details. Export reports for your accountant with one
            click.
          </p>
        </div>
        <div className="slide">
          <h4>Global Compliance Built-In</h4>
          <p>
            We handle AML/KYC, tax reporting, and local regulations for 100+
            countries. You stay compliant without the legal overhead.
          </p>
        </div>
        <div className="slide">
          <h4>Support When You Need It</h4>
          <p>
            Dedicated support team ready to help with setup, troubleshooting, or
            scaling your payment infrastructure.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Slider;
