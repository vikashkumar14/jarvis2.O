import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { irisService } from '@renderer/services/Iris-voice-ai'

// Monochrome teal/green palette — matches the dashboard's JARVIS AI theme
const ORBIT_COLOR = '#4DFFC7' // bright teal — rim glow + mid shell + orbit trail
const ORBIT_COLOR_DIM = '#00E38C' // base green — outer shell + lattice + fill glow
const ACCENT_COLOR = '#7FFFD9' // pale teal — inner shell
const CORE_COLOR = '#B6FFEA' // bright mint — hot center (kept out of pure-white territory so it doesn't wash out under additive blending)

// Red glow palette — used only as an overlay pulse when the AI is speaking
const SPEAK_GLOW_COLOR = '#FF3B3B'
const SPEAK_GLOW_COLOR_SOFT = '#FF6B5B'

// ── Fresnel rim-glow shader ──────────────────────────────────────────────
// This is what produces the bright, sharp cyan EDGE of the sphere seen in
// the reference image. A plain particle cloud can't do this — you need the
// view-angle-dependent falloff a fresnel term gives you.
const rimVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`
const rimFragmentShader = `
  uniform vec3 glowColor;
  uniform float intensity;
  uniform float power;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float rim = pow(1.0 - clamp(dot(vNormal, vViewDir), 0.0, 1.0), power);
    gl_FragColor = vec4(glowColor, rim * intensity);
  }
`

const ParticleCore = () => {
  const groupRef = useRef<THREE.Group>(null)
  const shellOuterRef = useRef<THREE.Points>(null)
  const shellMidRef = useRef<THREE.Points>(null)
  const shellInnerRef = useRef<THREE.Points>(null)
  const coreRef = useRef<THREE.Points>(null)
  const orbitLineRef = useRef<THREE.Line>(null)
  const orbitLineRef2 = useRef<THREE.Line>(null)
  const latticeRef = useRef<THREE.LineSegments>(null)
  const rimMeshRef = useRef<THREE.Mesh>(null)
  const fillMeshRef = useRef<THREE.Mesh>(null)

  // Red pulse overlay refs (only visible while irisService.isSpeaking)
  const speakGlowOuterRef = useRef<THREE.Points>(null)
  const speakGlowInnerRef = useRef<THREE.Points>(null)
  const speakRimRef = useRef<THREE.Mesh>(null)

  const dataArray = useMemo(() => new Uint8Array(128), [])
  const speakIntensity = useRef(0)

  const shellPositions = useMemo(() => {
    const makeShell = (radius: number, count: number, jitter: number) => {
      const positions = new Float32Array(count * 3)
      const golden = Math.PI * (3 - Math.sqrt(5))
      for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 2
        const radiusAtY = Math.sqrt(1 - y * y)
        const theta = golden * i
        const x = Math.cos(theta) * radiusAtY
        const z = Math.sin(theta) * radiusAtY
        const r = radius + (Math.random() - 0.5) * jitter
        positions[i * 3] = x * r
        positions[i * 3 + 1] = y * r
        positions[i * 3 + 2] = z * r
      }
      return positions
    }
    return {
      outer: makeShell(1.0, 220, 0.03),
      mid: makeShell(0.82, 170, 0.05),
      inner: makeShell(0.58, 120, 0.04),
      core: (() => {
        // fewer + lower opacity than before so it doesn't additive-saturate to white
        const pos = new Float32Array(220 * 3)
        for (let i = 0; i < 220; i++) {
          const theta = Math.acos(2 * Math.random() - 1)
          const phi = Math.random() * Math.PI * 2
          const r = 0.16 + Math.random() * 0.16
          pos[i * 3] = r * Math.sin(theta) * Math.cos(phi)
          pos[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi)
          pos[i * 3 + 2] = r * Math.cos(theta)
        }
        return pos
      })()
    }
  }, [])

  const speakGlowPositions = useMemo(() => {
    const makeShell = (radius: number, count: number, jitter: number) => {
      const positions = new Float32Array(count * 3)
      const golden = Math.PI * (3 - Math.sqrt(5))
      for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 2
        const radiusAtY = Math.sqrt(1 - y * y)
        const theta = golden * i
        const r = radius + (Math.random() - 0.5) * jitter
        positions[i * 3] = Math.cos(theta) * radiusAtY * r
        positions[i * 3 + 1] = y * r
        positions[i * 3 + 2] = Math.sin(theta) * radiusAtY * r
      }
      return positions
    }
    return {
      outer: makeShell(1.3, 160, 0.08),
      inner: makeShell(0.95, 120, 0.06)
    }
  }, [])

  // Orbit trails — tightened radius so they stay inside the camera frustum.
  // The old 2.0–2.25 radius rings were wider than the visible view at this
  // camera distance/fov, which is why they were getting clipped at the sides.
  const orbitPath = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(t) * 1.4, Math.sin(t * 2.0) * 0.2, Math.sin(t) * 1.4))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [])

  const orbitPath2 = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(t) * 1.55, Math.sin(t * 1.4) * 0.35, Math.sin(t) * 1.55))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [])

  const latticeGeometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1.2, 1)
    return new THREE.EdgesGeometry(geo)
  }, [])

  const rimMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          glowColor: { value: new THREE.Color(ORBIT_COLOR) },
          intensity: { value: 1.4 },
          power: { value: 2.6 }
        },
        vertexShader: rimVertexShader,
        fragmentShader: rimFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide
      }),
    []
  )

  const speakRimMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          glowColor: { value: new THREE.Color(SPEAK_GLOW_COLOR) },
          intensity: { value: 0 },
          power: { value: 2.2 }
        },
        vertexShader: rimVertexShader,
        fragmentShader: rimFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide
      }),
    []
  )

  useFrame((state) => {
    if (!groupRef.current) return

    let volume = 0
    if (irisService.analyser) {
      irisService.analyser.getByteFrequencyData(dataArray)
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
      volume = sum / dataArray.length / 128
    }

    const t = state.clock.elapsedTime

    const targetSpeak = irisService.isSpeaking ? 1 : 0
    speakIntensity.current = THREE.MathUtils.lerp(speakIntensity.current, targetSpeak, 0.08)
    const speak = speakIntensity.current

    if (shellOuterRef.current) {
      shellOuterRef.current.rotation.y = t * 0.12 + volume * 0.4
      shellOuterRef.current.rotation.x = Math.sin(t * 0.1) * 0.15
    }
    if (shellMidRef.current) {
      shellMidRef.current.rotation.y = -t * 0.18 + volume * 0.5
      shellMidRef.current.rotation.z = t * 0.05
    }
    if (shellInnerRef.current) {
      shellInnerRef.current.rotation.y = t * 0.26 + volume * 0.6
      shellInnerRef.current.rotation.x = -t * 0.07
    }
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.45
      coreRef.current.scale.setScalar(1 + volume * 0.4)
    }
    if (orbitLineRef.current) {
      orbitLineRef.current.rotation.y = t * 0.22
      orbitLineRef.current.rotation.x = Math.PI / 5 + Math.sin(t * 0.3) * 0.1
      const mat = orbitLineRef.current.material as THREE.LineBasicMaterial
      mat.opacity = 0.35 + volume * 0.35
    }
    if (orbitLineRef2.current) {
      orbitLineRef2.current.rotation.y = -t * 0.15
      orbitLineRef2.current.rotation.z = Math.PI / 7 + Math.sin(t * 0.22) * 0.12
      const mat = orbitLineRef2.current.material as THREE.LineBasicMaterial
      mat.opacity = 0.18 + volume * 0.2
    }
    if (latticeRef.current) {
      latticeRef.current.rotation.y = t * 0.04
      latticeRef.current.rotation.x = t * 0.025
    }

    // Breathing pulse — kept modest so it never grows past the frustum
    const pulse = Math.sin(t * 2.2) * 0.015 * (1 + volume * 1.5)
    groupRef.current.scale.setScalar(0.85 + pulse)

    if (shellOuterRef.current) {
      const mat = shellOuterRef.current.material as THREE.PointsMaterial
      mat.size = 0.014 + volume * 0.016
    }
    if (shellMidRef.current) {
      const mat = shellMidRef.current.material as THREE.PointsMaterial
      mat.size = 0.012 + volume * 0.014
    }
    if (shellInnerRef.current) {
      const mat = shellInnerRef.current.material as THREE.PointsMaterial
      mat.size = 0.01 + volume * 0.012
    }

    // Rim + fill glow react to voice volume so the whole orb "breathes" with audio
    if (rimMeshRef.current) {
      rimMeshRef.current.rotation.y = t * 0.05
      const mat = rimMeshRef.current.material as THREE.ShaderMaterial
      mat.uniforms.intensity.value = 1.1 + volume * 0.9
    }
    if (fillMeshRef.current) {
      const mat = fillMeshRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.1 + volume * 0.08
    }

    if (speakGlowOuterRef.current && speakGlowInnerRef.current) {
      const pulseFast = (Math.sin(t * 5.5) + 1) / 2
      const pulseSlow = (Math.sin(t * 2.0) + 1) / 2

      if (speak > 0.01) {
        speakGlowOuterRef.current.visible = true
        speakGlowInnerRef.current.visible = true

        speakGlowOuterRef.current.rotation.y = -t * 0.09
        speakGlowOuterRef.current.rotation.x = t * 0.05
        const outerMat = speakGlowOuterRef.current.material as THREE.PointsMaterial
        outerMat.size = 0.018 + pulseSlow * 0.014 + volume * 0.016
        outerMat.opacity = speak * (0.45 + pulseFast * 0.35 + volume * 0.3)

        speakGlowInnerRef.current.rotation.y = t * 0.14
        const innerMat = speakGlowInnerRef.current.material as THREE.PointsMaterial
        innerMat.size = 0.022 + pulseFast * 0.018 + volume * 0.02
        innerMat.opacity = speak * (0.55 + pulseFast * 0.3 + volume * 0.35)
      } else {
        speakGlowOuterRef.current.visible = false
        speakGlowInnerRef.current.visible = false
      }

      if (speakRimRef.current) {
        const mat = speakRimRef.current.material as THREE.ShaderMaterial
        mat.uniforms.intensity.value = speak * (1.3 + pulseFast * 0.6)
      }
    }
  })

  return (
    <group ref={groupRef}>
      {/* Soft fill glow — a translucent core sphere so the middle doesn't look empty */}
      <mesh ref={fillMeshRef}>
        <sphereGeometry args={[0.85, 32, 32]} />
        <meshBasicMaterial
          color={ORBIT_COLOR_DIM}
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Bright rim glow — this is what gives the sharp cyan edge from the reference */}
      <mesh ref={rimMeshRef} material={rimMaterial}>
        <sphereGeometry args={[1.0, 48, 48]} />
      </mesh>

      {/* Red rim overlay — only visible while speaking */}
      <mesh ref={speakRimRef} material={speakRimMaterial}>
        <sphereGeometry args={[1.05, 48, 48]} />
      </mesh>

      <points ref={shellOuterRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[shellPositions.outer, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={ORBIT_COLOR_DIM}
          size={0.014}
          transparent
          opacity={0.5}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      <points ref={shellMidRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[shellPositions.mid, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={ORBIT_COLOR}
          size={0.012}
          transparent
          opacity={0.6}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      <points ref={shellInnerRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[shellPositions.inner, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={ACCENT_COLOR}
          size={0.01}
          transparent
          opacity={0.55}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      <points ref={coreRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[shellPositions.core, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={CORE_COLOR}
          size={0.016}
          transparent
          opacity={0.5}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      <primitive
        ref={orbitLineRef as any}
        object={
          new THREE.Line(
            orbitPath,
            new THREE.LineBasicMaterial({
              color: ORBIT_COLOR,
              transparent: true,
              opacity: 0.35,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          )
        }
      />

      <primitive
        ref={orbitLineRef2 as any}
        object={
          new THREE.Line(
            orbitPath2,
            new THREE.LineBasicMaterial({
              color: ORBIT_COLOR_DIM,
              transparent: true,
              opacity: 0.18,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          )
        }
      />

      <lineSegments ref={latticeRef} geometry={latticeGeometry}>
        <lineBasicMaterial
          color={ORBIT_COLOR_DIM}
          transparent
          opacity={0.07}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      <points ref={speakGlowOuterRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[speakGlowPositions.outer, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={SPEAK_GLOW_COLOR_SOFT}
          size={0.018}
          transparent
          opacity={0}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      <points ref={speakGlowInnerRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[speakGlowPositions.inner, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={SPEAK_GLOW_COLOR}
          size={0.022}
          transparent
          opacity={0}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  )
}

const Sphere = () => {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.6], fov: 55 }}
      dpr={[1, 1.5]}
      performance={{ min: 0.5 }}
      gl={{
        antialias: false,
        powerPreference: 'high-performance',
        alpha: true,
        toneMapping: THREE.NoToneMapping
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <ParticleCore />
    </Canvas>
  )
}

export default Sphere