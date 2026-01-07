import "./Footer.css";

const Footer = () => {
  return (
    <footer class="footer-04" style={{ backgroundColor: "black" }}>
      <div class="container">
        <div class="row">
          <div class="col-md-6 col-lg-4 mb-md-0 mb-4">
            <div class="footer-heading">
              <a href="#hero" class="logo">
                <span
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#1B365D",
                  }}
                >
                  grizzen
                </span>
              </a>
            </div>
            <p
              style={{
                paddingRight: "60px",
                textAlign: "justify",
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: "14px",
              }}
            >
              The simplest way to pay teams, contractors, and vendors globally.
              grizzen powers payroll automation, vendor payments, and
              subscription disbursements for thousands of companies worldwide.
            </p>
            <a className="readmore" href="">
              read more
            </a>
          </div>

          <div class="col-md-6 col-lg-3 mb-md-0 mb-4">
            <h2 class="footer-heading">Information</h2>
            <ul class="list-unstyled">
              <li>
                <a href="" class="py-1 d-block">
                  Documentation
                </a>
              </li>
              <li>
                <a href="" class="py-1 d-block">
                  Credential
                </a>
              </li>
              <li>
                <a href="" class="py-1 d-block">
                  Developer Info
                </a>
              </li>
              <li>
                <a href="" class="py-1 d-block">
                  Pricing
                </a>
              </li>
            </ul>
          </div>

          <div class="col-md-6 col-lg-2 mb-md-0 mb-4">
            <h2 class="footer-heading">Quick Links</h2>

            <ul class="list-unstyled">
              <li>
                <a href="" class="py-1 d-block">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="" class="py-1 d-block">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="" class="py-1 d-block">
                  Privacy Policy
                </a>
              </li>

              <li>
                <a href="" class="py-1 d-block">
                  FAQ
                </a>
              </li>
              <li>
                <a href="" class="py-1 d-block">
                  Careers
                </a>
              </li>

              <li>
                <a href="" class="py-1 d-block">
                  Help &amp; Support
                </a>
              </li>
            </ul>
          </div>

          <div class="col-md-6 col-lg-3 mb-md-0 mb-4">
            <h2 class="footer-heading">Subscribe</h2>
            <form action="#" class="subscribe-form">
              <div class="form-group d-flex">
                <input
                  type="text"
                  class="form-control rounded-left"
                  placeholder="Enter email address"
                />
                <button
                  type="submit"
                  class="form-control submit"
                  style={{ backgroundColor: "rgb(87, 232, 24)" }}
                >
                  <i class="fa fa-paper-plane-o"></i>
                </button>
              </div>
            </form>
            <h2 class="footer-heading mt-5">Follow us</h2>
            <ul class="ftco-footer-social p-0">
              <li class="ftco-animate">
                <a
                  href="#"
                  data-toggle="tooltip"
                  data-placement="top"
                  title="Twitter"
                >
                  <span class="">
                    <i class="fa fa-twitter"></i>
                  </span>
                </a>
              </li>
              <li class="ftco-animate">
                <a
                  href="#"
                  data-toggle="tooltip"
                  data-placement="top"
                  title="Facebook"
                >
                  <span class="">
                    <i class="fa fa-facebook"></i>
                  </span>
                </a>
              </li>
              <li class="ftco-animate">
                <a
                  href="#"
                  data-toggle="tooltip"
                  data-placement="top"
                  title="Instagram"
                >
                  <span class="">
                    <i class="fa fa-instagram"></i>
                  </span>
                </a>
              </li>
              <li class="ftco-animate">
                <a
                  href="#"
                  data-toggle="tooltip"
                  data-placement="top"
                  title="Instagram"
                >
                  <span class="">
                    <i class="fa fa-linkedin"></i>
                  </span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="w-100 mt-5 border-top py-5">
        <div class="container">
          <div class="row">
            <div class="col-md-6 col-lg-8">
              <p class="copyright">
                Copyright &copy;{new Date().getFullYear()} All rights reserved
              </p>
            </div>
            <div class="col-md-6 col-lg-4 text-md-right">
              <p class="mb-0 list-unstyled">
                <a class="mr-md-3" href="#">
                  Terms
                </a>
                <a class="mr-md-3" href="#">
                  Privacy
                </a>
                <a class="mr-md-3" href="#">
                  Compliances
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
