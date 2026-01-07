import "./testimony.css";
import kenya from "../assets/kenya.png";
import nigeria from "../assets/nigeria.png";
import southafrica from "../assets/southafrica.png";

const testimony = () => {
  return (
    <div>
      <section className="testimonials" id="testimonial">
        <div className="testimonial-titles">
          <h2 className="">- Trusted by Global Teams</h2>
          <p className="">
            From startups to scale-ups, thousands of companies rely on grizzen
            to power their team payments and global payouts.
          </p>
        </div>

        <div className="testimonial-contents">
          <div className="testimonial-content">
            <div className="testimonial-header">
              <img src={nigeria} alt="customer-1" />
              <h3>Startup Founder, Nigeria</h3>
            </div>
            <i class="fa fa-quote-left "></i>
            <p>
              We manage a 20-person remote team across 8 countries. Before
              grizzen, payroll was a nightmare—currency conversions, bank fees,
              delays. Now we pay everyone in minutes from one dashboard. It's
              cut our ops time by 80%."
            </p>
          </div>

          <div className="testimonial-content">
            <div className="testimonial-header">
              <img src={kenya} alt="customer-2" />
              <h3>SaaS Founder, Kenya</h3>
            </div>
            <i class="fa fa-quote-left "></i>
            <p>
              We do $2M+ in monthly contractor payouts. grizzen's API integrates
              directly with our billing system. Commissions calculate
              automatically, transfers execute on schedule, everyone gets paid
              on time. Pure magic."
            </p>
          </div>

          <div className="testimonial-content">
            <div className="testimonial-header">
              <img src={southafrica} alt="customer-3" />
              <h3>Marketplace Manager, South Africa</h3>
            </div>
            <i class="fa fa-quote-left "></i>
            <p>
              We work with 500+ content creators across 15 countries. Manually
              tracking and paying each one was impossible. grizzen handles
              everything—FX, compliance, reporting. We've eliminated our payment
              bottleneck entirely."
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default testimony;
