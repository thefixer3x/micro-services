import "./Home.css";
import WhyUs from "../components/WhyUs";
import africalink from "../assets/africatoworld2.jpg";

import Security from "../components/Security";
import Core from "../components/CoreMessage";
import Accessible from "../components/accessible";
import Apidocs from "../components/apidocs";
import Impacts from "../components/impacts";
import Testimony from "../components/testimony";

const Home = () => {
  return (
    <div>
      <div className="main">
        <div class="hero" id="hero">
          <div class=" column left">
            <h1 className="herodesktop">Simplify How Your Team Gets Paid</h1>
            {/* <h1 className="heromobile">Simplify How Your Team Gets Paid</h1> */}
            <p>
              {" "}
              Power your business with <br></br>
              <strong>grizzen</strong>, the seamless platform for paying teams,
              freelancers, and vendors <br></br>globally, with complete
              transparency.
            </p>
            <div class="button">
              <a href="">Start Sending Now</a>
            </div>
          </div>

          <div class="column right">
            <img src={africalink} alt="heroimage" />
          </div>
        </div>

        {/* core message */}

        {/* how it works */}
        <Core />

        <Accessible />
        {/* call to action */}

        <div className="call-to-action">
          <div className="call-to-action-sub">
            <h1 className="">
              Unlock Your Global <br />
              Potential Today
            </h1>
            <div className="call-button">
              <a href="">Unlock</a>
            </div>
          </div>
        </div>

        <Security />
        <section className="how-it-works" id="how">
          <div className="left">
            <h2 className="">Manage Global Team Payroll & Payments</h2>
            <p>
              Whether you're managing remote contractors, paying international
              vendors, or handling subscription disbursements, grizzen scales
              with your business.
            </p>
            <p className="">
              grizzen's intuitive platform handles complex payment scenarios
              with ease, giving you control, visibility, and peace of mind.
              Here's how it works.
            </p>

            <div class="button">
              <a href="">Start Now</a>
            </div>
          </div>
          <div className="right">
            <div className="step">
              <div className="right-header">
                <h5>1</h5>
                <h4>Sign up</h4>
              </div>
              <p>
                Connect your business data and set up payment routes in minutes.
                No lengthy onboarding—just instant access to global payouts.
              </p>
            </div>
            <div className="step bg-fill">
              <div className="right-header">
                <h5>2</h5>
                <h4>Pay Teams Globally</h4>
              </div>

              <p>
                Pay contractors, freelancers, and vendors across 100+ countries.
                Specify amounts in any currency, approve with one click, and
                funds arrive instantly. No middlemen, no delays.
              </p>
            </div>
            <div className="step bg-fill">
              <div className="right-header">
                <h5>3</h5>
                <h4>Track Your Transactions</h4>
              </div>

              <p>
                Real-time dashboards show you exactly where every payment
                is—from approval to settlement. Automated reports keep everyone
                aligned and compliant.
              </p>
            </div>

            <div className="step">
              <div className="right-header">
                <h5>4</h5>
                <h4>Enjoy Global Reach</h4>
              </div>

              <p>
                Connect payouts to your accounting system. Automate recurring
                payments for subscriptions and retainers. Scale from 10 team
                members to 1,000 without breaking a sweat.
              </p>
            </div>
          </div>
        </section>

        <Impacts />

        {/* feature */}
        <section class="features " id="features">
          <h2 className="features-heading" data-aos="fade-up">
            - Built for Modern Team Payments
          </h2>
          <p className="features-subheading">
            grizzen's platform gives you enterprise-grade control without the
            enterprise overhead—perfect for startups to mid-market teams.
          </p>
          <div class="features-contents">
            <div class="content" data-aos="fade-up">
              <div class="content-header">
                <i class="fa fa-credit-card"></i>
                <h4>Real-Time Payments</h4>
              </div>
              <p>
                Process payouts in seconds, not weeks. grizzen handles
                everything from currency conversion to local banking compliance,
                so your team gets paid on time, every time.
              </p>
            </div>

            <div class="content" data-aos="fade-up">
              <div class="content-header">
                <i class="fa fa-code" aria-hidden="true"></i>
                <h4>API-Driven Integration</h4>
              </div>
              <p>
                Connect grizzen to your payroll, accounting, or billing system.
                Our REST APIs make it simple to automate contractor payments,
                vendor settlements, and subscription payouts from day one.
              </p>
            </div>
          </div>

          <div class="features-contents">
            <div class="content" data-aos="fade-up">
              <div class="content-header">
                <i class="fa fa-globe" aria-hidden="true"></i>
                <h4>Global AML/KYC Compliant</h4>
              </div>
              <p>
                We adhere to the highest international standards for Anti-Money
                Laundering (AML) and Know Your Customer (KYC) regulations,
                ensuring every transaction is secure and compliant with global
                financial rules.
              </p>
            </div>

            <div class="content" data-aos="fade-up">
              <div class="content-header">
                <i class="fa fa-lock" aria-hidden="true"></i>
                <h4>Advanced Fraud Prevention</h4>
              </div>
              <p>
                Multi-factor authentication, transaction monitoring, and
                encryption keep your payment data safe. We comply with SOC 2,
                GDPR, and local financial regulations in every country you
                operate.
              </p>
            </div>
          </div>

          <div class="features-contents">
            <div class="content" data-aos="fade-up">
              <div class="content-header">
                <i class="fa fa-desktop" aria-hidden="true"></i>
                <h4>Multi-Currency Support</h4>
              </div>
              <p>
                Pay in USD, EUR, GBP, INR, or any of 100+ currencies. Clients
                and contractors work in their preferred currency; grizzen
                handles the rest with fair, transparent rates.
              </p>
            </div>

            <div class="content" data-aos="fade-up">
              <div class="content-header">
                <i class="fa fa-usd" aria-hidden="true"></i>
                <h4>Lower & Transparent Fees</h4>
              </div>
              <p>
                No hidden fees, no markup surprises. You see the exact cost
                before every payment. Our pricing scales with you—startups pay
                less, enterprises get volume discounts.
              </p>
            </div>
          </div>
        </section>

        {/* why choose us */}

        <Apidocs />

        <WhyUs />

        <Testimony />
        <div className="last-call-to-action">
          <div>
            <h1 className="">Pay Your Global Team Today</h1>
            <p>
              Join hundreds of companies simplifying how they pay contractors,
              vendors, and team members worldwide. Sign up free and start paying
              in minutes.
            </p>
          </div>
          <div className="call-button">
            <a href="">Request A Demo</a>
          </div>
        </div>

        {/* <div class="take-action">
                    <div class="take-action-content">
                        <h1 data-aos="fade-up">Unlock Your Global Potential Today</h1>
                        <p data-aos="fade-up">grizzen is shaping the next frontier of digital 
                            finance, capturing global attention as a transformative force in the industry. Download 
                        our app for you mobile device</p>

                        <div class="button">
                            <a href=""><img class="apple" src={applestore} alt=""/></a>
                            <a href=""><img src={googleplay} alt=""/></a>
                        </div>
                    </div>
                </div> */}

        {/* <div class="next-action">
                    <div class="text-content column">
                        <h2 data-aos="fade-right">- Securely Transfer Money From Any Country </h2>
                        <p data-aos="fade-right">We Outsmart cybercriminals and leave them empty-handed by implementing strong security measures, 
                            such as multi-factor authentication, encryption, and regular system updates. 
                            We protect sensitive data from falling into the wrong hands</p>

                            <div class="tranfer-form">
                                <div class="select-country">
                                    <div class="from">
                                        <span>From </span>
                                        <select name="country" class="form-select">
                                            <option value="AF">Afghanistan 🇦🇫</option>
                                            <option value="AO">Angola 🇦🇴</option>
                                            <option value="AL">Albania 🇦🇱</option>
                                            <option value="AD">Andorra 🇦🇩</option>
                                            <option value="AE">United Arab Emirates 🇦🇪</option>
                                            <option value="AR">Argentina 🇦🇷</option>
                                            <option value="AM">Armenia 🇦🇲</option>
                                            <option value="AG">Antigua and Barbuda 🇦🇬</option>
                                            <option value="AU">Australia 🇦🇺</option>
                                            <option value="AT">Austria 🇦🇹</option>
                                            <option value="AZ">Azerbaijan 🇦🇿</option>
                                            <option value="BI">Burundi 🇧🇮</option>
                                            <option value="BE">Belgium 🇧🇪</option>
                                            <option value="BJ">Benin 🇧🇯</option>
                                            <option value="BF">Burkina Faso 🇧🇫</option>
                                            <option value="BD">Bangladesh 🇧🇩</option>
                                            <option value="BG">Bulgaria 🇧🇬</option>
                                            <option value="BH">Bahrain 🇧🇭</option>
                                            <option value="BS">Bahamas 🇧🇸</option>
                                            <option value="BA">Bosnia and Herzegovina 🇧🇦</option>
                                            <option value="BY">Belarus 🇧🇾</option>
                                            <option value="BZ">Belize 🇧🇿</option>
                                            <option value="BO">Bolivia 🇧🇴</option>
                                            <option value="BR">Brazil 🇧🇷</option>
                                            <option value="BB">Barbados 🇧🇧</option>
                                            <option value="BN">Brunei 🇧🇳</option>
                                            <option value="BT">Bhutan 🇧🇹</option>
                                            <option value="BW">Botswana 🇧🇼</option>
                                            <option value="CF">Central African Republic 🇨🇫</option>
                                            <option value="CA">Canada 🇨🇦</option>
                                            <option value="CH">Switzerland 🇨🇭</option>
                                            <option value="CL">Chile 🇨🇱</option>
                                            <option value="CN">China 🇨🇳</option>
                                            <option value="CI">Ivory Coast 🇨🇮</option>
                                            <option value="CM">Cameroon 🇨🇲</option>
                                            <option value="CD">DR Congo 🇨🇩</option>
                                            <option value="CG">Republic of the Congo 🇨🇬</option>
                                            <option value="CO">Colombia 🇨🇴</option>
                                            <option value="KM">Comoros 🇰🇲</option>
                                            <option value="CV">Cape Verde 🇨🇻</option>
                                            <option value="CR">Costa Rica 🇨🇷</option>
                                            <option value="CU">Cuba 🇨🇺</option>
                                            <option value="CY">Cyprus 🇨🇾</option>
                                            <option value="CZ">Czechia 🇨🇿</option>
                                            <option value="DE">Germany 🇩🇪</option>
                                            <option value="DJ">Djibouti 🇩🇯</option>
                                            <option value="DM">Dominica 🇩🇲</option>
                                            <option value="DK">Denmark 🇩🇰</option>
                                            <option value="DO">Dominican Republic 🇩🇴</option>
                                            <option value="DZ">Algeria 🇩🇿</option>
                                            <option value="EC">Ecuador 🇪🇨</option>
                                            <option value="EG">Egypt 🇪🇬</option>
                                            <option value="ER">Eritrea 🇪🇷</option>
                                            <option value="ES">Spain 🇪🇸</option>
                                            <option value="EE">Estonia 🇪🇪</option>
                                            <option value="ET">Ethiopia 🇪🇹</option>
                                            <option value="FI">Finland 🇫🇮</option>
                                            <option value="FJ">Fiji 🇫🇯</option>
                                            <option value="FR">France 🇫🇷</option>
                                            <option value="FM">Micronesia 🇫🇲</option>
                                            <option value="GA">Gabon 🇬🇦</option>
                                            <option value="GB">United Kingdom 🇬🇧</option>
                                            <option value="GE">Georgia 🇬🇪</option>
                                            <option value="GH">Ghana 🇬🇭</option>
                                            <option value="GN">Guinea 🇬🇳</option>
                                            <option value="GM">Gambia 🇬🇲</option>
                                            <option value="GW">Guinea-Bissau 🇬🇼</option>
                                            <option value="GQ">Equatorial Guinea 🇬🇶</option>
                                            <option value="GR">Greece 🇬🇷</option>
                                            <option value="GD">Grenada 🇬🇩</option>
                                            <option value="GT">Guatemala 🇬🇹</option>
                                            <option value="GY">Guyana 🇬🇾</option>
                                            <option value="HN">Honduras 🇭🇳</option>
                                            <option value="HR">Croatia 🇭🇷</option>
                                            <option value="HT">Haiti 🇭🇹</option>
                                            <option value="HU">Hungary 🇭🇺</option>
                                            <option value="ID">Indonesia 🇮🇩</option>
                                            <option value="IN">India 🇮🇳</option>
                                            <option value="IE">Ireland 🇮🇪</option>
                                            <option value="IR">Iran 🇮🇷</option>
                                            <option value="IQ">Iraq 🇮🇶</option>
                                            <option value="IS">Iceland 🇮🇸</option>
                                            <option value="IL">Israel 🇮🇱</option>
                                            <option value="IT">Italy 🇮🇹</option>
                                            <option value="JM">Jamaica 🇯🇲</option>
                                            <option value="JO">Jordan 🇯🇴</option>
                                            <option value="JP">Japan 🇯🇵</option>
                                            <option value="KZ">Kazakhstan 🇰🇿</option>
                                            <option value="KE">Kenya 🇰🇪</option>
                                            <option value="KG">Kyrgyzstan 🇰🇬</option>
                                            <option value="KH">Cambodia 🇰🇭</option>
                                            <option value="KI">Kiribati 🇰🇮</option>
                                            <option value="KN">Saint Kitts and Nevis 🇰🇳</option>
                                            <option value="KR">South Korea 🇰🇷</option>
                                            <option value="KW">Kuwait 🇰🇼</option>
                                            <option value="LA">Laos 🇱🇦</option>
                                            <option value="LB">Lebanon 🇱🇧</option>
                                            <option value="LR">Liberia 🇱🇷</option>
                                            <option value="LY">Libya 🇱🇾</option>
                                            <option value="LC">Saint Lucia 🇱🇨</option>
                                            <option value="LI">Liechtenstein 🇱🇮</option>
                                            <option value="LK">Sri Lanka 🇱🇰</option>
                                            <option value="LS">Lesotho 🇱🇸</option>
                                            <option value="LT">Lithuania 🇱🇹</option>
                                            <option value="LU">Luxembourg 🇱🇺</option>
                                            <option value="LV">Latvia 🇱🇻</option>
                                            <option value="MA">Morocco 🇲🇦</option>
                                            <option value="MC">Monaco 🇲🇨</option>
                                            <option value="MD">Moldova 🇲🇩</option>
                                            <option value="MG">Madagascar 🇲🇬</option>
                                            <option value="MV">Maldives 🇲🇻</option>
                                            <option value="MX">Mexico 🇲🇽</option>
                                            <option value="MH">Marshall Islands 🇲🇭</option>
                                            <option value="MK">Macedonia 🇲🇰</option>
                                            <option value="ML">Mali 🇲🇱</option>
                                            <option value="MT">Malta 🇲🇹</option>
                                            <option value="MM">Myanmar 🇲🇲</option>
                                            <option value="ME">Montenegro 🇲🇪</option>
                                            <option value="MN">Mongolia 🇲🇳</option>
                                            <option value="MZ">Mozambique 🇲🇿</option>
                                            <option value="MR">Mauritania 🇲🇷</option>
                                            <option value="MU">Mauritius 🇲🇺</option>
                                            <option value="MW">Malawi 🇲🇼</option>
                                            <option value="MY">Malaysia 🇲🇾</option>
                                            <option value="NA">Namibia 🇳🇦</option>
                                            <option value="NE">Niger 🇳🇪</option>
                                            <option value="NG">Nigeria 🇳🇬</option>
                                            <option value="NI">Nicaragua 🇳🇮</option>
                                            <option value="NL">Netherlands 🇳🇱</option>
                                            <option value="NO">Norway 🇳🇴</option>
                                            <option value="NP">Nepal 🇳🇵</option>
                                            <option value="NR">Nauru 🇳🇷</option>
                                            <option value="NZ">New Zealand 🇳🇿</option>
                                            <option value="OM">Oman 🇴🇲</option>
                                            <option value="PK">Pakistan 🇵🇰</option>
                                            <option value="PA">Panama 🇵🇦</option>
                                            <option value="PE">Peru 🇵🇪</option>
                                            <option value="PH">Philippines 🇵🇭</option>
                                            <option value="PW">Palau 🇵🇼</option>
                                            <option value="PG">Papua New Guinea 🇵🇬</option>
                                            <option value="PL">Poland 🇵🇱</option>
                                            <option value="KP">North Korea 🇰🇵</option>
                                            <option value="PT">Portugal 🇵🇹</option>
                                            <option value="PY">Paraguay 🇵🇾</option>
                                            <option value="QA">Qatar 🇶🇦</option>
                                            <option value="RO">Romania 🇷🇴</option>
                                            <option value="RU">Russia 🇷🇺</option>
                                            <option value="RW">Rwanda 🇷🇼</option>
                                            <option value="SA">Saudi Arabia 🇸🇦</option>
                                            <option value="SD">Sudan 🇸🇩</option>
                                            <option value="SN">Senegal 🇸🇳</option>
                                            <option value="SG">Singapore 🇸🇬</option>
                                            <option value="SB">Solomon Islands 🇸🇧</option>
                                            <option value="SL">Sierra Leone 🇸🇱</option>
                                            <option value="SV">El Salvador 🇸🇻</option>
                                            <option value="SM">San Marino 🇸🇲</option>
                                            <option value="SO">Somalia 🇸🇴</option>
                                            <option value="RS">Serbia 🇷🇸</option>
                                            <option value="SS">South Sudan 🇸🇸</option>
                                            <option value="ST">São Tomé and Príncipe 🇸🇹</option>
                                            <option value="SR">Suriname 🇸🇷</option>
                                            <option value="SK">Slovakia 🇸🇰</option>
                                            <option value="SI">Slovenia 🇸🇮</option>
                                            <option value="SE">Sweden 🇸🇪</option>
                                            <option value="SZ">Swaziland 🇸🇿</option>
                                            <option value="SC">Seychelles 🇸🇨</option>
                                            <option value="SY">Syria 🇸🇾</option>
                                            <option value="TD">Chad 🇹🇩</option>
                                            <option value="TG">Togo 🇹🇬</option>
                                            <option value="TH">Thailand 🇹🇭</option>
                                            <option value="TJ">Tajikistan 🇹🇯</option>
                                            <option value="TM">Turkmenistan 🇹🇲</option>
                                            <option value="TL">Timor-Leste 🇹🇱</option>
                                            <option value="TO">Tonga 🇹🇴</option>
                                            <option value="TT">Trinidad and Tobago 🇹🇹</option>
                                            <option value="TN">Tunisia 🇹🇳</option>
                                            <option value="TR">Turkey 🇹🇷</option>
                                            <option value="TV">Tuvalu 🇹🇻</option>
                                            <option value="TZ">Tanzania 🇹🇿</option>
                                            <option value="UG">Uganda 🇺🇬</option>
                                            <option value="UA">Ukraine 🇺🇦</option>
                                            <option value="UY">Uruguay 🇺🇾</option>
                                            <option value="US">United States 🇺🇸</option>
                                            <option value="UZ">Uzbekistan 🇺🇿</option>
                                            <option value="VA">Vatican City 🇻🇦</option>
                                            <option value="VC">Saint Vincent and the Grenadines 🇻🇨</option>
                                            <option value="VE">Venezuela 🇻🇪</option>
                                            <option value="VN">Vietnam 🇻🇳</option>
                                            <option value="VU">Vanuatu 🇻🇺</option>
                                            <option value="WS">Samoa 🇼🇸</option>
                                            <option value="YE">Yemen 🇾🇪</option>
                                            <option value="ZA">South Africa 🇿🇦</option>
                                            <option value="ZM">Zambia 🇿🇲</option>
                                            <option value="ZW">Zimbabwe 🇿🇼</option>
                                        </select>
                                    </div>
                                    
                                    <div class="to">
                                        <span>Destination </span>                                        
                                        <select name="country" class="form-select">
                                            <option value="AF">Afghanistan 🇦🇫</option>
                                            <option value="AO">Angola 🇦🇴</option>
                                            <option value="AL">Albania 🇦🇱</option>
                                            <option value="AD">Andorra 🇦🇩</option>
                                            <option value="AE">United Arab Emirates 🇦🇪</option>
                                            <option value="AR">Argentina 🇦🇷</option>
                                            <option value="AM">Armenia 🇦🇲</option>
                                            <option value="AG">Antigua and Barbuda 🇦🇬</option>
                                            <option value="AU">Australia 🇦🇺</option>
                                            <option value="AT">Austria 🇦🇹</option>
                                            <option value="AZ">Azerbaijan 🇦🇿</option>
                                            <option value="BI">Burundi 🇧🇮</option>
                                            <option value="BE">Belgium 🇧🇪</option>
                                            <option value="BJ">Benin 🇧🇯</option>
                                            <option value="BF">Burkina Faso 🇧🇫</option>
                                            <option value="BD">Bangladesh 🇧🇩</option>
                                            <option value="BG">Bulgaria 🇧🇬</option>
                                            <option value="BH">Bahrain 🇧🇭</option>
                                            <option value="BS">Bahamas 🇧🇸</option>
                                            <option value="BA">Bosnia and Herzegovina 🇧🇦</option>
                                            <option value="BY">Belarus 🇧🇾</option>
                                            <option value="BZ">Belize 🇧🇿</option>
                                            <option value="BO">Bolivia 🇧🇴</option>
                                            <option value="BR">Brazil 🇧🇷</option>
                                            <option value="BB">Barbados 🇧🇧</option>
                                            <option value="BN">Brunei 🇧🇳</option>
                                            <option value="BT">Bhutan 🇧🇹</option>
                                            <option value="BW">Botswana 🇧🇼</option>
                                            <option value="CF">Central African Republic 🇨🇫</option>
                                            <option value="CA">Canada 🇨🇦</option>
                                            <option value="CH">Switzerland 🇨🇭</option>
                                            <option value="CL">Chile 🇨🇱</option>
                                            <option value="CN">China 🇨🇳</option>
                                            <option value="CI">Ivory Coast 🇨🇮</option>
                                            <option value="CM">Cameroon 🇨🇲</option>
                                            <option value="CD">DR Congo 🇨🇩</option>
                                            <option value="CG">Republic of the Congo 🇨🇬</option>
                                            <option value="CO">Colombia 🇨🇴</option>
                                            <option value="KM">Comoros 🇰🇲</option>
                                            <option value="CV">Cape Verde 🇨🇻</option>
                                            <option value="CR">Costa Rica 🇨🇷</option>
                                            <option value="CU">Cuba 🇨🇺</option>
                                            <option value="CY">Cyprus 🇨🇾</option>
                                            <option value="CZ">Czechia 🇨🇿</option>
                                            <option value="DE">Germany 🇩🇪</option>
                                            <option value="DJ">Djibouti 🇩🇯</option>
                                            <option value="DM">Dominica 🇩🇲</option>
                                            <option value="DK">Denmark 🇩🇰</option>
                                            <option value="DO">Dominican Republic 🇩🇴</option>
                                            <option value="DZ">Algeria 🇩🇿</option>
                                            <option value="EC">Ecuador 🇪🇨</option>
                                            <option value="EG">Egypt 🇪🇬</option>
                                            <option value="ER">Eritrea 🇪🇷</option>
                                            <option value="ES">Spain 🇪🇸</option>
                                            <option value="EE">Estonia 🇪🇪</option>
                                            <option value="ET">Ethiopia 🇪🇹</option>
                                            <option value="FI">Finland 🇫🇮</option>
                                            <option value="FJ">Fiji 🇫🇯</option>
                                            <option value="FR">France 🇫🇷</option>
                                            <option value="FM">Micronesia 🇫🇲</option>
                                            <option value="GA">Gabon 🇬🇦</option>
                                            <option value="GB">United Kingdom 🇬🇧</option>
                                            <option value="GE">Georgia 🇬🇪</option>
                                            <option value="GH">Ghana 🇬🇭</option>
                                            <option value="GN">Guinea 🇬🇳</option>
                                            <option value="GM">Gambia 🇬🇲</option>
                                            <option value="GW">Guinea-Bissau 🇬🇼</option>
                                            <option value="GQ">Equatorial Guinea 🇬🇶</option>
                                            <option value="GR">Greece 🇬🇷</option>
                                            <option value="GD">Grenada 🇬🇩</option>
                                            <option value="GT">Guatemala 🇬🇹</option>
                                            <option value="GY">Guyana 🇬🇾</option>
                                            <option value="HN">Honduras 🇭🇳</option>
                                            <option value="HR">Croatia 🇭🇷</option>
                                            <option value="HT">Haiti 🇭🇹</option>
                                            <option value="HU">Hungary 🇭🇺</option>
                                            <option value="ID">Indonesia 🇮🇩</option>
                                            <option value="IN">India 🇮🇳</option>
                                            <option value="IE">Ireland 🇮🇪</option>
                                            <option value="IR">Iran 🇮🇷</option>
                                            <option value="IQ">Iraq 🇮🇶</option>
                                            <option value="IS">Iceland 🇮🇸</option>
                                            <option value="IL">Israel 🇮🇱</option>
                                            <option value="IT">Italy 🇮🇹</option>
                                            <option value="JM">Jamaica 🇯🇲</option>
                                            <option value="JO">Jordan 🇯🇴</option>
                                            <option value="JP">Japan 🇯🇵</option>
                                            <option value="KZ">Kazakhstan 🇰🇿</option>
                                            <option value="KE">Kenya 🇰🇪</option>
                                            <option value="KG">Kyrgyzstan 🇰🇬</option>
                                            <option value="KH">Cambodia 🇰🇭</option>
                                            <option value="KI">Kiribati 🇰🇮</option>
                                            <option value="KN">Saint Kitts and Nevis 🇰🇳</option>
                                            <option value="KR">South Korea 🇰🇷</option>
                                            <option value="KW">Kuwait 🇰🇼</option>
                                            <option value="LA">Laos 🇱🇦</option>
                                            <option value="LB">Lebanon 🇱🇧</option>
                                            <option value="LR">Liberia 🇱🇷</option>
                                            <option value="LY">Libya 🇱🇾</option>
                                            <option value="LC">Saint Lucia 🇱🇨</option>
                                            <option value="LI">Liechtenstein 🇱🇮</option>
                                            <option value="LK">Sri Lanka 🇱🇰</option>
                                            <option value="LS">Lesotho 🇱🇸</option>
                                            <option value="LT">Lithuania 🇱🇹</option>
                                            <option value="LU">Luxembourg 🇱🇺</option>
                                            <option value="LV">Latvia 🇱🇻</option>
                                            <option value="MA">Morocco 🇲🇦</option>
                                            <option value="MC">Monaco 🇲🇨</option>
                                            <option value="MD">Moldova 🇲🇩</option>
                                            <option value="MG">Madagascar 🇲🇬</option>
                                            <option value="MV">Maldives 🇲🇻</option>
                                            <option value="MX">Mexico 🇲🇽</option>
                                            <option value="MH">Marshall Islands 🇲🇭</option>
                                            <option value="MK">Macedonia 🇲🇰</option>
                                            <option value="ML">Mali 🇲🇱</option>
                                            <option value="MT">Malta 🇲🇹</option>
                                            <option value="MM">Myanmar 🇲🇲</option>
                                            <option value="ME">Montenegro 🇲🇪</option>
                                            <option value="MN">Mongolia 🇲🇳</option>
                                            <option value="MZ">Mozambique 🇲🇿</option>
                                            <option value="MR">Mauritania 🇲🇷</option>
                                            <option value="MU">Mauritius 🇲🇺</option>
                                            <option value="MW">Malawi 🇲🇼</option>
                                            <option value="MY">Malaysia 🇲🇾</option>
                                            <option value="NA">Namibia 🇳🇦</option>
                                            <option value="NE">Niger 🇳🇪</option>
                                            <option value="NG">Nigeria 🇳🇬</option>
                                            <option value="NI">Nicaragua 🇳🇮</option>
                                            <option value="NL">Netherlands 🇳🇱</option>
                                            <option value="NO">Norway 🇳🇴</option>
                                            <option value="NP">Nepal 🇳🇵</option>
                                            <option value="NR">Nauru 🇳🇷</option>
                                            <option value="NZ">New Zealand 🇳🇿</option>
                                            <option value="OM">Oman 🇴🇲</option>
                                            <option value="PK">Pakistan 🇵🇰</option>
                                            <option value="PA">Panama 🇵🇦</option>
                                            <option value="PE">Peru 🇵🇪</option>
                                            <option value="PH">Philippines 🇵🇭</option>
                                            <option value="PW">Palau 🇵🇼</option>
                                            <option value="PG">Papua New Guinea 🇵🇬</option>
                                            <option value="PL">Poland 🇵🇱</option>
                                            <option value="KP">North Korea 🇰🇵</option>
                                            <option value="PT">Portugal 🇵🇹</option>
                                            <option value="PY">Paraguay 🇵🇾</option>
                                            <option value="QA">Qatar 🇶🇦</option>
                                            <option value="RO">Romania 🇷🇴</option>
                                            <option value="RU">Russia 🇷🇺</option>
                                            <option value="RW">Rwanda 🇷🇼</option>
                                            <option value="SA">Saudi Arabia 🇸🇦</option>
                                            <option value="SD">Sudan 🇸🇩</option>
                                            <option value="SN">Senegal 🇸🇳</option>
                                            <option value="SG">Singapore 🇸🇬</option>
                                            <option value="SB">Solomon Islands 🇸🇧</option>
                                            <option value="SL">Sierra Leone 🇸🇱</option>
                                            <option value="SV">El Salvador 🇸🇻</option>
                                            <option value="SM">San Marino 🇸🇲</option>
                                            <option value="SO">Somalia 🇸🇴</option>
                                            <option value="RS">Serbia 🇷🇸</option>
                                            <option value="SS">South Sudan 🇸🇸</option>
                                            <option value="ST">São Tomé and Príncipe 🇸🇹</option>
                                            <option value="SR">Suriname 🇸🇷</option>
                                            <option value="SK">Slovakia 🇸🇰</option>
                                            <option value="SI">Slovenia 🇸🇮</option>
                                            <option value="SE">Sweden 🇸🇪</option>
                                            <option value="SZ">Swaziland 🇸🇿</option>
                                            <option value="SC">Seychelles 🇸🇨</option>
                                            <option value="SY">Syria 🇸🇾</option>
                                            <option value="TD">Chad 🇹🇩</option>
                                            <option value="TG">Togo 🇹🇬</option>
                                            <option value="TH">Thailand 🇹🇭</option>
                                            <option value="TJ">Tajikistan 🇹🇯</option>
                                            <option value="TM">Turkmenistan 🇹🇲</option>
                                            <option value="TL">Timor-Leste 🇹🇱</option>
                                            <option value="TO">Tonga 🇹🇴</option>
                                            <option value="TT">Trinidad and Tobago 🇹🇹</option>
                                            <option value="TN">Tunisia 🇹🇳</option>
                                            <option value="TR">Turkey 🇹🇷</option>
                                            <option value="TV">Tuvalu 🇹🇻</option>
                                            <option value="TZ">Tanzania 🇹🇿</option>
                                            <option value="UG">Uganda 🇺🇬</option>
                                            <option value="UA">Ukraine 🇺🇦</option>
                                            <option value="UY">Uruguay 🇺🇾</option>
                                            <option value="US">United States 🇺🇸</option>
                                            <option value="UZ">Uzbekistan 🇺🇿</option>
                                            <option value="VA">Vatican City 🇻🇦</option>
                                            <option value="VC">Saint Vincent and the Grenadines 🇻🇨</option>
                                            <option value="VE">Venezuela 🇻🇪</option>
                                            <option value="VN">Vietnam 🇻🇳</option>
                                            <option value="VU">Vanuatu 🇻🇺</option>
                                            <option value="WS">Samoa 🇼🇸</option>
                                            <option value="YE">Yemen 🇾🇪</option>
                                            <option value="ZA">South Africa 🇿🇦</option>
                                            <option value="ZM">Zambia 🇿🇲</option>
                                            <option value="ZW">Zimbabwe 🇿🇼</option>
                                        </select>
                                    </div> 
                                </div>
                            </div>
                    </div>
                    <div class="img-content column" data-aos="fade-up">
                        <img src={securityimg} alt=""/>
                    </div>
                </div> */}
      </div>
    </div>
  );
};

export default Home;
