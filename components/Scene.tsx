'use client'

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
      <div className={styles.content}>
        <h1 className={styles.title}>Under Construction</h1>
        <p className={styles.subtitle}>AI Provider Management System</p>
        <div className={styles.loader}></div>
      </div>
    </div>
  )
}
