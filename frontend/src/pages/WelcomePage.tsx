import { motion, useScroll, useTransform } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useRef } from 'react'
import Navbar from '../components/Navbar'
import './WelcomePage.css'

export const WelcomePage = () => {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })

  const heroOpacity = useTransform(scrollYProgress, [0, 0.22], [1, 0])
  const heroY = useTransform(scrollYProgress, [0, 0.22], [0, -28])
  const heroScale = useTransform(scrollYProgress, [0, 0.22], [1, 0.92])

  const card1Scale = useTransform(scrollYProgress, [0, 0.30, 0.48], [0.86, 1, 0.86])
  const card1Opacity = useTransform(scrollYProgress, [0, 0.28, 0.42], [0, 1, 0])
  const card1Y = useTransform(scrollYProgress, [0, 0.42], [0, -80])

  const card2Scale = useTransform(scrollYProgress, [0.35, 0.56, 0.75], [0.86, 1, 0.86])
  const card2Opacity = useTransform(scrollYProgress, [0.32, 0.52, 0.72], [0, 1, 0])
  const card2Y = useTransform(scrollYProgress, [0.52, 0.72], [80, -60])

  const card3Scale = useTransform(scrollYProgress, [0.65, 0.86, 1], [0.86, 1, 0.86])
  const card3Opacity = useTransform(scrollYProgress, [0.6, 0.82, 1], [0, 1, 0])
  const card3Y = useTransform(scrollYProgress, [0.82, 1], [120, -20])

  return (
    <div className="welcome-page">
      <Navbar />

      <div className="welcome-content" ref={containerRef}>
        <div className="hero-section">
          <motion.h1
            className="hero-title"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            style={{ opacity: heroOpacity, y: heroY, scale: heroScale }}
          >
            Cook something
            <br />
            <span className="hero-title-gradient">extraordinary.</span>
          </motion.h1>

          <motion.p
            className="hero-subtitle"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            Snap a photo of your ingredients — get instant, real recipes tailored to what you have.
          </motion.p>
        </div>
        <motion.div
          className="cta-section"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <button className="apple-cta-button" onClick={() => navigate('/camera')}>Get Started</button>
          <p className="cta-subtext">Start creating with just a photo</p>
        </motion.div>

        <div className="features-scroll-container">
          <motion.div className="feature-card-scroll" style={{ scale: card1Scale, opacity: card1Opacity, y: card1Y }}>
            <h3 className="feature-title">Upload an image of your food</h3>
            <p className="feature-description">Snap a photo and upload your ingredients to get started.</p>
          </motion.div>

          <motion.div className="feature-card-scroll" style={{ scale: card2Scale, opacity: card2Opacity, y: card2Y }}>
            <h3 className="feature-title">Have AI generate you recipes</h3>
            <p className="feature-description">Our AI composes real recipes using only the ingredients you provide.</p>
          </motion.div>

          <motion.div className="feature-card-scroll" style={{ scale: card3Scale, opacity: card3Opacity, y: card3Y }}>
            <h3 className="feature-title">Have your past recipes stored</h3>
            <p className="feature-description">Save and revisit your favorite recipes and meal history.</p>
          </motion.div>
        </div>
      </div>
      <button
        className="bottom-cta-btn"
        onClick={() => navigate('/camera')}
        aria-label="Get Started"
      >
        Get Started
      </button>
    </div>
  )
}
