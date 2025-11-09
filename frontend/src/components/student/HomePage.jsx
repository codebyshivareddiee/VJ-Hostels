import React from "react";
import img1 from "../../assets/1.jpg";
import img2 from "../../assets/2.jpg";
import img3 from "../../assets/3.jpg";
import img4 from "../../assets/4.png";
import logo from "../../assets/vnrvjiet-logo.png";
import AnnouncementBanner, { useAnnouncements } from "./AnnouncementBanner";
import "../../styles/homepage.css";

const HomePage = () => {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);
  const [bannerDismissed, setBannerDismissed] = React.useState(false);
  const { hasAnnouncements } = useAnnouncements();

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="home-page" style={{ margin: 0, padding: 0 }}>
      {/* Mobile Announcement Banner - Below Navbar */}
      {isMobile && !bannerDismissed && hasAnnouncements && (
        <div style={{ 
          position: 'fixed', 
          top: '90px', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          width: '90%', 
          maxWidth: '600px',
          zIndex: 40
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '9999px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            padding: '0.7rem 1rem',
            minHeight: '85px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <AnnouncementBanner onDismiss={() => setBannerDismissed(true)} />
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section
        className="hero-section-custom"
        style={{
          backgroundImage: `url(${img1})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          margin: 0,
          padding: "140px 20px 40px 20px",
          marginTop: "-1px",
        }}
      >
        {/* Glass Card Container */}
        <div
          className="glass-card-custom"
          style={{
            zIndex: 2,
            textAlign: "center",
            color: "white",
            padding: "30px 30px 35px 30px",
            maxWidth: "520px",
            width: "90%",
            marginTop: "80px",
            backgroundColor: "rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            borderRadius: "20px",
          }}
        >
          {/* Logo + Text */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "20px",
              gap: "15px",
              flexWrap: "wrap",
            }}
          >
            <img
              src={logo}
              alt="VNR VJIET Logo"
              style={{
                width: "70px",
                height: "70px",
              }}
            />
            <div style={{ textAlign: "center" }}>
              <h1
                className="hero-title-custom"
                style={{
                  margin: 0,
                  fontWeight: "bold",
                  fontSize: "2.2rem",
                  color: "#fff",
                }}
              >
                VNR VJIET
              </h1>
              <h4
                className="hero-subtitle-custom"
                style={{
                  margin: "3px 0 0 0",
                  fontSize: "1.4rem",
                  color: "#fff",
                  fontWeight: "600",
                }}
              >
                Hostel
              </h4>
            </div>
          </div>

          {/* Subtitle */}
          <p
            className="hero-text-custom"
            style={{
              fontSize: "1rem",
              margin: "0 auto 18px auto",
              color: "#fff",
              lineHeight: "1.5",
            }}
          >
            Your home away from home – Safe, Comfortable, and Supportive.
          </p>

          {/* Announcement Banner - Desktop Only */}
          {!isMobile && <AnnouncementBanner />}
        </div>
      </section>

      {/* Gallery Section */}
      <section style={{ padding: "100px 20px", background: "linear-gradient(180deg, #0f0c29, #302b63, #24243e)", position: "relative", overflow: "hidden" }}>
        {/* Animated Background Elements */}
        <div style={{ position: "absolute", top: "10%", left: "5%", width: "300px", height: "300px", background: "radial-gradient(circle, rgba(139,69,228,0.1), transparent)", borderRadius: "50%" }}></div>
        <div style={{ position: "absolute", bottom: "10%", right: "5%", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(30,144,255,0.1), transparent)", borderRadius: "50%" }}></div>
        
        <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ textAlign: "center", marginBottom: "80px" }}>
            <h2
              className="section-title"
              style={{
                fontSize: "3rem",
                fontWeight: "700",
                marginBottom: "15px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Explore Our Hostel
            </h2>
            <div style={{ width: "80px", height: "4px", background: "linear-gradient(90deg, #667eea, #764ba2)", margin: "20px auto" }}></div>
            <p
              style={{
                fontSize: "1.2rem",
                color: "rgba(255,255,255,0.8)",
                maxWidth: "600px",
                margin: "20px auto 0",
              }}
            >
              Experience premium facilities designed for modern living
            </p>
          </div>
          
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "40px",
            }}
          >
            {[
              { img: img2, title: "Comfortable Rooms", desc: "Spacious rooms with modern amenities", icon: "🛏️" },
              { img: img3, title: "Common Areas", desc: "Connect, relax, and collaborate", icon: "🏛️" },
              { img: img4, title: "Modern Facilities", desc: "State-of-the-art infrastructure", icon: "⚡" },
            ].map((item, index) => (
              <div
                key={index}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  backdropFilter: "blur(10px)",
                  borderRadius: "25px",
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.1)",
                  transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                  cursor: "pointer",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-15px) scale(1.02)";
                  e.currentTarget.style.border = "1px solid rgba(102, 126, 234, 0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)";
                }}
              >
                <div style={{ position: "relative", overflow: "hidden", height: "280px" }}>
                  <div style={{ 
                    position: "absolute", 
                    top: "20px", 
                    right: "20px", 
                    background: "rgba(255,255,255,0.95)", 
                    width: "60px", 
                    height: "60px", 
                    borderRadius: "50%", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    fontSize: "1.8rem",
                    zIndex: 2
                  }}>
                    {item.icon}
                  </div>
                  <img
                    src={item.img}
                    alt={item.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transition: "transform 0.5s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = "scale(1.15) rotate(2deg)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = "scale(1) rotate(0deg)";
                    }}
                  />
                  <div style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "50%",
                    background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
                  }}></div>
                </div>
                <div style={{ padding: "30px" }}>
                  <h4
                    style={{
                      fontSize: "1.6rem",
                      fontWeight: "700",
                      marginBottom: "12px",
                      color: "#fff",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {item.title}
                  </h4>
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "1.05rem", margin: 0, lineHeight: "1.6" }}>
                    {item.desc}
                  </p>
                  <div style={{
                    marginTop: "20px",
                    paddingTop: "20px",
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                  }}>
                    <span style={{
                      color: "#667eea",
                      fontSize: "0.95rem",
                      fontWeight: "600",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}>
                      Learn More →
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section
        className="contact-section"
        style={{
          padding: "80px 20px",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h2
            className="section-title"
            style={{
              textAlign: "center",
              fontSize: "2.5rem",
              fontWeight: "700",
              marginBottom: "20px",
              color: "white",
            }}
          >
            Emergency Contacts
          </h2>
          <p
            style={{
              textAlign: "center",
              fontSize: "1.1rem",
              color: "rgba(255,255,255,0.9)",
              marginBottom: "60px",
            }}
          >
            We're here for you 24/7
          </p>
          <div
            className="contact-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "25px",
              maxWidth: "800px",
              margin: "0 auto",
            }}
          >
            {[
              { title: "Hostel Warden", phone: "+91-98765-43210" },
              { title: "Security Office", phone: "+91-87654-32109" },
              { title: "Medical Assistance", phone: "+91-76543-21098" },
              { title: "Admin Office", phone: "+91-65432-10987" },
            ].map((contact, index) => (
              <div
                key={index}
                className="contact-card"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  backdropFilter: "blur(10px)",
                  borderRadius: "15px",
                  padding: "30px 20px",
                  textAlign: "center",
                  border: "1px solid rgba(255,255,255,0.2)",
                  transition: "transform 0.3s ease, background 0.3s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-5px)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                }}
              >
                <h4
                  style={{
                    fontSize: "1.3rem",
                    fontWeight: "600",
                    marginBottom: "15px",
                    color: "white",
                  }}
                >
                  {contact.title}
                </h4>
                <p
                  style={{
                    fontSize: "1.1rem",
                    color: "rgba(255,255,255,0.95)",
                    margin: 0,
                    fontWeight: "500",
                  }}
                >
                  {contact.phone}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="home-footer"
        style={{
          background: "#2c3e50",
          color: "white",
          textAlign: "center",
          padding: "30px 20px",
        }}
      >
        <p style={{ margin: 0, fontSize: "1rem" }}>
          © 2025 VNR VJIET Hostel | All Rights Reserved
        </p>
      </footer>
    </div>
  );
};

export default HomePage;