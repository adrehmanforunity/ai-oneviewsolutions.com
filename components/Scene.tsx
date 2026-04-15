'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text, PerspectiveCamera } from '@react-three/drei'
import { useRef, useEffect } from 'react'
import * as THREE from 'three'

function RotatingBox() {
  const meshRef = useRef<THREE.Mesh>(null)

  useEffect(() => {
    const animate = () => {
      if (meshRef.current) {
        meshRef.current.rotation.x += 0.005
        meshRef.current.rotation.y += 0.008
      }
      requestAnimationFrame(animate)
    }
    animate()
  }, [])

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshPhongMaterial color="#00d4ff" wireframe />
    </mesh>
  )
}

function FloatingParticles() {
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 20,
    y: (Math.random() - 0.5) * 20,
    z: (Math.random() - 0.5) * 20,
    speed: Math.random() * 0.02 + 0.01,
  }))

  return (
    <>
      {particles.map((particle) => (
        <mesh key={particle.id} position={[particle.x, particle.y, particle.z]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshPhongMaterial color="#0066cc" />
        </mesh>
      ))}
    </>
  )
}

export default function Scene() {
  return (
    <Canvas className="w-full h-full">
      <PerspectiveCamera makeDefault position={[0, 0, 8]} />
      <OrbitControls autoRotate autoRotateSpeed={2} />
      
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#00d4ff" />
      
      <RotatingBox />
      <FloatingParticles />
      
      <Text
        position={[0, -4, 0]}
        fontSize={1}
        color="#00d4ff"
        anchorX="center"
        anchorY="middle"
      >
        Under Construction
      </Text>
      
      <Text
        position={[0, -5, 0]}
        fontSize={0.5}
        color="#0066cc"
        anchorX="center"
        anchorY="middle"
      >
        AI Provider Management System
      </Text>
    </Canvas>
  )
}
