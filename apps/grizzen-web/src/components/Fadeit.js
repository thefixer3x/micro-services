import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
import "./ScrollAnimations.css"; // CSS styles

const Fadeit = () => {
  const fadeUpRef = useRef(null);
  const fadeUpInView = useInView(fadeUpRef, { triggerOnce: true, margin: "-50px" });

  const fadeInRef = useRef(null);
  const fadeInInView = useInView(fadeInRef, { triggerOnce: true, margin: "-50px" });

  return (
    <div className="scroll-container">
      {/* Fade-Up Animation */}
      <motion.div
        ref={fadeUpRef}
        className="box fade-up"
        initial={{ opacity: 0, y: 50 }}
        animate={fadeUpInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 5 }}
      >
        <h2>Fade-Up Animation</h2>
      </motion.div>

      {/* Fade-In Animation */}
      <motion.div
        ref={fadeInRef}
        className="box fade-in"
        initial={{ opacity: 0 }}
        animate={fadeInInView ? { opacity: 1 } : {}}
        transition={{ duration: 5 }}
      >
        <h2>Fade-In Animation</h2>
      </motion.div>
    </div>
  );
};

export default Fadeit;
