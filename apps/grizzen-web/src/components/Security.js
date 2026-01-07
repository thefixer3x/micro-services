import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
import "./Security.css";
import securityimg from "../assets/securityimg-nobg.png";

const Security = () => {
  const fadeUpRef = useRef(null);
  const fadeUpInView = useInView(fadeUpRef, {
    triggerOnce: true,
    margin: "-50px",
  });

  const fadeRightRef = useRef(null);
  const fadeRightInView = useInView(fadeRightRef, {
    triggerOnce: true,
    margin: "-50px",
  });

  return (
    <div className="container">
      <div className="security">
        <div className="security-left">
          <motion.div
            ref={fadeUpRef}
            className="box fade-up"
            initial={{ opacity: 0, y: 50 }}
            animate={fadeUpInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1 }}
          >
            <h3>Security & Compliance</h3>
            <p>
              grizzen adheres to stringent Anti-Money Laundering (AML) and Know
              Your Customer (KYC) regulations to prevent illicit financial
              activities. We verify user identities and monitor transactions for
              suspicious behavior.
            </p>

            <div class="accordion" id="faqAccordion">
              <div class="accordion-item">
                <h2 class="accordion-header" id="headingOne">
                  <button
                    class="accordion-button"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#collapseOne"
                    aria-expanded="true"
                    aria-controls="collapseOne"
                  >
                    AML & KYC Compliance
                  </button>
                </h2>
                <div
                  id="collapseOne"
                  class="accordion-collapse collapse show"
                  aria-labelledby="headingOne"
                  data-bs-parent="#faqAccordion"
                >
                  <div class="accordion-body">
                    grizzen adheres to stringent Anti-Money Laundering (AML) and
                    Know Your Customer (KYC) regulations to prevent illicit
                    financial activities. We verify user identities and monitor
                    transactions for suspicious behavior.
                  </div>
                </div>
              </div>
              <div class="accordion-item">
                <h2 class="accordion-header" id="headingTwo">
                  <button
                    class="accordion-button collapsed"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#collapseTwo"
                    aria-expanded="false"
                    aria-controls="collapseTwo"
                  >
                    Fraud Detection & Prevention
                  </button>
                </h2>
                <div
                  id="collapseTwo"
                  class="accordion-collapse collapse"
                  aria-labelledby="headingTwo"
                  data-bs-parent="#faqAccordion"
                >
                  <div class="accordion-body">
                    Our advanced fraud detection system leverages AI-driven
                    algorithms to identify and block fraudulent transactions in
                    real time, ensuring secure money transfers.
                  </div>
                </div>
              </div>
              <div class="accordion-item">
                <h2 class="accordion-header" id="headingThree">
                  <button
                    class="accordion-button collapsed"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#collapseThree"
                    aria-expanded="false"
                    aria-controls="collapseThree"
                  >
                    Real-Time Sanctions Screening
                  </button>
                </h2>
                <div
                  id="collapseThree"
                  class="accordion-collapse collapse"
                  aria-labelledby="headingThree"
                  data-bs-parent="#faqAccordion"
                >
                  <div class="accordion-body">
                    We continuously screen transactions against global sanctions
                    lists, ensuring compliance with international regulatory
                    requirements and preventing illegal transactions.
                  </div>
                </div>
              </div>

              <div class="accordion-item">
                <h2 class="accordion-header" id="headingFour">
                  <button
                    class="accordion-button collapsed"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#collapseFour"
                    aria-expanded="false"
                    aria-controls="collapseFour"
                  >
                    Data Privacy & Protection
                  </button>
                </h2>
                <div
                  id="collapseFour"
                  class="accordion-collapse collapse"
                  aria-labelledby="headingFour"
                  data-bs-parent="#faqAccordion"
                >
                  <div class="accordion-body">
                    grizzen is fully compliant with GDPR and NDPR, safeguarding
                    user data through encryption, strict access controls, and
                    transparent data policies.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="security-right">
          <img src={securityimg} alt="" />
        </div>
      </div>
    </div>
  );
};

export default Security;
