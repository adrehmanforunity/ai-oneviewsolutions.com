'use client'

import Image from 'next/image'
import styles from './Scene.module.css'

export default function Scene() {
  return (
    <div className={styles.container}>
      <div className={styles.background}>
        <div className={styles.cube}></div>
        <div className={styles.particles}>
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className={styles.particle}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* Top Left: Company Logo */}
      <div className={styles.topLeft}>
        <Image
          src="/logo.png"
          alt="OneView Solutions Logo"
          width={120}
          height={120}
          className={styles.companyLogo}
          priority
        />
      </div>

      {/* Center Content */}
      <div className={styles.content}>
        {/* App Logo */}
        <div className={styles.appLogoContainer}>
          <Image
            src="/app-logo.png"
            alt="AI Provider Management"
            width={150}
            height={150}
            className={styles.appLogo}
            priority
          />
        </div>

        <h1 className={styles.title}>Under Construction</h1>
        <p className={styles.subtitle}>AI Provider Management System</p>
        <p className={styles.company}>by OneView Solutions</p>
        <div className={styles.loader}></div>
      </div>

      {/* Bottom Right: Coming Soon */}
      <div className={styles.bottomRight}>
        <p className={styles.comingSoon}>Coming Soon</p>
        <p className={styles.domain}>aidemo.oneviewsolutions.com</p>
      </div>
    </div>
  )
}
